-- 022 — Push notifications (mobile app): new sale, new message.
--
-- device_tokens: one row per phone. Only reachable through the two RPCs below
--   (a token can move to another account when someone signs in on the same phone).
-- push_log: de-duplication — each event is pushed at most once.
-- Triggers call the send-push Edge Function asynchronously (pg_net) with ONLY
--   the event type and row id. The function re-reads the row with the service
--   role, so the endpoint can't be used to send arbitrary text to anyone.

create extension if not exists pg_net with schema extensions;

create table if not exists public.device_tokens (
  token       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  platform    text not null check (platform in ('ios', 'android')),
  updated_at  timestamptz not null default now()
);
create index if not exists device_tokens_user_idx on public.device_tokens(user_id);
alter table public.device_tokens enable row level security;
revoke all on public.device_tokens from anon, authenticated;

create table if not exists public.push_log (
  event_key   text primary key,
  created_at  timestamptz not null default now()
);
alter table public.push_log enable row level security;
revoke all on public.push_log from anon, authenticated;

create or replace function public.register_device_token(p_token text, p_platform text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_token is null or length(p_token) < 20 or length(p_token) > 4096 then raise exception 'invalid token'; end if;
  if p_platform not in ('ios', 'android') then raise exception 'invalid platform'; end if;
  insert into device_tokens(token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;

create or replace function public.unregister_device_token(p_token text)
returns void language sql security definer set search_path = public as $$
  delete from device_tokens where token = p_token and user_id = auth.uid();
$$;

revoke all on function public.register_device_token(text, text) from public, anon;
revoke all on function public.unregister_device_token(text) from public, anon;
grant execute on function public.register_device_token(text, text) to authenticated;
grant execute on function public.unregister_device_token(text) to authenticated;

-- Fire-and-forget call to the Edge Function (never blocks or fails the insert)
create or replace function public.queue_push(p_type text, p_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://wmnueemuldnhwzukckyi.supabase.co/functions/v1/send-push',
    body := jsonb_build_object('type', p_type, 'id', p_id),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );
exception when others then
  raise warning 'queue_push failed: %', sqlerrm;
end $$;
revoke all on function public.queue_push(text, uuid) from public, anon, authenticated;

create or replace function public.trg_push_sale()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and coalesce(new.is_free, false) = false
     and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    perform queue_push('sale', new.id);
  end if;
  return new;
end $$;

create or replace function public.trg_push_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform queue_push('message', new.id);
  return new;
end $$;
revoke all on function public.trg_push_sale() from public, anon, authenticated;
revoke all on function public.trg_push_message() from public, anon, authenticated;

drop trigger if exists push_sale on public.purchases;
create trigger push_sale after insert or update of status on public.purchases
  for each row execute function public.trg_push_sale();

drop trigger if exists push_message on public.messages;
create trigger push_message after insert on public.messages
  for each row execute function public.trg_push_message();
