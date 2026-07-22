-- Shared chat is intentionally short-lived. Clients read the newest 50 messages,
-- and this trigger keeps each global or party channel bounded at the same limit.

create index if not exists chat_messages_channel_party_created_idx
  on public.chat_messages (channel, party_id, created_at desc);

create or replace function public.prune_chat_message_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.chat_messages as stale
  where stale.id in (
    select candidate.id
    from public.chat_messages as candidate
    where candidate.channel = new.channel
      and candidate.party_id is not distinct from new.party_id
    order by candidate.created_at desc, candidate.id desc
    offset 50
  );

  return new;
end;
$$;

drop trigger if exists prune_chat_message_history_after_insert on public.chat_messages;
create trigger prune_chat_message_history_after_insert
  after insert on public.chat_messages
  for each row execute function public.prune_chat_message_history();
