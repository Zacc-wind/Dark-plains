-- Dark Plains content registry: standalone tier I/II/III units and combat mechanics.
-- Paste into Supabase SQL Editor after the initial schema.
-- The app currently ships gameplay templates in code, while this keeps online content metadata aligned.

insert into public.content_entries (id, category, version, enabled, payload, updated_at)
values
  (
    'minion-template:witchdoc',
    'minion-template',
    1,
    true,
    jsonb_build_object(
      'templateId', 'witchdoc',
      'class', 'wizard',
      'tier', 'tier1',
      'name', 'Witch Doctor',
      'role', 'Standalone poison caster',
      'assetName', 'witchdoc.png',
      'stats', jsonb_build_object('attack', 1, 'defense', 2, 'magic', 5, 'healing', 0, 'health', 20, 'movement', 3, 'range', 4),
      'mechanics', jsonb_build_array('poison-shot')
    ),
    now()
  ),
  (
    'minion-template:crossbow',
    'minion-template',
    1,
    true,
    jsonb_build_object(
      'templateId', 'crossbow',
      'class', 'knight',
      'tier', 'tier1',
      'name', 'Crossbowman',
      'role', 'Standalone ranged guard',
      'assetName', 'crossbow.png',
      'stats', jsonb_build_object('attack', 4, 'defense', 3, 'magic', 0, 'healing', 0, 'health', 26, 'movement', 2, 'range', 4),
      'mechanics', jsonb_build_array('physical-ranged')
    ),
    now()
  ),
  (
    'minion-template:thief',
    'minion-template',
    1,
    true,
    jsonb_build_object(
      'templateId', 'thief',
      'class', 'knight',
      'tier', 'tier1',
      'name', 'Road Thief',
      'role', 'Standalone skirmisher',
      'assetName', 'thief.png',
      'stats', jsonb_build_object('attack', 6, 'defense', 2, 'magic', 0, 'healing', 0, 'health', 22, 'movement', 4, 'range', 1),
      'mechanics', jsonb_build_array('bleed-strike', 'skirmish-step')
    ),
    now()
  ),
  (
    'minion-template:darkpriest',
    'minion-template',
    1,
    true,
    jsonb_build_object(
      'templateId', 'darkpriest',
      'class', 'priest',
      'tier', 'tier1',
      'name', 'Dark Priest',
      'role', 'Standalone shadow healer',
      'assetName', 'darkpriest.png',
      'stats', jsonb_build_object('attack', 3, 'defense', 2, 'magic', 4, 'healing', 6, 'health', 22, 'movement', 3, 'range', 3),
      'mechanics', jsonb_build_array('priest-heal')
    ),
    now()
  ),
  (
    'minion-template:enchanter',
    'minion-template',
    1,
    true,
    jsonb_build_object(
      'templateId', 'enchanter',
      'class', 'wizard',
      'tier', 'tier2',
      'name', 'Void Enchanter',
      'role', 'Standalone ward support',
      'assetName', 'enchanter.png',
      'stats', jsonb_build_object('attack', 3, 'defense', 4, 'magic', 9, 'healing', 0, 'health', 28, 'movement', 3, 'range', 3),
      'mechanics', jsonb_build_array('void-ward')
    ),
    now()
  ),
  (
    'minion-template:firelord',
    'minion-template',
    1,
    true,
    jsonb_build_object(
      'templateId', 'firelord',
      'class', 'knight',
      'tier', 'tier2',
      'name', 'Firelord',
      'role', 'Standalone melee assassin',
      'assetName', 'firelord.png',
      'stats', jsonb_build_object('attack', 11, 'defense', 4, 'magic', 4, 'healing', 0, 'health', 34, 'movement', 3, 'range', 1),
      'mechanics', jsonb_build_array()
    ),
    now()
  ),
  (
    'minion-template:archer',
    'minion-template',
    1,
    true,
    jsonb_build_object(
      'templateId', 'archer',
      'class', 'knight',
      'tier', 'tier2',
      'name', 'Road Archer',
      'role', 'Standalone ranged striker',
      'assetName', 'archer.png',
      'stats', jsonb_build_object('attack', 8, 'defense', 4, 'magic', 0, 'healing', 0, 'health', 32, 'movement', 3, 'range', 4),
      'mechanics', jsonb_build_array()
    ),
    now()
  ),
  (
    'minion-template:bell',
    'minion-template',
    1,
    true,
    jsonb_build_object(
      'templateId', 'bell',
      'class', 'templar',
      'tier', 'tier2',
      'name', 'Bell Warden',
      'role', 'Standalone tank support',
      'assetName', 'bell.png',
      'stats', jsonb_build_object('attack', 5, 'defense', 13, 'magic', 3, 'healing', 0, 'health', 62, 'movement', 2, 'range', 1),
      'mechanics', jsonb_build_array('bell-march')
    ),
    now()
  ),
  (
    'minion-template:plaugedoc',
    'minion-template',
    1,
    true,
    jsonb_build_object(
      'templateId', 'plaugedoc',
      'class', 'wizard',
      'tier', 'tier3',
      'name', 'Plague Doctor',
      'role', 'Standalone poison marksman',
      'assetName', 'plaugedoc.png',
      'stats', jsonb_build_object('attack', 5, 'defense', 6, 'magic', 11, 'healing', 0, 'health', 44, 'movement', 3, 'range', 4),
      'mechanics', jsonb_build_array('poison-shot')
    ),
    now()
  ),
  (
    'minion-template:fallen',
    'minion-template',
    1,
    true,
    jsonb_build_object(
      'templateId', 'fallen',
      'class', 'knight',
      'tier', 'tier3',
      'name', 'Fallen Wing Knight',
      'role', 'Standalone mobile tank',
      'assetName', 'fallen.png',
      'stats', jsonb_build_object('attack', 10, 'defense', 13, 'magic', 2, 'healing', 0, 'health', 76, 'movement', 4, 'range', 1),
      'mechanics', jsonb_build_array('long-move-tank')
    ),
    now()
  ),
  (
    'minion-template:mercenary',
    'minion-template',
    1,
    true,
    jsonb_build_object(
      'templateId', 'mercenary',
      'class', 'knight',
      'tier', 'tier3',
      'name', 'Grave Mercenary',
      'role', 'Standalone retaliation tank',
      'assetName', 'mercenary.png',
      'stats', jsonb_build_object('attack', 9, 'defense', 16, 'magic', 0, 'healing', 0, 'health', 92, 'movement', 1, 'range', 1),
      'mechanics', jsonb_build_array('heavy-retaliation', 'shop-contract')
    ),
    now()
  ),
  (
    'minion-template:crow',
    'minion-template',
    1,
    true,
    jsonb_build_object(
      'templateId', 'crow',
      'class', 'knight',
      'tier', 'tier3',
      'name', 'Crowblade Assassin',
      'role', 'Standalone bleed skirmisher',
      'assetName', 'crow.png',
      'stats', jsonb_build_object('attack', 11, 'defense', 6, 'magic', 2, 'healing', 0, 'health', 48, 'movement', 4, 'range', 1),
      'mechanics', jsonb_build_array('bleed-strike', 'skirmish-step')
    ),
    now()
  ),
  (
    'combat-mechanic:bell-march',
    'combat-mechanic',
    1,
    true,
    jsonb_build_object('unitTemplateId', 'bell', 'trigger', 'wait-orb', 'effect', 'all living allies gain +1 movement and +1 speed until this Bell Warden acts again')
    ,
    now()
  ),
  (
    'combat-mechanic:void-ward',
    'combat-mechanic',
    1,
    true,
    jsonb_build_object('unitTemplateId', 'enchanter', 'trigger', 'wait-orb', 'effect', 'all living allies gain +3 defense until this Void Enchanter acts again'),
    now()
  ),
  (
    'combat-mechanic:bleed',
    'combat-mechanic',
    1,
    true,
    jsonb_build_object('unitTemplateIds', jsonb_build_array('crow', 'thief'), 'trigger', 'melee attack hit', 'stacking', true, 'durationTurns', 1, 'damage', '2 per stack plus +1 for each extra stack', 'visual', 'dark red status badge and particle gush'),
    now()
  ),
  (
    'combat-mechanic:poison',
    'combat-mechanic',
    1,
    true,
    jsonb_build_object('unitTemplateIds', jsonb_build_array('plaugedoc', 'witchdoc'), 'trigger', 'ranged attack hit', 'stacking', false, 'durationTurns', 2, 'damage', 'max(3, floor(attacker magic / 3) + 2)', 'visual', 'green status badge and particle gush'),
    now()
  ),
  (
    'combat-mechanic:skirmish-step',
    'combat-mechanic',
    1,
    true,
    jsonb_build_object('unitTemplateIds', jsonb_build_array('crow', 'thief'), 'trigger', 'adjacent melee attack hit', 'effect', 'avoids melee retaliation, then may move one adjacent empty cell away from target; no extra attack/heal/cast'),
    now()
  ),
  (
    'combat-mechanic:healing-cleanse',
    'combat-mechanic',
    1,
    true,
    jsonb_build_object('unitClasses', jsonb_build_array('priest'), 'trigger', 'valid heal target', 'effect', 'healing removes poison and bleeding, and can target wounded or status-afflicted allies'),
    now()
  ),
  (
    'combat-mechanic:heavy-retaliation',
    'combat-mechanic',
    1,
    true,
    jsonb_build_object('unitTemplateId', 'mercenary', 'trigger', 'valid melee retaliation', 'effect', 'retaliation damage uses 85% attack damage plus 3 flat damage'),
    now()
  )
on conflict (id) do update
set
  category = excluded.category,
  version = excluded.version,
  enabled = excluded.enabled,
  payload = excluded.payload,
  updated_at = now();
