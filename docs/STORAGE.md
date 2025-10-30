# Storage Options

This app supports two storage backends for person data:

## 1. Memory MCP Server (Default)

**Status**: ⚠️ Currently blocked by SSE timeout issue

Cloud-based persistence using Memory MCP protocol.

**Pros**:

- Centralized storage
- Accessible from multiple devices
- Built-in search capabilities
- No local file management

**Cons**:

- Requires network connectivity
- SSE connection currently timing out
- External dependency

**Configuration**:

```env
MEMORY_MCP_URL=https://memory.mcpgenerator.com/{uuid}/sse
```

## 2. File Storage (Recommended Alternative)

Local JSON file storage at `./data/memories.json`

**Pros**:

- Works immediately, no network required
- Simple and reliable
- Easy to backup/export
- No external dependencies
- Fast performance

**Cons**:

- Local only (not synced across devices)
- Manual backup required
- Limited to single machine

**Storage Location**:

```md
smartglasses-memory-app/
└── data/
    └── memories.json
```

## Switching Storage Backends

### Option 1: Environment Variable (Coming Soon)

```env
# In .env
STORAGE_BACKEND=file  # or 'mcp'
```

### Option 2: Code Change (Current Method)

Edit `src/index.ts`:

**Use File Storage**:

```typescript
// Line 7-8 - Comment out MemoryClient, import FileStorageClient
// import { MemoryClient } from './services/memoryClient';
import { FileStorageClient as MemoryClient } from './services/fileStorageClient';

// Line 34 - Change initialization
this.memoryClient = new MemoryClient('./data');  // Path to data directory
```

**Use Memory MCP**:

```typescript
// Line 7-8 - Use MemoryClient
import { MemoryClient } from './services/memoryClient';
// import { FileStorageClient as MemoryClient } from './services/fileStorageClient';

// Line 34 - Change initialization
this.memoryClient = new MemoryClient(MEMORY_MCP_URL);
```

## File Storage Data Format

```json
{
  "people": {
    "person_Speaker A": {
      "name": "John Smith",
      "speakerId": "Speaker A",
      "lastConversation": "Discussed project deadline and vacation plans",
      "lastTopics": ["project", "deadline", "vacation"],
      "lastMet": "2025-10-25T19:30:00.000Z"
    },
    "person_Speaker B": {
      "name": "Sarah Johnson",
      "speakerId": "Speaker B",
      "lastConversation": "Talked about team collaboration",
      "lastTopics": ["teamwork", "collaboration"],
      "lastMet": "2025-10-25T19:35:00.000Z"
    }
  },
  "version": "1.0.0",
  "lastModified": "2025-10-25T19:35:30.000Z"
}
```

## File Storage Operations

### View Stored Data

```bash
# Pretty print the JSON file
cat data/memories.json | jq .

# Or on Windows
type data\memories.json
```

### Backup Data

```bash
# Create timestamped backup
cp data/memories.json data/backup-$(date +%Y%m%d-%H%M%S).json

# Or on Windows
copy data\memories.json data\backup-%date:~-4,4%%date:~-10,2%%date:~-7,2%-%time:~0,2%%time:~3,2%%time:~6,2%.json
```

### Restore from Backup

```bash
# Restore from specific backup
cp data/backup-20251025-193000.json data/memories.json
```

### Export Data

```bash
# Copy to another location
cp data/memories.json ~/Dropbox/backups/
```

### Clear All Data

```bash
# Delete the file (will be recreated on next run)
rm data/memories.json

# Or on Windows
del data\memories.json
```

## API Methods (Both Backends)

Both `MemoryClient` and `FileStorageClient` implement the same interface:

```typescript
// Store a person
await memoryClient.storePerson({
  name: "John Smith",
  speakerId: "Speaker A",
  lastConversation: "Discussed project",
  lastTopics: ["project", "deadline"],
  lastMet: new Date()
});

// Retrieve by speaker ID
const person = await memoryClient.getPerson("Speaker A");
// Returns: Person object or null

// Find by name (case-insensitive)
const found = await memoryClient.findPersonByName("John");
// Returns: Person object or null
```

### File Storage Exclusive Methods

```typescript
import { FileStorageClient } from './services/fileStorageClient';

const storage = new FileStorageClient('./data');

// Get all people
const everyone = await storage.getAllPeople();
// Returns: Person[]

// Delete person
await storage.deletePerson("Speaker A");

// Clear all data
await storage.clearAll();

// Get statistics
const stats = storage.getStats();
// Returns: { totalPeople, filePath, fileSize }

// Export to JSON string
const json = storage.exportData();

// Import from JSON string
storage.importData(jsonString);

// Check if ready
const ready = storage.isReady();
// Returns: boolean
```

## Production Recommendations

For production deployments, consider:

### Option 1: Database Storage

Replace file storage with a proper database:

- **PostgreSQL** - Robust, ACID compliant
- **MongoDB** - Flexible schema, good for person data
- **SQLite** - Simple, serverless, file-based
- **Supabase** - PostgreSQL with REST API

**Example (PostgreSQL)**:

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async storePerson(person: Person): Promise<void> {
  await pool.query(
    'INSERT INTO people (name, speaker_id, last_conversation, last_topics, last_met) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (speaker_id) DO UPDATE SET name = $1, last_conversation = $3, last_topics = $4, last_met = $5',
    [person.name, person.speakerId, person.lastConversation, person.lastTopics, person.lastMet]
  );
}
```

### Option 2: Cloud Storage

Use cloud storage services:

- **AWS S3** - Scalable object storage
- **Google Cloud Storage** - Similar to S3
- **Azure Blob Storage** - Microsoft cloud storage

### Option 3: Hybrid Approach

Use both local and cloud storage:

```typescript
class HybridStorage {
  constructor(
    private local: FileStorageClient,
    private cloud: CloudStorage
  ) {}

  async storePerson(person: Person): Promise<void> {
    // Store locally first (fast)
    await this.local.storePerson(person);

    // Sync to cloud in background
    this.cloud.storePerson(person).catch(err => {
      console.warn('Cloud sync failed:', err);
    });
  }
}
```

## Security Considerations

### File Storage Security

1. **File Permissions**:

   ```bash
   # Restrict access to data directory
   chmod 700 data/
   chmod 600 data/memories.json
   ```

2. **Encryption at Rest**:
   - Use file system encryption (BitLocker, FileVault)
   - Or encrypt data before writing:

   ```typescript
   import crypto from 'crypto';

   function encrypt(text: string, password: string): string {
     const cipher = crypto.createCipher('aes-256-cbc', password);
     return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
   }
   ```

3. **Backup Encryption**:

   ```bash
   # Encrypt backup with gpg
   gpg -c data/memories.json
   # Creates: data/memories.json.gpg
   ```

### Memory MCP Security

1. Keep UUID secret (treat like API key)
2. Use HTTPS only (never HTTP)
3. Implement rate limiting
4. Monitor for unauthorized access

## Migration Between Backends

### Memory MCP → File Storage

1. Export from Memory MCP (when SSE works):

   ```typescript
   const memories = await mcpClient.getAllMemories();
   const fileClient = new FileStorageClient('./data');

   for (const memory of memories) {
     const person = JSON.parse(memory.content);
     await fileClient.storePerson(person);
   }
   ```

2. Verify migration:

   ```bash
   cat data/memories.json | jq '.people | length'
   ```

### File Storage → Memory MCP

1. Export file storage:

   ```typescript
   const fileClient = new FileStorageClient('./data');
   const people = await fileClient.getAllPeople();

   const mcpClient = new MemoryClient(MEMORY_MCP_URL);
   for (const person of people) {
     await mcpClient.storePerson(person);
   }
   ```

2. Verify migration:

   ```bash
   curl -k "https://memory.mcpgenerator.com/{uuid}/memories"
   ```

## Troubleshooting

### File Storage Issues

**Problem**: `ENOENT: no such file or directory`
**Solution**: Data directory doesn't exist

```bash
mkdir -p data
```

**Problem**: `EACCES: permission denied`
**Solution**: Fix permissions

```bash
chmod 755 data/
chmod 644 data/memories.json
```

**Problem**: Corrupted JSON file
**Solution**: Restore from backup or delete and reinitialize

```bash
rm data/memories.json
# Will be recreated on next app start
```

### Memory MCP Issues

**Problem**: SSE timeout
**Solution**: Use file storage alternative (recommended)

**Problem**: 404 errors
**Solution**: Verify Memory MCP URL is correct

## Performance Comparison

| Feature | File Storage | Memory MCP |
|---------|-------------|------------|
| Latency | < 1ms | 50-200ms |
| Reliability | ★★★★★ | ★★★☆☆ (SSE issues) |
| Setup | Immediate | Requires URL |
| Multi-device | ❌ | ✅ |
| Backup | Manual | Automatic |
| Search | Fast (in-memory) | Fast (server-side) |
| Scalability | Limited | High |

## Recommendations

**Development**: Use file storage

- Fast, reliable, easy debugging
- No network dependencies
- Simple backup/restore

**Production (Single User)**: Use file storage

- Most reliable option
- Easy to backup
- No external dependencies

**Production (Multi-User/Device)**: Use database

- PostgreSQL or MongoDB
- Proper multi-user support
- ACID transactions

**Production (Enterprise)**: Use cloud database

- AWS RDS, Google Cloud SQL
- Automatic backups
- High availability
- Scalability

## Future Enhancements

1. **Auto-sync**: Periodic background sync between local and cloud
2. **Conflict resolution**: Merge changes when syncing
3. **Compression**: Reduce file size with gzip
4. **Encryption**: Built-in encryption at rest
5. **Versioning**: Track history of changes
6. **Search**: Full-text search across all people
7. **Analytics**: Usage statistics and insights
