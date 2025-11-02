# Vercel Deployment Setup Guide

This guide explains how to deploy the Nametag companion UI to Vercel and configure environment variables.

## Prerequisites

- A Vercel account ([sign up here](https://vercel.com/signup))
- Your project pushed to GitHub
- Supabase credentials (from [Supabase Dashboard](https://supabase.com/dashboard))
- MentraOS credentials (from [MentraOS Console](https://console.mentra.glass))

## Quick Setup

### Step 1: Install Vercel CLI (Optional but Recommended)

```bash
npm install -g vercel
```

### Step 2: Configure Environment Variables

You have three options:

#### Option A: Automated Setup with CLI (Easiest)

Run the automated setup script:

```bash
# On Windows (PowerShell)
npm run setup:vercel-env

# On macOS/Linux (Bash)
npm run setup:vercel-env:bash
```

This script will:
- Read your `.env` file
- Validate all required variables are present
- Automatically set them in Vercel
- Configure them for Production, Preview, and Development environments

#### Option B: Manual Setup via Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: **nametag-web**
3. Navigate to: **Settings** → **Environment Variables**
4. Add the following variables:

**Required Variables:**

| Variable Name | Description | Where to Get It |
|--------------|-------------|-----------------|
| `SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Supabase Dashboard → Settings → API → `service_role` key (⚠️ Keep secret!) |
| `MENTRAOS_API_KEY` | Your MentraOS API key | MentraOS Console → API Keys |
| `PACKAGE_NAME` | Your app package name | MentraOS Console → Your App (e.g., `nem.codes.nametag`) |
| `OPENAI_API_KEY` | OpenAI API key | [OpenAI Platform](https://platform.openai.com/api-keys) |

**Optional Variables:**

| Variable Name | Default Value | Description |
|--------------|---------------|-------------|
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model for name extraction |
| `COOKIE_SECRET` | `change-this-secret-in-production` | Secret for session cookies (⚠️ Change this!) |
| `ASSEMBLYAI_API_KEY` | - | AssemblyAI key for voice diarization |
| `ENABLE_DIARIZATION` | `true` | Enable/disable speaker diarization |

5. Set **Environment** to: **Production**, **Preview**, and **Development**
6. Click **Save** for each variable

#### Option C: Manual Setup via Vercel CLI

```bash
# Login to Vercel
vercel login

# Set environment variables one by one
echo "https://your-project.supabase.co" | vercel env add SUPABASE_URL production preview development
echo "your-service-role-key" | vercel env add SUPABASE_SERVICE_KEY production preview development
echo "your-mentraos-api-key" | vercel env add MENTRAOS_API_KEY production preview development
echo "nem.codes.nametag" | vercel env add PACKAGE_NAME production preview development
echo "your-openai-key" | vercel env add OPENAI_API_KEY production preview development
```

### Step 3: Deploy to Vercel

#### First-Time Deployment

1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "Add Vercel deployment configuration"
   git push origin main
   ```

2. Import your project in Vercel:
   - Go to [Vercel Dashboard](https://vercel.com/new)
   - Click **Import Project**
   - Select your GitHub repository
   - Vercel will auto-detect the configuration
   - Click **Deploy**

#### Subsequent Deployments

After the initial setup, deployments are automatic:
- Push to `main` branch → Production deployment
- Push to other branches → Preview deployment

Or deploy manually:
```bash
vercel --prod
```

### Step 4: Verify Deployment

1. **Test Health Endpoint:**
   ```bash
   curl https://your-app.vercel.app/health
   ```
   Expected response:
   ```json
   {"status": "ok", "timestamp": 1234567890, "storage": true}
   ```

2. **Test API Endpoint:**
   Visit your app URL and try logging in with MentraOS authentication.

3. **Check Vercel Logs:**
   ```bash
   vercel logs
   ```

## Troubleshooting

### Error: 500 Internal Server Error

**Cause:** Missing environment variables

**Solution:**
1. Check Vercel logs: `vercel logs`
2. Verify all required environment variables are set in Vercel Dashboard
3. Redeploy: `vercel --prod` or push to GitHub

### Error: Cannot connect to Supabase

**Cause:** Invalid Supabase credentials or URL

**Solution:**
1. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are correct
2. Check you're using the **service_role** key, not the **anon** key
3. Verify your Supabase project is active

### Error: MentraOS authentication failed

**Cause:** Invalid MentraOS credentials

**Solution:**
1. Verify `MENTRAOS_API_KEY` is correct
2. Verify `PACKAGE_NAME` matches exactly with MentraOS Console
3. Check your MentraOS app is enabled and approved

### Environment Variables Not Taking Effect

**Cause:** Deployment using old environment variables

**Solution:**
1. After changing environment variables, you must redeploy
2. Go to Vercel Dashboard → Deployments → Click "..." → Redeploy
3. Or run: `vercel --prod --force`

## Project Structure

```
smartglasses-memory-app/
├── api/
│   ├── index.ts          # Main Vercel serverless function (routes to Express app)
│   └── health.ts         # Standalone health check endpoint
├── src/
│   ├── webserver.ts      # Express app with all routes
│   └── services/
│       └── supabaseStorageClient.ts  # Supabase integration
├── scripts/
│   ├── setup-vercel-env.ps1  # Windows setup script
│   └── setup-vercel-env.sh   # macOS/Linux setup script
├── vercel.json           # Vercel configuration
└── .env                  # Local environment variables (DO NOT COMMIT!)
```

## Vercel Configuration

The `vercel.json` file configures:
- Serverless function routing
- Health check endpoint optimization
- URL rewrites

Key configurations:
```json
{
  "version": 2,
  "functions": {
    "api/health.ts": {
      "memory": 128,
      "maxDuration": 10
    }
  },
  "rewrites": [
    {
      "source": "/health",
      "destination": "/api/health"
    },
    {
      "source": "/(.*)",
      "destination": "/api"
    }
  ]
}
```

## Security Best Practices

1. **Never commit `.env` files to Git**
   - Already in `.gitignore`
   - Contains sensitive credentials

2. **Use service_role key for Supabase**
   - Required for bypassing Row Level Security (RLS)
   - Keep it secret, never expose in frontend

3. **Change COOKIE_SECRET in production**
   - Generate a secure random string
   - Keep it consistent across deployments

4. **Rotate API keys regularly**
   - Update in both local `.env` and Vercel
   - Redeploy after rotation

## Monitoring & Logs

### View Real-Time Logs
```bash
vercel logs --follow
```

### View Function Logs
```bash
vercel logs --output json
```

### View Specific Deployment Logs
```bash
vercel logs [deployment-url]
```

## Cost Considerations

Vercel's Hobby (free) plan includes:
- Unlimited deployments
- 100 GB bandwidth/month
- Serverless function execution
- Automatic SSL certificates

If you exceed limits, consider:
- Vercel Pro plan ($20/month)
- Monitoring your usage in Vercel Dashboard

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel CLI Reference](https://vercel.com/docs/cli)
- [Supabase Documentation](https://supabase.com/docs)
- [MentraOS Documentation](https://docs.mentra.glass)

## Getting Help

If you encounter issues:

1. Check Vercel deployment logs
2. Verify environment variables are set correctly
3. Test locally first: `npm run dev:web`
4. Check [Vercel Status Page](https://vercel-status.com)
5. Check [Supabase Status Page](https://status.supabase.com)

For project-specific issues:
- GitHub Issues: https://github.com/ThatChocolateGuy/nametag/issues
