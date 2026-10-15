import { NextResponse } from 'next/server';
import { posService } from '@/lib/pos-service';
import { isPostgresConfigured } from '@/lib/pg-db';
import { posPgService } from '@/lib/pg-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (isPostgresConfigured()) {
      const catalog = await posPgService.getCatalog();
      return NextResponse.json({ success: true, data: catalog });
    }

    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SQLITE_IN_PRODUCTION) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_URL is not configured. PostgreSQL connection is required in production.' },
        { status: 503 }
      );
    }

    const catalog = posService.getCatalog();
    return NextResponse.json({ success: true, data: catalog });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
