-- Harden views and SECURITY DEFINER execute grants.
-- Views default to SECURITY DEFINER behavior in Postgres; force invoker so RLS of
-- the querying role applies. Trigger helpers stay callable by the table owner only.

create or replace view public.leaderboard_power
with (security_invoker = true) as
select
  p.username,
  ps.level,
  ps.gold,
  ps.stats,
  ps.minions,
  p.selected_model,
  ps.updated_at
from public.player_states ps
join public.profiles p on p.id = ps.user_id;

create or replace view public.leaderboard_daily
with (security_invoker = true) as
select
  p.username,
  count(*)::int as completions,
  max(d.wins)::int as best_wins,
  max(d.completed_at) as last_completed_at
from public.daily_run_records d
join public.profiles p on p.id = d.user_id
group by p.username;

create or replace view public.world_map_players
with (security_invoker = true) as
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

grant select on public.leaderboard_power to anon, authenticated;
grant select on public.leaderboard_daily to anon, authenticated;
grant select on public.world_map_players to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.prune_chat_message_history() from public, anon, authenticated;
revoke all on function public.is_party_participant(uuid, uuid) from public, anon;
grant execute on function public.is_party_participant(uuid, uuid) to authenticated;
revoke all on function public.is_coop_raid_participant(text, uuid) from public, anon;
grant execute on function public.is_coop_raid_participant(text, uuid) to authenticated;
