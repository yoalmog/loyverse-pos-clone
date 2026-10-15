import { NextResponse } from 'next/server';
import { posService } from '@/lib/pos-service';
import { isPostgresConfigured } from '@/lib/pg-db';
import { posPgService } from '@/lib/pg-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (isPostgresConfigured()) {
      const tickets = await posPgService.getOpenTickets();
      return NextResponse.json({ success: true, data: tickets });
    }

    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SQLITE_IN_PRODUCTION) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_URL is not configured. PostgreSQL connection is required in production.' },
        { status: 503 }
      );
    }

    const tickets = posService.getOpenTickets();
    return NextResponse.json({ success: true, data: tickets });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (isPostgresConfigured()) {
      const saved = await posPgService.saveOpenTicket(body);
      return NextResponse.json({ success: true, data: saved });
    }

    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SQLITE_IN_PRODUCTION) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_URL is not configured. PostgreSQL connection is required in production.' },
        { status: 503 }
      );
    }

    const saved = posService.saveOpenTicket(body);
    return NextResponse.json({ success: true, data: saved });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'Missing ticket ID' }, { status: 400 });

    if (isPostgresConfigured()) {
      await posPgService.deleteOpenTicket(id);
      return NextResponse.json({ success: true });
    }

    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SQLITE_IN_PRODUCTION) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_URL is not configured. PostgreSQL connection is required in production.' },
        { status: 503 }
      );
    }

    posService.deleteOpenTicket(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
