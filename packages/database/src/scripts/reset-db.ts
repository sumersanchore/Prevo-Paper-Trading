import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runReset() {
  console.info('=======================================================');
  console.info('🔥 [TradeMitra DB Reset] Dropping & Recreating Database...');
  console.info('=======================================================');

  const rootClient = new pg.Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '@S@8949470181',
    database: 'postgres',
  });

  try {
    await rootClient.connect();
    console.info('[ResetDB] Connected to PostgreSQL as superuser "postgres"');

    // 1. Terminate all existing active connections to trademitra db
    console.info('[ResetDB] Terminating active connections to "trademitra"...');
    await rootClient.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = 'trademitra'
        AND pid <> pg_backend_pid();
    `);

    // 2. Drop database if exists
    console.info('[ResetDB] Dropping database "trademitra"...');
    await rootClient.query('DROP DATABASE IF EXISTS trademitra;');

    // 3. Configure database role/user 'trademitra'
    console.info('[ResetDB] Configuring database role "trademitra"...');
    await rootClient.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'trademitra') THEN
          CREATE ROLE trademitra WITH LOGIN SUPERUSER PASSWORD '@S@8949470181';
        ELSE
          ALTER ROLE trademitra WITH PASSWORD '@S@8949470181';
        END IF;
      END
      $$;
    `);

    // 4. Create fresh database 'trademitra'
    console.info('[ResetDB] Creating fresh database "trademitra"...');
    await rootClient.query('CREATE DATABASE trademitra OWNER trademitra;');

    await rootClient.end();

    // 5. Connect to fresh database 'trademitra'
    const targetClient = new pg.Client({
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: '@S@8949470181',
      database: 'trademitra',
    });

    await targetClient.connect();
    console.info('[ResetDB] Connected to fresh database "trademitra"');

    // 6. Apply DDL schema
    const schemaPath = path.resolve(__dirname, '../../sql/001_initial_schema.sql');
    console.info(`[ResetDB] Applying DDL schema from: ${schemaPath}`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    await targetClient.query(schemaSql);
    console.info('✅ [ResetDB] Fresh DDL Schema applied successfully!');

    // 7. Apply Seed mock data
    const seedPath = path.resolve(__dirname, '../../sql/002_seed_mock_data.sql');
    console.info(`[ResetDB] Applying Seed mock data from: ${seedPath}`);
    const seedSql = fs.readFileSync(seedPath, 'utf-8');
    await targetClient.query(seedSql);
    console.info('✅ [ResetDB] Fresh Seed mock data applied successfully!');

    await targetClient.end();
    console.info('=======================================================');
    console.info('✨ [TradeMitra DB Reset] Database freshly initialized!');
    console.info('=======================================================');
  } catch (error) {
    console.error('❌ [ResetDB] Reset failed:', error);
    process.exit(1);
  }
}

void runReset();
