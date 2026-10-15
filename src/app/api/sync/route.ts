import { NextResponse } from 'next/server';
import { syncService } from '@/lib/sync-service';
import { isPostgresConfigured } from '@/lib/pg-db';
import { syncPgService } from '@/lib/pg-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (isPostgresConfigured()) {
      const status = await syncPgService.getSyncStatus();
      return NextResponse.json({ success: true, data: status });
    }

    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SQLITE_IN_PRODUCTION) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_URL is not configured. PostgreSQL connection is required in production.' },
        { status: 503 }
      );
    }

    const status = syncService.getSyncStatus();
    return NextResponse.json({ success: true, data: status });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { events } = body;
    if (!Array.isArray(events)) {
      return NextResponse.json({ success: false, error: 'Expected events array' }, { status: 400 });
    }

    if (isPostgresConfigured()) {
      const results = await syncPgService.processSyncBatch(events);
      return NextResponse.json({ success: true, data: { results } });
    }

    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SQLITE_IN_PRODUCTION) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_URL is not configured. PostgreSQL connection is required in production.' },
        { status: 503 }
      );
    }

    const results = syncService.processSyncBatch(events);
    return NextResponse.json({ success: true, data: { results } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
