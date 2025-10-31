# Companion UI Guide

The Nametag Companion UI is a web-based interface that allows you to view, manage, and edit the people you've met through your G1 smart glasses.

## Features

### Dashboard View
- See all people you've met at a glance
- Search and filter by name
- View key statistics (total people, conversations, voice profiles)
- Export all data as JSON

### Person Management
- View detailed conversation history
- See all past conversations with timestamps
- Review key points and topics from each conversation
- Add manual notes to any person
- Delete people from your memory

### Voice Profile Indicators
- See which people have voice profiles saved
- Voice profiles enable automatic recognition on next meeting

## Getting Started

### Prerequisites
- Nametag main app running (stores the data)
- MentraOS account (for authentication)

### Running the Companion UI

1. **Start the web server**:

   ```bash
   # Development mode with hot reload
   bun run dev:web

   # Or production mode
   bun run web
   ```

2. **Access the interface**:
   - Open your browser to `http://localhost:3001`
   - You'll be prompted to authenticate via MentraOS

3. **Authentication**:
   - The companion UI uses MentraOS webview authentication
   - You'll receive a temporary token via query parameter
   - Token is exchanged for a secure session cookie
   - Session lasts 7 days

## Using the Interface

### Dashboard

**Stats Bar**:
- **People**: Total number of people you've met
- **Conversations**: Total conversations across all people
- **Voices**: Number of people with voice profiles

**Search**:
- Type in the search box to filter people by name
- Search is case-insensitive and instant

**Toolbar Actions**:
- **🔄 Refresh**: Reload data from storage
- **📥 Export**: Download all data as JSON

### Person Cards

Each person card shows:
- Name and speaker ID
- Voice profile indicator (🎤 if saved)
- Number of conversations
- When you last met
- Summary of most recent conversation
- Up to 3 key points from last meeting

Click any card to view full details.

### Person Detail Modal

**Information Section**:
- Speaker ID
- Last met timestamp
- Total conversation count
- Voice profile status

**Conversation History**:
- All conversations in reverse chronological order (most recent first)
- Each conversation shows:
  - Date and time
  - Full transcript/summary
  - Topics discussed
  - Key points extracted

**Add Manual Note**:
- Type a note in the text area
- Click "Add Note" to save
- Note appears as a new conversation entry
- Useful for adding context you remember later

**Delete Person**:
- Permanently removes person from storage
- Confirmation required
- Cannot be undone

## API Endpoints

The companion UI uses these REST API endpoints:

### GET `/api/people`
Get all stored people

**Response**:
```json
{
  "success": true,
  "people": [
    {
      "name": "John Smith",
      "speakerId": "A",
      "voiceReference": "base64...",
      "conversationHistory": [...],
      "lastMet": "2025-01-30T12:00:00.000Z"
    }
  ]
}
```

### GET `/api/people/:name`
Get a specific person by name

**Response**:
```json
{
  "success": true,
  "person": { ... }
}
```

### PUT `/api/people/:name`
Update a person's information

**Request Body**:
```json
{
  "conversationHistory": [...]
}
```

### DELETE `/api/people/:name`
Delete a person

**Response**:
```json
{
  "success": true,
  "message": "Person deleted"
}
```

### POST `/api/people/:name/notes`
Add a manual note to a person

**Request Body**:
```json
{
  "note": "Remember to ask about vacation plans"
}
```

### GET `/api/stats`
Get storage statistics

**Response**:
```json
{
  "success": true,
  "stats": {
    "totalPeople": 10,
    "filePath": "./data/memories.json",
    "fileSize": 12345,
    "totalConversations": 25,
    "peopleWithVoices": 8,
    "averageConversationsPerPerson": "2.5"
  }
}
```

### GET `/api/export`
Export all data as JSON file

Downloads `nametag-export-{timestamp}.json`

### GET `/health`
Health check (no authentication required)

**Response**:
```json
{
  "status": "ok",
  "storage": true
}
```

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Web server port (default: 3001)
WEB_PORT=3001

# Cookie secret for session management (CHANGE IN PRODUCTION!)
COOKIE_SECRET=your-secret-key-here

# Required (already in .env for main app)
MENTRAOS_API_KEY=your_api_key
PACKAGE_NAME=your_package_name
```

### Port Configuration

The companion UI runs on a **different port** than the main app:
- **Main app (glasses)**: Port 3000 (or your configured PORT)
- **Companion UI**: Port 3001 (or your configured WEB_PORT)

This allows both to run simultaneously.

## Running Both Services

### Option 1: Separate Terminals

```bash
# Terminal 1: Main app for glasses
cd smartglasses-memory-app
bun run dev

# Terminal 2: Companion UI
bun run dev:web

# Terminal 3: ngrok (for main app only)
ngrok http --url=your-domain.ngrok-free.app 3000
```

### Option 2: Background Processes (Linux/Mac)

```bash
# Start main app in background
bun run dev &

# Start companion UI in background
bun run dev:web &

# Start ngrok
ngrok http --url=your-domain.ngrok-free.app 3000
```

## Security Considerations

### Authentication

- MentraOS webview authentication ensures only authorized users access the UI
- Session cookies are HTTP-only and secure (in production)
- Sessions expire after 7 days

### Production Deployment

Before deploying to production:

1. **Change Cookie Secret**:
   ```env
   COOKIE_SECRET=use-a-strong-random-string-here
   ```
   Generate with: `openssl rand -base64 32`

2. **Enable HTTPS**:
   - Set `NODE_ENV=production`
   - Use reverse proxy (nginx/Apache)
   - Get SSL certificate (Let's Encrypt)

3. **Restrict Access**:
   - Use firewall rules
   - Only expose necessary ports
   - Consider VPN for internal use

4. **Rate Limiting**:
   Add rate limiting middleware to prevent abuse

## Troubleshooting

### UI won't load

**Check**:
1. Web server is running: `bun run dev:web`
2. Correct port: `http://localhost:3001`
3. No other service on port 3001

**Solution**:
```bash
# Check what's on port 3001
netstat -ano | findstr :3001  # Windows
lsof -i :3001                 # Mac/Linux

# Change port if needed
WEB_PORT=3002 bun run dev:web
```

### Authentication fails

**Check**:
1. `MENTRAOS_API_KEY` is set correctly
2. `PACKAGE_NAME` matches your app
3. `COOKIE_SECRET` is set

**Solution**: Verify `.env` file has all required variables

### Data not showing

**Check**:
1. Main app has created data in `./data/memories.json`
2. File permissions are correct
3. Main app and web server use same data directory

**Solution**:
```bash
# Verify data file exists
ls -la data/memories.json

# Check contents
cat data/memories.json
```

### Changes not saving

**Check**:
1. Write permissions on `./data/` directory
2. Disk space available
3. No file locks

**Solution**:
```bash
# Fix permissions (Linux/Mac)
chmod 755 data/
chmod 644 data/memories.json

# Check disk space
df -h
```

## Development

### File Structure

```
smartglasses-memory-app/
├── src/
│   └── webserver.ts          # Express server + API routes
├── public/
│   ├── index.html            # Main UI
│   ├── css/
│   │   └── style.css         # Styles
│   └── js/
│       └── app.js            # Frontend logic
└── docs/
    └── COMPANION_UI.md       # This file
```

### Adding New Features

#### Add New API Endpoint

Edit `src/webserver.ts`:

```typescript
app.get('/api/custom-endpoint', authMiddleware, async (req, res) => {
  try {
    // Your logic here
    res.json({ success: true, data: ... });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

#### Add New UI Component

Edit `public/js/app.js`:

```javascript
async function myNewFeature() {
  const response = await apiRequest('/custom-endpoint');
  // Handle response
}
```

Update HTML in `public/index.html` as needed.

### Testing

1. **Manual Testing**:
   ```bash
   # Start web server
   bun run dev:web

   # Open browser
   open http://localhost:3001
   ```

2. **API Testing with curl**:
   ```bash
   # Health check
   curl http://localhost:3001/health

   # Get people (with auth cookie)
   curl http://localhost:3001/api/people \
     -H "Cookie: aos_session=your_session_cookie"
   ```

## Tips & Best Practices

### Performance

- Search is client-side (fast for < 1000 people)
- Conversation history is paginated in UI (loads all but displays efficiently)
- Export feature works well up to ~10MB of data

### Data Management

- **Backup Regularly**: Use the export feature
- **Clean Old Data**: Delete people you no longer need
- **Add Notes**: Use manual notes to supplement automated tracking

### Privacy

- Companion UI runs locally (no cloud sync)
- Data never leaves your machine unless you export it
- Delete people to remove all their data

## Future Enhancements

Planned features for future versions:

1. **Bulk Operations**
   - Select multiple people
   - Bulk delete
   - Bulk export

2. **Advanced Search**
   - Search by topics
   - Search conversation content
   - Filter by date range

3. **Analytics**
   - Conversation trends
   - Most frequent contacts
   - Topic analysis

4. **Integrations**
   - Export to contacts app
   - Sync with calendar
   - Integration with CRM

## Support

For issues or questions:
- **GitHub Issues**: [Report bugs](https://github.com/ThatChocolateGuy/nametag/issues)
- **Documentation**: Check other docs in `./docs/`
- **MentraOS**: [Discord support](https://discord.gg/mentra)

---

**Built with love for the G1 community** 👓✨
