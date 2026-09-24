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

-- Want the stats page private instead? Drop the two "read" policies above and
-- read the data from the Supabase dashboard (Table editor or SQL) instead.
