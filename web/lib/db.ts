import { attachDatabasePool } from "@vercel/functions";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

const globalForPg = globalThis as unknown as { pool?: Pool };

// One client per serverless instance. The hosted DATABASE_URL must be the
// Supabase transaction pooler (port 6543), not the session pooler (port 5432).
// Session mode caps the whole project at a small pool (15 on the preview) and
// a handful of instances exhaust it. Timeouts release a stuck client.
const POOL_MAX = 1;
const CONNECT_TIMEOUT_MS = 5_000;
const IDLE_TIMEOUT_MS = 5_000;
const STATEMENT_TIMEOUT_MS = 8_000;

export function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!globalForPg.pool) {
    const ssl = /supabase\.(co|com)|sslmode=require/.test(connectionString)
      ? { rejectUnauthorized: false as const }
      : undefined;
    const pool = new Pool({
      connectionString,
      ssl,
      max: POOL_MAX,
      connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
      idleTimeoutMillis: IDLE_TIMEOUT_MS,
      // Client-side statement timeout. A server startup `statement_timeout` is
      // rejected by some transaction poolers, so the limit is enforced here.
      query_timeout: STATEMENT_TIMEOUT_MS,
      allowExitOnIdle: true,
    });
    if (process.env.VERCEL) attachDatabasePool(pool);
    globalForPg.pool = pool;
  }
  return globalForPg.pool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // The original error is the one to surface.
    }
    throw error;
  } finally {
    client.release();
  }
}
