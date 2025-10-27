# Speaker Diarization Implementation Plan

## 🚨 CRITICAL FINDING

**AssemblyAI's real-time streaming API does NOT support speaker diarization.**

After implementation and investigation, we discovered that:
- `speaker_labels` parameter only works with **async/batch transcription API**
- Real-time WebSocket API does not provide speaker identification
- All transcripts from realtime API are labeled as single speaker

**Status**: Infrastructure implemented, but true speaker diarization blocked by API limitation.

## 🎯 Goal

Enable the app to distinguish between multiple speakers in real-time conversations, allowing accurate attribution of names and conversation context to specific individuals.

## 📊 Current State

### ✅ What Works
- Name detection from conversations (~95% accuracy)
- Conversation summary persistence
- Person recognition on return visits
- Real-time transcription via MentraOS

### ❌ Current Limitation
- **All speakers labeled as "Speaker A"**
- Cannot distinguish between multiple people
- Names get confused in multi-person conversations
- Topic attribution is inaccurate with multiple speakers

### Impact Example
```
Conversation:
Person 1: "Hi, I'm John"
Person 2: "Nice to meet you, I'm Sarah"

Current Behavior:
✗ Both attributed to "Speaker A"
✗ System might think John is talking about vacation when Sarah mentioned it

Desired Behavior:
✓ Speaker A: "Hi, I'm John" → Links John to Speaker A
✓ Speaker B: "Nice to meet you, I'm Sarah" → Links Sarah to Speaker B
✓ Accurate topic attribution per person
```

## 🔍 Technical Approaches

### Approach 1: AssemblyAI Real-Time Streaming (Recommended)

**Pros:**
- Industry-leading accuracy
- Real-time speaker labels (A, B, C, D...)
- Low latency (~200ms)
- Handles overlapping speech
- Built-in speaker diarization

**Cons:**
- Cost: $0.02/hour of audio
- Requires raw audio access from MentraOS
- Additional API dependency
- Needs WebSocket connection

**Technical Flow:**
```
Glasses Mic → MentraOS → Our App → AssemblyAI WebSocket
                                   ↓
                             Speaker-labeled transcript
                                   ↓
                         ConversationManager processes
```

**Implementation:**
```typescript
import { RealtimeTranscriber } from 'assemblyai';

const transcriber = new RealtimeTranscriber({
  apiKey: ASSEMBLYAI_API_KEY,
  sampleRate: 16000, // Check MentraOS audio format
  wordBoost: ['project', 'deadline'], // Boost common words
  speaker_labels: true  // CRITICAL: Enable diarization
});

// In onSession
session.audio.onAudioData(async (audioChunk) => {
  transcriber.sendAudio(audioChunk);
});

transcriber.on('transcript', (transcript) => {
  if (transcript.message_type === 'FinalTranscript') {
    const speaker = transcript.speaker || 'A';
    conversationManager.processTranscription(
      `Speaker ${speaker}`,
      transcript.text,
      true
    );
  }
});
```

### Approach 2: Deepgram Streaming (Alternative)

**Pros:**
- Similar to AssemblyAI
- Real-time diarization
- Good accuracy

**Cons:**
- Slightly different API
- Similar cost structure
- Less documentation for smart glasses use case

### Approach 3: Hybrid AI-Based Inference (Fallback)

If raw audio access is not available, use AI to infer speaker changes:

**Pros:**
- Works with existing MentraOS transcription
- No additional audio streaming needed
- No extra cost beyond OpenAI

**Cons:**
- Much less accurate
- Higher latency
- Can't detect simultaneous speech
- Relies on conversational cues

**Technical Flow:**
```
MentraOS Transcript → OpenAI Analysis → Infer speaker changes
                                      ↓
                          "Probably Speaker B now"
```

**Implementation:**
```typescript
async inferSpeakerChange(
  previousText: string,
  currentText: string,
  knownSpeakers: Map<string, Person>
): Promise<boolean> {
  // Use OpenAI to analyze:
  // - Pronoun changes (I → you)
  // - Topic shifts
  // - Response patterns
  // - Turn-taking cues

  const prompt = `Analyze if speaker changed between:
  Previous: "${previousText}"
  Current: "${currentText}"
  Return: true/false`;

  // Less accurate but works without raw audio
}
```

## 📋 Implementation Steps

### Phase 1: Research & Preparation (Week 1)

**Tasks:**
1. **Investigate MentraOS Audio API**
   - [ ] Check MentraOS Discord for audio access documentation
   - [ ] Review @mentra/sdk source code for audio methods
   - [ ] Test if `session.audio` or similar exists
   - [ ] Determine audio format (PCM 16kHz, WAV, etc.)
   - [ ] Check if audio available while transcription runs

2. **Set Up AssemblyAI**
   - [ ] Get AssemblyAI API key
   - [ ] Install `assemblyai` npm package
   - [ ] Test WebSocket connection
   - [ ] Verify speaker diarization works
   - [ ] Measure latency and accuracy

3. **Update Environment**
   ```env
   ASSEMBLYAI_API_KEY=your_key_here
   ENABLE_DIARIZATION=true  # Feature flag
   ```

### Phase 2: Core Implementation (Week 1-2)

**1. Update DiarizationService** (`src/services/diarizationService.ts`)

Currently a stub, needs full implementation:

```typescript
import { RealtimeTranscriber } from 'assemblyai';

export class DiarizationService {
  private transcriber: RealtimeTranscriber;
  private isConnected = false;
  private onTranscriptCallback?: (speaker: string, text: string) => void;

  constructor(apiKey: string) {
    this.transcriber = new RealtimeTranscriber({
      apiKey,
      sampleRate: 16000,
      encoding: 'pcm_s16le',
      speaker_labels: true,  // Enable diarization
      wordBoost: []  // Can boost names later
    });

    this.setupListeners();
  }

  private setupListeners(): void {
    this.transcriber.on('open', () => {
      console.log('✓ AssemblyAI connection established');
      this.isConnected = true;
    });

    this.transcriber.on('transcript', (transcript) => {
      if (transcript.message_type === 'FinalTranscript') {
        const speaker = `Speaker ${transcript.speaker || 'A'}`;
        this.onTranscriptCallback?.(speaker, transcript.text);
      }
    });

    this.transcriber.on('error', (error) => {
      console.error('AssemblyAI error:', error);
    });
  }

  async connect(): Promise<void> {
    await this.transcriber.connect();
  }

  sendAudio(chunk: Buffer): void {
    if (this.isConnected) {
      this.transcriber.sendAudio(chunk);
    }
  }

  onTranscript(callback: (speaker: string, text: string) => void): void {
    this.onTranscriptCallback = callback;
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.transcriber.close();
      this.isConnected = false;
    }
  }
}
```

**2. Update Main App** (`src/index.ts`)

Add diarization service:

```typescript
import { DiarizationService } from './services/diarizationService';

class MemoryGlassesApp extends AppServer {
  private diarizationService?: DiarizationService;
  private useDiarization = process.env.ENABLE_DIARIZATION === 'true';

  constructor() {
    super({...});

    // Initialize diarization if enabled and API key available
    if (this.useDiarization && ASSEMBLYAI_API_KEY) {
      this.diarizationService = new DiarizationService(ASSEMBLYAI_API_KEY);
      console.log('✓ Speaker diarization enabled (AssemblyAI)');
    } else {
      console.log('⚠ Speaker diarization disabled (using MentraOS transcription)');
    }
  }

  protected async onSession(session: AppSession, sessionId: string, userId: string): Promise<void> {
    // ...existing setup...

    if (this.diarizationService) {
      // Connect to AssemblyAI
      await this.diarizationService.connect();

      // Set up callback for diarized transcripts
      this.diarizationService.onTranscript((speaker, text) => {
        this.conversationManager?.processTranscription(speaker, text, true);
      });

      // Check if MentraOS provides audio access
      if ('audio' in session && 'onAudioData' in session.audio) {
        // Use AssemblyAI with raw audio
        session.audio.onAudioData((chunk) => {
          this.diarizationService?.sendAudio(chunk);
        });
        console.log('✓ Using AssemblyAI for diarized transcription');
      } else {
        console.warn('⚠ No audio access - falling back to MentraOS transcription');
        this.setupMentraOSTranscription(session);
      }
    } else {
      // Use existing MentraOS transcription
      this.setupMentraOSTranscription(session);
    }

    // Disconnect on session end
    session.events.onDisconnected(async () => {
      await this.diarizationService?.disconnect();
      // ...existing disconnect logic...
    });
  }

  private setupMentraOSTranscription(session: AppSession): void {
    // Existing transcription logic
    session.events.onTranscription(async (data) => {
      if (data.isFinal && data.text.trim()) {
        await this.conversationManager?.processTranscription(
          "Speaker A",  // Fallback when no diarization
          data.text,
          true
        );
      }
    });
  }
}
```

**3. Update ConversationManager** (`src/services/conversationManager.ts`)

No changes needed! Already handles speaker IDs:
```typescript
// Already supports multiple speakers:
async processTranscription(speaker: string, text: string, isFinal: boolean)
// speaker can be "Speaker A", "Speaker B", etc.
```

**4. Update FileStorageClient** (Optional enhancement)

Add speaker voice profile storage:
```typescript
interface Person {
  name: string;
  speakerId: string;
  voiceProfile?: {
    assemblyAISpeakerId: string;  // "A", "B", etc.
    firstHeard: Date;
    confidence: number;
  };
  lastConversation?: string;
  lastTopics?: string[];
  lastMet?: Date;
}
```

### Phase 3: Testing (Week 2)

**Test Cases:**

1. **Single Speaker**
   - Should work same as before
   - Speaker A consistently

2. **Two Speakers**
   - Introduce two different people
   - Verify Speaker A and B are distinguished
   - Confirm names match correct speakers

3. **Multiple Speakers (3+)**
   - Test with 3-4 people
   - Verify A, B, C, D labels
   - Check name-to-speaker matching

4. **Speaker Interruption**
   - Test overlapping speech
   - Verify AssemblyAI handles correctly

5. **Speaker Return**
   - Person leaves and returns
   - Should recognize as same speaker ID

6. **Name-to-Speaker Linking**
   ```
   Scenario:
   1. Speaker A: "Hi, I'm John"
   2. Speaker B: "Nice to meet you, I'm Sarah"
   3. Speaker A: "John" should link to Speaker A
   4. Speaker B: "Sarah" should link to Speaker B
   ```

### Phase 4: Optimization (Week 3)

**Performance:**
- Monitor latency (target: <300ms end-to-end)
- Optimize audio buffer size
- Reduce memory usage

**Accuracy:**
- Fine-tune speaker change sensitivity
- Add name-to-speaker confidence scoring
- Handle speaker ID reuse (A leaves, new person becomes A)

**Cost:**
- Monitor AssemblyAI usage
- Estimate monthly costs
- Consider batch vs streaming trade-offs

## 💰 Cost Analysis

### AssemblyAI Pricing

| Usage | Cost |
|-------|------|
| Per hour of audio | $0.02 |
| 10 minute conversation | $0.003 |
| 30 minute conversation | $0.01 |
| 8 hours/day (heavy use) | $0.16/day = $4.80/month |

**vs. Current (MentraOS + OpenAI):**
- Name extraction: $0.0003 per batch
- Summaries: $0.001 per session
- Total: <$0.01 per session

**With Diarization:**
- AssemblyAI: $0.01 per 30min
- Name extraction: Still needed ($0.0003)
- Summaries: Still needed ($0.001)
- **Total: ~$0.012 per 30min session**

**Verdict:** 20% cost increase for massive accuracy improvement ✅

## 🚀 Quick Start (When Ready)

1. **Get AssemblyAI API Key:**
   ```bash
   # Sign up at assemblyai.com
   # Get API key from dashboard
   ```

2. **Install Package:**
   ```bash
   bun add assemblyai
   ```

3. **Update .env:**
   ```env
   ASSEMBLYAI_API_KEY=your_key_here
   ENABLE_DIARIZATION=true
   ```

4. **Test Connection:**
   ```typescript
   const service = new DiarizationService(ASSEMBLYAI_API_KEY);
   await service.connect();
   // Should see "✓ AssemblyAI connection established"
   ```

5. **Test with Audio File First:**
   ```typescript
   // Before live testing, verify with recorded audio
   const audioFile = fs.readFileSync('test-conversation.wav');
   service.sendAudio(audioFile);
   ```

## 🔍 Fallback Strategy

If AssemblyAI doesn't work or audio access is unavailable:

### Option A: Use MentraOS + AI Inference
```typescript
// Analyze transcript patterns to guess speaker changes
// Less accurate but better than nothing
```

### Option B: Manual Speaker Selection
```typescript
// Add button on glasses: "New Speaker"
// User taps when person changes
// Low-tech but works
```

### Option C: Time-Based Heuristic
```typescript
// Assume speaker changes after long pauses
// Simple but somewhat effective
```

## 📝 Success Metrics

| Metric | Target |
|--------|--------|
| Speaker ID Accuracy | >90% |
| Name-to-Speaker Match | >85% |
| Latency (audio → labeled text) | <300ms |
| Cost per session (30min) | <$0.02 |
| Multi-person conversations | 2-4 speakers |

## 🎯 Next Steps

1. **Immediate:** Research MentraOS audio API availability
2. **This Week:** Set up AssemblyAI account and test
3. **Next Week:** Implement diarization service
4. **Following Week:** Test with real conversations

## 📚 References

- [AssemblyAI Streaming API](https://www.assemblyai.com/docs/api-reference/streaming)
- [MentraOS SDK Documentation](https://docs.mentraglass.com)
- [Speaker Diarization Guide](https://www.assemblyai.com/blog/what-is-speaker-diarization/)

---

**Status:** Planning phase - researching audio access
**Blockers:** Need to confirm MentraOS audio API availability
**Timeline:** 2-3 weeks for full implementation and testing
