# Orapa Training

Site web d'entraînement au jeu de société **Orapa Mine** (Junghee Choi et Wanjin Gill,
Gameology ; édition française Miraludo). Le site génère une « mine » aléatoire (grille de
gemmes cachées) et le joueur doit la reconstituer par déduction, en tirant des lasers, en
prenant des notes et en plaçant ses propres gemmes, puis en soumettant sa solution.

> Statut : **v1 livrée (v1.0.0)**. Les étapes v0.1 à v0.11 sont terminées : jeu complet de la
> partie de base, sauvegarde locale, page Règles. Prochaine étape : v1.1 (choix du backend de la
> v2). `CLAUDE.md` et `docs/` sont la spécification.

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
- **v3** : le joueur **crée son plateau** (cache ses gemmes) et **joue contre une IA** qui cherche le
  sien pendant qu'il cherche celui de l'IA (fini le simple entraînement).
- **v4** : **duel en direct** contre un autre joueur (arbitre serveur qui répond aux lasers sans
  révéler les plateaux).

## Les points des règles à ne pas rater

Résumé ; le détail et les tableaux sont dans `docs/regles.md`.

- Grille **10 colonnes × 8 lignes** ; case = lettre de ligne A–H + numéro de colonne 1–10
  (« E4 »). 36 points d'entrée : **1–10** en haut, **11–18** à droite, **I–R** en bas,
  **A–H** à gauche.
- Partie de base : **5 gemmes** (1 rouge, 1 jaune, 1 bleue, 2 blanches) parmi un jeu de 7 ;
  Diamant et Corps noir (« diamant noir ») en extensions, au choix au début de chaque partie
  (`?ext=d|n|dn`) ; le Corps noir absorbe le rayon : affichage rouge « signal perdu » (wifi barré).
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

**Texte minimal.** Le joueur ne doit lire presque rien : libellés courts (« Soumettre », « Retirer »),
pas de paragraphe d'aide ni de phrase d'explication dans le jeu, symboles et schémas plutôt que
des phrases. Les explications vivent dans la page « Règles », elle-même concise. Tous les textes
sont dans `src/ui/strings.ts` ; les messages de règle (`game/placement.ts`) tiennent en une ligne.
Les étiquettes d'accessibilité (`aria-label`, texte pour lecteurs d'écran) restent complètes.

**Gemmes.** Elles portent le **quadrillage des vraies pièces** : les lignes de la grille qui les traversent, un peu plus foncées que la gemme, pour aider à les aligner (`gridSegments` dans `game/geometry.ts`, `gemPolygons` dans `ui/palette.ts`).

La **version du build** (`vX.Y.Z`, issue de `package.json`) s'affiche en petit en haut à droite : l'incrémenter à chaque livraison.

Zones :

1. **Grille de tir** : les repères de bord sont cliquables pour tirer un laser, et **toucher une case la sonde**. Chaque tir ou sonde demande une confirmation en modale (« Laser en E ? », « Sonder E4 ? »), désactivable pour la partie ; redemander ce qui est déjà connu est gratuit. Le numéro du tir figure sur le repère d'entrée (en haut à droite) et, dans une pastille de la couleur obtenue (en bas à droite), sur le repère de sortie ; ces pastilles restent visibles en mode notes. **Le chemin du rayon n'est jamais tracé**
   (il trahirait les gemmes) ; il ne l'est que sur la grille de solution du joueur. Historique des tirs (numéroté) consultable et effaçable à
   l'affichage (mais le **compteur de tirs** ne baisse jamais). Les **gemmes posées** par le joueur et ses **notes** s'y affichent en **transparence** sous les repères ; une case à cocher « Notes » masque ou affiche les notes (les gemmes restent affichées).
2. **Grille de notes / dessin** : les gemmes posées y sont affichées en transparence comme sur l'onglet Tirs ; calque libre pour annoter les cases (couleur,
   **vide (stries diagonales grises transparentes)**, doute, crayon, gomme, annuler/rétablir). N'a aucun effet sur la
   correction.
3. **Grille de solution** (onglet « Gemmes ») : le joueur y dépose les gemmes de sa réserve (les mêmes
   que celles cachées) et les déplace ; la gemme sélectionnée porte un **bouton rond ↻ (pivoter)** à son coin
   haut-droit, et la rouge un bouton **⇋ (retourner)** ; pas de barre de boutons en bas. Les notes s'y affichent en transparence (même case « Notes »). Les placements invalides (chevauchement, hors grille, contact
   par un segment) sont refusés ou signalés avec la règle enfreinte.
4. **Résultat** (fin de partie) : la vraie mine et la proposition ; les 36 repères restent cliquables pour tirer des lasers libres dans la mine révélée (trajet tracé, hors compteur).
5. **Plein écran (téléphone, paysage)** : un seul plateau (`ui/immersiveBoard.ts`) avec réserve de gemmes à droite et colonne d'outils ; l'outil « Jouer » tire (repères), sonde (cases) et déplace les gemmes, les autres outils dessinent (les repères restent cliquables).
6. **Barre d'actions** : Nouvelle partie, Soumettre, Abandonner/Révéler, compteur
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
- Fin de partie officielle : à deux joueurs, une proposition fausse fait perdre
  immédiatement. En entraînement, **une seule proposition** (`MAX_ATTEMPTS = 1` dans
  `game/session.ts`) ; la constante permet un mode plus indulgent.
- Après soumission : afficher les différences (gemmes manquantes / mal placées /
  en trop) et la vraie mine.

## Stack et conventions

Choix techniques :

- **TypeScript + Vite**, rendu en **SVG** (ou canvas si les performances l'exigent) ;
  framework léger optionnel (Preact/Svelte) ou DOM direct.
- Tests unitaires avec **Vitest**.
- v1 : déploiement statique (GitHub Pages ou équivalent), aucun backend.
- v2 : backend géré (Supabase recommandé, voir `docs/roadmap.md`) ; le front reste statique.
- Interface et textes en **français** (prévoir une table de chaînes pour une
  éventuelle internationalisation).

Architecture (les fichiers marqués ✔ existent) :

```
src/
  game/        # logique pure, sans DOM, entièrement testable
    constants.ts   # ✔ dimensions de la grille
    geometry.ts    # ✔ polygones convexes entiers, relation apart/point/segment/overlap
    board.ts       # ✔ cases, 36 points d'entrée/sortie, directions
    colors.ts      # ✔ couleurs des gemmes, table de mélange du rayon
    gems.ts        # ✔ formes en données ; rotation, retournement (rouge seule), poses
    placement.ts   # ✔ règles de placement a à d, recouvrement, doublons
    laser.ts       # ✔ propagation du rayon, shoot / shootAll
    visibility.ts  # ✔ règle e : gemmes atteignables en ligne droite
    examples.ts    # ✔ disposition du schéma du livret (tests et banc d'essai)
    rng.ts         # ✔ PRNG à graine
    generate.ts    # ✔ génération aléatoire à graine, version du générateur
    solve.ts       # ✔ solveur d'unicité guidé par les rayons
    session.ts     # ✔ partie en cours : mine privée, tirs, sondes, soumission ; seule porte d'entrée de l'UI
    verify.ts      # ✔ correction par égalité stricte, détail gemme par gemme
    probe.ts       # ✔ « Qu'y a-t-il en E4 ? »
    save.ts        # ✔ format de la sauvegarde locale et validation stricte
    notes.ts       # ✔ notes : marques de cases, traits, gomme, annuler / rétablir
    solution.ts    # ✔ solution du joueur : poser, pivoter, retourner la rouge, règles, comparaison aux tirs
  ui/          # composants, interactions pointeur, rendu SVG
    app.ts         # ✔ état de l'application, partie, historique des tirs
    board.ts       # ✔ grille SVG, repères du bord, marques des tirs
    solutionBoard.ts # ✔ grille de solution et réserve de gemmes
    notesBoard.ts  # ✔ calque de notes et ses outils
    resultBoard.ts # ✔ écran de résultat : vraie mine et proposition
    storage.ts     # ✔ accès protégé au localStorage
    rules.ts       # ✔ page « Règles » (schémas tirés des données du jeu)
    strings.ts     # ✔ table de chaînes de l'interface
    palette.ts     # ✔ couleurs d'affichage des gemmes et des rayons
  main.ts
tests/         # Vitest ; helpers.ts fournit `place`, un PRNG et des dispositions aléatoires valides
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

## Commandes

```
npm install          # dépendances
npm run dev          # serveur de développement (http://localhost:5173, joignable sur le réseau local)
npm test             # tests Vitest
npm run lint         # ESLint
npm run format       # Prettier (format:check pour vérifier seulement)
npm run typecheck    # TypeScript sans émission
npm run build        # contrôle des types + build statique dans dist/
npm run preview      # sert dist/ comme en production
```

La CI (`.github/workflows/ci.yml`) lance lint, format, typecheck, tests et build à chaque
push. Le déploiement (`deploy.yml`) publie `dist/` sur GitHub Pages à chaque push sur `main`.

### Tester sur téléphone

- **Localement :** `npm run dev` écoute sur toutes les interfaces ; ouvrir l'adresse
  « Network » affichée, depuis un téléphone sur le même réseau Wi-Fi.
- **Depuis le cloud :** le serveur de développement tourne dans le conteneur de la session
  et son port n'est pas public. L'application Claude peut l'afficher (la session signale le
  port 5173) ; sinon, passer par GitHub Pages.
- **URL publique :** GitHub Pages, après avoir fusionné sur `main` et activé Pages
  (Settings → Pages → Source : « GitHub Actions »).

## Feuille de route

Résumé ; détail, tailles et critères de fin d'étape dans
[`docs/roadmap.md`](docs/roadmap.md). Une étape porte le numéro de la version qu'elle
prépare : v0.1 à v0.11 construisent la **v1**, v1.1 à v1.6 la **v2**, v2.1 à v2.7 la **v3**,
v3.1 à v3.7 la **v4**.

**Vers la v1 : jeu complet + sauvegarde locale**

- v0.1 Socle (Vite, TS, Vitest, CI, déploiement) : **fait**.
- v0.2 Modèle de données et géométrie, règles de placement a à d : **fait**.
- v0.3 Simulateur de laser (tests : exemples du livret) : **fait**.
- v0.4 Visibilité des gemmes (règle e) : **fait**.
- v0.5 Générateur à graine + solveur d'unicité : **fait** (123 ms en moyenne par mine).
- v0.6 UI : grille et tirs : **fait**.
- v0.7 UI : grille de solution (glisser-déposer, rotation, retournement de la rouge) : **fait**.
- v0.8 UI : notes et dessin : **fait**.
- v0.9 Soumission, correction, écran de résultat : **fait**.
- v0.10 Sauvegarde locale de la partie en cours : **fait**.
- v0.11 Page « Règles », accessibilité, mobile : **fait**.

**Vers la v2 : comptes, historique, profil**

- v1.1 Choix du backend. v1.2 Connexion Google. v1.3 Modèle de données et sécurité par
  utilisateur. v1.4 Enregistrement et page Historique. v1.5 Page de profil (moyenne de lasers
  avant victoire, % de victoires). v1.6 Vie privée et exploitation.

**Vers la v3 : plateau personnalisé et duel contre une IA**

- v2.1 Éditeur de plateau. v2.2 Modèle du duel (règles à deux joueurs, cloisonnement). v2.3 IA :
  connaissance du plateau adverse à partir d'informations partielles (**risque de performance**).
  v2.4 IA : stratégie par gain d'information, niveaux. v2.5 Interface du duel. v2.6 Sauvegarde et
  historique. v2.7 Équilibrage.

**Vers la v4 : duel en direct**

- v3.1 Décisions d'architecture. v3.2 Salles et invitations. v3.3 Arbitre serveur (réutilise
  `src/game/`). v3.4 Synchronisation temps réel et tours. v3.5 Robustesse (déconnexions, forfaits).
  v3.6 Interface en direct. v3.7 Sécurité, classement, vie privée.

## Questions ouvertes

- **Dimensions des gemmes** : lues sur les schémas, à confirmer sur les pièces (surtout le
  grand triangle, supposé identique en bleu et en blanc, et le losange blanc). Formes des
  extensions données par le propriétaire : Diamant = demi-losange 2×1 (triangle de base 2,
  hauteur 1) ; Corps noir (« diamant noir ») = base rectangulaire 2×1.
- Contact entre gemmes (règle d) : le livret dit « par un coin ou une ligne ». Confirmer
  qu'un sommet posé contre le milieu d'un côté est permis et qu'un segment partagé ne
  l'est pas.
- ~~Soumission en entraînement~~ : décidé en v0.9, une seule tentative (`MAX_ATTEMPTS`).
- ~~« Sonder une case »~~ : décidé en v0.9, proposée et comptée à part des lasers.
- Une partie abandonnée compte-t-elle comme perdue dans le pourcentage de victoires (v2) ?
  Proposition : oui.
- Limite de lasers imposée, ou simple compteur indicatif ?
- Supabase ou Firebase pour la v2 ?
- Duel (v3) : plateau ambigu permis ? « en même temps » ou tour par tour ? règle de fin (livret ou indulgente) ? Voir `docs/roadmap.md`.
- Coût du solveur d'unicité à la génération : à mesurer une fois le simulateur écrit.
- Faut-il un mode « tutoriel » expliquant les effets de chaque gemme ?
