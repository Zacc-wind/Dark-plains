import { afterEach, describe, expect, it, vi } from 'vitest';
import { postOnlinePvpDuelAction } from './pvpDuelOnlineClient';
import type { SynchronizedBattleAction } from './battle';

describe('postOnlinePvpDuelAction', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs action + expectedVersion and returns session payload', async () => {
    const action: SynchronizedBattleAction = {
      id: 'action-1',
      type: 'attack',
      actorUsername: 'Alice',
      expectedRevision: 0,
      createdAt: 1_700_000_000_000,
    };
    const session = { id: 'duel-1', version: 3 };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, data: { session }, deploymentMode: 'database' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await postOnlinePvpDuelAction('duel-1', action, 2);

    expect(fetchMock).toHaveBeenCalledWith('/api/pvp/duels/duel-1/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, expectedVersion: 2 }),
    });
    expect(result.session).toEqual(session);
  });

  it('surfaces 409 conflicts with session attached', async () => {
    const session = { id: 'duel-1', version: 4 };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        ok: false,
        error: 'Duel session changed. Refresh before acting.',
        data: { session },
        deploymentMode: 'database',
      }),
    }));

    await expect(postOnlinePvpDuelAction('duel-1', {
      id: 'action-2',
      type: 'wait',
      actorUsername: 'Alice',
      expectedRevision: 1,
      createdAt: 1,
    }, 3)).rejects.toMatchObject({
      conflict: true,
      session,
      message: 'Duel session changed. Refresh before acting.',
    });
  });
});
