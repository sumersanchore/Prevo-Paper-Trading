import pg, { type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { getDatabaseConfig } from './config.js';
import type {
  DatabaseConfig,
  DatabaseHealth,
  ITransactionContext,
  PoolStats,
  TransactionCallback,
} from './types.js';

const { Pool } = pg;

export class PostgresProvider {
  private static instance: PostgresProvider | null = null;
  private readonly pool: pg.Pool;
  private readonly config: DatabaseConfig;
  private isShuttingDown = false;

  private constructor(customConfig?: Partial<DatabaseConfig>) {
    this.config = {
      ...getDatabaseConfig(),
      ...customConfig,
    };

    this.pool = new Pool(
      this.config.connectionString
        ? {
            connectionString: this.config.connectionString,
            ssl: this.config.ssl,
            max: this.config.max,
            idleTimeoutMillis: this.config.idleTimeoutMillis,
            connectionTimeoutMillis: this.config.connectionTimeoutMillis,
          }
        : {
            host: this.config.host,
            port: this.config.port,
            database: this.config.database,
            user: this.config.user,
            password: this.config.password,
            ssl: this.config.ssl,
            max: this.config.max,
            idleTimeoutMillis: this.config.idleTimeoutMillis,
            connectionTimeoutMillis: this.config.connectionTimeoutMillis,
            maxUses: this.config.maxUses,
          }
    );

    this.registerPoolEvents();
    this.registerProcessHooks();
  }

  public static getInstance(customConfig?: Partial<DatabaseConfig>): PostgresProvider {
    if (!PostgresProvider.instance) {
      PostgresProvider.instance = new PostgresProvider(customConfig);
    }
    return PostgresProvider.instance;
  }

  private registerPoolEvents(): void {
    this.pool.on('connect', (client: PoolClient) => {
      // Set session time zone to UTC for consistent financial timestamp handling
      client.query("SET timezone = 'UTC'").catch((err) => {
        console.error('[PostgresProvider] Error setting session timezone to UTC:', err);
      });
    });

    this.pool.on('error', (err: Error) => {
      console.error('[PostgresProvider] Unexpected error on idle database client:', err.message);
    });

    this.pool.on('remove', () => {
      // Clean connection removal
    });
  }

  private registerProcessHooks(): void {
    const shutdownHandler = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      console.info(`[PostgresProvider] Received ${signal}. Draining connection pool gracefully...`);
      try {
        await this.close();
        console.info('[PostgresProvider] Database connection pool drained successfully.');
      } catch (err) {
        console.error('[PostgresProvider] Error during database pool shutdown:', err);
      }
    };

    process.once('SIGINT', () => void shutdownHandler('SIGINT'));
    process.once('SIGTERM', () => void shutdownHandler('SIGTERM'));
  }

  public async query<R extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<R>> {
    if (this.isShuttingDown) {
      throw new Error('[PostgresProvider] Cannot execute query: Database pool is shutting down.');
    }
    return this.pool.query<R>(text, params);
  }

  public async getClient(): Promise<PoolClient> {
    if (this.isShuttingDown) {
      throw new Error('[PostgresProvider] Cannot acquire client: Database pool is shutting down.');
    }
    return this.pool.connect();
  }

  public async withTransaction<T>(callback: TransactionCallback<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const ctx: ITransactionContext = {
        client,
        query: <R extends QueryResultRow = any>(text: string, params?: any[]) =>
          client.query<R>(text, params),
      };
      const result = await callback(ctx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[PostgresProvider] Transaction rollback failed:', rollbackErr);
      }
      throw error;
    } finally {
      client.release();
    }
  }

  public getPoolStats(): PoolStats {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  public async healthCheck(): Promise<DatabaseHealth> {
    const start = performance.now();
    try {
      await this.pool.query('SELECT 1 AS probe');
      const latencyMs = Number((performance.now() - start).toFixed(2));
      return {
        status: 'healthy',
        latencyMs,
        poolStats: this.getPoolStats(),
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      const latencyMs = Number((performance.now() - start).toFixed(2));
      return {
        status: 'unhealthy',
        latencyMs,
        poolStats: this.getPoolStats(),
        timestamp: new Date().toISOString(),
      };
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
    PostgresProvider.instance = null;
  }
}

export const db = PostgresProvider.getInstance();
