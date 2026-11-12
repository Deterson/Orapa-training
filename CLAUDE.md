# Orapa Training

Site web d'entraînement au jeu de société **Orapa Mine** (Junghee Choi et Wanjin Gill,
Gameology ; édition française Miraludo). Le site génère une « mine » aléatoire (grille de
gemmes cachées) et le joueur doit la reconstituer par déduction, en tirant des lasers, en
prenant des notes et en plaçant ses propres gemmes, puis en soumettant sa solution.

> Statut : le dépôt ne contient pas encore de code. `CLAUDE.md` et `docs/` sont la
> spécification de départ.

## Documentation (`docs/`)

- [`docs/regles.md`](docs/regles.md) : **les règles du jeu**, référence unique (grille,
  numérotation des entrées, formes des gemmes, placement, trajet et couleurs du rayon,
  extensions, fin de partie). **À lire avant de toucher à `src/game/`.** En cas de
  désaccord entre le code et ce fichier, c'est ce fichier qui a raison ; si une règle
  change, la corriger là **et** dans les tests.
- [`docs/roadmap.md`](docs/roadmap.md) : le plan de réalisation en deux versions (v1 jeu
  complet avec sauvegarde locale, v2 comptes Google + historique + profil).

Ne pas dupliquer les règles dans ce fichier : y renvoyer.

## Objectif produit

Permettre de s'entraîner seul·e à Orapa Mine, partie après partie :

1. Une grille **générée aléatoirement** contient des gemmes cachées au joueur.
2. Le joueur peut :
   - **Tirer des lasers** depuis les bords de la grille et observer le résultat
     (sortie du rayon, couleur obtenue, absorption éventuelle) ;
   - **Dessiner / annoter** sur une grille de notes pour poser ses hypothèses ;
   - **Déplacer des gemmes** sur sa propre grille de solution (glisser-déposer,
     rotation par quarts de tour, **retournement pour la gemme rouge uniquement**) ;
   - **Soumettre** sa solution et obtenir la correction.
3. À la soumission : verdict (correct / incorrect), nombre de lasers utilisés,
   temps écoulé, et révélation de la vraie grille. Un bouton « nouvelle partie »
   relance une génération.

Périmètre par version (détail dans `docs/roadmap.md`) :

- **v1** : toutes les règles, 100 % statique côté client, avec une **sauvegarde locale**
  de la partie en cours pour la reprendre plus tard dans le même navigateur. Pas de
  compte, pas de serveur.
- **v2** : connexion **Google (OAuth)**, **historique** des parties, **page de profil**
  (moyenne de lasers tirés avant de gagner, pourcentage de parties gagnées). Demande un
  backend ; le jeu reste jouable sans compte.

## Les points des règles à ne pas rater

Résumé ; le détail et les tableaux sont dans `docs/regles.md`.

- Grille **10 colonnes × 8 lignes** ; case = lettre de ligne A–H + numéro de colonne 1–10
  (« E4 »). 36 points d'entrée : **1–10** en haut, **11–18** à droite, **I–R** en bas,
  **A–H** à gauche.
- Partie de base : **5 gemmes** (1 rouge, 1 jaune, 1 bleue, 2 blanches) parmi un jeu de 7 ;
  Diamant et Corps noir en extensions.
- **La gemme rouge peut être retournée** (quadrillage foncé sur ses deux faces, seule pièce
  dans ce cas) ; les autres gemmes ne se retournent jamais. À signaler dans la page
  « Règles » du site.
- Le rayon va tout droit, suit le milieu des cases, tourne de 90° sur une face à 45°,
  repart en sens inverse sur une face perpendiculaire, ne traverse jamais une gemme.
- La couleur finale dépend de l'**ensemble des couleurs distinctes** touchées.

## Génération aléatoire

- Utiliser un **PRNG à graine** (ex. mulberry32) plutôt que `Math.random()` :
  chaque partie a une graine affichée/partageable (`?seed=...`) pour rejouer ou
  comparer une même mine. **Versionner le générateur** : une même graine doit toujours
  redonner la même mine pour une version donnée, et la sauvegarde stocke la mine elle-même.
- **Placement** : respecter les règles a à e de `docs/regles.md` (alignement sur la grille,
  pas de dépassement, pas de segment partagé entre gemmes, face quadrillée visible,
  accessibilité depuis un bord). Orientations autorisées : rotations pour toutes les
  gemmes, plus le retournement pour la rouge. Rejeter et retirer en cas d'échec
  (backtracking simple ou re-tirage complet).
- **Contrainte de visibilité (règle e)** : chaque gemme doit être **directement
  atteignable par au moins un laser envoyé depuis un bord**, c'est-à-dire qu'il existe un
  point d'entrée dont le rayon, allant tout droit sans aucun rebond préalable, touche cette
  gemme comme **première** gemme rencontrée. Une mine qui viole cette règle est rejetée.
- **Contrainte d'unicité** : la mine doit être la **seule** configuration possible
  (avec l'ensemble de gemmes donné, rouge retournée ou non) qui produit les résultats de
  l'ensemble des tirs possibles. Après génération :
  1. calculer la « signature » de la mine = résultat du tir depuis **chaque** entrée ;
  2. chercher par backtracking, avec élagage sur la signature, toutes les configurations
     valides qui reproduisent exactement cette signature ;
  3. n'accepter la mine que si la seule solution trouvée est elle-même ; sinon, rejeter
     et retirer.
  La visibilité est une condition nécessaire de l'unicité (une gemme invisible rendrait la
  solution ambiguë) : elle sert de filtre rapide avant le solveur, plus coûteux.
- Le solveur d'unicité vit dans `game/` (ex. `solve.ts`) et doit rester assez rapide pour
  une génération interactive (viser < 1 s ; sinon, Web Worker, puis banque de mines
  précalculées).
- Option de difficulté (plus tard) : nombre de gemmes, extensions Diamant et Corps noir,
  limite de lasers.
- Vérifier par un test, sur de nombreuses graines, que toute mine générée est valide,
  visible et unique.

## Interface

Page unique, adaptée desktop **et** mobile/tactile (glisser-déposer au pointeur,
pas seulement à la souris).

Zones :

1. **Grille de tir** : les repères de bord sont cliquables pour tirer un laser. Le
   chemin du rayon est tracé sur la grille ; le point de sortie est marqué de la
   couleur obtenue. Historique des tirs (numéroté) consultable et effaçable à
   l'affichage (mais le **compteur de tirs** ne baisse jamais).
2. **Grille de notes / dessin** : calque libre pour annoter les cases (couleur,
   croix « vide », crayon, gomme, annuler/rétablir). N'a aucun effet sur la
   correction.
3. **Grille de solution** : le joueur y dépose les gemmes de sa réserve (les mêmes
   que celles cachées), les déplace, les fait pivoter ; la gemme rouge a en plus un
   bouton « retourner ». Les placements invalides (chevauchement, hors grille, contact
   par un segment) sont refusés ou signalés avec la règle enfreinte.
4. **Barre d'actions** : Nouvelle partie, Soumettre, Abandonner/Révéler, compteur
   de lasers, chronomètre.

Il est acceptable que ces zones soient des calques d'une même grille ou des
onglets/panneaux côte à côte ; le choix est à faire à l'implémentation, mais la
**simulation du laser doit pouvoir être affichée sur la grille de solution** du
joueur (outil de vérification d'hypothèse : « mon placement produirait-il bien
ce résultat ? »).

Une page **« Règles »** du site expose les règles de `docs/regles.md` aux joueurs, y
compris la particularité de la gemme rouge retournable.

## Soumission et correction

- Comparaison exacte des gemmes (type, couleur, position, orientation, face de la rouge)
  entre la grille joueur et la mine cachée.
- **Une seule réponse valable.** Le générateur garantit que la mine est la seule
  configuration compatible avec l'ensemble des tirs possibles. La correction est donc une
  **égalité stricte** : il n'y a ni équivalence par tirs ni tolérance. Si le joueur se
  trompe, c'est qu'il n'a pas tiré assez de lasers pour lever l'ambiguïté : c'est le cœur
  de l'entraînement.
- Pas besoin de comparer des signatures à la soumission ; le simulateur sert seulement au
  tir et à l'outil de vérification d'hypothèse du joueur.
- Fin de partie officielle, pour mémoire : à deux joueurs, une proposition fausse fait
  perdre immédiatement ; à 3 ou plus, on a deux chances. En entraînement le choix est
  ouvert (voir « Questions ouvertes »).
- Après soumission : afficher les différences (gemmes manquantes / mal placées /
  en trop) et la vraie mine.

## Stack et conventions

Recommandation (modifiable tant que rien n'est codé) :

- **TypeScript + Vite**, rendu en **SVG** (ou canvas si les performances l'exigent) ;
  framework léger optionnel (Preact/Svelte) ou DOM direct.
- Tests unitaires avec **Vitest**.
- v1 : déploiement statique (GitHub Pages ou équivalent), aucun backend.
- v2 : backend géré (Supabase recommandé, voir `docs/roadmap.md`) ; le front reste statique.
- Interface et textes en **français** (prévoir une table de chaînes pour une
  éventuelle internationalisation).

Architecture :

```
src/
  game/        # logique pure, sans DOM, entièrement testable
    board.ts       # dimensions, coordonnées, collisions
    gems.ts        # formes/couleurs en données ; rotation, retournement (rouge seule)
    laser.ts       # propagation et mélange de couleurs
    generate.ts    # génération aléatoire à graine
    solve.ts       # solveur d'unicité
    verify.ts      # correction de la soumission
    rng.ts         # PRNG à graine
  ui/          # composants, interactions pointeur, rendu SVG
  main.ts
tests/
docs/          # règles du jeu et roadmap
```

Règles :

- **Séparer strictement `game/` (logique) et `ui/` (affichage).** `game/` n'importe
  jamais le DOM ; c'est ce qui rend les règles testables.
- Les gemmes sont décrites comme **données** (polygones sur une grille de cases),
  pas comme des cas spéciaux dans le code ; « retournable » est une propriété de la
  donnée (vraie pour la rouge seule).
- Ne jamais exposer la mine cachée à l'UI avant la soumission/révélation, hormis
  via la fonction de tir.
- Garder les dimensions, couleurs et ensemble de gemmes configurables en un seul
  endroit.
- Tout accès au stockage du navigateur dans un `try/catch` : le jeu doit fonctionner sans.

## Commandes (à compléter après initialisation du projet)

```
npm install        # dépendances
npm run dev        # serveur de développement
npm test           # tests Vitest
npm run build      # build statique
```

## Feuille de route

Résumé ; détail, tailles et critères de fin d'étape dans
[`docs/roadmap.md`](docs/roadmap.md).

**v1 : jeu complet + sauvegarde locale**

1. Socle (Vite, TS, Vitest, CI, déploiement).
2. Modèle de données et géométrie, règles de placement a à d.
3. Simulateur de laser (tests : exemples du livret).
4. Visibilité des gemmes (règle e).
5. Générateur à graine + solveur d'unicité (**risque de performance : prototyper tôt**).
6. UI : grille et tirs.
7. UI : grille de solution (glisser-déposer, rotation, retournement de la rouge).
8. UI : notes et dessin.
9. Soumission, correction, écran de résultat.
10. Sauvegarde locale de la partie en cours.
11. Page « Règles », accessibilité, mobile.

**v2 : comptes, historique, profil**

1. Choix du backend. 2. Connexion Google. 3. Modèle de données et sécurité par utilisateur.
4. Enregistrement et page Historique. 5. Page de profil (moyenne de lasers avant victoire,
% de victoires). 6. Vie privée et exploitation.

## Questions ouvertes

- **Dimensions des gemmes** : lues sur les schémas, à confirmer sur les pièces (surtout le
  grand triangle, supposé identique en bleu et en blanc, et le losange blanc). Formes du
  Diamant et du Corps noir encore inconnues.
- Contact entre gemmes (règle d) : le livret dit « par un coin ou une ligne ». Confirmer
  qu'un sommet posé contre le milieu d'un côté est permis et qu'un segment partagé ne
  l'est pas.
- Soumission en entraînement : une seule tentative (comme le jeu officiel, une erreur =
  défaite) ou plusieurs essais ?
- « Sonder une case » (« Qu'y a-t-il en E4 ? ») : proposer l'action ? la compter comme un
  tir ? Proposition : la proposer, la compter à part.
- Une partie abandonnée compte-t-elle comme perdue dans le pourcentage de victoires (v2) ?
  Proposition : oui.
- Limite de lasers imposée, ou simple compteur indicatif ?
- Supabase ou Firebase pour la v2 ?
- Coût du solveur d'unicité à la génération : à mesurer une fois le simulateur écrit.
- Faut-il un mode « tutoriel » expliquant les effets de chaque gemme ?
