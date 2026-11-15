-- v1.3 : une ligne par partie terminée, visible et modifiable par son seul propriétaire.
-- Voir docs/roadmap.md (étape v1.3) et docs/backend.md.

create table public.games (
  id uuid primary key default gen_random_uuid(),
  -- L'utilisateur connecté ; ses parties disparaissent avec son compte (étape v1.6).
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- De quoi rejouer la mine : graine + version du générateur + extensions.
  seed text not null check (char_length(seed) between 1 and 200),
  generator_version integer not null check (generator_version >= 1),
  -- Extensions de la partie, comme dans l'adresse du site : '' (aucune), 'd' (Diamant),
  -- 'n' (diamant noir) ou 'dn' (les deux).
  extensions text not null default '' check (extensions in ('', 'd', 'n', 'dn')),
  status text not null check (status in ('won', 'lost', 'abandoned')),
  lasers_count integer not null check (lasers_count between 0 and 36),
  probes_count integer not null check (probes_count between 0 and 80),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_s integer not null check (duration_s >= 0),
  -- Repères tirés, dans l'ordre (tableau de textes) ; un par laser.
  shots jsonb not null default '[]'::jsonb,
  -- Gemmes proposées (tableau), ou null si la partie a été abandonnée.
  submission jsonb,
  created_at timestamptz not null default now(),

  constraint games_time_order check (ended_at >= started_at),
  constraint games_shots_shape check (
    jsonb_typeof(shots) = 'array'
    and jsonb_array_length(shots) = lasers_count
    and octet_length(shots::text) <= 1000
  ),
  -- Une partie gagnée ou perdue a une proposition ; une partie abandonnée n'en a pas.
  constraint games_submission_shape check (
    (status = 'abandoned') = (submission is null)
    and (
      submission is null
      or (
        jsonb_typeof(submission) = 'array'
        and jsonb_array_length(submission) between 1 and 7
        and octet_length(submission::text) <= 4000
      )
    )
  )
);

create index games_user_ended_idx on public.games (user_id, ended_at desc);

-- Sécurité par ligne : chacun ne voit et ne supprime que ses parties. Les parties sont
-- immuables une fois écrites : aucun droit de mise à jour n'est donné.
alter table public.games enable row level security;
alter table public.games force row level security;

revoke all on public.games from public, anon, authenticated;
grant select, insert, delete on public.games to authenticated;

create policy games_select_own on public.games
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy games_insert_own on public.games
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy games_delete_own on public.games
  for delete to authenticated
  using (user_id = (select auth.uid()));
