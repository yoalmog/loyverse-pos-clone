import { NextResponse } from 'next/server';
import { posService } from '@/lib/pos-service';
import { isPostgresConfigured } from '@/lib/pg-db';
import { posPgService } from '@/lib/pg-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (isPostgresConfigured()) {
      if (id) {
        const order = await posPgService.getOrderById(id);
        return NextResponse.json({ success: true, data: order });
      }
      const orders = await posPgService.getOrdersHistory(100);
      return NextResponse.json({ success: true, data: orders });
    }

    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SQLITE_IN_PRODUCTION) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_URL is not configured. PostgreSQL connection is required in production.' },
        { status: 503 }
      );
    }

    if (id) {
      const order = posService.getOrderById(id);
      return NextResponse.json({ success: true, data: order });
    }

    const orders = posService.getOrdersHistory(100);
    return NextResponse.json({ success: true, data: orders });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
