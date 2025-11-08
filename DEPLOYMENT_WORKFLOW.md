# Vercel Deployment Workflow

## ✅ Current Status: WORKING!

Your Vercel deployment is **successfully running** with no ESM/CommonJS errors!

**Production URL**: https://nametag-web-iv6nhsh4l-nem-ekpunobis-projects.vercel.app/

**Last verified**: 2025-10-31
**Status**: ✅ Operational (401 auth working, no server crashes)

---

## Quick Test Command

Test your deployment anytime with one command:

```bash
bun test:deployment https://nametag-web-iv6nhsh4l-nem-ekpunobis-projects.vercel.app
```

**What it tests:**
- ✅ Server responds (no 500 errors)
- ✅ Authentication is working
- ✅ No ESM/CommonJS compatibility issues
- ✅ API endpoints functional

---

## How I Can Help (Claude's Capabilities)

### ✅ What I CAN Do:

1. **Test Public URLs**
   ```bash
   bun test:deployment <your-url>
   ```
   I can run this and interpret results

2. **Analyze Logs You Share**
   - Copy/paste Vercel logs to me
   - I'll diagnose issues and suggest fixes

3. **Create Test Scripts**
   - Automated verification tools
   - Local environment simulators
   - Dependency checkers

4. **Fix Code Issues**
   - Modify source files
   - Update configurations
   - Commit and push changes

5. **Update Documentation**
   - Keep guides current
   - Add troubleshooting steps
   - Document solutions

### ❌ What I CANNOT Do:

1. **Access Private Dashboards**
   - Can't log into Vercel console
   - Can't see your dashboard
   - Can't view private metrics

2. **Real-Time Monitoring**
   - Can't watch deployments live
   - Can't receive notifications
   - Can't auto-respond to alerts

3. **Authenticate with Services**
   - Can't log in to external services
   - Can't access APIs requiring auth
   - Can't see authenticated endpoints

---

## Workflow for Future Deployments

### Making Code Changes

1. **Make your changes locally**
   ```bash
   cd smartglasses-memory-app
   # Edit files...
   ```

2. **Test locally**
   ```bash
   yarn dev:web
   # Visit http://localhost:3001
   ```

3. **Commit and push**
   ```bash
   git add .
   git commit -m "Your change description"
   git push origin main
   ```

4. **Vercel auto-deploys** (~3-4 minutes)

5. **Test deployment**
   ```bash
   npm run test:deployment https://your-vercel-url
   ```

6. **Share results with me if issues**
   - Copy/paste the test output
   - Copy/paste Vercel logs if needed
   - I'll diagnose and help fix

### When Something Breaks

**Option 1: Quick Test (You)**
```bash
bun test:deployment https://your-vercel-url
```
Share the JSON output with me.

**Option 2: Share Vercel Logs (You)**
1. Go to Vercel Dashboard
2. Click your deployment
3. Click "Logs" or "Functions" → "Logs"
4. Copy the relevant error messages
5. Paste them in our chat

**Then I can:**
- Analyze the error
- Identify the root cause
- Create a fix
- Commit and push the solution
- Verify with test script

---

## Common Scenarios

### Scenario 1: "Is my deployment working?"

**You run:**
```bash
bun test:deployment https://your-vercel-url
```

**If green checkmarks:**
✅ It's working! Configure MentraOS webview URL and test on mobile.

**If red X's:**
❌ Share the output with me, I'll help fix it.

### Scenario 2: "I'm getting errors on mobile"

**Share with me:**
1. What error you see on mobile
2. Screenshot if possible
3. Run: `npm run test:deployment <url>` and share output
4. Copy Vercel function logs (Dashboard → Functions → Logs)

**I'll:**
- Diagnose the issue
- Provide a fix
- Test it with you

### Scenario 3: "I made changes and deployed"

**Test your changes:**
```bash
npm run test:deployment https://your-vercel-url
```

**If tests pass:**
✅ Your changes are live!

**If tests fail:**
❌ Share output with me for troubleshooting

### Scenario 4: "Vercel says build failed"

**You share:**
1. Copy the build logs from Vercel dashboard
2. Paste them in chat

**I'll:**
- Identify the build error
- Fix the issue (code, config, dependencies)
- Commit and push the fix
- Vercel will auto-rebuild

---

## Current Setup Summary

### Dependencies
- **Package Manager**: Yarn (enforces resolutions)
- **Node Version**: 20.x (Vercel default)
- **Key Dependencies**:
  - chalk@4.1.2 (CommonJS)
  - boxen@5.1.2 (CommonJS)
  - @mentra/sdk@latest

### Files
- `bun.lock` - Bun dependency lock file (critical!)
- `vercel.json` - Vercel configuration
- `api/index.ts` - Serverless function entry
- `src/webserver.ts` - Express server
- `test-deployment.js` - Automated testing

### Environment Variables (Vercel)
Required in Vercel dashboard:
- `MENTRAOS_API_KEY` - Your MentraOS API key
- `PACKAGE_NAME` - nem.codes.nametag
- `COOKIE_SECRET` - Random secret string
- `WEB_PORT` - 3001
- `NODE_ENV` - production

---

## Quick Reference Commands

### Development
```bash
# Main app (G1 glasses)
bun run dev

# Companion UI (local)
bun run dev:web

# Test deployment
bun test:deployment <vercel-url>

# Type check
bun run lint
```

### Deployment
```bash
# Make changes
git add .
git commit -m "Description"
git push

# Vercel auto-deploys
# Wait 3-4 minutes

# Test
bun test:deployment <url>
```

### Troubleshooting
```bash
# Check dependencies
yarn list --pattern "chalk|boxen"

# Fresh install
rm -rf node_modules
yarn install

# Check Vercel deployment
# 1. Go to vercel.com/dashboard
# 2. Click your project
# 3. Check "Deployments" tab
# 4. View logs
```

---

## Success Indicators

✅ **Your deployment is working if:**
- Test script shows green checkmarks
- URL loads (may show 401 - that's OK!)
- No "500 Internal Server Error"
- No "ERR_REQUIRE_ESM" in logs
- Mobile app can access webview

⚠️ **Normal behaviors:**
- 401 Unauthorized without MentraOS auth
- "No people found" (requires local main app)
- Health endpoint requires auth (more secure)

❌ **Issues to fix:**
- 500 Internal Server Error
- ERR_REQUIRE_ESM in logs
- Build failures in Vercel
- Can't access from mobile

---

## Contact & Support

**For Vercel Issues:**
1. Run: `npm run test:deployment <url>`
2. Copy/paste output to Claude
3. Share Vercel logs if requested
4. Claude will diagnose and fix

**For MentraOS Issues:**
- MentraOS Console: https://console.mentra.glass
- MentraOS Discord: https://discord.gg/mentraos

**For Code Issues:**
- Run tests
- Share errors with Claude
- Claude will create fixes

---

## Notes

- **Yarn is required** - Don't use npm (ESM issues)
- **yarn.lock must be committed** - Critical for Vercel
- **Test after every deploy** - Catch issues early
- **Share logs liberally** - Claude can't see dashboards

---

**Last Updated**: 2025-10-31
**Status**: ✅ Production deployment working
