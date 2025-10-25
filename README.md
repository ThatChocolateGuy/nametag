# Smart Glasses Memory Assistant

A proof-of-concept app for Even Realities G1 smart glasses that helps you remember people's names and conversation context using audio input only.

## Features

- **Real-time Name Recognition**: Automatically detects when people introduce themselves
- **Conversation Memory**: Stores conversation summaries and topics
- **Person Recognition**: Remembers people you've met before and shows their context
- **Audio-Only Interface**: Works entirely through voice with visual feedback on glasses

## Architecture

```
Smart Glasses → MentraOS → Cloud App → OpenAI GPT-4o-mini (Name Extraction)
                                     → Memory MCP (Storage)
                                     → AssemblyAI (Future: Speaker Diarization)
```

## Tech Stack

- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: MentraOS SDK
- **Name Extraction & Summarization**: OpenAI GPT-4o-mini
- **Memory Storage**: Memory MCP Server
- **Future Enhancement**: AssemblyAI for speaker diarization

## Prerequisites

1. **Hardware**:
   - Even Realities G1 smart glasses (or compatible MentraOS device)
   - MentraOS mobile app installed

2. **Software**:
   - Node.js 18 or higher
   - npm or bun
   - ngrok account (for local development)

3. **API Keys**:
   - MentraOS API key (from [console.mentra.glass](https://console.mentra.glass))
   - OpenAI API key (from [platform.openai.com](https://platform.openai.com))
   - AssemblyAI API key (from [assemblyai.com](https://assemblyai.com)) - Optional for POC
   - Memory MCP Server URL (provided)

## Setup Instructions

### 1. Install Dependencies

**With Bun (Recommended):**
```bash
cd smartglasses-memory-app
bun install
```

**Or with npm:**
```bash
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
PORT=3000
PACKAGE_NAME=com.yourname.memoryapp
MENTRAOS_API_KEY=your_mentraos_api_key_here
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
MEMORY_MCP_URL=https://memory.mcpgenerator.com/871b2b4d-418f-4c41-ad97-52d5b46c8772/sse
```

### 3. Set Up ngrok

1. Install ngrok:
   ```bash
   # Windows (with chocolatey)
   choco install ngrok

   # macOS
   brew install ngrok

   # Or download from https://ngrok.com/download
   ```

2. Create a free ngrok account at [ngrok.com](https://ngrok.com)

3. Get a static domain from [dashboard.ngrok.com](https://dashboard.ngrok.com)

### 4. Register App in MentraOS Console

1. Go to [console.mentra.glass](https://console.mentra.glass)
2. Click "Sign In" (use same account as MentraOS app)
3. Click "Create App"
4. Set package name (must match your .env file)
5. Enter your ngrok static URL as "Public URL"
6. **Important**: Add "microphone" permission in app settings

### 5. Run the App

**Terminal 1** - Start the app:

**With Bun (Recommended):**
```bash
bun run dev
```

**Or with npm:**
```bash
npm run dev
```

**Terminal 2** - Expose with ngrok:
```bash
ngrok http --url=<YOUR_NGROK_STATIC_URL> 3000
```

### 6. Connect Your Glasses

1. Open MentraOS app on your phone
2. Find your app in the app list
3. Launch it - the app will connect to your glasses
4. You should see "Memory Assistant Ready!" on the glasses

## How It Works

### Name Detection

When someone says:
- "I'm John"
- "My name is Sarah"
- "This is Alex"
- "Call me Mike"

The app will:
1. Extract the name using OpenAI GPT-4o-mini
2. Store it in memory with the MCP server
3. Show "Nice to meet you [Name]!" on glasses

### Person Recognition

When you meet someone again:
1. The app checks if the name exists in memory
2. Shows "Welcome back [Name]!"
3. Displays their last conversation summary
4. Shows topics you previously discussed

### Conversation Memory

At the end of each session:
1. Generates a summary of the conversation
2. Extracts key topics discussed
3. Updates each person's memory entry
4. Stores for future reference

## Project Structure

```
smartglasses-memory-app/
├── src/
│   ├── index.ts                    # Main application
│   └── services/
│       ├── memoryClient.ts         # Memory MCP integration
│       ├── nameExtractionService.ts # OpenAI GPT-4o-mini for names
│       ├── diarizationService.ts   # AssemblyAI (future use)
│       └── conversationManager.ts  # Orchestration logic
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## API Usage & Costs

### OpenAI (GPT-4o-mini)
- **Model**: GPT-4o-mini
- **Usage**: Name extraction + conversation summarization
- **Cost**: $0.150 per 1M input tokens, $0.600 per 1M output tokens
- **Per operation**: ~$0.0003 per name extraction, ~$0.001 per summary
- **Estimate**: < $0.20 for typical day of use (10x cheaper than Claude!)

### AssemblyAI (Optional)
- **Usage**: Speaker diarization (not used in POC)
- **Cost**: $0.02/hour of audio
- **Note**: POC uses MentraOS built-in transcription

### Memory MCP Server
- **Cost**: FREE (provided server)

## Current Limitations (POC)

1. **No True Speaker Diarization**: Uses MentraOS transcription without speaker separation
   - Everyone is labeled as "Speaker A"
   - Future: Integrate AssemblyAI for multi-speaker support

2. **Name Detection Timing**: Checks every 30 seconds
   - Batches transcripts for efficiency
   - May have slight delay in recognition

3. **Single Session Memory**: Best for one-on-one or small group conversations

## Future Enhancements

### Phase 2: True Speaker Diarization
- Capture raw audio from glasses microphone
- Stream to AssemblyAI for real-time speaker separation
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
