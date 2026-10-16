import { supabase, isSupabaseConfigured } from '../supabase/supabaseClient.ts';
import { LocalDB } from '../db/localDatabase.ts';

export interface SyncEvent {
  id?: string;
  clientEventId: string;
  storeId: string;
  terminalId?: string;
  entityType: string;
  entityId: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
  status?: 'PENDING' | 'PROCESSED' | 'FAILED';
  errorMessage?: string;
  createdAt?: string;
}

export class SyncRepository {
  /**
   * Persist event locally first (Section 17)
   */
  static async recordEvent(event: SyncEvent): Promise<void> {
    const eventId = event.id || `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = event.createdAt || new Date().toISOString();

    const record: SyncEvent = {
      ...event,
      id: eventId,
      status: event.status || 'PENDING',
      createdAt: nowIso
    };

    // 1. Write to local database
    await LocalDB.put('sync_events', record);

    // 2. Mirror to Supabase if configured and online
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('sync_events').upsert({
          client_event_id: event.clientEventId,
          store_id: event.storeId,
          terminal_id: event.terminalId || null,
          entity_type: event.entityType,
          entity_id: event.entityId,
          operation: event.operation,
          payload: event.payload,
          status: record.status
        });
      } catch (e: any) {
        console.warn('[SyncRepository] Background sync event mirror notice:', e?.message);
      }
    }
  }

  static async getPendingEvents(): Promise<SyncEvent[]> {
    try {
      const all = await LocalDB.getAll<SyncEvent>('sync_events');
      return all.filter(e => e.status === 'PENDING');
    } catch {
      return [];
    }
  }
}
