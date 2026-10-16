import { supabase, isSupabaseConfigured } from '../supabase/supabaseClient.ts';
import { Printer, PrinterRoute } from '../../types/printer.ts';
import { StorageService } from '../storageService.ts';
import { LocalDB } from '../db/localDatabase.ts';

export class PrinterRepository {
  /**
   * Get all registered printers
   */
  static async getAll(storeId: string = 'store_aura_main'): Promise<Printer[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('printers')
          .select('*')
          .eq('store_id', storeId)
          .eq('is_active', true)
          .order('name');

        if (!error && data) {
          return data.map(p => ({
            id: p.id,
            storeId: p.store_id,
            name: p.name,
            model: p.name,
            printerType: 'escpos',
            connectionType: p.connection_type.toLowerCase() as any,
            protocol: p.protocol as any,
            ipAddress: p.address || undefined,
            port: p.port || 9100,
            deviceIdentifier: p.device_identifier || undefined,
            paperWidth: p.paper_width as any,
            charactersPerLine: p.paper_width === 80 ? 48 : 32,
            encoding: 'CP437',
            isDefault: p.is_default,
            printerPurpose: 'receipt',
            autoPrint: true,
            supportsCut: true,
            supportsCashDrawer: true,
            supportsQr: true,
            supportsBarcode: true,
            status: 'ready',
            createdAt: p.created_at,
            updatedAt: p.updated_at
          }));
        }
      } catch (e: any) {
        console.warn('[PrinterRepository] Exception fetching printers:', e?.message);
      }
    }

    return StorageService.getPrinters();
  }

  /**
   * Save printer
   */
  static async save(printer: Printer): Promise<Printer> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('printers').upsert({
          id: printer.id.length === 36 ? printer.id : undefined,
          store_id: printer.storeId || 'store_aura_main',
          name: printer.name,
          connection_type: printer.connectionType.toUpperCase() as any,
          device_identifier: printer.deviceIdentifier || null,
          address: printer.ipAddress || null,
          port: printer.port || 9100,
          protocol: printer.protocol || 'ESC_POS',
          paper_width: printer.paperWidth || 58,
          is_default: Boolean(printer.isDefault),
          is_active: true
        });
      } catch (e: any) {
        console.warn('[PrinterRepository] Exception saving printer:', e?.message);
      }
    }

    const current = StorageService.getPrinters();
    const updated = [...current.filter(p => p.id !== printer.id), printer];
    StorageService.savePrinters(updated);
    await LocalDB.put('printers', printer);

    return printer;
  }

  /**
   * Delete printer
   */
  static async delete(id: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('printers').update({ is_active: false }).eq('id', id);
      } catch (e: any) {
        console.warn('[PrinterRepository] Exception deleting printer:', e?.message);
      }
    }

    const current = StorageService.getPrinters();
    const filtered = current.filter(p => p.id !== id);
    StorageService.savePrinters(filtered);
    await LocalDB.delete('printers', id);
    return true;
  }
}
