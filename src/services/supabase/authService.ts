import { supabase, isSupabaseConfigured } from './supabaseClient.ts';
import { User, Session } from '@supabase/supabase-js';

export interface AuthProfile {
  id: string;
  storeId: string;
  displayName: string;
  phone?: string;
  role: string;
  permissions: string[];
}

export class AuthService {
  /**
   * Get current authenticated Supabase user session
   */
  static async getSession(): Promise<Session | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session;
  }

  /**
   * Get current authenticated user
   */
  static async getCurrentUser(): Promise<User | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const { data } = await supabase.auth.getUser();
    return data.user;
  }

  /**
   * Sign in with email and password
   */
  static async signIn(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
    if (!isSupabaseConfigured || !supabase) {
      return { user: null, error: 'Supabase credentials are not configured in environment.' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { user: null, error: error.message };
    }
    return { user: data.user, error: null };
  }

  /**
   * Sign out current user
   */
  static async signOut(): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.auth.signOut();
  }

  /**
   * Fetch authorized profile for authenticated user
   */
  static async getProfile(userId: string): Promise<AuthProfile | null> {
    if (!isSupabaseConfigured || !supabase) return null;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select(`
          *,
          roles:user_roles(
            role:roles(
              name,
              permissions:role_permissions(
                permission:permissions(code)
              )
            )
          )
        `)
        .eq('id', userId)
        .single();

      if (error || !data) return null;

      const rolesArray = (data as any).roles || [];
      const primaryRole = rolesArray[0]?.role?.name || 'CASHIER';
      const permissionsSet = new Set<string>();

      rolesArray.forEach((r: any) => {
        const perms = r?.role?.permissions || [];
        perms.forEach((p: any) => {
          if (p?.permission?.code) permissionsSet.add(p.permission.code);
        });
      });

      return {
        id: data.id,
        storeId: data.store_id,
        displayName: data.display_name,
        phone: data.phone || undefined,
        role: primaryRole.toLowerCase(),
        permissions: Array.from(permissionsSet)
      };
    } catch (_) {
      return null;
    }
  }

  /**
   * Listen to auth state changes
   */
  static onAuthStateChange(callback: (session: Session | null) => void) {
    if (!isSupabaseConfigured || !supabase) {
      return { unsubscribe: () => {} };
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });

    return { unsubscribe: () => data.subscription.unsubscribe() };
  }
}
