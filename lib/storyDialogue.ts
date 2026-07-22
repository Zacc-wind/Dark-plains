export type StoryDialogSpeaker = 'player' | 'npc';
export type StoryResponseTone = 'oathbound' | 'pragmatic' | 'defiant';

export interface StoryDialogChoice {
  id: string;
  tone: StoryResponseTone;
  label: string;
  text: string;
}

export interface StoryDialogLine {
  speaker: StoryDialogSpeaker;
  text: string;
  choicePrompt?: string;
  choices?: StoryDialogChoice[];
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
  defaultChoiceId?: string;
  lines: StoryDialogLine[];
}

export const STORY_DIALOG_SEQUENCES: Record<string, StoryDialogSequence> = {
  'story-01-first-banner': {
    id: 'story-01-first-banner',
    kicker: 'Chapter I - The First Banner',
    npcName: 'Sister Avel',
    npcTitle: 'Hospitaller of the Candle Road',
    npcModelNumber: 4,
    defaultChoiceId: 'first-banner-oathbound',
    objective: {
      label: 'First Order',
      title: 'Complete one road job',
      description: 'Open Jobs from the map menu and finish any available job at your current location.',
    },
    lines: [
      { speaker: 'npc', text: 'Another commander has reached the old road. Tell me, do you have a banner, or only a weapon?' },
      {
        speaker: 'player',
        text: 'I have a name. The banner can be earned.',
        choicePrompt: 'How will your commander answer?',
        choices: [
          {
            id: 'first-banner-oathbound',
            tone: 'oathbound',
            label: 'Swear the road oath',
            text: 'I have a name. I will earn the banner by defending this road.',
          },
          {
            id: 'first-banner-pragmatic',
            tone: 'pragmatic',
            label: 'Ask for the work',
            text: 'Give me work the road can measure. The banner can follow the results.',
          },
          {
            id: 'first-banner-defiant',
            tone: 'defiant',
            label: 'Refuse borrowed honor',
            text: 'I carry no borrowed colors. The road will learn my name before it sees my banner.',
          },
        ],
      },
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
      title: 'Inspect the Black Pike lieutenant',
      description: 'Open the named threat from the quest tracker and read its scout rating before deciding when to fight.',
    },
    lines: [
      { speaker: 'npc', text: 'The Black Pike lieutenant has stopped counting coins. Now he records banners, formations, and the commanders who refuse his toll.' },
      { speaker: 'player', text: 'Then I will read his strength before he reads mine.' },
      { speaker: 'npc', text: 'Good. Open the named threat and inspect the scout report. He will remain on the road until your banner is strong enough to break the toll.' },
    ],
  },
  'story-07-broken-toll': {
    id: 'story-07-broken-toll',
    kicker: 'Chapter I - The Broken Toll',
    npcName: 'Marshal Orren',
    npcTitle: 'Harborview Field Marshal',
    npcModelNumber: 1,
    objective: {
      label: 'Capstone Order',
      title: 'Defeat the Black Pike lieutenant',
      description: 'Reach level 5, return to the named threat, prepare your formation, and break the toll camp.',
    },
    lines: [
      { speaker: 'npc', text: 'You know the lieutenant\'s measure now. He expects fear, a rushed march, and a commander exposed in the front rank.' },
      { speaker: 'player', text: 'He will get a prepared formation instead.' },
      { speaker: 'npc', text: 'Reach full field authority, then take the toll camp. Bring back his pike and the western road will recognize your banner.' },
    ],
  },
  'story-08-banner-recognized': {
    id: 'story-08-banner-recognized',
    kicker: 'Chapter I - Banner Recognized',
    npcName: 'Marshal Orren',
    npcTitle: 'Harborview Field Marshal',
    npcModelNumber: 1,
    objective: {
      label: 'Chapter Complete',
      title: 'The western road recognizes your banner',
      description: 'Claim Orren\'s chapter reward. The next campaign band begins at level 6 with the drowned Moonwell road.',
    },
    lines: [
      { speaker: 'npc', text: 'Lieutenant Veyr\'s pike is broken, his ledger is ash, and the toll bell has stopped. Harborview records the road under your protection.' },
      { speaker: 'player', text: 'Then my banner has earned its place.' },
      { speaker: 'npc', text: 'On the western road, yes. Beyond Riverside the Moonwell is filling with voices again. Reach veteran authority before you answer them.' },
    ],
  },
  'story-09-moonwell-summons': {
    id: 'story-09-moonwell-summons',
    kicker: 'Chapter I - The Drowned Moonwell',
    npcName: 'Scribe Naima',
    npcTitle: 'Star Lawkeeper',
    npcModelNumber: 5,
    defaultChoiceId: 'moonwell-summons-pragmatic',
    objective: {
      label: 'Moonwell Order',
      title: 'Find Scribe Naima',
      description: 'Follow the quest marker to Naima near Riverside and inspect the erased tithe ledger.',
    },
    lines: [
      { speaker: 'npc', text: 'Commander, Black Pike coin appears beside names scraped from the Moonwell tithe. Some of those names belong to people still walking.' },
      {
        speaker: 'player',
        text: 'Show me the ledger.',
        choicePrompt: 'What matters first?',
        choices: [
          {
            id: 'moonwell-summons-oathbound',
            tone: 'oathbound',
            label: 'Protect the named',
            text: 'No living soul will be tithed while my banner holds the road. Show me every stolen name.',
          },
          {
            id: 'moonwell-summons-pragmatic',
            tone: 'pragmatic',
            label: 'Trace the payments',
            text: 'Show me the ledger and the coin trail. We find who profits before we announce the hunt.',
          },
          {
            id: 'moonwell-summons-defiant',
            tone: 'defiant',
            label: 'Challenge the well',
            text: 'If the Moonwell has begun choosing my people, it can answer to me directly.',
          },
        ],
      },
      { speaker: 'npc', text: 'Meet me beyond Riverside. Bring patience. The ink moves whenever a bell rings beneath the water.' },
    ],
  },
  'story-07-moonwell': {
    id: 'story-07-moonwell',
    kicker: 'Chapter I - Drowned Road',
    npcName: 'Scribe Naima',
    npcTitle: 'Star Lawkeeper',
    npcModelNumber: 5,
    objective: {
      label: 'March Order',
      title: 'Reach Moonwell Pier',
      description: 'Travel to Moonwell Pier and locate the guarded ledger posts along the drowned road.',
    },
    lines: [
      { speaker: 'npc', text: 'The erased names all share one final mark: cargo received at Moonwell Pier after midnight.' },
      { speaker: 'player', text: 'Then the pier is where the lie becomes physical.' },
      { speaker: 'npc', text: 'Walk there before the next bell. Do not trust a reflection that knows your name before you speak it.' },
    ],
  },
  'story-08-templar-seal': {
    id: 'story-08-templar-seal',
    kicker: 'Chapter I - The Tongueless Bell',
    npcName: 'Brother Kaito',
    npcTitle: 'Bell Tower Monk',
    npcModelNumber: 2,
    objective: {
      label: 'Cipher Order',
      title: 'Find Brother Kaito',
      description: 'Bring the Moonwell tithe marks to Kaito and learn what the drowned bell is waking.',
    },
    lines: [
      { speaker: 'npc', text: 'Those marks are not cargo numbers. They are pauses in a bell sequence too old for any living tower.' },
      { speaker: 'player', text: 'What answers the sequence?' },
      { speaker: 'npc', text: 'Roots beneath drowned graves. Find me on the river road. I will teach your banner which toll must never be completed.' },
    ],
  },
  'story-10-blackroot-warning': {
    id: 'story-10-blackroot-warning',
    kicker: 'Chapter I - Blackroot',
    npcName: 'Brother Kaito',
    npcTitle: 'Bell Tower Monk',
    npcModelNumber: 2,
    objective: {
      label: 'Threat Order',
      title: 'Inspect the Blackroot Vessel',
      description: 'Open the named Moonwell threat and study its formation before committing your army.',
    },
    lines: [
      { speaker: 'npc', text: 'The bell stopped one beat short. Something climbed from the road to finish it with armored hands.' },
      { speaker: 'player', text: 'A soldier?' },
      { speaker: 'npc', text: 'A vessel. Root, plate, and the memories of drowned recruits. Read its host before you strike.' },
    ],
  },
  'story-09-gravebound-script': {
    id: 'story-09-gravebound-script',
    kicker: 'Chapter I - The Blackroot Vessel',
    npcName: 'Brother Kaito',
    npcTitle: 'Bell Tower Monk',
    npcModelNumber: 2,
    objective: {
      label: 'Elite Order',
      title: 'Defeat the Blackroot Vessel',
      description: 'Return to the named level-eight threat and recover the orders sealed inside its armor.',
    },
    lines: [
      { speaker: 'npc', text: 'You have seen its ranks. The hollow center is not a weakness; it is where the vessel stores its orders.' },
      { speaker: 'player', text: 'Then I break the armor and take the message.' },
      { speaker: 'npc', text: 'Protect your commander and silence the bell-bearers first. Blackroot grows strongest around a fallen banner.' },
    ],
  },
  'story-12-cindervein-warning': {
    id: 'story-12-cindervein-warning',
    kicker: 'Chapter I - Black Candles',
    npcName: 'Scribe Naima',
    npcTitle: 'Star Lawkeeper',
    npcModelNumber: 5,
    objective: {
      label: 'Threat Order',
      title: 'Inspect Mother Cindervein',
      description: 'Open the named capstone threat and study the candle host gathered beneath Moonwell Pier.',
    },
    lines: [
      { speaker: 'npc', text: 'The vessel carried one command: prepare every stolen name for Mother Cindervein.' },
      { speaker: 'player', text: 'A title or a creature?' },
      { speaker: 'npc', text: 'Both. She keeps a black candle for every recruit the river forgot. See her host before she lights yours.' },
    ],
  },
  'story-10-field-council': {
    id: 'story-10-field-council',
    kicker: 'Chapter I - Moonwell Capstone',
    npcName: 'Scribe Naima',
    npcTitle: 'Star Lawkeeper',
    npcModelNumber: 5,
    objective: {
      label: 'Capstone Order',
      title: 'Defeat Mother Cindervein',
      description: 'Reach level ten, return to the named threat, and end the recruitment rite beneath the pier.',
    },
    lines: [
      { speaker: 'npc', text: 'Cindervein has begun the final count. When the last candle answers, every erased name becomes a soldier.' },
      { speaker: 'player', text: 'Then there will be no last candle.' },
      { speaker: 'npc', text: 'Break each phase of her host and keep your commander standing. She will rise stronger whenever the chamber goes dark.' },
    ],
  },
  'story-14-moonwell-sealed': {
    id: 'story-14-moonwell-sealed',
    kicker: 'Chapter I - Names Returned',
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
      { speaker: 'npc', text: 'Cindervein is ash. The ledger is readable again, but the river asks whose law replaces her tithe.' },
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
          },
        ],
      },
      { speaker: 'npc', text: 'So recorded. The Moonwell road will remember not only that you won, but what you chose to preserve.' },
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
