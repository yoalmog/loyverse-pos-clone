import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.ts';

export async function GET() {
  try {
    const db = getDb();
    const store = db.prepare('SELECT * FROM stores LIMIT 1').get();
    const users = db.prepare('SELECT id, name, email, role, active, created_at FROM users').all();
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all();
    const discounts = db.prepare('SELECT * FROM discounts ORDER BY name ASC').all();
    const diningOptions = db.prepare('SELECT * FROM dining_options ORDER BY name ASC').all();

    return NextResponse.json({
      success: true,
      data: { store, users, categories, discounts, diningOptions }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const db = getDb();

    db.prepare(`
      UPDATE stores SET
        name = ?,
        legal_name = ?,
        tax_id = ?,
        address = ?,
        phone = ?,
        email = ?,
        currency_code = ?,
        currency_symbol = ?,
        tax_rate = ?,
        tax_name = ?,
        tax_type = ?,
        receipt_header = ?,
        receipt_footer = ?
      WHERE id = 'store_default'
    `).run(
      body.name,
      body.legal_name || '',
      body.tax_id || '',
      body.address || '',
      body.phone || '',
      body.email || '',
      body.currency_code || 'PEN',
      body.currency_symbol || 'S/',
      Number(body.tax_rate),
      body.tax_name || 'IGV',
      body.tax_type || 'INCLUDED',
      body.receipt_header || '',
      body.receipt_footer || ''
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
