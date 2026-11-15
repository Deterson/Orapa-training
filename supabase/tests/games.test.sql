-- Sécurité par ligne de public.games : un utilisateur ne lit, n'écrit, ne modifie ni ne supprime
-- jamais les parties d'un autre. Chaque contrôle échoue bruyamment (exception) ; la sortie « ok »
-- n'apparaît que si tout passe. Exécuté en superutilisateur, qui prend les rôles avec SET ROLE.

-- Tout dans une seule transaction : `set local` (rôle, identifiant) ne vit que le temps d'une transaction.
begin;

-- Les fonctions d'aide (schéma tt) viennent de 01_helpers.sql.

insert into auth.users (id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- A joue deux parties ; B en joue une.
select tt.as_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select tt.game('a0000000-0000-0000-0000-000000000001');
select tt.game('a0000000-0000-0000-0000-000000000002', null, 'lost');
select tt.back_to_admin();
select tt.as_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
select tt.game('b0000000-0000-0000-0000-000000000001');
select tt.back_to_admin();

-- ---------- Lecture ----------

select tt.as_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select tt.expect(count(*), 2, 'A voit ses deux parties') from public.games;
select tt.expect(count(*), 0, 'A ne voit pas la partie de B')
  from public.games where id = 'b0000000-0000-0000-0000-000000000001';
select tt.back_to_admin();

select tt.as_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
select tt.expect(count(*), 1, 'B ne voit que sa partie') from public.games;
select tt.expect(count(*), 0, 'B ne voit pas les parties de A')
  from public.games where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select tt.back_to_admin();

-- Sans connexion : aucun accès, ni en lecture ni en écriture.
select tt.as_user(null);
select tt.must_fail('select * from public.games', '42501', 'anon ne lit pas');
select tt.must_fail('select tt.game()', '42501', 'anon n''écrit pas');
select tt.back_to_admin();

-- ---------- Écriture ----------

select tt.as_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
-- B ne peut pas écrire une partie au nom de A.
select tt.must_fail(
  $q$ select tt.game(p_user => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $q$,
  '42501', 'B écrit au nom de A');
-- Sans user_id : c'est l'utilisateur connecté.
select tt.game('b0000000-0000-0000-0000-000000000002');
select tt.expect(count(*), 1, 'user_id par défaut = utilisateur connecté')
  from public.games where id = 'b0000000-0000-0000-0000-000000000002'
  and user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
-- Réécrire un identifiant qui existe déjà chez A ne change rien et ne révèle rien.
insert into public.games (id, user_id, seed, generator_version, status, lasers_count, probes_count,
  started_at, ended_at, duration_s, shots, submission)
values ('a0000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'pirate', 1, 'won', 0, 0,
  now(), now(), 0, '[]', '[{"gem":"red"}]')
on conflict (id) do nothing;
select tt.expect(count(*), 2, 'B n''a toujours que deux parties') from public.games;
select tt.back_to_admin();

select tt.as_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select tt.expect(count(*), 0, 'la partie de A n''a pas été écrasée')
  from public.games where id = 'a0000000-0000-0000-0000-000000000001' and seed = 'pirate';
-- Rejouer le même envoi (file de nouvel essai) ne crée pas de doublon.
insert into public.games (id, seed, generator_version, status, lasers_count, probes_count,
  started_at, ended_at, duration_s, shots, submission)
values ('a0000000-0000-0000-0000-000000000001', 'graine', 1, 'won', 2, 0,
  '2026-01-01 10:00+00', '2026-01-01 10:05+00', 300, '["1","15"]', '[{"gem":"red"}]')
on conflict (id) do nothing;
select tt.expect(count(*), 2, 'pas de doublon au nouvel essai') from public.games;
select tt.back_to_admin();

-- ---------- Modification et suppression ----------

select tt.as_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
-- Modifier : B ne touche à aucune partie de A, et personne ne modifie une partie terminée
-- (la modification n'est permise que tant qu'une partie est en cours : voir progress.test.sql).
with changed as (
  update public.games set status = 'won' where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' returning 1
) select tt.expect(count(*), 0, 'B ne modifie aucune partie de A') from changed;
with changed as (
  update public.games set status = 'lost' where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' returning 1
) select tt.expect(count(*), 0, 'une partie terminée est immuable, même pour son propriétaire') from changed;
with gone as (delete from public.games where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' returning 1)
  select tt.expect(count(*), 0, 'B ne supprime aucune partie de A') from gone;
select tt.back_to_admin();

select tt.as_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select tt.expect(count(*), 2, 'les parties de A sont intactes') from public.games;
with gone as (delete from public.games where id = 'a0000000-0000-0000-0000-000000000002' returning 1)
  select tt.expect(count(*), 1, 'A supprime sa propre partie') from gone;
select tt.back_to_admin();

-- ---------- Contraintes de forme ----------

select tt.as_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select tt.must_fail($q$ select tt.game(p_status => 'draw') $q$, '23514', 'statut inconnu');
select tt.must_fail($q$ select tt.game(p_lasers => 3) $q$, '23514', 'lasers ≠ nombre de tirs');
select tt.must_fail($q$ select tt.game(p_shots => '{"a":1}', p_lasers => 0) $q$, '23514', 'tirs hors tableau');
select tt.must_fail($q$ select tt.game(p_status => 'abandoned') $q$, '23514', 'abandon avec proposition');
select tt.must_fail($q$ select tt.game(p_status => 'won', p_submission => null) $q$, '23514', 'victoire sans proposition');
select tt.must_fail($q$ select tt.game(p_submission => '{"gem":"red"}') $q$, '23514', 'proposition hors tableau');
select tt.must_fail($q$ select tt.game(p_ext => 'x') $q$, '23514', 'extension inconnue');
select tt.must_fail(
  $q$ select tt.game(p_lasers => 37, p_shots => (select jsonb_agg(i) from generate_series(1, 37) i)) $q$,
  '23514', 'plus de 36 lasers');
select tt.game(p_status => 'abandoned', p_submission => null, p_ext => 'dn');
select tt.back_to_admin();

-- ---------- Suppression du compte ----------

delete from auth.users where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select tt.expect(count(*), 0, 'les parties de B partent avec son compte')
  from public.games where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select tt.expect(count(*), 2, 'celles de A restent') from public.games
  where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

rollback;

\echo ok : sécurité par ligne de public.games
