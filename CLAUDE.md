# Orapa Training

Site web d'entraînement au jeu de société **Orapa Mine** (Sébastien Pauchon).
Le site génère une « mine » aléatoire (grille de gemmes cachées) et le joueur doit
la reconstituer par déduction, en tirant des lasers, en prenant des notes et en
plaçant ses propres gemmes, puis en soumettant sa solution.

> Statut : le dépôt est vide, ce fichier est la spécification de départ.
> Les règles du jeu ci-dessous viennent des règles officielles telles que
> reprises par des sources publiques (voir « Sources des règles »). Ce qui reste
> **(à valider)** n'est pas couvert par ces sources, en particulier la **forme
> exacte des gemmes**, qu'on ne trouve que sur les schémas du livret physique.

## Objectif produit

Permettre de s'entraîner seul·e à Orapa Mine, partie après partie :

1. Une grille **générée aléatoirement** contient des gemmes cachées au joueur.
2. Le joueur peut :
   - **Tirer des lasers** depuis les bords de la grille et observer le résultat
     (sortie du rayon, couleur obtenue, absorption éventuelle) ;
   - **Dessiner / annoter** sur une grille de notes pour poser ses hypothèses ;
   - **Déplacer des gemmes** sur sa propre grille de solution (glisser-déposer,
     rotation, éventuellement retournement) ;
   - **Soumettre** sa solution et obtenir la correction.
3. À la soumission : verdict (correct / incorrect), nombre de lasers utilisés,
   temps écoulé, et révélation de la vraie grille. Un bouton « nouvelle partie »
   relance une génération.

Hors périmètre pour l'instant : compte utilisateur, multijoueur en ligne,
backend. Le site est **100 % statique, côté client**.

## Concepts et vocabulaire

- **Grille / mine** : grille de **10 colonnes × 8 lignes**. Garder
  largeur/hauteur en constantes, pas en dur.
- **Gemme** : pièce polygonale dont chaque coin est aligné sur un coin de la
  grille, posée droite (jamais « de travers »). Une gemme a une forme, une
  couleur et une orientation. **Les formes exactes sont à valider** (voir
  « Questions ouvertes ») : les décrire comme des données, pas dans le code.
- **Jeu de gemmes** : 7 pièces par jeu. Partie de base : **5 gemmes = 1 rouge,
  1 jaune, 1 bleue, 2 blanches**. Variantes optionnelles : le **Diamant**
  (gemme transparente) et le **Corps noir** (gemme noire, absorbe le rayon).
- **Points d'entrée** : 36 au total, repérés **1 à 18** et **A à R** sur le bord
  (10 + 8 de chaque côté). Quels bords portent les chiffres ou les lettres, et
  dans quel sens, est à valider : on peut définir notre propre convention tant
  qu'elle est cohérente.
- **Laser** : rayon envoyé depuis un point d'entrée, droit, **uniquement
  horizontal ou vertical**.
- **Résultat d'un tir** : point de sortie sur le bord et couleur finale du rayon,
  ou « le signal a été absorbé » (Corps noir).
- **Sonder une case** : seconde action officielle, « Qu'y a-t-il en E4 ? »,
  réponse « Rien » ou « Une gemme <couleur> ». Elle coûte un tour comme un tir.
- **Mine cachée** vs **grille joueur** : deux états distincts, jamais mélangés
  dans le même objet pour éviter toute fuite d'information dans l'UI.

## Règles de propagation du laser

À implémenter dans un module pur, sans dépendance au DOM.

**Officiel (sources publiques) :**

- Le rayon est **transparent au départ**. Il file en ligne droite, horizontale ou
  verticale, jusqu'à toucher une gemme, **rebondit selon l'angle** de la face
  touchée, et ressort quelque part sur le bord.
- Le rayon se **teinte** au contact des gemmes. Si le rayon touche plusieurs fois
  la même couleur, **seule la première interaction avec cette couleur compte** :
  la couleur finale dépend donc de l'**ensemble des couleurs distinctes**
  touchées, pas de leur nombre ni de leur ordre.
- Table des couleurs (ensemble des couleurs touchées → couleur annoncée). C'est la
  table complète de Board Game Arena ; le livret en français n'en donne qu'une
  partie et ne la contredit pas, sauf pour bleu + jaune + blanc (voir plus bas) :

  | Couleurs touchées | Résultat |
  |---|---|
  | aucune | transparent |
  | rouge / bleu / jaune / blanc (seule) | rouge / bleu / jaune / blanc |
  | rouge + jaune | orange |
  | rouge + bleu | violet |
  | bleu + jaune | vert |
  | rouge + blanc | rose |
  | jaune + blanc | jaune clair (citron) |
  | bleu + blanc | bleu clair (bleu ciel) |
  | rouge + bleu + blanc | violet clair |
  | rouge + bleu + jaune | noir |
  | bleu + jaune + blanc | vert clair |
  | rouge + jaune + blanc | orange clair |
  | rouge + bleu + jaune + blanc | gris |

  Le livret français note « bleu + jaune + blanc = vert » alors que BGA et
  RulesPal disent « vert clair » (et « vert » pour bleu + jaune seul). On retient
  **vert clair**, plus cohérent avec le reste de la table.
- **Diamant** (optionnel) : fait rebondir le rayon comme les autres gemmes mais
  **ne change pas sa couleur**. Si le rayon touche aussi d'autres gemmes, la
  couleur ne dépend que de celles-ci.
- **Corps noir** (optionnel) : absorbe le rayon. Pas de point de sortie, pas de
  couleur : on annonce « Le signal a été absorbé ».

**À valider (non précisé par les sources) :**

- Géométrie exacte du rebond sur chaque forme (angles, face perpendiculaire qui
  renvoie le rayon vers son entrée, etc.). Hypothèse de travail : le rayon est
  **réfléchi** par la face touchée et ne traverse pas la gemme.
- Cas limites : rayon qui frappe un sommet exactement, boucles éventuelles,
  rayon qui ressort par son point d'entrée.

Toute règle tranchée doit être reportée ici **et** couverte par un test.

## Génération aléatoire

- Utiliser un **PRNG à graine** (ex. mulberry32) plutôt que `Math.random()` :
  chaque partie a une graine affichée/partageable (`?seed=...`) pour rejouer ou
  comparer une même mine.
- **Placement officiel des gemmes** (« règles d'or ») :
  - chaque gemme est posée droite, **chaque coin aligné sur un coin de la
    grille** ;
  - une gemme peut **toucher les bords** du plateau mais **pas dépasser** ;
  - **pas de chevauchement**, et deux gemmes ne peuvent pas se toucher
    « côte à côte » : seul un contact par un **coin** est permis. Le livret
    français est ambigu (« uniquement par un coin ou une arête ») ; RulesPal dit
    que les bords de deux pièces ne peuvent pas se toucher directement et que
    seuls les coins peuvent se rejoindre. **À valider** : on retient d'abord
    « contact par un coin seulement, jamais de côté partagé » ;
  - partie de base : tirer 5 gemmes (1 rouge, 1 jaune, 1 bleue, 2 blanches) parmi
    le jeu de 7, avec Diamant / Corps noir en options.
  Rejeter et retirer en cas d'échec (backtracking simple ou re-tirage complet).
- **Contrainte de visibilité (règle de ce projet, plus stricte que le livret)** :
  chaque gemme doit être **directement atteignable par au moins un laser envoyé
  depuis un bord**. Concrètement, il existe un point d'entrée dont le rayon,
  allant tout droit sans aucun rebond préalable, touche cette gemme comme
  **première** gemme rencontrée. Une gemme qui n'est atteinte qu'après un rebond
  sur une autre gemme ne compte pas. Une mine qui viole cette règle est rejetée
  et regénérée. (Le livret dit seulement : « aucune gemme ne doit être
  entièrement masquée par une autre depuis un bord du plateau » ; notre règle
  l'implique.)
- **Contrainte d'unicité** : la mine doit être la **seule** configuration possible
  (avec l'ensemble de gemmes donné) qui produit les résultats de l'ensemble des
  tirs possibles. Pour cela, après génération :
  1. calculer la « signature » de la mine = résultat du tir depuis **chaque**
     entrée de bord ;
  2. chercher par backtracking, avec élagage sur la signature, toutes les
     configurations valides qui reproduisent exactement cette signature ;
  3. n'accepter la mine que si la seule solution trouvée est elle-même ; sinon,
     rejeter et retirer.
  La contrainte de visibilité est une condition nécessaire de l'unicité (une gemme
  invisible rendrait la solution ambiguë) : elle sert de filtre rapide avant le
  solveur, plus coûteux.
- Le solveur d'unicité vit dans `game/` (ex. `solve.ts`) et doit rester assez
  rapide pour une génération interactive (viser < 1 s ; sinon, le lancer dans un
  Web Worker).
- Option de difficulté (plus tard) : nombre de gemmes, présence de la gemme noire,
  limite de lasers.
- Vérifier par un test, sur de nombreuses graines, que toute mine générée est
  valide (aucun chevauchement, tout dans la grille), visible et unique.

## Interface

Page unique, adaptée desktop **et** mobile/tactile (glisser-déposer au pointeur,
pas seulement à la souris).

Zones :

1. **Grille de tir** : les cases de bord sont cliquables pour tirer un laser. Le
   chemin du rayon est tracé sur la grille ; le point de sortie est marqué de la
   couleur obtenue. Historique des tirs (numéroté) consultable et effaçable à
   l'affichage (mais le **compteur de tirs** ne baisse jamais).
2. **Grille de notes / dessin** : calque libre pour annoter les cases (couleur,
   croix « vide », crayon, gomme, annuler/rétablir). N'a aucun effet sur la
   correction.
3. **Grille de solution** : le joueur y dépose les gemmes de sa réserve (les mêmes
   que celles cachées), les déplace, les fait pivoter. Les placements invalides
   (chevauchement, hors grille) sont refusés ou signalés.
4. **Barre d'actions** : Nouvelle partie, Soumettre, Abandonner/Révéler, compteur
   de lasers, chronomètre.

Il est acceptable que ces zones soient des calques d'une même grille ou des
onglets/panneaux côte à côte ; le choix est à faire à l'implémentation, mais la
**simulation du laser doit pouvoir être affichée sur la grille de solution** du
joueur (outil de vérification d'hypothèse : « mon placement produirait-il bien
ce résultat ? »).

## Soumission et correction

- Comparaison exacte des gemmes (type, couleur, position, orientation) entre la
  grille joueur et la mine cachée.
- **Une seule réponse valable.** Le générateur garantit que la mine est la seule
  configuration compatible avec l'ensemble des tirs possibles (voir « Génération
  aléatoire »). La correction est donc une **égalité stricte** : il n'y a ni
  équivalence par tirs ni tolérance. Si le joueur se trompe, c'est qu'il n'a pas
  tiré assez de lasers pour lever l'ambiguïté : c'est le cœur de l'entraînement.
- Pas besoin de comparer des signatures à la soumission ; le simulateur sert
  seulement au tir et à l'outil de vérification d'hypothèse du joueur.
- Après soumission : afficher les différences (gemmes manquantes / mal placées /
  en trop) et la vraie mine.

## Sources des règles

- Règles d'Orapa Mine (livret en français, repris par regles-du-jeu.net) :
  https://www.regles-du-jeu.net/?p=10051
- Résumé du livret en anglais : https://rulespal.com/orapa-mine/rulebook
- Adaptation Board Game Arena, avec la table complète des couleurs :
  https://en.doc.boardgamearena.com/Gamehelporapamine
  (attention : BGA tire la disposition au hasard et ajoute ses propres règles,
  par exemple « deux gemmes blanches ne peuvent pas être parfaitement
  symétriques » ; ce n'est pas une règle du jeu physique.)

Ces sources ne contiennent **pas** le dessin des gemmes. En cas de désaccord entre
elles, noter la décision prise dans la section concernée.

## Stack et conventions

Recommandation (modifiable tant que rien n'est codé) :

- **TypeScript + Vite**, sans backend. Rendu en **SVG** (ou canvas si les
  performances l'exigent) ; framework léger optionnel (Preact/Svelte) ou DOM direct.
- Tests unitaires avec **Vitest**.
- Déploiement statique (GitHub Pages ou équivalent).
- Interface et textes en **français** (prévoir une table de chaînes pour une
  éventuelle internationalisation).

Architecture :

```
src/
  game/        # logique pure, sans DOM, entièrement testable
    board.ts       # dimensions, coordonnées, collisions
    gems.ts        # définitions des formes/couleurs, rotation, miroir
    laser.ts       # propagation et mélange de couleurs
    generate.ts    # génération aléatoire à graine
    verify.ts      # correction de la soumission
    rng.ts         # PRNG à graine
  ui/          # composants, interactions pointeur, rendu SVG
  main.ts
tests/
```

Règles :

- **Séparer strictement `game/` (logique) et `ui/` (affichage).** `game/` n'importe
  jamais le DOM ; c'est ce qui rend les règles testables.
- Les gemmes sont décrites comme **données** (polygones sur une grille de cases),
  pas comme des cas spéciaux dans le code.
- Ne jamais exposer la mine cachée à l'UI avant la soumission/révélation, hormis
  via la fonction de tir.
- Garder les dimensions, couleurs et ensemble de gemmes configurables en un seul
  endroit.

## Commandes (à compléter après initialisation du projet)

```
npm install        # dépendances
npm run dev        # serveur de développement
npm test           # tests Vitest
npm run build      # build statique
```

## Feuille de route suggérée

1. Modèle de données : grille, gemmes, orientations, collisions + tests.
2. Simulateur de laser (règles ci-dessus, validées) + tests sur cas connus.
3. Générateur à graine + tests de validité.
4. UI : grille, tirs de lasers, affichage des chemins.
5. UI : réserve de gemmes, glisser-déposer, rotation sur la grille solution.
6. UI : calque de notes/dessin.
7. Soumission, correction, écran de résultat.
8. Finitions : mobile, difficulté, graine partageable, chronomètre.

## Questions ouvertes

- **Formes exactes des 7 gemmes** (géométrie sur la grille) et règles de rebond
  détaillées : aucune source texte ne les donne. Il faut le schéma du livret ou
  des photos du matériel ; à fournir avant d'écrire `gems.ts` et `laser.ts`.
- Convention de numérotation des 36 points d'entrée (1–18, A–R) : quels côtés,
  quel sens.
- Soumission en entraînement : une seule tentative (comme le jeu officiel, une
  erreur = défaite) ou plusieurs essais ?
- Proposer l'action « sonder une case » (« Qu'y a-t-il en E4 ? ») et la compter
  comme un tir dans le score ?
- Coût du solveur d'unicité à la génération : à mesurer une fois le simulateur
  écrit (Web Worker ou précalcul de mines si trop lent).
- Limite de lasers imposée, ou simple compteur indicatif ?
- Faut-il un mode « tutoriel » expliquant les effets de chaque gemme ?
