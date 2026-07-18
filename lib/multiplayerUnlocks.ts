export type MultiplayerFeatureId =
  | 'jobs'
  | 'towns'
  | 'story-quests'
  | 'npc-encounters'
  | 'inventory'
  | 'army'
  | 'city-contracts'
  | 'gear-upgrades'
  | 'dungeon-preview'
  | 'pvp-hub'
  | 'pvp-challenges'
  | 'trading'
  | 'party'
  | 'coop-dungeons'
  | 'veteran-regions';

export interface MultiplayerUnlockDefinition {
  id: MultiplayerFeatureId;
  title: string;
  minLevel: number;
  description: string;
}

export interface MultiplayerUnlockStatus extends MultiplayerUnlockDefinition {
  level: number;
  unlocked: boolean;
  requirement: string;
}

export type MultiplayerLevelSubject = number | {
  stats?: { level?: number } | null;
} | null | undefined;

export const MULTIPLAYER_UNLOCK_REGISTRY: Record<MultiplayerFeatureId, MultiplayerUnlockDefinition> = {
  jobs: {
    id: 'jobs',
    title: 'Road Jobs',
    minLevel: 1,
    description: 'Take persistent work orders from world sites.',
  },
  towns: {
    id: 'towns',
    title: 'Towns',
    minLevel: 1,
    description: 'Travel to settlements and use their basic services.',
  },
  'story-quests': {
    id: 'story-quests',
    title: 'Story Quests',
    minLevel: 1,
    description: 'Follow the main shared-world campaign.',
  },
  'npc-encounters': {
    id: 'npc-encounters',
    title: 'World Contacts',
    minLevel: 1,
    description: 'Meet quest contacts and fight roaming enemies.',
  },
  inventory: {
    id: 'inventory',
    title: 'Inventory',
    minLevel: 1,
    description: 'Manage persistent gear, supplies, and relics.',
  },
  army: {
    id: 'army',
    title: 'Army Management',
    minLevel: 1,
    description: 'Choose fielded units and prepare formations.',
  },
  'city-contracts': {
    id: 'city-contracts',
    title: 'City Contracts',
    minLevel: 2,
    description: 'Accept rotating settlement contracts with stronger rewards.',
  },
  'gear-upgrades': {
    id: 'gear-upgrades',
    title: 'Gear Forge',
    minLevel: 2,
    description: 'Add and improve socket bonuses at town blacksmiths.',
  },
  'dungeon-preview': {
    id: 'dungeon-preview',
    title: 'PVE Intel',
    minLevel: 2,
    description: 'Inspect active dungeons, regional threats, and world bosses.',
  },
  'pvp-hub': {
    id: 'pvp-hub',
    title: 'PVP Hub',
    minLevel: 3,
    description: 'Review duel rules, ratings, and available commanders.',
  },
  'pvp-challenges': {
    id: 'pvp-challenges',
    title: 'Duel Challenges',
    minLevel: 3,
    description: 'Send, accept, and confirm ranked duel challenges.',
  },
  trading: {
    id: 'trading',
    title: 'Trading',
    minLevel: 4,
    description: 'Exchange valuables after inventory value is established.',
  },
  party: {
    id: 'party',
    title: 'Party Creation',
    minLevel: 5,
    description: 'Create a party, invite commanders, and use party chat.',
  },
  'coop-dungeons': {
    id: 'coop-dungeons',
    title: 'Co-op Dungeons',
    minLevel: 5,
    description: 'Enter shared dungeon sessions with a prepared party.',
  },
  'veteran-regions': {
    id: 'veteran-regions',
    title: 'Veteran Regions',
    minLevel: 6,
    description: 'Access harder regions, dungeon tiers, and boss rotations.',
  },
};

export function getMultiplayerSubjectLevel(subject: MultiplayerLevelSubject): number {
  const value = typeof subject === 'number' ? subject : subject?.stats?.level;
  return Math.max(1, Math.floor(Number.isFinite(value) ? Number(value) : 1));
}

export function getMultiplayerUnlockStatus(
  featureId: MultiplayerFeatureId,
  subject: MultiplayerLevelSubject,
): MultiplayerUnlockStatus {
  const definition = MULTIPLAYER_UNLOCK_REGISTRY[featureId];
  const level = getMultiplayerSubjectLevel(subject);
  return {
    ...definition,
    level,
    unlocked: level >= definition.minLevel,
    requirement: definition.minLevel <= 1 ? 'Available now' : `Unlocks at level ${definition.minLevel}`,
  };
}

export function requireMultiplayerUnlock(
  featureId: MultiplayerFeatureId,
  subject: MultiplayerLevelSubject,
): { allowed: true } | { allowed: false; error: string } {
  const status = getMultiplayerUnlockStatus(featureId, subject);
  return status.unlocked
    ? { allowed: true }
    : { allowed: false, error: `${status.title} unlocks at level ${status.minLevel}.` };
}
