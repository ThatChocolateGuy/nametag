# Quick Setup Checklist: Mobile Companion UI Access

Follow these steps to access your Nametag Companion UI from the MentraOS mobile app.

## Prerequisites Checklist

- [ ] Main Nametag app running and working
- [ ] ngrok account with at least 1 static domain
- [ ] MentraOS app installed on phone
- [ ] Computer and phone on internet

## Setup Steps

### 1. Get ngrok Setup for Companion UI

**Option A: Free (Dynamic URL)** - URL changes each restart
```bash
# Terminal 4
ngrok http 3001
```
Copy the URL shown (e.g., `https://1234-abcd-5678.ngrok-free.app`)

**Option B: Paid ($8/month)** - Permanent static URL
1. Go to https://dashboard.ngrok.com/cloud-edge/domains
2. Create new static domain (e.g., `nametag-ui-yourname.ngrok-free.app`)
3. Run:
```bash
# Terminal 4
ngrok http --url=nametag-ui-yourname.ngrok-free.app 3001
```

### 2. Start All Services

Open 4 terminal windows:

**Terminal 1 - Main App**:
```bash
cd C:\Users\nemx1\smartglasses-memory-app
bun run dev
```

**Terminal 2 - Companion UI**:
```bash
cd C:\Users\nemx1\smartglasses-memory-app
bun run dev:web
```

**Terminal 3 - Main App ngrok**:
```bash
ngrok http --url=YOUR-MAIN-STATIC-URL.ngrok-free.app 3000
```

**Terminal 4 - Companion UI ngrok**:
```bash
# If using free/dynamic:
ngrok http 3001

# If using paid/static:
ngrok http --url=nametag-ui-yourname.ngrok-free.app 3001
```

### 3. Configure MentraOS Console

1. Go to https://console.mentra.glass
2. Sign in with your MentraOS account
3. Select your **Nametag** app
4. Click **"Edit App"**
5. Find the **"Webview URL"** field
6. Paste your companion UI ngrok URL:
   - From Terminal 4 output
   - Example: `https://nametag-ui-yourname.ngrok-free.app`
   - Or: `https://1234-abcd-5678.ngrok-free.app` (dynamic)
7. Click **"Save"** at the bottom

### 4. Test on Mobile

1. Open **MentraOS app** on your phone
2. Go to your **Nametag** app
3. Look for:
   - Settings menu
   - "View Companion" button
   - "Webview" option
   - Three-dot menu
4. Tap the webview option
5. Companion UI should load automatically (authenticated)

## Verification

Check that everything works:

- [ ] Terminal 1: No errors in main app logs
- [ ] Terminal 2: No errors in companion UI logs
- [ ] Terminal 3: ngrok shows "Session Status: online"
- [ ] Terminal 4: ngrok shows "Session Status: online"
- [ ] Console: Webview URL saved correctly
- [ ] Mobile: Companion UI loads in MentraOS app
- [ ] Mobile: Can see list of people
- [ ] Mobile: Can search and view details
- [ ] Mobile: Can add notes

## Troubleshooting

### Can't Find Webview in MentraOS App

**Try**:
- Check app settings/menu
- Update MentraOS app to latest version
- Look for "Companion", "Webview", or "More" buttons
- Contact MentraOS support for UI guidance

### "Unable to Connect" in Mobile App

**Check**:
```bash
# Test URL directly in phone browser (Safari/Chrome)
# Open: https://your-ngrok-url
# Should see Nametag Companion UI
```

If works in browser but not MentraOS app:
- Verify webviewURL in console is exact match (no trailing slash)
- Try restarting MentraOS app
- Check ngrok is still running

### "Authentication Failed"

**Check** Terminal 2 logs for errors:
```bash
# Should see in Terminal 2:
# ✓ Server running on http://localhost:3001
# ✓ MentraOS auth enabled
```

**Verify** `.env` file:
```env
MENTRAOS_API_KEY=your_actual_key_here
PACKAGE_NAME=nem.codes.nametag
COOKIE_SECRET=your_secret_here
```

**Restart** companion UI after changes:
```bash
# Terminal 2
# Stop with Ctrl+C
bun run dev:web
```

### ngrok URL Changes (Free Tier)

If using dynamic ngrok URLs:
1. Note the new URL from Terminal 4
2. Update webviewURL in console.mentra.glass
3. Save changes
4. Try accessing from mobile again

**Solution**: Upgrade to ngrok paid plan or deploy to cloud service.

## Alternative: Cloud Deployment

Want a permanent URL without ngrok?

**Quick Deploy to Railway** (Free tier available):
```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login
railway login

# 3. Initialize project
railway init

# 4. Add environment variables in Railway dashboard
# MENTRAOS_API_KEY, PACKAGE_NAME, COOKIE_SECRET, etc.

# 5. Deploy
railway up

# 6. Get URL from Railway dashboard
# 7. Use as webviewURL in MentraOS console
```

See [COMPANION_UI_MOBILE_ACCESS.md](./docs/COMPANION_UI_MOBILE_ACCESS.md) for more deployment options.

## Summary

**Minimum Setup**:
- 4 terminal windows running
- 2 ngrok tunnels (ports 3000 and 3001)
- Webview URL configured in console
- Access from MentraOS mobile app

**Production Setup**:
- Deploy companion UI to cloud service
- Static permanent URL
- No ngrok needed for companion UI
- More reliable for daily use

## Next Steps

Once working:
- [ ] Bookmark ngrok URLs for easy reference
- [ ] Consider upgrading ngrok or deploying to cloud
- [ ] Share companion UI access with others (optional)
- [ ] Set up monitoring/logging (optional)

## Need Help?

- **Full Guide**: [COMPANION_UI_MOBILE_ACCESS.md](./docs/COMPANION_UI_MOBILE_ACCESS.md)
- **Companion UI Docs**: [COMPANION_UI.md](./docs/COMPANION_UI.md)
- **General Setup**: [QUICKSTART.md](./docs/QUICKSTART.md)
- **Troubleshooting**: [TROUBLESHOOTING_NGROK.md](./docs/TROUBLESHOOTING_NGROK.md)

---

**Ready to start?** Follow the checklist above step by step!
