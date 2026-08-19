import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
export type { PoolClient, QueryResult, QueryResultRow };

export interface DatabaseConfig {
  connectionString?: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  maxUses: number;
}

export interface PoolStats {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}

export interface ITransactionContext {
  client: PoolClient;
  query<R extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<R>>;
}

export type TransactionCallback<T> = (ctx: ITransactionContext) => Promise<T>;

export interface DatabaseHealth {
  status: 'healthy' | 'unhealthy';
  latencyMs: number;
  poolStats: PoolStats;
  timestamp: string;
}
