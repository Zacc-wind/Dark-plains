export type AuthMode = 'supabase' | 'local-prototype';

export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function getSupabasePublishableKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

/**
 * True when browser/server clients can talk to a Supabase project.
 * When false, login/register stay on localStorage prototype passwords (vitest/dev).
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}

/** Dual-path auth mode: managed Supabase Auth vs local prototype passwords. */
export function getAuthMode(): AuthMode {
  return isSupabaseConfigured() ? 'supabase' : 'local-prototype';
}
