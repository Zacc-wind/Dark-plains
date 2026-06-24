-- World map presence: let signed-in players see each other on the shared map.

create or replace view public.world_map_players as
select
  p.id as user_id,
  p.username,
  p.selected_model,
  ps.x,
  ps.y,
  ps.level,
  ps.stats,
  ps.updated_at
from public.player_states ps
join public.profiles p on p.id = ps.user_id;

grant select on public.world_map_players to authenticated;
