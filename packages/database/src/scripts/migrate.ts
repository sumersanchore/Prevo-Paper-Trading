import { PostgresProvider } from '../postgres.provider.js';
import { autoMigrateDatabase } from '../auto-migrate.js';

async function runMigration() {
  const db = PostgresProvider.getInstance();
  try {
    console.info('[Migrate] Running database migrations...');
    await autoMigrateDatabase(db);
    console.info('[Migrate] All database tables and migrations applied successfully!');
  } catch (error) {
    console.error('[Migrate] Migration failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

void runMigration();
