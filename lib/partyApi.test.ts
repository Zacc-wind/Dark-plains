import { describe, expect, it } from 'vitest';
import {
  evaluatePartyAcceptUnlock,
  evaluatePartyInviteUnlock,
} from './partyApi';
import { evaluatePartyCapacity, PARTY_DB_MAX_SIZE } from './partySessionDb';

describe('party invite evaluate helpers', () => {
  it('requires both commanders to unlock party before invite', () => {
    expect(evaluatePartyInviteUnlock(4, 5, 'Ally').allowed).toBe(false);
    expect(evaluatePartyInviteUnlock(5, 4, 'Ally')).toMatchObject({
      allowed: false,
      error: 'Ally must reach level 5 before joining a party.',
    });
    expect(evaluatePartyInviteUnlock(5, 5, 'Ally').allowed).toBe(true);
  });

  it('gates accept on the shared party unlock', () => {
    expect(evaluatePartyAcceptUnlock(4).allowed).toBe(false);
    expect(evaluatePartyAcceptUnlock(5).allowed).toBe(true);
  });

  it('rejects invites when the party is already full', () => {
    expect(evaluatePartyCapacity(PARTY_DB_MAX_SIZE)).toEqual({
      allowed: false,
      error: `Party is full (${PARTY_DB_MAX_SIZE} players).`,
    });
    expect(evaluatePartyCapacity(PARTY_DB_MAX_SIZE - 1)).toEqual({ allowed: true });
  });
});
