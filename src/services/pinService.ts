const PREFIX = 'pbkdf2-sha256';
const ITERATIONS = 100_000;
const THROTTLE_KEY = 'aurapos_pin_throttle_v1';
const FREE_ATTEMPTS = 5;
const BASE_LOCK_MS = 30_000;
const MAX_LOCK_MS = 15 * 60_000;
const enc = new TextEncoder();

const toB64 = (bytes: Uint8Array): string => {
  let s = '';
  bytes.forEach(b => (s += String.fromCharCode(b)));
  return btoa(s);
};
const fromB64 = (b64: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(b64), c => c.charCodeAt(0));
const safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Secure PIN hashing requires HTTPS or localhost.');
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return toB64(new Uint8Array(bits));
}

type ThrottleState = Record<string, { count: number; lockedUntil: number }>;
const readThrottle = (): ThrottleState => {
  try { return JSON.parse(localStorage.getItem(THROTTLE_KEY) || '{}'); } catch { return {}; }
};
const writeThrottle = (state: ThrottleState): void => {
  try { localStorage.setItem(THROTTLE_KEY, JSON.stringify(state)); } catch {}
};

export class PinService {
  static isValidFormat(pin: string): boolean { return /^\d{4}$/.test(pin); }
  static isHashed(stored: string): boolean { return typeof stored === 'string' && stored.startsWith(`${PREFIX}$`); }
  static async hash(pin: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
    const hash = await derive(pin, salt, ITERATIONS);
    return `${PREFIX}$${ITERATIONS}$${toB64(salt)}$${hash}`;
  }
  static async verify(pin: string, stored: string): Promise<boolean> {
    if (!stored) return false;
    if (!this.isHashed(stored)) return safeEqual(pin, stored); // legacy plaintext until migrated
    const [, iterStr, saltB64, hashB64] = stored.split('$');
    const iterations = parseInt(iterStr, 10);
    if (!iterations || !saltB64 || !hashB64) return false;
    try { return safeEqual(await derive(pin, fromB64(saltB64), iterations), hashB64); } catch { return false; }
  }
  static getLockRemainingMs(scope: string): number {
    const e = readThrottle()[scope];
    return e ? Math.max(0, e.lockedUntil - Date.now()) : 0;
  }
  static recordFailure(scope: string): number {
    const state = readThrottle();
    const entry = state[scope] || { count: 0, lockedUntil: 0 };
    entry.count += 1;
    let lockMs = 0;
    if (entry.count >= FREE_ATTEMPTS) {
      lockMs = Math.min(BASE_LOCK_MS * 2 ** (entry.count - FREE_ATTEMPTS), MAX_LOCK_MS);
      entry.lockedUntil = Date.now() + lockMs;
    }
    state[scope] = entry;
    writeThrottle(state);
    return lockMs;
  }
  static recordSuccess(scope: string): void {
    const state = readThrottle();
    if (state[scope]) { delete state[scope]; writeThrottle(state); }
  }
}
