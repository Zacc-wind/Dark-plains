export type StoryDialogSpeaker = 'player' | 'npc';

export interface StoryDialogLine {
  speaker: StoryDialogSpeaker;
  text: string;
}

export interface StoryDialogObjective {
  label: string;
  title: string;
  description: string;
}

export interface StoryDialogSequence {
  id: string;
  kicker: string;
  npcName: string;
  npcTitle: string;
  npcModelNumber?: 1 | 2 | 3 | 4 | 5 | 6;
  npcAssetPath?: string;
  objective?: StoryDialogObjective;
  lines: StoryDialogLine[];
}

export const STORY_DIALOG_SEQUENCES: Record<string, StoryDialogSequence> = {
  'story-01-first-banner': {
    id: 'story-01-first-banner',
    kicker: 'Chapter I - The First Banner',
    npcName: 'Sister Avel',
    npcTitle: 'Hospitaller of the Candle Road',
    npcModelNumber: 4,
    objective: {
      label: 'First Order',
      title: 'Complete one road job',
      description: 'Open Jobs from the map menu and finish any available job at your current location.',
    },
    lines: [
      { speaker: 'npc', text: 'Another commander has reached the old road. Tell me, do you have a banner, or only a weapon?' },
      { speaker: 'player', text: 'I have a name. The banner can be earned.' },
      { speaker: 'npc', text: 'Then begin with work the road can measure. Finish one local job. Gold, movement, and command all begin with knowing where you stand.' },
    ],
  },
  'story-02-candle-road': {
    id: 'story-02-candle-road',
    kicker: 'Chapter I - Harborview',
    npcName: 'Sister Avel',
    npcTitle: 'Hospitaller of the Candle Road',
    npcModelNumber: 4,
    objective: {
      label: 'Road Order',
      title: 'Travel to Harborview',
      description: 'Select Harborview on the world map and use its travel action to reach the town.',
    },
    lines: [
      { speaker: 'npc', text: 'The job gave your banner weight. Now it needs a road and a place that will remember it.' },
      { speaker: 'player', text: 'Harborview is closest.' },
      { speaker: 'npc', text: 'Go there. Select the town on your map, walk to its gates, and learn what a commander can buy, accept, and lose inside a city.' },
    ],
  },
  'story-03-lost-apprentice': {
    id: 'story-03-lost-apprentice',
    kicker: 'Chapter I - The Muster',
    npcName: 'Sister Avel',
    npcTitle: 'Hospitaller of the Candle Road',
    npcModelNumber: 4,
    objective: {
      label: 'Field Contact',
      title: 'Find Marshal Orren',
      description: 'Follow the quest marker to Marshal Orren and speak with him on the world map.',
    },
    lines: [
      { speaker: 'npc', text: 'A banner without soldiers is cloth. A banner without an officer is a funeral shroud.' },
      { speaker: 'player', text: 'Who holds the muster roll?' },
      { speaker: 'npc', text: 'Marshal Orren. Find him beyond Harborview and speak before you march. Quest contacts return when the story requires their counsel.' },
    ],
  },
  'story-04-river-law': {
    id: 'story-04-river-law',
    kicker: 'Chapter I - Trial by Steel',
    npcName: 'Marshal Orren',
    npcTitle: 'Harborview Field Marshal',
    npcModelNumber: 1,
    objective: {
      label: 'Combat Order',
      title: 'Defeat one enemy warband',
      description: 'Choose a nearby enemy on the world map, prepare your formation, and win the battle.',
    },
    lines: [
      { speaker: 'npc', text: 'A formation drawn on parchment has never heard a wounded soldier scream. Your first enemy will correct that.' },
      { speaker: 'player', text: 'Point me toward one that deserves the lesson.' },
      { speaker: 'npc', text: 'Any hostile warband near the road will do. Inspect its level, prepare your field, and protect your commander. If the king falls, the battle is lost.' },
    ],
  },
  'story-05-violet-satchel': {
    id: 'story-05-violet-satchel',
    kicker: 'Chapter I - River Law',
    npcName: 'Marshal Orren',
    npcTitle: 'Harborview Field Marshal',
    npcModelNumber: 1,
    objective: {
      label: 'March Order',
      title: 'Travel to Riverside',
      description: 'Find Riverside on the world map and reach the town to open the eastern road.',
    },
    lines: [
      { speaker: 'npc', text: 'You survived the first clash. Do not mistake survival for mastery.' },
      { speaker: 'player', text: 'What waits beyond Harborview?' },
      { speaker: 'npc', text: 'Riverside. Its bells govern the eastern crossings, and its lawkeepers know why Black Pike scouts have returned. Reach the river wall.' },
    ],
  },
  'story-06-black-pike': {
    id: 'story-06-black-pike',
    kicker: 'Chapter I - Black Pike',
    npcName: 'Marshal Orren',
    npcTitle: 'Harborview Field Marshal',
    npcModelNumber: 1,
    objective: {
      label: 'Threat Order',
      title: 'Win a second battle',
      description: 'Defeat another enemy warband. Black Pike scouts grow stronger farther from the western towns.',
    },
    lines: [
      { speaker: 'npc', text: 'Black Pike raiders tax the mid-road in blood. Break one warband and the rest will learn your name.' },
      { speaker: 'player', text: 'One victory is enough to start.' },
      { speaker: 'npc', text: 'One is enough to survive the week. That is more than most commanders manage.' },
    ],
  },
  'story-15-broken-crown': {
    id: 'story-15-broken-crown',
    kicker: 'Chapter I - Finale',
    npcName: 'Veil Captain Serat',
    npcTitle: 'Eclipse March Scout',
    npcModelNumber: 3,
    lines: [
      { speaker: 'npc', text: 'Emperor Grave-Aurel keeps a broken crown for anyone who still thinks commanders rule alone.' },
      { speaker: 'player', text: 'Then I will take the crown and the lesson with it.' },
      { speaker: 'npc', text: 'The southeast remembers every king-mage who tried. Do not let this be your last reflection.' },
    ],
  },
  'story-16-mirror-council': {
    id: 'story-16-mirror-council',
    kicker: 'Chapter II - Mirror Court',
    npcName: 'Veil Captain Serat',
    npcTitle: 'Eclipse March Scout',
    npcModelNumber: 3,
    lines: [
      { speaker: 'npc', text: 'The crown broke, but the court did not. Mirror envoys now wear your old banner colors.' },
      { speaker: 'player', text: 'Who summons me?' },
      { speaker: 'npc', text: 'Survivors. Walk to my fire on the eclipse road. If you still command an army, prove it before the mirror learns your formations.' },
    ],
  },
  'story-17-moonwell-contract': {
    id: 'story-17-moonwell-contract',
    kicker: 'Chapter II - Moonwell Pier',
    npcName: 'Scribe Naima',
    npcTitle: 'Star Lawkeeper',
    npcModelNumber: 5,
    lines: [
      { speaker: 'npc', text: 'Star Law pays in ink and salt for honest labor. Moonwell Pier still keeps ledgers the mirror court wants burned.' },
      { speaker: 'player', text: 'What work is required?' },
      { speaker: 'npc', text: 'Long shifts on the pier. Let the moon see your hands busy before their forgers rewrite the tithe.' },
    ],
  },
  'story-18-blackwater-gate': {
    id: 'story-18-blackwater-gate',
    kicker: 'Chapter II - Blackwater',
    npcName: 'Gate Warden Sable',
    npcTitle: 'Blackwater Quartermaster',
    npcModelNumber: 1,
    lines: [
      { speaker: 'npc', text: 'Blackwater Gate trades in writs that outlive their signers. The mirror court is buying every road contract it can forge.' },
      { speaker: 'player', text: 'I will walk the walls first.' },
      { speaker: 'npc', text: 'Walk them while they still answer to living commanders. After that, we talk quarry ledgers and blood tithes.' },
    ],
  },
  'story-20-first-dungeon-oath': {
    id: 'story-20-first-dungeon-oath',
    kicker: 'Chapter II - Ossuary',
    npcName: 'Ash Hermit Yara',
    npcTitle: 'Keeper of Oath Fire',
    npcModelNumber: 6,
    lines: [
      { speaker: 'npc', text: 'The ossuaries beneath the marches are recruiting again. Sealed chambers wake when mirror moons rise.' },
      { speaker: 'player', text: 'I will clear one and bring proof.' },
      { speaker: 'npc', text: 'Bring proof, not pride. The ward stones only respect commanders who return with their roster breathing.' },
    ],
  },
  'story-22-eclipse-hold': {
    id: 'story-22-eclipse-hold',
    kicker: 'Chapter II - Eclipse Hold',
    npcName: 'Archivist Letho',
    npcTitle: 'Mirror Court Scribe',
    npcModelNumber: 5,
    lines: [
      { speaker: 'npc', text: 'Eclipse Hold is where king-mages signed their last lies. The mirror court wants to rewrite every oath recorded here.' },
      { speaker: 'player', text: 'Then I will reach the hold before their ink dries.' },
      { speaker: 'npc', text: 'Reach it. Read the walls. When you return, we speak of candle keys and glass reflections.' },
    ],
  },
  'story-24-candle-key': {
    id: 'story-24-candle-key',
    kicker: 'Chapter II - Candle Synod',
    npcName: 'Brother Kaito',
    npcTitle: 'Bell Tower Monk',
    npcModelNumber: 2,
    lines: [
      { speaker: 'npc', text: 'Three candle key fragments can unseal the mirror court, if the synod trusts the hand that carries them.' },
      { speaker: 'player', text: 'Where do the fragments hide?' },
      { speaker: 'npc', text: 'In road chests, quarry tithes, and the pockets of cowards. Gather three. The court will feel the lock turning.' },
    ],
  },
  'story-27-mirror-envoy': {
    id: 'story-27-mirror-envoy',
    kicker: 'Chapter II - Glass Reliquary',
    npcName: 'Archivist Letho',
    npcTitle: 'Mirror Court Scribe',
    npcModelNumber: 5,
    lines: [
      { speaker: 'npc', text: 'I carry the court writ in a reliquary of glass. Every reflection inside it is a confession someone refused aloud.' },
      { speaker: 'player', text: 'You wanted me on the eclipse road.' },
      { speaker: 'npc', text: 'I want you alive when Lady Mirror-Veyra asks who broke her procession. Stand here. Let the court see you refuse to kneel.' },
    ],
  },
  'story-30-lady-in-glass': {
    id: 'story-30-lady-in-glass',
    kicker: 'Chapter II - Finale',
    npcName: 'Archivist Letho',
    npcTitle: 'Mirror Court Scribe',
    npcModelNumber: 5,
    lines: [
      { speaker: 'npc', text: 'Lady Mirror-Veyra keeps the last king-mage reflection. Shatter the court, or kneel to your own image forever.' },
      { speaker: 'player', text: 'I did not march east to admire myself.' },
      { speaker: 'npc', text: 'Then hunt the lady on the eclipse field. Break the glass before the mirror learns your name by heart.' },
    ],
  },
};

export function getStoryDialogSequence(dialogId: string | undefined): StoryDialogSequence | undefined {
  if (!dialogId) return undefined;
  return STORY_DIALOG_SEQUENCES[dialogId];
}
