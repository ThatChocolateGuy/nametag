# Troubleshooting ngrok 404 Errors

## Issue
Getting 404 errors in ngrok terminal when MentraOS tests the connection URL.

## Common Causes & Solutions

### 1. App Not Running

**Check**: Is your app actually running in Terminal 1?

```bash
# Terminal 1 should show:
╔═════════════════════════════════════════╗
║   Smart Glasses Memory Assistant v1.0   ║
╚═════════════════════════════════════════╝

✓ Server started on port 3000
✓ Package: com.yourname.memoryapp
```

**Solution**: If not running, start it:
```bash
cd smartglasses-memory-app
npm run dev
```

---

### 2. Wrong URL Format in MentraOS Console

**Common Mistake**: Including paths or trailing slashes

❌ Wrong:
```
https://matchless-jonell-subarcuate.ngrok-free.dev/
https://matchless-jonell-subarcuate.ngrok-free.dev/api
```

✅ Correct:
```
https://matchless-jonell-subarcuate.ngrok-free.dev
```

**Solution**:
1. Go to [console.mentra.glass](https://console.mentra.glass)
2. Edit your app
3. Remove the trailing `/` from "Public URL"
4. Save

---

### 3. ngrok Not Forwarding to Correct Port

**Check**: ngrok terminal should show:

```
Forwarding   https://matchless-jonell-subarcuate.ngrok-free.dev -> http://localhost:3000
```

**If it shows different port** (e.g., 8080):

**Solution**: Restart ngrok with correct port:
```bash
ngrok http --url=matchless-jonell-subarcuate.ngrok-free.dev 3000
```

---

### 4. Package Name Mismatch

**Check**: Package name in `.env` must EXACTLY match MentraOS Console

**In `.env`**:
```env
PACKAGE_NAME=com.yourname.memoryapp
```

**In MentraOS Console**: Must be identical!

**Solution**:
1. Check your `.env` file
2. Check MentraOS Console app settings
3. Make them match exactly (case-sensitive)

---

### 5. Test the Connection Manually

**Method 1**: Test with curl

```bash
curl https://matchless-jonell-subarcuate.ngrok-free.dev
```

**Expected**: Should NOT return 404. Might return connection info or other response.

**Method 2**: Open in browser

1. Open: `https://matchless-jonell-subarcuate.ngrok-free.dev`
2. You might see an ngrok warning page - click "Visit Site"
3. Should see some response (not 404)

**If you get 404**: Your app isn't running or ngrok isn't forwarding correctly.

---

### 6. ngrok Free Tier Warning Page

**Issue**: ngrok free tier shows a warning page before forwarding

**What happens**:
- First visit shows "ngrok warning"
- Need to click "Visit Site"
- MentraOS test might fail because of this

**Solutions**:

**A) Suppress ngrok warning** (if using auth token):
```bash
ngrok http --url=matchless-jonell-subarcuate.ngrok-free.dev 3000 --request-header-remove=ngrok-skip-browser-warning
```

**B) Use ngrok pro** ($8/month):
- No warning page
- More reliable for production

**C) Alternative tunneling**:
- Cloudflare Tunnel (free, no warning)
- LocalTunnel (free)
- Tailscale Funnel (free)

---

### 7. Check ngrok Logs

In your ngrok terminal, you should see requests:

```
HTTP Requests
-------------

GET /                      200 OK
GET /health               200 OK
POST /webhook             200 OK
```

**If you see**:
```
GET /                      404 Not Found
```

This means the request reached ngrok but your app returned 404.

**Solution**: Your app might not be handling the root path. Check that app is running.

---

### 8. MentraOS SDK Routes

The MentraOS SDK (`AppServer`) automatically creates these routes:

- `/` - Health check / info endpoint
- `/webhook` - Receives events from MentraOS
- WebSocket connections for real-time data

**You don't need to create these manually** - the SDK handles them!

---

### 9. Check App Logs

In Terminal 1 (where app is running), look for:

```
Memory Glasses App initialized
Services ready:
- Memory MCP Client
- Name Extraction (OpenAI gpt-4o-mini)
- AssemblyAI (configured but using MentraOS transcription)

✓ Server started on port 3000
✓ Package: com.yourname.memoryapp
```

**If you see errors instead**, fix those first.

---

## Step-by-Step Verification

### Step 1: Verify App is Running

```bash
cd smartglasses-memory-app
npm run dev
```

**Expected output**:
```
╔═════════════════════════════════════════╗
║   Smart Glasses Memory Assistant v1.0   ║
╚═════════════════════════════════════════╝

Memory Glasses App initialized
...
✓ Server started on port 3000
```

---

### Step 2: Verify ngrok is Running

**New terminal**:
```bash
ngrok http --url=matchless-jonell-subarcuate.ngrok-free.dev 3000
```

**Expected output**:
```
Session Status    online
Forwarding        https://matchless-jonell-subarcuate.ngrok-free.dev -> http://localhost:3000
```

---

### Step 3: Test Local Connection

```bash
curl http://localhost:3000
```

**If this works** but ngrok doesn't → ngrok configuration issue

**If this fails** → app issue

---

### Step 4: Test ngrok URL Directly

```bash
curl https://matchless-jonell-subarcuate.ngrok-free.dev
```

**Expected**: Some response (not 404)

**If 404**: Check Steps 1-3

---

### Step 5: Check MentraOS Console Settings

1. Go to [console.mentra.glass](https://console.mentra.glass)
2. Click your app
3. Verify:
   - **Public URL**: `https://matchless-jonell-subarcuate.ngrok-free.dev` (no trailing slash!)
   - **Package Name**: Matches `.env` exactly
   - **Permissions**: Microphone is checked

---

### Step 6: Test Connection from MentraOS Console

In MentraOS Console:
1. Click "Test Connection" or save the app
2. Watch **both terminals**:
   - Terminal 1 (app): Should show incoming connection logs
   - Terminal 2 (ngrok): Should show HTTP requests

**What you should see**:

**ngrok terminal**:
```
GET /health               200 OK
POST /webhook             200 OK
```

**app terminal**:
```
[timestamp] Incoming connection from MentraOS
```

---

## Common Error Messages

### "This site can't be reached"

**Cause**: ngrok not running or wrong URL

**Solution**:
1. Make sure ngrok is running
2. Check URL is correct
3. Try accessing in browser first

---

### "404 Not Found" from ngrok

**Cause**: App not running or app not handling routes

**Solution**:
1. Verify app is running (`npm run dev`)
2. Check app logs for errors
3. Test `curl http://localhost:3000`

---

### "502 Bad Gateway" from ngrok

**Cause**: App crashed or stopped

**Solution**:
1. Check Terminal 1 for crash logs
2. Restart app: `npm run dev`

---

### "Connection Timeout"

**Cause**: Firewall or network issue

**Solution**:
1. Check firewall settings
2. Try different network
3. Restart ngrok

---

## Quick Fix Checklist

Run through this checklist in order:

- [ ] App is running (`npm run dev` in Terminal 1)
- [ ] App shows "Server started on port 3000"
- [ ] ngrok is running (Terminal 2)
- [ ] ngrok shows "Forwarding ... -> http://localhost:3000"
- [ ] MentraOS Console URL has NO trailing slash
- [ ] Package name in `.env` matches Console exactly
- [ ] Microphone permission is enabled in Console
- [ ] Can access URL in browser (after ngrok warning)
- [ ] `curl localhost:3000` works
- [ ] `curl https://your-ngrok-url.dev` works

---

## Still Getting 404?

### Enable Debug Mode

Add this to your app for more logging:

Edit `src/index.ts`, add after line 23:

```typescript
// Debug middleware
this.app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});
```

This will log every incoming request.

---

### Check MentraOS SDK Version

```bash
cd smartglasses-memory-app
npm list @mentra/sdk
```

Should show: `@mentra/sdk@latest`

**If older version**:
```bash
npm update @mentra/sdk
npm run build
```

---

### Try Different ngrok Domain

Sometimes ngrok domains get rate-limited or blocked.

1. Go to [dashboard.ngrok.com](https://dashboard.ngrok.com)
2. Create a new domain
3. Update in both:
   - ngrok command
   - MentraOS Console

---

## Working Example

Here's what a working setup looks like:

**Terminal 1 (app)**:
```
╔═════════════════════════════════════════╗
║   Smart Glasses Memory Assistant v1.0   ║
╚═════════════════════════════════════════╝

Memory Glasses App initialized
Services ready:
- Memory MCP Client
- Name Extraction (OpenAI gpt-4o-mini)
- AssemblyAI (configured but using MentraOS transcription)

✓ Server started on port 3000
✓ Package: com.yourname.memoryapp

Ready to accept connections from MentraOS!
```

**Terminal 2 (ngrok)**:
```
ngrok

Session Status    online
Session Expires   7 hours, 59 minutes
Terms of Service  https://ngrok.com/tos
Version           3.x.x
Region            United States (us)
Latency           -
Web Interface     http://127.0.0.1:4040
Forwarding        https://matchless-jonell-subarcuate.ngrok-free.dev -> http://localhost:3000

Connections       ttl     opn     rt1     rt5     p50     p90
                  0       0       0.00    0.00    0.00    0.00
```

**MentraOS Console**:
- Public URL: `https://matchless-jonell-subarcuate.ngrok-free.dev`
- Package: `com.yourname.memoryapp`
- Status: ✅ Connected

---

## Alternative: Skip ngrok Test

**Workaround**: You can skip the URL test in MentraOS Console

1. Enter your ngrok URL
2. Save (even if test fails)
3. Try launching app from MentraOS mobile app
4. If app connects from phone, the setup works!

The console test might fail due to ngrok's warning page, but the actual connection from the mobile app often works fine.

---

## Need More Help?

If still stuck, provide:
1. Full output from Terminal 1 (app)
2. Full output from Terminal 2 (ngrok)
3. Exact URL in MentraOS Console
4. Screenshot of error in ngrok terminal

Post in MentraOS Discord or create an issue!
