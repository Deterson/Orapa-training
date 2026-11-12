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
- **Sauvegarde locale** de la partie en cours, reprise à la réouverture.
- **Règles** du jeu dans le site (`#regles`), accessibilité (motifs, clavier, lecteurs d'écran),
  thèmes clair et sombre, mobile.

Pas de compte ni de serveur : tout tourne dans le navigateur. La version 2 ajoutera la connexion
Google, l'historique des parties et un profil (voir [`docs/roadmap.md`](docs/roadmap.md)).

## Développer

```
npm install
npm run dev        # http://localhost:5173
npm test           # tests Vitest
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
- `tests/` : tests Vitest.
- [`docs/regles.md`](docs/regles.md) : les règles du jeu, référence unique.
- [`docs/roadmap.md`](docs/roadmap.md) : le plan et l'état d'avancement.
- [`CLAUDE.md`](CLAUDE.md) : spécification du projet et conventions.

## À confirmer sur les pièces physiques

Les dimensions des gemmes ont été lues sur les schémas du livret. Les extensions du jeu (Diamant,
Corps noir) ne sont pas implémentées : leurs formes sont inconnues.
