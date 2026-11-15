-- Statistiques du profil (public.profile_stats) : valeurs vérifiées à la main sur des jeux de
-- parties de test, cas limites compris, et isolation entre utilisateurs.

begin;

insert into auth.users (id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),  -- A : de tout un peu
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),  -- B : aucune partie
  ('cccccccc-cccc-cccc-cccc-cccccccccccc'),  -- C : seulement des défaites et abandons
  ('dddddddd-dddd-dddd-dddd-dddddddddddd'),  -- D : une seule victoire
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),  -- E : seulement des victoires, 0 tir
  ('ffffffff-ffff-ffff-ffff-ffffffffffff');  -- F : des sondes comptent comme des tirs

-- A : 3 victoires (5, 10 et 8 lasers), 1 défaite (20 lasers), 2 abandons (3 et 0 lasers).
-- Les lasers des parties perdues ou abandonnées ne comptent pas dans la moyenne.
select tt.game_of('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'won', 5);
select tt.game_of('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'won', 10);
select tt.game_of('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'won', 8);
select tt.game_of('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lost', 20);
select tt.game_of('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'abandoned', 3);
select tt.game_of('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'abandoned', 0);
-- C : une défaite et deux abandons.
select tt.game_of('cccccccc-cccc-cccc-cccc-cccccccccccc', 'lost', 4);
select tt.game_of('cccccccc-cccc-cccc-cccc-cccccccccccc', 'abandoned', 2);
select tt.game_of('cccccccc-cccc-cccc-cccc-cccccccccccc', 'abandoned', 9);
-- D : une victoire en 7 lasers.
select tt.game_of('dddddddd-dddd-dddd-dddd-dddddddddddd', 'won', 7);
-- F : victoires à 3 lasers + 2 sondes (5 tirs) et 4 lasers + 0 sonde (4 tirs), une défaite à 10 lasers
-- + 5 sondes (ignorée) : moyenne (5 + 4) / 2 = 4,5 tirs ; sans compter les sondes elle serait de 3,5.
select tt.game_of('ffffffff-ffff-ffff-ffff-ffffffffffff', 'won', 3, 2);
select tt.game_of('ffffffff-ffff-ffff-ffff-ffffffffffff', 'won', 4, 0);
select tt.game_of('ffffffff-ffff-ffff-ffff-ffffffffffff', 'lost', 10, 5);
-- E : deux victoires sans aucun laser.
select tt.game_of('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'won', 0);
select tt.game_of('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'won', 0);

-- A : 6 parties, 3 victoires (50 %), moyenne (5 + 10 + 8) / 3 = 7,67 lasers.
select tt.as_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select tt.expect(total_games, 6, 'A : total') from public.profile_stats();
select tt.expect(wins, 3, 'A : victoires') from public.profile_stats();
select tt.expect(losses, 1, 'A : défaites') from public.profile_stats();
select tt.expect(abandoned, 2, 'A : abandons') from public.profile_stats();
select tt.expect((win_rate * 10000)::bigint, 5000, 'A : 50 % de victoires') from public.profile_stats();
select tt.expect((avg_shots_to_win * 100)::bigint, 767, 'A : 7,67 tirs avant victoire') from public.profile_stats();
select tt.back_to_admin();

-- B : aucune partie -> une ligne, total 0, taux et moyenne null (jamais 0).
select tt.as_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
select tt.expect(count(*), 1, 'B : une ligne même sans partie') from public.profile_stats();
select tt.expect(total_games, 0, 'B : total 0') from public.profile_stats();
select tt.expect(wins, 0, 'B : aucune victoire') from public.profile_stats();
select tt.expect(count(*), 1, 'B : taux null') from public.profile_stats() where win_rate is null;
select tt.expect(count(*), 1, 'B : moyenne null') from public.profile_stats() where avg_shots_to_win is null;
select tt.back_to_admin();

-- C : parties sans victoire -> 0 % de victoires, moyenne null (pas 0).
select tt.as_user('cccccccc-cccc-cccc-cccc-cccccccccccc');
select tt.expect(total_games, 3, 'C : total') from public.profile_stats();
select tt.expect(wins, 0, 'C : aucune victoire') from public.profile_stats();
select tt.expect(count(*), 1, 'C : 0 % (et non null)') from public.profile_stats() where win_rate = 0;
select tt.expect(count(*), 1, 'C : moyenne null') from public.profile_stats() where avg_shots_to_win is null;
select tt.back_to_admin();

-- D : une victoire sur une partie -> 100 %, moyenne 7.
select tt.as_user('dddddddd-dddd-dddd-dddd-dddddddddddd');
select tt.expect((win_rate * 100)::bigint, 100, 'D : 100 %') from public.profile_stats();
select tt.expect(avg_shots_to_win::bigint, 7, 'D : moyenne 7') from public.profile_stats();
select tt.back_to_admin();

-- E : une moyenne de 0 laser est une vraie moyenne (null seulement sans victoire).
select tt.as_user('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
select tt.expect(count(*), 1, 'E : moyenne 0, pas null') from public.profile_stats() where avg_shots_to_win = 0;
select tt.back_to_admin();

-- F : les sondes comptent dans la moyenne des tirs avant victoire.
select tt.as_user('ffffffff-ffff-ffff-ffff-ffffffffffff');
select tt.expect((avg_shots_to_win * 100)::bigint, 450, 'F : 4,5 tirs avant victoire (lasers + sondes)') from public.profile_stats();
select tt.expect(total_games, 3, 'F : total') from public.profile_stats();
select tt.back_to_admin();

-- Sans connexion : refusé.
select tt.as_user(null);
select tt.must_fail('select * from public.profile_stats()', '42501', 'anon ne lit pas les statistiques');
select tt.back_to_admin();

-- Une partie ajoutée change les chiffres de son propriétaire, pas ceux des autres.
select tt.game_of('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'won', 12);
select tt.as_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
select tt.expect(total_games, 1, 'B : une partie') from public.profile_stats();
select tt.expect(avg_shots_to_win::bigint, 12, 'B : moyenne 12') from public.profile_stats();
select tt.back_to_admin();
select tt.as_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select tt.expect(total_games, 6, 'A : inchangé') from public.profile_stats();
select tt.back_to_admin();

rollback;

\echo ok : statistiques du profil
