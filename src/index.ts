import 'dotenv/config';

// Only bypass SSL certificate validation in LOCAL development
// (for corporate networks, VPNs, antivirus proxies)
// NEVER in production environments (Railway, Vercel)
if (process.env.NODE_ENV !== 'production' &&
    !process.env.RAILWAY_ENVIRONMENT &&
    process.env.VERCEL !== '1') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.log('⚠️  SSL certificate validation disabled (local development only)');
}
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
  private currentUserId?: string;  // MentraOS user ID for current session
  private sessionActive = false;
  private listeningIndicatorInterval?: NodeJS.Timeout;
  private scrollingTextInterval?: NodeJS.Timeout;
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
    this.currentUserId = userId;  // Store userId for this session

    // Create conversation manager for this session (with userId for data isolation)
    this.conversationManager = new ConversationManager(
      this.memoryClient,
      this.nameExtractor,
      this.transcriptionService,  // Pass transcription service for voice clip extraction
      userId  // Pass userId for user-scoped data access
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

    // Get all known people for voice recognition (filtered by userId)
    const knownPeople = await this.memoryClient.getAllPeople(userId);
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
          
          // Build display text with full content (no truncation)
          // The scrolling function will handle long lines automatically
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

          let displayDuration: number;

          // NEW PRIORITY: Check for conversation prompt first
          if (this.shouldShowPrompt(person)) {
            lines.push(''); // Blank line
            lines.push(person.conversationPrompt!);

            // Use VERTICAL scrolling for prompts
            const message = lines.join('\n');
            displayDuration = this.startVerticalScrollingText(session, message, 8000);

            // Update prompt tracking
            person.promptShownCount = (person.promptShownCount || 0) + 1;
            person.lastPromptShown = new Date();
            await this.memoryClient!.storePerson(person);

            console.log(`\n💬 Showing conversation prompt for ${person.name}`);
            console.log(`  Prompt: "${person.conversationPrompt}"`);
            console.log(`  Times shown: ${person.promptShownCount}`);
          }
          // FALLBACK: No prompt or prompt shown recently - show key points/summary
          else {
            // Lines 2+: Context from last conversation (no truncation - scrolling will handle it)
            if (person.conversationHistory && person.conversationHistory.length > 0) {
              const lastConv = person.conversationHistory[person.conversationHistory.length - 1];

              // Prioritize key points for quick, actionable context
              if (lastConv.keyPoints && lastConv.keyPoints.length > 0) {
                // Take up to 3 key points (full text, no truncation)
                const points = lastConv.keyPoints.slice(0, 3);

                lines.push(''); // Blank line
                points.forEach((point: string) => lines.push(`• ${point}`));

              } else if (lastConv.transcript && lastConv.transcript !== 'Error generating summary') {
                // Fallback to summary (full text)
                lines.push('');
                lines.push(lastConv.transcript);

              } else if (lastConv.topics && lastConv.topics.length > 0) {
                // Fallback to topics (full text)
                lines.push('');
                lastConv.topics.slice(0, 2).forEach((topic: string) => {
                  lines.push(`• ${topic}`);
                });
              }
            } else if (person.lastConversation) {
              // Backward compatibility (full text)
              lines.push('');
              lines.push(person.lastConversation);
            } else if (person.lastTopics && person.lastTopics.length > 0) {
              // Backward compatibility (full text)
              lines.push('');
              person.lastTopics.slice(0, 2).forEach((topic: string) => {
                lines.push(`• ${topic}`);
              });
            } else {
              lines.push('');
              lines.push('First conversation!');
            }

            // Use horizontal scrolling for key points/summaries
            const message = lines.join('\n');
            displayDuration = this.startScrollingText(session, message, 8000);
          }

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

          // Resume listening indicator after showing person info (add 500ms buffer)
          this.indicatorRestartTimeout = setTimeout(() => {
            if (this.sessionActive && this.currentSession) {
              this.startListeningIndicator(this.currentSession);
            }
            this.indicatorRestartTimeout = undefined;
          }, displayDuration + 500);
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
          
          const message = `Remembered:\n${person.name}`;

          // Use scrolling for long names
          const displayDuration = this.startScrollingText(session, message, 3000);

          console.log(`\n✓ New person identified: ${person.name}`);

          // Update transcription service with new person's voice profile
          if (person.voiceReference && this.currentUserId) {
            const updatedPeople = await this.memoryClient.getAllPeople(this.currentUserId);
            this.transcriptionService.updateKnownPeople(updatedPeople);
          }

          // Resume listening indicator (add 500ms buffer)
          this.indicatorRestartTimeout = setTimeout(() => {
            if (this.sessionActive && this.currentSession) {
              this.startListeningIndicator(this.currentSession);
            }
            this.indicatorRestartTimeout = undefined;
          }, displayDuration + 500);
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
      this.stopScrollingText();

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
      this.currentUserId = undefined;
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

  /**
   * Check if we should show the conversation prompt for this person
   * Returns true if prompt exists and hasn't been shown too recently
   */
  private shouldShowPrompt(person: any): boolean {
    console.log(`\n🔍 Checking if should show prompt for ${person.name}:`);
    console.log(`  Has prompt: ${!!person.conversationPrompt}`);
    console.log(`  Prompt: "${person.conversationPrompt?.substring(0, 50)}${person.conversationPrompt?.length > 50 ? '...' : ''}"`);
    console.log(`  Last shown: ${person.lastPromptShown}`);
    console.log(`  Show count: ${person.promptShownCount || 0}`);

    // No prompt available
    if (!person.conversationPrompt) {
      console.log(`  ❌ No prompt available`);
      return false;
    }

    // Show prompt if never shown before
    if (!person.lastPromptShown) {
      console.log(`  ✅ Never shown before - will show`);
      return true;
    }

    // Convert to Date if it's a string
    const lastShownDate = person.lastPromptShown instanceof Date 
      ? person.lastPromptShown 
      : new Date(person.lastPromptShown);

    // Don't show if shown within last 24 hours
    const hoursSinceShown = (Date.now() - lastShownDate.getTime()) / (1000 * 60 * 60);
    console.log(`  Hours since shown: ${hoursSinceShown.toFixed(1)}`);
    
    if (hoursSinceShown < 24) {
      console.log(`  ❌ Shown recently (< 24h ago) - skipping`);
      return false;
    }

    // Don't spam - max 5 times per prompt
    const shownCount = person.promptShownCount || 0;
    if (shownCount >= 5) {
      console.log(`  ❌ Shown max times (${shownCount}/5) - skipping`);
      return false;
    }

    console.log(`  ✅ Will show prompt (${shownCount}/5 times, ${hoursSinceShown.toFixed(1)}h ago)`);
    return true;
  }

  /**
   * Wrap text to fit within line width (word-wrap algorithm)
   * Breaks lines at spaces when possible, hard-breaks if necessary
   * @param text Text to wrap
   * @param lineWidth Maximum characters per line (default: 28)
   * @returns Array of wrapped lines
   */
  private wrapText(text: string, lineWidth: number = 28): string[] {
    const lines: string[] = [];

    // Split by existing newlines first
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
      if (paragraph.length === 0) {
        lines.push('');
        continue;
      }

      if (paragraph.length <= lineWidth) {
        lines.push(paragraph);
        continue;
      }

      // Need to wrap this paragraph
      let remaining = paragraph;

      while (remaining.length > lineWidth) {
        // Try to break at a space
        let breakIndex = lineWidth;

        // Look backward for a space
        for (let i = lineWidth; i > lineWidth * 0.7; i--) {
          if (remaining[i] === ' ') {
            breakIndex = i;
            break;
          }
        }

        // Extract the line
        const line = remaining.substring(0, breakIndex).trim();
        lines.push(line);

        // Continue with the rest
        remaining = remaining.substring(breakIndex).trim();
      }

      // Add the final piece
      if (remaining.length > 0) {
        lines.push(remaining);
      }
    }

    return lines;
  }

  /**
   * Start horizontal scrolling text display
   * Scrolls long lines that would otherwise be truncated
   * Duration is automatically calculated based on text length
   * @returns The actual duration in milliseconds that the text will display
   */
  private startScrollingText(
    session: AppSession,
    fullText: string,
    minDurationMs: number = 5000,
    lineWidth: number = 28
  ): number {
    // Stop any existing scrolling
    this.stopScrollingText();

    // Split text into lines
    const lines = fullText.split('\n');

    // Check if any lines need scrolling
    const needsScrolling = lines.some(line => line.length > lineWidth);

    if (!needsScrolling) {
      // No scrolling needed, just show the text normally
      session.layouts.showTextWall(fullText, {
        view: ViewType.MAIN,
        durationMs: minDurationMs
      });
      return minDurationMs;
    }

    const pauseAtStart = 6; // Pause 3 seconds at start (500ms * 6 frames)
    const pauseAtEnd = 4; // Pause 2 seconds at end (500ms * 4 frames)
    const scrollSpeed = 500; // Update every 500ms (smooth and battery-friendly)

    // Calculate max scroll position (longest line determines scroll range)
    const maxScrollPosition = Math.max(...lines.map(line =>
      Math.max(0, line.length - lineWidth)
    ));

    // Calculate required duration: pause + scroll + pause
    // Each frame is scrollSpeed ms
    const calculatedDuration = (pauseAtStart + maxScrollPosition + pauseAtEnd) * scrollSpeed;

    // Use the calculated duration, but enforce a reasonable maximum (20 seconds)
    const durationMs = Math.min(calculatedDuration, 20000);

    console.log(`✓ Starting horizontal scroll (${(durationMs / 1000).toFixed(1)}s for ${maxScrollPosition} chars)`);

    let scrollPosition = 0;
    let pauseFrames = 0;

    const scrollInterval = setInterval(() => {
      if (!this.sessionActive || !this.currentSession) {
        this.stopScrollingText();
        return;
      }

      try {
        // Build the visible text window for each line
        const visibleLines = lines.map(line => {
          if (line.length <= lineWidth) {
            // Line fits, no scrolling needed
            return line;
          }

          // Calculate how much this line can scroll
          const lineMaxScroll = line.length - lineWidth;

          // Use proportional scrolling so all lines stay synchronized
          const lineScroll = Math.min(
            Math.floor((scrollPosition / maxScrollPosition) * lineMaxScroll),
            lineMaxScroll
          );

          // Extract the visible window
          return line.substring(lineScroll, lineScroll + lineWidth);
        });

        session.layouts.showTextWall(
          visibleLines.join('\n'),
          {
            view: ViewType.MAIN,
            durationMs: scrollSpeed + 200 // Slightly longer than interval to prevent flicker
          }
        );

        // Handle pausing at start
        if (scrollPosition === 0 && pauseFrames < pauseAtStart) {
          pauseFrames++;
          return;
        }

        // Handle pausing at end
        if (scrollPosition >= maxScrollPosition && pauseFrames < pauseAtStart + pauseAtEnd) {
          pauseFrames++;
          return;
        }

        // Advance scroll position
        scrollPosition++;

        // Loop back to start when reaching the end
        if (scrollPosition > maxScrollPosition + pauseAtEnd) {
          scrollPosition = 0;
          pauseFrames = 0;
        }

      } catch (error) {
        console.error('Error updating scrolling text:', error);
        this.stopScrollingText();
      }
    }, scrollSpeed);

    this.scrollingTextInterval = scrollInterval;

    // Auto-stop after duration
    setTimeout(() => {
      this.stopScrollingText();
    }, durationMs);

    return durationMs;
  }

  /**
   * Stop the scrolling text display
   */
  private stopScrollingText(): void {
    if (this.scrollingTextInterval) {
      clearInterval(this.scrollingTextInterval);
      this.scrollingTextInterval = undefined;
      console.log('✓ Scrolling text stopped');
    }
  }

  /**
   * Start vertical scrolling text display (for conversation prompts)
   * Wraps text to line width and scrolls vertically line-by-line
   * @param session The active app session
   * @param fullText Text to display (will be wrapped)
   * @param minDurationMs Minimum display duration in milliseconds
   * @param lineWidth Maximum characters per line (default: 28)
   * @param visibleLines Number of lines visible at once (default: 4)
   * @returns The actual duration in milliseconds that the text will display
   */
  private startVerticalScrollingText(
    session: AppSession,
    fullText: string,
    minDurationMs: number = 5000,
    lineWidth: number = 28,
    visibleLines: number = 4
  ): number {
    // Stop any existing scrolling
    this.stopScrollingText();

    // Wrap text to line width
    const wrappedLines = this.wrapText(fullText, lineWidth);

    // If text fits in visible area, show it statically
    if (wrappedLines.length <= visibleLines) {
      session.layouts.showTextWall(wrappedLines.join('\n'), {
        view: ViewType.MAIN,
        durationMs: minDurationMs
      });
      return minDurationMs;
    }

    // Configure scrolling parameters
    const pauseAtStart = 6; // 3 seconds (6 frames × 500ms)
    const pauseAtEnd = 4;   // 2 seconds (4 frames × 500ms)
    const scrollSpeed = 500; // 500ms per scroll step

    // Calculate total scroll steps (each line is one step)
    const scrollSteps = wrappedLines.length - visibleLines;

    // Calculate total duration: start pause + (steps × speed) + end pause
    const calculatedDuration = (pauseAtStart + scrollSteps + pauseAtEnd) * scrollSpeed;
    const durationMs = Math.min(calculatedDuration, 20000); // 20 second cap

    console.log(`✓ Starting vertical scroll (${(durationMs / 1000).toFixed(1)}s for ${scrollSteps} steps)`);

    let currentStep = 0;
    let pauseFrames = 0;

    const scrollInterval = setInterval(() => {
      if (!this.sessionActive || !this.currentSession) {
        this.stopScrollingText();
        return;
      }

      try {
        // Calculate visible window
        const startLine = Math.min(currentStep, scrollSteps);
        const endLine = startLine + visibleLines;
        const visibleText = wrappedLines.slice(startLine, endLine).join('\n');

        session.layouts.showTextWall(visibleText, {
          view: ViewType.MAIN,
          durationMs: scrollSpeed + 200 // Slightly longer to prevent flicker
        });

        // Handle pausing at start
        if (currentStep === 0 && pauseFrames < pauseAtStart) {
          pauseFrames++;
          return;
        }

        // Handle pausing at end
        if (currentStep >= scrollSteps && pauseFrames < pauseAtStart + pauseAtEnd) {
          pauseFrames++;
          return;
        }

        // Advance one line
        if (currentStep < scrollSteps) {
          currentStep++;
        } else {
          // Loop back to start
          currentStep = 0;
          pauseFrames = 0;
        }

      } catch (error) {
        console.error('Error updating vertical scrolling text:', error);
        this.stopScrollingText();
      }
    }, scrollSpeed);

    this.scrollingTextInterval = scrollInterval;

    // Auto-stop after duration
    setTimeout(() => {
      this.stopScrollingText();
    }, durationMs);

    return durationMs;
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
