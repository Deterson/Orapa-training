# Orapa Training

Site web d'entraînement au jeu de société **Orapa Mine** (Junghee Choi et Wanjin Gill, Gameology ; édition française
Miraludo).
Le site génère une « mine » aléatoire (grille de gemmes cachées) et le joueur doit
la reconstituer par déduction, en tirant des lasers, en prenant des notes et en
plaçant ses propres gemmes, puis en soumettant sa solution.

> Statut : le dépôt est vide, ce fichier est la spécification de départ.
> Les règles ci-dessous viennent du **livret officiel** (édition française
> Miraludo, photographié par le propriétaire du projet), complété par des sources
> publiques pour ce que le livret ne dit pas (voir « Sources des règles »). Les
> formes des gemmes ont été **lues sur les schémas** du livret : elles sont
> marquées **(à valider)** tant qu'on ne les a pas vérifiées sur les pièces.

## Objectif produit

Permettre de s'entraîner seul·e à Orapa Mine, partie après partie :

1. Une grille **générée aléatoirement** contient des gemmes cachées au joueur.
2. Le joueur peut :
   - **Tirer des lasers** depuis les bords de la grille et observer le résultat
     (sortie du rayon, couleur obtenue, absorption éventuelle) ;
   - **Dessiner / annoter** sur une grille de notes pour poser ses hypothèses ;
   - **Déplacer des gemmes** sur sa propre grille de solution (glisser-déposer
     et rotation par quarts de tour ; pas de retournement, voir les règles de
     placement) ;
   - **Soumettre** sa solution et obtenir la correction.
3. À la soumission : verdict (correct / incorrect), nombre de lasers utilisés,
   temps écoulé, et révélation de la vraie grille. Un bouton « nouvelle partie »
   relance une génération.

Hors périmètre pour l'instant : compte utilisateur, multijoueur en ligne,
backend. Le site est **100 % statique, côté client**.

## Concepts et vocabulaire

- **Grille / mine** : grille de **10 colonnes × 8 lignes**. Garder
  largeur/hauteur en constantes, pas en dur.
- **Coordonnées d'une case** : une **lettre A–H** (ligne, de haut en bas) suivie
  d'un **nombre 1–10** (colonne, de gauche à droite). Exemples du livret : « E4 »,
  « B3 ».
- **Points d'entrée** : 36, repérés sur le bord du plateau comme sur le livret.
  Le rayon entre perpendiculairement au bord :

  | Bord | Repères | Sens de numérotation | Direction du rayon |
  |---|---|---|---|
  | haut | 1 à 10 | colonnes, gauche → droite | vers le bas |
  | droite | 11 à 18 | lignes, haut → bas | vers la gauche |
  | bas | I à R | colonnes, gauche → droite | vers le haut |
  | gauche | A à H | lignes, haut → bas | vers la droite |

  Donc le point 15 est la ligne E côté droit, et le point I est la colonne 1
  côté bas. Les points de **sortie** utilisent les mêmes repères.
- **Gemme** : pièce polygonale dont **chaque coin est sur un coin de la grille**
  et dont les lignes visibles suivent la grille (jamais « de travers »). Une
  gemme a une forme, une couleur et une orientation. Les pièces portent leur
  quadrillage sur la face visible et **ne se retournent pas** : les orientations
  possibles sont les **rotations par quarts de tour**, sans miroir.
- **Jeu de gemmes** : 7 pièces par jeu. Partie de base : **5 gemmes = 1 rouge,
  1 jaune, 1 bleue, 2 blanches**. Extensions optionnelles : le **Diamant** (gemme
  transparente) et le **Corps noir** (absorbe le rayon). Soit 5 + 2 = 7.
- **Formes des gemmes (à valider)**, lues sur les schémas du livret. Coordonnées
  en cases, origine en haut à gauche de la boîte englobante, y vers le bas :

  | Gemme | Forme | Sommets | Boîte | Orientations |
  |---|---|---|---|---|
  | Rouge | parallélogramme | (1,0) (3,0) (2,1) (0,1) | 3×1 | 2 (0°, 90°) |
  | Jaune | petit triangle rectangle isocèle (côtés de l'angle droit = 2) | (0,0) (2,0) (0,2) | 2×2 | 4 |
  | Bleue | grand triangle isocèle rectangle (hypoténuse = 4, hauteur = 2) | (0,0) (4,0) (2,2) | 4×2 | 4 |
  | Blanche 1 | losange (carré posé sur la pointe) | (1,0) (2,1) (1,2) (0,1) | 2×2 | 1 |
  | Blanche 2 | grand triangle, même forme que le bleu | (0,0) (4,0) (2,2) | 4×2 | 4 |
  | Diamant (ext.) | transparent ; le pictogramme du livret montre un triangle | ? | ? | ? |
  | Corps noir (ext.) | empreinte rectangulaire, pointe vers le haut | ? (≈ 2×1) | ? | ? |

  Le parallélogramme rouge n'a pas de symétrie miroir : une seule chiralité
  (celle des schémas, penchée vers la droite). Les gemmes de l'extension ne sont
  utiles qu'une fois la partie de base terminée. Décrire les formes comme des
  **données** (liste de sommets), pas dans le code.
- **Laser** : rayon envoyé depuis un point d'entrée, droit, **uniquement
  horizontal ou vertical**.
- **Résultat d'un tir** : point de sortie sur le bord et couleur finale du rayon,
  ou « le signal a été absorbé » (Corps noir).
- **Sonder une case** : seconde action officielle, « Qu'y a-t-il en E4 ? »,
  réponse « Rien » ou « Une gemme blanche », etc. Elle coûte un tour comme un tir.
  Le livret autorise aussi à redemander une réponse déjà donnée sans coût : ici
  l'historique des tirs remplit ce rôle.
- **Mine cachée** vs **grille joueur** : deux états distincts, jamais mélangés
  dans le même objet pour éviter toute fuite d'information dans l'UI.

## Règles de propagation du laser

À implémenter dans un module pur, sans dépendance au DOM.

**Règles du livret officiel :**

- Le rayon est **transparent au départ**. Il file en ligne droite, horizontale ou
  verticale, jusqu'à rencontrer une gemme ; il **se réfléchit dessus selon son
  inclinaison** avant de ressortir de la mine. Il ne traverse jamais une gemme.
- **Géométrie** (déduite des schémas du livret, que les tests doivent reproduire) :
  - le rayon suit le **milieu des lignes et des colonnes** (les centres des cases),
    pas les lignes de la grille ;
  - sur une face **inclinée à 45°**, il tourne de **90°** ;
  - sur une face **perpendiculaire** à sa direction (côté aligné sur la grille
    touché de face), il **repart en sens inverse** ;
  - comme tous les sommets sont sur des coins de la grille et que le rayon est
    sur des demi-cases, **il ne touche jamais un sommet exactement** ;
  - les réflexions sont réversibles : **aucune boucle possible**, le rayon finit
    toujours par sortir, éventuellement par son point d'entrée.
- Exemples du livret (schéma de la page 2) à reprendre comme tests : depuis le
  point **I** le rayon ressort **rouge en I** (face horizontale du parallélogramme
  rouge touchée de face) ; depuis le point **15** il ressort **violet clair en 8**
  (losange blanc, puis parallélogramme rouge, puis grand triangle bleu : blanc +
  rouge + bleu). Relever les positions des gemmes sur le schéma pour monter le test.
- Le rayon se **teinte** au contact des gemmes. Si le rayon touche plusieurs fois
  la même couleur, **seule la première interaction avec cette couleur compte** :
  la couleur finale dépend donc de l'**ensemble des couleurs distinctes**
  touchées, pas de leur nombre ni de leur ordre.
- Table des couleurs (ensemble des couleurs touchées → couleur annoncée). Le
  livret en montre la plupart en schémas (orange, vert, violet, noir, rose, bleu
  clair, jaune clair, vert clair, violet clair, gris) ; seul orange clair vient de
  la table de Board Game Arena :

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

  Le livret confirme **bleu + jaune + blanc = vert clair** (le « vert » du
  résumé de regles-du-jeu.net est une erreur de ce résumé).
- **Diamant** (optionnel) : fait rebondir le rayon comme les autres gemmes mais
  **ne change pas sa couleur**. Si le rayon touche aussi d'autres gemmes, la
  couleur ne dépend que de celles-ci.
- **Corps noir** (optionnel) : absorbe le rayon. Pas de point de sortie, pas de
  couleur : on annonce « Le signal a été absorbé ».

**À valider :**

- Comportement exact sur les gemmes des extensions (Diamant, Corps noir) dont on
  ne connaît pas encore la forme.
- Un rayon qui se réfléchit plusieurs fois sur la même gemme (par exemple dans
  l'angle d'un triangle) ne compte qu'une fois sa couleur, comme toute couleur
  déjà touchée ; c'est la règle générale, à confirmer sur un cas réel.

Toute règle tranchée doit être reportée ici **et** couverte par un test.

## Génération aléatoire

- Utiliser un **PRNG à graine** (ex. mulberry32) plutôt que `Math.random()` :
  chaque partie a une graine affichée/partageable (`?seed=...`) pour rejouer ou
  comparer une même mine.
- **Placement officiel des gemmes** (règles a à e du livret, « Placement ») :
  - **a.** les lignes de la surface des gemmes doivent être visibles : la pièce est
    posée sur sa face quadrillée, **jamais retournée** (rotations seulement) ;
  - **b.** chaque coin de gemme sur un coin de la grille, lignes visibles alignées
    sur la grille : pas de pose « de travers » ;
  - **c.** une gemme peut **toucher le bord** du plateau mais **pas en dépasser** ;
  - **d.** « Deux gemmes ne peuvent pas être placées côte à côte. Elles ne peuvent
    se toucher que par un coin ou une ligne. » Lecture retenue (**à valider**) :
    l'intersection de deux gemmes est **vide ou réduite à un point** (sommet contre
    sommet, ou sommet contre le milieu d'un côté) ; **jamais de segment partagé**,
    et bien sûr pas de chevauchement. C'est ce que montre le schéma d du livret :
    le losange blanc, collé au parallélogramme rouge le long d'un côté, porte une
    croix ; le contact par un coin entre le parallélogramme et le grand triangle
    blanc porte un rond ;
  - **e.** chaque gemme doit être **accessible depuis au moins un bord** du plateau
    (« il doit être possible de tracer une ligne pour l'atteindre »).
  - Partie de base : tirer 5 gemmes (1 rouge, 1 jaune, 1 bleue, 2 blanches) parmi
    le jeu de 7, avec Diamant / Corps noir en options.
  Rejeter et retirer en cas d'échec (backtracking simple ou re-tirage complet).
- **Contrainte de visibilité (règle e)** : chaque gemme doit être **directement
  atteignable par au moins un laser envoyé depuis un bord**. Concrètement, il
  existe un point d'entrée dont le rayon, allant tout droit sans aucun rebond
  préalable, touche cette gemme comme **première** gemme rencontrée. Une gemme qui
  n'est atteinte qu'après un rebond sur une autre ne compte pas. Une mine qui
  viole cette règle est rejetée et regénérée.
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
- Règles officielles de fin de partie, pour mémoire : à deux joueurs, une
  proposition fausse fait **perdre immédiatement** ; à 3 joueurs ou plus, on a
  **deux chances**. En entraînement le choix est ouvert (voir « Questions
  ouvertes »).
- Après soumission : afficher les différences (gemmes manquantes / mal placées /
  en trop) et la vraie mine.

## Sources des règles

- **Livret officiel** (édition française Miraludo, 2024) : source de référence,
  photographiée par le propriétaire du projet. En cas de désaccord, c'est lui qui
  l'emporte sur tout le reste.
- Résumé du livret en français : https://www.regles-du-jeu.net/?p=10051
  (approximatif : sa phrase sur le contact entre gemmes est contradictoire et son
  tableau des couleurs est incomplet.)
- Résumé du livret en anglais : https://rulespal.com/orapa-mine/rulebook
- Adaptation Board Game Arena, avec la table complète des couleurs :
  https://en.doc.boardgamearena.com/Gamehelporapamine
  (attention : BGA tire la disposition au hasard et ajoute ses propres règles,
  par exemple « deux gemmes blanches ne peuvent pas être parfaitement
  symétriques » ; ce n'est pas une règle du jeu physique.)

Les dimensions des gemmes ne sont données que par les schémas du livret, pas par
du texte. En cas de désaccord entre sources, noter la décision prise dans la
section concernée.

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
    gems.ts        # définitions des formes/couleurs, rotation (pas de miroir)
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

- **Dimensions des gemmes** : lues sur les schémas, à confirmer sur les pièces
  (surtout le grand triangle, supposé identique en bleu et en blanc, et le
  losange blanc). Formes du Diamant et du Corps noir encore inconnues.
- Contact entre gemmes (règle d) : le livret dit « par un coin ou une ligne ».
  Confirmer qu'un sommet posé contre le milieu d'un côté est permis et qu'un
  segment partagé ne l'est pas.
- Soumission en entraînement : une seule tentative (comme le jeu officiel, une
  erreur = défaite) ou plusieurs essais ?
- Proposer l'action « sonder une case » (« Qu'y a-t-il en E4 ? ») et la compter
  comme un tir dans le score ?
- Coût du solveur d'unicité à la génération : à mesurer une fois le simulateur
  écrit (Web Worker ou précalcul de mines si trop lent).
- Limite de lasers imposée, ou simple compteur indicatif ?
- Faut-il un mode « tutoriel » expliquant les effets de chaque gemme ?
