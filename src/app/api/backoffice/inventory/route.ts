import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.ts';
import { posService } from '@/lib/pos-service.ts';

export async function GET() {
  try {
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
    const body = await request.json();
    const { productId, variationId, changeAmount, reason, userId } = body;

    posService.adjustStock(productId, variationId || null, Number(changeAmount), reason || 'Ajuste manual', userId || 'usr_admin');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
