import { getDb } from './db.ts';
import { posService } from './pos-service.ts';
import type { CheckoutInput } from './pos-service.ts';
import { z } from 'zod';

export interface SyncEvent {
  id: string; // client generated UUID
  idempotencyKey: string;
  deviceId: string;
  eventType: 'CHECKOUT' | 'CASH_MOVEMENT' | 'REFUND';
  payload: any;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  retryCount: number;
  errorMessage?: string | null;
  createdAt: string;
  syncedAt?: string | null;
}

export const SyncEventSchema = z.object({
  id: z.string().min(1),
  idempotencyKey: z.string().min(1),
  deviceId: z.string().min(1),
  eventType: z.enum(['CHECKOUT', 'CASH_MOVEMENT', 'REFUND']),
  payload: z.any(),
  status: z.enum(['PENDING', 'SYNCING', 'SYNCED', 'FAILED']).default('PENDING'),
  retryCount: z.number().default(0),
  createdAt: z.string(),
});

export const syncService = {
  /**
   * Initializes the offline queue table if not already created
   */
  ensureQueueTable() {
    const db = getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        idempotency_key TEXT UNIQUE NOT NULL,
        device_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        retry_count INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        result_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced_at DATETIME
      );

      CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_idempotency ON sync_queue(idempotency_key);
    `);
  },

  /**
   * Enqueue an event in the local/offline queue
   */
  enqueueEvent(event: {
    id?: string;
    idempotencyKey: string;
    deviceId: string;
    eventType: 'CHECKOUT' | 'CASH_MOVEMENT' | 'REFUND';
    payload: any;
  }): SyncEvent {
    this.ensureQueueTable();
    const db = getDb();
    const id = event.id || `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO sync_queue (id, idempotency_key, device_id, event_type, payload_json, status, retry_count, created_at)
      VALUES (?, ?, ?, ?, ?, 'PENDING', 0, ?)
    `).run(
      id,
      event.idempotencyKey,
      event.deviceId,
      event.eventType,
      JSON.stringify(event.payload),
      now
    );

    return this.getEventById(id)!;
  },

  getEventById(id: string): SyncEvent | null {
    this.ensureQueueTable();
    const db = getDb();
    const row = db.prepare('SELECT * FROM sync_queue WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      idempotencyKey: row.idempotency_key,
      deviceId: row.device_id,
      eventType: row.event_type,
      payload: JSON.parse(row.payload_json),
      status: row.status,
      retryCount: row.retry_count,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      syncedAt: row.synced_at,
    };
  },

  getPendingEvents(limit = 50): SyncEvent[] {
    this.ensureQueueTable();
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM sync_queue 
      WHERE status IN ('PENDING', 'FAILED') AND retry_count < 5 
      ORDER BY created_at ASC 
      LIMIT ?
    `).all(limit) as any[];

    return rows.map(r => ({
      id: r.id,
      idempotencyKey: r.idempotency_key,
      deviceId: r.device_id,
      eventType: r.event_type,
      payload: JSON.parse(r.payload_json),
      status: r.status,
      retryCount: r.retry_count,
      errorMessage: r.error_message,
      createdAt: r.created_at,
      syncedAt: r.synced_at,
    }));
  },

  /**
   * Process a batch of sync events idempotently
   */
  processSyncBatch(events: Array<{
    id: string;
    idempotencyKey: string;
    deviceId: string;
    eventType: 'CHECKOUT' | 'CASH_MOVEMENT' | 'REFUND';
    payload: any;
  }>) {
    this.ensureQueueTable();
    const db = getDb();
    const results: any[] = [];

    for (const evt of events) {
      // 1. Check idempotency: Was this idempotencyKey already successfully processed?
      const existing = db.prepare('SELECT * FROM sync_queue WHERE idempotency_key = ?').get(evt.idempotencyKey) as any;
      if (existing && existing.status === 'SYNCED') {
        results.push({
          eventId: evt.id,
          idempotencyKey: evt.idempotencyKey,
          status: 'ALREADY_SYNCED',
          result: existing.result_json ? JSON.parse(existing.result_json) : null,
        });
        continue;
      }

      // If record not in db yet, record it as SYNCING
      if (!existing) {
        db.prepare(`
          INSERT INTO sync_queue (id, idempotency_key, device_id, event_type, payload_json, status, retry_count, created_at)
          VALUES (?, ?, ?, ?, ?, 'SYNCING', 0, ?)
        `).run(
          evt.id,
          evt.idempotencyKey,
          evt.deviceId,
          evt.eventType,
          JSON.stringify(evt.payload),
          new Date().toISOString()
        );
      } else {
        db.prepare("UPDATE sync_queue SET status = 'SYNCING' WHERE id = ?").run(existing.id);
      }

      // 2. Execute business operation according to event type
      try {
        let opResult: any = null;

        if (evt.eventType === 'CHECKOUT') {
          opResult = posService.processCheckout(evt.payload as CheckoutInput);
        } else if (evt.eventType === 'CASH_MOVEMENT') {
          opResult = posService.recordCashMovement(evt.payload);
        } else if (evt.eventType === 'REFUND') {
          opResult = posService.refundOrder(evt.payload.orderId, evt.payload.userId, evt.payload.reason);
        }

        const now = new Date().toISOString();
        db.prepare(`
          UPDATE sync_queue 
          SET status = 'SYNCED', synced_at = ?, result_json = ?, error_message = NULL 
          WHERE idempotency_key = ?
        `).run(now, JSON.stringify(opResult), evt.idempotencyKey);

        results.push({
          eventId: evt.id,
          idempotencyKey: evt.idempotencyKey,
          status: 'SYNCED',
          result: opResult,
        });
      } catch (err: any) {
        db.prepare(`
          UPDATE sync_queue 
          SET status = 'FAILED', retry_count = retry_count + 1, error_message = ? 
          WHERE idempotency_key = ?
        `).run(err.message, evt.idempotencyKey);

        results.push({
          eventId: evt.id,
          idempotencyKey: evt.idempotencyKey,
          status: 'FAILED',
          error: err.message,
        });
      }
    }

    return results;
  },

  getSyncStatus() {
    this.ensureQueueTable();
    const db = getDb();
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_events,
        COALESCE(SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END), 0) as pending_count,
        COALESCE(SUM(CASE WHEN status = 'SYNCED' THEN 1 ELSE 0 END), 0) as synced_count,
        COALESCE(SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END), 0) as failed_count
      FROM sync_queue
    `).get() as any;

    return stats;
  }
};
