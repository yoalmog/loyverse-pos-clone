import { NextResponse } from 'next/server';
import { posService } from '@/lib/pos-service';
import { isPostgresConfigured } from '@/lib/pg-db';
import { posPgService } from '@/lib/pg-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (isPostgresConfigured()) {
      const shift = await posPgService.getCurrentShift();
      return NextResponse.json({ success: true, data: shift });
    }

    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SQLITE_IN_PRODUCTION) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_URL is not configured. PostgreSQL connection is required in production.' },
        { status: 503 }
      );
    }

    const shift = posService.getCurrentShift();
    return NextResponse.json({ success: true, data: shift });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (isPostgresConfigured()) {
      if (action === 'OPEN') {
        const shift = await posPgService.openShift(body.userId, body.openingCashCents, body.note);
        return NextResponse.json({ success: true, data: shift });
      } else if (action === 'CLOSE') {
        const shift = await posPgService.closeShift(body.shiftId, body.actualCashCents, body.note);
        return NextResponse.json({ success: true, data: shift });
      } else if (action === 'CASH_MOVEMENT') {
        const movement = await posPgService.recordCashMovement({
          shiftId: body.shiftId,
          userId: body.userId,
          type: body.type,
          amount: body.amount,
          reason: body.reason,
        });
        return NextResponse.json({ success: true, data: movement });
      }
      return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 });
    }

    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SQLITE_IN_PRODUCTION) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_URL is not configured. PostgreSQL connection is required in production.' },
        { status: 503 }
      );
    }

    if (action === 'OPEN') {
      const shift = posService.openShift(body.userId, body.openingCashCents, body.note);
      return NextResponse.json({ success: true, data: shift });
    } else if (action === 'CLOSE') {
      const shift = posService.closeShift(body.shiftId, body.actualCashCents, body.note);
      return NextResponse.json({ success: true, data: shift });
    } else if (action === 'CASH_MOVEMENT') {
      const movement = posService.recordCashMovement({
        shiftId: body.shiftId,
        userId: body.userId,
        type: body.type,
        amount: body.amount,
        reason: body.reason,
      });
      return NextResponse.json({ success: true, data: movement });
    }

    return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
