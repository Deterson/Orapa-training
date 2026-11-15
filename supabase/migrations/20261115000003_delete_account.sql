-- v1.6 : suppression du compte par son propriétaire. Supprimer la ligne de `auth.users` emporte
-- toutes ses parties (clé étrangère `on delete cascade` de `public.games`).
--
-- `security definer` : un utilisateur n'a pas le droit d'écrire dans `auth.users`, la fonction le
-- fait pour lui, mais SEULEMENT pour l'identifiant de la requête (`auth.uid()`), jamais un autre.

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  delete from auth.users where id = uid;
end $$;

revoke all on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;
