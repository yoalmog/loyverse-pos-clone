import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authService } from '@/lib/auth-service';
import { isPostgresConfigured, queryPgOne } from '@/lib/pg-db';
import { authPgService } from '@/lib/pg-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'default_client';
    const rateLimitKey = `auth_ip_${clientIp.split(',')[0].trim()}`;

    if (isPostgresConfigured()) {
      const rateLimit = await authPgService.checkRateLimit(rateLimitKey, 5, 60000, 60000);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: `Demasiados intentos fallidos. Reintente en ${rateLimit.retryAfterSeconds || 60} segundos.`,
          },
          { status: 429 }
        );
      }

      const body = await request.json();
      const { pin } = body;
      if (!pin || typeof pin !== 'string') {
        return NextResponse.json({ success: false, error: 'Debe ingresar un PIN de 4 dígitos' }, { status: 400 });
      }

      const user = await authPgService.authenticatePin(pin);
      if (!user) {
        await authPgService.recordFailedAttempt(rateLimitKey, 5, 60000);
        return NextResponse.json({ success: false, error: 'PIN incorrecto. Acceso denegado.' }, { status: 401 });
      }

      await authPgService.resetRateLimit(rateLimitKey);
      const session = await authPgService.createSession(user.id, user.role, 24);

      return NextResponse.json({
        success: true,
        token: session.token,
        expiresAt: session.expiresAt,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    }

    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SQLITE_IN_PRODUCTION) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_URL is not configured. PostgreSQL connection is required in production.' },
        { status: 503 }
      );
    }

    // 1. Check rate limit
    const rateLimit = authService.checkRateLimit(rateLimitKey, 5, 60000, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Demasiados intentos fallidos. Reintente en ${rateLimit.retryAfterSeconds || 60} segundos.`,
        },
        { status: 429 }
      );
    }

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
      authService.recordFailedAttempt(rateLimitKey, 5, 60000);
      return NextResponse.json(
        { success: false, error: 'PIN incorrecto. Acceso denegado.' },
        { status: 401 }
      );
    }

    // Reset rate limit on success
    authService.resetRateLimit(rateLimitKey);

    // Issue session token
    const session = authService.createSession(user.id, user.role, 24);

    return NextResponse.json({
      success: true,
      token: session.token,
      expiresAt: session.expiresAt,
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
