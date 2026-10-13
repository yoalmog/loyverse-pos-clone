import { NextResponse } from 'next/server';
import { posService } from '@/lib/pos-service.ts';
import { authService } from '@/lib/auth-service.ts';
import { getDb } from '@/lib/db.ts';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderId, userId, reason, supervisorPin } = body;
    if (!orderId || !userId) {
      return NextResponse.json({ success: false, error: 'Faltan parámetros requeridos' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization') || request.headers.get('x-pos-session');
    if (authHeader) {
      const auth = authService.verifyRequest(request, ['ADMIN', 'MANAGER']);
      if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
      }
      if (auth.user && auth.user.id !== userId && auth.user.role !== 'ADMIN') {
        return NextResponse.json({ success: false, error: 'Impersonación de usuario no autorizada' }, { status: 403 });
      }
    } else {
      const db = getDb();
      const user = db.prepare('SELECT id, role, active FROM users WHERE id = ?').get(userId) as any;
      if (!user || user.active !== 1) {
        return NextResponse.json({ success: false, error: 'Usuario no válido o inactivo' }, { status: 401 });
      }

      // Cashiers require supervisor PIN to authorize refund
      if (user.role === 'CASHIER') {
        if (!supervisorPin) {
          return NextResponse.json(
            { success: false, error: 'Permiso denegado: Los cajeros requieren PIN de supervisor para reembolsos' },
            { status: 403 }
          );
        }
        const supervisor = db
          .prepare('SELECT id, role FROM users WHERE pin = ? AND role IN ("ADMIN", "MANAGER") AND active = 1')
          .get(supervisorPin) as any;
        if (!supervisor) {
          return NextResponse.json({ success: false, error: 'PIN de supervisor inválido' }, { status: 403 });
        }
      }
    }

    const refunded = posService.refundOrder(orderId, userId, reason);
    return NextResponse.json({ success: true, data: refunded });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
