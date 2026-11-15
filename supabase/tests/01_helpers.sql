-- Fonctions d'aide des tests (schéma `tt`, base jetable) : prendre l'identité d'un utilisateur,
-- vérifier qu'une instruction échoue avec tel code, comparer des nombres. À appliquer après les
-- migrations et avant les fichiers *.test.sql.

create schema tt;

create function tt.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  execute case when uid is null then 'set local role anon' else 'set local role authenticated' end;
end $$;

create function tt.back_to_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

-- Une partie valide ; chaque test en modifie un champ pour viser une contrainte.
create function tt.game(
  p_id uuid default gen_random_uuid(),
  p_user uuid default null,
  p_status text default 'won',
  p_lasers integer default 2,
  p_shots jsonb default '["1","15"]',
  p_submission jsonb default '[{"gem":"red"}]',
  p_ext text default ''
) returns void language plpgsql as $$
begin
  insert into public.games (id, user_id, seed, generator_version, extensions, status, lasers_count,
    probes_count, started_at, ended_at, duration_s, shots, submission)
  values (p_id, coalesce(p_user, auth.uid()), 'graine', 1, p_ext, p_status, p_lasers, 0,
    '2026-01-01 10:00+00', '2026-01-01 10:05+00', 300, p_shots, p_submission);
end $$;

-- Vérifie qu'une instruction échoue avec le code SQLSTATE attendu.
create function tt.must_fail(p_sql text, p_code text, p_label text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_code then return; end if;
    raise exception '% : échec avec le code %, attendu % (%)', p_label, sqlstate, p_code, sqlerrm;
  end;
  raise exception '% : aurait dû échouer', p_label;
end $$;

create function tt.expect(p_actual bigint, p_expected bigint, p_label text) returns void
language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception '% : obtenu %, attendu %', p_label, p_actual, p_expected;
  end if;
end $$;


-- Une partie valide dont on choisit le propriétaire, le statut et le nombre de lasers (stats).
create function tt.game_of(p_user uuid, p_status text, p_lasers integer, p_probes integer default 0)
returns void language plpgsql as $$
begin
  insert into public.games (user_id, seed, generator_version, status, lasers_count, probes_count,
    started_at, ended_at, duration_s, shots, submission)
  values (p_user, 'graine', 1, p_status, p_lasers, p_probes, '2026-01-01 10:00+00', '2026-01-01 10:05+00', 300,
    (select coalesce(jsonb_agg(i::text), '[]'::jsonb) from generate_series(1, p_lasers) i),
    case when p_status = 'abandoned' then null else '[{"gem":"red"}]'::jsonb end);
end $$;

grant usage on schema tt to anon, authenticated;
grant execute on all functions in schema tt to anon, authenticated;

-- Une partie en cours (status 'playing', snapshot renseigné, pas de fin).
create function tt.playing_of(p_user uuid, p_id uuid default gen_random_uuid(), p_snapshot jsonb default '{"mine":"secret"}')
returns void language plpgsql as $$
begin
  insert into public.games (id, user_id, seed, generator_version, status, lasers_count, probes_count,
    started_at, ended_at, duration_s, shots, submission, snapshot)
  values (p_id, p_user, 'graine', 1, 'playing', 0, 0, '2026-01-01 10:00+00', null, 0, '[]', null, p_snapshot);
end $$;

grant execute on all functions in schema tt to anon, authenticated;
