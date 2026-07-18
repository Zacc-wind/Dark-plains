import { getCurrentUser, type User } from '@/lib/auth';
import { applyRemoteAccountTutorials, readRemoteTutorialsFromGameSessions } from '@/lib/accountTutorial';
import { writeGameJson, removeGameStorageItem } from '@/lib/gameStore';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import {
  fetchRemotePlayer,
  playerStateRowToUser,
  saveRemotePlayer,
} from '@/lib/supabase/playerRepository';
import { isValidGameUsername, usernameToAuthEmail } from '@/lib/supabase/username';

const CURRENT_USER_KEY = 'pirate_game_current_user';
let playerPersistenceQueue: Promise<void> = Promise.resolve();

export function isSupabaseAuthEnabled(): boolean {
  return isSupabaseConfigured();
}

export async function registerWithSupabase(
  username: string,
  password: string,
): Promise<{ success: boolean; error?: string; needsEmailConfirmation?: boolean }> {
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
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase is not configured.' };
  }

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
  removeGameStorageItem(CURRENT_USER_KEY);
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  await supabase.auth.signOut();
}

export async function hydrateLocalUserFromSession(): Promise<User | null> {
  if (!isSupabaseConfigured()) return getCurrentUser();

  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const remote = await fetchRemotePlayer(user.id);
  if (!remote) return null;

  const sessionUser = playerStateRowToUser(remote.state, remote.profile);
  const remoteTutorials = readRemoteTutorialsFromGameSessions(remote.state.game_sessions);
  applyRemoteAccountTutorials(sessionUser.username, remoteTutorials);
  writeGameJson(CURRENT_USER_KEY, sessionUser);
  return sessionUser;
}

export function persistCurrentUserToSupabase(): Promise<void> {
  if (!isSupabaseConfigured()) return Promise.resolve();

  const localUser = getCurrentUser();
  if (!localUser) return Promise.resolve();

  playerPersistenceQueue = playerPersistenceQueue
    .catch(() => undefined)
    .then(async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await saveRemotePlayer(localUser, user.id);
    })
    .catch(() => undefined);

  return playerPersistenceQueue;
}

export async function bootstrapSupabaseSession(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const user = await hydrateLocalUserFromSession();
  return Boolean(user);
}
