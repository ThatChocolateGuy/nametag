# Deploying Companion UI to Vercel

This guide walks you through deploying the Nametag Companion UI to Vercel for permanent HTTPS access from the MentraOS mobile app.

## Prerequisites

- [x] Vercel account (free tier is fine)
- [x] Git repository pushed to GitHub
- [x] MentraOS API key and package name
- [x] Main app still runs locally (or deployed separately)

## Important: Data Storage Limitation

⚠️ **Vercel's serverless environment has read-only file systems**. The companion UI currently uses local file storage (`./data/memories.json`), which won't work on Vercel.

### Solutions:

**Option 1: Hybrid Deployment (Recommended for now)**
- Keep main app running locally (handles data storage)
- Deploy companion UI to Vercel (read-only access)
- Both access the same local data directory
- **Limitation**: Companion UI on Vercel won't show data unless main app is running locally

**Option 2: External Database (Future enhancement)**
- Migrate from FileStorageClient to a cloud database
- Options: MongoDB Atlas, Supabase, PlanetScale
- Both main app and companion UI access same database
- Works completely independently

**For this guide, we'll use Option 1**: Vercel companion UI + local main app.

## Step 1: Prepare Repository

All necessary files have been created:
- ✅ `vercel.json` - Vercel configuration
- ✅ `api/index.ts` - Serverless function entry point
- ✅ `.vercelignore` - Files to exclude from deployment
- ✅ `src/webserver.ts` - Updated to work on Vercel

Push changes to GitHub:

```bash
cd C:\Users\nemx1\smartglasses-memory-app

git add vercel.json api/ .vercelignore
git add src/webserver.ts package.json

git commit -m "Add Vercel deployment configuration for companion UI

- Add vercel.json for serverless configuration
- Create api/index.ts entry point for Vercel
- Update webserver.ts to skip listen() on Vercel
- Add .vercelignore to exclude unnecessary files

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin main
```

## Step 2: Deploy to Vercel

### Via Vercel Dashboard (Easiest)

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. **Import Git Repository**:
   - Select your `nametag` repository
   - Click **"Import"**
4. **Configure Project**:
   - **Framework Preset**: Other
   - **Root Directory**: `./` (leave default)
   - **Build Command**: Leave default (Vercel auto-detects)
   - **Output Directory**: Leave default
5. **Environment Variables** (click "Add"):
   ```
   MENTRAOS_API_KEY = your_actual_api_key
   PACKAGE_NAME = nem.codes.nametag
   COOKIE_SECRET = your_random_secret_string
   WEB_PORT = 3001
   NODE_ENV = production
   ```
6. Click **"Deploy"**
7. Wait for deployment (2-3 minutes)
8. **Copy your Vercel URL** (e.g., `https://nametag-yourname.vercel.app`)

### Via Vercel CLI (Alternative)

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (from project directory)
cd C:\Users\nemx1\smartglasses-memory-app
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name? nametag-companion
# - Directory? ./ (default)
# - Override settings? No

# Add environment variables
vercel env add MENTRAOS_API_KEY
vercel env add PACKAGE_NAME
vercel env add COOKIE_SECRET
vercel env add WEB_PORT
vercel env add NODE_ENV

# Deploy to production
vercel --prod
```

## Step 3: Configure MentraOS Console

1. Go to [console.mentra.glass](https://console.mentra.glass)
2. Select your **Nametag** app
3. Click **"Edit App"**
4. Find **"Webview URL"** field
5. Enter your Vercel URL:
   ```
   https://nametag-yourname.vercel.app
   ```
   (Replace with your actual Vercel URL from Step 2)
6. Click **"Save"**

## Step 4: Test the Deployment

### Test in Browser

1. Open your Vercel URL in a browser
2. You should see the Nametag Companion UI
3. Try authenticating (may need MentraOS session)

### Test on Mobile

1. Open **MentraOS app** on your phone
2. Navigate to **Nametag**
3. Look for **webview** or **companion UI** option
4. Tap to open
5. Should load the companion UI automatically

### Verify Data Access

**IMPORTANT**: For data to show up, the main Nametag app must be running locally:

```bash
# Terminal 1 - Main app (must be running)
cd C:\Users\nemx1\smartglasses-memory-app
bun run dev

# Terminal 2 - ngrok for main app
ngrok http --url=YOUR_MAIN_STATIC_URL.ngrok-free.app 3000
```

The companion UI on Vercel will access the local data directory through the FileStorageClient.

## Step 5: Update Documentation

Update your README to reflect Vercel deployment:

```bash
# In README.md, update companion UI section:
## Using the Companion UI

**Desktop**: http://localhost:3001
**Mobile**: https://nametag-yourname.vercel.app (via MentraOS app)
```

## Troubleshooting

### "Cannot find module" Errors

**Problem**: Vercel can't find TypeScript modules

**Solution**: Ensure `tsconfig.json` is configured correctly and pushed to git:
```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}
```

### "ERR_REQUIRE_ESM" Error (500 Status)

**Problem**: Vercel logs show:
```
Error [ERR_REQUIRE_ESM]: require() of ES Module chalk/source/index.js not supported
Error [ERR_REQUIRE_ESM]: require() of ES Module boxen/index.js not supported
Node.js process exited with exit status: 1
```

**Cause**: MentraOS SDK uses `require()` (CommonJS) with terminal styling libraries (`chalk`, `boxen`), but newer versions are ESM-only:
- chalk v5+ is ESM-only
- boxen v6+ is ESM-only

**Solution**: ✅ Already fixed in the repository!

The `package.json` pins CommonJS-compatible versions as direct dependencies:
```json
{
  "dependencies": {
    "chalk": "4.1.2",
    "boxen": "5.1.2",
    ...
  }
}
```

This forces the entire dependency tree (including MentraOS SDK) to use these versions.

If you still see this error:
1. Make sure you pulled the latest code: `git pull origin main`
2. Verify `package.json` has chalk and boxen as direct dependencies
3. Delete `node_modules` and `package-lock.json` locally
4. Run `npm install` to reinstall
5. Commit `package-lock.json` if it changed
6. Push to GitHub to trigger Vercel redeploy
7. In Vercel dashboard, check deployment logs to confirm versions

### "MENTRAOS_API_KEY is not set" Error

**Problem**: Environment variables not configured on Vercel

**Solution**:
1. Go to Vercel dashboard → Your project → Settings → Environment Variables
2. Add all required variables
3. Redeploy: `vercel --prod`

### "No people found" / Empty Data

**Problem**: Companion UI on Vercel can't access local data files

**Expected Behavior**: This is normal with current file-based storage

**Solutions**:
- **Short term**: Keep main app running locally for data access
- **Long term**: Migrate to cloud database (see below)

### "Authentication Failed"

**Problem**: MentraOS auth middleware rejects requests

**Solutions**:
1. Verify `MENTRAOS_API_KEY` is correct in Vercel environment variables
2. Check `PACKAGE_NAME` matches console.mentra.glass configuration
3. Ensure `COOKIE_SECRET` is set
4. Check Vercel logs: Dashboard → Your Project → Deployments → Latest → Logs

### 404 or Static File Issues

**Problem**: Public assets not loading

**Solution**: Ensure `public/` directory is in git and not in `.vercelignore`:
```bash
git add public/
git commit -m "Add public assets"
git push
```

## Vercel Logs

View real-time logs:

**Dashboard**:
1. Go to Vercel dashboard
2. Select your project
3. Click "Deployments"
4. Click latest deployment
5. Click "Logs" tab

**CLI**:
```bash
vercel logs nametag-companion
```

## Cost & Limits

**Vercel Free Tier**:
- ✅ 100 GB bandwidth/month
- ✅ Unlimited API requests
- ✅ Automatic HTTPS
- ✅ Custom domains (optional)
- ⚠️ 10 second execution timeout (serverless functions)

**Hobby Plan (Free)** is sufficient for personal use.

**Pro Plan ($20/month)** if you need:
- Longer execution timeouts
- More bandwidth
- Team collaboration

## Future Enhancement: Database Migration

To make the companion UI fully independent on Vercel, migrate storage:

### Option A: MongoDB Atlas (Recommended)

```bash
# Install MongoDB driver
npm install mongodb

# Update fileStorageClient.ts to use MongoDB
# Store data in cloud instead of local JSON
```

### Option B: Supabase (PostgreSQL)

```bash
# Install Supabase client
npm install @supabase/supabase-js

# Create Supabase project (free tier)
# Migrate data to PostgreSQL
```

### Option C: Vercel KV (Redis)

```bash
# Install Vercel KV
npm install @vercel/kv

# Use Redis for fast storage
# Integrated with Vercel
```

See [docs/STORAGE_MIGRATION.md](./docs/STORAGE_MIGRATION.md) (future) for migration guides.

## Custom Domain (Optional)

Add a custom domain to your Vercel deployment:

1. Go to Vercel dashboard → Your project → Settings → Domains
2. Click "Add"
3. Enter your domain (e.g., `nametag.yourdomain.com`)
4. Follow DNS configuration instructions
5. Update webviewURL in MentraOS console to custom domain

## Deployment Workflow

### Update Deployment

When you make changes:

```bash
# 1. Make changes locally
# 2. Test locally
bun run dev:web

# 3. Commit and push
git add .
git commit -m "Update companion UI feature"
git push origin main

# 4. Vercel auto-deploys (if connected to git)
# OR manually deploy:
vercel --prod
```

### Rollback Deployment

If something breaks:

**Dashboard**:
1. Go to Deployments
2. Find previous working deployment
3. Click three dots → "Promote to Production"

**CLI**:
```bash
vercel rollback
```

## Summary

✅ **What Works on Vercel**:
- Companion UI interface
- MentraOS authentication
- All API endpoints
- Permanent HTTPS URL
- Mobile access via MentraOS app

⚠️ **Current Limitation**:
- Data storage requires local main app running
- FileStorageClient needs filesystem access

🚀 **Next Steps**:
- Deploy and test
- Consider database migration for full independence
- Set up custom domain (optional)

## Quick Reference

**Vercel URL**: https://nametag-yourname.vercel.app
**MentraOS Console**: https://console.mentra.glass
**Vercel Dashboard**: https://vercel.com/dashboard

**Local Testing**:
```bash
bun run dev:web
```

**View Logs**:
```bash
vercel logs
```

**Redeploy**:
```bash
git push origin main  # Auto-deploys
# OR
vercel --prod  # Manual deploy
```

---

Need help? Check [COMPANION_UI.md](./docs/COMPANION_UI.md) or [TROUBLESHOOTING_NGROK.md](./docs/TROUBLESHOOTING_NGROK.md)
