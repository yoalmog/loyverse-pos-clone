import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authService } from '@/lib/auth-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();
    const products = db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.name ASC
    `).all();

    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC').all();
    return NextResponse.json({ success: true, data: { products, categories } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('x-pos-session');
    if (authHeader) {
      const auth = authService.verifyRequest(request, ['ADMIN', 'MANAGER']);
      if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
      }
    }

    const body = await request.json();
    const db = getDb();

    // Verify operator role if userId provided
    if (body.userId) {
      const user = db.prepare('SELECT id, role, active FROM users WHERE id = ?').get(body.userId) as any;
      if (!user || user.active !== 1 || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
        return NextResponse.json(
          { success: false, error: 'Usuario no autorizado para crear productos. Rol ADMIN o MANAGER requerido.' },
          { status: 403 }
        );
      }
    }

    const id = body.id || `prod_${Date.now()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO products (
        id, category_id, name, description, price, cost, sku, barcode, color,
        track_stock, stock_quantity, low_stock_threshold, is_composite, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)
    `).run(
      id,
      body.category_id || null,
      body.name,
      body.description || '',
      Math.round(body.price),
      Math.round(body.cost || 0),
      body.sku || null,
      body.barcode || null,
      body.color || '#10b981',
      body.track_stock ? 1 : 0,
      Number(body.stock_quantity || 0),
      Number(body.low_stock_threshold || 5),
      now,
      now
    );

    return NextResponse.json({ success: true, data: { id } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('x-pos-session');
    if (authHeader) {
      const auth = authService.verifyRequest(request, ['ADMIN', 'MANAGER']);
      if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
      }
    }

    const body = await request.json();
    const db = getDb();

    if (body.userId) {
      const user = db.prepare('SELECT id, role, active FROM users WHERE id = ?').get(body.userId) as any;
      if (!user || user.active !== 1 || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
        return NextResponse.json(
          { success: false, error: 'Usuario no autorizado para editar productos.' },
          { status: 403 }
        );
      }
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE products SET
        category_id = ?,
        name = ?,
        description = ?,
        price = ?,
        cost = ?,
        sku = ?,
        barcode = ?,
        color = ?,
        track_stock = ?,
        stock_quantity = ?,
        low_stock_threshold = ?,
        active = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      body.category_id || null,
      body.name,
      body.description || '',
      Math.round(body.price),
      Math.round(body.cost || 0),
      body.sku || null,
      body.barcode || null,
      body.color || '#10b981',
      body.track_stock ? 1 : 0,
      Number(body.stock_quantity || 0),
      Number(body.low_stock_threshold || 5),
      body.active === false ? 0 : 1,
      now,
      body.id
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('x-pos-session');
    if (authHeader) {
      const auth = authService.verifyRequest(request, ['ADMIN', 'MANAGER']);
      if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
      }
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'Product ID required' }, { status: 400 });

    const db = getDb();
    db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
