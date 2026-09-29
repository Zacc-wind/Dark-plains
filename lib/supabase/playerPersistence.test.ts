import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const saveRemotePlayer = vi.fn<(user: unknown, userId: string, options?: { keepalive?: boolean }) => Promise<void>>();
const getSession = vi.fn(async () => ({ data: { session: { user: { id: 'auth-1' } } } }));
let storedUser: Record<string, unknown> | null = null;

vi.mock('@/lib/supabase/config', () => ({ isSupabaseConfigured: () => true }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession,
      onAuthStateChange: vi.fn(),
    },
  }),
}));
vi.mock('@/lib/supabase/playerRepository', () => ({
  saveRemotePlayer: (user: unknown, userId: string, options?: { keepalive?: boolean }) => (
    saveRemotePlayer(user, userId, options)
  ),
}));
vi.mock('@/lib/playerStore', () => ({
  readStoredSessionUser: () => storedUser,
}));

type PersistenceModule = typeof import('@/lib/supabase/playerPersistence');
let persistence: PersistenceModule;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  saveRemotePlayer.mockReset();
  saveRemotePlayer.mockResolvedValue(undefined);
  getSession.mockClear();
  storedUser = { username: 'Banner', gold: 1 };
  vi.stubGlobal('window', { addEventListener: vi.fn() });
  vi.stubGlobal('document', { addEventListener: vi.fn(), visibilityState: 'visible' });
  persistence = await import('@/lib/supabase/playerPersistence');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('player persistence scheduler', () => {
  it('coalesces bursts of updates into one trailing save', async () => {
    for (let tick = 0; tick < 5; tick += 1) {
      storedUser = { username: 'Banner', gold: tick };
      persistence.schedulePlayerPersist();
      await vi.advanceTimersByTimeAsync(1000);
    }
    expect(saveRemotePlayer).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(persistence.PERSIST_DEBOUNCE_MS);
    expect(saveRemotePlayer).toHaveBeenCalledTimes(1);
    expect(saveRemotePlayer).toHaveBeenCalledWith({ username: 'Banner', gold: 4 }, 'auth-1', { keepalive: false });
  });

  it('saves at the max wait even while updates keep arriving every second', async () => {
    for (let tick = 0; tick < 11; tick += 1) {
      storedUser = { username: 'Banner', gold: tick };
      persistence.schedulePlayerPersist();
      await vi.advanceTimersByTimeAsync(1000);
    }
    expect(saveRemotePlayer).toHaveBeenCalledTimes(1);
  });

  it('skips saves when the payload matches the last persisted one', async () => {
    persistence.schedulePlayerPersist();
    await persistence.flushPlayerPersist();
    persistence.schedulePlayerPersist();
    await persistence.flushPlayerPersist();

    expect(saveRemotePlayer).toHaveBeenCalledTimes(1);
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it('keeps a single request in flight and sends the latest state afterwards', async () => {
    let release: () => void = () => undefined;
    saveRemotePlayer.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));

    persistence.schedulePlayerPersist();
    const first = persistence.flushPlayerPersist();
    await vi.advanceTimersByTimeAsync(0);

    storedUser = { username: 'Banner', gold: 99 };
    persistence.schedulePlayerPersist();
    const second = persistence.flushPlayerPersist();
    await vi.advanceTimersByTimeAsync(0);
    expect(saveRemotePlayer).toHaveBeenCalledTimes(1);

    release();
    await first;
    await second;
    expect(saveRemotePlayer).toHaveBeenCalledTimes(2);
    expect(saveRemotePlayer).toHaveBeenLastCalledWith({ username: 'Banner', gold: 99 }, 'auth-1', { keepalive: false });
  });

  it('flushes with keepalive when the page is hidden', async () => {
    persistence.schedulePlayerPersist();
    const listener = vi.mocked(document.addEventListener).mock.calls
      .find(([type]) => type === 'visibilitychange')?.[1] as () => void;
    vi.stubGlobal('document', { addEventListener: vi.fn(), visibilityState: 'hidden' });

    listener();
    await vi.advanceTimersByTimeAsync(0);
    expect(saveRemotePlayer).toHaveBeenCalledWith({ username: 'Banner', gold: 1 }, 'auth-1', { keepalive: true });
  });
});
