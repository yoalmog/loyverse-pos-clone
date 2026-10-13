import { NextResponse } from 'next/server';
import { posService } from '@/lib/pos-service.ts';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const order = posService.processCheckout(body);
    return NextResponse.json({ success: true, data: order });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
