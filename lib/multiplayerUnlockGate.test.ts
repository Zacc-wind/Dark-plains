import { describe, expect, it } from 'vitest';
import {
  gateMultiplayerUnlock,
  gatePartyInviteUnlocks,
  multiplayerUnlockActionDenied,
  multiplayerUnlockForbiddenResponse,
} from '@/lib/multiplayerUnlockGate';
import {
  evaluatePartyAcceptUnlock,
  evaluatePartyInviteUnlock,
} from '@/lib/partyApi';

describe('multiplayer unlock gate', () => {
  it('denies client mutators with the shared registry message', () => {
    expect(multiplayerUnlockActionDenied('party', { stats: { level: 4 } })).toEqual({
      success: false,
      error: 'Party Creation unlocks at level 5.',
    });
    expect(multiplayerUnlockActionDenied('city-contracts', { stats: { level: 1 } })).toEqual({
      success: false,
      error: 'City Contracts unlocks at level 2.',
    });
    expect(multiplayerUnlockActionDenied('gear-upgrades', { stats: { level: 1 } })).toEqual({
      success: false,
      error: 'Gear Forge unlocks at level 2.',
    });
    expect(multiplayerUnlockActionDenied('party', { stats: { level: 5 } })).toBeNull();
  });

  it('rejects party invite when either commander is underleveled', () => {
    expect(gatePartyInviteUnlocks(4, 5, 'Recruit')).toEqual({
      allowed: false,
      error: 'Party Creation unlocks at level 5.',
    });
    expect(gatePartyInviteUnlocks(5, 4, 'Recruit')).toEqual({
      allowed: false,
      error: 'Recruit must reach level 5 before joining a party.',
    });
    expect(gatePartyInviteUnlocks(5, 5, 'Recruit')).toEqual({ allowed: true });
  });

  it('builds a 403 API envelope for unlock failures', async () => {
    const response = multiplayerUnlockForbiddenResponse('Party Creation unlocks at level 5.');
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Party Creation unlocks at level 5.',
      deploymentMode: 'database',
    });
  });
});

describe('party API unlock path', () => {
  it('fails invite and accept before online persistence when underleveled', () => {
    expect(evaluatePartyInviteUnlock(4, 5, 'Recruit')).toEqual({
      allowed: false,
      error: 'Party Creation unlocks at level 5.',
    });
    expect(evaluatePartyInviteUnlock(5, 3, 'Recruit')).toEqual({
      allowed: false,
      error: 'Recruit must reach level 5 before joining a party.',
    });
    expect(evaluatePartyAcceptUnlock(4)).toEqual({
      allowed: false,
      error: 'Party Creation unlocks at level 5.',
    });
    expect(evaluatePartyAcceptUnlock(5)).toEqual({ allowed: true });
    expect(gateMultiplayerUnlock('party', 5)).toEqual({ allowed: true });
  });
});
