-- Parties en cours côté serveur : créées et synchronisées par leur propriétaire, jamais visibles ni
-- modifiables par un autre, immuables une fois terminées, limitées à 10, hors statistiques.

begin;

insert into auth.users (id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- ---------- Forme des lignes ----------

select tt.as_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select tt.playing_of('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a0000000-0000-0000-0000-000000000001');
select tt.expect(count(*), 1, 'A crée une partie en cours') from public.games where status = 'playing';

-- Une partie en cours exige un snapshot et n'a pas de fin ; une partie terminée n'a plus de snapshot.
select tt.must_fail($q$ insert into public.games (user_id, seed, generator_version, status, lasers_count, probes_count, started_at, ended_at, duration_s, shots, snapshot)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'g', 1, 'playing', 0, 0, now(), null, 0, '[]', null) $q$, '23514', 'en cours sans snapshot');
select tt.must_fail($q$ insert into public.games (user_id, seed, generator_version, status, lasers_count, probes_count, started_at, ended_at, duration_s, shots, snapshot)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'g', 1, 'playing', 0, 0, now(), now(), 0, '[]', '{}') $q$, '23514', 'en cours avec une fin');
select tt.must_fail($q$ insert into public.games (user_id, seed, generator_version, status, lasers_count, probes_count, started_at, ended_at, duration_s, shots, submission, snapshot)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'g', 1, 'won', 0, 0, now(), now(), 0, '[]', '[{"gem":"red"}]', '{}') $q$, '23514', 'terminée avec un snapshot');
select tt.must_fail($q$ insert into public.games (user_id, seed, generator_version, status, lasers_count, probes_count, started_at, ended_at, duration_s, shots, submission, snapshot)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'g', 1, 'playing', 0, 0, now(), null, 0, '[]', '[{"gem":"red"}]', '{}') $q$, '23514', 'en cours avec une proposition');
select tt.must_fail($q$ select tt.playing_of('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', gen_random_uuid(), '[1,2]') $q$, '23514', 'snapshot qui n''est pas un objet');
select tt.must_fail($q$ select tt.playing_of('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', gen_random_uuid(),
  jsonb_build_object('x', repeat('a', 260000))) $q$, '23514', 'snapshot trop gros');
select tt.expect(count(*), 1, 'aucune de ces parties n''a été créée') from public.games;
select tt.back_to_admin();

-- ---------- Confidentialité : le snapshot (qui contient la mine) reste à son propriétaire ----------

select tt.as_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
select tt.expect(count(*), 0, 'B ne voit pas la partie en cours de A') from public.games;
select tt.expect(count(*), 0, 'B ne lit pas le snapshot de A') from public.games where snapshot is not null;
with changed as (
  update public.games set snapshot = '{"mine":"pirate"}', status = 'playing' returning 1
) select tt.expect(count(*), 0, 'B ne modifie pas la partie en cours de A') from changed;
with gone as (delete from public.games returning 1)
  select tt.expect(count(*), 0, 'B ne supprime pas la partie en cours de A') from gone;
select tt.back_to_admin();
select tt.expect(count(*), 1, 'la partie de A est intacte') from public.games
  where snapshot = '{"mine":"secret"}';

-- ---------- Synchronisation par le propriétaire ----------

select tt.as_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
with changed as (
  update public.games set snapshot = '{"mine":"secret","tirs":3}', lasers_count = 3, shots = '["1","2","3"]', duration_s = 42
  where id = 'a0000000-0000-0000-0000-000000000001' returning 1
) select tt.expect(count(*), 1, 'A synchronise sa partie en cours') from changed;
select tt.expect(count(*), 1, 'le snapshot est à jour') from public.games where snapshot->>'tirs' = '3' and shots_count = 3;
select tt.expect(count(*), 1, 'updated_at suit la modification') from public.games where updated_at > created_at;

-- Colonnes qui ne bougent jamais : refusé.
select tt.must_fail($q$ update public.games set user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' $q$, '42501', 'changer le propriétaire');
select tt.must_fail($q$ update public.games set seed = 'autre' $q$, '42501', 'changer la graine');
select tt.must_fail($q$ update public.games set id = gen_random_uuid() $q$, '42501', 'changer l''identifiant');
-- Un état incohérent est refusé par les contraintes.
select tt.must_fail($q$ update public.games set snapshot = null $q$, '23514', 'en cours sans snapshot');
select tt.back_to_admin();

-- ---------- Fin de partie : la ligne devient immuable ----------

select tt.as_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
with changed as (
  update public.games set status = 'won', snapshot = null, ended_at = now(), submission = '[{"gem":"red"}]',
    lasers_count = 3, shots = '["1","2","3"]'
  where id = 'a0000000-0000-0000-0000-000000000001' and status = 'playing' returning 1
) select tt.expect(count(*), 1, 'A termine sa partie') from changed;
with changed as (
  update public.games set status = 'lost' where id = 'a0000000-0000-0000-0000-000000000001' returning 1
) select tt.expect(count(*), 0, 'une partie terminée ne se modifie plus') from changed;
-- Renvoyer la fin (nouvel essai) ne change rien : la mise à jour ne trouve plus de partie en cours.
with changed as (
  update public.games set status = 'abandoned', snapshot = null, ended_at = now(), submission = null
  where id = 'a0000000-0000-0000-0000-000000000001' and status = 'playing' returning 1
) select tt.expect(count(*), 0, 'terminer deux fois est sans effet') from changed;
select tt.expect(count(*), 1, 'la partie reste gagnée') from public.games
  where id = 'a0000000-0000-0000-0000-000000000001' and status = 'won' and snapshot is null and ended_at is not null;
select tt.back_to_admin();

-- ---------- Abandon d'une partie en cours ----------

select tt.as_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select tt.playing_of('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a0000000-0000-0000-0000-000000000002');
with changed as (
  update public.games set status = 'abandoned', snapshot = null, ended_at = now(), submission = null
  where id = 'a0000000-0000-0000-0000-000000000002' returning 1
) select tt.expect(count(*), 1, 'A abandonne une partie en cours') from changed;
select tt.back_to_admin();

-- ---------- Limite de 10 parties en cours ----------

select tt.as_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
select tt.playing_of('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') from generate_series(1, 10);
select tt.expect(count(*), 10, 'B a dix parties en cours') from public.games where status = 'playing';
select tt.must_fail($q$ select tt.playing_of('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $q$, '23514', 'onzième partie en cours');
-- Une partie terminée libère une place ; la limite ne vise pas les parties terminées.
with changed as (
  update public.games set status = 'abandoned', snapshot = null, ended_at = now(), submission = null
  where id = (select id from public.games where status = 'playing' limit 1) returning 1
) select tt.expect(count(*), 1, 'B termine une partie') from changed;
select tt.playing_of('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
select tt.expect(count(*), 10, 'de nouveau dix parties en cours') from public.games where status = 'playing';
select tt.back_to_admin();
-- La limite est par compte : A peut encore en créer.
select tt.as_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select tt.playing_of('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select tt.back_to_admin();

-- ---------- Statistiques : les parties en cours ne comptent pas ----------

select tt.as_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
select tt.expect(total_games, 1, 'B : seule la partie abandonnée compte') from public.profile_stats();
select tt.expect(abandoned, 1, 'B : un abandon') from public.profile_stats();
select tt.back_to_admin();
select tt.as_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select tt.expect(total_games, 2, 'A : une victoire et un abandon') from public.profile_stats();
select tt.expect(wins, 1, 'A : une victoire') from public.profile_stats();
select tt.expect((avg_shots_to_win * 100)::bigint, 300, 'A : 3 tirs avant victoire') from public.profile_stats();
select tt.back_to_admin();

-- ---------- Suppression d'un compte : ses parties en cours partent aussi ----------

delete from auth.users where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select tt.expect(count(*), 0, 'les parties de B partent avec son compte') from public.games
  where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

rollback;

\echo ok : parties en cours
