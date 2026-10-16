import { supabase, isSupabaseConfigured } from '../supabase/supabaseClient.ts';
import { LocalDB } from '../db/localDatabase.ts';
import { SyncRepository } from './SyncRepository.ts';

export interface CashShiftRecord {
  id: string;
  storeId: string;
  terminalId?: string;
  userId?: string;
  openingAmount: number;
  closingAmount?: number;
  expectedAmount?: number;
  difference?: number;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt?: string;
  syncStatus?: 'LOCAL_ONLY' | 'PENDING_UPLOAD' | 'SYNCED';
}

export interface CashMovementRecord {
  id: string;
  shiftId: string;
  storeId?: string;
  type: 'cash_in' | 'cash_out' | 'drop' | 'payout';
  amount: number;
  reason?: string;
  userId?: string;
  createdAt: string;
  syncStatus?: 'LOCAL_ONLY' | 'PENDING_UPLOAD' | 'SYNCED';
}

export class CashShiftRepository {
  /**
   * Fetch current active shift from local database first (zero network requirement)
   */
  static async getCurrentShift(storeId: string = 'store_aura_main', terminalId?: string): Promise<CashShiftRecord | null> {
    try {
      const localShifts = await LocalDB.getAll<CashShiftRecord>('cash_shifts');
      const openShift = localShifts.find(s => 
        s.storeId === storeId && 
        s.status === 'open' &&
        (!terminalId || !s.terminalId || s.terminalId === terminalId)
      );
      if (openShift) return openShift;
    } catch (_) {}

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('cash_shifts')
          .select('*')
          .eq('store_id', storeId)
          .eq('status', 'open');
        
        if (terminalId) {
          query = query.eq('terminal_id', terminalId);
        }

        const { data, error } = await query
          .order('opened_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          const rec: CashShiftRecord = {
            id: data.id,
            storeId: data.store_id,
            terminalId: data.terminal_id || undefined,
            userId: data.user_id || undefined,
            openingAmount: Number(data.opening_amount),
            closingAmount: data.closing_amount ? Number(data.closing_amount) : undefined,
            expectedAmount: data.expected_amount ? Number(data.expected_amount) : undefined,
            difference: data.difference ? Number(data.difference) : undefined,
            status: data.status as 'open' | 'closed',
            openedAt: data.opened_at,
            closedAt: data.closed_at || undefined,
            syncStatus: 'SYNCED'
          };
          await LocalDB.put('cash_shifts', rec);
          return rec;
        }
      } catch (_) {}
    }
    return null;
  }

  /**
   * Opens a new shift locally first, returning immediately without network dependency
   */
  static async openShift(shift: Omit<CashShiftRecord, 'id' | 'openedAt'>): Promise<CashShiftRecord> {
    const shiftId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `shift_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const newShift: CashShiftRecord = {
      ...shift,
      id: shiftId,
      openedAt: nowIso,
      status: 'open',
      syncStatus: 'PENDING_UPLOAD'
    };

    // 1. Commit to Local Database immediately
    await LocalDB.put('cash_shifts', newShift);

    // 2. Queue Sync Event
    await SyncRepository.recordEvent({
      clientEventId: `client_shift_open_${shiftId}`,
      storeId: newShift.storeId,
      terminalId: newShift.terminalId,
      entityType: 'cash_shift',
      entityId: shiftId,
      operation: 'INSERT',
      payload: newShift
    });

    // 3. Mirror to Supabase if online (non-blocking)
    if (isSupabaseConfigured && supabase) {
      (async () => {
        try {
          const { error } = await supabase
            .from('cash_shifts')
            .upsert({
              id: shiftId.length === 36 ? shiftId : undefined,
              store_id: newShift.storeId,
              terminal_id: newShift.terminalId || null,
              user_id: newShift.userId || null,
              opening_amount: newShift.openingAmount,
              status: 'open',
              opened_at: nowIso
            }, { onConflict: 'id' });

          if (!error) {
            newShift.syncStatus = 'SYNCED';
            await LocalDB.put('cash_shifts', newShift);
          }
        } catch (err: any) {
          console.warn('[CashShiftRepository] Async shift upload notice:', err?.message);
        }
      })();
    }

    return newShift;
  }

  /**
   * Records a cash float movement (cash in, drop, pay out) locally first
   */
  static async recordMovement(movement: Omit<CashMovementRecord, 'id' | 'createdAt'>): Promise<CashMovementRecord> {
    const moveId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `move_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const rec: CashMovementRecord = {
      ...movement,
      id: moveId,
      createdAt: nowIso,
      syncStatus: 'PENDING_UPLOAD'
    };

    await LocalDB.put('cash_movements', rec);

    await SyncRepository.recordEvent({
      clientEventId: `client_cash_move_${moveId}`,
      storeId: rec.storeId || 'store_aura_main',
      entityType: 'cash_movement',
      entityId: moveId,
      operation: 'INSERT',
      payload: rec
    });

    if (isSupabaseConfigured && supabase) {
      (async () => {
        try {
          await supabase
            .from('cash_movements')
            .upsert({
              id: moveId.length === 36 ? moveId : undefined,
              shift_id: rec.shiftId,
              type: rec.type,
              amount: rec.amount,
              reason: rec.reason || null,
              user_id: rec.userId || null,
              created_at: nowIso
            }, { onConflict: 'id' });
        } catch (err: any) {
          console.warn('[CashShiftRepository] Async cash movement upload notice:', err?.message);
        }
      })();
    }

    return rec;
  }

  /**
   * Closes an existing shift locally first, computing reconciliation
   */
  static async closeShift(
    shiftId: string,
    closingAmount: number,
    expectedAmount: number,
    difference: number
  ): Promise<CashShiftRecord | null> {
    const nowIso = new Date().toISOString();
    const shift = await LocalDB.getById<CashShiftRecord>('cash_shifts', shiftId);
    if (!shift) return null;

    const closedShift: CashShiftRecord = {
      ...shift,
      status: 'closed',
      closingAmount,
      expectedAmount,
      difference,
      closedAt: nowIso,
      syncStatus: 'PENDING_UPLOAD'
    };

    await LocalDB.put('cash_shifts', closedShift);

    await SyncRepository.recordEvent({
      clientEventId: `client_shift_close_${shiftId}`,
      storeId: closedShift.storeId,
      terminalId: closedShift.terminalId,
      entityType: 'cash_shift',
      entityId: shiftId,
      operation: 'UPDATE',
      payload: closedShift
    });

    if (isSupabaseConfigured && supabase) {
      (async () => {
        try {
          await supabase
            .from('cash_shifts')
            .update({
              status: 'closed',
              closing_amount: closingAmount,
              expected_amount: expectedAmount,
              difference,
              closed_at: nowIso
            })
            .eq('id', shiftId);
        } catch (err: any) {
          console.warn('[CashShiftRepository] Async shift close notice:', err?.message);
        }
      })();
    }

    return closedShift;
  }
}
