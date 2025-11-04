# Copilot Instructions - Nametag

## Architecture Overview

This is a **MentraOS cloud app** for Even Realities G1 smart glasses that remembers names and conversations using audio-only input. The app follows a service-oriented architecture with clear separation of concerns and cloud-native deployment.

### Core Data Flow
```
Glasses → MentraOS App → Cloud App (Railway) → OpenAI (transcription + name extraction) → Supabase (storage)
                                              ↘ Companion UI (Vercel) → Supabase
```

**Key files**:
- `src/index.ts` (main app server)
- `src/webserver.ts` (companion UI server)
- `src/services/conversationManager.ts` (orchestration)
- `src/services/nameExtractionService.ts` (OpenAI integration)
- `src/services/supabaseStorageClient.ts` (database storage)
- `src/services/openaiTranscriptionService.ts` (voice recognition)

## Critical Architecture Patterns

### 1. Cloud Storage Strategy
- **Production**: `SupabaseStorageClient` (`src/services/supabaseStorageClient.ts`) - PostgreSQL database on Supabase
- **Features**: Multi-device sync, automatic backups, connection pooling, row-level security
- **Pattern**: Implements storage interface for potential drop-in replacement

### 2. Service Dependency Injection
```typescript
// In index.ts constructor
this.storageClient = new SupabaseStorageClient(SUPABASE_URL, SUPABASE_KEY);
this.nameExtractor = new NameExtractionService(OPENAI_API_KEY, OPENAI_MODEL);
this.transcriptionService = new OpenAITranscriptionService(OPENAI_API_KEY);
this.conversationManager = new ConversationManager(this.storageClient, this.nameExtractor);
```

### 3. Feature Flags & Environment Config
- `OPENAI_MODEL` swaps models (see `MODEL_SELECTION.md`)
- `SUPABASE_URL` and `SUPABASE_KEY` for database connection
- **SSL bypass**: `NODE_TLS_REJECT_UNAUTHORIZED='0'` for local dev only (not needed in Railway)

## Development Workflows

### Production Deployment (Railway)
```bash
# Deploy main app
railway up

# Configure environment variables in Railway dashboard
# Update MentraOS console with Railway URL
```

### Companion UI Deployment (Vercel)
```bash
# Deploy companion UI
vercel

# Configure environment variables in Vercel dashboard
```

### Local Development
```bash
# Start main app with hot reload
bun run dev

# Start companion UI (separate terminal)
bun run dev:web

# Optional: expose via ngrok for remote testing
ngrok http 3000
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
session.layouts.showTextWall("Nametag Ready!", { view: ViewType.MAIN, durationMs: 3000 });
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
SupabaseStorageClient implements:
- `storePerson(person: Person): Promise<void>` - Upsert to PostgreSQL
- `findPerson(name: string): Promise<Person | null>` - Case-insensitive query
- `searchPeople(query: string): Promise<Person[]>` - Full-text search
- `getAllPeople(): Promise<Person[]>` - Retrieve all with pagination support
- `deletePerson(name: string): Promise<void>` - Soft or hard delete

**Important**:
- People are keyed by name (not speaker ID) to persist across sessions
- Speaker IDs (A, B, C) are session-specific and may change between conversations
- Database uses JSONB for conversation history (flexible schema)
- Connection pooling enabled for optimal performance

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
1. Update `Person` interface in `supabaseStorageClient.ts`
2. Create Supabase migration: `npx supabase migration new add_field_name`
3. Update SQL schema in migration file
4. Run migration: `npx supabase db push`
5. Update OpenAI prompts to extract new fields

### Modifying Conversation Processing
- Main logic in `ConversationManager.processTranscription()`
- Buffer management: `bufferMaxSize` and cleanup
- Trigger name extraction via `nameCheckInterval`

### Changing AI Models
Set `OPENAI_MODEL` in `.env` - no code changes needed. Refer to `MODEL_SELECTION.md` for cost/performance tradeoffs.

### Debugging Transcription Issues
- Check `this.sessionActive` state
- Verify `isFinal=true` for actual processing
- Check Supabase connection and credentials
- Review Railway logs for production issues
- **Speaker Diarization**: OpenAI transcription returns speaker IDs (A, B, C). Speaker IDs stored in `speakerAssignments`, mapped to names via `getDisplayName()`. Check console for "Unknown Speaker" vs actual names.

### Deployment Debugging
- **Railway**: Check deployment logs in Railway dashboard
- **Vercel**: Check function logs in Vercel dashboard
- **Supabase**: Monitor database usage and logs in Supabase dashboard
- **Environment Variables**: Verify all variables are set in production

## File Organization Logic

- `src/index.ts`: MentraOS app server + session management
- `src/webserver.ts`: Companion UI Express server + REST API
- `src/services/`: All business logic, each service has single responsibility
  - `supabaseStorageClient.ts`: PostgreSQL database operations
  - `nameExtractionService.ts`: OpenAI GPT-4o-mini integration
  - `openaiTranscriptionService.ts`: Real-time voice transcription
  - `conversationManager.ts`: Business logic orchestration
- `public/`: Companion UI frontend (HTML/CSS/JS)
- `supabase/migrations/`: Database schema migrations
- `railway.json`: Railway deployment configuration
- Root `.md` files: Comprehensive documentation for all aspects

When debugging:
- Check `STATUS.md` for current project status
- Review Railway/Vercel deployment logs
- Verify Supabase connection and schema
- Test environment variables are set correctly