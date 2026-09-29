import { readStoredSessionUser } from '@/lib/playerStore';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { saveRemotePlayer } from '@/lib/supabase/playerRepository';

/**
 * Coalesces remote saves of the session user. localStorage stays the immediate source of truth;
 * the remote copy trails it by at most PERSIST_MAX_WAIT_MS while the player keeps acting.
 */
export const PERSIST_DEBOUNCE_MS = 2500;
export const PERSIST_MAX_WAIT_MS = 10_000;

let dirty = false;
let firstDirtyAt = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<void> | null = null;
let lastPersisted: { userId: string; payload: string } | null = null;
/** undefined = not resolved yet; null = signed out. */
let cachedAuthUserId: string | null | undefined;
let authListenerAttached = false;
let lifecycleListenersAttached = false;

function clearTimer(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

function attachAuthListener(): void {
  if (authListenerAttached) return;
  authListenerAttached = true;
  createClient().auth.onAuthStateChange((_event, session) => {
    const nextUserId = session?.user.id ?? null;
    if (nextUserId !== cachedAuthUserId) lastPersisted = null;
    cachedAuthUserId = nextUserId;
  });
}

/** Local session read (no network); /api/me re-validates the JWT server-side. */
async function getAuthUserId(): Promise<string | null> {
  attachAuthListener();
  if (cachedAuthUserId !== undefined) return cachedAuthUserId;
  const { data: { session } } = await createClient().auth.getSession();
  cachedAuthUserId = session?.user.id ?? null;
  return cachedAuthUserId;
}

function attachLifecycleListeners(): void {
  if (lifecycleListenersAttached || typeof window === 'undefined') return;
  lifecycleListenersAttached = true;
  const flushForExit = () => {
    void flushPlayerPersist({ keepalive: true });
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushForExit();
  });
  window.addEventListener('pagehide', flushForExit);
}

async function persistNow(keepalive: boolean): Promise<void> {
  const user = readStoredSessionUser();
  if (!user) return;
  const userId = await getAuthUserId();
  if (!userId) return;

  const payload = JSON.stringify(user);
  if (lastPersisted && lastPersisted.userId === userId && lastPersisted.payload === payload) return;

  try {
    await saveRemotePlayer(user, userId, { keepalive });
    lastPersisted = { userId, payload };
  } catch {
    // Retry on the next schedule or lifecycle flush.
    dirty = true;
  }
}

/** Mark the session user as changed; the remote save is debounced. */
export function schedulePlayerPersist(): void {
  if (!isSupabaseConfigured() || typeof window === 'undefined') return;
  attachLifecycleListeners();

  const now = Date.now();
  dirty = true;
  if (!firstDirtyAt) firstDirtyAt = now;

  clearTimer();
  const delay = Math.min(PERSIST_DEBOUNCE_MS, Math.max(0, firstDirtyAt + PERSIST_MAX_WAIT_MS - now));
  timer = setTimeout(() => {
    timer = null;
    void flushPlayerPersist();
  }, delay);
}

/**
 * Push pending changes now. Resolves once the latest local state has been sent (or nothing was pending).
 * Only one save is in flight at a time; calls made meanwhile chain behind it.
 */
export function flushPlayerPersist(options: { keepalive?: boolean } = {}): Promise<void> {
  if (!isSupabaseConfigured()) return Promise.resolve();
  clearTimer();

  if (inFlight) {
    return inFlight.then(() => (dirty ? flushPlayerPersist(options) : undefined));
  }
  if (!dirty) return Promise.resolve();

  dirty = false;
  firstDirtyAt = 0;
  const current = persistNow(Boolean(options.keepalive))
    .catch(() => undefined)
    .finally(() => {
      if (inFlight === current) inFlight = null;
    });
  inFlight = current;
  return current;
}

/** Drop pending state without saving (e.g. after the local session was cleared). */
export function resetPlayerPersist(): void {
  clearTimer();
  dirty = false;
  firstDirtyAt = 0;
  lastPersisted = null;
}
