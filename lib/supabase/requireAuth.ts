import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Resolve the signed-in user from cookie/session JWT via Auth server validation.
 * Prefer this over `getSession()` for authorization decisions in API routes.
 */
export async function getAuthenticatedUser(
  supabase: SupabaseServerClient,
): Promise<User | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function getAuthenticatedUserId(
  supabase: SupabaseServerClient,
): Promise<string | null> {
  const user = await getAuthenticatedUser(supabase);
  return user?.id ?? null;
}
