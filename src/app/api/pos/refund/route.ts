import { NextResponse } from 'next/server';
import { posService } from '@/lib/pos-service.ts';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderId, userId, reason } = body;
    if (!orderId || !userId) {
      return NextResponse.json({ success: false, error: 'Faltan parámetros requeridos' }, { status: 400 });
    }

    const refunded = posService.refundOrder(orderId, userId, reason);
    return NextResponse.json({ success: true, data: refunded });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
