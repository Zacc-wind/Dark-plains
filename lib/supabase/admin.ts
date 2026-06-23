import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl } from '@/lib/supabase/config';

export function createAdminClient() {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(createAdminClient());
}
