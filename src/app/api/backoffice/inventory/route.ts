import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { posService } from '@/lib/pos-service';
import { authService } from '@/lib/auth-service';
import { isPostgresConfigured, queryPgOne } from '@/lib/pg-db';
import { authPgService, backofficePgService, posPgService } from '@/lib/pg-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (isPostgresConfigured()) {
      const data = await backofficePgService.getInventory();
      return NextResponse.json({ success: true, data });
    }

    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SQLITE_IN_PRODUCTION) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_URL is not configured. PostgreSQL connection is required in production.' },
        { status: 503 }
      );
    }

    const db = getDb();
    const inventory = db.prepare(`
      SELECT p.id, p.name, p.sku, p.barcode, p.stock_quantity, p.low_stock_threshold, p.track_stock, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.active = 1
      ORDER BY p.stock_quantity ASC
    `).all();

    const logs = db.prepare(`
      SELECT l.*, p.name as product_name, u.name as user_name
      FROM inventory_logs l
      JOIN products p ON l.product_id = p.id
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.created_at DESC
      LIMIT 50
    `).all();

    return NextResponse.json({ success: true, data: { inventory, logs } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('x-pos-session');

    if (isPostgresConfigured()) {
      if (authHeader) {
        const auth = await authPgService.verifyRequest(request, ['ADMIN', 'MANAGER']);
        if (!auth.authorized) {
          return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
        }
      }

      const body = await request.json();
      const { productId, variationId, changeAmount, reason, userId } = body;
      const operatorId = userId || 'usr_admin';

      const user = await queryPgOne('SELECT id, role, active FROM users WHERE id = $1', [operatorId]);
      if (!user || user.active !== 1 || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
        return NextResponse.json(
          { success: false, error: 'Usuario no autorizado para modificar inventario. Se requiere rol ADMIN o MANAGER.' },
          { status: 403 }
        );
      }

      await posPgService.adjustStock(productId, variationId || null, Number(changeAmount), reason || 'Ajuste manual', operatorId);
      return NextResponse.json({ success: true });
    }

    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SQLITE_IN_PRODUCTION) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_URL is not configured. PostgreSQL connection is required in production.' },
        { status: 503 }
      );
    }

    if (authHeader) {
      const auth = authService.verifyRequest(request, ['ADMIN', 'MANAGER']);
      if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
      }
    }

    const body = await request.json();
    const { productId, variationId, changeAmount, reason, userId } = body;
    const operatorId = userId || 'usr_admin';

    const db = getDb();
    const user = db.prepare('SELECT id, role, active FROM users WHERE id = ?').get(operatorId) as any;
    if (!user || user.active !== 1 || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      return NextResponse.json(
        { success: false, error: 'Usuario no autorizado para modificar inventario. Se requiere rol ADMIN o MANAGER.' },
        { status: 403 }
      );
    }

    posService.adjustStock(productId, variationId || null, Number(changeAmount), reason || 'Ajuste manual', operatorId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
