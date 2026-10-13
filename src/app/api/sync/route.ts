import { NextResponse } from 'next/server';
import { syncService } from '@/lib/sync-service.ts';

export async function GET() {
  try {
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

    const results = syncService.processSyncBatch(events);
    return NextResponse.json({ success: true, data: { results } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
