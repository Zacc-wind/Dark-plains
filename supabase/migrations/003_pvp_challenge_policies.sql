-- PVP challenge access for authenticated participants.

alter table public.pvp_challenges
  add column if not exists ready_at timestamptz;

drop policy if exists "challenge participants can read challenges"
  on public.pvp_challenges;

create policy "challenge participants can read challenges"
  on public.pvp_challenges for select
  using (auth.uid() = challenger_id or auth.uid() = target_id);

drop policy if exists "players can create own challenges"
  on public.pvp_challenges;

create policy "players can create own challenges"
  on public.pvp_challenges for insert
  with check (auth.uid() = challenger_id and challenger_id <> target_id);

drop policy if exists "challenge participants can update challenges"
  on public.pvp_challenges;

create policy "challenge participants can update challenges"
  on public.pvp_challenges for update
  using (auth.uid() = challenger_id or auth.uid() = target_id)
  with check (auth.uid() = challenger_id or auth.uid() = target_id);

create index if not exists pvp_challenges_participants_status_idx
  on public.pvp_challenges (challenger_id, target_id, status, created_at desc);
