import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from '../apps/api/src/http/server.js';
import { autoMigrateDatabase } from '../packages/database/src/index.js';

let isDbMigrated = false;
let appInstance: any = null;

function getApp() {
  if (!appInstance) {
    appInstance = createServer();
  }
  return appInstance;
}

export default async function handler(req: IncomingMessage, res: ServerResponse | any) {
  if (!isDbMigrated && process.env.DATABASE_URL) {
    try {
      await autoMigrateDatabase();
      isDbMigrated = true;
    } catch (err: any) {
      console.warn('[Vercel Serverless] Auto-migration status:', err?.message || err);
    }
  }

  try {
    const app = getApp();
    return await new Promise<void>((resolve, reject) => {
      res.on('finish', resolve);
      res.on('close', resolve);
      res.on('error', reject);
      app(req, res, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });
  } catch (err: any) {
    console.error('[Vercel Serverless] Request handling error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          success: false,
          error: {
            message: 'Internal serverless execution error',
            details: err?.message || String(err),
          },
        })
      );
    }
  }
}

