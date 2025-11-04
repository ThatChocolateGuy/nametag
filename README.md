# Nametag - Remember Everyone with G1 Smart Glasses

A MentraOS cloud app for Even Realities G1 smart glasses that automatically recognizes people by voice and displays contextual conversation history—all through audio-only interaction.

## Features

### Voice Biometric Recognition

- Real-time speaker identification using OpenAI's voice recognition
- Automatically detects and remembers people by their voice
- No manual tagging or camera required—audio only

### Conversation Intelligence

- Contextual key points from past conversations displayed instantly
- Multi-conversation history tracking with timestamps
- Automatic conversation summarization and topic extraction
- Smart speaker ID replacement (names, not "Speaker A/B")

### Smart Introductions

- Detects self-introductions ("I'm John", "My name is Sarah")
- Creates voice profiles automatically for future recognition
- Shows personalized greetings with last met time and conversation count

### Battery-Efficient UI

- Minimal listening indicator (2-second refresh rate)
- Optimized for G1 display constraints (240 chars, 6-8 lines)
- Smart pause/resume when showing person information

## Architecture

```md
G1 Glasses Audio → MentraOS → Cloud App (Railway)
                                    ↓
                        SupabaseStorageClient → Supabase PostgreSQL
                                    ↓                    ↑
                        OpenAI GPT-4o (Voice + AI)      |
                                                         |
                        Companion UI (Vercel) ───────────┘
```

**Key Flow:**

1. Audio streamed from G1 microphone
2. OpenAI transcribes + identifies speakers by voice
3. Names extracted from self-introductions
4. Conversation history retrieved from Supabase and displayed
5. Context saved with key points to Supabase for next meeting
6. Companion UI accesses same Supabase database for web interface

## Tech Stack

- **Runtime**: Bun (TypeScript)
- **Framework**: MentraOS SDK
- **AI Models**:
  - OpenAI `gpt-4o-mini` (name extraction, summarization)
  - OpenAI `gpt-4o-transcribe-diarize` (voice recognition)
- **Storage**: Supabase PostgreSQL
- **Deployment**:
  - Main app: Railway (with automatic deployments)
  - Companion UI: Vercel (with automatic deployments)

## Prerequisites

### Hardware

- Even Realities G1 smart glasses
- MentraOS mobile app

### Software & Services

- [Bun](https://bun.sh) (recommended) or Node.js 18+ (for local development)
- [Railway](https://railway.app) account (for main app hosting)
- [Vercel](https://vercel.com) account (for companion UI hosting)
- [Supabase](https://supabase.com) account (for database)

### API Keys

- **MentraOS API Key**: [console.mentra.glass](https://console.mentra.glass)
- **OpenAI API Key**: [platform.openai.com](https://platform.openai.com)
- **Supabase Connection String**: From your Supabase project settings

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/ThatChocolateGuy/nametag.git
cd nametag
bun install
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
PACKAGE_NAME=nem.codes.nametag
MENTRAOS_API_KEY=your_mentraos_api_key
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
DATABASE_URL=your_supabase_connection_string
PORT=3000
WEB_PORT=3001
COOKIE_SECRET=your_random_secret
```

### 3. Set up Supabase Database

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the SQL schema from `supabase/schema.sql` in the SQL editor
3. Get your connection details from Project Settings > Database
4. Add to your `.env` file

### 4. Deploy to Railway

1. Connect your GitHub repository to Railway
2. Add environment variables in Railway dashboard
3. Railway will auto-deploy from your `railway.json` configuration
4. Copy your Railway app URL (e.g., `https://your-app.railway.app`)

### 5. Deploy Companion UI to Vercel (Optional)

1. Connect your GitHub repository to Vercel
2. Set the root directory to `public/`
3. Add environment variables
4. Vercel will auto-deploy on every push

### 6. Register in MentraOS Console

1. Go to [console.mentra.glass](https://console.mentra.glass)
2. Create a new app with your package name
3. Set Public URL to your Railway app URL (no trailing slash)
4. Add **Microphone** permission
5. Save and install on your G1 glasses

### 7. Local Development (Optional)

```bash
# Start main app locally
bun run dev

# Start companion UI locally (in another terminal)
bun run dev:web
```

## Using Nametag

1. **Start the app** on your glasses
2. You'll see a **listening indicator**: `[=  ]` animating
3. **When someone speaks**:
   - If they introduce themselves → Name saved with voice profile
   - If voice recognized → Shows name + last met + conversation context
   - If unknown → Speaker tracked as "A", "B", etc. until introduction

4. **Key Points Display Example**:

   ```md
   John • 3d ago • 5x

   • Needs report by Friday
   • Budget approval pending
   • Team meeting scheduled
   ```

5. **End conversation** by closing the app
   - Summary automatically saved
   - Key points extracted for next meeting

## Using the Companion UI

Access your data through the web interface:

**Production (Vercel)**: Visit your deployed Vercel URL
**Local Development**:
```bash
# Start the companion UI
bun run dev:web

# Open in browser
http://localhost:3001
```

**Mobile Access**: Access the companion UI from your phone through the MentraOS app! See **[Mobile Access Guide](./docs/COMPANION_UI_MOBILE_ACCESS.md)** for setup.

Features:
- View all people and conversations
- Search and filter
- Add manual notes
- Export data
- Delete people
- Works on desktop and mobile (via MentraOS app)
- Syncs with same Supabase database as main app

See **[COMPANION_UI.md](./docs/COMPANION_UI.md)** for full guide.

## Documentation

All detailed documentation is in the `docs/` folder:

- **[COMPANION_UI.md](./docs/COMPANION_UI.md)** - Web interface guide
- **[COMPANION_UI_MOBILE_ACCESS.md](./docs/COMPANION_UI_MOBILE_ACCESS.md)** - Mobile access setup
- **[QUICKSTART.md](./docs/QUICKSTART.md)** - Step-by-step setup guide
- **[IMPLEMENTATION.md](./docs/IMPLEMENTATION.md)** - Technical architecture details
- **[TESTING_GUIDE.md](./docs/TESTING_GUIDE.md)** - How to test the app
- **[MODEL_SELECTION.md](./docs/MODEL_SELECTION.md)** - OpenAI model configuration
- **[STORAGE.md](./docs/STORAGE.md)** - Data storage structure (Supabase)
- **[TROUBLESHOOTING_NGROK.md](./docs/TROUBLESHOOTING_NGROK.md)** - Legacy: ngrok troubleshooting (for local dev)

## Development

### File Structure

```md
nametag/
├── src/
│   ├── index.ts                      # Main app server
│   ├── webserver.ts                  # Companion UI server
│   └── services/
│       ├── conversationManager.ts    # Conversation orchestration
│       ├── nameExtractionService.ts  # OpenAI name extraction
│       ├── openaiTranscriptionService.ts  # Voice recognition
│       └── supabaseStorageClient.ts  # Supabase PostgreSQL storage
├── supabase/
│   └── schema.sql                    # Database schema
├── public/                           # Companion UI frontend
├── railway.json                      # Railway deployment config
└── temp/                             # Temp audio files
```

### Key Design Patterns

**Supabase PostgreSQL Storage**: Uses Supabase for persistent data with structured tables for people, conversations, and voice references.

**Service Dependency Injection**: ConversationManager orchestrates all services (storage, AI, transcription) with clean interfaces.

**Voice Reference Storage**: 7-second audio clips stored as base64 in Supabase for future voice matching by OpenAI.

**Speaker Identity Protection**: Once a speaker is identified in a session, that mapping persists to prevent misidentification.

**Cloud-Native Architecture**: Main app on Railway, companion UI on Vercel, both accessing shared Supabase database.

### Build Commands

```bash
# Development with hot reload
bun run dev

# Build for production
bun run build

# Start production server
bun start
```

## Cost Estimate

### OpenAI API (with `gpt-4o-mini` default):

- **Name extraction**: ~$0.0001 per request
- **Conversation summary**: ~$0.001 per conversation
- **Voice transcription**: ~$0.002 per minute of audio

**Typical daily usage** (10 conversations, 5 min each):
- ~$0.05/day = **~$1.50/month**

### Hosting Services:

- **Supabase**: Free tier (500MB database, 2GB bandwidth)
- **Railway**: $5/month (500 hours execution time)
- **Vercel**: Free tier (100GB bandwidth, unlimited deployments)

**Total estimated monthly cost**: **~$6.50/month** (including hosting)

See [MODEL_SELECTION.md](./docs/MODEL_SELECTION.md) for cost/performance details.

## Contributing

This is a personal project, but feel free to:

- Report issues
- Suggest features
- Fork and experiment!

## License

MIT License - see [LICENSE](./LICENSE) file

## Acknowledgments

- **MentraOS Team** for the excellent SDK
- **OpenAI** for powerful voice recognition and language models
- **Even Realities** for the incredible G1 smart glasses
- **Supabase** for reliable PostgreSQL database hosting
- **Railway** for seamless deployment and hosting
- **Vercel** for fast and easy frontend deployment

## Support

- **Issues**: [GitHub Issues](https://github.com/ThatChocolateGuy/nametag/issues)
- **MentraOS**: [console.mentra.glass](https://console.mentra.glass)

---

### Built with ❤️ for the G1 community
