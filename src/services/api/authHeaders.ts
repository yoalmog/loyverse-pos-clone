import { supabase, isSupabaseConfigured } from '../supabase/supabaseClient.ts';

export async function getApiAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  const sharedKey = ((import.meta as any).env?.VITE_AURA_API_KEY as string | undefined)?.trim();
  if (sharedKey) headers['X-Aura-Api-Key'] = sharedKey;
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch {}
  }
  return headers;
}
