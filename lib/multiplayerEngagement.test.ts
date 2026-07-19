import { describe, expect, it } from 'vitest';
import {
  claimMultiplayerDailyContract,
  claimMultiplayerWeeklyOath,
  dismissMultiplayerReturningBriefing,
  getMultiplayerDailyContracts,
  getMultiplayerReturnTrack,
  getMultiplayerWeeklyOath,
  normalizeMultiplayerEngagementState,
  recordMultiplayerEngagementEvent,
  rerollMultiplayerDailyContract,
  touchMultiplayerEngagement,
} from '@/lib/multiplayerEngagement';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-07-20T12:00:00').getTime();

describe('multiplayer engagement loops', () => {
  it('generates one deterministic contract for every daily category', () => {
    const first = getMultiplayerDailyContracts(null, 'RoadKeeper', NOW);
    const second = getMultiplayerDailyContracts(null, 'RoadKeeper', NOW);

    expect(first).toEqual(second);
    expect(first.map(contract => contract.category)).toEqual(['combat', 'world', 'social']);
    expect(new Set(first.map(contract => contract.id)).size).toBe(3);
  });

  it('advances and claims contracts only from matching real events', () => {
    let state = normalizeMultiplayerEngagementState(null, 'Banner', NOW);
    const combat = getMultiplayerDailyContracts(state, 'Banner', NOW).find(contract => contract.category === 'combat')!;

    state = recordMultiplayerEngagementEvent(state, 'Banner', {
      id: 'job-started:job-1',
      kind: 'job-started',
      contextId: 'harbor-farm',
      targetId: 'job-1',
    }, NOW + 1);
    expect(getMultiplayerDailyContracts(state, 'Banner', NOW + 1).find(contract => contract.id === combat.id)?.progress).toBe(0);
    expect(claimMultiplayerDailyContract(state, 'Banner', combat.id, NOW + 1).success).toBe(false);

    for (let count = 0; count < combat.target; count += 1) {
      state = recordMultiplayerEngagementEvent(state, 'Banner', {
        id: `battle-result-claimed:encounter-${count}`,
        kind: 'battle-result-claimed',
        targetId: `enemy-${count}`,
      }, NOW + 10 + count);
    }
    const claimed = claimMultiplayerDailyContract(state, 'Banner', combat.id, NOW + 20);
    expect(claimed.success).toBe(true);
    expect(claimed.state.claimedContractIds).toContain(combat.id);
    expect(claimMultiplayerDailyContract(claimed.state, 'Banner', combat.id, NOW + 21).success).toBe(false);
  });

  it('allows one incomplete same-category reroll and resets it next day', () => {
    const state = normalizeMultiplayerEngagementState(null, 'RerollBanner', NOW);
    const world = getMultiplayerDailyContracts(state, 'RerollBanner', NOW).find(contract => contract.category === 'world')!;
    const rerolled = rerollMultiplayerDailyContract(state, 'RerollBanner', world.id, NOW);

    expect(rerolled.success).toBe(true);
    expect(rerolled.state.rerollUsed).toBe(true);
    expect(getMultiplayerDailyContracts(rerolled.state, 'RerollBanner', NOW).find(contract => contract.category === 'world')?.id).not.toBe(world.id);
    expect(rerollMultiplayerDailyContract(rerolled.state, 'RerollBanner', world.id, NOW).success).toBe(false);
    expect(normalizeMultiplayerEngagementState(rerolled.state, 'RerollBanner', NOW + DAY).rerollUsed).toBe(false);
  });

  it('shares weekly progress across combat, world, and social contribution paths', () => {
    let state = normalizeMultiplayerEngagementState(null, 'WeeklyBanner', NOW);
    const kinds = ['battle-result-claimed', 'job-started', 'friend-action', 'dungeon-cleared'] as const;
    for (let index = 0; index < 8; index += 1) {
      state = recordMultiplayerEngagementEvent(state, 'WeeklyBanner', kinds[index % kinds.length], NOW + index);
    }

    const oath = getMultiplayerWeeklyOath(state, 'WeeklyBanner', NOW + 20);
    expect(oath.complete).toBe(true);
    expect(oath.contributions).toEqual({ combat: 4, world: 2, social: 2 });
    const claimed = claimMultiplayerWeeklyOath(state, 'WeeklyBanner', NOW + 20);
    expect(claimed.success).toBe(true);
    expect(claimMultiplayerWeeklyOath(claimed.state, 'WeeklyBanner', NOW + 21).success).toBe(false);
  });

  it('stores contextual events once when the same genuine action is reported twice', () => {
    const input = {
      id: 'story-quest-completed:story-01-first-banner',
      kind: 'story-quest-completed' as const,
      occurredAt: NOW,
      contextId: 'chapter-1',
      targetId: 'story-01-first-banner',
    };
    const first = recordMultiplayerEngagementEvent(null, 'ContextBanner', input, NOW + 5);
    const duplicate = recordMultiplayerEngagementEvent(first, 'ContextBanner', input, NOW + 10);

    expect(duplicate.events).toHaveLength(1);
    expect(duplicate.telemetry.eventsRecorded).toBe(1);
    expect(duplicate.events[0]).toMatchObject({
      ...input,
      kind: 'story-quest-completed',
      actorUsername: 'ContextBanner',
      recordedAt: NOW + 5,
    });
  });

  it('migrates retained legacy event names into canonical semantic events', () => {
    const legacy = {
      dateKey: '2026-07-20',
      weekKey: '2026-07-20',
      events: [
        { id: 'old-battle', kind: 'battle-win', occurredAt: NOW },
        { id: 'old-job', kind: 'job-start', occurredAt: NOW + 1 },
        { id: 'old-dungeon', kind: 'dungeon-clear', occurredAt: NOW + 2 },
      ],
    } as unknown as Parameters<typeof normalizeMultiplayerEngagementState>[0];

    const normalized = normalizeMultiplayerEngagementState(legacy, 'LegacyBanner', NOW + 10);
    expect(normalized.version).toBe(2);
    expect(normalized.events.map(event => event.kind)).toEqual([
      'battle-result-claimed',
      'job-started',
      'dungeon-cleared',
    ]);
    expect(normalized.events.every(event => event.actorUsername === 'LegacyBanner')).toBe(true);
  });

  it('creates and dismisses a briefing after three inactive days', () => {
    let state = touchMultiplayerEngagement(null, 'ReturnBanner', NOW - 5 * DAY);
    state = touchMultiplayerEngagement(state, 'ReturnBanner', NOW);

    expect(state.pendingBriefing?.daysAway).toBe(4);
    expect(state.telemetry.briefingsShown).toBe(1);
    expect(dismissMultiplayerReturningBriefing(state, 'ReturnBanner', NOW).pendingBriefing).toBeUndefined();
  });

  it('tracks seven visits inside an eight-day missed-day buffer window', () => {
    let state = normalizeMultiplayerEngagementState(null, 'TrackBanner', NOW - 7 * DAY);
    for (let index = 0; index < 8; index += 1) {
      if (index === 3) continue;
      state = touchMultiplayerEngagement(state, 'TrackBanner', NOW - (7 - index) * DAY);
    }

    const track = getMultiplayerReturnTrack(state, 'TrackBanner', NOW);
    expect(track.completedDays).toBe(7);
    expect(track.bufferAvailable).toBe(true);
  });
});
