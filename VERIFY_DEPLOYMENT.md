# Vercel Deployment Verification Guide

Quick checklist to verify your Vercel deployment is working correctly.

## ✅ Deployment Status

### 1. Check Vercel Dashboard

Go to: https://vercel.com/dashboard

**Look for:**
- ✅ Latest deployment shows "Ready" status (green checkmark)
- ✅ Commit message: "Switch to Yarn for proper dependency resolution..."
- ✅ Build time: ~2-3 minutes
- ✅ No error badges

### 2. Check Build Logs

Click on your deployment → **"Logs"** tab

**Must see:**
```
Detected Package Manager: yarn@1.22.22
Running "yarn install"
...
success Saved lockfile.
...
Build Completed
```

**Must NOT see:**
```
Error [ERR_REQUIRE_ESM]
Node.js process exited with exit status: 1
```

### 3. Check Function Logs

Click **"Functions"** tab → Select `api/index`

**Should see:**
- Function deployed successfully
- Runtime: Node.js 20.x
- Region: Your selected region
- No error count

## ✅ Dependency Verification

### Locally (if needed)

```bash
cd smartglasses-memory-app

# Verify yarn.lock exists
ls yarn.lock

# Check dependency versions
yarn list --pattern "chalk|boxen" --depth=0
# Should show:
# ├─ boxen@5.1.2
# └─ chalk@4.1.2

# Verify no nested ESM versions
ls node_modules/@mentra/sdk/node_modules/
# Should NOT contain chalk or boxen folders
```

## ✅ Application Testing

### 1. Test in Browser

Open your Vercel URL:
```
https://your-nametag-project.vercel.app
```

**Expected:**
- ✅ Page loads (no 500 error)
- ✅ Shows "Nametag" header
- ✅ Shows authentication prompt or dashboard
- ✅ No browser console errors

**If you see authentication errors:** This is normal if you haven't logged in via MentraOS yet.

### 2. Test API Endpoints

Open browser DevTools → Console, then run:

```javascript
// Test health endpoint
fetch('https://your-project.vercel.app/health')
  .then(r => r.json())
  .then(console.log)
// Should return: { status: 'ok', storage: true }

// Test API (will require auth)
fetch('https://your-project.vercel.app/api/stats')
  .then(r => r.json())
  .then(console.log)
// May return 401 if not authenticated (this is correct)
```

### 3. Test Mobile Access

**In MentraOS Console:**
1. Go to: https://console.mentra.glass
2. Edit your Nametag app
3. Verify "Webview URL" is set to your Vercel URL
4. Save

**On Mobile:**
1. Open MentraOS app
2. Navigate to Nametag
3. Look for webview/companion UI button
4. Tap to open
5. Should load without errors

## ✅ Environment Variables

### Check in Vercel Dashboard

Settings → Environment Variables

**Required:**
- ✅ `MENTRAOS_API_KEY` - Your MentraOS API key
- ✅ `PACKAGE_NAME` - Your package name (e.g., nem.codes.nametag)
- ✅ `COOKIE_SECRET` - Random secret string for sessions
- ✅ `WEB_PORT` - Set to 3001
- ✅ `NODE_ENV` - Set to production

**If missing:** Add them and redeploy.

## 🐛 Common Issues & Quick Fixes

### Issue: Still getting 500 errors

**Check Vercel logs for:**
```
Error [ERR_REQUIRE_ESM]: require() of ES Module chalk
```

**Fix:**
1. Verify `yarn.lock` is in repository (not `package-lock.json`)
2. Check Vercel is using Yarn (logs should say "Detected Package Manager: yarn")
3. Trigger a fresh build: Deployments → Latest → "..." menu → "Redeploy"

### Issue: "Using npm" in Vercel logs

**Problem:** Vercel is using npm instead of Yarn

**Fix:**
1. Make sure `yarn.lock` is committed to git
2. Delete `package-lock.json` if it exists
3. Push to GitHub
4. Vercel should auto-detect `yarn.lock`

### Issue: Build succeeds but runtime errors

**Check function logs:**
```
Deployments → Latest → Functions → api/index → Logs
```

**Common causes:**
- Missing environment variables
- Path issues (use `__dirname` for file paths)
- File system access (Vercel is read-only)

### Issue: Authentication fails

**Verify:**
1. `MENTRAOS_API_KEY` matches console.mentra.glass
2. `PACKAGE_NAME` matches exactly (case-sensitive)
3. `COOKIE_SECRET` is set (any random string)
4. Webview URL in console matches Vercel URL exactly

## 📊 Success Checklist

Mark each when verified:

- [ ] Vercel deployment status: "Ready"
- [ ] Build logs show "Detected Package Manager: yarn"
- [ ] No ERR_REQUIRE_ESM errors in logs
- [ ] URL loads in browser (no 500 error)
- [ ] `/health` endpoint returns JSON
- [ ] Environment variables are set
- [ ] Webview URL configured in MentraOS console
- [ ] Mobile app can open companion UI

## 🎯 Expected Behavior

### ✅ What Should Work:
- Companion UI loads on Vercel URL
- Authentication via MentraOS
- API endpoints respond
- Mobile access through MentraOS app

### ⚠️ Current Limitation:
- **Data display requires local main app running**
- Companion UI on Vercel can't write to local `./data/memories.json`
- You'll see "No people found" unless main app is running locally

This is expected with the current file-based storage. See VERCEL_DEPLOYMENT.md for database migration options.

## 🚀 Next Steps

Once verified:
1. Keep main app running locally: `bun run dev`
2. Access companion UI from Vercel URL or mobile
3. Consider migrating to cloud database for full independence

## 📝 Quick Test Command

Run this locally to verify your setup matches Vercel:

```bash
cd smartglasses-memory-app

# Clean install with Yarn
rm -rf node_modules
yarn install

# Verify versions
yarn list --pattern "chalk|boxen" --depth=0

# Start companion UI locally
yarn web

# Test at http://localhost:3001
```

If this works locally, it should work on Vercel!

---

**Need help?** Check the full deployment guide: [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)
