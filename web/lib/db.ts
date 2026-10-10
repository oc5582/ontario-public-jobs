import { Pool, type QueryResultRow } from "pg";

const globalForPg = globalThis as unknown as { pool?: Pool };

export function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!globalForPg.pool) {
    const ssl = /supabase\.(co|com)|sslmode=require/.test(connectionString)
      ? { rejectUnauthorized: false as const }
      : undefined;
    globalForPg.pool = new Pool({ connectionString, ssl, max: 5 });
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
