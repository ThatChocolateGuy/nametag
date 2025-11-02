# Supabase Setup for Nametag

This directory contains database schema and setup instructions for Supabase integration.

## Quick Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign in or create an account
3. Click "New Project"
4. Fill in:
   - **Name**: nametag-production (or your choice)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
5. Wait ~2 minutes for project creation

### 2. Run Database Schema

1. In your Supabase project dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy the entire contents of `schema.sql`
4. Paste into the SQL Editor
5. Click "Run" (bottom right)
6. Verify success message

### 3. Get API Credentials

1. Go to **Settings** > **API** in your Supabase dashboard
2. Copy the following values:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon public** key: `eyJhbG...` (for client-side)
   - **service_role** key: `eyJhbG...` (for server-side, keep secret!)

### 4. Update Environment Variables

Add to your `.env` file:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
```

**Important**: Use `SUPABASE_SERVICE_KEY` (not anon key) for server-side operations to bypass RLS.

### 5. Update Vercel Environment Variables

1. Go to your Vercel project dashboard
2. Navigate to **Settings** > **Environment Variables**
3. Add:
   - `SUPABASE_URL`: Your project URL
   - `SUPABASE_SERVICE_KEY`: Your service role key
4. Redeploy your application

## Database Schema Overview

### Tables

**`people`**
- Stores person information with voice biometric references
- Primary key: `id` (UUID)
- Unique constraint on `name`
- Indexed on: name, speaker_id, last_met

**`conversation_entries`**
- Stores conversation history linked to people
- Foreign key: `person_id` references `people(id)` with CASCADE delete
- Supports arrays for topics and key points
- Indexed on: person_id, date

### Views

**`storage_stats`**
- Aggregate statistics for dashboard
- Shows: total people, conversations, people with voices, averages

## Verifying Setup

Run these queries in SQL Editor to verify:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';

-- Test insert (will be empty initially)
SELECT COUNT(*) FROM people;
SELECT COUNT(*) FROM conversation_entries;

-- View stats
SELECT * FROM storage_stats;
```

## Migration from File Storage

See `scripts/migrate-to-supabase.ts` for automated migration from `data/memories.json` to Supabase.

## Troubleshooting

### Connection Issues
- Verify `SUPABASE_URL` is correct (ends with `.supabase.co`)
- Ensure `SUPABASE_SERVICE_KEY` is the service_role key, not anon key
- Check project is not paused (Supabase pauses inactive free-tier projects after 7 days)

### Permission Errors
- Using anon key instead of service_role key
- RLS policies blocking access (not enabled by default in our schema)

### Data Not Appearing
- Check person exists before adding conversations (foreign key constraint)
- Verify data with SQL Editor queries

## Row Level Security (RLS)

Currently **disabled** for simplicity. All operations use service_role key which bypasses RLS.

To enable multi-tenant support in the future:
1. Uncomment RLS lines in schema.sql
2. Create policies for user access
3. Switch to anon key with user JWT tokens

## Backup & Recovery

Supabase automatically backs up your database:
- **Free tier**: Daily backups, 7-day retention
- **Pro tier**: Point-in-time recovery

Download manual backups:
1. Go to **Database** > **Backups**
2. Click "Download" on any backup

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Arrays](https://www.postgresql.org/docs/current/arrays.html)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
