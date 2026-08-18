import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgresProvider } from '../postgres.provider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSeed() {
  const db = PostgresProvider.getInstance();
  const sqlPath = path.resolve(__dirname, '../../sql/002_seed_mock_data.sql');
  
  console.info(`[Seed] Reading seed data from: ${sqlPath}`);
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  try {
    console.info('[Seed] Seeding initial mock data...');
    await db.query(sql);
    console.info('[Seed] Mock data seeded successfully!');
  } catch (error) {
    console.error('[Seed] Seeding failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

void runSeed();
