import { applyRemoteAccountTutorials, readRemoteTutorialsFromGameSessions } from '@/lib/accountTutorial';
import { clearStoredSessionUser, readCurrentUser, writeStoredSessionUser } from '@/lib/playerStore';
import type { User } from '@/lib/playerTypes';
import { createClient } from '@/lib/supabase/client';
import {
  getAuthMode,
  isSupabaseConfigured,
  MANAGED_AUTH_UNAVAILABLE_MESSAGE,
  type AuthMode,
} from '@/lib/supabase/config';
import {
  flushPlayerPersist,
  resetPlayerPersist,
  schedulePlayerPersist,
} from '@/lib/supabase/playerPersistence';
import { fetchRemotePlayer, playerStateRowToUser } from '@/lib/supabase/playerRepository';
import { isValidGameUsername, usernameToAuthEmail } from '@/lib/supabase/username';

export { flushPlayerPersist, schedulePlayerPersist };

/**
 * Dual-path gate used by login/register UI and logout/persist.
 * When true: Supabase Auth (`signInWithPassword` / `/api/auth/register`).
 * When false: local `lib/auth` plaintext passwords for vitest and keyless local dev
 * (or production unavailable — UI must not treat that as a live local login).
 */
export function isSupabaseAuthEnabled(): boolean {
  return isSupabaseConfigured();
}

export function getClientAuthMode(): AuthMode {
  return getAuthMode();
}

export function isManagedAuthUnavailable(): boolean {
  return getAuthMode() === 'unavailable';
}

export async function requestPasswordReset(
  identifier: { email?: string; username?: string },
): Promise<{ success: boolean; error?: string; message?: string }> {
  if (isManagedAuthUnavailable()) {
    return { success: false, error: MANAGED_AUTH_UNAVAILABLE_MESSAGE };
  }

  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Password recovery requires Supabase Auth.' };
  }

  const response = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(identifier),
  });

  let payload: { ok?: boolean; error?: string; message?: string } = {};
  try {
    payload = await response.json();
  } catch {
    return { success: false, error: 'Password reset request failed.' };
  }

  if (!response.ok || !payload.ok) {
    return { success: false, error: payload.error || 'Password reset request failed.' };
  }

  return {
    success: true,
    message: payload.message || 'If an account matches, a reset email was sent.',
  };
}

export async function updatePasswordWithRecoverySession(
  password: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase is not configured.' };
  }

  if (password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function registerWithSupabase(
  username: string,
  password: string,
): Promise<{ success: boolean; error?: string; needsEmailConfirmation?: boolean }> {
  if (isManagedAuthUnavailable()) {
    return { success: false, error: MANAGED_AUTH_UNAVAILABLE_MESSAGE };
  }

  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase is not configured.' };
  }

  if (!isValidGameUsername(username)) {
    return { success: false, error: 'Username must be 3-20 characters (letters, numbers, underscore).' };
  }

  if (password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters for online accounts.' };
  }

  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  let payload: { ok?: boolean; error?: string } = {};
  try {
    payload = await response.json();
  } catch {
    return { success: false, error: 'Registration failed.' };
  }

  if (!response.ok || !payload.ok) {
    return { success: false, error: payload.error || 'Registration failed.' };
  }

  const hydrated = await hydrateLocalUserFromSession();
  if (!hydrated) {
    return { success: false, error: 'Account created, but player state failed to load.' };
  }

  return { success: true };
}

export async function loginWithSupabase(
  username: string,
  password: string,
): Promise<{ success: boolean; error?: string; user?: User }> {
  if (isManagedAuthUnavailable()) {
    return { success: false, error: MANAGED_AUTH_UNAVAILABLE_MESSAGE };
  }

  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase is not configured.' };
  }

  // Settle any previous account's pending save before the session switches.
  await flushPlayerPersist();
  resetPlayerPersist();

  const supabase = createClient();
  const email = usernameToAuthEmail(username);

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { success: false, error: error.message };
  }

  const user = await hydrateLocalUserFromSession();
  if (!user) {
    return { success: false, error: 'Logged in, but save data was not found.' };
  }

  return { success: true, user };
}

export async function logoutSupabase(): Promise<void> {
  if (isSupabaseConfigured()) await flushPlayerPersist();
  resetPlayerPersist();
  clearStoredSessionUser();
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  await supabase.auth.signOut();
}

export async function hydrateLocalUserFromSession(): Promise<User | null> {
  if (!isSupabaseConfigured()) return readCurrentUser();

  // Pending local edits must reach the server before the remote row overwrites them.
  await flushPlayerPersist();

  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const remote = await fetchRemotePlayer(user.id);
  if (!remote) return null;

  const sessionUser = playerStateRowToUser(remote.state, remote.profile);
  const remoteTutorials = readRemoteTutorialsFromGameSessions(remote.state.game_sessions);
  applyRemoteAccountTutorials(sessionUser.username, remoteTutorials);
  writeStoredSessionUser(sessionUser);
  return sessionUser;
}

/** Save the current session user now instead of waiting for the debounce. */
export function persistCurrentUserToSupabase(): Promise<void> {
  if (!isSupabaseConfigured()) return Promise.resolve();
  schedulePlayerPersist();
  return flushPlayerPersist();
}

export async function bootstrapSupabaseSession(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const user = await hydrateLocalUserFromSession();
  return Boolean(user);
}
