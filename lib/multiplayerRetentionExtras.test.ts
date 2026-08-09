import { describe, expect, it } from 'vitest';
import type { MultiplayerEngagementEvent, MultiplayerEngagementEventKind } from './multiplayerEngagement';
import {
  GLASS_ROAD_MEMORIAL_RANKS,
  claimMultiplayerChronicleArchiveRank,
  getMultiplayerChronicleArchiveView,
  syncMultiplayerChronicleEvents,
} from './multiplayerChronicle';
import {
  REPUTATION_FACTIONS,
  claimMultiplayerReputationTier,
  getMultiplayerReputationView,
  getReputationFactionForCityQuest,
  syncMultiplayerReputationEvents,
} from './multiplayerReputation';
import {
  MULTIPLAYER_DEEDS,
  claimMultiplayerDeed,
  getMultiplayerDeedsView,
} from './multiplayerDeeds';

const NOW = Date.parse('2026-08-09T12:00:00Z');

function event(
  id: string,
  kind: MultiplayerEngagementEventKind,
  occurredAt = NOW,
  targetId?: string,
): MultiplayerEngagementEvent {
  return {
    id,
    kind,
    occurredAt,
    recordedAt: occurredAt,
    actorUsername: 'RetentionTester',
    targetId,
  };
}

describe('faction reputation tracks', () => {
  it('maps Candle Compact and Blackwater League board factions', () => {
    expect(REPUTATION_FACTIONS).toHaveLength(2);
    expect(getReputationFactionForCityQuest('hv-candle-watch')).toBe('candle-compact');
    expect(getReputationFactionForCityQuest('bw-gate-watch')).toBe('blackwater-league');
  });

  it('awards capped standing from city contracts and claims tiers once', () => {
    const events = Array.from({ length: 6 }, (_, index) => (
      event(`contract-${index}`, 'city-contract-completed', NOW + index, 'hv-candle-watch')
    ));
    const synced = syncMultiplayerReputationEvents(null, events);
    expect(synced.factions['candle-compact'].standing).toBe(48);

    const view = getMultiplayerReputationView(synced, events, 10);
    expect(view.factions.find(faction => faction.id === 'candle-compact')?.unlocked).toBe(true);
    expect(view.claimableCount).toBeGreaterThan(0);

    const claim = claimMultiplayerReputationTier(synced, events, 'candle-compact', 1, 10);
    expect(claim.success).toBe(true);
    expect(claim.state.factions['candle-compact'].claimedTiers).toContain(1);
    expect(claimMultiplayerReputationTier(claim.state, events, 'candle-compact', 1, 10).success).toBe(false);
  });
});

describe('campaign deeds', () => {
  it('tracks progress and claims cosmetics once', () => {
    expect(MULTIPLAYER_DEEDS.length).toBeGreaterThanOrEqual(8);
    const events = Array.from({ length: 10 }, (_, index) => (
      event(`city-${index}`, 'city-contract-completed', NOW + index)
    ));
    const view = getMultiplayerDeedsView(null, events, {
      claimedChronicleRanks: 2,
      claimedStoryQuests: 8,
    });
    expect(view.deeds.find(deed => deed.id === 'deed-first-banner')?.complete).toBe(true);
    expect(view.deeds.find(deed => deed.id === 'deed-contract-hand')?.complete).toBe(true);

    const claim = claimMultiplayerDeed(view.state, events, {
      claimedChronicleRanks: 2,
      claimedStoryQuests: 8,
    }, 'deed-first-banner');
    expect(claim.success).toBe(true);
    expect(claim.state.entitlements.some(item => item.id === 'deed-title-first-banner')).toBe(true);
    expect(claimMultiplayerDeed(claim.state, events, {
      claimedChronicleRanks: 2,
      claimedStoryQuests: 8,
    }, 'deed-first-banner').success).toBe(false);
  });
});

describe('Glass Road memorial archive', () => {
  it('progresses at half Renown and gates claims behind unlock', () => {
    expect(GLASS_ROAD_MEMORIAL_RANKS).toHaveLength(10);
    const events = Array.from({ length: 4 }, (_, index) => (
      event(`story-${index}`, 'story-quest-completed', NOW + index)
    ));
    const synced = syncMultiplayerChronicleEvents(null, events);
    expect(synced.archiveTracks?.['glass-road-memorial']?.renown).toBe(56);

    const locked = getMultiplayerChronicleArchiveView(synced, events, false);
    expect(locked.claimableCount).toBe(0);
    expect(claimMultiplayerChronicleArchiveRank(synced, events, 1, false).success).toBe(false);

    const unlocked = getMultiplayerChronicleArchiveView(synced, events, true);
    expect(unlocked.claimableCount).toBeGreaterThan(0);
    const claim = claimMultiplayerChronicleArchiveRank(synced, events, 1, true);
    expect(claim.success).toBe(true);
    expect(claim.state.archiveTracks?.['glass-road-memorial']?.claimedRankIds).toContain(claim.rank?.id);
  });
});
