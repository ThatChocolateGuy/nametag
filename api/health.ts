// Standalone health check endpoint for Vercel
// Tests if the main app module can load

export default async function handler(req: any, res: any) {
  const diagnostics: any = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      VERCEL: process.env.VERCEL || 'not set',
      NODE_ENV: process.env.NODE_ENV || 'not set',
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_KEY,
      hasMentraOsKey: !!process.env.MENTRAOS_API_KEY,
      hasPackageName: !!process.env.PACKAGE_NAME,
    },
    moduleLoad: {
      webserver: false,
      storageClient: false,
      error: null
    }
  };

  // Try to load the main app module
  try {
    const { app, storageClient } = await import('../src/webserver');
    diagnostics.moduleLoad.webserver = true;
    diagnostics.moduleLoad.storageClient = storageClient ? storageClient.isReady() : false;
  } catch (error: any) {
    diagnostics.status = 'error';
    diagnostics.moduleLoad.error = error.message;
  }

  res.status(200).json(diagnostics);
}
