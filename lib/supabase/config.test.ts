import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAuthMode, isSupabaseConfigured } from './config';

describe('auth config dual-path', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports local-prototype when keys are missing', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    expect(isSupabaseConfigured()).toBe(false);
    expect(getAuthMode()).toBe('local-prototype');
  });

  it('reports supabase when url and publishable key are set', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'pub-key');
    expect(isSupabaseConfigured()).toBe(true);
    expect(getAuthMode()).toBe('supabase');
  });

  it('accepts legacy NEXT_PUBLIC_SUPABASE_ANON_KEY', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    expect(isSupabaseConfigured()).toBe(true);
    expect(getAuthMode()).toBe('supabase');
  });
});
