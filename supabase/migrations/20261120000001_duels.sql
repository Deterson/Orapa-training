-- v3 : duels contre l'IA. Une partie terminée est un entraînement (comme avant) ou un duel contre l'IA,
-- à l'un des trois niveaux. Un duel peut finir par une égalité (status = 'draw') et, quand l'IA a trouvé la
-- première, sans proposition du joueur (submission null). Les duels restent locaux tant qu'ils sont en
-- cours (jamais de status = 'playing' pour un duel) et entrent dans l'historique une fois terminés.
--
-- Les statistiques du profil (profile_stats) ne portent que sur l'entraînement : un duel ne change ni le
-- pourcentage de victoires ni la moyenne de tirs. Les duels ont leurs propres chiffres, par niveau (duel_stats).

alter table public.games
  add column mode text not null default 'training' check (mode in ('training', 'duel')),
  add column level text check (level in ('beginner', 'intermediate', 'expert'));

alter table public.games
  drop constraint games_status_check,
  drop constraint games_submission_shape,
  -- Un niveau pour un duel, aucun sinon.
  add constraint games_duel_level check ((mode = 'duel') = (level is not null)),
  -- L'égalité n'existe qu'en duel.
  add constraint games_status_check
    check (status in ('playing', 'won', 'lost', 'abandoned', 'draw') and (status <> 'draw' or mode = 'duel')),
  -- Une partie en cours ou abandonnée n'a pas de proposition ; une partie d'entraînement terminée en a une ;
  -- un duel terminé peut ne pas en avoir.
  add constraint games_submission_shape check (
    (
      (submission is null and (status in ('playing', 'abandoned') or mode = 'duel'))
      or (submission is not null and status not in ('playing', 'abandoned'))
    )
    and (
      submission is null
      or (
        jsonb_typeof(submission) = 'array'
        and jsonb_array_length(submission) between 1 and 7
        and octet_length(submission::text) <= 4000
      )
    )
  );

-- Un duel n'est jamais synchronisé en cours de partie : pas de ligne « en cours » pour un duel.
alter table public.games
  add constraint games_duel_finished check (mode = 'training' or status <> 'playing');

-- Statistiques d'entraînement : les duels n'y entrent pas.
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
    and mode = 'training'
$$;

-- Duels contre l'IA : une ligne par niveau joué, dans l'ordre débutant, intermédiaire, expert.
create function public.duel_stats()
returns table (
  level text,
  total_games bigint,
  wins bigint,
  draws bigint,
  losses bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    g.level,
    count(*),
    count(*) filter (where g.status = 'won'),
    count(*) filter (where g.status = 'draw'),
    count(*) filter (where g.status = 'lost')
  from public.games g
  where g.user_id = (select auth.uid())
    and g.mode = 'duel'
    and g.status <> 'playing'
  group by g.level
  order by case g.level when 'beginner' then 1 when 'intermediate' then 2 else 3 end
$$;

revoke all on function public.duel_stats() from public, anon, authenticated;
grant execute on function public.duel_stats() to authenticated;
