import type { StoryDialogSequence } from './storyDialogueTypes';

export const storyDialoguePartA1: Record<string, StoryDialogSequence> = {
  'story-01-first-banner': {
    id: 'story-01-first-banner',
    kicker: 'Movement I - The First Banner',
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
      { speaker: 'npc', text: 'Another commander has reached the Candle Road. Harborview has buried more first banners than I name aloud—hospitaller rounds are triage for a coast that keeps forgetting its wounded. Tell me: do you carry a banner, or only steel waiting for a funeral wind?' },
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
          }
        ],
      },
      { speaker: 'npc', text: 'Then begin with ordinary duty before you claim glory. Open Jobs from the map Menu, start any local job, and finish it. Gold, movement, and command all begin with knowing where you stand—and whether the road will recognize you tomorrow.' },
    ],
  },
  'story-02-candle-road': {
    id: 'story-02-candle-road',
    kicker: 'Movement I - Harborview',
    npcName: 'Sister Avel',
    npcTitle: 'Hospitaller of the Candle Road',
    npcModelNumber: 4,
    objective: {
      label: 'Road Order',
      title: 'Travel to Harborview',
      description: 'Select Harborview on the world map and use its travel action to reach the town.',
    },
    lines: [
      { speaker: 'npc', text: 'The job gave your banner weight. Harborview\'s sin is that it will recognize any banner that breaks a toll—even one that later feeds eastern hymns. Still, a living road needs a place that remembers names.' },
      { speaker: 'player', text: 'Harborview is closest.' },
      { speaker: 'npc', text: 'Select Harborview on the painted map, confirm the walk, and enter its gates. Towns sell gear, post contracts, and heal what the road breaks. Report there before fog decides you were never worth a candle.' },
    ],
  },
  'story-03-lost-apprentice': {
    id: 'story-03-lost-apprentice',
    kicker: 'Movement I - The Muster',
    npcName: 'Sister Avel',
    npcTitle: 'Hospitaller of the Candle Road',
    npcModelNumber: 4,
    objective: {
      label: 'Field Contact',
      title: 'Find Marshal Orren',
      description: 'Follow the quest marker to Marshal Orren and speak with him on the world map.',
    },
    lines: [
      { speaker: 'npc', text: 'A banner without soldiers is cloth. A banner without an officer is a funeral shroud. I want proof new steel will do measurable duty—my want—and I have already buried enough first banners to know how often that proof fails—my sin of quiet triage.' },
      { speaker: 'player', text: 'Who holds the muster roll?' },
      { speaker: 'npc', text: 'Marshal Orren. Find him beyond Harborview and speak before you march. Quest contacts return when the story requires their counsel—and when western field law needs a living interruption of illegal pikes.' },
    ],
  },
  'story-04-river-law': {
    id: 'story-04-river-law',
    kicker: 'Movement I - Trial by Steel',
    npcName: 'Marshal Orren',
    npcTitle: 'Harborview Field Marshal',
    npcModelNumber: 1,
    objective: {
      label: 'Combat Order',
      title: 'Defeat one enemy warband',
      description: 'Choose a nearby enemy on the world map, prepare your formation, and win the battle.',
    },
    lines: [
      { speaker: 'npc', text: 'I want western road recognition under living field law. My first western campaign already failed once—the Black Pike Ledger\'s Failed Expedition page is partly mine. A formation drawn on parchment has never heard a wounded soldier scream. Your first enemy will correct that, and finish a war I already lost.' },
      { speaker: 'player', text: 'Point me toward one that deserves the lesson.' },
      { speaker: 'npc', text: 'Any hostile warband near the road will do. Inspect its level and risk label first. Confirm your formation, protect your commander—if the king falls the battle is lost—then claim the battle report so wounded soldiers and rewards are recorded.' },
    ],
  },
  'story-05-violet-satchel': {
    id: 'story-05-violet-satchel',
    kicker: 'Movement I - River Law',
    npcName: 'Marshal Orren',
    npcTitle: 'Harborview Field Marshal',
    npcModelNumber: 1,
    objective: {
      label: 'March Order',
      title: 'Travel to Riverside',
      description: 'Find Riverside on the world map and reach the town to open the eastern road.',
    },
    lines: [
      { speaker: 'npc', text: 'You survived the first clash. Do not mistake survival for mastery. Beyond Harborview the bells have begun answering Black Pike signals—proof that illegal tolls and lawful rings already share a frequency.' },
      { speaker: 'player', text: 'What waits beyond Harborview?' },
      { speaker: 'npc', text: 'Riverside. Its bells govern the eastern crossings, and its lawkeepers know why Black Pike scouts have returned. Reach the river wall before the ledger finishes pricing your banner as debt.' },
    ],
  },
  'story-06-black-pike': {
    id: 'story-06-black-pike',
    kicker: 'Movement I - Black Pike',
    npcName: 'Marshal Orren',
    npcTitle: 'Harborview Field Marshal',
    npcModelNumber: 1,
    objective: {
      label: 'Threat Order',
      title: 'Inspect the Black Pike lieutenant',
      description: 'Open the named threat from the quest tracker and read its scout rating before deciding when to fight.',
    },
    lines: [
      { speaker: 'npc', text: 'Lieutenant Veyr has stopped counting coins. Now he records banners, formations, and the commanders who refuse his toll—predation pretending to be law. Break him and the west gains proof a living banner can interrupt illegal accounting.' },
      { speaker: 'player', text: 'Then I will read his strength before he reads mine.' },
      { speaker: 'npc', text: 'Good. Open the named threat and inspect the scout report. He will remain on the road until your banner is strong enough to break the toll—and leave a coin trail into Moonwell whether we like it or not.' },
    ],
  },
  'story-07-broken-toll': {
    id: 'story-07-broken-toll',
    kicker: 'Movement I - The Broken Toll',
    npcName: 'Marshal Orren',
    npcTitle: 'Harborview Field Marshal',
    npcModelNumber: 1,
    objective: {
      label: 'Capstone Order',
      title: 'Defeat the Black Pike lieutenant',
      description: 'Reach level 5, return to the named threat, prepare your formation, and break the toll camp.',
    },
    lines: [
      { speaker: 'npc', text: 'You know Veyr\'s measure now. He expects fear, a rushed march, and a commander exposed in the front rank. I want his pike broken under Harborview field law—and I will use your victory to finish the campaign my first banner could not.' },
      { speaker: 'player', text: 'He will get a prepared formation instead.' },
      { speaker: 'npc', text: 'Reach full field authority, then take the toll camp. Bring back his pike. Tomorrow the western road will recognize your interruption of illegal law—and every later parasite will notice.' },
    ],
  },
  'story-08-banner-recognized': {
    id: 'story-08-banner-recognized',
    kicker: 'Movement I - Banner Recognized',
    npcName: 'Marshal Orren',
    npcTitle: 'Harborview Field Marshal',
    npcModelNumber: 1,
    objective: {
      label: 'Chapter Complete',
      title: 'The western road recognizes your banner',
      description: 'Claim Orren\'s chapter reward. The next campaign band begins at level 6 with the drowned Moonwell road.',
    },
    lines: [
      { speaker: 'npc', text: 'Lieutenant Veyr\'s pike is broken, his ledger is ash, and the toll bell has stopped. Harborview records the road under your protection. That receipt—the broken pike—means living interruption still works west of the river.' },
      { speaker: 'player', text: 'Then my banner has earned its place.' },
      { speaker: 'npc', text: 'On the western road, yes. Beyond Riverside, Black Pike coin already sits beside names scraped from the Moonwell tithe. Reach veteran authority before you answer those erasures—tomorrow the coast will ask whose law replaces the pike.' },
    ],
  },
  'story-09-moonwell-summons': {
    id: 'story-09-moonwell-summons',
    kicker: 'Movement II - The Drowned Moonwell',
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
      { speaker: 'npc', text: 'Your broken pike bought western recognition—and left a coin trail. Black Pike payments appear beside names scraped from the Moonwell tithe. Some of those names belong to people still walking. I want every stolen name readable again; Star Law\'s sin is that we will keep sealed copies of horror if the ledger demands it.' },
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
          }
        ],
      },
      { speaker: 'npc', text: 'Meet me beyond Riverside. Bring patience. The ink moves whenever a bell rings beneath the water—and an unnamed soul can be conscripted by anyone with a flame.' },
    ],
  },
  'story-07-moonwell': {
    id: 'story-07-moonwell',
    kicker: 'Movement II - Drowned Road',
    npcName: 'Scribe Naima',
    npcTitle: 'Star Lawkeeper',
    npcModelNumber: 5,
    objective: {
      label: 'March Order',
      title: 'Reach Moonwell Pier',
      description: 'Travel to Moonwell Pier and locate the guarded ledger posts along the drowned road.',
    },
    lines: [
      { speaker: 'npc', text: 'The erased names all share one final mark: cargo received at Moonwell Pier after midnight. Reflections there know a commander\'s name before speech—the Mirror Court\'s cousins already tasting the ledger.' },
      { speaker: 'player', text: 'Then the pier is where the lie becomes physical.' },
      { speaker: 'npc', text: 'Walk there before the next bell. Do not trust a reflection that knows your name before you speak it. Midnight cargo marks still guard the drowned road.' },
    ],
  },
  'story-10-moonwell-tithe': {
    id: 'story-10-moonwell-tithe',
    kicker: 'Movement II - Tithe Marks',
    npcName: 'Scribe Naima',
    npcTitle: 'Star Lawkeeper',
    npcModelNumber: 5,
    objective: {
      label: 'Pier Order',
      title: 'Work Moonwell Pier',
      description: 'Complete two jobs at Moonwell Pier to separate honest cargo marks from the candle-cult recruitment cipher.',
    },
    lines: [
      { speaker: 'npc', text: 'The pier still posts honest work. The cult hides its recruitment cipher inside those same tallies—candle-law turned into predation. I need the false pauses pulled free so Star Law can prove the tithe is still alive.' },
      { speaker: 'player', text: 'Then I work the shifts and pull the false marks free.' },
      { speaker: 'npc', text: 'Bring me every pause that does not belong to cargo. Brother Kaito will know which tongueless bell they are waking—and which toll must never be completed.' },
    ],
  },
  'story-08-templar-seal': {
    id: 'story-08-templar-seal',
    kicker: 'Movement II - The Tongueless Bell',
    npcName: 'Brother Kaito',
    npcTitle: 'Bell Tower Monk',
    npcModelNumber: 2,
    objective: {
      label: 'Cipher Order',
      title: 'Find Brother Kaito',
      description: 'Bring the Moonwell tithe marks to Kaito and learn what the drowned bell is waking.',
    },
    lines: [
      { speaker: 'npc', text: 'Those marks are not cargo numbers. They are pauses in a bell sequence too old for any living tower. I want the drowned sequence interrupted—my want—and I have let some sequences almost complete to learn the enemy—my sin of ritual secrecy.' },
      { speaker: 'player', text: 'What answers the sequence?' },
      { speaker: 'npc', text: 'Roots beneath drowned graves. Find me on the river road. I will teach your banner which toll must never be completed before Blackroot finishes it with armored hands.' },
    ],
  }
};
