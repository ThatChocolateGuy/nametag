import { MemoryClient, Person } from './memoryClient';
import { NameExtractionService } from './nameExtractionService';

export interface ConversationBuffer {
  text: string;
  timestamp: number;
}

export class ConversationManager {
  private memoryClient: MemoryClient;
  private nameExtractor: NameExtractionService;
  private conversationBuffer: ConversationBuffer[] = [];
  private readonly bufferMaxSize = 20; // Keep last 20 utterances
  private readonly nameCheckInterval = 10; // Check for names every 10 utterances
  private utteranceCount = 0;

  // Track active conversation state
  private activeSpeakers = new Set<string>();
  private speakerNames = new Map<string, string>(); // speakerId -> name

  constructor(
    memoryClient: MemoryClient,
    nameExtractor: NameExtractionService
  ) {
    this.memoryClient = memoryClient;
    this.nameExtractor = nameExtractor;
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

      // Check for names periodically
      if (this.utteranceCount % this.nameCheckInterval === 0) {
        await this.checkForNames();
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
  private async checkForNames(): Promise<void> {
    if (this.conversationBuffer.length === 0) return;

    const transcript = this.conversationBuffer
      .map(seg => seg.text)
      .join('\n');

    try {
      const names = await this.nameExtractor.extractNames(transcript);

      for (const extracted of names) {
        // Try to match the name to a speaker based on context
        // For simplicity, associate with the most recent speaker
        const lastSpeaker = Array.from(this.activeSpeakers).pop();
        if (!lastSpeaker) continue;

        // Check if we already know this person
        const existingPerson = await this.memoryClient.findPersonByName(extracted.name);

        if (existingPerson) {
          // Update speaker mapping
          this.speakerNames.set(lastSpeaker, extracted.name);
          console.log(`Recognized returning person: ${extracted.name}`);
        } else {
          // New person - create entry
          const newPerson: Person = {
            name: extracted.name,
            speakerId: lastSpeaker,
            lastMet: new Date()
          };

          await this.memoryClient.storePerson(newPerson);
          this.speakerNames.set(lastSpeaker, extracted.name);
          console.log(`Stored new person: ${extracted.name}`);
        }
      }
    } catch (error) {
      console.error('Error checking for names:', error);
    }
  }

  /**
   * End current conversation and save summary
   */
  async endConversation(): Promise<void> {
    if (this.conversationBuffer.length === 0) return;

    const transcript = this.conversationBuffer
      .map(seg => seg.text)
      .join('\n');

    try {
      // Generate summary
      const summary = await this.nameExtractor.summarizeConversation(transcript);

      // Update all people involved in the conversation
      for (const [speakerId, name] of this.speakerNames.entries()) {
        const person = await this.memoryClient.getPerson(speakerId);
        if (person) {
          // Update with latest conversation info
          await this.memoryClient.storePerson({
            ...person,
            lastConversation: summary.summary,
            lastTopics: summary.mainTopics,
            lastMet: new Date()
          });
        }
      }

      console.log('Conversation summary saved');
    } catch (error) {
      console.error('Error ending conversation:', error);
    }

    // Clear state
    this.conversationBuffer = [];
    this.activeSpeakers.clear();
    this.utteranceCount = 0;
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
