import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSetup() {
  console.info('[SetupDB] Starting enterprise database provisioner...');

  // 1. Connect as postgres superuser to template db to configure roles & privileges
  const rootClient = new pg.Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '@S@8949470181',
    database: 'postgres',
  });

  try {
    await rootClient.connect();
    console.info('[SetupDB] Connected to PostgreSQL as superuser "postgres"');

    // 2. Create database role/user 'trademitra' if not exists
    console.info('[SetupDB] Configuring database role "trademitra"...');
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

    // 3. Create database 'trademitra' if not exists
    const dbCheck = await rootClient.query("SELECT 1 FROM pg_database WHERE datname='trademitra';");
    if (dbCheck.rows.length === 0) {
      console.info('[SetupDB] Creating database "trademitra"...');
      await rootClient.query('CREATE DATABASE trademitra OWNER trademitra;');
    } else {
      console.info('[SetupDB] Database "trademitra" already exists. Updating ownership...');
      await rootClient.query('ALTER DATABASE trademitra OWNER TO trademitra;');
    }

    await rootClient.end();

    // 4. Connect to target database 'trademitra' as postgres to run DDL and seeds
    const targetClient = new pg.Client({
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: '@S@8949470181',
      database: 'trademitra',
    });

    await targetClient.connect();
    console.info('[SetupDB] Connected to database "trademitra"');

    // 5. Read and apply DDL schema migrations
    const schemaPath = path.resolve(__dirname, '../../sql/001_initial_schema.sql');
    console.info(`[SetupDB] Reading schema from: ${schemaPath}`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    await targetClient.query(schemaSql);
    console.info('[SetupDB] DDL Schema applied successfully!');

    // 6. Read and apply Seed mock data
    const seedPath = path.resolve(__dirname, '../../sql/002_seed_mock_data.sql');
    console.info(`[SetupDB] Reading seeds from: ${seedPath}`);
    const seedSql = fs.readFileSync(seedPath, 'utf-8');
    await targetClient.query(seedSql);
    console.info('[SetupDB] Seed mock data applied successfully!');

    await targetClient.end();
    console.info('[SetupDB] Database provisioning completed successfully!');
  } catch (error) {
    console.error('[SetupDB] Provisioning failed:', error);
    process.exit(1);
  }
}

void runSetup();
