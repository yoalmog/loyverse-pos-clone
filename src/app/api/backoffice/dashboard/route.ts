import { NextResponse } from 'next/server';
import { posService } from '@/lib/pos-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stats = posService.getDashboardStats();
    return NextResponse.json({ success: true, data: stats });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
