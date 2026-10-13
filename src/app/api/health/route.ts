import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.ts';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();
  let dbStatus = 'disconnected';

  try {
    const db = getDb();
    // Test database query
    const res = db.prepare('SELECT 1 as alive').get() as { alive: number } | undefined;
    if (res && res.alive === 1) {
      dbStatus = 'connected';
    }
  } catch (err: any) {
    dbStatus = 'error';
  }

  const isHealthy = dbStatus === 'connected';
  const latencyMs = Date.now() - start;

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'unhealthy',
      database: dbStatus,
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
