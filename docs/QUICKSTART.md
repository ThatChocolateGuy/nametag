# Quick Start Guide

Get your Nametag app running in 5 minutes!

## Prerequisites Checklist

- [ ] Even Realities G1 glasses (or MentraOS-compatible device)
- [ ] MentraOS mobile app installed
- [ ] Node.js 18+ or Bun installed
- [ ] Supabase account created
- [ ] Railway account created (for production deployment)
- [ ] ngrok account (optional, for local development only)

## Step 1: Get API Keys and Services (10 minutes)

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

### 3. Supabase Setup

1. Go to [supabase.com](https://supabase.com)
2. Create a new account or sign in
3. Click "New Project"
4. Choose organization and set project details
5. Wait for project to be provisioned (~2 minutes)
6. Go to Project Settings → API
7. Copy your project URL (e.g., `https://xxxxx.supabase.co`)
8. Copy your `anon` public key
9. Run the database migration (see Step 3 below)

## Step 2: Deploy to Railway (Production) or Setup Local Dev

### Option A: Production Deployment (Recommended)

1. **Create Railway Account**:
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Deploy from GitHub**:
   ```bash
   # Push your code to GitHub first
   git push origin main

   # Or use Railway CLI
   npm install -g @railway/cli
   railway login
   railway init
   railway up
   ```

3. **Configure Environment Variables**:
   - In Railway dashboard, go to your project
   - Add all environment variables from `.env.example`
   - **Critical**: Add `SUPABASE_URL` and `SUPABASE_KEY`

4. **Get Railway URL**:
   - Railway automatically assigns a URL
   - Copy it (e.g., `https://your-app.railway.app`)

5. **Update MentraOS Console**:
   - Go to [console.mentra.glass](https://console.mentra.glass)
   - Edit your app
   - Set "Public URL" to your Railway URL

### Option B: Local Development with ngrok

1. **Install ngrok** (for local testing only):
   ```bash
   # Windows: choco install ngrok
   # macOS: brew install ngrok
   # Or download from https://ngrok.com/download
   ```

2. **Get Static Domain** (optional):
   - Go to [dashboard.ngrok.com](https://dashboard.ngrok.com)
   - Create a free static domain

3. **Update MentraOS Console** (for local dev):
   - Set "Public URL" to your ngrok URL
   - This will change each time unless you use a static domain

## Step 3: Configure the App (3 minutes)

1. Navigate to project:

   ```bash
   cd smartglasses-memory-app
   ```

2. Install dependencies:

   ```bash
   # Using Bun (recommended)
   bun install

   # Or using npm
   npm install
   ```

3. Create `.env` file:

   ```bash
   cp .env.example .env
   ```

4. Edit `.env` with your keys:

   ```env
   # Server
   PORT=3000
   PACKAGE_NAME=com.yourname.memoryapp

   # MentraOS
   MENTRAOS_API_KEY=your_mentraos_api_key_here

   # OpenAI
   OPENAI_API_KEY=sk-your_openai_api_key_here
   OPENAI_MODEL=gpt-4o-mini

   # Supabase (REQUIRED)
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_KEY=your_anon_key_here

   # Companion UI (optional)
   WEB_PORT=3001
   COOKIE_SECRET=your-secret-key-here
   ```

   **Note**: `OPENAI_MODEL=gpt-4o-mini` is the recommended default. See `MODEL_SELECTION.md` for other options.

5. Run Supabase migrations:

   ```bash
   # Initialize Supabase CLI (first time only)
   npx supabase init

   # Link to your project
   npx supabase link --project-ref your-project-ref

   # Run migrations
   npx supabase db push
   ```

## Step 4: Run the App

### Production (Railway)

Your app is already running! Railway automatically:
- Builds and deploys on git push
- Assigns a public URL
- Manages environment variables
- Provides logs and monitoring

Check Railway dashboard to verify deployment status.

### Local Development

1. **Start the main app**:

   ```bash
   # Using Bun (faster)
   bun run dev

   # Or using npm
   npm run dev
   ```

   You should see:

   ```md
   ╔══════════════════════════════════════════╗
   ║   Nametag v2.0 - G1 Glasses              ║
   ╚══════════════════════════════════════════╝

   ✓ Server started on port 3000
   ✓ Connected to Supabase
   ✓ Package: com.yourname.memoryapp
   ```

2. **Start ngrok** (separate terminal, local dev only):

   ```bash
   ngrok http 3000
   # Or with static domain:
   ngrok http --url=your-domain.ngrok-free.app 3000
   ```

3. **Start companion UI** (optional, separate terminal):

   ```bash
   bun run dev:web
   # Access at http://localhost:3001
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

### "Connection refused" or "Cannot connect"

**Production (Railway)**:
- Check Railway dashboard for deployment status
- Verify environment variables are set
- Check Railway logs for errors
- Ensure Supabase connection is working

**Local Development**:
- Check app is running (`bun run dev`)
- Verify ngrok tunnel is active
- Ensure ngrok URL matches MentraOS console

### "Database connection failed"

- Verify `SUPABASE_URL` and `SUPABASE_KEY` in .env
- Check Supabase project is active (not paused)
- Run migrations: `npx supabase db push`
- Check network connectivity

### "API key invalid"

- Double-check .env file has correct keys
- Make sure no extra spaces in keys
- Verify keys are active in respective consoles
- For Railway: check environment variables in dashboard

### "No microphone permission"

- Go to MentraOS Console
- Edit your app
- Ensure "microphone" is checked
- Save and restart app

### "Names not detected"

- Wait at least 30 seconds after introduction
- Check logs for "Name detected:" messages
- Try more explicit: "My name is [Name]"
- Verify OpenAI API key is working
- Check Supabase connection is stable

## What's Happening Under the Hood?

1. **Audio Capture**: Glasses mic → MentraOS → Your app (Railway/local)
2. **Transcription**: OpenAI gpt-4o-transcribe-diarize provides real-time text with speaker detection
3. **Name Extraction**: OpenAI GPT-4o-mini analyzes text for introductions
4. **Storage**: Names + context saved to Supabase PostgreSQL database
5. **Recognition**: On next meeting, retrieves from database and displays info
6. **Sync**: Multi-device sync via cloud database

## Next Steps

Now that it's working:

1. **Customize the Experience**
   - Edit `src/index.ts` to change display messages
   - Adjust `PROCESS_INTERVAL` for faster/slower name checks
   - Modify GPT-4o-mini prompts in `nameExtractionService.ts`

2. **Deploy Companion UI**
   - Deploy to Vercel: `vercel`
   - Configure environment variables
   - Access from anywhere to manage contacts

3. **Enhance Memory**
   - Add more fields to Person interface
   - Implement advanced search by topic
   - Add relationship mapping
   - Create custom reminders

4. **Monitor and Scale**
   - Set up logging and monitoring
   - Configure alerts in Railway
   - Monitor Supabase usage and performance
   - Implement rate limiting if needed

## Cost Estimate

For typical daily use (10 conversations, 5 minutes each):

- **OpenAI API**:
  - Transcription (gpt-4o-transcribe-diarize): ~$0.10/day
  - Name extraction (GPT-4o-mini): ~$0.003/day
  - Summaries (GPT-4o-mini): ~$0.010/day
  - **Subtotal**: ~$0.12/day

- **Supabase**: Free tier includes:
  - 500MB database
  - 1GB file storage
  - 2GB bandwidth
  - Up to 50,000 monthly active users
  - **Cost**: $0 (Free tier sufficient for personal use)

- **Railway**: Free tier includes:
  - 512 MB RAM
  - Shared CPU
  - $5 credit monthly
  - **Cost**: ~$0-5/month (depends on usage)

- **Vercel** (Companion UI): Free tier
  - 100 GB bandwidth
  - Unlimited deployments
  - **Cost**: $0

- **Total**: ~$3.60-8.60/month for active daily use

## Getting Help

- **MentraOS Issues**: [Discord](https://discord.gg/mentra)
- **API Issues**: Check respective docs
- **Code Issues**: See main README.md

## Success! 🎉

You now have a working Nametag app! Every person you meet will be automatically remembered with conversation context.

Try it with friends and see how it helps you never forget a name again!
