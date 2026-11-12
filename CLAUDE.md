# Orapa Training

Site web d'entraînement au jeu de société **Orapa Mine** (Sébastien Pauchon).
Le site génère une « mine » aléatoire (grille de gemmes cachées) et le joueur doit
la reconstituer par déduction, en tirant des lasers, en prenant des notes et en
plaçant ses propres gemmes, puis en soumettant sa solution.

> Statut : le dépôt est vide, ce fichier est la spécification de départ.
> Les règles marquées **(à valider)** sont écrites de mémoire : les vérifier contre
> les règles officielles avant de les figer dans le code, et les corriger ici.

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

- **Grille / mine** : plateau rectangulaire de cases (format officiel : 10 colonnes
  × 8 lignes **(à valider)**). Garder largeur/hauteur en constantes, pas en dur.
- **Gemme** : pièce transparente ou opaque, de forme polygonale alignée sur les
  cases (triangles, parallélogrammes, trapèzes, etc.), de couleur donnée.
  Couleurs : rouge, jaune, bleu, blanc (transparent), noir **(à valider)**.
  Chaque gemme a une forme, une couleur, une orientation (rotation + miroir).
- **Laser** : rayon émis depuis une **case de bord** (une entrée par case en
  périphérie, dans une direction orthogonale vers l'intérieur).
- **Résultat d'un tir** : point de sortie sur le bord (ou « absorbé » / « revient
  à l'entrée ») et couleur finale du rayon.
- **Mine cachée** vs **grille joueur** : deux états distincts, jamais mélangés
  dans le même objet pour éviter toute fuite d'information dans l'UI.

## Règles de propagation du laser (à valider)

À implémenter dans un module pur, sans dépendance au DOM. Hypothèse de travail :

- Le rayon avance case par case ; un rayon qui ne rencontre aucune gemme sort
  de l'autre côté de la grille, avec sa couleur initiale (blanche).
- Une gemme colorée transparente **teinte** le rayon qui la traverse ; la
  traversée de plusieurs gemmes **mélange** les couleurs (rouge + jaune = orange,
  jaune + bleu = vert, rouge + bleu = violet, etc.).
- Une face inclinée (diagonale) **dévie** le rayon de 90° (réflexion/réfraction
  selon la gemme).
- Une gemme noire/opaque ne laisse pas passer le rayon (absorption ou réflexion
  selon la règle officielle).
- Les cas limites à trancher en consultant les règles officielles : rayon qui
  frappe un sommet exactement, rayon qui revient vers son point d'entrée, boucle,
  rayon qui rentre dans une gemme par une face inclinée.

Toute règle tranchée doit être reportée ici **et** couverte par un test.

## Génération aléatoire

- Utiliser un **PRNG à graine** (ex. mulberry32) plutôt que `Math.random()` :
  chaque partie a une graine affichée/partageable (`?seed=...`) pour rejouer ou
  comparer une même mine.
- Placement : tirer les gemmes de l'ensemble officiel (ou d'un sous-ensemble
  configurable), les placer à des positions/orientations aléatoires **sans
  chevauchement** et **dans les limites** de la grille. Rejeter et retirer en cas
  d'échec (backtracking simple ou re-tirage complet).
- Option de difficulté (plus tard) : nombre de gemmes, présence de la gemme noire,
  limite de lasers.
- Vérifier que la mine générée est valide (aucun chevauchement, tout dans la grille)
  par un test sur de nombreuses graines.

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
- Une configuration différente mais **indiscernable** par tous les tirs possibles
  peut exister. Décision à prendre : (a) exiger l'égalité stricte, ou (b) accepter
  toute configuration dont les résultats sont identiques pour **toutes** les
  entrées de laser. Par défaut : (b) est plus juste, (a) est plus simple.
  Implémenter (a) d'abord, (b) ensuite en s'appuyant sur le simulateur.
- Après soumission : afficher les différences (gemmes manquantes / mal placées /
  en trop) et la vraie mine.

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

- Ensemble exact de gemmes (nombre, formes, couleurs) et règles de propagation
  officielles : à confirmer avec les règles Orapa Mine.
- Égalité stricte ou équivalence par tirs pour la correction (voir plus haut).
- Limite de lasers imposée, ou simple compteur indicatif ?
- Faut-il un mode « tutoriel » expliquant les effets de chaque gemme ?
