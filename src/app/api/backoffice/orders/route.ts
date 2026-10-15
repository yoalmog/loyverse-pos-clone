import { NextResponse } from 'next/server';
import { posService } from '@/lib/pos-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

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
