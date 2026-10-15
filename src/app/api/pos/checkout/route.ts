import { NextResponse } from 'next/server';
import { posService } from '@/lib/pos-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const idempotencyHeader = request.headers.get('idempotency-key') || request.headers.get('x-idempotency-key');
    if (idempotencyHeader && !body.idempotencyKey) {
      body.idempotencyKey = idempotencyHeader;
    }
    const order = posService.processCheckout(body);
    return NextResponse.json({ success: true, data: order });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
