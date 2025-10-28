// DEVELOPMENT ONLY - Bypass SSL certificate validation for corporate networks
// WARNING: Remove this in production!
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import 'dotenv/config';
import { AppServer, AppSession, ViewType, StreamType } from '@mentra/sdk';
import { FileStorageClient } from './services/fileStorageClient';
import { NameExtractionService } from './services/nameExtractionService';
import { ConversationManager } from './services/conversationManager';
import { OpenAITranscriptionService, TranscriptionSegment } from './services/openaiTranscriptionService';

// Environment variables
const PACKAGE_NAME = process.env.PACKAGE_NAME ?? (() => { throw new Error('PACKAGE_NAME is not set in .env file'); })();
const MENTRAOS_API_KEY = process.env.MENTRAOS_API_KEY ?? (() => { throw new Error('MENTRAOS_API_KEY is not set in .env file'); })();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? (() => { throw new Error('OPENAI_API_KEY is not set in .env file'); })();
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const PORT = parseInt(process.env.PORT || '3000');

class MemoryGlassesApp extends AppServer {
  private memoryClient: FileStorageClient;
  private nameExtractor: NameExtractionService;
  private transcriptionService: OpenAITranscriptionService;
  private conversationManager?: ConversationManager;
  private sessionActive = false;

  constructor() {
    super({
      packageName: PACKAGE_NAME,
      apiKey: MENTRAOS_API_KEY,
      port: PORT,
    });

    // Initialize services
    this.memoryClient = new FileStorageClient('./data');
    this.nameExtractor = new NameExtractionService(OPENAI_API_KEY, OPENAI_MODEL);
    this.transcriptionService = new OpenAITranscriptionService(OPENAI_API_KEY);

    console.log('\n╔═════════════════════════════════════════╗');
    console.log('║   Smart Glasses Memory Assistant v2.0   ║');
    console.log('╚═════════════════════════════════════════╝\n');
    console.log('Services ready:');
    console.log('- File Storage Client (./data/memories.json)');
    console.log(`- Name Extraction (OpenAI ${OPENAI_MODEL})`);
    console.log('- Voice Recognition (OpenAI gpt-4o-transcribe-diarize)');
  }

  protected async onSession(session: AppSession, sessionId: string, userId: string): Promise<void> {
    console.log(`\n=== New Session Started ===`);
    console.log(`Session ID: ${sessionId}`);
    console.log(`User ID: ${userId}`);

    this.sessionActive = true;

    // Create conversation manager for this session
    this.conversationManager = new ConversationManager(
      this.memoryClient,
      this.nameExtractor,
      this.transcriptionService  // Pass transcription service for voice clip extraction
    );

    // Show welcome message
    session.layouts.showTextWall(
      "Memory Assistant Ready!\nListening...",
      {
        view: ViewType.MAIN,
        durationMs: 3000
      }
    );

    // Get all known people for voice recognition
    const knownPeople = await this.memoryClient.getAllPeople();
    const peopleWithVoices = knownPeople.filter(p => p.voiceReference);
    console.log(`✓ Loaded ${knownPeople.length} known people, ${peopleWithVoices.length} with voice profiles`);
    if (peopleWithVoices.length > 0) {
      console.log(`  Names: ${peopleWithVoices.map(p => p.name).join(', ')}`);
    }

    // Start OpenAI transcription service with voice recognition
    await this.transcriptionService.start(
      knownPeople,
      async (segment: TranscriptionSegment) => {
        if (!this.conversationManager) return;

        // Get display name - check if we know who this speaker is
        let displayName = segment.speaker;
        
        // If OpenAI returned A/B/C, try to map to known name
        if (segment.speaker === 'Unknown' || segment.speaker.match(/^[A-Z]$/)) {
          const knownName = this.conversationManager.getDisplayName(segment.speaker);
          if (knownName && knownName !== 'Unknown Speaker') {
            displayName = knownName;
          }
        }

        console.log(`[${displayName}] ${segment.text}`);

        // Process transcription with speaker name (or "Unknown")
        const result = await this.conversationManager.processTranscription(
          segment.speaker,
          segment.text,
          true
        );

        // Handle speaker recognition
        if (result.action === 'speaker_recognized' && result.data) {
          const person = result.data.person;
          
          // Build contextual conversation prompts from recent history
          let message = `${person.name}`;
          
          // Use conversation history for richer context
          if (person.conversationHistory && person.conversationHistory.length > 0) {
            const lastConv = person.conversationHistory[person.conversationHistory.length - 1];
            
            // Prioritize key points for quick, actionable context
            if (lastConv.keyPoints && lastConv.keyPoints.length > 0) {
              message += '\n\nLast time:';
              lastConv.keyPoints.slice(0, 3).forEach((point: string) => {
                message += `\n• ${point}`;
              });
            } else if (lastConv.transcript && lastConv.transcript !== 'Error generating summary') {
              // Fallback to summary if no key points
              message += `\n\nLast time:\n"${lastConv.transcript}"`;
            } else if (lastConv.topics && lastConv.topics.length > 0) {
              // Fallback to topics if summary unavailable
              message += '\n\nLast topics:';
              lastConv.topics.slice(0, 3).forEach((topic: string) => {
                message += `\n• ${topic}`;
              });
            }
            
            // Show conversation count if multiple
            if (person.conversationHistory.length > 1) {
              message += `\n\n(${person.conversationHistory.length} conversations)`;
            }
          } else if (person.lastConversation) {
            // Backward compatibility - use old lastConversation field
            message += `\n\nLast time:\n"${person.lastConversation.substring(0, 100)}${person.lastConversation.length > 100 ? '...' : ''}"`;
          } else if (person.lastTopics && person.lastTopics.length > 0) {
            // Backward compatibility - use old lastTopics field
            message += '\n\nLast topics:';
            person.lastTopics.slice(0, 3).forEach((topic: string) => {
              message += `\n• ${topic}`;
            });
          } else {
            message += '\n\nFirst conversation!';
          }

          session.layouts.showTextWall(message, {
            view: ViewType.MAIN,
            durationMs: 8000
          });

          console.log(`\n✓ Recognized returning person: ${person.name}`);
          if (person.conversationHistory && person.conversationHistory.length > 0) {
            console.log(`  Total conversations: ${person.conversationHistory.length}`);
            const lastConv = person.conversationHistory[person.conversationHistory.length - 1];
            if (lastConv.topics && lastConv.topics.length > 0) {
              console.log(`  Previous topics: ${lastConv.topics.join(', ')}`);
            }
          } else if (person.lastTopics) {
            console.log(`  Previous topics: ${person.lastTopics.join(', ')}`);
          }
        }

        // Handle new person identified
        if (result.action === 'new_person_identified' && result.data) {
          const person = result.data.person;
          const message = `Nice to meet you,\n${person.name}!`;

          session.layouts.showTextWall(message, {
            view: ViewType.MAIN,
            durationMs: 3000
          });

          console.log(`\n✓ New person identified: ${person.name}`);
          
          // Update transcription service with new person's voice profile
          if (person.voiceReference) {
            const updatedPeople = await this.memoryClient.getAllPeople();
            this.transcriptionService.updateKnownPeople(updatedPeople);
          }
        }
      }
    );

    // Subscribe to audio chunks from MentraOS
    session.subscribe(StreamType.AUDIO_CHUNK);
    session.events.onAudioChunk((audioData) => {
      if (audioData.arrayBuffer) {
        // Convert ArrayBuffer to Buffer and send to transcription service
        const buffer = Buffer.from(audioData.arrayBuffer);
        this.transcriptionService.bufferAudio(buffer);
      }
    });

    console.log('✓ Voice recognition started - OpenAI will identify speakers by voice');

    // Handle disconnect and session end
    session.events.onDisconnected(async (reason) => {
      console.log('\n=== Session Disconnected ===');
      console.log('Reason:', reason);
      this.sessionActive = false;

      // Stop transcription service
      await this.transcriptionService.stop();
      console.log('✓ Transcription service stopped');

      // Save conversation summary
      if (this.conversationManager) {
        const summaryResult = await this.conversationManager.endConversation();

        if (summaryResult.peopleUpdated.length > 0) {
          console.log(`\n✓ Conversation saved for: ${summaryResult.peopleUpdated.join(', ')}`);
          
          if (summaryResult.topics && summaryResult.topics.length > 0) {
            console.log(`  Topics discussed: ${summaryResult.topics.join(', ')}`);
          }

          // Show farewell message
          const farewell = summaryResult.peopleUpdated.length === 1
            ? `Goodbye ${summaryResult.peopleUpdated[0]}!`
            : `Goodbye everyone!`;

          const topicsText = summaryResult.topics && summaryResult.topics.length > 0
            ? `\nTopics: ${summaryResult.topics.slice(0, 3).join(', ')}`
            : '';

          session.layouts.showTextWall(
            `${farewell}\n\nConversation saved!${topicsText}`,
            {
              view: ViewType.MAIN,
              durationMs: 3000
            }
          );
        }
      }

      this.conversationManager = undefined;
    });
  }
}

// Create and start the app
(async () => {
  const app = new MemoryGlassesApp();
  await app.start();
  
  console.log(`\n✓ Server started on port ${PORT}`);
  console.log(`✓ Package: ${PACKAGE_NAME}\n`);
  console.log('Ready to accept connections from MentraOS!');
  console.log('Make sure to:');
  console.log('1. Run ngrok to expose this server');
  console.log('2. Register the app in MentraOS Console');
  console.log('3. Add microphone permission in the console\n');
})();
