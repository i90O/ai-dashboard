import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }
  return supabaseInstance;
}

// Backwards compatibility exports for existing API routes
export const supabase = {
  from: (table: string) => getSupabase().from(table),
  rpc: (fn: string, params?: any) => getSupabase().rpc(fn, params),
};

export const MC_TOKEN = process.env.MC_TOKEN || 'xiaobei-mc-2026';
