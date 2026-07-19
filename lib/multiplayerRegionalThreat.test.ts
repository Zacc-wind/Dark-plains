import { describe, expect, it } from 'vitest';
import type { User } from '@/lib/auth';
import { getNpcEnemiesForUser } from '@/lib/battle';
import { normalizeMultiplayerEngagementState } from '@/lib/multiplayerEngagement';
import {
  getRegionalThreatDefinition,
  getRegionalThreatBossEnemyId,
  getRegionalThreatView,
} from '@/lib/multiplayerRegionalThreat';

const NOW = Date.parse('2026-07-20T12:00:00Z');
const WEEK_KEY = '2026-07-20';

describe('regional threat world spawning', () => {
  it('adds the weekly boss and changes patrol composition in its named region', () => {
    const engagement = normalizeMultiplayerEngagementState(null, 'RegionalSpawnTest', NOW);
    const definition = getRegionalThreatDefinition(WEEK_KEY);
    const user = {
      username: 'RegionalSpawnTest',
      x: 24,
      y: 22,
      stats: { level: 6 },
      storyQuests: [],
      activityLog: [],
      multiplayerEngagement: engagement,
    } as unknown as User;

    const enemies = getNpcEnemiesForUser(user, NOW);
    const boss = enemies.find(enemy => enemy.id === getRegionalThreatBossEnemyId(WEEK_KEY));
    const threatPatrol = enemies.find(enemy => (
      enemy.spawnRegionId === definition.regionId
      && !enemy.bossId
      && enemy.subtitle.includes('Threat patrol')
    ));

    expect(boss).toMatchObject({
      bossId: definition.bossId,
      spawnKind: 'regional-threat',
      spawnRegionId: definition.regionId,
      requiredPlayerLevel: 6,
    });
    expect(threatPatrol?.minions.some(minion => (
      definition.featuredMinionTemplateIds.includes(minion.templateId)
    ))).toBe(true);
  });

  it('does not count the named boss result as one of the required patrol victories', () => {
    const definition = getRegionalThreatDefinition(WEEK_KEY);
    const threat = getRegionalThreatView({
      weekKey: WEEK_KEY,
      level: 6,
      claimedIds: [],
      events: [
        {
          kind: 'battle-result-claimed',
          contextId: definition.regionId,
          targetId: getRegionalThreatBossEnemyId(WEEK_KEY),
          occurredAt: NOW,
        },
        {
          kind: 'boss-defeated',
          contextId: definition.regionId,
          targetId: definition.bossId,
          occurredAt: NOW,
        },
      ],
    });

    expect(threat).toMatchObject({ patrolProgress: 0, bossDefeated: true, complete: false });
  });
});
