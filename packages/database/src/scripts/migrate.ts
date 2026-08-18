import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgresProvider } from '../postgres.provider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const db = PostgresProvider.getInstance();
  const sqlPath = path.resolve(__dirname, '../../sql/001_initial_schema.sql');
  
  console.info(`[Migrate] Reading schema from: ${sqlPath}`);
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  try {
    console.info('[Migrate] Applying database schema migration...');
    await db.query(sql);
    console.info('[Migrate] Database schema applied successfully!');
  } catch (error) {
    console.error('[Migrate] Migration failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

void runMigration();
