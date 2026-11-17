# Orapa Training

Site web d'entraînement au jeu de société **Orapa Mine** (Junghee Choi et Wanjin Gill,
Gameology ; édition française Miraludo). Le site génère une « mine » aléatoire (grille de
gemmes cachées) et le joueur doit la reconstituer par déduction, en tirant des lasers, en
prenant des notes et en plaçant ses propres gemmes, puis en soumettant sa solution.

> Statut : **v1 livrée (v1.0.0)** ; **v2 complète côté code (v2.0.0)** : connexion Google,
> parties en cours et terminées enregistrées sur le compte, historique, profil, suppression du
> compte (Supabase, [`docs/backend.md`](docs/backend.md)), barre du haut, routeur et accueil, une
> seule partie à la fois sans compte. Reste la **mise en service** : projet Supabase, identifiant
> Google, variables, puis un essai réel. `CLAUDE.md` et `docs/` sont la spécification.

## Documentation (`docs/`)

- [`docs/regles.md`](docs/regles.md) : **les règles du jeu**, référence unique (grille,
  numérotation des entrées, formes des gemmes, placement, trajet et couleurs du rayon,
  extensions, fin de partie). **À lire avant de toucher à `src/game/`.** En cas de
  désaccord entre le code et ce fichier, c'est ce fichier qui a raison ; si une règle
  change, la corriger là **et** dans les tests.
- [`docs/roadmap.md`](docs/roadmap.md) : le plan de réalisation en quatre versions (v1 jeu
  complet avec sauvegarde locale, v2 comptes Google + historique + profil, v3 duel contre une IA,
  v4 duel en direct).
  **Tenue de la roadmap :** une fois une étape faite, la réduire à **une ou deux phrases** de
  description (ce qu'elle a livré, ce qui reste ou n'a pas été fait) ; le détail vit dans le code,
  les tests et l'historique git, pas dans la roadmap. Seules les étapes à venir gardent leur détail
  (contenu, tailles, critères de fin). Idem pour l'entrée de chaque nouvelle version dans « Évolutions ».

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
3. À la soumission : verdict (correct / incorrect), nombre de tirs (lasers et sondes),
   temps écoulé, et révélation de la vraie grille. Un bouton « nouvelle partie »
   relance une génération.

Périmètre par version (détail dans `docs/roadmap.md`) :

- **v1** : toutes les règles, 100 % statique côté client, avec une **sauvegarde locale**
  de la partie en cours pour la reprendre plus tard dans le même navigateur. Pas de
  compte, pas de serveur.
- **v2** : trois **vues** (accueil, partie, profil), connexion **Google (OAuth)**, parties en
  cours enregistrées dans le compte, **historique** des parties, **vue de profil** (nom Google,
  pourcentage de parties gagnées, moyenne de tirs avant de gagner). Demande un
  backend. Sans compte, le jeu reste jouable mais limité à **une seule partie à la fois**.
- **v3** : le joueur **crée son plateau** (cache ses gemmes) et **joue contre une IA** qui cherche le
  sien pendant qu'il cherche celui de l'IA (fini le simple entraînement) ; mode **daltonien**
  (palette et motifs qui ne reposent pas sur la seule teinte).
- **v4** : **duel en direct** contre un autre joueur (arbitre serveur qui répond aux lasers sans
  révéler les plateaux).

## Les points des règles à ne pas rater

Résumé ; le détail et les tableaux sont dans `docs/regles.md`.

- Grille **10 colonnes × 8 lignes** ; case = lettre de ligne A–H + numéro de colonne 1–10
  (« E4 »). 36 points d'entrée : **1–10** en haut, **11–18** à droite, **I–R** en bas,
  **A–H** à gauche.
- Partie de base : **5 gemmes** (1 rouge, 1 jaune, 1 bleue, 2 blanches) parmi un jeu de 7 ;
  Diamant et Corps noir en extensions, au choix au début de chaque partie
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
- Option de difficulté (plus tard) : nombre de gemmes, extensions Diamant et Corps noir,
  limite de lasers.
- Vérifier par un test, sur de nombreuses graines, que toute mine générée est valide,
  et visible.

## Vues du site (v2)

Détail dans la section « Vues et compte » de [`docs/roadmap.md`](docs/roadmap.md). Navigation par
l'adresse (`ui/router.ts`) : `#/` accueil (par défaut), `#/partie`, `#/regles`, `#/historique`,
`#/profil`, `#/confidentialite` ; les anciennes adresses (`#regles`, `#historique`…) restent
comprises. Un lien `?seed=…` (avec `ext=`) lance cette mine directement.

**Barre du haut** (`ui/header.ts`, toutes les pages sauf le plein écran) :

- à gauche : **« Orapa Training »** (ramène à l'accueil) suivi de la **version du build**, le bouton
  **« Nouvelle partie »** et **« Règles »** ;
- à droite : un **bouton jour / nuit** en premier (lune en mode jour, soleil en mode nuit ; il force le thème,
  mémorisé dans le navigateur, sinon le site suit le réglage du système, `ui/theme.ts`), puis **« Historique »**, **« Profil »** (avec l'**avatar** du compte sur le bouton, jamais le
  nom) et **« Déconnexion »** ; déconnecté : seulement **« Connexion »** (OAuth Google). Sans
  backend configuré, aucun bouton de compte.

Pages :

1. **Accueil** (`ui/home.ts`) : la partie en cours (Reprendre, Importer), la liste des
   parties en cours du compte (connecté seulement, 10 au plus) et « Nouvelle partie » (fenêtre des extensions : Diamant, Corps
   noir).
2. **Partie** : la vue décrite dans « Interface » ci-dessous. Sans partie, l'adresse retombe sur
   l'accueil.
3. **Profil** (connecté) : nom Google, pourcentage de parties gagnées, moyenne de tirs avant victoire.
4. **Historique** (connecté) : les parties terminées, filtre victoires / défaites, tri, « Rejouer ».
   (Page à part, à la demande du propriétaire, et non dans la vue Profil.)

**Sans compte, une seule partie à la fois** (la sauvegarde locale) : « Nouvelle partie » reste
disponible mais **remplace** la partie en cours, après une **modale de confirmation** (« Vous allez perdre
votre partie en cours. Connectez-vous pour sauvegarder plusieurs parties en même temps. ») ; un lien vers
une autre mine est ignoré. **Il n'y a pas d'abandon** (retiré en 2.0.1) : on termine une partie en la soumettant ; le
statut `abandoned` n'existe plus que dans les anciennes données, où il compte comme une défaite. Avec un compte, plusieurs parties en cours (10 au plus), enregistrées côté
serveur et synchronisées (`backend/sync.ts`) : on les reprend depuis n'importe quel appareil.

## Interface

Vue de jeu (`#/partie`), adaptée desktop **et** mobile/tactile (glisser-déposer au pointeur,
pas seulement à la souris).

**Texte minimal.** Le joueur ne doit lire presque rien : libellés courts (« Soumettre », « Retirer »),
pas de paragraphe d'aide ni de phrase d'explication dans le jeu, symboles et schémas plutôt que
des phrases. Les explications vivent dans la page « Règles », elle-même concise. Tous les textes
sont dans `src/ui/strings.ts`. **Aucun texte n'explique un placement refusé** : les messages de règle
(`game/placement.ts`) servent aux tests et à la logique, pas à l'affichage.
Les étiquettes d'accessibilité (`aria-label`, texte pour lecteurs d'écran) restent complètes.

**Gemmes.** Elles portent le **quadrillage des vraies pièces** : les lignes de la grille qui les traversent, un peu plus foncées que la gemme, pour aider à les aligner (`gridSegments` dans `game/geometry.ts`, `gemPolygons` dans `ui/palette.ts`). Trois calques par gemme : fond, quadrillage, puis **bordure par-dessus** ; une gemme glissée passe **au-dessus** des repères du bord.

La **version du build** (`vX.Y.Z`, issue de `package.json`) s'affiche en petit à droite du titre, dans la barre du haut : l'incrémenter à chaque livraison.

**Une seule grille, pas d'onglets** (plus de « Tirs / Gemmes / Notes »). Trois colonnes sur ordinateur
(`playBoard.ts`, `notesBoard.ts`, `solutionBoard.ts`) ; sur petit écran elles s'empilent (grille, puis outils
et gemmes, puis historique). La grille est plus grande qu'avant (jusqu'à 4,2 rem par case, bornée par la
largeur et la hauteur de la fenêtre) ; la réserve de gemmes a la même échelle que la grille.

Zones :

1. **Colonne de gauche : compteur et historique des tirs.** Le **compteur de tirs** ne baisse jamais ;
   l'historique (numéroté, consultable) montre le trajet « E → F » et des **pastilles** de la couleur
   obtenue, **sans le nom** de la couleur : « transparent » est une pastille au **simple contour blanc**, et
   le nom de la couleur apparaît **au survol de la souris** (pour toutes les couleurs). Les **sondes** viennent
   ensuite, **dans des cartes de la même forme** : « 5   B6   =   ● » (pastille de la gemme), « B6 = rien »,
   « B6 = » + pictogramme du signal perdu, ou « B6 = » + le **Diamant en miniature** (`ui/historyCards.ts`).
   **Sélection :** tant que rien n'est sélectionné, **survoler** une carte la met en avant provisoirement (ses repères
   sur la grille, ou le contour de la case sondée) ; **cliquer** la sélectionne (elle reste en avant, le survol ne
   fait plus rien) ; **recliquer** la désélectionne, de même qu'**un clic ailleurs** (hors cartes, repères
   et barre de défilement) : la carte et les repères (ou la case) ne sont plus surlignés. Un tir n'est pas sélectionné d'office
   après avoir été tiré, mais **toucher un repère déjà tiré** (ou l'arrivée d'un tir) le sélectionne : ses
   repères de départ et d'arrivée sont surlignés. Quand la liste dépasse la hauteur de la grille, elle passe d'abord sur
   **deux colonnes** : la première, remplie d'abord, est **à gauche**, la seconde **à droite**, à l'emplacement de la
   colonne unique, au contact de la grille (`ui/historyLayout.ts`). La colonne en plus s'ouvre **dans la marge à
   gauche** de la page quand elle y tient (rien d'autre ne bouge) ; sinon, sur grand écran (88 rem et plus), la page
   s'élargit d'une colonne et la grille rétrécit un peu. Si deux colonnes ne suffisent pas, elle défile **sans barre du navigateur** (elle
   prendrait de la place) : une **barre légère, en surimpression à droite, n'apparaît qu'au survol** et se
   glisse à la souris (`ui/scrollbar.ts`) ; la position est gardée d'un affichage à l'autre, et un nouveau tir
   fait défiler jusqu'à lui. **Pas d'horloge** : le temps n'est montré qu'au résultat.
2. **Grille de jeu (au centre).** Les repères de bord sont cliquables pour tirer un laser, et **toucher une
   case la sonde**. Un tir ou une sonde se fait **en deux clics** (pas de modale) : le
   premier sur un repère ou une case affiche une **bulle verte** (« Tirer en E ? », « Tirer en E4 ? ») **au-dessus**
   de la cible (au-dessous pour les repères du haut et la première ligne), **plus petite à la souris**, et
   **entoure la cible en vert** ; le second clic au même endroit tire ; un clic ailleurs, une gemme prise ou Échap
   annule la bulle. La ligne ajoutée à l'historique et les pastilles du tir sur la grille apparaissent avec une
   courte animation : **le tir (numéro, entrée) d'abord, le résultat (sortie, couleur) 0,5 s plus tard**. Redemander un laser déjà tiré, **ou tirer depuis le repère d'arrivée d'un tir précédent** (le trajet est
   réversible : de x vers y ou de y vers x, c'est le même rayon, `GameSession.fire`), est gratuit et affiche à la place une **infobulle de
   résumé** en bas de l'écran, temporaire, comme « signal perdu » (« E → F » + pastilles de la couleur), redemander une case sondée est
   gratuit. Le numéro du tir figure sur le repère d'entrée (en haut à droite) et, dans une pastille de la
   couleur obtenue (en bas à droite), sur le repère de sortie ; pour « transparent » il n'y a pas de pastille :
   le numéro seul, **en blanc cerclé de noir (1 px)**. **Le chemin du rayon n'est jamais tracé** (il
   trahirait les gemmes) ; il ne l'est que par l'outil « Simuler » (sur les gemmes du joueur) et à la fin.
   Les **gemmes posées** par le joueur (déplaçables, la gemme sélectionnée porte un **bouton rond ↻
   (pivoter)**, sauf le losange blanc (identique dans ses quatre quarts de tour), et la rouge un bouton **⇋
   (retourner)** ; les boutons sont ancrés à l'**axe de rotation** et ne bougent pas quand la gemme pivote.
   Une gemme pivote autour du **centre de sa boîte** (`pivot` dans `game/gems.ts`), le Corps noir et le Diamant
   autour de leur **case de droite** (la case de gauche après deux tours)) et ses **notes** sont dessinées
   sur cette grille. Les placements invalides (chevauchement, hors grille, contact par un segment) sont
   refusés ou signalés par le **contour rouge en pointillés** des gemmes concernées, **sans texte** ; « Soumettre »
   reste alors désactivé, comme quand toutes les gemmes ne sont pas posées.
3. **Sous la grille.** À gauche, **↶** (annuler), **↷** (rétablir) et **« Effacer »** (les notes). À droite, deux cases
   à cocher **« Notes »** et **« Gemmes »** : afficher ou masquer les notes et les gemmes déjà placées.
4. **Colonne de droite, en haut : outils de notes.** **Tir** (le plus à gauche), **Gemmes**, **Crayon**, **Ligne droite**, **Vide** (stries
   diagonales grises transparentes), **Simuler** (les repères testent un tir sur les gemmes du joueur et en
   tracent le trajet : « mon placement produirait-il bien ce résultat ? ») et le choix de l'encre : noir « auto »
   (suit le thème), **noir**, rouge, jaune, bleu, puis une **icône de gomme** (l'outil Gomme, sans bouton texte). Plus de marques « R J B Bl » ni de « ? » (les anciennes notes
   restent lisibles). **Aucun outil actif = « jouer »** (tirer, sonder, déplacer les gemmes) ; recliquer
   l'outil actif le désactive ; un outil de dessin laisse passer le pointeur à travers les gemmes posées.
   **« Tir »** fait de même sans dessiner : repères et cases tirent, mais toucher une case ne sélectionne pas la
   gemme dessous (les gemmes posées sont inertes) ; prendre une gemme de la réserve le désactive.
   **Deux modes cachés**, sans interrupteur propre : **mode notes** dès qu'un outil de dessin est actif (clic sur
   Crayon, Ligne droite, Gomme, Vide ou une encre), **mode gemmes** sinon (bouton « Gemmes », saisie d'une
   gemme de la réserve, ou clic hors de la grille, des outils de notes, du pied de grille et des fenêtres
   modales). En mode gemmes les notes sont légèrement estompées, en mode notes ce sont les gemmes.
   Les notes n'ont aucun effet sur la correction.
5. **Colonne de droite, en bas : gemmes à placer et « Soumettre ».** La réserve (les mêmes gemmes que celles
   cachées) se glisse sur la grille ; **« Réinitialiser »**, tout à droite de la ligne « 4/7 · 5/13 tirs » (sous la réserve, pour ne pas
   faire descendre « Soumettre »), remet toutes les gemmes dans la réserve (désactivé quand aucune n'est posée) ; **« Soumettre »** est **en vert**, sous les gemmes (activé quand toutes sont
   bien placées), avec confirmation. **Pas de bouton « Abandonner ».**
6. **Résultat** (fin de partie) : « Gagné » / « Perdu », le **nombre de tirs et le temps** (seul endroit où
   l'horloge apparaît), la vraie mine et la proposition ; les 36 repères restent cliquables pour tirer des
   lasers libres dans la mine révélée (trajet tracé, hors compteur). **Le détail se lit dans l'historique, pas en
   texte** : les tirs (lasers et sondes) que la proposition du joueur ne reproduit pas sont **entourés de rouge** ;
   survolés ou sélectionnés, ils sont **simulés sur la proposition** (trajet tracé sur la grille, comme l'outil
   « Simuler »).
7. **Plein écran (téléphone, paysage)** : bouton à **pictogramme** (quatre coins) dans la barre de la partie, **affiché seulement sur écran tactile** (`pointer: coarse`) ; un seul plateau (`ui/immersiveBoard.ts`) avec réserve de gemmes à droite et colonne d'outils ; l'outil « Jouer » tire (repères), sonde (cases) et déplace les gemmes, les autres outils dessinent (les repères restent cliquables).
8. **Barre de la partie** : graine, extensions ; l'adresse du navigateur porte `?seed=…&ext=…` pendant la partie et relance la même mine. Les **extensions** de la partie (« Sans extension », « Diamant », « Corps noir » ou les deux) s'affichent à côté de la graine, en haut de la vue de jeu. Les **tirs** (lasers et sondes de cases comptent pareil) sont dans la colonne de gauche.

La **simulation du laser doit pouvoir être affichée sur la grille du joueur** (outil « Simuler »).

Une page **« Règles »** du site expose les règles de `docs/regles.md` aux joueurs, y
compris la particularité de la gemme rouge retournable.

## Soumission et correction

- Comparaison exacte des gemmes (type, couleur, position, orientation, face de la rouge)
  entre la grille joueur et la mine cachée.
- **Égalité stricte** : il n'y a ni équivalence par tirs ni tolérance. Les ambiguïtés se lèvent
  avec des lasers et des sondes de cases ; si le joueur se trompe, c'est qu'il n'a pas assez
  cherché : c'est le cœur de l'entraînement.
- Le simulateur sert seulement au tir et à l'outil de vérification d'hypothèse du joueur.
- Fin de partie officielle : à deux joueurs, une proposition fausse fait perdre
  immédiatement. En entraînement, **une seule proposition** (`MAX_ATTEMPTS = 1` dans
  `game/session.ts`) ; la constante permet un mode plus indulgent.
- Après soumission : afficher la vraie mine et la proposition (gemmes en pointillés, vert ou rouge), le
  nombre de tirs et le temps écoulé ; les tirs en désaccord avec la proposition sont repérés dans l'historique.

## Stack et conventions

Choix techniques :

- **TypeScript + Vite**, rendu en **SVG** (ou canvas si les performances l'exigent) ;
  framework léger optionnel (Preact/Svelte) ou DOM direct.
- Tests unitaires avec **Vitest**.
- v1 : déploiement statique (GitHub Pages ou équivalent), aucun backend.
- v2 : backend géré **Supabase** (voir `docs/backend.md`) ; le front reste statique. Sans les
  variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`, le site fonctionne comme en v1.
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
    session.ts     # ✔ partie en cours : mine privée, tirs, sondes, soumission ; seule porte d'entrée de l'UI
    verify.ts      # ✔ correction par égalité stricte, détail gemme par gemme
    probe.ts       # ✔ « Qu'y a-t-il en E4 ? »
    save.ts        # ✔ format de la sauvegarde locale et validation stricte
    notes.ts       # ✔ notes : marque « vide », traits (crayon, ligne droite), gomme, annuler / rétablir
    record.ts      # ✔ enregistrement d'une partie terminée (table `games`)
    solution.ts    # ✔ solution du joueur : poser, pivoter, retourner la rouge, règles, comparaison aux tirs
  ui/          # composants, interactions pointeur, rendu SVG
    app.ts         # ✔ état de l'application, partie, historique des tirs
    board.ts       # ✔ cadre SVG de la grille, repères du bord, marques des tirs et des sondes
    playBoard.ts   # ✔ la grille de jeu unique (tirs, sondes, gemmes posées, notes, simulation)
    solutionBoard.ts # ✔ gemmes : réserve à droite de la grille, dessin d'une gemme, boutons ↻ ⇋
    notesBoard.ts  # ✔ colonne d'outils (crayon, ligne, gomme, vide, simuler, encres) et pied de grille
    resultBoard.ts # ✔ écran de résultat : vraie mine et proposition
    storage.ts     # ✔ accès protégé au localStorage
    rules.ts       # ✔ page « Règles » (schémas tirés des données du jeu)
    router.ts      # ✔ routeur par adresse : accueil, partie, règles, historique, profil, confidentialité
    header.ts      # ✔ barre du haut (titre + version, Nouvelle partie, Règles ; Historique, Profil, Connexion)
    home.ts        # ✔ vue Accueil : partie en cours, nouvelle partie
    strings.ts     # ✔ table de chaînes de l'interface
    theme.ts       # ✔ thème jour / nuit : choix du joueur (data-theme, localStorage) ou réglage du système
    palette.ts     # ✔ couleurs d'affichage des gemmes et des rayons
    html.ts        # ✔ échappement du texte venant de l'extérieur (graine, nom du compte) : à utiliser partout
    history.ts     # ✔ page « Historique »
    profile.ts     # ✔ page « Profil » (nom, statistiques)
    privacy.ts     # ✔ page « Confidentialité », suppression du compte
    format.ts      # ✔ durées, dates
    historyLayout.ts # ✔ historique sur une ou deux colonnes selon la place
    historyCards.ts # ✔ cartes de l'historique : tirs et sondes (« B6 = ● »), pastilles de couleur
    scrollbar.ts   # ✔ barre de défilement légère en surimpression (historique des tirs)
  backend/     # v2 : Supabase (chargé à la demande, absent sans configuration)
    config.ts      # ✔ variables VITE_SUPABASE_*
    auth.ts        # ✔ connexion Google
    games.ts       # ✔ enregistrement et lecture des parties (table `games`)
    outbox.ts      # ✔ file d'envoi locale, un utilisateur par entrée
    sync.ts        # ✔ synchronisation espacée des parties en cours
    index.ts       # ✔ crée le client
  main.ts
tests/         # Vitest ; helpers.ts fournit `place`, un PRNG et des dispositions aléatoires valides
supabase/      # migrations SQL (v2) et tests de sécurité par ligne (`npm run test:db`)
docs/          # règles du jeu, roadmap, backend
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
npm run test:db      # tests SQL (sécurité par ligne) ; demande un Postgres, voir docs/backend.md
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
- v0.5 Générateur à graine : **fait**.
- v0.6 UI : grille et tirs : **fait**.
- v0.7 UI : grille de solution (glisser-déposer, rotation, retournement de la rouge) : **fait**.
- v0.8 UI : notes et dessin : **fait**.
- v0.9 Soumission, correction, écran de résultat : **fait**.
- v0.10 Sauvegarde locale de la partie en cours : **fait**.
- v0.11 Page « Règles », accessibilité, mobile : **fait**.

**Vers la v2 : comptes, historique, profil**

- v1.1 Choix du backend (**fait**, Supabase). v1.2 Vues (accueil, partie, profil), navigation et
  connexion Google (**fait**). v1.3 Modèle de données et sécurité par utilisateur, parties en cours
  et terminées (**fait**). v1.4 Parties enregistrées et historique (**fait**). v1.5 Vue Profil (nom,
  % de victoires, moyenne de tirs avant victoire) (**fait**, historique en page séparée). v1.6 Vie
  privée et exploitation (**fait**). Reste la mise en service (voir `docs/backend.md`).

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
  hauteur 1) ; Corps noir = base rectangulaire 2×1.
- ~~Contact entre gemmes (règle d)~~ : confirmé par le propriétaire, deux gemmes ne se touchent
  que par un **point** (jamais un segment) ; voir `docs/regles.md`.
- ~~Soumission en entraînement~~ : décidé en v0.9, une seule tentative (`MAX_ATTEMPTS`).
- ~~« Sonder une case »~~ : décidé en v0.9, proposée et comptée à part des lasers.
- ~~Une partie abandonnée compte-t-elle comme perdue dans le pourcentage de victoires (v2) ?~~
  Décidé en v1.1 : oui. (L'abandon a depuis été retiré, 2.0.1 ; les anciennes parties comptent toujours.)
- Limite de tirs imposée, ou simple compteur indicatif ?
- ~~Supabase ou Firebase pour la v2 ?~~ Décidé en v1.1 : Supabase.
- Duel (v3) : « en même temps » ou tour par tour ? règle de fin (livret ou indulgente) ? Voir `docs/roadmap.md`.
- Faut-il un mode « tutoriel » expliquant les effets de chaque gemme ?
