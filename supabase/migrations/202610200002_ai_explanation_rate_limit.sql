create table if not exists public.ai_explanation_rate_limits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0)
);

alter table public.ai_explanation_rate_limits enable row level security;
revoke all on public.ai_explanation_rate_limits from anon, authenticated;
grant all on public.ai_explanation_rate_limits to service_role;

create or replace function public.consume_ai_explanation_rate_limit(
  p_user_id uuid,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_allowed boolean;
begin
  if p_user_id is null or p_limit < 1 or p_limit > 100 or p_window_seconds < 1 or p_window_seconds > 3600 then
    return false;
  end if;

  insert into public.ai_explanation_rate_limits as rate_limit (user_id, window_started_at, request_count)
  values (p_user_id, statement_timestamp(), 1)
  on conflict (user_id) do update
  set
    window_started_at = case
      when rate_limit.window_started_at <= statement_timestamp() - make_interval(secs => p_window_seconds)
        then statement_timestamp()
      else rate_limit.window_started_at
    end,
    request_count = case
      when rate_limit.window_started_at <= statement_timestamp() - make_interval(secs => p_window_seconds)
        then 1
      else rate_limit.request_count + 1
    end
  returning request_count <= p_limit into v_allowed;

  return v_allowed;
end;
$$;

revoke all on function public.consume_ai_explanation_rate_limit(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_explanation_rate_limit(uuid, integer, integer) to service_role;
