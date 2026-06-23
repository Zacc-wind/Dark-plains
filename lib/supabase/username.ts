import { getSupabaseUrl } from '@/lib/supabase/config';

function getSupabaseProjectRef(): string {
  const url = getSupabaseUrl();
  if (!url) return 'darkplains';

  try {
    const hostname = new URL(url).hostname;
    return hostname.split('.')[0] || 'darkplains';
  } catch {
    return 'darkplains';
  }
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

/**
 * Supabase Auth requires email/password sign-in. We map usernames to synthetic
 * emails. The domain must pass Supabase DNS/MX validation — fake domains like
 * darkplains.game are rejected.
 *
 * Set NEXT_PUBLIC_AUTH_EMAIL_DOMAIN to a domain you control with valid MX
 * records (e.g. via Cloudflare Email Routing). When unset, we use a
 * namespaced @gmail.com address that passes Supabase's provider allowlist.
 */
export function usernameToAuthEmail(username: string): string {
  const normalized = normalizeUsername(username);
  const customDomain = process.env.NEXT_PUBLIC_AUTH_EMAIL_DOMAIN?.trim();

  if (customDomain) {
    return `${normalized}@${customDomain}`;
  }

  const projectRef = getSupabaseProjectRef();
  return `dp.${projectRef}.${normalized}@gmail.com`;
}

export function isValidGameUsername(username: string): boolean {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username.trim());
}
