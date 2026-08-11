import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  acceptPartyInvite,
  expireCurrentSocialRequests,
  getCurrentUser,
  getIncomingSocialRequests,
  getSocialState,
  getUsers,
  invitePlayerToParty,
  login,
  register,
  updateCurrentUser,
} from './auth';

class MemoryLocalStorage {
  private readonly values = new Map<string, string>();

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const storage = new MemoryLocalStorage();

function setCurrentPlayerLevel(level: number): void {
  const user = getCurrentUser();
  if (!user) throw new Error('Expected a logged-in player.');
  updateCurrentUser({ stats: { ...user.stats, level } });
}

beforeEach(() => {
  storage.clear();
  vi.stubGlobal('window', { localStorage: storage });
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-19T12:00:00Z'));
});

describe('party social request persistence', () => {
  it('blocks invite and accept until both commanders unlock party', async () => {
    expect(register('LockedLeader', 'test-password').success).toBe(true);
    expect(register('LockedInvitee', 'test-password').success).toBe(true);

    expect(login('LockedLeader', 'test-password').success).toBe(true);
    setCurrentPlayerLevel(4);
    expect(await invitePlayerToParty('LockedInvitee')).toEqual({
      success: false,
      error: 'Party Creation unlocks at level 5.',
    });

    setCurrentPlayerLevel(5);
    expect(login('LockedInvitee', 'test-password').success).toBe(true);
    setCurrentPlayerLevel(4);
    expect(login('LockedLeader', 'test-password').success).toBe(true);
    expect(await invitePlayerToParty('LockedInvitee')).toEqual({
      success: false,
      error: 'LockedInvitee must reach level 5 before joining a party.',
    });

    expect(login('LockedInvitee', 'test-password').success).toBe(true);
    setCurrentPlayerLevel(5);
    expect(login('LockedLeader', 'test-password').success).toBe(true);
    expect(await invitePlayerToParty('LockedInvitee')).toMatchObject({ success: true });

    expect(login('LockedInvitee', 'test-password').success).toBe(true);
    setCurrentPlayerLevel(4);
    const incoming = getIncomingSocialRequests();
    expect(incoming).toHaveLength(1);
    expect(await acceptPartyInvite(incoming[0].id)).toEqual({
      success: false,
      error: 'Party Creation unlocks at level 5.',
    });
  });

  it('persists a real invite for both players, accepts once, and joins the party', async () => {
    expect(register('LeaderMage', 'test-password').success).toBe(true);
    expect(register('InviteeMage', 'test-password').success).toBe(true);

    expect(login('LeaderMage', 'test-password').success).toBe(true);
    setCurrentPlayerLevel(5);
    expect(login('InviteeMage', 'test-password').success).toBe(true);
    setCurrentPlayerLevel(5);

    expect(login('LeaderMage', 'test-password').success).toBe(true);
    expect(await invitePlayerToParty('InviteeMage')).toMatchObject({ success: true });

    const usersAfterInvite = getUsers();
    const leaderAfterInvite = usersAfterInvite.find(user => user.username === 'LeaderMage');
    const inviteeAfterInvite = usersAfterInvite.find(user => user.username === 'InviteeMage');
    const leaderRequest = getSocialState(leaderAfterInvite).requests?.[0];
    const inviteeRequest = getSocialState(inviteeAfterInvite).requests?.[0];

    expect(leaderRequest).toMatchObject({ kind: 'party', status: 'pending' });
    expect(inviteeRequest).toEqual(leaderRequest);

    expect(login('InviteeMage', 'test-password').success).toBe(true);
    const incoming = getIncomingSocialRequests();
    expect(incoming).toHaveLength(1);
    expect(await acceptPartyInvite(incoming[0].id)).toMatchObject({ success: true });

    const acceptedParty = getSocialState(getCurrentUser()).party;
    expect(acceptedParty?.leaderUsername).toBe('LeaderMage');
    expect(acceptedParty?.memberUsernames).toEqual(['LeaderMage', 'InviteeMage']);
    expect(getIncomingSocialRequests()).toEqual([]);
    expect(await acceptPartyInvite(incoming[0].id)).toMatchObject({ success: false });

    const usersAfterAccept = getUsers();
    usersAfterAccept.forEach(user => {
      const request = getSocialState(user).requests?.find(candidate => candidate.id === incoming[0].id);
      expect(request?.status).toBe('accepted');
    });
  });

  it('keeps a newer invite alive after an older request from the same leader expires', async () => {
    expect(register('RepeatLeader', 'test-password').success).toBe(true);
    expect(register('RepeatInvitee', 'test-password').success).toBe(true);

    expect(login('RepeatLeader', 'test-password').success).toBe(true);
    setCurrentPlayerLevel(5);
    expect(login('RepeatInvitee', 'test-password').success).toBe(true);
    setCurrentPlayerLevel(5);

    expect(login('RepeatLeader', 'test-password').success).toBe(true);
    expect(await invitePlayerToParty('RepeatInvitee')).toMatchObject({ success: true });

    vi.advanceTimersByTime(2 * 60 * 1000 + 1);
    expireCurrentSocialRequests();
    expect(await invitePlayerToParty('RepeatInvitee')).toMatchObject({ success: true });

    expect(login('RepeatInvitee', 'test-password').success).toBe(true);
    expireCurrentSocialRequests();
    const incoming = getIncomingSocialRequests();
    expect(incoming).toHaveLength(1);
    expect(await acceptPartyInvite(incoming[0].id)).toMatchObject({ success: true });
  });
});
