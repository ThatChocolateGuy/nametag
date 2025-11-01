// Standalone health check endpoint for Vercel
// Absolutely minimal - no imports, no dependencies

export default function handler(req: any, res: any) {
  // Immediately return 200 with minimal JSON
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
}
