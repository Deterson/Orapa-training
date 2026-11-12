# Règles d'Orapa Mine : référence du projet

Orapa Mine est un jeu de Junghee Choi et Wanjin Gill (Gameology), édition française
Miraludo (2024). Ce document est la **référence des règles** pour le site : le code de
`src/game/` et la future page « Règles » du site doivent s'y conformer.

Sources, par ordre d'autorité :

1. le **livret officiel** (édition française Miraludo), photographié par le
   propriétaire du projet ;
2. les **précisions du propriétaire du projet** sur le matériel physique (marquées
   « précision propriétaire ») ;
3. des résumés publics, seulement pour combler un trou :
   [regles-du-jeu.net](https://www.regles-du-jeu.net/?p=10051),
   [RulesPal](https://rulespal.com/orapa-mine/rulebook),
   [Board Game Arena](https://en.doc.boardgamearena.com/Gamehelporapamine).

Légende : ✅ confirmé par le livret ou le propriétaire ; ⚠️ à valider.

## But du jeu

Deviner la position **exacte** de toutes les gemmes cachées dans la mine de
l'adversaire, en envoyant des rayons (« ondes supersoniques ») depuis les bords et en
interprétant leur point de sortie et leur couleur. Le premier à identifier toutes les
gemmes adverses gagne.

## La grille

- ✅ Grille de **10 colonnes × 8 lignes**.
- ✅ **Case** : une lettre **A–H** (ligne, de haut en bas) suivie d'un nombre **1–10**
  (colonne, de gauche à droite). Exemples du livret : « E4 », « B3 ».

### Points d'entrée et de sortie (36)

✅ Repérés sur le bord du plateau. Le rayon entre perpendiculairement au bord.

| Bord | Repères | Numérotation | Direction du rayon |
|---|---|---|---|
| haut | 1 à 10 | colonnes, gauche → droite | vers le bas |
| droite | 11 à 18 | lignes, haut → bas | vers la gauche |
| bas | I à R | colonnes, gauche → droite | vers le haut |
| gauche | A à H | lignes, haut → bas | vers la droite |

Le point **15** est donc la ligne E côté droit, le point **I** la colonne 1 côté bas.
Les points de sortie utilisent les mêmes repères.

## Les gemmes

7 gemmes par jeu. **Partie de base : 5 gemmes = 1 rouge, 1 jaune, 1 bleue,
2 blanches.** Deux extensions ajoutent chacune une gemme : le **Diamant** et le
**Corps noir** (5 + 2 = 7).

Formes **⚠️ lues sur les schémas du livret** (à confirmer sur les pièces). Coordonnées
en cases, origine en haut à gauche de la boîte englobante, y vers le bas :

| Gemme | Forme | Sommets | Boîte | Positions distinctes |
|---|---|---|---|---|
| Rouge | parallélogramme | (1,0) (3,0) (2,1) (0,1) | 3×1 | 4 (2 rotations × 2 faces) |
| Jaune | petit triangle rectangle isocèle (côtés de l'angle droit = 2) | (0,0) (2,0) (0,2) | 2×2 | 4 |
| Bleue | grand triangle isocèle rectangle (hypoténuse = 4, hauteur = 2) | (0,0) (4,0) (2,2) | 4×2 | 4 |
| Blanche 1 | losange (carré posé sur la pointe) | (1,0) (2,1) (1,2) (0,1) | 2×2 | 1 |
| Blanche 2 | grand triangle, même forme que le bleu | (0,0) (4,0) (2,2) | 4×2 | 4 |
| Diamant (ext.) | gemme transparente ; le pictogramme du livret montre un triangle | ? | ? | ? |
| Corps noir (ext.) | empreinte rectangulaire (≈ 2×1), pointe vers le haut | ? | ? | ? |

### Retournement (précision propriétaire)

- ✅ **La gemme rouge peut être retournée** : elle porte un quadrillage foncé sur ses
  **deux** faces. C'est la **seule** pièce dans ce cas. Elle a donc **deux chiralités**
  (parallélogramme penché vers la droite ou vers la gauche) en plus des rotations.
- ✅ Toutes les autres gemmes n'ont leur quadrillage que sur une face : elles se posent
  **face quadrillée visible** et **ne se retournent jamais** (rotations par quarts de
  tour seulement).
- Cette particularité n'est pas dans le livret : **la page « Règles » du site doit la
  signaler** explicitement, et l'interface doit proposer un bouton « retourner »
  pour la gemme rouge uniquement.

## Placement des gemmes

Règles a à e du livret (« Placement »), à respecter par la mine cachée **et** par la
grille de solution du joueur :

- ✅ **a.** Les lignes de la surface des gemmes doivent être visibles (face quadrillée
  vers le haut ; voir « Retournement » pour l'exception de la gemme rouge).
- ✅ **b.** Chaque coin de gemme correspond à un coin de la grille, et les lignes
  visibles s'alignent sur cette grille : pas de pose « de travers ».
- ✅ **c.** Une gemme peut toucher le bord du plateau, pas le dépasser.
- ⚠️ **d.** « Deux gemmes ne peuvent pas être placées côte à côte. Elles ne peuvent se
  toucher que par un coin ou une ligne. » **Lecture retenue :** l'intersection de deux
  gemmes est **vide ou réduite à un point** (sommet contre sommet, ou sommet contre le
  milieu d'un côté) ; **jamais de segment partagé**, et pas de chevauchement. C'est ce que
  montre le schéma d du livret : le losange blanc collé au parallélogramme rouge le long
  d'un côté porte une croix, le contact par un coin entre le parallélogramme et le grand
  triangle blanc porte un rond.
- ✅ **e.** Chaque gemme doit être accessible depuis au moins un bord (« il doit être
  possible de tracer une ligne pour l'atteindre »). **Lecture retenue (précision
  propriétaire) :** il existe un laser qui, parti d'un bord et allant tout droit, sans
  rebond préalable, touche cette gemme.

## Le rayon

- ✅ Le rayon est **transparent au départ**. Il file en ligne droite, horizontale ou
  verticale, jusqu'à rencontrer une gemme, **se réfléchit dessus selon son inclinaison**
  puis ressort de la mine. Il ne traverse jamais une gemme.
- ✅ **Géométrie** (déduite des schémas du livret, à reproduire dans les tests) :
  - le rayon suit le **milieu des lignes et des colonnes** (centres des cases) ;
  - sur une face **inclinée à 45°**, il tourne de **90°** ;
  - sur une face **perpendiculaire** à sa direction (côté aligné sur la grille touché de
    face), il **repart en sens inverse** ;
  - les sommets sont sur des coins de la grille et le rayon sur des demi-cases : il ne
    touche **jamais** un sommet exactement ;
  - les réflexions sont réversibles : **aucune boucle**, le rayon sort toujours,
    éventuellement par son point d'entrée.
- ✅ À chaque tir, le maître du jeu annonce deux choses : **(A)** le point de sortie et
  **(B)** la couleur résultante. Exemples du livret (schéma de la page 2) :
  - depuis **I** : « Le rayon ressort rouge en I » ;
  - depuis **15** : « Le rayon ressort violet clair en 8 ».

### Couleurs

- ✅ Au contact d'une gemme, le rayon prend sa couleur ; plusieurs gemmes **mélangent**
  les couleurs.
- ✅ Si le rayon touche plusieurs fois la même couleur, **seule la première interaction
  avec chaque couleur compte**. La couleur finale ne dépend donc que de l'**ensemble des
  couleurs distinctes** touchées.

| Couleurs touchées | Résultat |
|---|---|
| aucune | transparent |
| rouge / bleu / jaune / blanc (seule) | rouge / bleu / jaune / blanc |
| rouge + jaune | orange |
| rouge + bleu | violet |
| bleu + jaune | vert |
| rouge + blanc | rose |
| jaune + blanc | jaune clair |
| bleu + blanc | bleu clair |
| rouge + bleu + blanc | violet clair |
| rouge + bleu + jaune | noir |
| bleu + jaune + blanc | vert clair |
| rouge + jaune + blanc | orange clair ⚠️ (table BGA, absente des schémas lus) |
| rouge + bleu + jaune + blanc | gris |

## Autre type de question

✅ Au lieu d'un rayon, le prospecteur peut demander « Qu'y a-t-il en E4 ? ». Réponse :
« Rien », « Une gemme blanche », etc. Cela consomme un tour. Le livret autorise aussi à
redemander une réponse déjà donnée sans y consacrer un tour (l'historique des tirs du
site joue ce rôle).

## Extensions

- ✅ **Diamant** : gemme transparente. Elle fait rebondir le rayon comme les autres mais
  **ne modifie pas sa couleur**. Si le rayon touche aussi d'autres gemmes, la couleur ne
  dépend que de celles-ci.
- ✅ **Corps noir** : se place pointe vers le haut sur sa base rectangulaire. Il
  **absorbe** le rayon : ni point de sortie ni couleur ; le maître du jeu annonce « Le
  signal a été absorbé ». Sonder une case du corps noir donne la même réponse.

## Fin de partie

- ✅ Le premier joueur à identifier la position précise de toutes les gemmes adverses
  gagne. Il doit utiliser son tour de prospecteur pour soumettre sa proposition. Tout
  est correct : il gagne. **Erreur : il perd immédiatement.**
- ✅ Si le joueur qui a commencé propose en premier et réussit, l'autre a un dernier tour ;
  s'il réussit aussi, égalité et on rejoue une manche.
- ✅ À **3 joueurs ou plus**, un joueur est maître du jeu exclusif et les autres
  prospecteurs ont **deux chances** de proposer ; deux erreurs les éliminent.
- Le livret autorise d'accepter davantage de propositions ratées si le jeu est trop
  punitif.

## Ce qui change sur le site d'entraînement

- **Pas d'adversaire** : la machine génère la mine, joue le rôle de maître du jeu et
  répond aux tirs.
- **Une seule réponse valable** (règle du site, pas du livret) : la mine générée est la
  seule configuration compatible avec les résultats de **tous** les tirs possibles. Le
  joueur est responsable de tirer assez de lasers pour lever l'ambiguïté. La correction
  est une égalité stricte.
- Les règles de placement a à e s'appliquent aussi à la grille de solution du joueur.
- Le score d'une partie est son **nombre de lasers tirés** (voir `docs/roadmap.md` pour le
  traitement des « sondages de case »).

## Points à valider

- Dimensions exactes des gemmes (surtout : grand triangle identique en bleu et en blanc ?
  losange blanc 2×2 ?). Formes du Diamant et du Corps noir.
- Règle d (contact entre gemmes), lecture ci-dessus.
- Couleur « orange clair » (rouge + jaune + blanc), seulement vue dans la table BGA.
- Nombre d'essais de soumission en entraînement.
