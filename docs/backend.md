# Backend de la v2 (Supabase)

**Décision (étape v1.1) : Supabase.** Connexion Google intégrée, base Postgres, sécurité par
ligne (RLS) écrite en SQL, statistiques en une requête. Le front reste statique (GitHub Pages) ;
il parle à Supabase avec la clé **publique** (`anon`), la sécurité repose sur les règles RLS, pas
sur le secret de la clé.

**Sans configuration, le site fonctionne comme en v1** : aucune clé, aucun bouton de connexion,
aucun appel réseau. Le jeu reste jouable sans compte.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `VITE_SUPABASE_URL` | URL du projet, `https://<id>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | clé publique « anon / publishable » du projet |

- **Développement :** copier `.env.example` en `.env.local` (ignoré par git) et la remplir.
- **Production (GitHub Pages) :** Settings → Secrets and variables → Actions → onglet
  **Variables** : créer `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (ces valeurs sont
  publiques, elles finissent dans le JavaScript du site). Ne **jamais** mettre la clé
  `service_role` dans le dépôt, dans une variable `VITE_*` ni dans le front.
- Deux projets Supabase séparés : un pour le développement, un pour la production.

## Mise en place (à faire une fois par projet)

1. **Créer le projet** sur supabase.com (région proche, par exemple Paris).
2. **Appliquer les migrations** de `supabase/migrations/`, dans l'ordre : soit avec la CLI
   (`supabase link` puis `supabase db push`), soit en collant les fichiers un par un dans
   *SQL Editor*.
3. **Créer l'identifiant OAuth Google** (Google Cloud Console → APIs & Services → Identifiants →
   *ID client OAuth*, type « Application Web ») :
   - écran de consentement : type externe, champs de base (nom, e-mail d'assistance) ; seuls les
     champs `email`, `profile` et `openid` sont utilisés ;
   - **URI de redirection autorisée** : `https://<id>.supabase.co/auth/v1/callback`
     (la même pour le projet de développement avec son propre `<id>`).
4. **Activer Google dans Supabase** : Authentication → Sign In / Providers → Google : coller
   l'ID client et le secret client (le secret reste dans Supabase, jamais dans le dépôt).
5. **Autoriser les adresses du site** : Authentication → URL Configuration :
   - *Site URL* : `https://deterson.github.io/Orapa-training/`
   - *Redirect URLs* : cette même adresse, plus `http://localhost:5173/**` pour le développement.
6. Renseigner les deux variables ci-dessus et redéployer.

## Ce que le site demande à Google et conserve

Identifiant, nom, avatar et adresse e-mail du compte (tels que Supabase les stocke dans
`auth.users` ; le site n'utilise que le nom et l'avatar). Par partie terminée : graine, version du
générateur, extensions, repères tirés, proposition, résultat, durée, dates ; jamais la mine, les
notes ni les dessins. Le joueur peut supprimer son compte et toutes ses parties depuis la page
Confidentialité (fonction SQL `delete_my_account()`). Texte destiné aux joueurs : `src/ui/privacy.ts`.

## Ce que fait la base

| Migration | Contenu |
|---|---|
| `…000001_games.sql` | table `games`, sécurité par ligne : chacun lit, écrit et supprime ses parties, aucune mise à jour |
| `…000002_profile_stats.sql` | `profile_stats()` : parties, victoires, % de victoires, lasers par victoire (les abandons comptent comme des défaites) |
| `…000003_delete_account.sql` | `delete_my_account()` : supprime le compte de l'appelant, ses parties partent en cascade |

Les nouvelles migrations s'ajoutent à la suite (jamais de modification d'une migration déjà
appliquée en production) et viennent avec leurs tests dans `supabase/tests/`.

## Mise en production : liste de contrôle

1. Projet Supabase de **production** créé, migrations appliquées, Google activé (étapes ci-dessus).
2. Variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` créées dans les *variables* du dépôt
   GitHub (pas dans les secrets : ce sont des valeurs publiques).
3. *Site URL* et *Redirect URLs* de Supabase = adresse GitHub Pages (avec le sous-dossier du dépôt).
4. Pousser sur `main` : `deploy.yml` construit le site avec ces valeurs.
5. Essayer : connexion Google, une partie jusqu'au bout (« ✓ Enregistrée »), page Historique, page
   Profil, déconnexion, puis suppression d'un compte de test.
6. Vérifier dans Supabase (Table editor, Authentication) que la partie existe, puis que la
   suppression du compte a bien tout effacé.

## Politique de sécurité du contenu

Le build ajoute une balise `Content-Security-Policy` (voir `vite.config.ts`) : scripts du site
seulement, requêtes sortantes limitées à `VITE_SUPABASE_URL`, avatars Google en https. Si le projet
Supabase change d'adresse, il faut reconstruire le site (la politique est calculée au build).

## Tests de la sécurité par ligne

`supabase/tests/` contient des tests SQL qui s'exécutent sur un Postgres vide (la CI en lance un).
Ils simulent deux utilisateurs et vérifient qu'aucun ne lit, ne modifie ni ne supprime les parties
de l'autre. En local, avec un Postgres :

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run test:db
```
