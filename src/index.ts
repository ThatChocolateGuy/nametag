// DEVELOPMENT ONLY - Bypass SSL certificate validation for corporate networks
// WARNING: Remove this in production!
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import 'dotenv/config';
import { AppServer, AppSession, ViewType, StreamType } from '@mentra/sdk';
import { SupabaseStorageClient } from './services/supabaseStorageClient';
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
  private memoryClient: SupabaseStorageClient;
  private nameExtractor: NameExtractionService;
  private transcriptionService: OpenAITranscriptionService;
  private conversationManager?: ConversationManager;
  private sessionActive = false;
  private listeningIndicatorInterval?: NodeJS.Timeout;
  private currentSession?: AppSession;
  private indicatorRestartTimeout?: NodeJS.Timeout;

  constructor() {
    super({
      packageName: PACKAGE_NAME,
      apiKey: MENTRAOS_API_KEY,
      port: PORT,
    });

    // Initialize services
    this.memoryClient = new SupabaseStorageClient();
    this.nameExtractor = new NameExtractionService(OPENAI_API_KEY, OPENAI_MODEL);
    this.transcriptionService = new OpenAITranscriptionService(OPENAI_API_KEY);

    console.log('\n╔═════════════════════════════════════════╗');
    console.log('║        Nametag v2.0 - G1 Glasses        ║');
    console.log('╚═════════════════════════════════════════╝\n');
    console.log('Services ready:');
    console.log('- Supabase Storage Client (PostgreSQL)');
    console.log(`- Name Extraction (OpenAI ${OPENAI_MODEL})`);
    console.log('- Voice Recognition (OpenAI gpt-4o-transcribe-diarize)');
  }

  protected async onSession(session: AppSession, sessionId: string, userId: string): Promise<void> {
    console.log(`\n=== New Session Started ===`);
    console.log(`Session ID: ${sessionId}`);
    console.log(`User ID: ${userId}`);

    this.sessionActive = true;
    this.currentSession = session;

    // Create conversation manager for this session
    this.conversationManager = new ConversationManager(
      this.memoryClient,
      this.nameExtractor,
      this.transcriptionService  // Pass transcription service for voice clip extraction
    );

    // Show welcome message
    session.layouts.showTextWall(
      "Nametag Ready!\n\nListening...",
      {
        view: ViewType.MAIN,
        durationMs: 3000
      }
    );

    // Start listening indicator (battery-efficient, 2-second interval)
    this.startListeningIndicator(session);

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
          
          // Pause listening indicator while showing person info
          this.stopListeningIndicator();
          
          // Cancel any pending indicator restart
          if (this.indicatorRestartTimeout) {
            clearTimeout(this.indicatorRestartTimeout);
            this.indicatorRestartTimeout = undefined;
          }
          
          // G1 display constraints: ~250 chars, 6-8 lines, 25-30 chars/line
          const MAX_CHARS = 240;
          const MAX_POINT_LENGTH = 38; // Slightly over line width to allow wrapping
          
          let lines: string[] = [];
          
          // Line 1: Name + Time + Conversation Count (all on one line)
          let headerLine = person.name;
          
          let lastMetDate: Date | null = null;
          let conversationCount = 0;
          
          if (person.conversationHistory && person.conversationHistory.length > 0) {
            lastMetDate = person.conversationHistory[person.conversationHistory.length - 1].date;
            conversationCount = person.conversationHistory.length;
          } else if (person.lastMet) {
            lastMetDate = person.lastMet;
            conversationCount = 1;
          }
          
          if (lastMetDate) {
            const date = new Date(lastMetDate);
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - date.getTime());
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            let timeStr = '';
            if (diffDays === 0) timeStr = 'today';
            else if (diffDays === 1) timeStr = 'yesterday';
            else if (diffDays < 7) timeStr = `${diffDays}d ago`;
            else if (diffDays < 30) timeStr = `${Math.floor(diffDays / 7)}w ago`;
            else timeStr = `${Math.floor(diffDays / 30)}mo ago`;
            
            const countStr = conversationCount > 1 ? ` • ${conversationCount}x` : '';
            headerLine += ` • ${timeStr}${countStr}`;
          }
          
          lines.push(headerLine);
          
          // Lines 2+: Context from last conversation
          if (person.conversationHistory && person.conversationHistory.length > 0) {
            const lastConv = person.conversationHistory[person.conversationHistory.length - 1];
            
            // Prioritize key points for quick, actionable context
            if (lastConv.keyPoints && lastConv.keyPoints.length > 0) {
              // Take up to 3 key points that fit within char limit
              const points = lastConv.keyPoints
                .slice(0, 3)
                .map((point: string) => {
                  // Truncate long points to fit display
                  return point.length > MAX_POINT_LENGTH 
                    ? point.substring(0, MAX_POINT_LENGTH - 1) + '…'
                    : point;
                });
              
              lines.push(''); // Blank line
              points.forEach((point: string) => lines.push(`• ${point}`));
              
            } else if (lastConv.transcript && lastConv.transcript !== 'Error generating summary') {
              // Fallback to summary - truncate to fit
              lines.push('');
              const summary = lastConv.transcript.length > 120 
                ? lastConv.transcript.substring(0, 119) + '…'
                : lastConv.transcript;
              lines.push(summary);
              
            } else if (lastConv.topics && lastConv.topics.length > 0) {
              // Fallback to topics
              lines.push('');
              lastConv.topics.slice(0, 2).forEach((topic: string) => {
                const topicStr = topic.length > MAX_POINT_LENGTH 
                  ? topic.substring(0, MAX_POINT_LENGTH - 1) + '…'
                  : topic;
                lines.push(`• ${topicStr}`);
              });
            }
          } else if (person.lastConversation) {
            // Backward compatibility
            lines.push('');
            const summary = person.lastConversation.length > 120 
              ? person.lastConversation.substring(0, 119) + '…'
              : person.lastConversation;
            lines.push(summary);
          } else if (person.lastTopics && person.lastTopics.length > 0) {
            // Backward compatibility
            lines.push('');
            person.lastTopics.slice(0, 2).forEach((topic: string) => {
              const topicStr = topic.length > MAX_POINT_LENGTH 
                ? topic.substring(0, MAX_POINT_LENGTH - 1) + '…'
                  : topic;
              lines.push(`• ${topicStr}`);
            });
          } else {
            lines.push('');
            lines.push('First conversation!');
          }
          
          // Join lines and ensure within character limit
          let message = lines.join('\n');
          if (message.length > MAX_CHARS) {
            message = message.substring(0, MAX_CHARS - 1) + '…';
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

          // Resume listening indicator after showing person info
          this.indicatorRestartTimeout = setTimeout(() => {
            if (this.sessionActive && this.currentSession) {
              this.startListeningIndicator(this.currentSession);
            }
            this.indicatorRestartTimeout = undefined;
          }, 8500);
        }

        // Handle new person identified
        if (result.action === 'new_person_identified' && result.data) {
          const person = result.data.person;
          
          // Pause listening indicator
          this.stopListeningIndicator();
          
          // Cancel any pending indicator restart
          if (this.indicatorRestartTimeout) {
            clearTimeout(this.indicatorRestartTimeout);
            this.indicatorRestartTimeout = undefined;
          }
          
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

          // Resume listening indicator
          this.indicatorRestartTimeout = setTimeout(() => {
            if (this.sessionActive && this.currentSession) {
              this.startListeningIndicator(this.currentSession);
            }
            this.indicatorRestartTimeout = undefined;
          }, 3500);
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
      this.stopListeningIndicator();
      
      // Cancel any pending indicator restart
      if (this.indicatorRestartTimeout) {
        clearTimeout(this.indicatorRestartTimeout);
        this.indicatorRestartTimeout = undefined;
      }

      // Stop transcription service
      try {
        await this.transcriptionService.stop();
        console.log('✓ Transcription service stopped');
      } catch (error) {
        console.error('Error stopping transcription service:', error);
      }

      // Save conversation summary
      if (this.conversationManager) {
        try {
          const summaryResult = await this.conversationManager.endConversation();

          if (summaryResult.peopleUpdated.length > 0) {
            console.log(`\n✓ Conversation saved for: ${summaryResult.peopleUpdated.join(', ')}`);
            
            if (summaryResult.topics && summaryResult.topics.length > 0) {
              console.log(`  Topics discussed: ${summaryResult.topics.join(', ')}`);
            }
          }
        } catch (error) {
          console.error('Error saving conversation summary:', error);
        }
      }

      this.conversationManager = undefined;
      this.currentSession = undefined;
      console.log('✓ Session cleanup completed');
    });
  }

  /**
   * Start battery-efficient listening indicator
   * Updates every 2 seconds with a simple animation
   */
  private startListeningIndicator(session: AppSession): void {
    let frame = 0;
    let intervalMs = 1000;
    const frames = ['●○○','○●○','○○●']; // Simple ASCII animation
    
    this.listeningIndicatorInterval = setInterval(() => {
      if (!this.sessionActive || !this.currentSession) {
        this.stopListeningIndicator();
        return;
      }

      try {
        const indicator = frames[frame % frames.length];
        // Center the indicator on the display
        const text = `\n\n\n     ${indicator}`;
        
        session.layouts.showTextWall(
          text,
          {
            view: ViewType.MAIN,
            durationMs: intervalMs + 500 // Slightly longer than interval to prevent flicker
          }
        );

        frame++;
      } catch (error) {
        console.error('Error updating listening indicator:', error);
        this.stopListeningIndicator();
      }
    }, intervalMs); // Update every 2 seconds (battery-efficient)

    console.log('✓ Listening indicator started (2s refresh rate)');
  }

  /**
   * Stop the listening indicator
   */
  private stopListeningIndicator(): void {
    if (this.listeningIndicatorInterval) {
      clearInterval(this.listeningIndicatorInterval);
      this.listeningIndicatorInterval = undefined;
      console.log('✓ Listening indicator stopped');
    }
  }
}

// Create and start the app
(async () => {
  const app = new MemoryGlassesApp();
  await app.start();
  
  console.log(`\n✓ Server started on port ${PORT}`);
  console.log(`✓ Package: ${PACKAGE_NAME}\n`);
  console.log('Ready to accept connections from MentraOS!');
})();
