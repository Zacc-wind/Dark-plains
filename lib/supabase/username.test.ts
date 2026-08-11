import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidGameUsername, usernameToAuthEmail } from './username';

describe('isValidGameUsername', () => {
  it('accepts 3-20 alphanumeric/underscore usernames', () => {
    expect(isValidGameUsername('abc')).toBe(true);
    expect(isValidGameUsername('Player_One')).toBe(true);
    expect(isValidGameUsername('a'.repeat(20))).toBe(true);
  });

  it('rejects short, long, or invalid characters', () => {
    expect(isValidGameUsername('ab')).toBe(false);
    expect(isValidGameUsername('a'.repeat(21))).toBe(false);
    expect(isValidGameUsername('bad name')).toBe(false);
    expect(isValidGameUsername('bad-name')).toBe(false);
  });
});

describe('usernameToAuthEmail', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses a custom domain when NEXT_PUBLIC_AUTH_EMAIL_DOMAIN is set', () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_EMAIL_DOMAIN', 'mail.example.com');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc123.supabase.co');
    expect(usernameToAuthEmail('Moon_Guard')).toBe('moon_guard@mail.example.com');
  });

  it('falls back to namespaced gmail when no custom domain is set', () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_EMAIL_DOMAIN', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://projref.supabase.co');
    expect(usernameToAuthEmail('RaidLeader')).toBe('dp.projref.raidleader@gmail.com');
  });
});
