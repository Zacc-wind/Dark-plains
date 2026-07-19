import type { StoryDialogSequence } from './storyDialogue';

export type MultiplayerUnlockDialogueId =
  | 'unlock-level-2-forge'
  | 'unlock-level-3-pvp'
  | 'unlock-level-4-trading'
  | 'unlock-level-5-company';

export interface MultiplayerUnlockDialogueDefinition {
  id: MultiplayerUnlockDialogueId;
  minLevel: number;
  title: string;
  featureIds: string[];
  sequence: StoryDialogSequence;
}

export const MULTIPLAYER_UNLOCK_DIALOGUES: MultiplayerUnlockDialogueDefinition[] = [
  {
    id: 'unlock-level-2-forge',
    minLevel: 2,
    title: 'The Tempered Seal',
    featureIds: ['gear-upgrades'],
    sequence: {
      id: 'unlock-level-2-forge',
      kicker: 'Command Rank II - Forge License',
      npcName: 'Master Ilyra',
      npcTitle: 'Harborview Forgekeeper',
      npcModelNumber: 3,
      lines: [
        { speaker: 'npc', text: 'Your rank now permits a forgekeeper to cut sockets into commander gear. Each socket adds a permanent combat bonus to that item.' },
        { speaker: 'player', text: 'What does the work cost?' },
        { speaker: 'npc', text: 'New sockets consume gold and rare gems. Reinforcing a socket costs gold, shows its success chance before you commit, and a failed attempt can lower its current level.' },
      ],
    },
  },
  {
    id: 'unlock-level-3-pvp',
    minLevel: 3,
    title: 'The Duel Charter',
    featureIds: ['pvp-hub', 'pvp-challenges'],
    sequence: {
      id: 'unlock-level-3-pvp',
      kicker: 'Command Rank III - Duel Charter',
      npcName: 'Marshal Orren',
      npcTitle: 'Harborview Field Marshal',
      npcModelNumber: 1,
      lines: [
        { speaker: 'npc', text: 'Your banner now carries enough weight to challenge another commander under the duel charter.' },
        { speaker: 'player', text: 'What does the charter protect?' },
        { speaker: 'npc', text: 'A challenge must be accepted before battle. Ratings move only from confirmed results, and a new commander receives loss protection while learning the field.' },
      ],
    },
  },
  {
    id: 'unlock-level-4-trading',
    minLevel: 4,
    title: 'The Licensed Exchange',
    featureIds: ['trading'],
    sequence: {
      id: 'unlock-level-4-trading',
      kicker: 'Command Rank IV - Trade Writ',
      npcName: 'Scribe Naima',
      npcTitle: 'Star Lawkeeper',
      npcModelNumber: 5,
      lines: [
        { speaker: 'npc', text: 'The towns will now recognize your seal on a trade writ. That privilege exists because your inventory has become worth stealing.' },
        { speaker: 'player', text: 'Then every exchange is inspected.' },
        { speaker: 'npc', text: 'Review both offers before confirming. Gold and items move only after both commanders agree; promises made in chat carry no protection.' },
      ],
    },
  },
  {
    id: 'unlock-level-5-company',
    minLevel: 5,
    title: 'Raise a Company Standard',
    featureIds: ['party', 'coop-dungeons'],
    sequence: {
      id: 'unlock-level-5-company',
      kicker: 'Command Rank V - Company Standard',
      npcName: 'Sister Avel',
      npcTitle: 'Hospitaller of the Candle Road',
      npcModelNumber: 4,
      lines: [
        { speaker: 'npc', text: 'A level-five banner may gather a company. Parties share a channel, a road position, and access to cooperative dungeon preparation.' },
        { speaker: 'player', text: 'Who owns the company?' },
        { speaker: 'npc', text: 'The leader controls invitations, but every commander keeps their own army and rewards. Cooperation is a formation, not a surrender.' },
      ],
    },
  },
];

export const MULTIPLAYER_UNLOCK_DIALOGUE_IDS = MULTIPLAYER_UNLOCK_DIALOGUES.map(dialogue => dialogue.id);

export function getMultiplayerUnlockDialogue(
  id: MultiplayerUnlockDialogueId | null | undefined,
): MultiplayerUnlockDialogueDefinition | undefined {
  return MULTIPLAYER_UNLOCK_DIALOGUES.find(dialogue => dialogue.id === id);
}

export function getNextMultiplayerUnlockDialogue(
  level: number,
  completedIds: readonly MultiplayerUnlockDialogueId[],
): MultiplayerUnlockDialogueDefinition | null {
  const normalizedLevel = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  const completed = new Set(completedIds);
  return MULTIPLAYER_UNLOCK_DIALOGUES.find(dialogue => (
    normalizedLevel >= dialogue.minLevel && !completed.has(dialogue.id)
  )) || null;
}
