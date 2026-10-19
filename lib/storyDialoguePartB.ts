import type { StoryDialogSequence } from './storyDialogueTypes';

export const storyDialoguePartB: Record<string, StoryDialogSequence> = {
  'story-11-eastward-march': {
    id: 'story-11-eastward-march',
    kicker: 'Movement III - Eastward March',
    npcName: 'Ash Hermit Yara',
    npcTitle: 'Keeper of Oath Fire',
    npcModelNumber: 6,
    defaultChoiceId: 'eastward-oathbound',
    objective: {
      label: 'March Order',
      title: 'Find Ash Hermit Yara',
      description: 'Visit Ash Hermit Yara on the ash road and open the Broken Crown chapter.',
    },
    lines: [
      { speaker: 'npc', text: 'Moonwell\'s candles went dark, and the returned names are still raw material. The Iron Choir\'s doctrine is simple: a freed name without a living banner\'s protection can be sung into steel faster than Star Law can rebind it. I smelled funeral empire on the wind the night Cindervein fell—that is why oath fire opens the east. I want commanders who skip a command and learn king-magic without becoming Grave-Aurel; my sin is that oath fire once fed on vows as hungry as theirs.' },
      {
        speaker: 'player',
        text: 'Then teach me what the east demands.',
        choicePrompt: 'How do you answer iron hymns?',
        choices: [
          {
            id: 'eastward-oathbound',
            tone: 'oathbound',
            label: 'Guard the freed names',
            text: 'Then the freed names stay under living law. Teach me restraint before the choir sings them into steel.',
          },
          {
            id: 'eastward-pragmatic',
            tone: 'pragmatic',
            label: 'Measure the hymn',
            text: 'Then show me how far the hymn has learned western formations before we announce a march.',
          },
          {
            id: 'eastward-defiant',
            tone: 'defiant',
            label: 'Refuse funeral empire',
            text: 'Then I will not let iron succession draft my people. Point me at the choir before it finishes learning my name.',
          }
        ],
      },
      { speaker: 'npc', text: 'Skip a command. Let the mana stack—the old royal habit of withholding decree until the road kneels. Walk to Blackwater Gate before the iron choir finishes learning your formation from Moonwell smoke. That is the field order.' },
    ],
  },
  'story-12-choir-of-iron': {
    id: 'story-12-choir-of-iron',
    kicker: 'Movement III - Blackwater Gate',
    npcName: 'Ash Hermit Yara',
    npcTitle: 'Keeper of Oath Fire',
    npcModelNumber: 6,
    objective: {
      label: 'March Order',
      title: 'Reach Blackwater Gate',
      description: 'Travel to Blackwater Gate and hear how the iron choir forges armor from sung names.',
    },
    lines: [
      { speaker: 'npc', text: 'Blackwater Gate still answers living commanders—only while the choir\'s hymn has not finished learning western formations from Moonwell smoke. Walk the walls before steel learns you by heart. I open this gate not as mercy alone, but as pedagogy: east of here, king-magic answers faster than forgiveness.' },
      { speaker: 'player', text: 'I will walk the gate before it learns me by heart.' },
      { speaker: 'npc', text: 'After the walls, find Veil Captain Serat. She has named the marshal who conducts the choir—the midpoint Grave-Aurel will not waste full waking without. Tomorrow, if you linger, the gate\'s writs may start answering sung names instead of living blood.' },
    ],
  },
  'story-13-paragon-vow': {
    id: 'story-13-paragon-vow',
    kicker: 'Movement III - Paragon Vow',
    npcName: 'Veil Captain Serat',
    npcTitle: 'Eclipse March Scout',
    npcModelNumber: 3,
    defaultChoiceId: 'paragon-pragmatic',
    objective: {
      label: 'Scout Order',
      title: 'Find Veil Captain Serat',
      description: 'Visit Veil Captain Serat and learn the Iron Choir Marshal midpoint threat.',
    },
    lines: [
      { speaker: 'npc', text: 'Moonwell smoke still rides the west wind. Good. The choir hates banners that arrive smelling of victory—and freed ink. I want the Iron Choir Marshal silenced and the Mirror Court exposed before it wears western wins as glass. My sin: veil scouting means I have already traded with mirrored rumor lines to map them. The Marshal is midpoint conductor; Grave-Aurel does not waste full waking on an untested banner.' },
      {
        speaker: 'player',
        text: 'Who stands between me and Grave-Aurel?',
        choicePrompt: 'How do you take the midpoint?',
        choices: [
          {
            id: 'paragon-oathbound',
            tone: 'oathbound',
            label: 'Protect the living muster',
            text: 'Then silence the Marshal so no living formation is sung into funeral armor.',
          },
          {
            id: 'paragon-pragmatic',
            tone: 'pragmatic',
            label: 'Cut the conductor first',
            text: 'Then the Marshal falls first. An emperor who wakes alone is a measurable threat.',
          },
          {
            id: 'paragon-defiant',
            tone: 'defiant',
            label: 'Challenge the hymn',
            text: 'Then I break the hymn on the field and refuse to become another verse.',
          }
        ],
      },
      { speaker: 'npc', text: 'Find the Iron Choir Marshal near East Road Camp. Silence his hymn, then the emperor\'s funeral armor will stand alone—and the field will stop practicing your orders as scripture.' },
    ],
  },
  'story-14-eclipse-field': {
    id: 'story-14-eclipse-field',
    kicker: 'Movement III - Eclipse Field',
    npcName: 'Veil Captain Serat',
    npcTitle: 'Eclipse March Scout',
    npcModelNumber: 3,
    objective: {
      label: 'Elite Order',
      title: 'Defeat the Iron Choir Marshal',
      description: 'Defeat the named Iron Choir Marshal near East Road Camp before the field learns your formations.',
    },
    lines: [
      { speaker: 'npc', text: 'When the Marshal sings, steel remembers. He forges formations into armor before battle—empire as hymn. Break him before your army becomes another verse, or Grave-Aurel wakes to a field that already knows your next order.' },
      { speaker: 'player', text: 'Then the hymn ends on my terms.' },
      { speaker: 'npc', text: 'Defeat the named Iron Choir Marshal near East Road Camp. Afterward the southeast will show Emperor Grave-Aurel standing alone. Do not let a broken crown be your last reflection—the Mirror Court is already polishing tomorrow\'s glass.' },
    ],
  },
  'story-15-broken-crown': {
    id: 'story-15-broken-crown',
    kicker: 'Movement III - The Broken Crown',
    npcName: 'Veil Captain Serat',
    npcTitle: 'Eclipse March Scout',
    npcModelNumber: 3,
    defaultChoiceId: 'crown-oathbound',
    objective: {
      label: 'Capstone Order',
      title: 'Defeat Emperor Grave-Aurel',
      description: 'Reach the named southeast threat and defeat Emperor Grave-Aurel to close the Broken Crown chapter.',
    },
    lines: [
      { speaker: 'npc', text: 'The Marshal\'s hymn is dead. Emperor Grave-Aurel keeps a broken crown for anyone who still thinks commanders rule alone—king-magic without living consent, funeral succession wearing a templar face. Take the crown lesson, not a throne: commanders who rule alone become funeral armor. I aim you like a spear because the court will wear this victory as glass if you kneel to appetite.' },
      {
        speaker: 'player',
        text: 'Then I will take the crown and the lesson with it.',
        choicePrompt: 'What do you claim from the broken crown?',
        choices: [
          {
            id: 'crown-oathbound',
            tone: 'oathbound',
            label: 'Take the lesson',
            text: 'I take the lesson, not the throne. Living consent—not funeral empire—commands this banner.',
          },
          {
            id: 'crown-pragmatic',
            tone: 'pragmatic',
            label: 'End the waking',
            text: 'I end the waking before the hymn finishes elsewhere. Measure the emperor; refuse the succession.',
          },
          {
            id: 'crown-defiant',
            tone: 'defiant',
            label: 'Refuse the crown',
            text: 'I refuse any crown that outlives mercy. Break him before the Mirror Court drafts my reflection.',
          }
        ],
      },
      { speaker: 'npc', text: 'Reach the named southeast threat and defeat Emperor Grave-Aurel. Tomorrow the coast will talk differently: iron hymns quieter, ash roads listening—and mirror scouts already wearing your old colors. Do not let the broken crown be the last receipt the court archives.' },
    ],
  },
  'story-16-mirror-council': {
    id: 'story-16-mirror-council',
    kicker: 'Movement IV - Glass Road',
    npcName: 'Veil Captain Serat',
    npcTitle: 'Eclipse March Scout',
    npcModelNumber: 3,
    objective: {
      label: 'Council Order',
      title: 'Find Veil Captain Serat',
      description: 'Visit Serat on the eclipse road and open the Glass Road chapter against the Mirror Court.',
    },
    lines: [
      { speaker: 'npc', text: 'You took the crown lesson. Defeating Grave-Aurel did not end empire—it taught the Mirror Court which victory to polish. Mirror envoys now wear your old banner colors. Glass copies living triumphs; it does not invent them from nothing.' },
      { speaker: 'player', text: 'Who summons me?' },
      { speaker: 'npc', text: 'Survivors of a prettier record. Meet Gate Warden Sable at Blackwater. If you still command an army, prove it before the mirror finishes learning your formations from the Broken Crown smoke.' },
    ],
  },
  'story-17-moonwell-contract': {
    id: 'story-17-moonwell-contract',
    kicker: 'Movement IV - Gate Writs',
    npcName: 'Gate Warden Sable',
    npcTitle: 'Blackwater Quartermaster',
    npcModelNumber: 1,
    objective: {
      label: 'Writ Order',
      title: 'Find Gate Warden Sable',
      description: 'Visit Gate Warden Sable and learn which living writs the Mirror Court is buying.',
    },
    lines: [
      { speaker: 'npc', text: 'Writs outlive the hands that signed them. The court is buying every eastern road contract it can forge into glass. I want living writs retained—my want—and Blackwater has already sold borderline contracts; my purity is a repair job, not a virgin ledger—my sin.' },
      { speaker: 'player', text: 'Then show me which ledgers still answer living commanders.' },
      { speaker: 'npc', text: 'Walk Blackwater Gate first. After the walls, we hunt the Mirror Road Captain rewriting the quarry approaches. Burn what forgeries you can smell.' },
    ],
  },
  'story-18-blackwater-gate': {
    id: 'story-18-blackwater-gate',
    kicker: 'Movement IV - Blackwater',
    npcName: 'Gate Warden Sable',
    npcTitle: 'Blackwater Quartermaster',
    npcModelNumber: 1,
    objective: {
      label: 'March Order',
      title: 'Reach Blackwater Gate',
      description: 'Travel to Blackwater Gate and confirm the walls still answer living commanders.',
    },
    lines: [
      { speaker: 'npc', text: 'Blackwater Gate trades in writs that outlive their signers. Walk them while the ink still remembers blood—before glass signatures hang the checkpoint on reflected law.' },
      { speaker: 'player', text: 'I will walk the walls first.' },
      { speaker: 'npc', text: 'When you return from the walls, the Mirror Road Captain will be waiting near Granite Heights. Break her before glass finishes your colors into doctrine.' },
    ],
  },
  'story-19-eclipse-scouts': {
    id: 'story-19-eclipse-scouts',
    kicker: 'Movement IV - Eclipse Scouts',
    npcName: 'Gate Warden Sable',
    npcTitle: 'Blackwater Quartermaster',
    npcModelNumber: 1,
    objective: {
      label: 'Elite Order',
      title: 'Defeat the Mirror Road Captain',
      description: 'Defeat the named Mirror Road Captain near Granite Heights Quarry before scouts learn your formations.',
    },
    lines: [
      { speaker: 'npc', text: 'She wears the banners of commanders who already lost once—including colors polished from your Broken Crown march. That is how the court teaches the next road: archive, polish, field again.' },
      { speaker: 'player', text: 'Then I break the captain and keep my colors.' },
      { speaker: 'npc', text: 'Defeat the named Mirror Road Captain near Granite Heights Quarry. After her, Prior Moon Voss opens the ossuaries with reflected water. End him at Eclipse Hold before sealed chambers answer glass instead of living keys.' },
    ],
  },
  'story-20-first-dungeon-oath': {
    id: 'story-20-first-dungeon-oath',
    kicker: 'Movement IV - Prior Moon',
    npcName: 'Gate Warden Sable',
    npcTitle: 'Blackwater Quartermaster',
    npcModelNumber: 1,
    objective: {
      label: 'Capstone Order',
      title: 'Defeat Prior Moon Voss',
      description: 'Defeat Prior Moon Voss near Eclipse Hold and stop the Glass Road from rewriting every sealed chamber.',
    },
    lines: [
      { speaker: 'npc', text: 'Voss reads omens from broken water. Every chamber he opens takes a year from the living road—perfect records costing living mistakes. He is the court\'s field priest, not a random eclipse ghost.' },
      { speaker: 'player', text: 'Then the prior dies before the next chamber answers.' },
      { speaker: 'npc', text: 'Defeat Prior Moon Voss near Eclipse Hold. Bring me his moon glass. Blackwater will record that living law still owns the Glass Road—and tomorrow the memorial will begin ranking what you sealed.' },
    ],
  },
  'story-20-glass-sealed': {
    id: 'story-20-glass-sealed',
    kicker: 'Movement IV - Road Sealed',
    npcName: 'Gate Warden Sable',
    npcTitle: 'Blackwater Quartermaster',
    npcModelNumber: 1,
    objective: {
      label: 'Chapter Complete',
      title: 'Seal the Glass Road',
      description: 'Return to Gate Warden Sable after Prior Moon Voss falls and claim the Glass Road chapter reward.',
    },
    lines: [
      { speaker: 'npc', text: 'The glass is cracked—the broken moon glass receipt of Movement IV. Good. The court hates evidence that does not reflect their preferred ending. Sealing the Glass Road creates the Glass Road Memorial archive and starts the candle-key race.' },
      { speaker: 'player', text: 'Record it under living law.' },
      { speaker: 'npc', text: 'So recorded. Tomorrow gate boards will speak of memorial ranks, not only forgeries. Brother Kaito already whispers about candle keys. Reach twenty-one when you are ready for that race—rival powers will hunt the same fragments.' },
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
      { speaker: 'npc', text: 'Something walks the ash road counting pilgrims who never reached the hold. Its lantern eats vows, not oil—false ash omens trying to recruit the same pilgrim vows the Iron Choir would rather sing into steel.' },
      { speaker: 'player', text: 'I will read the host before I break the lantern.' },
      { speaker: 'npc', text: 'Inspect the Revenant near Witherfield. If Ashford\'s hospice starts answering ash instead of living wounded, the west road dies—and the choir gains another verse.' },
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
      { speaker: 'npc', text: 'The cinder still wants a pilgrim. Good. That means the omen was real, not mirrored—and not yet sung. The choir would rather forge these vows; we quiet them under oath fire instead.' },
      { speaker: 'player', text: 'Feed it to the oath fire. Keep Ashford\'s road honest.' },
      { speaker: 'npc', text: 'I will. When glass calls louder, you will still have ash under your boots that remembers living vows—not funeral hymns.' },
    ],
  },
  'story-side-choir-scout': {
    id: 'story-side-choir-scout',
    kicker: 'Side Road - Choir Practice',
    npcName: 'Ash Hermit Yara',
    npcTitle: 'Keeper of Oath Fire',
    npcModelNumber: 6,
    defaultChoiceId: 'cantor-oathbound',
    objective: {
      label: 'Side Order',
      title: 'Inspect the Iron Choir Cantor',
      description: 'Find the named Iron Choir Cantor near East Road Camp and study the practice verses before you strike.',
    },
    lines: [
      { speaker: 'npc', text: 'East of Blackwater, king-magic answers faster than mercy. An iron choir cantor is practicing verses on freed names—raw ink from Moonwell riding the hymn. I want the practice quieted before the field learns your formation; my sin is that oath fire once enjoyed songs like this.' },
      {
        speaker: 'player',
        text: 'Name the host. I will read the verse before I break it.',
        choicePrompt: 'How do you answer choir practice?',
        choices: [
          {
            id: 'cantor-oathbound',
            tone: 'oathbound',
            label: 'Guard the freed names',
            text: 'Then the practice ends before one more name is etched into iron.',
          },
          {
            id: 'cantor-pragmatic',
            tone: 'pragmatic',
            label: 'Measure the verse',
            text: 'I will hear how far the verse has learned our march, then cut it.',
          },
          {
            id: 'cantor-defiant',
            tone: 'defiant',
            label: 'Refuse the hymn',
            text: 'No emperor sings my banner. Point me to the cantor.',
          }
        ],
      },
      { speaker: 'npc', text: 'Inspect the Iron Choir Cantor near East Road Camp. If the practice finishes, steel will hum your orders before you speak them.' },
    ],
  },
  'story-side-choir-clear': {
    id: 'story-side-choir-clear',
    kicker: 'Side Road - Practice Broken',
    npcName: 'Ash Hermit Yara',
    npcTitle: 'Keeper of Oath Fire',
    npcModelNumber: 6,
    objective: {
      label: 'Side Order',
      title: 'Defeat the Iron Choir Cantor',
      description: 'Defeat the Iron Choir Cantor near East Road Camp and recover an iron hymn plate etched with practice verses.',
    },
    lines: [
      { speaker: 'npc', text: 'Practice makes kings who never ask. Break the cantor before the verse finishes your name into armor.' },
      { speaker: 'player', text: 'I will end the verse and carry what it etched.' },
      { speaker: 'npc', text: 'Take one hymn-etched plate if you can. It will still want to sing after the voice is gone.' },
    ],
  },
  'story-side-choir-return': {
    id: 'story-side-choir-return',
    kicker: 'Side Road - Plate to Oath Fire',
    npcName: 'Ash Hermit Yara',
    npcTitle: 'Keeper of Oath Fire',
    npcModelNumber: 6,
    objective: {
      label: 'Side Complete',
      title: 'Return the iron hymn plate',
      description: 'Visit Ash Hermit Yara with the hymn-etched plate so oath fire can quiet the remaining verse.',
    },
    lines: [
      { speaker: 'npc', text: 'The plate still hums. Good. That means the verse was real, not mirrored—and not yet a crown.' },
      { speaker: 'player', text: 'Feed it to the oath fire. Let the lesson stay a lesson.' },
      { speaker: 'npc', text: 'I will. When Serat points at the Marshal, remember: commanders who rule alone become funeral armor. Quiet practice, then refuse the throne.' },
    ],
  },
};
