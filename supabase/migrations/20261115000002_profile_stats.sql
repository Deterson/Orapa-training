-- v1.5 : statistiques du profil, calculées à partir de `games` pour l'utilisateur connecté.
--
-- Règles (voir docs/roadmap.md, étape v1.5) :
--  * une partie compte dans le total dès qu'elle est terminée : gagnée, perdue ou abandonnée
--    (une partie abandonnée compte comme perdue) ;
--  * moyenne de lasers = moyenne de `lasers_count` sur les parties GAGNÉES uniquement ;
--  * pas de victoire : la moyenne est null (l'interface affiche « — », jamais 0) ;
--  * pas de partie : le taux de victoires est null aussi (l'interface affiche « Aucune partie »).

create function public.profile_stats()
returns table (
  total_games bigint,
  wins bigint,
  losses bigint,
  abandoned bigint,
  win_rate numeric,
  avg_lasers_to_win numeric
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
    round(avg(lasers_count) filter (where status = 'won'), 2)
  from public.games
  -- Le filtre explicite double la sécurité par ligne : même sans RLS, seul l'utilisateur compte.
  where user_id = (select auth.uid())
$$;

revoke all on function public.profile_stats() from public, anon, authenticated;
grant execute on function public.profile_stats() to authenticated;
