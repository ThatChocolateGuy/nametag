import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { FileStorageClient, Person } from './services/fileStorageClient';
import { createAuthMiddleware } from '@mentra/sdk';

// Environment variables
const MENTRAOS_API_KEY = process.env.MENTRAOS_API_KEY ?? (() => { throw new Error('MENTRAOS_API_KEY is not set'); })();
const PACKAGE_NAME = process.env.PACKAGE_NAME ?? (() => { throw new Error('PACKAGE_NAME is not set'); })();
const WEB_PORT = parseInt(process.env.WEB_PORT || '3001');
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'change-this-secret-in-production';

// Initialize storage client
const storageClient = new FileStorageClient('./data');

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// MentraOS authentication middleware
const authMiddleware = createAuthMiddleware({
  apiKey: MENTRAOS_API_KEY,
  packageName: PACKAGE_NAME,
  cookieSecret: COOKIE_SECRET,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
});

// API Routes

/**
 * GET /api/people
 * Get all stored people
 */
app.get('/api/people', authMiddleware, async (req: Request, res: Response) => {
  try {
    const people = await storageClient.getAllPeople();

    // Sort by most recent conversation
    const sorted = people.sort((a, b) => {
      const dateA = a.lastMet || new Date(0);
      const dateB = b.lastMet || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

    res.json({ success: true, people: sorted });
  } catch (error) {
    console.error('Error fetching people:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch people' });
  }
});

/**
 * GET /api/people/:name
 * Get a specific person by name
 */
app.get('/api/people/:name', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const person = await storageClient.findPersonByName(name);

    if (!person) {
      return res.status(404).json({ success: false, error: 'Person not found' });
    }

    res.json({ success: true, person });
  } catch (error) {
    console.error('Error fetching person:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch person' });
  }
});

/**
 * PUT /api/people/:name
 * Update a person's information
 */
app.put('/api/people/:name', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const person = await storageClient.findPersonByName(name);

    if (!person) {
      return res.status(404).json({ success: false, error: 'Person not found' });
    }

    // Update allowed fields
    const updates: Partial<Person> = {};
    if (req.body.conversationHistory) updates.conversationHistory = req.body.conversationHistory;

    // Merge updates
    const updated: Person = { ...person, ...updates };

    await storageClient.storePerson(updated);

    res.json({ success: true, person: updated });
  } catch (error) {
    console.error('Error updating person:', error);
    res.status(500).json({ success: false, error: 'Failed to update person' });
  }
});

/**
 * DELETE /api/people/:name
 * Delete a person
 */
app.delete('/api/people/:name', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const success = await storageClient.deletePerson(name);

    if (!success) {
      return res.status(404).json({ success: false, error: 'Person not found' });
    }

    res.json({ success: true, message: 'Person deleted' });
  } catch (error) {
    console.error('Error deleting person:', error);
    res.status(500).json({ success: false, error: 'Failed to delete person' });
  }
});

/**
 * POST /api/people/:name/notes
 * Add a note to a person's conversation history
 */
app.post('/api/people/:name/notes', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { note } = req.body;

    if (!note) {
      return res.status(400).json({ success: false, error: 'Note is required' });
    }

    const person = await storageClient.findPersonByName(name);

    if (!person) {
      return res.status(404).json({ success: false, error: 'Person not found' });
    }

    // Add note as a new conversation entry
    person.conversationHistory.push({
      date: new Date(),
      transcript: note,
      topics: ['manual_note'],
      keyPoints: [note]
    });

    person.lastMet = new Date();

    await storageClient.storePerson(person);

    res.json({ success: true, person });
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ success: false, error: 'Failed to add note' });
  }
});

/**
 * GET /api/stats
 * Get storage statistics
 */
app.get('/api/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    const stats = storageClient.getStats();
    const people = await storageClient.getAllPeople();

    // Calculate additional stats
    const totalConversations = people.reduce((sum, p) =>
      sum + (p.conversationHistory?.length || 0), 0
    );

    const peopleWithVoices = people.filter(p => p.voiceReference).length;

    res.json({
      success: true,
      stats: {
        ...stats,
        totalConversations,
        peopleWithVoices,
        averageConversationsPerPerson: people.length > 0
          ? (totalConversations / people.length).toFixed(1)
          : 0
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/export
 * Export all data as JSON
 */
app.get('/api/export', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = storageClient.exportData();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="nametag-export-${Date.now()}.json"`);
    res.send(data);
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ success: false, error: 'Failed to export data' });
  }
});

// Health check (no auth required)
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', storage: storageClient.isReady() });
});

// Serve index.html for root and any unmatched routes (SPA fallback)
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(WEB_PORT, () => {
  console.log(`\n╔═════════════════════════════════════════╗`);
  console.log(`║     Nametag Companion UI Server        ║`);
  console.log(`╚═════════════════════════════════════════╝\n`);
  console.log(`✓ Server running on http://localhost:${WEB_PORT}`);
  console.log(`✓ API endpoints available at /api/*`);
  console.log(`✓ MentraOS auth enabled\n`);
});

export { app, storageClient };
