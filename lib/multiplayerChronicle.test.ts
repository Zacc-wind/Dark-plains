import { describe, expect, it } from 'vitest';
import type { MultiplayerEngagementEvent, MultiplayerEngagementEventKind } from './multiplayerEngagement';
import {
  BLACK_PIKE_CHRONICLE_RANKS,
  claimMultiplayerChronicleRank,
  getMultiplayerChronicleView,
  normalizeMultiplayerChronicleState,
  syncMultiplayerChronicleEvents,
} from './multiplayerChronicle';

const NOW = Date.parse('2026-07-20T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function event(id: string, kind: MultiplayerEngagementEventKind, occurredAt = NOW): MultiplayerEngagementEvent {
  return { id, kind, occurredAt, recordedAt: occurredAt, actorUsername: 'ChronicleTester' };
}

describe('Black Pike Ledger Chronicle pilot', () => {
  it('defines a free 20-rank track with meaningful fifth-rank milestones', () => {
    expect(BLACK_PIKE_CHRONICLE_RANKS).toHaveLength(20);
    expect(BLACK_PIKE_CHRONICLE_RANKS.map(rank => rank.renownRequired)).toEqual(
      Array.from({ length: 20 }, (_, index) => (index + 1) * 50),
    );
    [5, 10, 15, 20].forEach(rankNumber => {
      const rank = BLACK_PIKE_CHRONICLE_RANKS[rankNumber - 1];
      expect(rank.rewards.some(reward => reward.entitlement)).toBe(true);
    });
  });

  it('applies daily and weekly caps and never awards one event id twice', () => {
    const events = [
      ...Array.from({ length: 5 }, (_, index) => event(`job-${index}`, 'job-completed', NOW + index)),
      event('win-1', 'battle-result-claimed', NOW + 10),
      event('win-2', 'battle-result-claimed', NOW + 11),
      event('win-next-week', 'battle-result-claimed', NOW + 7 * DAY),
    ];
    const first = syncMultiplayerChronicleEvents(null, events);
    expect(first.renown).toBe(52);
    expect(first.telemetry).toMatchObject({ eventsAwarded: 5, renownAwarded: 52 });

    const duplicate = syncMultiplayerChronicleEvents(first, events);
    expect(duplicate.renown).toBe(52);
    expect(duplicate.telemetry.eventsAwarded).toBe(5);
  });

  it('unlocks, claims, and permanently records rank entitlements', () => {
    const storyEvents = Array.from({ length: 9 }, (_, index) => (
      event(`story-${index}`, 'story-quest-completed', NOW + index)
    ));
    const view = getMultiplayerChronicleView(null, storyEvents);
    expect(view.state.renown).toBe(252);
    expect(view.currentRank).toBe(5);
    expect(view.claimableCount).toBe(5);

    const claim = claimMultiplayerChronicleRank(view.state, storyEvents, 5);
    expect(claim.success).toBe(true);
    expect(claim.state.entitlements).toMatchObject([
      { id: 'banner-mended-pike', kind: 'banner' },
    ]);
    expect(claimMultiplayerChronicleRank(claim.state, storyEvents, 5).success).toBe(false);

    const reloaded = normalizeMultiplayerChronicleState(JSON.parse(JSON.stringify(claim.state)));
    expect(reloaded.renown).toBe(252);
    expect(reloaded.claimedRankIds).toContain(claim.rank.id);
    expect(reloaded.entitlements[0].label).toBe('Mended Pike Pattern');
  });
});
