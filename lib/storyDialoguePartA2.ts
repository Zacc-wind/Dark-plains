import type { StoryDialogSequence } from './storyDialogueTypes';

export const storyDialoguePartA2: Record<string, StoryDialogSequence> = {
  'story-10-blackroot-warning': {
    id: 'story-10-blackroot-warning',
    kicker: 'Movement II - Blackroot',
    npcName: 'Brother Kaito',
    npcTitle: 'Bell Tower Monk',
    npcModelNumber: 2,
    objective: {
      label: 'Threat Order',
      title: 'Inspect the Blackroot Vessel',
      description: 'Open the named Moonwell threat and study its formation before committing your army.',
    },
    lines: [
      { speaker: 'npc', text: 'The bell stopped one beat short. Something climbed from the road to finish it with armored hands—an interrupted sequence given a body of root, plate, and drowned recruit memory.' },
      { speaker: 'player', text: 'A soldier?' },
      { speaker: 'npc', text: 'A vessel. Read its host before you strike. If your commander falls, Blackroot grows strongest around a fallen banner—king-magic\'s sovereignty made literal and ugly.' },
    ],
  },
  'story-09-gravebound-script': {
    id: 'story-09-gravebound-script',
    kicker: 'Movement II - The Blackroot Vessel',
    npcName: 'Brother Kaito',
    npcTitle: 'Bell Tower Monk',
    npcModelNumber: 2,
    objective: {
      label: 'Elite Order',
      title: 'Defeat the Blackroot Vessel',
      description: 'Return to the named level-eight threat and recover the orders sealed inside its armor.',
    },
    lines: [
      { speaker: 'npc', text: 'You have seen its ranks. The hollow center is not a weakness; it is where the vessel stores orders naming Mother Cindervein—the candle-fire priestess who mothers stolen names into soldiers.' },
      { speaker: 'player', text: 'Then I break the armor and take the message.' },
      { speaker: 'npc', text: 'Protect your commander and silence the bell-bearers first. Recover the root-scarred orders. Tomorrow the pier will smell of black candles instead of cargo.' },
    ],
  },
  'story-12-cindervein-warning': {
    id: 'story-12-cindervein-warning',
    kicker: 'Movement II - Black Candles',
    npcName: 'Scribe Naima',
    npcTitle: 'Star Lawkeeper',
    npcModelNumber: 5,
    objective: {
      label: 'Threat Order',
      title: 'Inspect Mother Cindervein',
      description: 'Open the named capstone threat and study the candle host gathered beneath Moonwell Pier.',
    },
    lines: [
      { speaker: 'npc', text: 'The vessel carried one command: prepare every stolen name for Mother Cindervein. A black candle is not decoration—she keeps saints and failed commanders alive inside wax and feeds each flame with a stolen name.' },
      { speaker: 'player', text: 'A title or a creature?' },
      { speaker: 'npc', text: 'Both. See her host beneath the pier before she lights a candle for yours. Inspect the formation; the final count has already begun.' },
    ],
  },
  'story-10-field-council': {
    id: 'story-10-field-council',
    kicker: 'Movement II - Moonwell Capstone',
    npcName: 'Scribe Naima',
    npcTitle: 'Star Lawkeeper',
    npcModelNumber: 5,
    objective: {
      label: 'Capstone Order',
      title: 'Defeat Mother Cindervein',
      description: 'Reach level ten, return to the named threat, and end the recruitment rite beneath the pier.',
    },
    lines: [
      { speaker: 'npc', text: 'Cindervein has begun the final count. When the last candle answers, every erased name becomes a soldier—and the river\'s theft of continuity finishes what Black Pike coin funded.' },
      { speaker: 'player', text: 'Then there will be no last candle.' },
      { speaker: 'npc', text: 'Break each phase of her host and keep your commander standing. She will rise stronger whenever the chamber goes dark. End the rite so names can be returned—and so the eastern rumor line can open.' },
    ],
  },
  'story-14-moonwell-sealed': {
    id: 'story-14-moonwell-sealed',
    kicker: 'Movement II - Names Returned',
    npcName: 'Scribe Naima',
    npcTitle: 'Star Lawkeeper',
    npcModelNumber: 5,
    defaultChoiceId: 'moonwell-sealed-oathbound',
    objective: {
      label: 'Chapter Complete',
      title: 'Release the drowned names',
      description: 'Claim Naima\'s chapter reward. The eastern march opens at level eleven.',
    },
    lines: [
      { speaker: 'npc', text: 'Cindervein is ash. The ledger is readable again—the burned receipt of Movement II—but returned names are not yet safe. The river asks whose law replaces her tithe, and mirror scouts already ask for the same freed ink.' },
      {
        speaker: 'player',
        text: 'Return every name to its family.',
        choicePrompt: 'What law will your banner leave behind?',
        choices: [
          {
            id: 'moonwell-sealed-oathbound',
            tone: 'oathbound',
            label: 'Guard every name',
            text: 'Return every name to its family. My banner will guard the ledger as long as this road stands.',
          },
          {
            id: 'moonwell-sealed-pragmatic',
            tone: 'pragmatic',
            label: 'Keep a sealed copy',
            text: 'Return the names, but keep one sealed copy. Someone funded this rite, and I intend to follow the account.',
          },
          {
            id: 'moonwell-sealed-defiant',
            tone: 'defiant',
            label: 'End the tithe',
            text: 'Burn every tithe mark. The river will carry names freely, or it will answer to my army again.',
          }
        ],
      },
      { speaker: 'npc', text: 'So recorded. Tomorrow the Moonwell road will speak differently—names returned, pier quieter. East of Blackwater, Ash Hermit Yara waits: freed names without a living banner\'s protection can be sung into steel faster than Star Law can rebind them. An iron choir has already smelled the smoke.' },
    ],
  },
  'story-side-silk-scout': {
    id: 'story-side-silk-scout',
    kicker: 'Side Road - Silk Under Stone',
    npcName: 'Brother Kaito',
    npcTitle: 'Bell Tower Monk',
    npcModelNumber: 2,
    objective: {
      label: 'Side Order',
      title: 'Inspect the Moonfen brood',
      description: 'Find the named Moonfen Brood Mother under Moonbridge and study the nest before you clear it.',
    },
    lines: [
      { speaker: 'npc', text: 'Cathedral silk is climbing the underside of Moonbridge. Spiders do not weave that fine unless a mother drives them.' },
      { speaker: 'player', text: 'Then I will read the nest before I burn it.' },
      { speaker: 'npc', text: 'Inspect the brood host. If the silk seals the river crossing, even bells cannot call for help.' },
    ],
  },
  'story-side-silk-clear': {
    id: 'story-side-silk-clear',
    kicker: 'Side Road - Bridge Nest',
    npcName: 'Brother Kaito',
    npcTitle: 'Bell Tower Monk',
    npcModelNumber: 2,
    objective: {
      label: 'Side Order',
      title: 'Defeat the Brood Mother',
      description: 'Clear the Moonfen Brood Mother near Moonbridge and recover cathedral silk for the ward reweave.',
    },
    lines: [
      { speaker: 'npc', text: 'You have seen how the silk anchors. Cut the mother and the threads forget their prayer.' },
      { speaker: 'player', text: 'I will take the silk back to the monks.' },
      { speaker: 'npc', text: 'Protect your commander. Broodlings climb armor faster than men climb ladders.' },
    ],
  },
  'story-side-silk-return': {
    id: 'story-side-silk-return',
    kicker: 'Side Road - Silk Delivered',
    npcName: 'Brother Kaito',
    npcTitle: 'Bell Tower Monk',
    npcModelNumber: 2,
    objective: {
      label: 'Side Complete',
      title: 'Return cathedral silk',
      description: 'Visit Brother Kaito with the recovered cathedral silk so Moonbridge wards can be rewoven.',
    },
    lines: [
      { speaker: 'npc', text: 'The silk is warm. That means it still remembers the drowned pilgrims it was spun from.' },
      { speaker: 'player', text: 'Use it. Keep the bridge open.' },
      { speaker: 'npc', text: 'We will. When the east calls, you will still have a road home.' },
    ],
  },
  'story-side-tithe-cutters': {
    id: 'story-side-tithe-cutters',
    kicker: 'Side Road - Stolen Tithe',
    npcName: 'Scribe Naima',
    npcTitle: 'Star Lawkeeper',
    npcModelNumber: 5,
    objective: {
      label: 'Side Order',
      title: 'Break tithe cutter warbands',
      description: 'Defeat two level 6-9 warbands along the Moonwell road to thin the Tollroad Goblin Cutters.',
    },
    lines: [
      { speaker: 'npc', text: 'Cindervein\'s rite did not invent the tithe thieves. Goblin cutters still move ledger pages toward Crossroads Camp.' },
      { speaker: 'player', text: 'I will break their escorts first.' },
      { speaker: 'npc', text: 'Bleed their road crews. The Hexer only shows himself when the pages stop arriving.' },
    ],
  },
  'story-side-tithe-ledger': {
    id: 'story-side-tithe-ledger',
    kicker: 'Side Road - Drowned Ledger',
    npcName: 'Scribe Naima',
    npcTitle: 'Star Lawkeeper',
    npcModelNumber: 5,
    objective: {
      label: 'Side Order',
      title: 'Defeat the Tollroad Hexer',
      description: 'Defeat the named Tollroad Goblin Hexer near Crossroads Camp and seize the drowned tithe ledger.',
    },
    lines: [
      { speaker: 'npc', text: 'The Hexer sells names the river already tried to forget. Take the ledger before he cuts another page free.' },
      { speaker: 'player', text: 'Then the Hexer dies with his cord still red.' },
      { speaker: 'npc', text: 'Bring me the water-swollen book. Star Law will read who funded the candles.' },
    ],
  },
  'story-side-tithe-return': {
    id: 'story-side-tithe-return',
    kicker: 'Side Road - Law Restored',
    npcName: 'Scribe Naima',
    npcTitle: 'Star Lawkeeper',
    npcModelNumber: 5,
    objective: {
      label: 'Side Complete',
      title: 'Return the drowned ledger',
      description: 'Visit Scribe Naima with the drowned tithe ledger so Star Law can name the remaining funders.',
    },
    lines: [
      { speaker: 'npc', text: 'The ink still runs when you breathe on it. That is how you know the names are real.' },
      { speaker: 'player', text: 'Record every funder. My banner will find them later.' },
      { speaker: 'npc', text: 'So recorded. The Moonwell chapter ends cleaner because you chased the side roads.' },
    ],
  }
};
