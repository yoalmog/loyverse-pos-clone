import { NextResponse } from 'next/server';
import { posService } from '@/lib/pos-service.ts';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const catalog = posService.getCatalog();
    return NextResponse.json({ success: true, data: catalog });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
