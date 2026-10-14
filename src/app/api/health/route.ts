import { NextResponse } from 'next/server';
import { isPostgresConfigured, checkPgHealth } from '@/lib/pg-db.ts';
import { getDb } from '@/lib/db.ts';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();
  let dbStatus = 'disconnected';
  let latencyMs = 0;
  let dialect = 'none';

  try {
    if (isPostgresConfigured()) {
      dialect = 'postgresql';
      const pgRes = await checkPgHealth();
      if (pgRes.ok) {
        dbStatus = 'connected';
        latencyMs = pgRes.latencyMs;
      } else {
        dbStatus = 'error';
      }
    } else {
      dialect = 'sqlite';
      const db = getDb();
      const res = db.prepare('SELECT 1 as alive').get() as { alive: number } | undefined;
      if (res && res.alive === 1) {
        dbStatus = 'connected';
        latencyMs = Date.now() - start;
      }
    }
  } catch (err: any) {
    dbStatus = 'error';
  }

  const isHealthy = dbStatus === 'connected';

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'unhealthy',
      database: dbStatus,
      dialect,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      latencyMs,
    },
    {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
