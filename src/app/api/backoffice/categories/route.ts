import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isPostgresConfigured, queryPgOne } from '@/lib/pg-db';
import { authPgService, backofficePgService } from '@/lib/pg-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (isPostgresConfigured()) {
      const categories = await backofficePgService.getCategories();
      return NextResponse.json({ success: true, data: categories });
    }

    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SQLITE_IN_PRODUCTION) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_URL is not configured. PostgreSQL connection is required in production.' },
        { status: 503 }
      );
    }

    const db = getDb();
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC').all();
    return NextResponse.json({ success: true, data: categories });
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
      if (!body.name || !body.name.trim()) {
        return NextResponse.json({ success: false, error: 'Category name is required' }, { status: 400 });
      }

      const category = await backofficePgService.createCategory(body);
      return NextResponse.json({ success: true, data: category });
    }

    const db = getDb();
    const body = await request.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ success: false, error: 'Category name is required' }, { status: 400 });
    }

    const id = body.id || `cat_${Date.now()}`;
    const name = body.name.trim();
    const color = body.color || '#3b82f6';
    const sort_order = Number(body.sort_order ?? body.sortOrder ?? 0);

    db.prepare('INSERT OR REPLACE INTO categories (id, name, color, sort_order) VALUES (?, ?, ?, ?)').run(
      id,
      name,
      color,
      sort_order
    );

    return NextResponse.json({ success: true, data: { id, name, color, sort_order } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
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
      if (!body.id) {
        return NextResponse.json({ success: false, error: 'Category ID is required' }, { status: 400 });
      }

      const category = await backofficePgService.updateCategory(body);
      return NextResponse.json({ success: true, data: category });
    }

    const db = getDb();
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ success: false, error: 'Category ID is required' }, { status: 400 });
    }

    db.prepare('UPDATE categories SET name = ?, color = ?, sort_order = ? WHERE id = ?').run(
      body.name.trim(),
      body.color || '#3b82f6',
      Number(body.sort_order ?? body.sortOrder ?? 0),
      body.id
    );

    return NextResponse.json({ success: true, data: body });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Category ID is required' }, { status: 400 });
    }

    if (isPostgresConfigured()) {
      await backofficePgService.deleteCategory(id);
      return NextResponse.json({ success: true });
    }

    const db = getDb();
    db.prepare('UPDATE products SET category_id = NULL WHERE category_id = ?').run(id);
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
