import { supabase, isSupabaseConfigured } from '../supabase/supabaseClient.ts';
import { Employee } from '../../types/pos.ts';
import { StorageService } from '../storageService.ts';

export class UserRepository {
  static async getEmployees(storeId: string = 'store_aura_main'): Promise<Employee[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select(`
            *,
            roles:user_roles(roles(*))
          `)
          .eq('store_id', storeId)
          .eq('is_active', true);

        if (!error && data && data.length > 0) {
          return data.map(u => ({
            id: u.id,
            storeId: u.store_id,
            name: u.display_name,
            email: '',
            phone: u.phone || '',
            role: 'cashier',
            pin: '', // No local PIN: remote profiles must set one before PIN sign-in works
            active: u.is_active,
            permissions: ['pos', 'sales']
          }));
        }
      } catch (e: any) {
        console.warn('[UserRepository] Exception fetching profiles:', e?.message);
      }
    }

    return StorageService.getEmployees();
  }

  static async updateEmployee(employee: Employee): Promise<Employee> {
    const current = StorageService.getEmployees();
    const updated = current.map(e => e.id === employee.id ? employee : e);
    StorageService.saveEmployees(updated);
    return employee;
  }
}
