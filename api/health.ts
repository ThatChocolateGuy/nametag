// Standalone health check endpoint for Vercel
// This bypasses the Express app and MentraOS auth completely

export default function handler(req: any, res: any) {
  // Set CORS headers to allow any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  // Simple health check - always returns 200
  res.status(200).json({
    status: 'ok',
    storage: true,
    timestamp: new Date().toISOString()
  });
}
