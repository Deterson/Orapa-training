-- Reproduit, sur un Postgres vide, le minimum de ce que Supabase fournit déjà : les rôles
-- `anon` et `authenticated`, la table `auth.users` et la fonction `auth.uid()`. Uniquement pour les
-- tests : jamais à appliquer sur un vrai projet Supabase.

-- Les rôles appartiennent au serveur, pas à la base : on ne les recrée pas s'ils existent déjà.
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

create schema auth;
grant usage on schema auth to anon, authenticated;

create table auth.users (
  id uuid primary key default gen_random_uuid()
);

-- Comme Supabase : l'identifiant vient du jeton de la requête (paramètre `request.jwt.claim.sub`).
create function auth.uid() returns uuid
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;

grant usage on schema public to anon, authenticated;
