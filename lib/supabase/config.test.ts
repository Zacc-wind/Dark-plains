import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertManagedAuthAvailable,
  getAuthMode,
  isProductionAuthRequired,
  isSupabaseConfigured,
  MANAGED_AUTH_UNAVAILABLE_MESSAGE,
} from './config';

describe('auth config dual-path', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports local-prototype when keys are missing outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    expect(isSupabaseConfigured()).toBe(false);
    expect(isProductionAuthRequired()).toBe(false);
    expect(getAuthMode()).toBe('local-prototype');
    expect(assertManagedAuthAvailable()).toBeNull();
  });

  it('reports supabase when url and publishable key are set', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'pub-key');
    expect(isSupabaseConfigured()).toBe(true);
    expect(getAuthMode()).toBe('supabase');
    expect(assertManagedAuthAvailable()).toBeNull();
  });

  it('accepts legacy NEXT_PUBLIC_SUPABASE_ANON_KEY', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    expect(isSupabaseConfigured()).toBe(true);
    expect(getAuthMode()).toBe('supabase');
  });

  it('fail-closes in NODE_ENV=production when keys are missing', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    expect(isProductionAuthRequired()).toBe(true);
    expect(getAuthMode()).toBe('unavailable');
    const blocked = assertManagedAuthAvailable();
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(503);
  });

  it('fail-closes when VERCEL_ENV=production even if NODE_ENV is unset oddly', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    expect(isProductionAuthRequired()).toBe(true);
    expect(getAuthMode()).toBe('unavailable');
  });

  it('allows production when Supabase keys are present', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'pub-key');
    expect(isProductionAuthRequired()).toBe(true);
    expect(getAuthMode()).toBe('supabase');
    expect(assertManagedAuthAvailable()).toBeNull();
  });

  it('assertManagedAuthAvailable body matches the public unavailable message', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    const blocked = assertManagedAuthAvailable()!;
    const body = await blocked.json();
    expect(body.error).toBe(MANAGED_AUTH_UNAVAILABLE_MESSAGE);
    expect(body.authMode).toBe('unavailable');
  });
});
