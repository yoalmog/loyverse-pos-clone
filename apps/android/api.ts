/**
 * Android Cashier POS - API Client & Offline Sync Service
 * Connects to the shared backend (/api/pos/* and /api/sync)
 */

import { storage } from './storage';

export const STORAGE_KEYS = {
  API_URL: 'loyverse_api_url',
  CATALOG_CACHE: 'loyverse_catalog_cache',
  OFFLINE_QUEUE: 'loyverse_offline_queue',
  SALES_HISTORY: 'loyverse_sales_history',
  CURRENT_USER: 'loyverse_current_user',
  ACTIVE_SHIFT: 'loyverse_active_shift',
  SESSION_TOKEN: 'loyverse_session_token',
};

// Default API URL: supports build-time EXPO_PUBLIC_POS_URL, with local fallback for emulator
export const DEFAULT_API_URL = process.env.EXPO_PUBLIC_POS_URL || process.env.POS_URL || 'http://10.0.2.2:3001';
export const WEB_API_URL = process.env.EXPO_PUBLIC_POS_URL || process.env.POS_URL || 'http://localhost:3001';

const DEFAULT_TIMEOUT_MS = 6000;

export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function getBaseApiUrl(): Promise<string> {
  const saved = await storage.getItem(STORAGE_KEYS.API_URL);
  if (saved) return saved;
  // If running in browser or Node
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  return DEFAULT_API_URL;
}

export async function setBaseApiUrl(url: string): Promise<void> {
  const sanitized = url.trim().replace(/\/+$/, '');
  const current = await storage.getItem(STORAGE_KEYS.API_URL);
  if (current !== sanitized) {
    // Invalidate prior server credentials when switching hosts
    await storage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
    await storage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }
  await storage.setItem(STORAGE_KEYS.API_URL, sanitized);
}

export interface OfflineSyncEvent {
  id: string; // client UUID
  idempotencyKey: string;
  deviceId: string;
  eventType: 'CHECKOUT' | 'CASH_MOVEMENT' | 'REFUND';
  payload: any;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  retryCount: number;
  errorMessage?: string | null;
  createdAt: string;
}

export const posApi = {
  /**
   * Test network connectivity and measure latency to the target backend
   */
  async testConnection(targetUrl?: string): Promise<{
    ok: boolean;
    latencyMs: number;
    url: string;
    isHttps: boolean;
    isLocal: boolean;
    error?: string;
  }> {
    const url = (targetUrl || (await getBaseApiUrl())).replace(/\/+$/, '');
    const isHttps = url.startsWith('https://');
    const isLocal =
      url.includes('localhost') ||
      url.includes('127.0.0.1') ||
      url.includes('10.0.2.2') ||
      /^http:\/\/192\.168\./.test(url) ||
      /^http:\/\/10\./.test(url) ||
      /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\./.test(url);

    const start = Date.now();
    try {
      const res = await fetchWithTimeout(`${url}/api/pos/catalog`, { method: 'GET' }, 5000);
      const latencyMs = Date.now() - start;
      if (res.ok) {
        return { ok: true, latencyMs, url, isHttps, isLocal };
      }
      return { ok: false, latencyMs, url, isHttps, isLocal, error: `HTTP ${res.status}: ${res.statusText}` };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return {
        ok: false,
        latencyMs,
        url,
        isHttps,
        isLocal,
        error: err.name === 'AbortError' ? 'Tiempo de espera agotado (Timeout 5s)' : (err.message || 'Error de red'),
      };
    }
  },

  /**
   * Authenticate employee PIN with the server and store session token
   */
  async authenticatePin(pin: string): Promise<{ success: boolean; user?: any; token?: string; error?: string }> {
    const baseUrl = await getBaseApiUrl();
    try {
      const res = await fetchWithTimeout(`${baseUrl}/api/pos/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      }, 5000);
      const json = await res.json();
      if (res.ok && json.success) {
        if (json.token) {
          await storage.setItem(STORAGE_KEYS.SESSION_TOKEN, json.token);
        }
        if (json.user) {
          await storage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(json.user));
        }
        return { success: true, user: json.user, token: json.token };
      }
      return { success: false, error: json.error || 'PIN incorrecto' };
    } catch (err: any) {
      console.warn('[API] Auth offline fallback:', err.message);
      const cached = await storage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (cached) {
        const user = JSON.parse(cached);
        return { success: true, user };
      }
      return { success: false, error: 'Sin conexión con el servidor POS' };
    }
  },

  /**
   * Fetch live catalog with automatic fallback to persistent local cache
   */
  async getCatalog(): Promise<{ data: any; fromCache: boolean }> {
    const baseUrl = await getBaseApiUrl();
    try {
      const res = await fetchWithTimeout(`${baseUrl}/api/pos/catalog`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      }, 6000);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = await res.json();
      if (json.success && json.data) {
        // Update persistent cache
        await storage.setItem(STORAGE_KEYS.CATALOG_CACHE, JSON.stringify(json.data));
        return { data: json.data, fromCache: false };
      }
      throw new Error(json.error || 'Failed to load catalog');
    } catch (err) {
      console.warn('[API] Catalog network request failed, falling back to cache:', err);
      const cached = await storage.getItem(STORAGE_KEYS.CATALOG_CACHE);
      if (cached) {
        return { data: JSON.parse(cached), fromCache: true };
      }
      throw err;
    }
  },

  /**
   * Execute checkout:
   * If online, sends direct POST /api/pos/checkout.
   * If offline or network error, queues into local persistent queue.
   */
  async checkout(payload: {
    idempotencyKey: string;
    userId: string;
    shiftId?: string | null;
    customerId?: string | null;
    diningOptionId?: string | null;
    paymentMethod: 'CASH' | 'CARD' | 'WALLET' | 'OTHER';
    cashTendered?: number;
    items: any[];
    orderNote?: string | null;
    ticketName?: string | null;
  }): Promise<{ order: any; isOffline: boolean }> {
    const baseUrl = await getBaseApiUrl();

    try {
      const res = await fetchWithTimeout(`${baseUrl}/api/pos/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': payload.idempotencyKey,
        },
        body: JSON.stringify(payload),
      }, 7000);

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return { order: json.data, isOffline: false };
        }
        throw new Error(json.error || 'Checkout returned error');
      }

      // If server returned 4xx business error (e.g. insufficient cash), throw directly
      if (res.status >= 400 && res.status < 500) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Error ${res.status} en checkout`);
      }

      throw new Error(`Server status ${res.status}`);
    } catch (networkErr: any) {
      // If it is a business error thrown above, rethrow
      if (networkErr.message?.includes('Monto recibido')) {
        throw networkErr;
      }

      console.warn('[API] Online checkout unreachable. Queueing offline:', networkErr.message);

      // Save to offline queue
      const offlineEvent: OfflineSyncEvent = {
        id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        idempotencyKey: payload.idempotencyKey,
        deviceId: 'android_pos_client',
        eventType: 'CHECKOUT',
        payload,
        status: 'PENDING',
        retryCount: 0,
        createdAt: new Date().toISOString(),
      };

      await this.enqueueOfflineEvent(offlineEvent);

      // Build simulated canonical order snapshot for receipt
      const localReceiptNumber = `OFF-REC-${Date.now().toString().slice(-6)}`;
      const subtotal = payload.items.reduce((acc, it) => acc + (it.unitPrice * it.quantity), 0);
      const tax = Math.round(subtotal - (subtotal / 1.18));
      const grandTotal = subtotal;
      const tendered = payload.paymentMethod === 'CASH' ? (payload.cashTendered ?? grandTotal) : grandTotal;

      const offlineOrder = {
        id: offlineEvent.id,
        receipt_number: localReceiptNumber,
        shift_id: payload.shiftId,
        user_id: payload.userId,
        total: grandTotal,
        subtotal,
        tax_total: tax,
        discount_total: 0,
        status: 'PENDING_SYNC',
        is_offline: true,
        created_at: offlineEvent.createdAt,
        items: payload.items.map((it, idx) => ({
          id: `item_${idx}_${Date.now()}`,
          product_name: it.productName,
          quantity: it.quantity,
          unit_price: it.unitPrice,
          total: it.unitPrice * it.quantity,
        })),
        payments: [{
          id: `pay_${Date.now()}`,
          payment_method: payload.paymentMethod,
          amount: grandTotal,
          cash_tendered: tendered,
          change_due: Math.max(0, tendered - grandTotal),
        }],
      };

      return { order: offlineOrder, isOffline: true };
    }
  },

  /**
   * Enqueue event to persistent offline queue
   */
  async enqueueOfflineEvent(event: OfflineSyncEvent): Promise<void> {
    const raw = await storage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    const queue: OfflineSyncEvent[] = raw ? JSON.parse(raw) : [];
    queue.push(event);
    await storage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
  },

  /**
   * Get pending offline events
   */
  async getOfflineQueue(): Promise<OfflineSyncEvent[]> {
    const raw = await storage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    return raw ? JSON.parse(raw) : [];
  },

  /**
   * Flush / sync the offline queue with the backend
   */
  async flushOfflineQueue(): Promise<{ syncedCount: number; failedCount: number; results: any[] }> {
    const queue = await this.getOfflineQueue();
    const pending = queue.filter(e => e.status === 'PENDING' || e.status === 'FAILED');
    if (pending.length === 0) {
      return { syncedCount: 0, failedCount: 0, results: [] };
    }

    const baseUrl = await getBaseApiUrl();
    const payloadEvents = pending.map(e => ({
      id: e.id,
      idempotencyKey: e.idempotencyKey,
      deviceId: e.deviceId,
      eventType: e.eventType,
      payload: e.payload,
    }));

    try {
      const res = await fetchWithTimeout(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: payloadEvents }),
      }, 8000);

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = await res.json();
      const results = json.data?.results || json.results;
      if (!json.success || !results) throw new Error('Sync batch failed');

      // Update local queue with results
      let syncedCount = 0;
      let failedCount = 0;
      const updatedQueue = queue.map(item => {
        const result = results.find((r: any) => r.idempotencyKey === item.idempotencyKey || r.eventId === item.id);
        if (result) {
          if (result.status === 'SYNCED' || result.status === 'ALREADY_SYNCED') {
            syncedCount++;
            return { ...item, status: 'SYNCED' as const, errorMessage: null };
          } else {
            failedCount++;
            return { ...item, status: 'FAILED' as const, retryCount: item.retryCount + 1, errorMessage: result.error };
          }
        }
        return item;
      });

      // Keep only recent or failed items in queue
      const remaining = updatedQueue.filter(e => e.status !== 'SYNCED');
      await storage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(remaining));

      return { syncedCount, failedCount, results };
    } catch (err: any) {
      console.warn('[Sync] Flush batch failed:', err.message);
      return { syncedCount: 0, failedCount: pending.length, results: [] };
    }
  },

  /**
   * Open Shift on server
   */
  async openShift(userId: string, openingCashCents: number): Promise<any> {
    const baseUrl = await getBaseApiUrl();
    const res = await fetchWithTimeout(`${baseUrl}/api/pos/shift`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'OPEN', userId, openingCashCents }),
    }, 5000);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to open shift');
    return json.data;
  },

  /**
   * Close Shift on server
   */
  async closeShift(shiftId: string, actualCashCents: number): Promise<any> {
    const baseUrl = await getBaseApiUrl();
    const res = await fetchWithTimeout(`${baseUrl}/api/pos/shift`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'CLOSE', shiftId, actualCashCents }),
    }, 5000);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to close shift');
    return json.data;
  },

  /**
   * Refund an order
   */
  async refundOrder(orderId: string, userId: string, reason: string): Promise<any> {
    const baseUrl = await getBaseApiUrl();
    const res = await fetchWithTimeout(`${baseUrl}/api/pos/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, userId, reason }),
    }, 5000);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to refund order');
    return json.data;
  },
};
