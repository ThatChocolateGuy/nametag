// DEVELOPMENT ONLY - Bypass SSL certificate validation for corporate networks
// WARNING: Remove this in production!
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import 'dotenv/config';
import { AppServer, AppSession, ViewType, StreamType } from '@mentra/sdk';
// import { MemoryClient } from './services/memoryClient';  // Memory MCP (SSE timeout issue)
import { FileStorageClient as MemoryClient } from './services/fileStorageClient';  // File storage (working)
import { NameExtractionService } from './services/nameExtractionService';
import { ConversationManager } from './services/conversationManager';
import { DiarizationService } from './services/diarizationService';

// Environment variables
const PACKAGE_NAME = process.env.PACKAGE_NAME ?? (() => { throw new Error('PACKAGE_NAME is not set in .env file'); })();
const MENTRAOS_API_KEY = process.env.MENTRAOS_API_KEY ?? (() => { throw new Error('MENTRAOS_API_KEY is not set in .env file'); })();
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY || ''; // Optional: for speaker diarization
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? (() => { throw new Error('OPENAI_API_KEY is not set in .env file'); })();
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const ENABLE_DIARIZATION = process.env.ENABLE_DIARIZATION === 'true';  // Feature flag
// Memory MCP URL (optional - using file storage by default due to SSE timeout)
const MEMORY_MCP_URL = process.env.MEMORY_MCP_URL || '';
const PORT = parseInt(process.env.PORT || '3000');

class MemoryGlassesApp extends AppServer {
  private memoryClient: MemoryClient;
  private nameExtractor: NameExtractionService;
  private diarizationService?: DiarizationService;
  private conversationManager?: ConversationManager;
  private sessionActive = false;
  private useDiarization: boolean;

  constructor() {
    super({
      packageName: PACKAGE_NAME,
      apiKey: MENTRAOS_API_KEY,
      port: PORT,
    });

    // Initialize services
    // Using file storage by default (Memory MCP has SSE timeout issues)
    // To use Memory MCP: import MemoryClient and pass MEMORY_MCP_URL
    this.memoryClient = new MemoryClient('./data');  // File storage path
    this.nameExtractor = new NameExtractionService(OPENAI_API_KEY, OPENAI_MODEL);

    // Initialize diarization if enabled and API key available
    this.useDiarization = ENABLE_DIARIZATION && ASSEMBLYAI_API_KEY.length > 0;
    if (this.useDiarization) {
      this.diarizationService = new DiarizationService(ASSEMBLYAI_API_KEY);
      console.log('✓ Speaker diarization enabled (AssemblyAI)');
    }

    console.log('Memory Glasses App initialized');
    console.log('Services ready:');
    console.log('- File Storage Client (./data/memories.json)');
    console.log(`- Name Extraction (OpenAI ${OPENAI_MODEL})`);
    console.log(this.useDiarization
      ? '- Speaker Diarization (AssemblyAI real-time)'
      : '- Speaker Diarization (disabled - using MentraOS transcription)');
  }

  protected async onSession(session: AppSession, sessionId: string, userId: string): Promise<void> {
    console.log(`\n=== New Session Started ===`);
    console.log(`Session ID: ${sessionId}`);
    console.log(`User ID: ${userId}`);

    this.sessionActive = true;

    // Create conversation manager for this session
    this.conversationManager = new ConversationManager(
      this.memoryClient,
      this.nameExtractor
    );

    // Show welcome message
    session.layouts.showTextWall(
      "Memory Assistant Ready!\nListening for names...",
      {
        view: ViewType.MAIN,
        durationMs: 3000
      }
    );

    // Track conversation buffer for periodic processing
    let transcriptBuffer: string[] = [];
    let lastProcessTime = Date.now();
    const PROCESS_INTERVAL = 30000; // Process every 30 seconds

    // Choose transcription method based on diarization setting
    if (this.useDiarization && this.diarizationService) {
      console.log('✓ Using AssemblyAI for speaker-diarized transcription');

      // Start AssemblyAI real-time transcription with diarization
      await this.diarizationService.startRealtime(async (segment) => {
        if (!this.conversationManager || !segment.isFinal) return;

        console.log(`[${segment.speaker}] ${segment.text}`);
        transcriptBuffer.push(segment.text);

        // Process transcription with speaker ID
        const result = await this.conversationManager.processTranscription(
          segment.speaker,
          segment.text,
          true
        );

        // Handle speaker recognition
        if (result.action === 'speaker_recognized' && result.data) {
          const person = result.data.person;
          const message = `Hello ${person.name}!\n${person.lastConversation ? `Last: ${person.lastConversation}` : 'Good to see you!'}`;

          session.layouts.showTextWall(message, {
            view: ViewType.MAIN,
            durationMs: 5000
          });

          console.log(`\n✓ Recognized: ${person.name}`);
          if (person.lastTopics) {
            console.log(`  Topics: ${person.lastTopics.join(', ')}`);
          }
        }

        // Periodic processing for name extraction
        const now = Date.now();
        if (now - lastProcessTime > PROCESS_INTERVAL && transcriptBuffer.length > 0) {
          await this.processBufferedTranscripts(session, transcriptBuffer);
          transcriptBuffer = [];
          lastProcessTime = now;
        }
      }, 16000);  // 16kHz sample rate

      // Subscribe to audio chunks from MentraOS and forward to AssemblyAI
      session.subscribe(StreamType.AUDIO_CHUNK);
      session.events.onAudioChunk((audioData) => {
        if (this.diarizationService && audioData.arrayBuffer) {
          // Convert ArrayBuffer to Buffer and send to AssemblyAI
          const buffer = Buffer.from(audioData.arrayBuffer);
          this.diarizationService.sendAudio(buffer);
        }
      });

      console.log('✓ Audio streaming to AssemblyAI started');
    } else {
      // Fallback: Use MentraOS transcription (no speaker diarization)
      console.log('Using MentraOS transcription (no speaker diarization)');

      session.events.onTranscription(async (data) => {
        if (!this.conversationManager) return;

        if (data.isFinal && data.text.trim()) {
          console.log(`Transcription: ${data.text}`);

          // For POC, use "Speaker A" as default since MentraOS doesn't provide speaker IDs
          const speaker = "Speaker A";

          transcriptBuffer.push(data.text);

          // Process transcription
          const result = await this.conversationManager.processTranscription(
            speaker,
            data.text,
            true
          );

          // Handle speaker recognition
          if (result.action === 'speaker_recognized' && result.data) {
            const person = result.data.person;
            const message = `Hello ${person.name}!\n${person.lastConversation ? `Last: ${person.lastConversation}` : 'Good to see you!'}`;

            session.layouts.showTextWall(message, {
              view: ViewType.MAIN,
              durationMs: 5000
            });

            console.log(`\n✓ Recognized: ${person.name}`);
            if (person.lastTopics) {
              console.log(`  Topics: ${person.lastTopics.join(', ')}`);
            }
          }

          // Periodic processing for name extraction
          const now = Date.now();
          if (now - lastProcessTime > PROCESS_INTERVAL && transcriptBuffer.length > 0) {
            await this.processBufferedTranscripts(session, transcriptBuffer);
            transcriptBuffer = [];
            lastProcessTime = now;
          }
        }
      });
    }

    // Handle disconnect and session end
    session.events.onDisconnected(async (reason) => {
      console.log('\n=== Session Disconnected ===');
      console.log('Reason:', reason);
      this.sessionActive = false;

      // Stop diarization service if running
      if (this.useDiarization && this.diarizationService) {
        await this.diarizationService.stopRealtime();
        console.log('✓ AssemblyAI diarization stopped');
      }

      // Save conversation summary if session ended
      if (this.conversationManager) {
        const summaryResult = await this.conversationManager.endConversation();

        if (summaryResult.peopleUpdated.length > 0) {
          // Show farewell message with summary preview
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

          console.log(`\n✓ Updated ${summaryResult.peopleUpdated.length} person records`);
        }
      }
    });

    // Show periodic status
    setInterval(() => {
      if (this.sessionActive) {
        console.log(`[${new Date().toLocaleTimeString()}] Session active - Listening...`);
      }
    }, 60000); // Every minute
  }

  /**
   * Process buffered transcripts for name extraction
   */
  private async processBufferedTranscripts(
    session: AppSession,
    transcripts: string[]
  ): Promise<void> {
    if (!this.conversationManager || transcripts.length === 0) return;

    const fullTranscript = transcripts.join(' ');

    try {
      const names = await this.nameExtractor.extractNames(fullTranscript);

      for (const extracted of names) {
        console.log(`\n✓ Name detected: ${extracted.name} (confidence: ${extracted.confidence})`);

        // Check if person already exists
        const existingPerson = await this.memoryClient.findPersonByName(extracted.name);

        if (existingPerson) {
          // Show recognition
          session.layouts.showTextWall(
            `Welcome back ${extracted.name}!`,
            {
              view: ViewType.MAIN,
              durationMs: 4000
            }
          );
        } else {
          // New person
          await this.memoryClient.storePerson({
            name: extracted.name,
            speakerId: "Speaker A", // Default for POC
            lastMet: new Date()
          });

          session.layouts.showTextWall(
            `Nice to meet you ${extracted.name}!`,
            {
              view: ViewType.MAIN,
              durationMs: 4000
            }
          );
        }
      }
    } catch (error) {
      console.error('Error processing transcripts:', error);
    }
  }
}

// Start the server
console.log('\n╔═════════════════════════════════════════╗');
console.log('║   Smart Glasses Memory Assistant v1.0   ║');
console.log('╚═════════════════════════════════════════╝\n');

const app = new MemoryGlassesApp();

app.start()
  .then(() => {
    console.log(`\n✓ Server started on port ${PORT}`);
    console.log(`✓ Package: ${PACKAGE_NAME}`);
    console.log('\nReady to accept connections from MentraOS!');
    console.log('Make sure to:');
    console.log('1. Run ngrok to expose this server');
    console.log('2. Register the app in MentraOS Console');
    console.log('3. Add microphone permission in the console\n');
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\nShutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\nShutting down gracefully...');
  process.exit(0);
});
