-- Dark Plains content registry: mark Road Thief and Dark Priest as enemy-only run units.
-- Paste into Supabase SQL Editor after 004_unit_content_templates.sql has been applied.

update public.content_entries
set
  payload = payload || jsonb_build_object(
    'availability',
    jsonb_build_object('playerRun', false, 'enemyRun', true, 'bossEscort', true)
  ),
  updated_at = now()
where id in ('minion-template:thief', 'minion-template:darkpriest');
