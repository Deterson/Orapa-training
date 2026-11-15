-- Parties en cours côté serveur (spécification v2 : plusieurs parties en cours par compte, reprises
-- depuis n'importe quel navigateur). La table `games` contient désormais :
--   * des parties en cours : status = 'playing', `snapshot` renseigné (la sauvegarde du site : mine,
--     tirs, solution, notes), `ended_at` vide ;
--   * des parties terminées : won / lost / abandoned, `snapshot` effacé, `ended_at` renseigné.
-- Une partie en cours est modifiable par son propriétaire (synchronisation) ; une fois terminée elle
-- redevient immuable. Les parties en cours n'entrent ni dans l'historique ni dans les statistiques.

alter table public.games
  alter column ended_at drop not null,
  add column snapshot jsonb,
  add column updated_at timestamptz not null default now();

alter table public.games
  drop constraint games_status_check,
  drop constraint games_submission_shape,
  add constraint games_status_check
    check (status in ('playing', 'won', 'lost', 'abandoned')),
  -- Gagnée ou perdue : une proposition ; en cours ou abandonnée : aucune.
  add constraint games_submission_shape check (
    (status in ('playing', 'abandoned')) = (submission is null)
    and (
      submission is null
      or (
        jsonb_typeof(submission) = 'array'
        and jsonb_array_length(submission) between 1 and 7
        and octet_length(submission::text) <= 4000
      )
    )
  ),
  add constraint games_progress_shape check (
    (status = 'playing') = (snapshot is not null)
    and (status = 'playing') = (ended_at is null)
    and (
      snapshot is null
      or (jsonb_typeof(snapshot) = 'object' and octet_length(snapshot::text) <= 250000)
    )
  );

create index games_playing_idx on public.games (user_id, updated_at desc) where status = 'playing';

-- `updated_at` suit chaque modification.
create function public.games_touch() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

create trigger games_touch before update on public.games
  for each row execute function public.games_touch();

-- Au plus 10 parties en cours par compte (la limite est aussi vérifiée par le site).
create function public.games_limit_playing() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'playing'
     and (select count(*) from public.games where user_id = new.user_id and status = 'playing') >= 10 then
    raise exception 'Trop de parties en cours' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger games_limit_playing before insert on public.games
  for each row execute function public.games_limit_playing();

-- Modification : seulement ses propres parties, seulement tant qu'elles sont en cours, et seulement
-- les colonnes qui évoluent pendant la partie (jamais le propriétaire, la graine, l'identifiant…).
grant update (status, lasers_count, probes_count, ended_at, duration_s, shots, submission, snapshot)
  on public.games to authenticated;

create policy games_update_own_playing on public.games
  for update to authenticated
  using (user_id = (select auth.uid()) and status = 'playing')
  with check (user_id = (select auth.uid()));

-- Les statistiques ne comptent que les parties terminées.
create or replace function public.profile_stats()
returns table (
  total_games bigint,
  wins bigint,
  losses bigint,
  abandoned bigint,
  win_rate numeric,
  avg_shots_to_win numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*),
    count(*) filter (where status = 'won'),
    count(*) filter (where status = 'lost'),
    count(*) filter (where status = 'abandoned'),
    case when count(*) = 0 then null
         else round(count(*) filter (where status = 'won')::numeric / count(*), 4) end,
    round(avg(shots_count) filter (where status = 'won'), 2)
  from public.games
  where user_id = (select auth.uid())
    and status <> 'playing'
$$;
