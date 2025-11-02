# Supabase Production Setup Guide

This guide walks you through migrating from file-based storage to Supabase for production deployment on Vercel.

## Why Supabase?

- **Persistent Storage**: Data survives serverless deployments
- **Scalable**: PostgreSQL handles concurrent users efficiently
- **Relational**: Proper foreign keys ensure data integrity
- **Backup**: Automatic daily backups (7-day retention on free tier)
- **Real-time** (optional): Enable live data subscriptions

## Prerequisites

- [ ] Existing Nametag installation with data in `data/memories.json`
- [ ] Vercel account for deployment
- [ ] ~15 minutes for setup

---

## Step 1: Create Supabase Project (5 minutes)

1. **Sign up/Login**
   - Go to [supabase.com](https://supabase.com)
   - Create account or sign in

2. **Create New Project**
   - Click "New Project"
   - **Name**: `nametag-production` (or your choice)
   - **Database Password**: Generate strong password (save it!)
   - **Region**: Choose closest to your users
   - Click "Create new project"

3. **Wait for Provisioning**
   - Takes ~2 minutes
   - Dashboard will show "Building..." then "Active"

---

## Step 2: Run Database Schema (3 minutes)

1. **Open SQL Editor**
   - In Supabase dashboard, navigate to **SQL Editor** (left sidebar)
   - Click "+ New query"

2. **Run Schema Script**
   - Open `supabase/schema.sql` from this project
   - Copy entire contents
   - Paste into SQL Editor
   - Click **Run** (bottom right)

3. **Verify Success**
   - Should see: "Success. No rows returned"
   - Go to **Table Editor** to see `people` and `conversation_entries` tables

---

## Step 3: Get API Credentials (2 minutes)

1. **Navigate to Settings**
   - Click **Settings** > **API** in left sidebar

2. **Copy Credentials**
   - **Project URL**: `https://xxxxx.supabase.co`
   - **service_role key** (under "Project API keys"): `eyJhbG...`

   > ⚠️ Use **service_role** key (not anon key) for server-side operations

3. **Keep These Secret!**
   - Never commit to Git
   - Store in `.env` file (gitignored)

---

## Step 4: Update Local Environment (2 minutes)

1. **Update `.env` file**
   ```bash
   # Add these lines to your .env file
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=eyJhbG...your-service-role-key
   ```

2. **Verify Other Variables**
   Ensure these are also set:
   ```bash
   MENTRAOS_API_KEY=your_key
   PACKAGE_NAME=com.yourname.memoryapp
   ASSEMBLYAI_API_KEY=your_key
   OPENAI_API_KEY=your_key
   ```

---

## Step 5: Migrate Existing Data (5 minutes)

1. **Run Migration Script**
   ```bash
   yarn migrate
   # or: bun run migrate
   ```

2. **Review Migration Output**
   ```
   ╔══════════════════════════════════════════════════╗
   ║   Nametag: File Storage → Supabase Migration    ║
   ╚══════════════════════════════════════════════════╝

   ✓ Found 5 people to migrate

   Migration Summary:
   ─────────────────────────────────────────────────
     1. John Doe (Speaker A)
        └─ 3 conversation(s)
     2. Jane Smith (Speaker B)
        └─ 5 conversation(s)
   ...
   ```

3. **Verify in Supabase**
   - Go to **Table Editor** in Supabase dashboard
   - Click `people` table
   - Should see all your migrated data

4. **Backup Created**
   - Script automatically backs up `data/memories.json`
   - Saved as `data/memories.backup-<timestamp>.json`

---

## Step 6: Test Locally (3 minutes)

1. **Start Web Server**
   ```bash
   yarn web
   # or: bun run web
   ```

2. **Open Companion UI**
   - Navigate to http://localhost:3001
   - Should see all migrated people
   - Try adding a note to test write operations

3. **Check Logs**
   ```
   Supabase Storage Client initialized
   Connected to: https://xxxxx.supabase.co
   ```

---

## Step 7: Deploy to Vercel (5 minutes)

1. **Update Vercel Environment Variables**
   - Go to your Vercel project dashboard
   - Navigate to **Settings** > **Environment Variables**
   - Add:
     - `SUPABASE_URL`: `https://your-project.supabase.co`
     - `SUPABASE_SERVICE_KEY`: `eyJhbG...` (your service role key)
   - Ensure other variables are set:
     - `MENTRAOS_API_KEY`
     - `PACKAGE_NAME`
     - `OPENAI_API_KEY`
     - `ASSEMBLYAI_API_KEY`
     - `COOKIE_SECRET`

2. **Commit and Push Changes**
   ```bash
   git add .
   git commit -m "Migrate to Supabase for production storage"
   git push
   ```

3. **Wait for Deployment**
   - Vercel auto-deploys on push
   - Takes ~2 minutes
   - Watch progress in Vercel dashboard

4. **Test Production Deployment**
   - Visit your Vercel URL
   - Sign in with MentraOS credentials
   - Verify data loads correctly

---

## Verification Checklist

After deployment, verify:

- [ ] Companion UI loads without errors
- [ ] All people are displayed
- [ ] Conversation history shows correctly
- [ ] Can add notes to people
- [ ] Stats display correctly
- [ ] Export functionality works
- [ ] No errors in Vercel logs

---

## Troubleshooting

### Issue: "Missing Supabase credentials" error

**Solution**: Verify environment variables are set correctly
```bash
# Check local .env file
cat .env | grep SUPABASE

# Check Vercel
vercel env ls
```

### Issue: "Failed to connect to Supabase"

**Solutions**:
1. Verify `SUPABASE_URL` is correct (ends with `.supabase.co`)
2. Ensure using **service_role** key, not anon key
3. Check project is not paused (Supabase pauses inactive free projects after 7 days)
4. Test connection in Supabase SQL Editor:
   ```sql
   SELECT COUNT(*) FROM people;
   ```

### Issue: "Row Level Security" errors

**Solution**: Our schema has RLS disabled by default. If you enabled it:
```sql
-- Disable RLS for service role access
ALTER TABLE people DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_entries DISABLE ROW LEVEL SECURITY;
```

### Issue: Data not appearing after migration

**Check**:
1. Run migration script again (it's idempotent - safe to re-run)
2. Verify in Supabase Table Editor
3. Check Vercel logs for errors

---

## Database Management

### View Statistics
```sql
SELECT * FROM storage_stats;
```

### View All People
```sql
SELECT id, name, speaker_id, last_met
FROM people
ORDER BY last_met DESC;
```

### View Conversations for a Person
```sql
SELECT
  p.name,
  ce.date,
  ce.transcript,
  ce.topics
FROM people p
JOIN conversation_entries ce ON p.id = ce.person_id
WHERE p.name ILIKE '%John%'
ORDER BY ce.date DESC;
```

### Backup Data
```bash
# Export from Supabase via API
yarn web
# Then visit: http://localhost:3001/api/export
```

### Restore from Backup
1. Go to Supabase dashboard
2. Navigate to **Database** > **Backups**
3. Click "Restore" on desired backup

---

## Cost Estimation

**Supabase Free Tier** (sufficient for personal use):
- ✅ 500MB database storage
- ✅ 50,000 monthly active users
- ✅ 2GB bandwidth
- ✅ Daily backups (7-day retention)

**Estimated Usage** (based on typical use):
- Person record: ~1KB
- Conversation entry: ~500 bytes
- 100 people + 1000 conversations ≈ 600KB
- **Conclusion**: Free tier is MORE than enough

---

## Next Steps

### Optional Enhancements

1. **Enable Row Level Security (RLS)**
   - For multi-user support
   - See `supabase/schema.sql` comments

2. **Real-time Subscriptions**
   - Live updates across devices
   - See [Supabase Realtime docs](https://supabase.com/docs/guides/realtime)

3. **Database Functions**
   - Create stored procedures for complex queries
   - Example: Search conversations by keyword

4. **Scheduled Backups**
   - Set up automated exports
   - Use Vercel Cron Jobs

---

## Support

- **Supabase Docs**: https://supabase.com/docs
- **Nametag Issues**: https://github.com/ThatChocolateGuy/nametag/issues
- **MentraOS Support**: https://docs.mentra.glass

---

## Rollback (If Needed)

If you need to revert to file-based storage:

1. **Switch Back to FileStorageClient**
   ```typescript
   // In src/webserver.ts, line 4:
   import { FileStorageClient, Person } from './services/fileStorageClient';

   // Line 14:
   const storageClient = new FileStorageClient('./data');
   ```

2. **Restore from Backup**
   ```bash
   cp data/memories.backup-<timestamp>.json data/memories.json
   ```

3. **Commit and Deploy**
   ```bash
   git commit -am "Rollback to FileStorageClient"
   git push
   ```

Your data in Supabase remains untouched - you can switch back anytime.

---

**🎉 Congratulations!** Your Nametag app now has production-ready storage with Supabase.
