# Accessing Companion UI from MentraOS Mobile App

This guide explains how to access the Nametag Companion UI from your phone through the MentraOS app.

## Overview

The Companion UI can be accessed in two ways:
1. **Locally**: On the same machine running the server (`http://localhost:3001`)
2. **Mobile**: Through the MentraOS app on your phone (configured via webview URL)

## Mobile Access Setup

### Step 1: Get a Second ngrok Static Domain

You'll need **two ngrok tunnels** running:
- **Port 3000**: Main G1 glasses app
- **Port 3001**: Companion UI web interface

1. Go to [ngrok dashboard](https://dashboard.ngrok.com/cloud-edge/domains)
2. Create a **second static domain** for the companion UI
   - Example: `nametag-ui-yourname.ngrok-free.app`
3. Keep your existing domain for the main app

> **Note**: ngrok free tier allows 1 static domain. You'll need to either:
> - Upgrade to a paid plan ($8/month) for multiple static domains
> - Use a dynamic ngrok URL (changes on each restart)
> - Deploy the companion UI to a cloud service (Vercel, Railway, etc.)

### Step 2: Configure Environment Variables

Add the companion UI URL to your `.env` file:

```env
# Main app
PORT=3000
PACKAGE_NAME=nem.codes.nametag
MENTRAOS_API_KEY=your_api_key

# Companion UI
WEB_PORT=3001
COOKIE_SECRET=your_secret_here

# OpenAI
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o-mini
```

### Step 3: Start Both Servers

Open **three terminal windows**:

**Terminal 1 - Main App**:
```bash
cd smartglasses-memory-app
bun run dev
```

**Terminal 2 - Companion UI**:
```bash
cd smartglasses-memory-app
bun run dev:web
```

**Terminal 3 - ngrok for Main App**:
```bash
ngrok http --url=nametag-yourname.ngrok-free.app 3000
```

**Terminal 4 - ngrok for Companion UI** (if you have a second static domain):
```bash
ngrok http --url=nametag-ui-yourname.ngrok-free.app 3001
```

> **Alternative**: If you don't have a second static domain, use dynamic ngrok:
> ```bash
> ngrok http 3001
> ```
> This will give you a temporary URL like `https://1234-abcd-5678.ngrok-free.app`

### Step 4: Configure WebView URL in MentraOS Console

1. Go to [console.mentra.glass](https://console.mentra.glass)
2. Select your Nametag app
3. Click **Edit App**
4. Find the **"Webview URL"** field
5. Enter your companion UI ngrok URL:
   - Example: `https://nametag-ui-yourname.ngrok-free.app`
   - Or your dynamic ngrok URL from Terminal 4
6. **Save** the app configuration

### Step 5: Access from MentraOS Mobile App

1. Open the **MentraOS app** on your phone
2. Navigate to your **Nametag app**
3. Look for a **"View Companion"** or webview button/option
4. Tap it to open the companion UI in a webview

> **Note**: The exact UI element to access the webview may vary depending on MentraOS version. Check for:
> - A settings/gear icon in the app
> - A "More" menu option
> - A dedicated companion UI button

## Authentication Flow

When accessing from mobile:

1. MentraOS app opens the webview URL
2. Your companion UI server receives the request
3. MentraOS auth middleware validates the session
4. User is automatically logged in (no manual login needed)
5. Companion UI loads with full access to person data

## Troubleshooting

### "Unable to connect" Error

**Problem**: Mobile app can't reach the companion UI

**Solutions**:
- Verify ngrok is running on port 3001
- Check that `bun run dev:web` is running
- Confirm webviewURL in console matches your ngrok URL exactly
- Test the URL directly in your phone's browser first

### "Authentication Failed" Error

**Problem**: MentraOS auth middleware rejects the request

**Solutions**:
- Verify `MENTRAOS_API_KEY` is set correctly in `.env`
- Ensure `PACKAGE_NAME` matches your console configuration
- Check `COOKIE_SECRET` is set (required for sessions)
- Restart the companion UI server after `.env` changes

### ngrok URL Changes

**Problem**: Dynamic ngrok URLs change on restart

**Solutions**:
- Option 1: Upgrade to ngrok paid plan for static domain ($8/month)
- Option 2: Update webviewURL in console each time ngrok restarts
- Option 3: Deploy companion UI to a cloud service (see below)

## Alternative: Cloud Deployment

For production use, consider deploying the companion UI separately:

### Option 1: Railway

1. Create a new Railway project
2. Deploy from GitHub repository
3. Set environment variables
4. Use the Railway URL as webviewURL

### Option 2: Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in project directory
3. Configure as Node.js project
4. Use Vercel URL as webviewURL

### Option 3: Render

1. Create new Web Service on Render
2. Connect GitHub repository
3. Build: `bun install && bun run build`
4. Start: `bun run web`
5. Use Render URL as webviewURL

### Separate Deployment Configuration

If deploying separately, you may want to split the companion UI into its own repository:

```bash
# Create new companion-ui directory
mkdir nametag-companion-ui
cd nametag-companion-ui

# Copy necessary files
cp ../smartglasses-memory-app/src/webserver.ts ./src/
cp ../smartglasses-memory-app/src/services/fileStorageClient.ts ./src/services/
cp -r ../smartglasses-memory-app/public ./

# Create package.json focused on web server only
# Deploy to cloud service
```

## Cost Considerations

### ngrok Pricing
- **Free tier**: 1 static domain, unlimited dynamic URLs
- **Personal ($8/month)**: 3 static domains, custom domains
- **Pro ($20/month)**: 10 static domains, more features

### Cloud Hosting (Companion UI only)
- **Railway**: Free tier available, ~$5/month for basic
- **Vercel**: Free for hobby projects
- **Render**: Free tier available (slower cold starts)

## Best Practices

1. **Use Static Domains**: Invest in ngrok paid plan or cloud hosting to avoid URL changes
2. **HTTPS Only**: MentraOS requires HTTPS for webviews (ngrok/cloud providers handle this)
3. **Session Management**: Companion UI sessions last 7 days (configured in webserver.ts:31)
4. **Data Sync**: Both main app and companion UI read from same `./data/memories.json`
5. **Monitoring**: Check both terminal windows for errors

## Summary

**Free Setup (Dynamic URLs)**:
- Two ngrok tunnels (free tier)
- Update webviewURL after each restart
- Good for development/testing

**Production Setup (Static URLs)**:
- ngrok paid plan ($8/month) OR
- Cloud deployment (free to $5/month)
- Set webviewURL once, never changes
- Reliable for daily use

Choose the option that fits your needs and budget!
