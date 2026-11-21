-- Duels contre l'IA : contraintes de la table `games` (mode, niveau, égalité, proposition facultative),
-- statistiques d'entraînement qui ignorent les duels, statistiques de duel par niveau et isolation entre
-- utilisateurs.

begin;

insert into auth.users (id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),  -- A : entraînements et duels
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');  -- B : aucun duel

-- Un duel terminé : niveau, issue, proposition facultative.
create function tt.duel_of(p_user uuid, p_level text, p_status text, p_shots integer default 5,
                           p_submission jsonb default '[{"gem":"red"}]')
returns void language plpgsql as $$
begin
  insert into public.games (user_id, seed, generator_version, status, mode, level, lasers_count,
    probes_count, started_at, ended_at, duration_s, shots, submission)
  values (p_user, 'graine', 1, p_status, 'duel', p_level, p_shots, 0, '2026-01-01 10:00+00',
    '2026-01-01 10:05+00', 300,
    (select coalesce(jsonb_agg(i::text), '[]'::jsonb) from generate_series(1, p_shots) i), p_submission);
end $$;
grant execute on function tt.duel_of(uuid, text, text, integer, jsonb) to anon, authenticated;

-- A : un entraînement gagné (6 tirs), puis des duels : expert gagné, expert perdu sans proposition,
-- débutant égalité, débutant gagné.
select tt.game_of('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'won', 6);
select tt.duel_of('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'expert', 'won');
select tt.duel_of('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'expert', 'lost', 4, null);
select tt.duel_of('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'beginner', 'draw');
select tt.duel_of('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'beginner', 'won');

-- ---------- Contraintes ----------

select tt.must_fail(
  $q$ insert into public.games (user_id, seed, generator_version, status, mode, lasers_count, probes_count,
      started_at, ended_at, duration_s, shots, submission)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'g', 1, 'won', 'duel', 0, 0, now(), now(), 0, '[]', '[{"gem":"red"}]') $q$,
  '23514', 'un duel a un niveau');
select tt.must_fail(
  $q$ insert into public.games (user_id, seed, generator_version, status, mode, level, lasers_count, probes_count,
      started_at, ended_at, duration_s, shots, submission)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'g', 1, 'won', 'training', 'expert', 0, 0, now(), now(), 0, '[]', '[{"gem":"red"}]') $q$,
  '23514', 'pas de niveau hors duel');
select tt.must_fail(
  $q$ select tt.game_of('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'draw', 1) $q$,
  '23514', 'pas d''égalité en entraînement');
select tt.must_fail(
  $q$ select tt.duel_of('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dieu', 'won') $q$,
  '23514', 'niveau inconnu');
select tt.must_fail(
  $q$ insert into public.games (user_id, seed, generator_version, status, mode, lasers_count, probes_count,
      started_at, ended_at, duration_s, shots, submission)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'g', 1, 'won', 'training', 0, 0, now(), now(), 0, '[]', null) $q$,
  '23514', 'un entraînement terminé a une proposition');

-- ---------- Statistiques d'entraînement : les duels n'y entrent pas ----------

select tt.as_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select tt.expect(total_games, 1, 'A : un seul entraînement compte') from public.profile_stats();
select tt.expect(wins, 1, 'A : une victoire d''entraînement') from public.profile_stats();
select tt.expect((avg_shots_to_win * 100)::bigint, 600, 'A : 6 tirs avant victoire') from public.profile_stats();

-- ---------- Statistiques de duel, par niveau ----------

select tt.expect(count(*), 2, 'A : deux niveaux joués') from public.duel_stats();
select tt.expect(total_games, 2, 'A : débutant, 2 duels') from public.duel_stats() where level = 'beginner';
select tt.expect(wins, 1, 'A : débutant, 1 victoire') from public.duel_stats() where level = 'beginner';
select tt.expect(draws, 1, 'A : débutant, 1 égalité') from public.duel_stats() where level = 'beginner';
select tt.expect(losses, 0, 'A : débutant, 0 défaite') from public.duel_stats() where level = 'beginner';
select tt.expect(total_games, 2, 'A : expert, 2 duels') from public.duel_stats() where level = 'expert';
select tt.expect(wins, 1, 'A : expert, 1 victoire') from public.duel_stats() where level = 'expert';
select tt.expect(losses, 1, 'A : expert, 1 défaite') from public.duel_stats() where level = 'expert';
-- L'ordre : débutant d'abord, expert en dernier.
select tt.expect(count(*), 1, 'A : débutant en premier')
  from (select level from public.duel_stats() limit 1) first_row where level = 'beginner';
select tt.back_to_admin();

-- B ne voit rien des duels de A.
select tt.as_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
select tt.expect(count(*), 0, 'B : aucun duel') from public.duel_stats();
select tt.expect(count(*), 0, 'B ne voit pas les parties de A') from public.games;
select tt.back_to_admin();

-- Sans connexion : aucun accès.
select tt.as_user(null);
select tt.must_fail('select * from public.duel_stats()', '42501', 'anon n''a pas les statistiques de duel');
select tt.back_to_admin();

rollback;

\echo ok : duels contre l'IA
