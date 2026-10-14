import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;

let poolInstance: pg.Pool | null = null;

function loadEnvFallback() {
  if (process.env.DATABASE_URL) return;
  for (const envFile of ['.env.local', '.env']) {
    if (fs.existsSync(envFile)) {
      const lines = fs.readFileSync(envFile, 'utf-8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      }
    }
  }
}

export function isPostgresConfigured(): boolean {
  loadEnvFallback();
  const url = process.env.DATABASE_URL;
  return Boolean(url && (url.startsWith('postgres://') || url.startsWith('postgresql://')));
}

export function getPgPool(): pg.Pool {
  if (poolInstance) return poolInstance;

  loadEnvFallback();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured for PostgreSQL connection.');
  }

  // Handle Supabase pooler SSL
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const sanitizedUrl = databaseUrl.replace(/[?&]sslmode=[^&]+/, '');

  poolInstance = new Pool({
    connectionString: sanitizedUrl,
    ssl: { rejectUnauthorized: false },
    max: parseInt(process.env.PG_MAX_CONNECTIONS || '10', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  });

  poolInstance.on('error', (err) => {
    console.error('[PostgreSQL Pool Error]:', err.message);
  });

  return poolInstance;
}

export async function queryPg<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const pool = getPgPool();
  const res = await pool.query(text, params);
  return res.rows as T[];
}

export async function queryPgOne<T = any>(text: string, params: any[] = []): Promise<T | null> {
  const rows = await queryPg<T>(text, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function withPgTransaction<T>(callback: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function checkPgHealth(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const pool = getPgPool();
    const res = await pool.query('SELECT 1 as alive');
    const latencyMs = Date.now() - start;
    if (res.rows[0]?.alive === 1) {
      return { ok: true, latencyMs };
    }
    return { ok: false, latencyMs, error: 'Unexpected response from database' };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    return { ok: false, latencyMs, error: err.message };
  }
}
