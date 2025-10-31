# Storage

This app uses local JSON file storage for person data and conversation history.

## File Storage

Local JSON file storage at `./data/memories.json`

**Benefits**:
- Works immediately, no network required
- Simple and reliable
- Easy to backup/export
- No external dependencies
- Fast performance

**Storage Location**:

```
smartglasses-memory-app/
└── data/
    └── memories.json
```

## File Storage Data Format

```json
{
  "people": {
    "person_john_smith": {
      "name": "John Smith",
      "speakerId": "A",
      "voiceReference": "base64_encoded_audio_clip...",
      "conversationHistory": [
        {
          "date": "2025-10-25T19:30:00.000Z",
          "transcript": "Discussed project deadline and vacation plans",
          "topics": ["project", "deadline", "vacation"],
          "keyPoints": [
            "Needs report by Friday",
            "Budget approval pending",
            "Team meeting scheduled"
          ],
          "duration": 320
        }
      ],
      "lastMet": "2025-10-25T19:30:00.000Z"
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
copy data\memories.json data\backup.json
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

## API Methods

The `FileStorageClient` provides these methods:

```typescript
import { FileStorageClient } from './services/fileStorageClient';

const storage = new FileStorageClient('./data');

// Store a person
await storage.storePerson({
  name: "John Smith",
  speakerId: "A",
  voiceReference: "base64_audio...",
  conversationHistory: [],
  lastMet: new Date()
});

// Retrieve by speaker ID or name
const person = await storage.getPerson("A");
// Returns: Person object or null

// Find by name (case-insensitive)
const found = await storage.findPersonByName("John");
// Returns: Person object or null

// Get all people
const everyone = await storage.getAllPeople();
// Returns: Person[]

// Delete person
await storage.deletePerson("John Smith");

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
    'INSERT INTO people (name, speaker_id, voice_reference, conversation_history, last_met) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (speaker_id) DO UPDATE SET name = $1, voice_reference = $3, conversation_history = $4, last_met = $5',
    [person.name, person.speakerId, person.voiceReference, JSON.stringify(person.conversationHistory), person.lastMet]
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
