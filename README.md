# Nametag - Remember Everyone with G1 Smart Glasses# Nametag - Remember Names with G1 Smart Glasses



A MentraOS cloud app for Even Realities G1 smart glasses that automatically recognizes people by voice and displays contextual conversation history—all through audio-only interaction.A MentraOS cloud app for Even Realities G1 smart glasses that automatically remembers people's names and conversation context using voice-only interaction.



## ✨ Features## Features



### 🎤 Voice Biometric Recognition- **Real-time Name Recognition**: Automatically detects when people introduce themselves

- **Real-time speaker identification** using OpenAI's voice recognition- **Conversation Memory**: Stores conversation summaries and topics

- Automatically detects and remembers people by their voice- **Person Recognition**: Remembers people you've met before and shows their context

- No manual tagging or camera required—audio only- **Audio-Only Interface**: Works entirely through voice with visual feedback on glasses



### 💬 Conversation Intelligence## Architecture

- **Contextual key points** from past conversations displayed instantly

- Multi-conversation history tracking with timestamps```

- Automatic conversation summarization and topic extractionSmart Glasses → MentraOS → Cloud App → OpenAI GPT-4o-mini (Name Extraction)

- Smart speaker ID replacement (names, not "Speaker A/B")                                     → Memory MCP (Storage)

                                     → AssemblyAI (Future: Speaker Diarization)

### 👋 Smart Introductions```

- Detects self-introductions ("I'm John", "My name is Sarah")

- Creates voice profiles automatically for future recognition## Tech Stack

- Shows personalized greetings with last met time and conversation count

- **Runtime**: Node.js 18+ with TypeScript

### 🔋 Battery-Efficient UI- **Framework**: MentraOS SDK

- Minimal listening indicator (2-second refresh rate)- **Name Extraction & Summarization**: OpenAI GPT-4o-mini

- Optimized for G1 display constraints (240 chars, 6-8 lines)- **Memory Storage**: Memory MCP Server

- Smart pause/resume when showing person information- **Future Enhancement**: AssemblyAI for speaker diarization



## 🏗️ Architecture## Prerequisites



```1. **Hardware**:

G1 Glasses Audio → MentraOS → Cloud App (this) → OpenAI GPT-4o   - Even Realities G1 smart glasses (or compatible MentraOS device)

                                                → Local File Storage   - MentraOS mobile app installed

```

2. **Software**:

**Key Flow:**   - Node.js 18 or higher

1. Audio streamed from G1 microphone   - npm or bun

2. OpenAI transcribes + identifies speakers by voice   - ngrok account (for local development)

3. Names extracted from self-introductions

4. Conversation history retrieved and displayed3. **API Keys**:

5. Context saved with key points for next meeting   - MentraOS API key (from [console.mentra.glass](https://console.mentra.glass))

   - OpenAI API key (from [platform.openai.com](https://platform.openai.com))

## 🛠️ Tech Stack   - AssemblyAI API key (from [assemblyai.com](https://assemblyai.com)) - Optional for POC

   - Memory MCP Server URL (provided)

- **Runtime**: Bun (TypeScript)

- **Framework**: MentraOS SDK## Setup Instructions

- **AI Models**: 

  - OpenAI `gpt-4o-mini` (name extraction, summarization)### 1. Install Dependencies

  - OpenAI `gpt-4o-transcribe-diarize` (voice recognition)

- **Storage**: Local JSON file storage (`./data/memories.json`)**With Bun (Recommended):**

- **Development**: ngrok for local tunneling```bash

cd smartglasses-memory-app

## 📋 Prerequisitesbun install

```

### Hardware

- Even Realities G1 smart glasses**Or with npm:**

- MentraOS mobile app```bash

npm install

### Software```

- [Bun](https://bun.sh) (recommended) or Node.js 18+

- [ngrok](https://ngrok.com) account with static domain### 2. Configure Environment Variables



### API Keys```bash

- **MentraOS API Key**: [console.mentra.glass](https://console.mentra.glass)cp .env.example .env

- **OpenAI API Key**: [platform.openai.com](https://platform.openai.com)```



## 🚀 Quick StartEdit `.env` with your credentials:



### 1. Clone and Install```env

PORT=3000

```bashPACKAGE_NAME=com.yourname.memoryapp

git clone https://github.com/ThatChocolateGuy/nametag.gitMENTRAOS_API_KEY=your_mentraos_api_key_here

cd nametagASSEMBLYAI_API_KEY=your_assemblyai_api_key_here

bun installANTHROPIC_API_KEY=your_anthropic_api_key_here

```MEMORY_MCP_URL=https://memory.mcpgenerator.com/871b2b4d-418f-4c41-ad97-52d5b46c8772/sse

```

### 2. Configure Environment

### 3. Set Up ngrok

Copy `.env.example` to `.env`:

1. Install ngrok:

```bash   ```bash

PACKAGE_NAME=nem.codes.nametag   # Windows (with chocolatey)

MENTRAOS_API_KEY=your_mentraos_api_key   choco install ngrok

OPENAI_API_KEY=your_openai_api_key

OPENAI_MODEL=gpt-4o-mini   # macOS

PORT=3000   brew install ngrok

```

   # Or download from https://ngrok.com/download

### 3. Start the App   ```



```bash2. Create a free ngrok account at [ngrok.com](https://ngrok.com)

bun run dev

```3. Get a static domain from [dashboard.ngrok.com](https://dashboard.ngrok.com)



### 4. Expose with ngrok### 4. Register App in MentraOS Console



In a separate terminal:1. Go to [console.mentra.glass](https://console.mentra.glass)

2. Click "Sign In" (use same account as MentraOS app)

```bash3. Click "Create App"

ngrok http --domain=your-static-domain.ngrok-free.app 30004. Set package name (must match your .env file)

```5. Enter your ngrok static URL as "Public URL"

6. **Important**: Add "microphone" permission in app settings

### 5. Register in MentraOS Console

### 5. Run the App

1. Go to [console.mentra.glass](https://console.mentra.glass)

2. Create a new app with your package name**Terminal 1** - Start the app:

3. Set Public URL to your ngrok domain (no trailing slash!)

4. Add **Microphone** permission**With Bun (Recommended):**

5. Save and install on your G1 glasses```bash

bun run dev

## 📱 Using Nametag```



1. **Start the app** on your glasses**Or with npm:**

2. You'll see a **listening indicator**: `[=  ]` animating```bash

3. **When someone speaks**:npm run dev

   - If they introduce themselves → Name saved with voice profile```

   - If voice recognized → Shows name + last met + conversation context

   - If unknown → Speaker tracked as "A", "B", etc. until introduction**Terminal 2** - Expose with ngrok:

```bash

4. **Key Points Display**:ngrok http --url=<YOUR_NGROK_STATIC_URL> 3000

   ``````

   John • 3d ago • 5x

   ### 6. Connect Your Glasses

   • Needs report by Friday

   • Budget approval pending1. Open MentraOS app on your phone

   • Team meeting scheduled2. Find your app in the app list

   ```3. Launch it - the app will connect to your glasses

4. You should see "Nametag Ready!" on the glasses

5. **End conversation** by closing the app

   - Summary automatically saved## How It Works

   - Key points extracted for next meeting

### Name Detection

## 📖 Documentation

When someone says:

All detailed documentation is in the [`/docs`](./docs) folder:- "I'm John"

- "My name is Sarah"

- **[QUICKSTART.md](./docs/QUICKSTART.md)** - Step-by-step setup guide- "This is Alex"

- **[IMPLEMENTATION.md](./docs/IMPLEMENTATION.md)** - Technical architecture details- "Call me Mike"

- **[TESTING_GUIDE.md](./docs/TESTING_GUIDE.md)** - How to test the app

- **[MODEL_SELECTION.md](./docs/MODEL_SELECTION.md)** - OpenAI model configurationThe app will:

- **[STORAGE.md](./docs/STORAGE.md)** - Data storage structure1. Extract the name using OpenAI GPT-4o-mini

- **[TROUBLESHOOTING_NGROK.md](./docs/TROUBLESHOOTING_NGROK.md)** - Common ngrok issues2. Store it in memory with the MCP server

3. Show "Nice to meet you [Name]!" on glasses

## 🔧 Development

### Person Recognition

### File Structure

When you meet someone again:

```1. The app checks if the name exists in memory

nametag/2. Shows "Welcome back [Name]!"

├── src/3. Displays their last conversation summary

│   ├── index.ts                      # Main app server4. Shows topics you previously discussed

│   └── services/

│       ├── conversationManager.ts    # Conversation orchestration### Conversation Memory

│       ├── nameExtractionService.ts  # OpenAI name extraction

│       ├── openaiTranscriptionService.ts  # Voice recognitionAt the end of each session:

│       ├── fileStorageClient.ts      # Local storage1. Generates a summary of the conversation

│       └── memoryClient.ts           # Legacy MCP interface2. Extracts key topics discussed

├── data/3. Updates each person's memory entry

│   └── memories.json                 # Person database4. Stores for future reference

├── docs/                             # Documentation

└── temp/                             # Temp audio files## Project Structure

```

```

### Key Design Patternssmartglasses-memory-app/

├── src/

**Dual Storage Strategy**: Uses local file storage (primary) with MCP server interface (legacy) for easy swapping.│   ├── index.ts                    # Main application

│   └── services/

**Service Dependency Injection**: ConversationManager orchestrates all services (storage, AI, transcription) with clean interfaces.│       ├── memoryClient.ts         # Memory MCP integration

│       ├── nameExtractionService.ts # OpenAI GPT-4o-mini for names

**Voice Reference Storage**: 7-second audio clips stored as base64 for future voice matching by OpenAI.│       ├── diarizationService.ts   # AssemblyAI (future use)

│       └── conversationManager.ts  # Orchestration logic

**Speaker Identity Protection**: Once a speaker is identified in a session, that mapping persists to prevent misidentification.├── package.json

├── tsconfig.json

## 💰 Cost Estimate├── .env.example

└── README.md

With OpenAI `gpt-4o-mini` (default):```

- **Name extraction**: ~$0.0001 per request

- **Conversation summary**: ~$0.001 per conversation## API Usage & Costs

- **Voice transcription**: ~$0.002 per minute of audio

### OpenAI (GPT-4o-mini)

**Typical daily usage** (10 conversations, 5 min each):- **Model**: GPT-4o-mini

- ~$0.05/day = **~$1.50/month**- **Usage**: Name extraction + conversation summarization

- **Cost**: $0.150 per 1M input tokens, $0.600 per 1M output tokens

See [MODEL_SELECTION.md](./docs/MODEL_SELECTION.md) for cost/performance details.- **Per operation**: ~$0.0003 per name extraction, ~$0.001 per summary

- **Estimate**: < $0.20 for typical day of use (10x cheaper than Claude!)

## 🤝 Contributing

### AssemblyAI (Optional)

This is a personal project, but feel free to:- **Usage**: Speaker diarization (not used in POC)

- Report issues- **Cost**: $0.02/hour of audio

- Suggest features- **Note**: POC uses MentraOS built-in transcription

- Fork and experiment!

### Memory MCP Server

## 📄 License- **Cost**: FREE (provided server)



MIT License - see [LICENSE](./LICENSE) file## Current Limitations (POC)



## 🙏 Acknowledgments1. **No True Speaker Diarization**: Uses MentraOS transcription without speaker separation

   - Everyone is labeled as "Speaker A"

- **MentraOS Team** for the excellent SDK and G1 hardware   - Future: Integrate AssemblyAI for multi-speaker support

- **OpenAI** for powerful voice recognition and language models

- **Even Realities** for the incredible G1 smart glasses2. **Name Detection Timing**: Checks every 30 seconds

   - Batches transcripts for efficiency

## 📞 Support   - May have slight delay in recognition



- **Issues**: [GitHub Issues](https://github.com/ThatChocolateGuy/nametag/issues)3. **Single Session Memory**: Best for one-on-one or small group conversations

- **Docs**: Check the [`/docs`](./docs) folder

- **MentraOS**: [console.mentra.glass](https://console.mentra.glass)## Future Enhancements



---### Phase 2: True Speaker Diarization

- Capture raw audio from glasses microphone

**Built with ❤️ for the G1 community**- Stream to AssemblyAI for real-time speaker separation

- Match speakers to stored voice profiles
- Automatic person identification without names

### Phase 3: Enhanced Memory
- Voice biometrics for speaker identification
- Cross-session conversation threading
- Smart reminders ("Ask John about his vacation")
- Integration with calendar/contacts

### Phase 4: Advanced Features
- Multi-language support
- Emotional tone analysis
- Action items extraction
- Integration with note-taking apps

## Troubleshooting

### App won't connect to glasses

1. Check ngrok is running and URL matches console
2. Verify package name matches in .env and console
3. Check microphone permission is enabled
4. Restart MentraOS mobile app

### Names not being detected

1. Check OpenAI API key is valid
2. Look at console logs for errors
3. Try explicit introductions: "My name is..."
4. Wait 30 seconds for processing interval

### Memory not persisting

1. Verify Memory MCP URL is correct
2. Check network connectivity
3. Look for errors in console logs
4. Test MCP server with curl

### Build errors

```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install

# Rebuild TypeScript
npm run build
```

## Development

### Build for Production

```bash
npm run build
npm start
```

### Code Structure

- **index.ts**: Main MentraOS app server
- **memoryClient.ts**: MCP server interface
- **nameExtractionService.ts**: OpenAI GPT-4o-mini integration
- **conversationManager.ts**: Business logic orchestration
- **diarizationService.ts**: AssemblyAI integration (prepared for future)

### Adding New Features

1. Add service in `src/services/`
2. Import and initialize in `index.ts` constructor
3. Use in `onSession` method for session-specific logic
4. Update this README with new capabilities

## Contributing

This is a proof-of-concept. Key areas for contribution:
- AssemblyAI integration for true speaker diarization
- Voice profile matching
- Better memory search/retrieval
- UI improvements for glasses display
- Multi-language support

## License

MIT

## Credits

Built with:
- [MentraOS](https://mentra.glass) - Smart glasses platform
- [OpenAI](https://openai.com) - AI name extraction (GPT-4o-mini)
- [AssemblyAI](https://assemblyai.com) - Speech recognition
- Memory MCP Server - Data persistence

## Support

For issues or questions:
- MentraOS: [Discord](https://discord.gg/mentra)
- This project: Create an issue on GitHub

---

**Note**: This is a proof-of-concept for demonstration purposes. For production use, implement proper error handling, security measures, and privacy protections for personal data.
