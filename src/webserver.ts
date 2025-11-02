// Load dotenv only in local development (not on Vercel)
if (process.env.VERCEL !== '1') {
  require('dotenv/config');
}

import express, { Request, Response, RequestHandler } from 'express';
import path from 'path';
import { SupabaseStorageClient, Person } from './services/supabaseStorageClient';
import { createAuthMiddleware } from '@mentra/sdk';

// Environment variables - validate they exist
const MENTRAOS_API_KEY = process.env.MENTRAOS_API_KEY;
const PACKAGE_NAME = process.env.PACKAGE_NAME;
const WEB_PORT = parseInt(process.env.WEB_PORT || '3001');
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'change-this-secret-in-production';

// Initialize storage client with graceful error handling
let storageClient: SupabaseStorageClient | null = null;
let storageInitError: Error | null = null;

try {
  storageClient = new SupabaseStorageClient();
  console.log('✓ Supabase storage client initialized successfully');
} catch (error) {
  storageInitError = error as Error;
  console.error('⚠️ Failed to initialize Supabase storage client:', error);
  console.error('⚠️ API endpoints will return 503 Service Unavailable');
  // Don't throw - allow module to load so we can return proper error responses
}

// Check for auth configuration
let authInitError: string | null = null;
if (!MENTRAOS_API_KEY || !PACKAGE_NAME) {
  const missing = [];
  if (!MENTRAOS_API_KEY) missing.push('MENTRAOS_API_KEY');
  if (!PACKAGE_NAME) missing.push('PACKAGE_NAME');
  authInitError = `Missing required environment variables: ${missing.join(', ')}`;
  console.error('⚠️', authInitError);
  console.error('⚠️ Authentication will be disabled - all API routes will return 503');
}

// Create Express app
const app = express();

// Health check middleware - bypasses ALL other middleware
app.use((req, res, next): void => {
  if (req.path === '/health') {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      storage: storageClient ? storageClient.isReady() : false,
      storageError: storageInitError ? storageInitError.message : null,
      auth: !authInitError,
      authError: authInitError
    });
    return;
  }
  next();
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// MentraOS authentication middleware (only if credentials are available)
let authMiddleware: RequestHandler;

if (MENTRAOS_API_KEY && PACKAGE_NAME) {
  authMiddleware = createAuthMiddleware({
    apiKey: MENTRAOS_API_KEY,
    packageName: PACKAGE_NAME,
    cookieSecret: COOKIE_SECRET,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
  }) as RequestHandler;
} else {
  // No-op middleware when auth is not configured
  authMiddleware = ((req, res, next): void => {
    res.status(503).json({
      success: false,
      error: 'Authentication service unavailable',
      details: authInitError
    });
  }) as RequestHandler;
}

// Storage availability middleware for API routes
const requireStorage: RequestHandler = (req, res, next): void => {
  if (!storageClient || storageInitError) {
    res.status(503).json({
      success: false,
      error: 'Storage service unavailable',
      details: storageInitError?.message
    });
    return;
  }
  next();
};

// API Routes

/**
 * GET /api/people
 * Get all stored people
 */
app.get('/api/people', authMiddleware as RequestHandler, requireStorage, async (req: Request, res: Response) => {
  try {
    const people = await storageClient!.getAllPeople();

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
app.get('/api/people/:name', authMiddleware as RequestHandler, requireStorage, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;
    const person = await storageClient!.findPersonByName(name);

    if (!person) {
      res.status(404).json({ success: false, error: 'Person not found' });
      return;
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
app.put('/api/people/:name', authMiddleware as RequestHandler, requireStorage, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;
    const person = await storageClient!.findPersonByName(name);

    if (!person) {
      res.status(404).json({ success: false, error: 'Person not found' });
      return;
    }

    // Update allowed fields
    const updates: Partial<Person> = {};
    if (req.body.conversationHistory) updates.conversationHistory = req.body.conversationHistory;

    // Merge updates
    const updated: Person = { ...person, ...updates };

    await storageClient!.storePerson(updated);

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
app.delete('/api/people/:name', authMiddleware as RequestHandler, requireStorage, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;
    const success = await storageClient!.deletePerson(name);

    if (!success) {
      res.status(404).json({ success: false, error: 'Person not found' });
      return;
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
app.post('/api/people/:name/notes', authMiddleware as RequestHandler, requireStorage, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;
    const { note } = req.body;

    if (!note) {
      res.status(400).json({ success: false, error: 'Note is required' });
      return;
    }

    const person = await storageClient!.findPersonByName(name);

    if (!person) {
      res.status(404).json({ success: false, error: 'Person not found' });
      return;
    }

    // Add note as a new conversation entry
    person.conversationHistory.push({
      date: new Date(),
      transcript: note,
      topics: ['manual_note'],
      keyPoints: [note]
    });

    person.lastMet = new Date();

    await storageClient!.storePerson(person);

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
app.get('/api/stats', authMiddleware as RequestHandler, requireStorage, async (req: Request, res: Response) => {
  try {
    // Use async stats method from SupabaseStorageClient
    const stats = await storageClient!.getStatsAsync();

    res.json({
      success: true,
      stats
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
app.get('/api/export', authMiddleware as RequestHandler, requireStorage, async (req: Request, res: Response) => {
  try {
    const data = await storageClient!.exportData();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="nametag-export-${Date.now()}.json"`);
    res.send(data);
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ success: false, error: 'Failed to export data' });
  }
});

// Serve index.html for root and any unmatched routes (SPA fallback)
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server (only when not running on Vercel)
if (process.env.VERCEL !== '1') {
  app.listen(WEB_PORT, () => {
    console.log(`\n╔════════════════════════════════════════╗`);
    console.log(`║     Nametag Companion UI Server        ║`);
    console.log(`╚════════════════════════════════════════╝\n`);
    console.log(`✓ Server running on http://localhost:${WEB_PORT}`);
    console.log(`✓ API endpoints available at /api/*`);
    console.log(`✓ MentraOS auth enabled\n`);
  });
}

export { app, storageClient };
