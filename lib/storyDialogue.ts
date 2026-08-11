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
      { speaker: 'npc', text: 'Then begin with work the road can measure. Open Jobs from the map Menu, start any local job, and finish it. Gold, movement, and command all begin with knowing where you stand.' },
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
      { speaker: 'npc', text: 'Select Harborview on the painted map, confirm the walk, and enter its gates. Towns sell gear, post contracts, and heal what the road breaks.' },
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
      { speaker: 'npc', text: 'Any hostile warband near the road will do. Inspect its level and risk label first. Confirm your formation, protect your commander—if the king falls the battle is lost—then claim the battle report so wounded soldiers and rewards are recorded.' },
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
  'story-10-moonwell-tithe': {
    id: 'story-10-moonwell-tithe',
    kicker: 'Chapter I - Tithe Marks',
    npcName: 'Scribe Naima',
    npcTitle: 'Star Lawkeeper',
    npcModelNumber: 5,
    objective: {
      label: 'Pier Order',
      title: 'Work Moonwell Pier',
      description: 'Complete two jobs at Moonwell Pier to separate honest cargo marks from the candle-cult recruitment cipher.',
    },
    lines: [
      { speaker: 'npc', text: 'The pier still posts honest work. The cult hides its cipher inside those same tallies.' },
      { speaker: 'player', text: 'Then I work the shifts and pull the false marks free.' },
      { speaker: 'npc', text: 'Bring me every pause that does not belong to cargo. Brother Kaito will know which bell they are waking.' },
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
      { speaker: 'npc', text: 'So recorded. The Moonwell road will remember not only that you won, but what you chose to preserve. East of Blackwater, Ash Hermit Yara waits—and an iron choir has already begun singing commander names into steel.' },
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
  },
  'story-11-eastward-march': {
    id: 'story-11-eastward-march',
    kicker: 'Chapter III - Eastward March',
    npcName: 'Ash Hermit Yara',
    npcTitle: 'Keeper of Oath Fire',
    npcModelNumber: 6,
    objective: {
      label: 'March Order',
      title: 'Find Ash Hermit Yara',
      description: 'Visit Ash Hermit Yara on the ash road and open the Broken Crown chapter.',
    },
    lines: [
      { speaker: 'npc', text: 'The Moonwell stopped choosing soldiers. Crown country will try to choose kings instead.' },
      { speaker: 'player', text: 'Then teach me what the east demands.' },
      { speaker: 'npc', text: 'Skip a command. Let the mana stack. Walk to Blackwater Gate before the iron choir finishes learning your name.' },
    ],
  },
  'story-12-choir-of-iron': {
    id: 'story-12-choir-of-iron',
    kicker: 'Chapter III - Blackwater Gate',
    npcName: 'Ash Hermit Yara',
    npcTitle: 'Keeper of Oath Fire',
    npcModelNumber: 6,
    objective: {
      label: 'March Order',
      title: 'Reach Blackwater Gate',
      description: 'Travel to Blackwater Gate and hear how the iron choir forges armor from sung names.',
    },
    lines: [
      { speaker: 'npc', text: 'Blackwater Gate still answers living commanders. Listen at its walls—the hymn is already practicing your formation.' },
      { speaker: 'player', text: 'I will walk the gate before it learns me by heart.' },
      { speaker: 'npc', text: 'After the walls, find Veil Captain Serat. She has named the marshal who conducts the choir.' },
    ],
  },
  'story-13-paragon-vow': {
    id: 'story-13-paragon-vow',
    kicker: 'Chapter III - Paragon Vow',
    npcName: 'Veil Captain Serat',
    npcTitle: 'Eclipse March Scout',
    npcModelNumber: 3,
    objective: {
      label: 'Scout Order',
      title: 'Find Veil Captain Serat',
      description: 'Visit Veil Captain Serat and learn the Iron Choir Marshal midpoint threat.',
    },
    lines: [
      { speaker: 'npc', text: 'Moonwell smoke still rides the west wind. Good. The choir hates banners that arrive smelling of victory.' },
      { speaker: 'player', text: 'Who stands between me and Grave-Aurel?' },
      { speaker: 'npc', text: 'The Iron Choir Marshal near East Road Camp. Silence his hymn, then the emperor\'s funeral armor will stand alone.' },
    ],
  },
  'story-14-eclipse-field': {
    id: 'story-14-eclipse-field',
    kicker: 'Chapter III - Eclipse Field',
    npcName: 'Veil Captain Serat',
    npcTitle: 'Eclipse March Scout',
    npcModelNumber: 3,
    objective: {
      label: 'Elite Order',
      title: 'Defeat the Iron Choir Marshal',
      description: 'Defeat the named Iron Choir Marshal near East Road Camp before the field learns your formations.',
    },
    lines: [
      { speaker: 'npc', text: 'When the marshal sings, steel remembers. Break him before your army becomes another verse.' },
      { speaker: 'player', text: 'Then the hymn ends on my terms.' },
      { speaker: 'npc', text: 'Afterward, the southeast will show Emperor Grave-Aurel. Do not let a broken crown be your last reflection.' },
    ],
  },
  'story-15-broken-crown': {
    id: 'story-15-broken-crown',
    kicker: 'Chapter III - Finale',
    npcName: 'Veil Captain Serat',
    npcTitle: 'Eclipse March Scout',
    npcModelNumber: 3,
    objective: {
      label: 'Capstone Order',
      title: 'Defeat Emperor Grave-Aurel',
      description: 'Reach the named southeast threat and defeat Emperor Grave-Aurel to close the Broken Crown chapter.',
    },
    lines: [
      { speaker: 'npc', text: 'Emperor Grave-Aurel keeps a broken crown for anyone who still thinks commanders rule alone.' },
      { speaker: 'player', text: 'Then I will take the crown and the lesson with it.' },
      { speaker: 'npc', text: 'The southeast remembers every king-mage who tried. End him before the Mirror Court wears your victory as glass.' },
    ],
  },
  'story-16-mirror-council': {
    id: 'story-16-mirror-council',
    kicker: 'Chapter IV - Glass Road',
    npcName: 'Veil Captain Serat',
    npcTitle: 'Eclipse March Scout',
    npcModelNumber: 3,
    objective: {
      label: 'Council Order',
      title: 'Find Veil Captain Serat',
      description: 'Visit Serat on the eclipse road and open the Glass Road chapter against the Mirror Court.',
    },
    lines: [
      { speaker: 'npc', text: 'The crown broke, but the court did not. Mirror envoys now wear your old banner colors.' },
      { speaker: 'player', text: 'Who summons me?' },
      { speaker: 'npc', text: 'Survivors. Meet Gate Warden Sable at Blackwater. If you still command an army, prove it before the mirror learns your formations.' },
    ],
  },
  'story-17-moonwell-contract': {
    id: 'story-17-moonwell-contract',
    kicker: 'Chapter IV - Gate Writs',
    npcName: 'Gate Warden Sable',
    npcTitle: 'Blackwater Quartermaster',
    npcModelNumber: 1,
    objective: {
      label: 'Writ Order',
      title: 'Find Gate Warden Sable',
      description: 'Visit Gate Warden Sable and learn which living writs the Mirror Court is buying.',
    },
    lines: [
      { speaker: 'npc', text: 'Writs outlive the hands that signed them. The court is buying every eastern road contract it can forge.' },
      { speaker: 'player', text: 'Then show me which ledgers still answer living commanders.' },
      { speaker: 'npc', text: 'Walk Blackwater Gate first. After the walls, we hunt the Mirror Road Captain rewriting the quarry approaches.' },
    ],
  },
  'story-18-blackwater-gate': {
    id: 'story-18-blackwater-gate',
    kicker: 'Chapter IV - Blackwater',
    npcName: 'Gate Warden Sable',
    npcTitle: 'Blackwater Quartermaster',
    npcModelNumber: 1,
    objective: {
      label: 'March Order',
      title: 'Reach Blackwater Gate',
      description: 'Travel to Blackwater Gate and confirm the walls still answer living commanders.',
    },
    lines: [
      { speaker: 'npc', text: 'Blackwater Gate trades in writs that outlive their signers. Walk them while the ink still remembers blood.' },
      { speaker: 'player', text: 'I will walk the walls first.' },
      { speaker: 'npc', text: 'When you return from the walls, the Mirror Road Captain will be waiting near Granite Heights. Break her before glass finishes your colors.' },
    ],
  },
  'story-19-eclipse-scouts': {
    id: 'story-19-eclipse-scouts',
    kicker: 'Chapter IV - Eclipse Scouts',
    npcName: 'Gate Warden Sable',
    npcTitle: 'Blackwater Quartermaster',
    npcModelNumber: 1,
    objective: {
      label: 'Elite Order',
      title: 'Defeat the Mirror Road Captain',
      description: 'Defeat the named Mirror Road Captain near Granite Heights Quarry before scouts learn your formations.',
    },
    lines: [
      { speaker: 'npc', text: 'She wears the banners of commanders who already lost once. That is how the court teaches the next road.' },
      { speaker: 'player', text: 'Then I break the captain and keep my colors.' },
      { speaker: 'npc', text: 'After her, Prior Moon Voss opens the ossuaries with reflected water. End him at Eclipse Hold.' },
    ],
  },
  'story-20-first-dungeon-oath': {
    id: 'story-20-first-dungeon-oath',
    kicker: 'Chapter IV - Prior Moon',
    npcName: 'Gate Warden Sable',
    npcTitle: 'Blackwater Quartermaster',
    npcModelNumber: 1,
    objective: {
      label: 'Capstone Order',
      title: 'Defeat Prior Moon Voss',
      description: 'Defeat Prior Moon Voss near Eclipse Hold and stop the Glass Road from rewriting every sealed chamber.',
    },
    lines: [
      { speaker: 'npc', text: 'Voss reads omens from broken water. Every chamber he opens takes a year from the living road.' },
      { speaker: 'player', text: 'Then the prior dies before the next chamber answers.' },
      { speaker: 'npc', text: 'Bring me his moon glass. Blackwater will record that living law still owns the Glass Road.' },
    ],
  },
  'story-20-glass-sealed': {
    id: 'story-20-glass-sealed',
    kicker: 'Chapter IV - Road Sealed',
    npcName: 'Gate Warden Sable',
    npcTitle: 'Blackwater Quartermaster',
    npcModelNumber: 1,
    objective: {
      label: 'Chapter Complete',
      title: 'Seal the Glass Road',
      description: 'Return to Gate Warden Sable after Prior Moon Voss falls and claim the Glass Road chapter reward.',
    },
    lines: [
      { speaker: 'npc', text: 'The glass is cracked. Good. The court hates evidence that does not reflect their preferred ending.' },
      { speaker: 'player', text: 'Record it under living law.' },
      { speaker: 'npc', text: 'So recorded. Brother Kaito already whispers about candle keys. Reach twenty-one when you are ready for that race.' },
    ],
  },
  'story-21-quarry-ledger': {
    id: 'story-21-quarry-ledger',
    kicker: 'Chapter V - Candle Key',
    npcName: 'Brother Kaito',
    npcTitle: 'Bell Tower Monk',
    npcModelNumber: 2,
    objective: {
      label: 'Key Order',
      title: 'Find Brother Kaito',
      description: 'Visit Brother Kaito and open the Candle Key race before the Mirror Court seals the lock.',
    },
    lines: [
      { speaker: 'npc', text: 'Voss is quiet. The candle key will not stay quiet. Rival powers already race the same fragments.' },
      { speaker: 'player', text: 'Then show me the lock before they turn it.' },
      { speaker: 'npc', text: 'Reach Eclipse Hold. Ser Kael Duskplate guards the quarry road where blue oaths still answer living steel.' },
    ],
  },
  'story-22-eclipse-hold': {
    id: 'story-22-eclipse-hold',
    kicker: 'Chapter V - Eclipse Hold',
    npcName: 'Brother Kaito',
    npcTitle: 'Bell Tower Monk',
    npcModelNumber: 2,
    objective: {
      label: 'March Order',
      title: 'Reach Eclipse Hold',
      description: 'Travel to Eclipse Hold before the Mirror Court rewrites the oaths recorded on its walls.',
    },
    lines: [
      { speaker: 'npc', text: 'Eclipse Hold is where king-mages signed their last lies. Walk the walls while the ink still remembers blood.' },
      { speaker: 'player', text: 'Then I will reach the hold before their forgers dry.' },
      { speaker: 'npc', text: 'After the walls, break Ser Kael near Granite Heights. He keeps the first candle key route cold.' },
    ],
  },
  'story-23-iron-chorus': {
    id: 'story-23-iron-chorus',
    kicker: 'Chapter V - Key Warden',
    npcName: 'Brother Kaito',
    npcTitle: 'Bell Tower Monk',
    npcModelNumber: 2,
    objective: {
      label: 'Elite Order',
      title: 'Defeat Ser Kael Duskplate',
      description: 'Defeat Ser Kael Duskplate near Granite Heights Quarry and open the candle key fragment hunt.',
    },
    lines: [
      { speaker: 'npc', text: 'Kael drowned in moonlit steel and returned with vows too cold for mortal law. He will not give the road freely.' },
      { speaker: 'player', text: 'Then blue steel answers me first.' },
      { speaker: 'npc', text: 'When he falls, gather three candle-key fragments. Key-Saint Ardan waits at the sealed gate.' },
    ],
  },
  'story-24-candle-key': {
    id: 'story-24-candle-key',
    kicker: 'Chapter V - Candle Synod',
    npcName: 'Brother Kaito',
    npcTitle: 'Bell Tower Monk',
    npcModelNumber: 2,
    objective: {
      label: 'Key Order',
      title: 'Gather candle-key fragments',
      description: 'Collect three candle-key fragments from road chests, quarry tithes, and fallen enemies.',
    },
    lines: [
      { speaker: 'npc', text: 'Three candle key fragments can unseal the mirror court, if the synod trusts the hand that carries them.' },
      { speaker: 'player', text: 'Where do the fragments hide?' },
      { speaker: 'npc', text: 'In road chests, quarry tithes, and the pockets of cowards. Gather three. Ardan will feel the lock turning.' },
    ],
  },
  'story-25-paragon-muster': {
    id: 'story-25-paragon-muster',
    kicker: 'Chapter V - Key-Saint',
    npcName: 'Brother Kaito',
    npcTitle: 'Bell Tower Monk',
    npcModelNumber: 2,
    objective: {
      label: 'Capstone Order',
      title: 'Defeat Key-Saint Ardan',
      description: 'Defeat Key-Saint Ardan near Eclipse Hold before he locks the court against living banners.',
    },
    lines: [
      { speaker: 'npc', text: 'Ardan carries the last gate key, but every lock he opens takes a year from the living.' },
      { speaker: 'player', text: 'Then the saint falls before another year is stolen.' },
      { speaker: 'npc', text: 'Bring me the broken key. The synod will record that living hands still turn the lock.' },
    ],
  },
  'story-25-key-sealed': {
    id: 'story-25-key-sealed',
    kicker: 'Chapter V - Key Sealed',
    npcName: 'Brother Kaito',
    npcTitle: 'Bell Tower Monk',
    npcModelNumber: 2,
    objective: {
      label: 'Chapter Complete',
      title: 'Seal the Candle Key',
      description: 'Return to Brother Kaito after Key-Saint Ardan falls and claim the Candle Key chapter reward.',
    },
    lines: [
      { speaker: 'npc', text: 'The key is cracked, but the court is not closed. Lady Mirror-Veyra already wears reflections of your victories.' },
      { speaker: 'player', text: 'Then point me to the glass.' },
      { speaker: 'npc', text: 'Archivist Letho waits on the eclipse road. Tell him the synod still answers living commanders.' },
    ],
  },
  'story-26-deep-dungeon': {
    id: 'story-26-deep-dungeon',
    kicker: 'Chapter VI - Court Reflections',
    npcName: 'Archivist Letho',
    npcTitle: 'Mirror Court Scribe',
    npcModelNumber: 5,
    objective: {
      label: 'Court Order',
      title: 'Find Archivist Letho',
      description: 'Visit Archivist Letho after the Candle Key seal and open the Lady in Glass chapter.',
    },
    lines: [
      { speaker: 'npc', text: 'The key turned. Good. Now the court fields armies built from reflections of old victories.' },
      { speaker: 'player', text: 'Then show me which of my victories they stole.' },
      { speaker: 'npc', text: 'Stand with me first. Scarlet Matron Yvane hunts banners that refuse to kneel.' },
    ],
  },
  'story-27-mirror-envoy': {
    id: 'story-27-mirror-envoy',
    kicker: 'Chapter VI - Glass Reliquary',
    npcName: 'Archivist Letho',
    npcTitle: 'Mirror Court Scribe',
    npcModelNumber: 5,
    objective: {
      label: 'Envoy Order',
      title: 'Face the court writ',
      description: 'Visit Archivist Letho again and refuse the Mirror Court writ before the Scarlet Matron arrives.',
    },
    lines: [
      { speaker: 'npc', text: 'I carry the court writ in a reliquary of glass. Every reflection inside it is a confession someone refused aloud.' },
      { speaker: 'player', text: 'You wanted me on the eclipse road.' },
      { speaker: 'npc', text: 'I want you alive when Lady Mirror-Veyra asks who broke her procession. First break Scarlet Matron Yvane in Shadowgrove.' },
    ],
  },
  'story-28-eclipse-field': {
    id: 'story-28-eclipse-field',
    kicker: 'Chapter VI - Scarlet Matron',
    npcName: 'Archivist Letho',
    npcTitle: 'Mirror Court Scribe',
    npcModelNumber: 5,
    objective: {
      label: 'Elite Order',
      title: 'Defeat Scarlet Matron Yvane',
      description: 'Defeat Scarlet Matron Yvane near Shadowgrove before her red thread knots your commander.',
    },
    lines: [
      { speaker: 'npc', text: 'Yvane writes curses in red thread and knots them around the hearts of proud captains.' },
      { speaker: 'player', text: 'Then the thread snaps on my terms.' },
      { speaker: 'npc', text: 'After her, Lady Mirror-Veyra will show herself. Inspect the host before you shatter the glass.' },
    ],
  },
  'story-29-high-war': {
    id: 'story-29-high-war',
    kicker: 'Chapter VI - High War',
    npcName: 'Archivist Letho',
    npcTitle: 'Mirror Court Scribe',
    npcModelNumber: 5,
    objective: {
      label: 'Threat Order',
      title: 'Inspect Lady Mirror-Veyra',
      description: 'Inspect the named Lady Mirror-Veyra threat and study which reflected victories she intends to field.',
    },
    lines: [
      { speaker: 'npc', text: 'She breaks armies with reflections, then sends the surviving image home wearing the commander face.' },
      { speaker: 'player', text: 'Then I will read the host before I strike.' },
      { speaker: 'npc', text: 'See which of your old banners she stole. Shatter her before the mirror learns your name by heart.' },
    ],
  },
  'story-30-lady-in-glass': {
    id: 'story-30-lady-in-glass',
    kicker: 'Chapter VI - Finale',
    npcName: 'Archivist Letho',
    npcTitle: 'Mirror Court Scribe',
    npcModelNumber: 5,
    objective: {
      label: 'Capstone Order',
      title: 'Defeat Lady Mirror-Veyra',
      description: 'Defeat Lady Mirror-Veyra near Eclipse Hold and shatter the last king-mage reflection.',
    },
    lines: [
      { speaker: 'npc', text: 'Lady Mirror-Veyra keeps the last king-mage reflection. Shatter the court, or kneel to your own image forever.' },
      { speaker: 'player', text: 'I did not march east to admire myself.' },
      { speaker: 'npc', text: 'Break the glass. Bring me a shard so living law can record that the Mirror Court act is closed.' },
    ],
  },
  'story-30-court-sealed': {
    id: 'story-30-court-sealed',
    kicker: 'Chapter VI - Court Closed',
    npcName: 'Archivist Letho',
    npcTitle: 'Mirror Court Scribe',
    npcModelNumber: 5,
    objective: {
      label: 'Act Complete',
      title: 'Record the shattered court',
      description: 'Return to Archivist Letho after Lady Mirror-Veyra falls and claim the Mirror Court finale reward.',
    },
    lines: [
      { speaker: 'npc', text: 'The shard is quiet. That is rarer than victory.' },
      { speaker: 'player', text: 'Record it. My banner does not kneel to glass.' },
      { speaker: 'npc', text: 'So recorded. The endgame board opens for commanders who still refuse reflections. Walk carefully—mirrors remember longer than roads.' },
    ],
  },
  'story-side-ash-scout': {
    id: 'story-side-ash-scout',
    kicker: 'Side Road - Ash Pilgrim',
    npcName: 'Ash Hermit Yara',
    npcTitle: 'Keeper of Oath Fire',
    npcModelNumber: 6,
    objective: {
      label: 'Side Order',
      title: 'Inspect the Ash Road Revenant',
      description: 'Find the named Ash Road Revenant near Witherfield Farm and study its pilgrim lantern before you quiet it.',
    },
    lines: [
      { speaker: 'npc', text: 'Something walks the ash road counting pilgrims who never reached the hold. Its lantern eats vows, not oil.' },
      { speaker: 'player', text: 'I will read the host before I break the lantern.' },
      { speaker: 'npc', text: 'Inspect the Revenant. If Ashford\'s hospice starts answering ash instead of living wounded, the west road dies.' },
    ],
  },
  'story-side-ash-clear': {
    id: 'story-side-ash-clear',
    kicker: 'Side Road - Ash Lantern',
    npcName: 'Ash Hermit Yara',
    npcTitle: 'Keeper of Oath Fire',
    npcModelNumber: 6,
    objective: {
      label: 'Side Order',
      title: 'Defeat the Ash Road Revenant',
      description: 'Defeat the Ash Road Revenant near Witherfield and recover an ash pilgrim cinder for Yara\'s oath fire.',
    },
    lines: [
      { speaker: 'npc', text: 'You have seen how the cinders lean toward false roads. Break the Revenant and take one warm ember.' },
      { speaker: 'player', text: 'I will bring the cinder to your fire.' },
      { speaker: 'npc', text: 'Protect your commander. Ash climbs armor the way regret climbs prayer.' },
    ],
  },
  'story-side-ash-return': {
    id: 'story-side-ash-return',
    kicker: 'Side Road - Cinder Delivered',
    npcName: 'Ash Hermit Yara',
    npcTitle: 'Keeper of Oath Fire',
    npcModelNumber: 6,
    objective: {
      label: 'Side Complete',
      title: 'Return the ash pilgrim cinder',
      description: 'Visit Ash Hermit Yara with the ash pilgrim cinder so false road omens can be quieted.',
    },
    lines: [
      { speaker: 'npc', text: 'The cinder still wants a pilgrim. Good. That means the omen was real, not mirrored.' },
      { speaker: 'player', text: 'Feed it to the oath fire. Keep Ashford\'s road honest.' },
      { speaker: 'npc', text: 'I will. When glass calls louder, you will still have ash under your boots that remembers living vows.' },
    ],
  },
  'story-side-writ-cutters': {
    id: 'story-side-writ-cutters',
    kicker: 'Side Road - Forged Writs',
    npcName: 'Gate Warden Sable',
    npcTitle: 'Blackwater Quartermaster',
    npcModelNumber: 1,
    objective: {
      label: 'Side Order',
      title: 'Break forged-writ couriers',
      description: 'Defeat two level 16-19 warbands between Blackwater Gate and East Road Camp to thin the glass writ couriers.',
    },
    lines: [
      { speaker: 'npc', text: 'Living writs still hold this gate, but glass couriers are buying the rumor line with counterfeit seals.' },
      { speaker: 'player', text: 'I will break their escorts first.' },
      { speaker: 'npc', text: 'Bleed the road crews. The Forger only shows herself when the plates stop arriving.' },
    ],
  },
  'story-side-writ-clear': {
    id: 'story-side-writ-clear',
    kicker: 'Side Road - Glass Forger',
    npcName: 'Gate Warden Sable',
    npcTitle: 'Blackwater Quartermaster',
    npcModelNumber: 1,
    objective: {
      label: 'Side Order',
      title: 'Defeat the Glass Writ Forger',
      description: 'Defeat the named Glass Writ Forger near East Road Camp and seize a forged mirror writ.',
    },
    lines: [
      { speaker: 'npc', text: 'The Forger stamps Blackwater law onto glass until the gate answers reflections. Take one plate before it cools.' },
      { speaker: 'player', text: 'Then the Forger dies with her seal still hot.' },
      { speaker: 'npc', text: 'Bring me the forged writ. I will burn it where living ledgers can smell the smoke.' },
    ],
  },
  'story-side-writ-return': {
    id: 'story-side-writ-return',
    kicker: 'Side Road - Seal Burned',
    npcName: 'Gate Warden Sable',
    npcTitle: 'Blackwater Quartermaster',
    npcModelNumber: 1,
    objective: {
      label: 'Side Complete',
      title: 'Return the forged mirror writ',
      description: 'Visit Gate Warden Sable with the forged mirror writ so Blackwater can purge the counterfeit seal.',
    },
    lines: [
      { speaker: 'npc', text: 'Glass signature. Almost perfect. Almost is enough to hang a gate.' },
      { speaker: 'player', text: 'Burn it. My banner does not answer mirrored law.' },
      { speaker: 'npc', text: 'Done. Keep your writs living. Prior Voss already teaches the road to prefer pretty lies.' },
    ],
  },
  'story-side-synod-scout': {
    id: 'story-side-synod-scout',
    kicker: 'Side Road - Synod Bell',
    npcName: 'Brother Kaito',
    npcTitle: 'Bell Tower Monk',
    npcModelNumber: 2,
    objective: {
      label: 'Side Order',
      title: 'Inspect the Synod Bell Reclaimer',
      description: 'Find the named Synod Bell Reclaimer near Eclipse Hold and study how cracked bells call candle-key fragments.',
    },
    lines: [
      { speaker: 'npc', text: 'Someone rings cracked synod bells on the hold road. Fragments answer like frightened birds.' },
      { speaker: 'player', text: 'I will read the Reclaimer before I mute the bell.' },
      { speaker: 'npc', text: 'Inspect the host. If the court finishes the call first, living keys go dark.' },
    ],
  },
  'story-side-synod-clear': {
    id: 'story-side-synod-clear',
    kicker: 'Side Road - Mute the Bell',
    npcName: 'Brother Kaito',
    npcTitle: 'Bell Tower Monk',
    npcModelNumber: 2,
    objective: {
      label: 'Side Order',
      title: 'Defeat the Synod Bell Reclaimer',
      description: 'Defeat the Synod Bell Reclaimer near Eclipse Hold and recover the cracked synod bell.',
    },
    lines: [
      { speaker: 'npc', text: 'You have heard how the crack pulls fragments. Break the Reclaimer and bring the bell home quiet.' },
      { speaker: 'player', text: 'I will take the cracked bell to the monks.' },
      { speaker: 'npc', text: 'Guard your commander. False rings climb under armor faster than honest prayer.' },
    ],
  },
  'story-side-synod-return': {
    id: 'story-side-synod-return',
    kicker: 'Side Road - Bell Quieted',
    npcName: 'Brother Kaito',
    npcTitle: 'Bell Tower Monk',
    npcModelNumber: 2,
    objective: {
      label: 'Side Complete',
      title: 'Return the cracked synod bell',
      description: 'Visit Brother Kaito with the cracked synod bell so Bridge Bell Monks can mute false key-calls.',
    },
    lines: [
      { speaker: 'npc', text: 'The crack still wants a fragment. That is how you know the race is real.' },
      { speaker: 'player', text: 'Mute it. Living hands keep the key.' },
      { speaker: 'npc', text: 'We will. When Ardan locks the court, your fragments will still answer the right bell.' },
    ],
  },
};

export function getStoryDialogSequence(dialogId: string | undefined): StoryDialogSequence | undefined {
  if (!dialogId) return undefined;
  return STORY_DIALOG_SEQUENCES[dialogId];
}
