import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.ts';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pin } = body;

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Debe ingresar un PIN de 4 dígitos' },
        { status: 400 }
      );
    }

    const db = getDb();
    const user = db
      .prepare('SELECT id, name, email, role FROM users WHERE pin = ? AND active = 1')
      .get(pin) as { id: string; name: string; email: string; role: string } | undefined;

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'PIN incorrecto. Acceso denegado.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error en autenticación' },
      { status: 500 }
    );
  }
}
