-- v1.0.17 (site) : les sondes de cases comptent comme des lasers, un seul compteur de « tirs ».
-- `lasers_count` et `probes_count` restent enregistrés tels quels (rien n'est perdu) ; `shots_count`
-- en est le total, calculé par la base : il ne peut pas être incohérent avec eux.
-- La moyenne du profil porte désormais sur les tirs : la fonction change de forme, on la recrée.

alter table public.games
  add column shots_count integer generated always as (lasers_count + probes_count) stored;

drop function public.profile_stats();

create function public.profile_stats()
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
$$;

revoke all on function public.profile_stats() from public, anon, authenticated;
grant execute on function public.profile_stats() to authenticated;
