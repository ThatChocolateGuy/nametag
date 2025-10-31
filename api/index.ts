// Vercel serverless function entry point
// This file is used when deploying to Vercel
// For local development, use: bun run dev:web

import { app } from '../src/webserver';

// Export the Express app as a Vercel serverless function
export default app;
