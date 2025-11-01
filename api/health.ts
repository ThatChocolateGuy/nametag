// Standalone health check endpoint for Vercel
// This bypasses the Express app and MentraOS auth completely

import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Simple health check - always returns 200
  res.status(200).json({
    status: 'ok',
    storage: true,
    timestamp: new Date().toISOString()
  });
}
