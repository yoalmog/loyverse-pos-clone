import { NextResponse } from 'next/server';
import { posService } from '@/lib/pos-service.ts';

export async function GET() {
  try {
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
