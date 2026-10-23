create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  preferred_language text not null default 'en' check (preferred_language in ('en', 'sw')),
  exam_date date not null default current_date,
  hours_per_week integer not null default 5 check (hours_per_week between 1 and 20),
  onboarding_completed boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default true;

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  domain text not null check (domain in (
    'Cloud concepts',
    'Azure architecture and services',
    'Azure management and governance'
  )),
  topic text not null check (char_length(trim(topic)) between 1 and 120),
  difficulty smallint not null check (difficulty between 1 and 3),
  question_text text not null check (char_length(trim(question_text)) > 0),
  options jsonb not null check (
    case when jsonb_typeof(options) = 'array'
      then jsonb_array_length(options) = 4
      else false
    end
  ),
  correct_index smallint not null check (correct_index between 0 and 3),
  base_explanation text not null check (char_length(trim(base_explanation)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  selected_index smallint not null check (selected_index between 0 and 3),
  is_correct boolean not null,
  time_taken_sec integer not null default 0 check (time_taken_sec >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.ai_explanations (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  selected_index smallint not null check (selected_index between 0 and 3),
  language text not null check (language in ('en', 'sw')),
  content jsonb not null,
  created_at timestamptz not null default now(),
  unique (question_id, selected_index, language)
);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  front text not null check (char_length(trim(front)) > 0),
  back text not null check (char_length(trim(back)) > 0),
  box integer not null default 1 check (box between 1 and 5),
  next_review_at timestamptz not null default now(),
  times_wrong integer not null default 0 check (times_wrong >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, question_id)
);

create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists attempts_user_created_idx
  on public.attempts (user_id, created_at desc);
create index if not exists attempts_user_question_idx
  on public.attempts (user_id, question_id);
create index if not exists questions_domain_topic_idx
  on public.questions (domain, topic);
create index if not exists flashcards_user_due_idx
  on public.flashcards (user_id, next_review_at);
create index if not exists study_plans_user_created_idx
  on public.study_plans (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.attempts enable row level security;
alter table public.ai_explanations enable row level security;
alter table public.flashcards enable row level security;
alter table public.study_plans enable row level security;

revoke all on public.profiles, public.questions, public.attempts,
  public.ai_explanations, public.flashcards, public.study_plans
  from anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select on public.questions to authenticated;
grant select, insert, update, delete on public.attempts to authenticated;
grant select, insert, update, delete on public.flashcards to authenticated;
grant select, insert, update, delete on public.study_plans to authenticated;
grant all on public.profiles, public.questions, public.attempts,
  public.ai_explanations, public.flashcards, public.study_plans
  to service_role;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Authenticated users can read questions" on public.questions;
create policy "Authenticated users can read questions"
  on public.questions for select to authenticated
  using (true);

drop policy if exists "Users can read their own attempts" on public.attempts;
create policy "Users can read their own attempts"
  on public.attempts for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own attempts" on public.attempts;
create policy "Users can create their own attempts"
  on public.attempts for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own attempts" on public.attempts;
create policy "Users can update their own attempts"
  on public.attempts for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own attempts" on public.attempts;
create policy "Users can delete their own attempts"
  on public.attempts for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Authenticated users can read cached explanations" on public.ai_explanations;
create policy "Authenticated users can read cached explanations"
  on public.ai_explanations for select to authenticated
  using (true);

drop policy if exists "Users can read their own flashcards" on public.flashcards;
create policy "Users can read their own flashcards"
  on public.flashcards for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own flashcards" on public.flashcards;
create policy "Users can create their own flashcards"
  on public.flashcards for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own flashcards" on public.flashcards;
create policy "Users can update their own flashcards"
  on public.flashcards for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own flashcards" on public.flashcards;
create policy "Users can delete their own flashcards"
  on public.flashcards for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read their own study plans" on public.study_plans;
create policy "Users can read their own study plans"
  on public.study_plans for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own study plans" on public.study_plans;
create policy "Users can create their own study plans"
  on public.study_plans for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own study plans" on public.study_plans;
create policy "Users can update their own study plans"
  on public.study_plans for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own study plans" on public.study_plans;
create policy "Users can delete their own study plans"
  on public.study_plans for delete to authenticated
  using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
begin
  v_display_name := left(
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), ''),
      'Learner'
    ),
    80
  );

  insert into public.profiles (
    id,
    display_name,
    exam_date,
    hours_per_week,
    onboarding_completed
  )
  values (
    new.id,
    v_display_name,
    current_date,
    5,
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
