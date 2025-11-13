// Load dotenv only in local development (not on Vercel)
if (process.env.VERCEL !== '1') {
  require('dotenv/config');
}

import express, { Request, Response, RequestHandler } from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { SupabaseStorageClient, Person } from './services/supabaseStorageClient';
import { createAuthMiddleware, AuthenticatedRequest } from '@mentra/sdk';

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
      authError: authInitError,
      config: {
        hasMentraOSApiKey: !!MENTRAOS_API_KEY,
        hasPackageName: !!PACKAGE_NAME,
        packageName: PACKAGE_NAME || 'NOT_SET',
        hasCookieSecret: !!COOKIE_SECRET && COOKIE_SECRET !== 'change-this-secret-in-production',
        nodeEnv: process.env.NODE_ENV || 'development'
      }
    });
    return;
  }
  next();
});

// Debug logging middleware (logs all requests for troubleshooting)
app.use((req, res, next): void => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);

  // Log query parameters (including aos_temp_token if present)
  if (Object.keys(req.query).length > 0) {
    const sanitizedQuery = { ...req.query };
    if (sanitizedQuery.aos_temp_token) {
      sanitizedQuery.aos_temp_token = `${String(sanitizedQuery.aos_temp_token).substring(0, 10)}...`;
    }
    console.log(`  Query params:`, sanitizedQuery);
  }

  // Log cookies (sanitized)
  if (req.headers.cookie) {
    const cookieNames = req.headers.cookie.split(';').map(c => c.trim().split('=')[0]);
    console.log(`  Cookies present:`, cookieNames);
  } else {
    console.log(`  No cookies present`);
  }

  next();
});

// Middleware
app.use(express.json());
app.use(cookieParser());
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

// Development-only auth bypass wrapper
// Wraps the real auth middleware and checks for debug cookie first
const authMiddlewareWithDebugBypass: RequestHandler = (req, res, next): void => {
  const isDevelopment = process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1';

  // In development, check for debug cookie
  if (isDevelopment && req.cookies?.debug_user_id) {
    const debugUserId = req.cookies.debug_user_id;
    console.log(`🔧 DEBUG MODE: Bypassing auth with debug user: ${debugUserId}`);

    // Manually inject auth data into request (mimics AuthenticatedRequest)
    const authReq = req as AuthenticatedRequest;
    authReq.authUserId = debugUserId;
    authReq.activeSession = null; // No real session in debug mode

    return next();
  }

  // Otherwise, use real auth middleware
  authMiddleware(req, res, next);
};

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
 * GET /api/auth/debug-login
 * Development-only endpoint to set debug auth cookie
 * Usage: http://localhost:3001/api/auth/debug-login?userId=your_test_user
 */
app.get('/api/auth/debug-login', (req: Request, res: Response) => {
  const isDevelopment = process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1';

  if (!isDevelopment) {
    res.status(404).json({
      success: false,
      error: 'Not found'
    });
    return;
  }

  const userId = (req.query.userId as string) || 'dev_test_user';

  console.log(`🔧 DEBUG LOGIN: Setting debug auth cookie for user: ${userId}`);

  // Set debug cookie (7 days, same as real auth)
  res.cookie('debug_user_id', userId, {
    httpOnly: true,
    secure: false, // HTTP in development
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax'
  });

  res.json({
    success: true,
    message: 'Debug authentication cookie set',
    userId: userId,
    instructions: {
      next: 'Navigate to http://localhost:3001 to access the companion UI',
      note: 'You are now authenticated as "' + userId + '" for 7 days',
      clearCookie: 'Visit /api/auth/debug-logout to clear the cookie'
    }
  });
});

/**
 * GET /api/auth/debug-logout
 * Development-only endpoint to clear debug auth cookie
 */
app.get('/api/auth/debug-logout', (req: Request, res: Response) => {
  const isDevelopment = process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1';

  if (!isDevelopment) {
    res.status(404).json({
      success: false,
      error: 'Not found'
    });
    return;
  }

  console.log('🔧 DEBUG LOGOUT: Clearing debug auth cookie');

  res.clearCookie('debug_user_id');

  res.json({
    success: true,
    message: 'Debug authentication cookie cleared',
    instructions: {
      next: 'Visit /api/auth/debug-login to log in again'
    }
  });
});

/**
 * GET /api/auth/status
 * Check authentication status (for debugging)
 */
app.get('/api/auth/status', authMiddlewareWithDebugBypass as RequestHandler, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  console.log('✓ /api/auth/status called');
  console.log(`  Authenticated: ${!!authReq.authUserId}`);
  console.log(`  User ID: ${authReq.authUserId || 'NOT_SET'}`);
  console.log(`  Has Session: ${!!authReq.activeSession}`);

  res.json({
    success: true,
    authenticated: !!authReq.authUserId,
    userId: authReq.authUserId || null,
    hasSession: !!authReq.activeSession,
    debug: {
      cookieSecret: COOKIE_SECRET.substring(0, 10) + '...',
      packageName: PACKAGE_NAME,
      hasApiKey: !!MENTRAOS_API_KEY,
      hasCookieSecretSet: COOKIE_SECRET !== 'change-this-secret-in-production'
    }
  });
});

/**
 * GET /api/people
 * Get all stored people for the authenticated user
 */
app.get('/api/people', authMiddlewareWithDebugBypass as RequestHandler, requireStorage, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUserId;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const people = await storageClient!.getAllPeople(userId);

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
 * Get a specific person by name (user-scoped)
 */
app.get('/api/people/:name', authMiddlewareWithDebugBypass as RequestHandler, requireStorage, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUserId;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { name } = req.params;
    const person = await storageClient!.findPersonByName(name, userId);

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
 * Update a person's information (user-scoped)
 */
app.put('/api/people/:name', authMiddlewareWithDebugBypass as RequestHandler, requireStorage, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUserId;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { name } = req.params;
    const person = await storageClient!.findPersonByName(name, userId);

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
 * Delete a person (user-scoped)
 */
app.delete('/api/people/:name', authMiddlewareWithDebugBypass as RequestHandler, requireStorage, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUserId;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { name } = req.params;
    const success = await storageClient!.deletePerson(name, userId);

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
 * Add a note to a person's conversation history (user-scoped)
 */
app.post('/api/people/:name/notes', authMiddlewareWithDebugBypass as RequestHandler, requireStorage, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUserId;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { name } = req.params;
    const { note } = req.body;

    if (!note) {
      res.status(400).json({ success: false, error: 'Note is required' });
      return;
    }

    const person = await storageClient!.findPersonByName(name, userId);

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
 * Get storage statistics for the authenticated user
 */
app.get('/api/stats', authMiddlewareWithDebugBypass as RequestHandler, requireStorage, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUserId;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    // Use async stats method from SupabaseStorageClient (user-scoped)
    const stats = await storageClient!.getStatsAsync(userId);

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
 * Export user's data as JSON
 */
app.get('/api/export', authMiddlewareWithDebugBypass as RequestHandler, requireStorage, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUserId;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    // Export only this user's data
    const people = await storageClient!.getAllPeople(userId);
    const exportData = {
      people: people.reduce((acc, person) => {
        const key = `person_${person.name.toLowerCase().replace(/\s+/g, '_')}`;
        acc[key] = person;
        return acc;
      }, {} as { [key: string]: any }),
      version: '1.0.0',
      lastModified: new Date().toISOString(),
      source: 'supabase',
      userId: userId
    };

    const data = JSON.stringify(exportData, null, 2);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="nametag-export-${userId}-${Date.now()}.json"`);
    res.send(data);
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ success: false, error: 'Failed to export data' });
  }
});

// Serve index.html for root route (with authentication)
app.get('/', authMiddlewareWithDebugBypass as RequestHandler, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  console.log('✓ Root route accessed');
  console.log(`  Authenticated: ${!!authReq.authUserId}`);
  console.log(`  User ID: ${authReq.authUserId || 'NOT_SET'}`);

  if (!authReq.authUserId) {
    console.error('⚠️ WARNING: Root route accessed but user not authenticated!');
    console.error('  This should not happen - auth middleware should have returned 401');
  }

  // Auth middleware will handle token exchange and set cookie
  // Just serve the HTML - the cookie will be used for API calls
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Serve index.html for any unmatched routes (SPA fallback, also with auth)
app.get('*', authMiddlewareWithDebugBypass as RequestHandler, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  console.log(`✓ Catch-all route accessed: ${req.path}`);
  console.log(`  Authenticated: ${!!authReq.authUserId}`);

  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware (must be last)
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('❌ Express error handler caught error:');
  console.error('  Error:', err.message || err);
  console.error('  Path:', req.path);
  console.error('  Method:', req.method);

  // If headers already sent, delegate to default error handler
  if (res.headersSent) {
    return next(err);
  }

  // Return detailed error in development, generic in production
  const isDevelopment = process.env.NODE_ENV !== 'production';

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    details: isDevelopment ? {
      stack: err.stack,
      path: req.path,
      method: req.method
    } : undefined
  });
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
