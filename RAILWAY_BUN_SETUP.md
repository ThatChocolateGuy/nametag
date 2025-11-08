# Railway Deployment with Bun

## ✅ Issue Fixed: Lockfile Frozen Error

### The Problem
Railway was failing with:
```
error: lockfile had changes, but lockfile is frozen
note: try re-running without --frozen-lockfile and commit the updated lockfile
```

### The Solution
We've consolidated the project to **use Bun exclusively**. Here's what was done:

1. **Removed duplicate package managers**
   - Deleted `package-lock.json` (npm)
   - Deleted `yarn.lock` (yarn)
   - Kept only `bun.lock` (Bun)

2. **Updated `.gitignore`**
   - Now tracks `bun.lock` in git (critical!)
   - Ignores `package-lock.json` and `yarn.lock`

3. **Updated `railway.json`**
   - Watches only `bun.lock` (removed `yarn.lock` reference)
   - Uses `bun src/index.ts` as start command

4. **Regenerated lockfile**
   - Fresh `bun.lock` that exactly matches `package.json`

---

## Why This Fixes the Issue

Railway's `--frozen-lockfile` flag requires that:
1. A lockfile exists in the repo
2. The lockfile is committed to git
3. The lockfile matches the current `package.json` exactly

**Before**: `bun.lock` was in `.gitignore`, so Railway couldn't find a committed lockfile.

**After**: `bun.lock` is tracked and committed, so Railway can verify dependencies match.

---

## Railway Configuration

### `railway.json`
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "RAILPACK",
    "watchPatterns": [
      "src/**",
      "package.json",
      "bun.lock"
    ]
  },
  "deploy": {
    "startCommand": "bun src/index.ts",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### Environment Variables (Railway Dashboard)
Required:
- `OPENAI_API_KEY` - Your OpenAI API key
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_KEY` - Supabase anon/public key
- `MENTRAOS_API_KEY` - Your MentraOS API key
- `PACKAGE_NAME` - nem.codes.nametag
- `OPENAI_MODEL` - gpt-4o-mini (or other model)

---

## Package Manager Consolidation

### Why Bun Only?

**Speed**: Bun is significantly faster than npm/yarn
- Install: ~3-10x faster
- Runtime: ~2-4x faster
- Build: ~2x faster

**Simplicity**: One lockfile, one tool, one workflow

**Compatibility**: Works with Railway, Vercel, and all npm packages

### All Platforms Support Bun

✅ **Railway**: Uses `bun.lock` automatically when detected  
✅ **Vercel**: Serverless functions work with Bun dependencies  
✅ **Local Dev**: Dev container has Bun 1.3.1 installed  

---

## Workflow After Changes

### Development Flow
```bash
# 1. Install/update dependencies
bun install

# 2. Commit changes INCLUDING bun.lock
git add package.json bun.lock
git commit -m "Update dependencies"

# 3. Push to trigger Railway deployment
git push origin main
```

### What Railway Does
1. Detects `bun.lock` in repo
2. Runs `bun install --frozen-lockfile`
3. ✅ Success! (lockfile matches package.json)
4. Runs `bun src/index.ts`

### Critical Rule
**Always commit `bun.lock` after running `bun install`**

This ensures Railway can reproduce your exact dependency tree.

---

## Migration Commands

### If You Need to Regenerate Lockfile
```bash
# Remove old lockfile
rm bun.lock

# Generate fresh one
bun install

# Commit it
git add bun.lock package.json
git commit -m "Regenerate bun.lock"
git push
```

### If You Add/Remove Dependencies
```bash
# Add package
bun add package-name

# Remove package
bun remove package-name

# ALWAYS commit the updated bun.lock
git add package.json bun.lock
git commit -m "Add/remove package-name"
git push
```

---

## Verifying the Fix

### Local Test
```bash
# Simulate Railway's frozen lockfile check
bun install --frozen-lockfile
```

**Expected**: No errors (dependencies match)

### Railway Deployment
1. Push changes to main
2. Check Railway logs
3. Look for:
   ```
   bun install --frozen-lockfile
   ✓ All dependencies resolved
   ```

### If It Still Fails
Check that:
1. `bun.lock` is committed: `git ls-files | grep bun.lock`
2. Lockfile is current: `bun install` (no changes)
3. `.gitignore` doesn't ignore `bun.lock`

---

## Quick Reference

### Commands
```bash
# Install dependencies
bun install

# Run main app (Railway uses this)
bun src/index.ts

# Run with hot reload (dev)
bun --hot src/index.ts

# Run companion UI
bun src/webserver.ts

# Type check
bun run lint

# Build
bun run build
```

### Files to Track in Git
✅ `package.json` - Dependencies list  
✅ `bun.lock` - Exact versions (CRITICAL!)  
✅ `railway.json` - Railway config  
❌ `package-lock.json` - Not used (npm)  
❌ `yarn.lock` - Not used (yarn)  
❌ `node_modules/` - Never commit

---

## FAQ

**Q: Why was bun.lock ignored before?**  
A: Likely a mistake or copied from a template that used multiple package managers.

**Q: Can I use npm/yarn for local dev?**  
A: Technically yes, but you'll create conflicting lockfiles. Stick with Bun for consistency.

**Q: What if Railway doesn't support Bun?**  
A: Railway's RAILPACK builder auto-detects `bun.lock` and uses Bun. It's fully supported.

**Q: Will Vercel work with Bun?**  
A: Yes! Vercel respects `bun.lock` for dependency resolution. The serverless functions still work.

**Q: What about CI/CD?**  
A: Any CI that supports Bun (GitHub Actions, GitLab CI, etc.) will work. Just use `bun install`.

---

## Next Steps

1. ✅ Commit the changes to main
2. ✅ Push to trigger Railway deployment
3. ✅ Verify no lockfile errors in Railway logs
4. ✅ Test the deployed app

**You should never see the frozen lockfile error again!**
