import { afterEach, describe, expect, it, vi } from 'vitest';
import {
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
});
