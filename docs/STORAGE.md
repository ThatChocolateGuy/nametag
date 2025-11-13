# Storage Architecture

This document describes the Supabase PostgreSQL storage architecture used by the Nametag smart glasses app.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [SupabaseStorageClient API](#supabasestorageclient-api)
5. [Setup and Configuration](#setup-and-configuration)
6. [Data Migration](#data-migration)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Overview

### Introduction

Nametag uses **Supabase PostgreSQL** as its primary storage backend. Supabase provides a cloud-native, scalable PostgreSQL database with automatic backups, REST APIs, and real-time capabilities.

### Why Supabase?

**Cloud-Native & Scalable**
- Hosted PostgreSQL database with automatic scaling
- No infrastructure management required
- Built-in connection pooling

**Reliable & Secure**
- Automatic daily backups with point-in-time recovery
- Row-Level Security (RLS) for multi-tenant support
- SSL/TLS encryption for data in transit
- Encrypted backups for data at rest

**Developer-Friendly**
- Simple REST API and TypeScript client
- Real-time subscriptions (future enhancement)
- Built-in authentication (optional)
- Intuitive dashboard and SQL editor

### Migration from FileStorageClient

The app previously used a local JSON file (`data/memories.json`) for storage via `FileStorageClient`. The new `SupabaseStorageClient` provides:

- **Drop-in replacement**: Same interface, minimal code changes
- **Cloud persistence**: Data survives server restarts and deployments
- **Better concurrency**: PostgreSQL handles concurrent access correctly
- **Scalability**: Supports multiple users and devices
- **Backup automation**: Daily backups included with Supabase

**Migration Path**: See [Data Migration](#data-migration) section for migrating existing data.

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Nametag Application                       │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         ConversationManager                        │    │
│  │  (Business Logic)                                  │    │
│  └─────────────────┬──────────────────────────────────┘    │
│                    │                                        │
│                    ▼                                        │
│  ┌────────────────────────────────────────────────────┐    │
│  │      SupabaseStorageClient                         │    │
│  │  - storePerson()                                   │    │
│  │  - getPerson()                                     │    │
│  │  - getAllPeople()                                  │    │
│  │  - deletePerson()                                  │    │
│  └─────────────────┬──────────────────────────────────┘    │
│                    │                                        │
│                    │ @supabase/supabase-js               │
│                    │ (TypeScript Client)                   │
└────────────────────┼────────────────────────────────────────┘
                     │
                     │ HTTPS + SSL/TLS
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                 Supabase Cloud Platform                      │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         PostgreSQL Database                        │    │
│  │                                                    │    │
│  │  Tables:                                           │    │
│  │  - people                                          │    │
│  │  - conversation_entries                            │    │
│  │                                                    │    │
│  │  Views:                                            │    │
│  │  - storage_stats                                   │    │
│  │                                                    │    │
│  │  Features:                                         │    │
│  │  - Connection pooling (PgBouncer)                 │    │
│  │  - Row-Level Security (RLS)                       │    │
│  │  - Automatic backups (daily)                      │    │
│  │  - Point-in-time recovery                         │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### SupabaseStorageClient Implementation

The `SupabaseStorageClient` class (`src/services/supabaseStorageClient.ts`) provides a clean interface for database operations:

**Key Features**:
- Drop-in replacement for `FileStorageClient`
- Uses Supabase service role key for full database access
- Handles connection pooling automatically
- Converts between application `Person` objects and database tables
- Supports import/export for backup and migration

**Connection Management**:
- Persistent connection via `@supabase/supabase-js`
- Connection pooling handled by Supabase (PgBouncer)
- Automatic reconnection on network issues
- SSL/TLS encryption enforced (disabled only for local development with corporate proxies)

### Row-Level Security (RLS)

The database schema supports RLS policies for multi-tenant scenarios, but it is **disabled by default** for single-tenant deployments.

**Current Setup** (Single-Tenant):
- Service role key bypasses RLS
- All data accessible to the application

**Future Enhancement** (Multi-Tenant):
- Enable RLS policies per user/device
- Use anon key + JWT authentication
- Restrict data access by `user_id` column

---

## Database Schema

### Tables

#### `people` Table

Stores person information including voice biometric references.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `name` | TEXT | Person's name (unique, case-sensitive) |
| `speaker_id` | TEXT | Speaker identifier from audio processing (e.g., "A", "B") |
| `voice_reference` | TEXT | Base64-encoded audio clip (2-10 seconds) for voice recognition |
| `last_met` | TIMESTAMP WITH TIME ZONE | Last conversation timestamp |
| `created_at` | TIMESTAMP WITH TIME ZONE | Record creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | Last update timestamp (auto-updated via trigger) |

**Indexes**:
- `idx_people_name` - Fast lookups by name
- `idx_people_speaker_id` - Fast lookups by speaker ID
- `idx_people_last_met` - Sort by last met date (descending)

**Constraints**:
- `name` must be unique
- `id` is primary key (UUID)

#### `conversation_entries` Table

Stores individual conversation records linked to people.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `person_id` | UUID | Foreign key to `people.id` (cascade delete) |
| `date` | TIMESTAMP WITH TIME ZONE | Conversation timestamp |
| `transcript` | TEXT | Full conversation transcript |
| `topics` | TEXT[] | Array of conversation topics (e.g., `['project', 'deadline']`) |
| `key_points` | TEXT[] | Key points for quick context (e.g., `['Needs report by Friday']`) |
| `duration` | INTEGER | Conversation duration in seconds (optional) |
| `created_at` | TIMESTAMP WITH TIME ZONE | Record creation timestamp |

**Indexes**:
- `idx_conversations_person` - Fast lookups by person
- `idx_conversations_date` - Sort by date (descending)
- `idx_conversations_person_date` - Composite index for person + date queries

**Relationships**:
- `person_id` references `people.id` with `ON DELETE CASCADE`
  - Deleting a person automatically deletes all their conversations

#### `storage_stats` View

Provides aggregated statistics for the companion UI dashboard.

| Column | Type | Description |
|--------|------|-------------|
| `total_people` | BIGINT | Total number of people stored |
| `total_conversations` | BIGINT | Total number of conversation entries |
| `people_with_voices` | BIGINT | Number of people with voice references |
| `avg_conversations_per_person` | NUMERIC | Average conversations per person (rounded to 1 decimal) |

**Usage**:
```typescript
const stats = await supabaseClient.getStatsAsync();
console.log(`Total people: ${stats.totalPeople}`);
```

### Triggers and Functions

#### `update_updated_at_column()` Function

Automatically updates the `updated_at` timestamp when a row is modified.

**Trigger**: `update_people_updated_at`
- Fires before UPDATE on `people` table
- Sets `updated_at = NOW()`

---

## SupabaseStorageClient API

### Importing and Initialization

```typescript
import { SupabaseStorageClient, Person, ConversationEntry } from './services/supabaseStorageClient';

// Initialize client (reads SUPABASE_URL and SUPABASE_SERVICE_KEY from environment)
const storage = new SupabaseStorageClient();
```

**Environment Variables Required**:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Service role key (NOT anon key)

### Data Structures

```typescript
interface ConversationEntry {
  date: Date;
  transcript: string;
  topics: string[];
  keyPoints?: string[];
  duration?: number; // seconds
}

interface Person {
  name: string;
  speakerId: string;
  voiceReference?: string; // Base64 audio
  conversationHistory: ConversationEntry[];
  lastMet?: Date;
  // Deprecated fields (backward compatibility):
  lastConversation?: string;
  lastTopics?: string[];
}
```

### Methods

#### `storePerson(person: Person): Promise<void>`

Store or update a person's information.

**Behavior**:
- If person with same `name` exists: **UPDATE** (including speaker ID)
- If person doesn't exist: **INSERT** new person
- Replaces all conversation entries (deletes old, inserts new)

**Example**:
```typescript
await storage.storePerson({
  name: "John Smith",
  speakerId: "A",
  voiceReference: "base64_encoded_audio...",
  conversationHistory: [
    {
      date: new Date(),
      transcript: "Discussed project deadline and vacation plans",
      topics: ["project", "deadline", "vacation"],
      keyPoints: ["Needs report by Friday", "Budget approval pending"],
      duration: 320
    }
  ],
  lastMet: new Date()
});
```

**Console Output**:
```
✓ Stored John Smith (Speaker A)
```

#### `getPerson(speakerIdOrName: string): Promise<Person | null>`

Retrieve a person by speaker ID or name.

**Search Order**:
1. Try to find by `speaker_id` (exact match)
2. If not found, try by `name` (case-insensitive)

**Example**:
```typescript
// By speaker ID
const person = await storage.getPerson("A");

// By name (case-insensitive)
const person2 = await storage.getPerson("john smith");

// Not found
const notFound = await storage.getPerson("unknown"); // Returns null
```

**Returns**: `Person` object or `null` if not found

#### `findPersonByName(name: string): Promise<Person | null>`

Search for a person by name (case-insensitive).

**Example**:
```typescript
const person = await storage.findPersonByName("John");
// Matches "John Smith", "john smith", "JOHN SMITH", etc.
```

**Returns**: First matching `Person` or `null`

#### `getAllPeople(): Promise<Person[]>`

Get all stored people, sorted by last met date (most recent first).

**Example**:
```typescript
const everyone = await storage.getAllPeople();
console.log(`Total people: ${everyone.length}`);

everyone.forEach(person => {
  console.log(`${person.name} - Last met: ${person.lastMet}`);
});
```

**Returns**: Array of `Person` objects (empty array if no people stored)

#### `deletePerson(name: string): Promise<boolean>`

Delete a person by name (case-insensitive).

**Cascade Behavior**: Automatically deletes all associated conversations.

**Example**:
```typescript
const deleted = await storage.deletePerson("John Smith");
if (deleted) {
  console.log("Person deleted successfully");
}
```

**Returns**: `true` if deleted, `false` on error

**Console Output**:
```
Deleted person: John Smith
```

#### `clearAll(): Promise<void>`

Clear all stored data (both people and conversations).

**Warning**: This is destructive and cannot be undone. Use with caution!

**Example**:
```typescript
await storage.clearAll();
// All data deleted from database
```

**Console Output**:
```
All data cleared from storage
```

#### `getStatsAsync(): Promise<Stats>`

Get storage statistics asynchronously.

**Returns**:
```typescript
{
  totalPeople: number;
  totalConversations: number;
  peopleWithVoices: number;
  averageConversationsPerPerson: number;
}
```

**Example**:
```typescript
const stats = await storage.getStatsAsync();
console.log(`People: ${stats.totalPeople}`);
console.log(`Conversations: ${stats.totalConversations}`);
console.log(`With voices: ${stats.peopleWithVoices}`);
console.log(`Avg per person: ${stats.averageConversationsPerPerson.toFixed(1)}`);
```

#### `exportData(): Promise<string>`

Export all storage data to JSON string format.

**Use Cases**:
- Manual backups
- Data portability
- Debugging

**Example**:
```typescript
const jsonData = await storage.exportData();
fs.writeFileSync('backup.json', jsonData);
```

**Output Format**:
```json
{
  "people": {
    "person_john_smith": {
      "name": "John Smith",
      "speakerId": "A",
      "voiceReference": "base64...",
      "conversationHistory": [...]
    }
  },
  "version": "1.0.0",
  "lastModified": "2025-01-15T10:30:00.000Z",
  "source": "supabase"
}
```

#### `importData(jsonData: string): Promise<void>`

Import storage data from JSON string.

**Use Cases**:
- Restore from backup
- Migrate from FileStorageClient
- Import data from another instance

**Example**:
```typescript
const jsonData = fs.readFileSync('backup.json', 'utf-8');
await storage.importData(jsonData);
console.log("Data imported successfully");
```

**Behavior**: Stores each person (creates or updates existing)

#### `isReady(): boolean`

Check if storage is connected and ready.

**Example**:
```typescript
if (storage.isReady()) {
  console.log("Storage connected");
} else {
  console.error("Storage not ready");
}
```

**Returns**: `true` if connected, `false` otherwise

#### `disconnect(): void`

Cleanup connection (compatibility method).

**Example**:
```typescript
storage.disconnect();
```

### Deprecated Methods

#### `getStats()`

**Deprecated**: Use `getStatsAsync()` instead.

Returns placeholder values and logs a warning.

---

## Setup and Configuration

### Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in or create account
3. Click "New Project"
4. Choose organization and project name
5. Set database password (save securely!)
6. Select region (choose closest to users)
7. Click "Create new project" (takes ~2 minutes)

### Step 2: Run Database Schema

1. Open Supabase dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click "New Query"
4. Copy contents of `supabase/schema.sql`
5. Paste into editor
6. Click "Run" (or press Ctrl+Enter)
7. Verify success:
   - Check **Table Editor** for `people` and `conversation_entries` tables
   - Check **Database** → **Views** for `storage_stats` view

**Alternative (CLI)**:
```bash
# Install Supabase CLI
npm install -g supabase

# Link to project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### Step 3: Get API Credentials

1. Go to **Settings** → **API** in Supabase dashboard
2. Copy the following values:

   - **Project URL**: `https://xxxxx.supabase.co`
   - **Service Role Key** (secret): `eyJhbGc...` (long JWT token)

3. **Important**: Use the **service_role** key, NOT the **anon** key
   - Service role bypasses Row-Level Security
   - Required for full database access

### Step 4: Configure Environment Variables

#### Local Development

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Add Supabase credentials to `.env`:
   ```env
   # Supabase Configuration
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_KEY=eyJhbGc...your-service-role-key
   ```

3. Verify configuration:
   ```bash
   bun run dev
   # Should see: "Supabase Storage Client initialized"
   ```

#### Vercel Deployment

**Option 1: Vercel Dashboard**
1. Go to [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **Environment Variables**
4. Add two variables:
   - `SUPABASE_URL` = `https://xxxxx.supabase.co`
   - `SUPABASE_SERVICE_KEY` = `eyJhbGc...`
5. Set scope to **Production**, **Preview**, and **Development**
6. Save and redeploy

**Option 2: Vercel CLI**
```bash
# Install Vercel CLI
npm install -g vercel

# Add environment variables
vercel env add SUPABASE_URL
# Paste: https://xxxxx.supabase.co

vercel env add SUPABASE_SERVICE_KEY
# Paste: eyJhbGc...

# Deploy
vercel --prod
```

**Option 3: Automated Script**
```bash
npm run setup:vercel-env
```

This runs the `scripts/setup-vercel-env.sh` script which:
1. Reads `.env` file
2. Prompts for confirmation
3. Adds variables via Vercel CLI

#### Railway Deployment

1. Go to Railway dashboard
2. Select your project
3. Navigate to **Variables** tab
4. Add environment variables:
   - `SUPABASE_URL` = `https://xxxxx.supabase.co`
   - `SUPABASE_SERVICE_KEY` = `eyJhbGc...`
5. Save (Railway automatically redeploys)

### Step 5: Verify Connection

Run the application and check logs:

```bash
bun run dev
```

**Expected Output**:
```
Supabase Storage Client initialized
Connected to: https://xxxxx.supabase.co
```

**Error Output** (missing credentials):
```
╔════════════════════════════════════════════════════════════════╗
║          SUPABASE CONFIGURATION ERROR                          ║
╚════════════════════════════════════════════════════════════════╝

❌ Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY
```

### Connection Configuration

The `SupabaseStorageClient` constructor handles connection automatically:

```typescript
this.supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,  // Service role doesn't need token refresh
    persistSession: false      // No session storage needed
  }
});
```

**SSL Certificate Handling**:
- **Production**: SSL validation always enabled (secure)
- **Local Development**: Optionally disabled for corporate proxies/VPNs
  - Only when `NODE_TLS_REJECT_UNAUTHORIZED` env var is set
  - Never disabled on Railway or Vercel

---

## Data Migration

### Migration Script: `scripts/migrate-to-supabase.ts`

The migration script reads data from `data/memories.json` (FileStorageClient format) and imports it into Supabase.

### Prerequisites

1. Supabase project created
2. Database schema applied (`supabase/schema.sql`)
3. Environment variables set:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
4. Existing data file at `data/memories.json`

### Running the Migration

```bash
# Using Bun
bun run scripts/migrate-to-supabase.ts

# Using Node.js
npx tsx scripts/migrate-to-supabase.ts
```

### Migration Process

The script performs the following steps:

1. **Validate Prerequisites**
   - Check if `data/memories.json` exists
   - Verify Supabase credentials

2. **Read JSON Data**
   - Parse `data/memories.json`
   - Count people and conversations

3. **Display Migration Summary**
   ```
   Migration Summary:
   ─────────────────────────────────────────────────
     1. John Smith (Speaker A)
        └─ 3 conversation(s)
     2. Jane Doe (Speaker B)
        └─ 1 conversation(s)
   ─────────────────────────────────────────────────
   ```

4. **Connect to Supabase**
   - Initialize `SupabaseStorageClient`
   - Verify connection

5. **Migrate Each Person**
   - Store person with `storePerson()`
   - Handle old data formats (convert `lastConversation` to `conversationHistory`)
   - Ensure dates are Date objects

6. **Display Results**
   ```
   ═══════════════════════════════════════════════
   Migration Complete!
   ═══════════════════════════════════════════════
   ✓ Successfully migrated: 2 people
   ```

7. **Fetch Statistics**
   ```
   📊 Database Statistics:
   ─────────────────────────────────────────────────
     Total People: 2
     Total Conversations: 4
     People with Voice References: 2
     Avg Conversations per Person: 2.0
   ─────────────────────────────────────────────────
   ```

8. **Create Backup**
   - Copies `memories.json` to `memories.backup-{timestamp}.json`
   - Preserves original data

### Example Output

```
╔═════════════════════════════════════════════════╗
║   Nametag: File Storage → Supabase Migration    ║
╚═════════════════════════════════════════════════╝

✓ Found data file: ./data/memories.json
✓ Supabase credentials configured

Reading data from JSON file...
✓ Found 2 people to migrate

Migration Summary:
─────────────────────────────────────────────────
  1. John Smith (Speaker A)
     └─ 3 conversation(s)
  2. Jane Doe (Speaker B)
     └─ 1 conversation(s)
─────────────────────────────────────────────────

⚠️  This will INSERT all people into Supabase.
   Existing people with the same name will be UPDATED.

Connecting to Supabase...
✓ Connected to Supabase

Starting migration...

Migrating: John Smith...
  ✓ Migrated John Smith with 3 conversation(s)
Migrating: Jane Doe...
  ✓ Migrated Jane Doe with 1 conversation(s)

═══════════════════════════════════════════════
Migration Complete!
═══════════════════════════════════════════════
✓ Successfully migrated: 2 people

Fetching statistics from Supabase...

📊 Database Statistics:
─────────────────────────────────────────────────
  Total People: 2
  Total Conversations: 4
  People with Voice References: 2
  Avg Conversations per Person: 2.0
─────────────────────────────────────────────────

Creating backup of original file: ./data/memories.backup-1736944800000.json
✓ Backup created

✅ Migration completed successfully!
   You can now use the Supabase-backed companion UI.
```

### Backup and Restore Procedures

#### Manual Backup (Export from Supabase)

```typescript
import { SupabaseStorageClient } from './services/supabaseStorageClient';
import fs from 'fs';

const storage = new SupabaseStorageClient();
const jsonData = await storage.exportData();

// Save to file
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const filename = `backup-${timestamp}.json`;
fs.writeFileSync(filename, jsonData);

console.log(`Backup saved to ${filename}`);
```

**Automated Backup Script**:
```bash
#!/bin/bash
# Save as scripts/backup-supabase.sh

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup-$TIMESTAMP.json"

mkdir -p $BACKUP_DIR

bun run -e "
import { SupabaseStorageClient } from './src/services/supabaseStorageClient.ts';
import fs from 'fs';

const storage = new SupabaseStorageClient();
const data = await storage.exportData();
fs.writeFileSync('$BACKUP_FILE', data);
console.log('Backup saved to $BACKUP_FILE');
"
```

#### Manual Restore (Import to Supabase)

```typescript
import { SupabaseStorageClient } from './services/supabaseStorageClient';
import fs from 'fs';

const storage = new SupabaseStorageClient();
const jsonData = fs.readFileSync('./backup-20250115-103000.json', 'utf-8');

await storage.importData(jsonData);
console.log("Data restored successfully");
```

#### Supabase Dashboard Backup

Supabase provides **automatic daily backups** (requires paid plan):

1. Go to **Database** → **Backups** in Supabase dashboard
2. View backup history
3. Click "Restore" to restore from backup

**Point-in-Time Recovery** (PITR):
- Available on Pro plan and above
- Restore to any point in the last 7 days
- Go to **Database** → **Backups** → **Point in Time Recovery**

---

## Best Practices

### Security

#### 1. Use Service Role Key Securely

**DO**:
- Store service role key in environment variables
- Never commit `.env` file to git (add to `.gitignore`)
- Use different keys for development and production
- Rotate keys periodically

**DON'T**:
- Hardcode service role key in source code
- Share service role key in public repositories
- Use service role key in client-side code (browser)
- Expose service role key in logs

#### 2. Environment Separation

```env
# Development (.env)
SUPABASE_URL=https://dev-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...dev-key

# Production (.env.production)
SUPABASE_URL=https://prod-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...prod-key
```

Use separate Supabase projects for dev and production.

#### 3. Enable Row-Level Security (Future)

For multi-tenant scenarios:

```sql
-- Enable RLS
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_entries ENABLE ROW LEVEL SECURITY;

-- Create policy (example)
CREATE POLICY "Users can only access their own data"
ON people
FOR ALL
USING (user_id = auth.uid());
```

### Backup Strategies

#### 1. Automated Backups

**Supabase Built-in**:
- Automatic daily backups (paid plans)
- Point-in-time recovery (7-30 days)
- No configuration needed

**Custom Backup Script**:
```bash
# Run daily via cron
0 2 * * * /path/to/backup-supabase.sh
```

#### 2. Export Before Major Changes

```typescript
// Before migration or major update
const backup = await storage.exportData();
fs.writeFileSync('./pre-migration-backup.json', backup);
```

#### 3. Multi-Region Backups

Store backups in multiple locations:
- Local filesystem
- Cloud storage (S3, Google Cloud Storage)
- Version control (encrypted)

### Monitoring Database Usage

#### 1. Supabase Dashboard

Monitor in **Settings** → **Usage**:
- Database size (MB)
- Active connections
- Database egress (bandwidth)
- Queries per second

#### 2. Application Metrics

```typescript
// Log storage statistics periodically
setInterval(async () => {
  const stats = await storage.getStatsAsync();
  console.log('Storage stats:', stats);
}, 3600000); // Every hour
```

#### 3. Set Up Alerts

Supabase Pro plan supports alerts:
- Database size exceeds threshold
- Too many active connections
- Slow queries detected

### Performance Optimization

#### 1. Use Indexes Effectively

The schema includes indexes for common queries:
- `idx_people_name` - Lookup by name
- `idx_people_speaker_id` - Lookup by speaker ID
- `idx_conversations_person_date` - Composite index for person + date

**Query Optimization**:
```typescript
// Fast (uses index)
await storage.getPerson("A"); // By speaker_id

// Fast (uses index)
await storage.findPersonByName("John"); // By name

// Fast (uses index)
await storage.getAllPeople(); // Sorted by last_met
```

#### 2. Batch Operations

When importing large datasets:

```typescript
// Import in batches instead of one-by-one
const people = [...]; // Large array
const batchSize = 10;

for (let i = 0; i < people.length; i += batchSize) {
  const batch = people.slice(i, i + batchSize);
  await Promise.all(batch.map(p => storage.storePerson(p)));
}
```

#### 3. Minimize Connection Overhead

Reuse the same `SupabaseStorageClient` instance:

```typescript
// Good: Single instance
const storage = new SupabaseStorageClient();

// Use throughout application lifecycle
await storage.storePerson(person1);
await storage.storePerson(person2);

// Bad: Creating new instance each time
await new SupabaseStorageClient().storePerson(person1); // Slow!
```

#### 4. Use Connection Pooling

Supabase automatically uses PgBouncer for connection pooling. No configuration needed.

---

## Troubleshooting

### Common Connection Issues

#### Problem: `Supabase credentials not configured`

**Error Message**:
```
╔════════════════════════════════════════════════════════════════╗
║          SUPABASE CONFIGURATION ERROR                          ║
╚════════════════════════════════════════════════════════════════╝

❌ Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY
```

**Solution**:
1. Check if `.env` file exists
2. Verify variables are set:
   ```bash
   cat .env | grep SUPABASE
   ```
3. Ensure no typos in variable names
4. Restart application after adding variables

#### Problem: `Invalid JWT token`

**Error Message**:
```
Error: Invalid JWT token
```

**Solution**:
- Verify you're using the **service_role** key, not **anon** key
- Go to Supabase dashboard → **Settings** → **API**
- Copy the "service_role" key (longer JWT token)
- Update `SUPABASE_SERVICE_KEY` in `.env`

#### Problem: `Connection timeout`

**Error Message**:
```
Error: FetchError: request to https://xxxxx.supabase.co/rest/v1/people failed, reason: connect ETIMEDOUT
```

**Solution**:
1. Check internet connection
2. Verify Supabase project is running (dashboard shows "Active")
3. Check if behind a firewall/corporate proxy:
   ```bash
   curl https://xxxxx.supabase.co/rest/v1/
   ```
4. Verify no VPN blocking Supabase domains

### SSL Certificate Problems

#### Problem: `unable to verify the first certificate`

**Error Message**:
```
Error: unable to verify the first certificate
```

**Cause**: Corporate proxy or antivirus software intercepting SSL traffic

**Solution (Local Development Only)**:
```bash
# Set environment variable (Windows PowerShell)
$env:NODE_TLS_REJECT_UNAUTHORIZED="0"

# Set environment variable (Windows CMD)
set NODE_TLS_REJECT_UNAUTHORIZED=0

# Set environment variable (Linux/Mac)
export NODE_TLS_REJECT_UNAUTHORIZED=0

# Then run app
bun run dev
```

**Warning**: Never disable SSL validation in production!

**Permanent Fix**:
Add to `.env` (local development only):
```env
NODE_TLS_REJECT_UNAUTHORIZED=0
```

The `SupabaseStorageClient` automatically disables SSL validation only in local development when this variable is set.

### Row-Level Security (RLS) Issues

#### Problem: `new row violates row-level security policy`

**Error Message**:
```
Error: new row violates row-level security policy for table "people"
```

**Cause**: RLS is enabled and service role key is not being used correctly

**Solution**:
1. Verify using **service_role** key (not anon key)
2. Check RLS policies in Supabase dashboard:
   - Go to **Authentication** → **Policies**
   - Verify policies allow service role access
3. If RLS not needed, disable it:
   ```sql
   ALTER TABLE people DISABLE ROW LEVEL SECURITY;
   ALTER TABLE conversation_entries DISABLE ROW LEVEL SECURITY;
   ```

### Performance Issues

#### Problem: Slow queries

**Symptoms**:
- `storePerson()` takes several seconds
- `getAllPeople()` times out

**Diagnosis**:
```sql
-- Check active connections
SELECT * FROM pg_stat_activity;

-- Check slow queries
SELECT * FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Solutions**:
1. **Check database size**: Go to Supabase dashboard → **Settings** → **Usage**
   - Upgrade plan if exceeding limits
2. **Add indexes**: Analyze query patterns and add indexes
3. **Optimize queries**: Reduce data fetched (select specific columns)
4. **Use pagination**: Don't load all people at once
   ```typescript
   // Instead of getAllPeople(), paginate:
   const { data } = await supabase
     .from('people')
     .select('*')
     .range(0, 19); // First 20 people
   ```

#### Problem: Too many connections

**Error Message**:
```
Error: remaining connection slots are reserved
```

**Solution**:
1. **Check for connection leaks**: Ensure you're reusing `SupabaseStorageClient` instance
2. **Upgrade Supabase plan**: Free plan has connection limits
3. **Use connection pooling**: Already enabled by default (PgBouncer)

### Migration Issues

#### Problem: `ENOENT: no such file or directory, open 'data/memories.json'`

**Error in Migration Script**:
```
❌ No data file found at data/memories.json
   Nothing to migrate. Exiting.
```

**Solution**:
- Check if `data/memories.json` exists
- If migrating from fresh install, no migration needed
- If data exists elsewhere, update `DATA_FILE` path in migration script

#### Problem: `Failed to migrate person`

**Error Message**:
```
❌ Failed to migrate John Smith: Error: Invalid date
```

**Solution**:
- Check data format in `memories.json`
- Ensure dates are valid ISO 8601 strings
- Migration script handles date conversion automatically

### Debug Mode

Enable detailed logging:

```typescript
// Add to SupabaseStorageClient constructor
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    headers: {
      'x-debug': 'true'
    }
  }
});
```

Check Supabase logs:
- Go to **Logs** → **Postgres Logs** in dashboard
- Filter by time range
- Look for errors

---

## Additional Resources

### Documentation

- **Supabase Docs**: [https://supabase.com/docs](https://supabase.com/docs)
- **PostgreSQL Docs**: [https://www.postgresql.org/docs/](https://www.postgresql.org/docs/)
- **Supabase JavaScript Client**: [https://supabase.com/docs/reference/javascript](https://supabase.com/docs/reference/javascript)

### Tools

- **Supabase Dashboard**: [https://supabase.com/dashboard](https://supabase.com/dashboard)
- **Supabase CLI**: [https://supabase.com/docs/guides/cli](https://supabase.com/docs/guides/cli)
- **SQL Editor**: Available in Supabase dashboard

### Support

- **Supabase Discord**: [https://discord.supabase.com](https://discord.supabase.com)
- **Supabase GitHub**: [https://github.com/supabase/supabase](https://github.com/supabase/supabase)
- **Stack Overflow**: Tag `supabase`

---

## Summary

The Nametag smart glasses app uses **Supabase PostgreSQL** for reliable, scalable cloud storage:

- **Simple setup**: Create project, run schema, add credentials
- **Drop-in replacement**: Same interface as FileStorageClient
- **Automatic backups**: Daily backups with point-in-time recovery
- **Scalable**: Handles multiple users and devices
- **Secure**: SSL/TLS encryption, Row-Level Security support
- **Easy migration**: Automated script for FileStorageClient → Supabase

For questions or issues, refer to the [Troubleshooting](#troubleshooting) section or contact support.
