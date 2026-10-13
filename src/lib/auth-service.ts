import crypto from 'crypto';
import { getDb } from './db.ts';

export interface UserSession {
  token: string;
  userId: string;
  role: string;
  expiresAt: string;
  createdAt: string;
}

export const authService = {
  /**
   * Check rate limit for an identifier (e.g. IP or PIN attempt key)
   * Max 5 attempts per windowMs (default 60s), locks for lockoutMs (default 60s)
   */
  checkRateLimit(key: string, maxAttempts = 5, windowMs = 60000, lockoutMs = 60000): { allowed: boolean; retryAfterSeconds?: number } {
    const db = getDb();
    const now = Date.now();

    // Ensure table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS auth_rate_limits (
        key TEXT PRIMARY KEY,
        attempts INTEGER NOT NULL DEFAULT 1,
        first_attempt_at INTEGER NOT NULL,
        locked_until INTEGER DEFAULT 0
      );
    `);

    const record = db.prepare('SELECT * FROM auth_rate_limits WHERE key = ?').get(key) as any;

    if (!record) {
      return { allowed: true };
    }

    if (record.locked_until && record.locked_until > now) {
      const wait = Math.ceil((record.locked_until - now) / 1000);
      return { allowed: false, retryAfterSeconds: wait };
    }

    // Reset if window has elapsed
    if (now - record.first_attempt_at > windowMs) {
      db.prepare('DELETE FROM auth_rate_limits WHERE key = ?').run(key);
      return { allowed: true };
    }

    if (record.attempts >= maxAttempts) {
      const lockedUntil = now + lockoutMs;
      db.prepare('UPDATE auth_rate_limits SET locked_until = ? WHERE key = ?').run(lockedUntil, key);
      return { allowed: false, retryAfterSeconds: Math.ceil(lockoutMs / 1000) };
    }

    return { allowed: true };
  },

  recordFailedAttempt(key: string, maxAttempts = 5, lockoutMs = 60000) {
    const db = getDb();
    const now = Date.now();

    const record = db.prepare('SELECT * FROM auth_rate_limits WHERE key = ?').get(key) as any;
    if (!record) {
      db.prepare('INSERT INTO auth_rate_limits (key, attempts, first_attempt_at, locked_until) VALUES (?, 1, ?, 0)').run(key, now);
    } else {
      const nextAttempts = record.attempts + 1;
      const lockedUntil = nextAttempts >= maxAttempts ? now + lockoutMs : 0;
      db.prepare('UPDATE auth_rate_limits SET attempts = ?, locked_until = ? WHERE key = ?').run(nextAttempts, lockedUntil, key);
    }
  },

  resetRateLimit(key: string) {
    const db = getDb();
    db.prepare('DELETE FROM auth_rate_limits WHERE key = ?').run(key);
  },

  /**
   * Create an authenticated session token for a user
   */
  createSession(userId: string, role: string, durationHours = 24): UserSession {
    const db = getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token);
    `);

    const token = `pos_sec_${crypto.randomBytes(24).toString('hex')}`;
    const now = new Date();
    const expires = new Date(now.getTime() + durationHours * 3600 * 1000);

    const session: UserSession = {
      token,
      userId,
      role,
      expiresAt: expires.toISOString(),
      createdAt: now.toISOString(),
    };

    db.prepare(`
      INSERT INTO user_sessions (token, user_id, role, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(session.token, session.userId, session.role, session.expiresAt, session.createdAt);

    return session;
  },

  /**
   * Verify an incoming session token
   */
  verifySession(token: string): { valid: boolean; user?: { id: string; role: string }; error?: string } {
    if (!token) return { valid: false, error: 'Token no proporcionado' };

    const db = getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    const session = db.prepare('SELECT * FROM user_sessions WHERE token = ?').get(token) as any;
    if (!session) {
      return { valid: false, error: 'Sesión no encontrada o inválida' };
    }

    const now = new Date().toISOString();
    if (session.expires_at < now) {
      db.prepare('DELETE FROM user_sessions WHERE token = ?').run(token);
      return { valid: false, error: 'Sesión expirada' };
    }

    return {
      valid: true,
      user: {
        id: session.user_id,
        role: session.role,
      },
    };
  },

  /**
   * Revoke session on logout
   */
  revokeSession(token: string) {
    const db = getDb();
    db.prepare('DELETE FROM user_sessions WHERE token = ?').run(token);
  },

  /**
   * Verify an HTTP request against role requirements
   */
  verifyRequest(request: Request, allowedRoles?: string[]): {
    authorized: boolean;
    user?: { id: string; role: string };
    error?: string;
    status: number;
  } {
    const authHeader = request.headers.get('authorization') || '';
    const sessionHeader = request.headers.get('x-pos-session') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : sessionHeader;

    if (!token) {
      return { authorized: false, error: 'Autenticación requerida. Token de sesión ausente.', status: 401 };
    }

    const verification = this.verifySession(token);
    if (!verification.valid || !verification.user) {
      return { authorized: false, error: verification.error || 'Token inválido', status: 401 };
    }

    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(verification.user.role)) {
      return {
        authorized: false,
        error: `Acceso denegado: rol ${verification.user.role} no tiene permisos suficientes`,
        status: 403,
      };
    }

    return { authorized: true, user: verification.user, status: 200 };
  },
};
