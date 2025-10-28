import { Person, ConversationEntry } from './memoryClient';
import { NameExtractionService } from './nameExtractionService';
import { OpenAITranscriptionService } from './openaiTranscriptionService';

// Storage interface that both MemoryClient and FileStorageClient implement
export interface IStorageClient {
  getPerson(id: string): Promise<Person | null>;
  findPersonByName(name: string): Promise<Person | null>;
  storePerson(person: Person): Promise<void>;
}

export interface ConversationBuffer {
  text: string;
  timestamp: number;
}

export class ConversationManager {
  private memoryClient: IStorageClient;
  private nameExtractor: NameExtractionService;
  private transcriptionService?: OpenAITranscriptionService;
  private conversationBuffer: ConversationBuffer[] = [];
  private readonly bufferMaxSize = 20; // Keep last 20 utterances
  private readonly nameCheckInterval = 10; // Check for names every 10 utterances
  private utteranceCount = 0;

  // Track active conversation state
  private activeSpeakers = new Set<string>();
  private speakerNames = new Map<string, string>(); // speakerId -> name

  constructor(
    memoryClient: IStorageClient,
    nameExtractor: NameExtractionService,
    transcriptionService?: OpenAITranscriptionService
  ) {
    this.memoryClient = memoryClient;
    this.nameExtractor = nameExtractor;
    this.transcriptionService = transcriptionService;
  }

  /**
   * Get display name for a speaker ID
   * Returns actual name if known, otherwise "Unknown Speaker"
   */
  getDisplayName(speakerId: string): string {
    return this.speakerNames.get(speakerId) || 'Unknown Speaker';
  }

  /**
   * Get speaker ID for a known name (reverse lookup)
   */
  getSpeakerId(name: string): string | undefined {
    for (const [id, n] of this.speakerNames.entries()) {
      if (n === name) return id;
    }
    return undefined;
  }

  /**
   * Process a new transcription segment
   */
  async processTranscription(
    speaker: string,
    text: string,
    isFinal: boolean
  ): Promise<{ action: string; data?: any }> {
    // Add to buffer
    if (isFinal) {
      this.conversationBuffer.push({
        text: `${speaker}: ${text}`,
        timestamp: Date.now()
      });

      // Keep buffer size manageable
      if (this.conversationBuffer.length > this.bufferMaxSize) {
        this.conversationBuffer.shift();
      }

      this.utteranceCount++;
      this.activeSpeakers.add(speaker);

      // Check for names if we detect introduction keywords OR every 10 utterances
      const introKeywords = /\b(i'?m|my name is|i am|call me|this is)\b/i;
      if (introKeywords.test(text) || this.utteranceCount % this.nameCheckInterval === 0) {
        if (introKeywords.test(text)) {
          console.log(`🎯 Detected introduction keywords in: "${text}"`);
        }
        const nameResult = await this.checkForNames();
        if (nameResult) {
          return nameResult; // Return new person identification
        }
      }

      // Check if speaker is recognized
      const recognizedName = this.speakerNames.get(speaker);
      if (!recognizedName) {
        const person = await this.memoryClient.getPerson(speaker);
        if (person) {
          this.speakerNames.set(speaker, person.name);
          return {
            action: 'speaker_recognized',
            data: {
              speaker,
              person
            }
          };
        }
      }
    }

    return { action: 'transcription_processed' };
  }

  /**
   * Check conversation buffer for names
   */
  private async checkForNames(): Promise<{ action: string; data?: any } | null> {
    if (this.conversationBuffer.length === 0) return null;

    const transcript = this.conversationBuffer
      .map(seg => seg.text)
      .join('\n');

    console.log(`\n📝 Checking for names in ${this.conversationBuffer.length} utterances:`);
    console.log(transcript.substring(0, 200) + (transcript.length > 200 ? '...' : ''));

    try {
      const names = await this.nameExtractor.extractNames(transcript);
      console.log(`✓ Name extraction returned ${names.length} names:`, names.map(n => `${n.name} (${n.confidence})`));

      for (const extracted of names) {
        // Only process high-confidence self-introductions
        if (extracted.confidence !== 'high') {
          console.log(`⚠️  Ignoring low/medium confidence name: ${extracted.name} (${extracted.confidence})`);
          continue;
        }

        // Find which speaker introduced themselves by parsing the buffer
        const speakerId = this.findSpeakerForName(extracted.name);
        if (!speakerId) {
          console.log(`⚠️  Could not determine speaker for name: ${extracted.name}`);
          continue;
        }

        // Check if this speaker already has an identity
        const currentIdentity = this.speakerNames.get(speakerId);
        if (currentIdentity) {
          console.log(`⚠️  Speaker ${speakerId} already identified as "${currentIdentity}", ignoring "${extracted.name}"`);
          continue;
        }

        // Check if we already know this person by name
        const existingPerson = await this.memoryClient.findPersonByName(extracted.name);

        if (existingPerson) {
          // Known person - update their speaker ID for this session
          existingPerson.speakerId = speakerId;
          existingPerson.lastMet = new Date();
          await this.memoryClient.storePerson(existingPerson);
          
          this.speakerNames.set(speakerId, extracted.name);
          console.log(`✓ Recognized returning person: ${extracted.name} (Speaker ${speakerId})`);
        } else {
          // New person - create entry with voice reference
          const newPerson: Person = {
            name: extracted.name,
            speakerId: speakerId,
            conversationHistory: [],
            lastMet: new Date()
          };

          // Extract voice clip if transcription service is available
          if (this.transcriptionService) {
            console.log(`🎤 Extracting voice clip for ${extracted.name}...`);
            const voiceClip = await this.transcriptionService.extractRecentVoiceClip(7000); // 7 seconds
            
            if (voiceClip) {
              newPerson.voiceReference = voiceClip;
              console.log(`✓ Voice clip extracted for ${extracted.name}`);
            } else {
              console.log(`⚠️  Could not extract voice clip for ${extracted.name}`);
            }
          }

          await this.memoryClient.storePerson(newPerson);
          this.speakerNames.set(speakerId, extracted.name);
          console.log(`✓ Stored new person: ${extracted.name} (Speaker ${speakerId})`);
          
          return {
            action: 'new_person_identified',
            data: {
              speaker: speakerId,
              person: newPerson
            }
          };
        }
      }
    } catch (error) {
      console.error('Error checking for names:', error);
    }
    
    return null; // No new person identified
  }

  /**
   * Find which speaker introduced themselves with a given name
   * Looks for patterns like "A: I'm John" or "B: My name is Sarah"
   */
  private findSpeakerForName(name: string): string | null {
    // Search recent buffer for self-introduction patterns
    const nameLower = name.toLowerCase();
    const introPatterns = [
      /^([A-Z]):\s*(?:i'm|i am|my name is|this is|call me)\s+/i,
      /^([A-Z]):\s*.*(?:i'm|i am|my name is|this is|call me)\s+/i
    ];

    for (const segment of this.conversationBuffer.slice(-10)) {
      const text = segment.text.toLowerCase();
      
      // Check if this segment contains the name
      if (text.includes(nameLower)) {
        // Extract speaker ID from format "A: text" or "B: text"
        const match = segment.text.match(/^([A-Z]):/);
        if (match) {
          // Verify it's a self-introduction pattern
          if (introPatterns.some(pattern => pattern.test(segment.text))) {
            return match[1];
          }
        }
      }
    }

    return null;
  }

  /**
   * End current conversation and save summary
   */
  async endConversation(): Promise<{
    summary?: string;
    topics?: string[];
    peopleUpdated: string[];
  }> {
    const result = {
      summary: undefined as string | undefined,
      topics: undefined as string[] | undefined,
      peopleUpdated: [] as string[]
    };

    if (this.conversationBuffer.length === 0) {
      console.log('No conversation to summarize');
      return result;
    }

    // Replace speaker IDs (A, B, C) with actual names in transcript
    let transcript = this.conversationBuffer
      .map(seg => seg.text)
      .join('\n');

    // Replace each speaker ID with their name
    for (const [speakerId, name] of this.speakerNames.entries()) {
      // Match "A: " or "B: " at the beginning of lines
      const regex = new RegExp(`^${speakerId}:`, 'gm');
      transcript = transcript.replace(regex, `${name}:`);
    }

    console.log('\n=== Generating Conversation Summary ===');
    console.log(`Transcript length: ${transcript.length} characters`);
    console.log(`People involved: ${Array.from(this.speakerNames.values()).join(', ')}`);

    try {
      // Generate summary (now with actual names instead of A/B/C)
      const summary = await this.nameExtractor.summarizeConversation(transcript);

      console.log('\n✓ Summary generated:');
      console.log(`  Main topics: ${summary.mainTopics.join(', ')}`);
      console.log(`  Summary: ${summary.summary}`);
      console.log(`  Key points: ${summary.keyPoints.length} points`);

      result.summary = summary.summary;
      result.topics = summary.mainTopics;

      // Create conversation entry with key points
      const conversationEntry = {
        date: new Date(),
        transcript: summary.summary,
        topics: summary.mainTopics,
        keyPoints: summary.keyPoints,
        duration: Math.round((Date.now() - this.conversationBuffer[0].timestamp) / 1000)
      };

      // Update all people involved in the conversation
      for (const [speakerId, name] of this.speakerNames.entries()) {
        const person = await this.memoryClient.getPerson(speakerId);
        if (person) {
          // Add to conversation history
          const updatedHistory = [...(person.conversationHistory || []), conversationEntry];
          
          // Update with latest conversation info (for backward compatibility)
          await this.memoryClient.storePerson({
            ...person,
            conversationHistory: updatedHistory,
            lastConversation: summary.summary,
            lastTopics: summary.mainTopics,
            lastMet: new Date()
          });

          result.peopleUpdated.push(name);
          console.log(`✓ Updated ${name} with conversation summary (total: ${updatedHistory.length} conversations)`);
        }
      }

      console.log('\n✓ Conversation summary saved successfully');
    } catch (error) {
      console.error('Error ending conversation:', error);
    }

    // Clear state
    this.conversationBuffer = [];
    this.activeSpeakers.clear();
    this.utteranceCount = 0;

    return result;
  }

  /**
   * Get current conversation context for a speaker
   */
  async getSpeakerContext(speaker: string): Promise<string> {
    const name = this.speakerNames.get(speaker);
    if (!name) {
      const person = await this.memoryClient.getPerson(speaker);
      if (person) {
        this.speakerNames.set(speaker, person.name);
        return this.formatPersonContext(person);
      }
      return 'Unknown speaker';
    }

    const person = await this.memoryClient.getPerson(speaker);
    if (!person) return name;

    return this.formatPersonContext(person);
  }

  /**
   * Format person info for display
   */
  private formatPersonContext(person: Person): string {
    let context = person.name;

    if (person.lastConversation) {
      context += `\nLast: ${person.lastConversation}`;
    }

    if (person.lastTopics && person.lastTopics.length > 0) {
      context += `\nTopics: ${person.lastTopics.join(', ')}`;
    }

    return context;
  }

  /**
   * Get known speaker name
   */
  getSpeakerName(speaker: string): string | undefined {
    return this.speakerNames.get(speaker);
  }
}
