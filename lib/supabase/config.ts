export type AuthMode = 'supabase' | 'local-prototype' | 'unavailable';

export const MANAGED_AUTH_UNAVAILABLE_MESSAGE =
  'Managed auth is not configured on this production deployment. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).';

export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function getSupabasePublishableKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

/**
 * True when browser/server clients can talk to a Supabase project.
 * When false outside production, login/register stay on localStorage prototype passwords (vitest/dev).
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}

/**
 * Production (or Vercel production) must use managed Supabase Auth — never silent local passwords.
 */
export function isProductionAuthRequired(): boolean {
  return process.env.NODE_ENV === 'production'
    || process.env.VERCEL_ENV === 'production';
}

/** Dual-path auth mode: managed Supabase Auth vs local prototype vs production unavailable. */
export function getAuthMode(): AuthMode {
  if (isSupabaseConfigured()) return 'supabase';
  if (isProductionAuthRequired()) return 'unavailable';
  return 'local-prototype';
}

/**
 * When production requires managed auth and keys are missing, return a 503 Response.
 * Otherwise returns null so callers can keep local/vitest fallbacks.
 */
export function assertManagedAuthAvailable(): Response | null {
  if (!isProductionAuthRequired() || isSupabaseConfigured()) {
    return null;
  }

  return Response.json(
    {
      ok: false,
      error: MANAGED_AUTH_UNAVAILABLE_MESSAGE,
      authMode: 'unavailable' as const,
      deploymentMode: 'unavailable' as const,
    },
    { status: 503 },
  );
}
