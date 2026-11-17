-- Close Enough: database setup
-- Paste this whole file into Supabase > SQL Editor > New query, then Run.
-- Safe to run more than once.

-- One row per finished quiz (only when the person left the "add my answers" box checked)
create table if not exists public.responses (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  quiz_version  text        not null check (char_length(quiz_version) <= 20),
  duration_ms   integer     not null check (duration_ms between 1000 and 3600000),
  answers       jsonb       not null check (jsonb_typeof(answers) = 'object'),     -- { question_id: 0..6 or 0..4 }
  question_ms   jsonb                check (question_ms is null or jsonb_typeof(question_ms) = 'object'),
  personal      smallint    not null check (personal between 0 and 100),
  touchy        smallint    not null check (touchy between 0 and 100),
  quadrant      text        not null check (quadrant in ('vault','open','warm','hugger','middle')),
  receive       smallint             check (receive between 0 and 100),
  give          smallint             check (give between 0 and 100),
  device        text                 check (device in ('mobile','desktop')),
  ref           text                 check (ref ~ '^[a-z0-9_-]{1,30}$'),                  -- tag from the shared link (?ref=instagram)
  attempt       smallint             check (attempt between 1 and 100),                   -- 1 = first finish on that device
  -- keep junk out: the answer and timing blobs can't be huge
  constraint answers_size check (octet_length(answers::text) < 2000),
  constraint timing_size  check (question_ms is null or octet_length(question_ms::text) < 2000)
);

create index if not exists responses_created_at_idx on public.responses (created_at);

-- for projects set up before ref and attempt existed
alter table public.responses add column if not exists ref     text     check (ref ~ '^[a-z0-9_-]{1,30}$');
alter table public.responses add column if not exists attempt smallint check (attempt between 1 and 100);
-- the order the questions were shown in (the quiz sends this with every result)
alter table public.responses add column if not exists question_order jsonb check (question_order is null or jsonb_typeof(question_order) = 'array');

-- Light activity log: quiz starts, share window opens, image downloads
create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  type          text not null check (type in ('start','share_open','download')),
  quiz_version  text check (char_length(quiz_version) <= 20),
  device        text check (device in ('mobile','desktop')),
  card          text check (char_length(card) <= 30),
  ref           text check (ref ~ '^[a-z0-9_-]{1,30}$')
);

alter table public.events add column if not exists ref text check (ref ~ '^[a-z0-9_-]{1,30}$');

create index if not exists events_type_created_idx on public.events (type, created_at);

-- Row Level Security: the public (anon) role can add rows and read them, never change or delete them.
alter table public.responses enable row level security;
alter table public.events    enable row level security;

drop policy if exists "anyone can add a response" on public.responses;
drop policy if exists "anyone can read responses" on public.responses;
drop policy if exists "anyone can add an event"   on public.events;
drop policy if exists "anyone can read events"    on public.events;

create policy "anyone can add a response" on public.responses for insert to anon with check (true);
create policy "anyone can read responses" on public.responses for select to anon using (true);
create policy "anyone can add an event"   on public.events    for insert to anon with check (true);
create policy "anyone can read events"    on public.events    for select to anon using (true);

grant usage on schema public to anon;
grant select, insert on public.responses to anon;
grant select, insert on public.events    to anon;
revoke update, delete, truncate on public.responses from anon;
revoke update, delete, truncate on public.events    from anon;

-- ---------------------------------------------------------------------------------------
-- The long version (deep-v1). Its own table, so the quick quiz's numbers never mix with it.
-- ---------------------------------------------------------------------------------------
create table if not exists public.deep_responses (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  quiz_version    text        not null check (char_length(quiz_version) <= 20),
  duration_ms     integer     not null check (duration_ms between 1000 and 7200000),
  answers         jsonb       not null check (jsonb_typeof(answers) = 'object'),        -- { question_id: number }
  question_ms     jsonb                check (question_ms is null or jsonb_typeof(question_ms) = 'object'),
  question_order  jsonb                check (question_order is null or jsonb_typeof(question_order) = 'array'),
  ring_order      jsonb       not null check (jsonb_typeof(ring_order) = 'array' and jsonb_array_length(ring_order) = 5),  -- the five groups, closest first
  carried         boolean     not null default false,                                   -- continued from a quick run, so its 20 answers came along
  personal        smallint    not null check (personal between 0 and 100),
  touchy          smallint    not null check (touchy between 0 and 100),                -- weighted by the person's own touch ladder
  touchy_raw      smallint             check (touchy_raw between 0 and 100),            -- before the weights
  short_personal  smallint             check (short_personal between 0 and 100),        -- the same person on the quick quiz's scale
  short_touchy    smallint             check (short_touchy between 0 and 100),
  quadrant        text                 check (quadrant in ('vault','open','warm','hugger','middle')),  -- against the fixed 50 lines
  consistency     smallint             check (consistency between 0 and 100),           -- how well the repeated questions matched
  flags           jsonb                check (flags is null or jsonb_typeof(flags) = 'array'),
  age             text                 check (age in ('u18','18-24','25-34','35-44','45-54','55+')),      -- optional
  gender          text                 check (gender in ('woman','man','nonbinary','other')),              -- optional
  device          text                 check (device in ('mobile','desktop')),
  ref             text                 check (ref ~ '^[a-z0-9_-]{1,30}$'),
  attempt         smallint             check (attempt between 1 and 100),
  constraint deep_answers_size check (octet_length(answers::text) < 4000),
  constraint deep_timing_size  check (question_ms is null or octet_length(question_ms::text) < 4000),
  constraint deep_order_size   check (question_order is null or octet_length(question_order::text) < 3000),
  constraint deep_flags_size   check (flags is null or octet_length(flags::text) < 200)
);

create index if not exists deep_responses_created_at_idx on public.deep_responses (created_at);

alter table public.deep_responses enable row level security;

drop policy if exists "anyone can add a long response" on public.deep_responses;
drop policy if exists "anyone can read long responses" on public.deep_responses;
create policy "anyone can add a long response" on public.deep_responses for insert to anon with check (true);
create policy "anyone can read long responses" on public.deep_responses for select to anon using (true);

-- The public can add a row, and read every column EXCEPT age and gender. Answers plus an age and a
-- gender could point at one person in a small group of friends, so those two never leave the
-- database row by row. (You can still see them yourself in the Supabase table editor.)
revoke all on public.deep_responses from anon;
grant insert on public.deep_responses to anon;
grant select (id, created_at, quiz_version, duration_ms, answers, question_ms, question_order, ring_order, carried,
              personal, touchy, touchy_raw, short_personal, short_touchy, quadrant, consistency, flags,
              device, ref, attempt)
  on public.deep_responses to anon;

-- What the stats page gets instead: averages by age and by gender, first tries only, and only for
-- groups of at least 5 people. Asking for a smaller minimum doesn't work, 5 is the floor.
create or replace function public.deep_demographics(min_n integer default 5)
returns table (dimension text, grp text, n bigint, personal numeric, touchy numeric)
language sql
stable
security definer
set search_path = public
as $$
  select 'age'::text, age, count(*), round(avg(personal), 1), round(avg(touchy), 1)
    from public.deep_responses
   where age is not null and coalesce(attempt, 1) = 1 and coalesce(jsonb_array_length(flags), 0) = 0
   group by age having count(*) >= greatest(coalesce(min_n, 5), 5)
  union all
  select 'gender'::text, gender, count(*), round(avg(personal), 1), round(avg(touchy), 1)
    from public.deep_responses
   where gender is not null and coalesce(attempt, 1) = 1 and coalesce(jsonb_array_length(flags), 0) = 0
   group by gender having count(*) >= greatest(coalesce(min_n, 5), 5);
$$;

revoke all on function public.deep_demographics(integer) from public;
grant execute on function public.deep_demographics(integer) to anon;

-- Keep-awake heartbeat: the GitHub Action calls keep_awake() every 3 days. It writes a row
-- and deletes it again, because Supabase only counts writes as activity on the free plan.
-- The public role can run the function but can't read or change the table directly.
create table if not exists public.heartbeat (
  id         bigint generated always as identity primary key,
  pinged_at  timestamptz not null default now()
);

alter table public.heartbeat enable row level security;
revoke all on public.heartbeat from anon;

create or replace function public.keep_awake()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id bigint;
  stamp  timestamptz;
begin
  insert into public.heartbeat default values returning id, pinged_at into new_id, stamp;
  delete from public.heartbeat where id = new_id;
  return stamp;
end;
$$;

revoke all on function public.keep_awake() from public;
grant execute on function public.keep_awake() to anon;

-- Want the stats page private instead? Drop the two "read" policies above and
-- read the data from the Supabase dashboard (Table editor or SQL) instead.
