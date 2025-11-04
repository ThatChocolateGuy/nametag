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

### Mobile Access (MentraOS App)

Want to access the companion UI from your phone? See the **[Mobile Access Guide](./COMPANION_UI_MOBILE_ACCESS.md)** for complete setup instructions.

**Quick Summary**:
1. Expose companion UI with ngrok on port 3001
2. Configure "Webview URL" in MentraOS console
3. Access from MentraOS mobile app

This allows you to view and manage your contacts directly from your phone without needing a computer.

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
    "storageType": "Supabase PostgreSQL",
    "databaseSize": "1.2 MB",
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

# Supabase Configuration (REQUIRED)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key_here
```

### Port Configuration

The companion UI runs on a **different port** than the main app:
- **Main app (glasses)**: Port 3000 (or your configured PORT)
- **Companion UI**: Port 3001 (or your configured WEB_PORT)

This allows both to run simultaneously.

## Running Both Services

### Production (Recommended)

**Main App**: Deployed to Railway
- Automatically running at your Railway URL
- Connect glasses via MentraOS console

**Companion UI**: Deploy to Vercel
```bash
# Deploy companion UI
cd smartglasses-memory-app
vercel

# Set environment variables in Vercel dashboard:
# - SUPABASE_URL
# - SUPABASE_KEY
# - MENTRAOS_API_KEY
# - COOKIE_SECRET
```

**Access**: Visit your Vercel URL to manage contacts from anywhere

### Local Development

#### Option 1: Separate Terminals

```bash
# Terminal 1: Main app for glasses
cd smartglasses-memory-app
bun run dev

# Terminal 2: Companion UI
bun run dev:web

# Terminal 3: ngrok (optional, for remote testing)
ngrok http 3000
```

#### Option 2: Background Processes (Linux/Mac)

```bash
# Start main app in background
bun run dev &

# Start companion UI in background
bun run dev:web &
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
1. Supabase connection is working
2. `SUPABASE_URL` and `SUPABASE_KEY` are set correctly
3. Database tables exist (run migrations)
4. Network connectivity to Supabase

**Solution**:
```bash
# Test Supabase connection
curl https://your-project.supabase.co/rest/v1/ \
  -H "apikey: your_anon_key"

# Run database migrations
npx supabase db push

# Check Supabase dashboard for data
```

### Changes not saving

**Check**:
1. Supabase connection is stable
2. API keys have write permissions
3. No row-level security blocking writes
4. Database isn't at storage limit

**Solution**:
1. Verify API key permissions in Supabase dashboard
2. Check Supabase logs for errors
3. Review row-level security policies
4. Check database usage and limits

## Development

### File Structure

```
smartglasses-memory-app/
├── src/
│   ├── webserver.ts          # Express server + API routes
│   └── services/
│       └── supabaseStorageClient.ts  # Database connection
├── public/
│   ├── index.html            # Main UI
│   ├── css/
│   │   └── style.css         # Styles
│   └── js/
│       └── app.js            # Frontend logic
├── supabase/
│   └── migrations/           # Database schema
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

- Search is server-side (SQL query, fast for any number of people)
- Conversation history loaded from database with pagination support
- Export feature works efficiently with Supabase streaming

### Data Management

- **Backup Regularly**: Use the export feature
- **Clean Old Data**: Delete people you no longer need
- **Add Notes**: Use manual notes to supplement automated tracking

### Privacy

- Data stored securely in Supabase with encryption at rest
- Row-level security policies protect your data
- Only accessible with your authentication credentials
- Delete people to permanently remove all their data
- Automatic backups for data recovery

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
