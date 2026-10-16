import { supabase, isSupabaseConfigured } from '../supabase/supabaseClient.ts';
import { StoreSettings } from '../../types/pos.ts';
import { StorageService } from '../storageService.ts';

export class StoreRepository {
  static async getSettings(storeId: string = 'store_aura_main'): Promise<StoreSettings> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('stores')
          .select('*')
          .eq('id', storeId)
          .single();

        if (!error && data) {
          const current = StorageService.getSettings();
          return {
            ...current,
            name: data.name,
            currency: data.currency,
            timezone: data.timezone,
            taxId: data.tax_number || '',
            logoUrl: data.logo_url || ''
          };
        }
      } catch (e: any) {
        console.warn('[StoreRepository] Exception fetching store settings:', e?.message);
      }
    }

    return StorageService.getSettings();
  }

  static async saveSettings(settings: StoreSettings): Promise<StoreSettings> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('stores').update({
          name: settings.name,
          currency: settings.currency,
          timezone: settings.timezone,
          tax_number: settings.taxId || null,
          logo_url: settings.logoUrl || null,
          updated_at: new Date().toISOString()
        }).eq('id', settings.id || 'store_aura_main');
      } catch (e: any) {
        console.warn('[StoreRepository] Exception updating store settings in Supabase:', e?.message);
      }
    }

    StorageService.saveSettings(settings);
    return settings;
  }
}
