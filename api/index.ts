import type { Request, Response } from 'express';
import { createServer } from '../apps/api/src/http/server.js';
import { autoMigrateDatabase } from '@trademitra/database';

let isDbMigrated = false;
const app = createServer();

export default async function handler(req: Request, res: Response) {
  if (!isDbMigrated) {
    try {
      await autoMigrateDatabase();
      isDbMigrated = true;
    } catch (err: any) {
      console.warn('[Vercel Serverless] Auto-migration status:', err?.message || err);
    }
  }
  return app(req, res);
}
