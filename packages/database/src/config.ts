import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatabaseConfig } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from workspace root or current package directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export const getDatabaseConfig = (): DatabaseConfig => {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  const isSslEnabled =
    process.env.DB_SSL === 'true' ||
    Boolean(connectionString && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1'));

  return {
    connectionString: connectionString || undefined,
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME ?? 'trademitra_db',
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    ssl: isSslEnabled ? { rejectUnauthorized: false } : false,
    max: parseInt(process.env.DB_POOL_MAX ?? '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS ?? '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONN_TIMEOUT_MS ?? '5000', 10),
    maxUses: parseInt(process.env.DB_POOL_MAX_USES ?? '7500', 10),
  };
};
