# Orapa Training

Site d'entraînement au jeu de société **Orapa Mine** (Junghee Choi et Wanjin Gill, Gameology ;
édition française Miraludo).

La machine cache 5 gemmes dans une mine de 10 × 8 cases. Vous tirez des lasers depuis les bords,
lisez le point de sortie et la couleur du rayon, puis reconstituez la mine par déduction.
**Chaque mine n'a qu'une seule solution possible** : si vous vous trompez, c'est que vous n'avez
pas tiré assez de lasers.

**Jouer :** https://deterson.github.io/Orapa-training/

## Ce que fait la version 1

- **Mine aléatoire** à partir d'une graine (`?seed=...`) : même graine, même mine. Chaque mine
  est validée : règles de placement du livret, gemmes toutes atteignables en ligne droite depuis
  un bord, et solution unique (vérifiée par un solveur).
- **Tirs** : 36 repères sur le bord (1–18, A–R), résultat = repère de sortie + couleur.
- **Sonder une case** : « Qu'y a-t-il en E4 ? ».
- **Ma solution** : glisser-déposer des gemmes (souris ou doigt), pivoter, retourner la gemme
  rouge (la seule qui peut l'être), règles vérifiées en direct, et test d'hypothèse : « ma grille
  donnerait-elle les mêmes résultats que les tirs déjà faits ? »
- **Notes** : crayon, marques de cases, gomme, annuler / rétablir.
- **Soumission** : correction stricte, une seule proposition, mine révélée et détail gemme par
  gemme ; chronomètre ; rejeu d'une même mine.
- **Plein écran** pour téléphone en paysage : tirs, sondes, gemmes et dessin sur une seule grille.
- **Sauvegarde locale** de la partie en cours, reprise à la réouverture.
- **Règles** du jeu dans le site (`#regles`), accessibilité (clavier, lecteurs d'écran),
  thèmes clair et sombre, mobile.

Sans configuration, pas de compte ni de serveur : tout tourne dans le navigateur.

## Ce que fait la version 2 (comptes, optionnel)

Une fois le site relié à un projet Supabase ([`docs/backend.md`](docs/backend.md)) :

- **Connexion Google** (facultative : le jeu reste identique sans compte).
- **Historique** (`#historique`) : parties terminées, filtre victoires / défaites, tri, lien pour
  rejouer la même mine ; envoi avec file locale en cas de coupure.
- **Profil** (`#profil`) : nombre de parties, victoires, % de victoires et lasers moyens par
  victoire (une partie abandonnée compte comme perdue).
- **Confidentialité** (`#confidentialite`) : ce qui est gardé, suppression du compte et de ses parties.
- Chaque utilisateur ne voit que ses parties (sécurité par ligne, testée en CI).

Ensuite : la version 3 ajoutera un plateau personnalisé et un duel contre une IA, la version 4 un duel en direct contre un autre joueur (voir [`docs/roadmap.md`](docs/roadmap.md)).

## Développer

```
npm install
npm run dev        # http://localhost:5173
npm test           # tests Vitest
npm run test:db    # tests SQL de la sécurité par ligne (demande un Postgres)
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm run build      # build statique dans dist/
```

La CI lance lint, format, types, tests et build à chaque push ; le déploiement sur GitHub Pages se
fait à chaque push sur `main`.

## Organisation

- `src/game/` : toute la logique du jeu, sans DOM (grille, gemmes, géométrie, laser, génération,
  solveur d'unicité, session, solution, notes, sauvegarde).
- `src/ui/` : l'interface (SVG et DOM).
- `src/backend/` : connexion Google, parties, file d'envoi (Supabase, chargé à la demande).
- `supabase/` : migrations SQL et leurs tests.
- `tests/` : tests Vitest.
- [`docs/regles.md`](docs/regles.md) : les règles du jeu, référence unique.
- [`docs/roadmap.md`](docs/roadmap.md) : le plan et l'état d'avancement.
- [`CLAUDE.md`](CLAUDE.md) : spécification du projet et conventions.

## À confirmer sur les pièces physiques

Les dimensions des gemmes de base ont été lues sur les schémas du livret. Les formes des extensions
(Diamant : demi-losange 2×1 ; diamant noir : rectangle 2×1) viennent du propriétaire du projet.
Elles se choisissent au début de chaque partie.
