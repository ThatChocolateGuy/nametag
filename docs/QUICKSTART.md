# Quick Start Guide

Get your Nametag app running in 5 minutes!

## Prerequisites Checklist

- [ ] Even Realities G1 glasses (or MentraOS-compatible device)
- [ ] MentraOS mobile app installed
- [ ] Node.js 18+ installed
- [ ] ngrok account created

## Step 1: Get API Keys (5 minutes)

### 1. MentraOS API Key

1. Go to [console.mentra.glass](https://console.mentra.glass)
2. Sign in with your MentraOS account
3. Click "Create App"
4. Set package name: `com.yourname.memoryapp`
5. Get your API key from the dashboard
6. **Important**: Add "microphone" permission!

### 2. OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Navigate to API Keys
4. Create a new key
5. Copy the key (starts with `sk-`)

### 3. AssemblyAI API Key (Optional for POC)

1. Go to [assemblyai.com](https://assemblyai.com)
2. Sign up for free account
3. Get API key from dashboard

## Step 2: Set Up ngrok (2 minutes)

1. Download ngrok:

   ```bash
   # Windows
   choco install ngrok

   # macOS
   brew install ngrok

   # Or download from https://ngrok.com/download
   ```

2. Sign up at [ngrok.com](https://ngrok.com)

3. Get a static domain:
   - Go to [dashboard.ngrok.com](https://dashboard.ngrok.com)
   - Navigate to "Domains" → "New Domain"
   - Copy your static domain (e.g., `your-app.ngrok-free.app`)

4. Update MentraOS Console:
   - Go back to [console.mentra.glass](https://console.mentra.glass)
   - Edit your app
   - Set "Public URL" to: `https://your-app.ngrok-free.app`

## Step 3: Configure the App (2 minutes)

1. Navigate to project:

   ```bash
   cd smartglasses-memory-app
   ```

2. Create `.env` file:

   ```bash
   cp .env.example .env
   ```

3. Edit `.env` with your keys:

   ```env
   PORT=3000
   PACKAGE_NAME=com.yourname.memoryapp
   MENTRAOS_API_KEY=your_mentraos_api_key_here
   ASSEMBLYAI_API_KEY=your_assemblyai_key_here
   OPENAI_API_KEY=sk-your_openai_api_key_here
   OPENAI_MODEL=gpt-4o-mini
   ```

   **Note**: `OPENAI_MODEL=gpt-4o-mini` is the recommended default. See `MODEL_SELECTION.md` for other options.

## Step 4: Run the App (1 minute)

1. **Terminal 1** - Start the app:

   ```bash
   npm run dev
   ```

   You should see:

   ```md
   ╔══════════════════════════════════════════╗
   ║   Nametag v2.0 - G1 Glasses              ║
   ╚══════════════════════════════════════════╝

   ✓ Server started on port 3000
   ✓ Package: com.yourname.memoryapp
   ```

2. **Terminal 2** - Start ngrok:

   ```bash
   ngrok http --url=your-app.ngrok-free.app 3000
   ```

   You should see:

   ```md
   Session Status    online
   Forwarding        https://your-app.ngrok-free.app -> http://localhost:3000
   ```

## Step 5: Connect Your Glasses (1 minute)

1. Open MentraOS app on your phone
2. Make sure your glasses are connected
3. Find your app in the app list
4. Tap to launch it
5. You should see "Nametag Ready!" on your glasses!

## Testing It Out

### Test 1: Introduction Detection

Say out loud:
> "Hi, my name is John Smith"

**Expected**: After ~30 seconds, you'll see "Nice to meet you John Smith!" on your glasses

### Test 2: Meeting Someone Again

Next session, say:
> "Hello, I'm John Smith"

**Expected**: "Welcome back John Smith!" with your last conversation summary

### Test 3: Conversation Memory

Have a conversation about something specific (e.g., "I'm planning a trip to Paris").

End the session (disconnect glasses), then reconnect.

Say your name again.

**Expected**: The app will show your name and mention "Last: discussed trip to Paris"

## Troubleshooting

### "Connection refused"

- Check both terminals are running
- Verify ngrok URL matches the console
- Restart ngrok

### "API key invalid"

- Double-check .env file has correct keys
- Make sure no extra spaces in keys
- Verify keys are active in respective consoles

### "No microphone permission"

- Go to MentraOS Console
- Edit your app
- Ensure "microphone" is checked
- Save and restart app

### "Names not detected"

- Wait at least 30 seconds after introduction
- Check Terminal 1 for "Name detected:" logs
- Try more explicit: "My name is [Name]"
- Verify OpenAI API key is working

## What's Happening Under the Hood?

1. **Audio Capture**: Glasses mic → MentraOS → Your app
2. **Transcription**: MentraOS provides real-time text
3. **Name Extraction**: OpenAI GPT-4o-mini analyzes text for introductions
4. **Storage**: Names + context saved to local JSON file
5. **Recognition**: On next meeting, retrieves and displays info

## Next Steps

Now that it's working:

1. **Customize the Experience**
   - Edit `src/index.ts` to change display messages
   - Adjust `PROCESS_INTERVAL` for faster/slower name checks
   - Modify GPT-4o-mini prompts in `nameExtractionService.ts`

2. **Add True Speaker Diarization**
   - Implement AssemblyAI integration in `diarizationService.ts`
   - Capture raw audio instead of using MentraOS transcription
   - Enable multi-speaker conversations

3. **Enhance Memory**
   - Add more fields to Person interface
   - Implement search by topic
   - Add relationship mapping

4. **Deploy for Real Use**
   - Get a permanent hosting solution (not ngrok)
   - Add authentication/security
   - Implement privacy controls
   - Add data encryption

## Cost Estimate

For typical daily use (10 conversations, 5 minutes each):

- **OpenAI API (GPT-4o-mini)**: ~$0.015/day
  - 10 name extractions × $0.0003 = $0.003
  - 10 summaries × $0.001 = $0.010
  - Misc queries = $0.002

- **AssemblyAI**: $0 (not used in POC)

- **Storage**: $0 (local file storage)

- **Total**: < $0.02/day (about $0.50/month for heavy use!)

## Getting Help

- **MentraOS Issues**: [Discord](https://discord.gg/mentra)
- **API Issues**: Check respective docs
- **Code Issues**: See main README.md

## Success! 🎉

You now have a working Nametag app! Every person you meet will be automatically remembered with conversation context.

Try it with friends and see how it helps you never forget a name again!
