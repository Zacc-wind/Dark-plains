import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SynchronizedBattleAction } from './battle';
import {
  postOnlineCoopDungeonAction,
  shouldUseOnlineCoopDungeonClient,
  updateOnlineCoopDungeonSession,
} from './coopDungeonOnlineClient';

describe('coopDungeonOnlineClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('keeps the online gate closed under vitest', () => {
    expect(process.env.VITEST).toBeTruthy();
    expect(shouldUseOnlineCoopDungeonClient()).toBe(false);
  });

  it('PATCHes start_chamber with expectedVersion and returns session', async () => {
    const session = { id: 'coop-dungeon-1', version: 2, phase: 'chamber' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, data: { session }, deploymentMode: 'database' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await updateOnlineCoopDungeonSession('coop-dungeon-1', {
      action: 'start_chamber',
      expectedVersion: 1,
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/coop/dungeons/coop-dungeon-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start_chamber', expectedVersion: 1 }),
    });
    expect(result.session).toEqual(session);
  });

  it('POSTs combat action + expectedVersion and returns session payload', async () => {
    const action: SynchronizedBattleAction = {
      id: 'action-1',
      type: 'attack',
      actorUsername: 'Alice',
      expectedRevision: 0,
      createdAt: 1_700_000_000_000,
    };
    const session = { id: 'coop-dungeon-1', version: 3 };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, data: { session }, deploymentMode: 'database' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await postOnlineCoopDungeonAction('coop-dungeon-1', action, 2);

    expect(fetchMock).toHaveBeenCalledWith('/api/coop/dungeons/coop-dungeon-1/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, expectedVersion: 2 }),
    });
    expect(result.session).toEqual(session);
  });

  it('surfaces 409 conflicts with session attached', async () => {
    const session = { id: 'coop-dungeon-1', version: 4 };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        ok: false,
        error: 'Dungeon session changed. Refresh before acting.',
        data: { session },
        deploymentMode: 'database',
      }),
    }));

    await expect(postOnlineCoopDungeonAction('coop-dungeon-1', {
      id: 'action-2',
      type: 'wait',
      actorUsername: 'Alice',
      expectedRevision: 1,
      createdAt: 1,
    }, 3)).rejects.toMatchObject({
      conflict: true,
      session,
      message: 'Dungeon session changed. Refresh before acting.',
    });
  });
});
