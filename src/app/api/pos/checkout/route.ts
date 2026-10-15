import { NextResponse } from 'next/server';
import { posService } from '@/lib/pos-service';
import { isPostgresConfigured } from '@/lib/pg-db';
import { posPgService } from '@/lib/pg-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const idempotencyHeader = request.headers.get('idempotency-key') || request.headers.get('x-idempotency-key');
    if (idempotencyHeader && !body.idempotencyKey) {
      body.idempotencyKey = idempotencyHeader;
    }

    if (isPostgresConfigured()) {
      const order = await posPgService.processCheckout(body);
      return NextResponse.json({ success: true, data: order });
    }

    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SQLITE_IN_PRODUCTION) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_URL is not configured. PostgreSQL connection is required in production.' },
        { status: 503 }
      );
    }

    const order = posService.processCheckout(body);
    return NextResponse.json({ success: true, data: order });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
