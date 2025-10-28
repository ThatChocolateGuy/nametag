# Copilot Instructions - Smart Glasses Memory Assistant

## Architecture Overview

This is a **MentraOS cloud app** for Even Realities G1 smart glasses that remembers names and conversations using audio-only input. The app follows a service-oriented architecture with clear separation of concerns.

### Core Data Flow
```
Glasses → MentraOS App → Cloud App (this) → OpenAI (name extraction) → Storage
```

**Key files**: `src/index.ts` (main app server), `src/services/conversationManager.ts` (orchestration), `src/services/nameExtractionService.ts` (OpenAI integration)

## Critical Architecture Patterns

### 1. Dual Storage Strategy
- **Primary**: `FileStorageClient` (`src/services/fileStorageClient.ts`) - Local JSON storage in `./data/memories.json`
- **Secondary**: `MemoryClient` (`src/services/memoryClient.ts`) - External MCP server (has SSE timeout issues)
- **Pattern**: Both implement identical interface for drop-in replacement

### 2. Service Dependency Injection
```typescript
// In index.ts constructor
this.memoryClient = new FileStorageClient('./data');  // Not MemoryClient!
this.nameExtractor = new NameExtractionService(OPENAI_API_KEY, OPENAI_MODEL);
this.conversationManager = new ConversationManager(this.memoryClient, this.nameExtractor);
```

### 3. Feature Flags & Environment Config
- `OPENAI_MODEL` swaps models (see `MODEL_SELECTION.md`)
- **SSL bypass**: `NODE_TLS_REJECT_UNAUTHORIZED='0'` for dev only

## Development Workflows

### Local Development
```bash
# Start with hot reload
bun run dev

# In separate terminal: expose via ngrok
ngrok http --domain=your-static-domain.ngrok-free.app 3000
```

### Testing Name Extraction
Use the conversation buffer pattern in `ConversationManager.processTranscription()`:
- Buffer accumulates 10-20 utterances before processing
- Names extracted every `nameCheckInterval` (10 utterances)
- Test with mock transcripts containing "I'm [Name]" patterns

### MentraOS Session Lifecycle
```typescript
// In onSession() - critical setup:
this.conversationManager = new ConversationManager(this.memoryClient, this.nameExtractor);
session.layouts.showTextWall("Memory Assistant Ready!", { view: ViewType.MAIN, durationMs: 3000 });
```

## Project-Specific Conventions

### 1. Environment Variable Validation
```typescript
// Required pattern - throw on missing critical vars
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? (() => { 
  throw new Error('OPENAI_API_KEY is not set in .env file'); 
})();
```

### 2. Storage Interface Pattern
Both storage clients must implement:
- `storePerson(person: Person): Promise<void>`
- `findPerson(name: string): Promise<Person | null>`
- `searchPeople(query: string): Promise<Person[]>`

**Important**: People are keyed by name (not speaker ID) to persist across sessions. Speaker IDs (A, B, C) are session-specific and may change between conversations.

### 3. Conversation History Tracking
- **ConversationEntry Interface**: Each conversation stored as `{ date: Date, transcript: string, topics: string[], keyPoints?: string[], duration?: number }`
- **Person.conversationHistory**: Required array of all past conversations
- **Migration**: Automatic conversion from old single-conversation format to history array
- **Display Logic**: Shows key points from last conversation (top 3), falls back to summary, then topics
- **Backward Compatibility**: Deprecated fields (`lastConversation`, `lastTopics`) maintained for compatibility

### 4. OpenAI Prompt Structure
See `nameExtractionService.ts` - prompts must:
- Return JSON arrays only, no markdown
- Include confidence levels: 'high' | 'medium' | 'low' 
- Handle graceful parsing with fallbacks
- **CRITICAL**: Only extract SELF-introductions (first-person "I'm X"), never third-person mentions ("I met John")

### 5. Voice Recognition & Transcription
- **OpenAI Transcription Service**: Uses `gpt-4o-transcribe-diarize` model for real-time transcription with speaker identification
- **Voice References**: 7-second audio clips (base64 encoded) stored in `Person.voiceReference` for future voice matching
- **Audio Clip Extraction**: When new people are identified, extract audio segment containing their introduction
- **Speaker Mapping**: OpenAI returns speaker IDs (A, B, C) - mapped to actual names via ConversationManager
- **No AssemblyAI**: Previous diarization service removed, OpenAI handles both transcription and speaker detection

### 6. Transcription Processing
```typescript
// Critical: Only process on isFinal=true
if (isFinal) {
  this.conversationBuffer.push({ text: `${speaker}: ${text}`, timestamp: Date.now() });
}
```

### 7. Speaker Identification System
- **Speaker IDs**: Internal identifiers are single letters (A, B, C) from OpenAI transcription
- **Display Names**: Use `conversationManager.getDisplayName(speakerId)` to get actual name or "Unknown Speaker"
- **Never expose raw IDs** in logs/UI - always use display names
- **Mapping**: `speakerNames` Map in ConversationManager tracks `speakerId → actual name`
- **Identity Protection**: Once a speaker is identified, that mapping persists for the session. New names for the same speaker are ignored to prevent misidentification.

## Key Integration Points

### MentraOS SDK Usage
- `AppServer` base class with `onSession()` override
- `session.layouts.showTextWall()` for glasses display
- `session.audio.onTranscription()` for speech input
- Always use `ViewType.MAIN` for primary display

### OpenAI Integration
- Model swapping via env var (see `MODEL_SELECTION.md`)
- Structured JSON responses required
- Temperature 0.3 for consistent name extraction
- **Transcription**: `gpt-4o-transcribe-diarize` model handles real-time speech-to-text with speaker diarization
- **Voice References**: 7-second audio clips stored as base64 for future voice matching (feature in development)

## Common Development Tasks

### Adding New Storage Fields
1. Update `Person` interface in both `memoryClient.ts` and `fileStorageClient.ts`
2. Add migration logic in `FileStorageClient.loadData()`
3. Update OpenAI prompts to extract new fields

### Modifying Conversation Processing
- Main logic in `ConversationManager.processTranscription()`
- Buffer management: `bufferMaxSize` and cleanup
- Trigger name extraction via `nameCheckInterval`

### Changing AI Models
Set `OPENAI_MODEL` in `.env` - no code changes needed. Refer to `MODEL_SELECTION.md` for cost/performance tradeoffs.

### Debugging Transcription Issues
- Check `this.sessionActive` state
- Verify `isFinal=true` for actual processing
- Use file storage for reliable debugging (avoid MCP SSE timeouts)
- **Speaker Diarization**: OpenAI transcription returns speaker IDs (A, B, C). Speaker IDs stored in `speakerAssignments`, mapped to names via `getDisplayName()`. Check console for "Unknown Speaker" vs actual names.

## File Organization Logic

- `src/index.ts`: MentraOS app server + session management
- `src/services/`: All business logic, each service has single responsibility
- `data/`: Local storage directory (auto-created)
- `temp/`: Temporary files for audio processing
- Root `.md` files: Comprehensive documentation for all aspects

When debugging, check `STATUS.md` and `TROUBLESHOOTING_NGROK.md` for known issues and solutions.