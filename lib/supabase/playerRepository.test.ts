import { describe, expect, it } from 'vitest';
import type { User } from '@/lib/auth';
import type { MultiplayerChronicleState } from '@/lib/multiplayerChronicle';
import type { MultiplayerEngagementState } from '@/lib/multiplayerEngagement';
import {
  playerStateRowToUser,
  userToPlayerStateRow,
  type PlayerStateRow,
  type ProfileRow,
} from './playerRepository';

function makeUser(): User {
  return {
    username: 'remote-player',
    password: '',
    gold: 10,
    exp: 5,
    x: 1,
    y: 2,
    inventory: [],
    equipment: [],
    equippedSlots: {},
    minions: [],
    activityLog: [],
    traveling: null,
    stats: {
      armyPower: 5,
      defensivePower: 5,
      morale: 5,
      spellPower: 3,
      health: 100,
      maxHealth: 100,
      level: 1,
      unallocatedPoints: 0,
    },
    jobQueue: [],
    selectedModel: 3,
    inventorySlots: 20,
    inventoryUpgradeLevel: 0,
    knownSpellIds: [],
    equippedSpellIds: [],
    spellUnlockVersion: 1,
  };
}

describe('Supabase player progression serialization', () => {
  it('round-trips multiplayer engagement and Chronicle state through game_sessions', () => {
    const user = makeUser();
    user.multiplayerEngagement = { version: 1, events: [] } as unknown as MultiplayerEngagementState;
    user.storyQuests = [{
      questId: 'story-01-first-banner',
      claimed: false,
      introSeen: true,
      responseChoiceId: 'first-banner-pragmatic',
      responseTone: 'pragmatic',
      responseSelectedAt: 1_000,
    }];
    user.multiplayerChronicle = {
      version: 1,
      chronicleId: 'black-pike-ledger-pilot',
      renown: 250,
      processedEventIds: [],
      contributionCounts: {},
      claimedRankIds: ['black-pike-ledger-pilot:rank-1'],
      entitlements: [],
      telemetry: { eventsAwarded: 1, renownAwarded: 250, ranksClaimed: 1 },
    } satisfies MultiplayerChronicleState;

    const row = userToPlayerStateRow(user, 'user-id');
    expect(row.game_sessions.multiplayerEngagement).toEqual(user.multiplayerEngagement);
    expect(row.game_sessions.multiplayerChronicle).toEqual(user.multiplayerChronicle);
    expect(row.story_quests).toEqual(user.storyQuests);

    const restored = playerStateRowToUser(row as PlayerStateRow, {
      id: 'user-id',
      username: user.username,
      selected_model: user.selectedModel,
    } satisfies ProfileRow);
    expect(restored.multiplayerEngagement).toEqual(user.multiplayerEngagement);
    expect(restored.multiplayerChronicle).toEqual(user.multiplayerChronicle);
    expect(restored.storyQuests).toEqual(user.storyQuests);
  });
});
