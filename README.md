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

```
G1 Glasses Audio → MentraOS → Cloud App (this) → OpenAI GPT-4o
                                                → Local File Storage
```

**Key Flow:**
1. Audio streamed from G1 microphone
2. OpenAI transcribes + identifies speakers by voice
3. Names extracted from self-introductions
4. Conversation history retrieved and displayed
5. Context saved with key points for next meeting

## Tech Stack

- **Runtime**: Bun (TypeScript)
- **Framework**: MentraOS SDK
- **AI Models**:
  - OpenAI `gpt-4o-mini` (name extraction, summarization)
  - OpenAI `gpt-4o-transcribe-diarize` (voice recognition)
- **Storage**: Local JSON file storage (`./data/memories.json`)
- **Development**: ngrok for local tunneling

## Prerequisites

### Hardware
- Even Realities G1 smart glasses
- MentraOS mobile app

### Software
- [Bun](https://bun.sh) (recommended) or Node.js 18+
- [ngrok](https://ngrok.com) account with static domain

### API Keys
- **MentraOS API Key**: [console.mentra.glass](https://console.mentra.glass)
- **OpenAI API Key**: [platform.openai.com](https://platform.openai.com)

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
PORT=3000
```

### 3. Start the App

```bash
bun run dev
```

### 4. Expose with ngrok

In a separate terminal:

```bash
ngrok http --domain=your-static-domain.ngrok-free.app 3000
```

### 5. Register in MentraOS Console

1. Go to [console.mentra.glass](https://console.mentra.glass)
2. Create a new app with your package name
3. Set Public URL to your ngrok domain (no trailing slash)
4. Add **Microphone** permission
5. Save and install on your G1 glasses

## Using Nametag

1. **Start the app** on your glasses
2. You'll see a **listening indicator**: `[=  ]` animating
3. **When someone speaks**:
   - If they introduce themselves → Name saved with voice profile
   - If voice recognized → Shows name + last met + conversation context
   - If unknown → Speaker tracked as "A", "B", etc. until introduction

4. **Key Points Display Example**:
   ```
   John • 3d ago • 5x

   • Needs report by Friday
   • Budget approval pending
   • Team meeting scheduled
   ```

5. **End conversation** by closing the app
   - Summary automatically saved
   - Key points extracted for next meeting

## Documentation

All detailed documentation is in the root folder:

- **[QUICKSTART.md](./QUICKSTART.md)** - Step-by-step setup guide
- **[IMPLEMENTATION.md](./IMPLEMENTATION.md)** - Technical architecture details
- **[TESTING_GUIDE.md](./TESTING_GUIDE.md)** - How to test the app
- **[MODEL_SELECTION.md](./MODEL_SELECTION.md)** - OpenAI model configuration
- **[STORAGE.md](./STORAGE.md)** - Data storage structure
- **[TROUBLESHOOTING_NGROK.md](./TROUBLESHOOTING_NGROK.md)** - Common ngrok issues

## Development

### File Structure

```
nametag/
├── src/
│   ├── index.ts                      # Main app server
│   └── services/
│       ├── conversationManager.ts    # Conversation orchestration
│       ├── nameExtractionService.ts  # OpenAI name extraction
│       ├── openaiTranscriptionService.ts  # Voice recognition
│       ├── fileStorageClient.ts      # Local storage
│       └── memoryClient.ts           # Legacy MCP interface
├── data/
│   └── memories.json                 # Person database
└── temp/                             # Temp audio files
```

### Key Design Patterns

**Dual Storage Strategy**: Uses local file storage (primary) with MCP server interface (legacy) for easy swapping.

**Service Dependency Injection**: ConversationManager orchestrates all services (storage, AI, transcription) with clean interfaces.

**Voice Reference Storage**: 7-second audio clips stored as base64 for future voice matching by OpenAI.

**Speaker Identity Protection**: Once a speaker is identified in a session, that mapping persists to prevent misidentification.

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

With OpenAI `gpt-4o-mini` (default):
- **Name extraction**: ~$0.0001 per request
- **Conversation summary**: ~$0.001 per conversation
- **Voice transcription**: ~$0.002 per minute of audio

**Typical daily usage** (10 conversations, 5 min each):
- ~$0.05/day = **~$1.50/month**

See [MODEL_SELECTION.md](./MODEL_SELECTION.md) for cost/performance details.

## Contributing

This is a personal project, but feel free to:
- Report issues
- Suggest features
- Fork and experiment!

## License

MIT License - see [LICENSE](./LICENSE) file

## Acknowledgments

- **MentraOS Team** for the excellent SDK and G1 hardware
- **OpenAI** for powerful voice recognition and language models
- **Even Realities** for the incredible G1 smart glasses

## Support

- **Issues**: [GitHub Issues](https://github.com/ThatChocolateGuy/nametag/issues)
- **MentraOS**: [console.mentra.glass](https://console.mentra.glass)

---

**Built with ❤️ for the G1 community**
