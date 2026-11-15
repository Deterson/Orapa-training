-- Suppression du compte (public.delete_my_account) : efface le compte de l'appelant et ses parties,
-- jamais ceux d'un autre ; refusée sans connexion.

begin;

insert into auth.users (id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

select tt.game_of('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'won', 5);
select tt.game_of('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lost', 9);
select tt.game_of('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'won', 7);

-- Sans connexion : refusé, rien n'est supprimé.
select tt.as_user(null);
select tt.must_fail('select public.delete_my_account()', '42501', 'anon ne supprime pas de compte');
select tt.back_to_admin();
select tt.expect(count(*), 2, 'les comptes sont intacts') from auth.users;
select tt.expect(count(*), 3, 'les parties sont intactes') from public.games;

-- A supprime son compte : ses deux parties partent avec, celles de B restent.
select tt.as_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select public.delete_my_account();
select tt.back_to_admin();
select tt.expect(count(*), 0, 'le compte de A est supprimé') from auth.users
  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select tt.expect(count(*), 0, 'les parties de A sont effacées') from public.games
  where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select tt.expect(count(*), 1, 'le compte de B reste') from auth.users
  where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select tt.expect(count(*), 1, 'la partie de B reste') from public.games
  where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- Un compte déjà supprimé qui rappelle la fonction (jeton encore valide) : sans effet, sans erreur.
select tt.as_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select public.delete_my_account();
select tt.back_to_admin();
select tt.expect(count(*), 1, 'B toujours là') from public.games;

-- B ne peut pas viser le compte de A (la fonction ne prend aucun paramètre) et ne supprime que le sien.
select tt.as_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
select tt.must_fail('select public.delete_my_account(''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'')', '42883', 'pas de paramètre');
select public.delete_my_account();
select tt.back_to_admin();
select tt.expect(count(*), 0, 'plus aucun compte') from auth.users;
select tt.expect(count(*), 0, 'plus aucune partie') from public.games;

rollback;

\echo ok : suppression du compte
