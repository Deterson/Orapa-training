# Roadmap

Quatre versions livrables : **v1** = le jeu complet, jouable hors ligne, avec une simple
sauvegarde locale ; **v2** = comptes Google, historique et page de profil ; **v3** = plateau
personnalisé et duel contre une IA ; **v4** = duel en direct contre un autre joueur.

**Numérotation.** Une étape porte le numéro de la version qu'elle prépare, pas de celle
qu'elle livre : les étapes **v0.1 à v0.11** construisent la **v1**, qui sort quand la
v0.11 est terminée ; les étapes **v1.1 à v1.6** construisent la **v2**, qui sort quand la
v1.6 est terminée ; les étapes **v2.1 à v2.7** construisent la **v3** ; les étapes **v3.1 à v3.7**
construisent la **v4**. La version v1.0 est donc la première version complète du jeu.

Tailles indicatives : S (≈ une demi-journée), M (1 à 2 jours), L (3 jours ou plus).
Chaque étape se termine par des tests verts et un commit.

Les règles de référence sont dans [`regles.md`](regles.md). Les spécifications de la
génération, de l'interface et de la soumission sont dans [`../CLAUDE.md`](../CLAUDE.md).

---

## Vers la v1 : le jeu complet, sauvegarde locale (étapes v0.1 à v0.11)

**Objectif :** toutes les règles du jeu implémentées et un site statique jouable de bout en
bout. Aucun compte, aucun serveur. La seule persistance est une sauvegarde locale de la
partie en cours, pour la reprendre plus tard dans le même navigateur.

### v0.1 Socle du projet (S) : fait

- Vite + TypeScript (mode strict), Vitest, ESLint et Prettier.
- Arborescence `src/game/`, `src/ui/`, `tests/`. ESLint interdit à `src/game/` d'utiliser
  `window`, `document` ou le stockage du navigateur.
- CI GitHub Actions (`.github/workflows/ci.yml`) : lint, format, typecheck, tests et build à
  chaque push.
- Déploiement GitHub Pages (`.github/workflows/deploy.yml`) à chaque push sur `main`.
  **Une fois :** Settings → Pages → Source : « GitHub Actions ».
- Page provisoire qui affiche la version, la grille 10×8 et les 36 points d'entrée :
  elle sert à vérifier le déploiement, y compris sur téléphone.
- **Fini quand :** la page se déploie, s'ouvre sur un téléphone et la CI est verte.

### v0.2 Modèle de données et géométrie (M) : fait

- `board.ts` : grille 10×8, cases (« E4 »), 36 points d'entrée/sortie (1–18, A–R), lecture
  et écriture des repères.
- `gems.ts` : les 5 gemmes de la partie de base **comme données** (listes de sommets),
  rotations par quarts de tour, **retournement réservé à la gemme rouge** (4 positions
  distinctes pour la rouge, le jaune, le bleu et le grand blanc ; 1 pour le losange).
- `geometry.ts` : polygones convexes sur coordonnées entières, comparaison exacte de deux
  polygones : `apart`, `point`, `segment` (côte à côte) ou `overlap`.
- `placement.ts` : `validatePlacements` signale les règles a (face visible), b (alignement),
  c (dans le plateau), d (pas de segment partagé), le recouvrement et les doublons, avec un
  message en français par violation.
- Tests : chaque forme et chaque orientation ; segment partagé refusé, contact par un sommet
  accepté, sommet contre le milieu d'un côté accepté ; schéma d du livret.
- **Fini quand :** on peut poser des gemmes dans une grille de données et en tirer un
  verdict de validité fiable. ✔

### v0.3 Simulateur de laser (M) : fait

- `laser.ts` : le rayon suit le milieu des cases ; virage de 90° sur une face à 45°, demi-tour
  sur une face perpendiculaire. `shoot` tire depuis un repère, `shootAll` depuis les 36
  (la « signature » d'une mine). Le résultat donne l'entrée, la sortie, la couleur, les
  couleurs touchées, les contacts et le trajet à dessiner.
- `colors.ts` : table de mélange des 16 combinaisons, indexée par l'ensemble des couleurs
  distinctes touchées.
- Pas encore de « signal absorbé » : il n'existe que pour le Corps noir, dont la forme est
  inconnue (extension, hors v1).
- Tests : les **deux exemples du livret** (I → rouge en I ; 15 → violet clair en 8, avec le
  trajet exact) ; chaque ligne de la table des couleurs ; une couleur touchée par deux gemmes
  ne compte qu'une fois ; **réversibilité** et absence de boucle sur 300 dispositions valides
  tirées au hasard (les 36 sorties sont toujours distinctes).
- **Fini quand :** les 36 entrées d'une mine quelconque donnent un résultat, et les exemples
  du livret passent. ✔

### v0.4 Visibilité des gemmes (S) : fait

- `visibility.ts` : `visibleGemIndices`, `hiddenGemIndices`, `isVisible` et
  `visibilityViolations` (règle e, une violation par gemme cachée). Une gemme est visible
  si un rayon droit, sans rebond préalable, la touche **en premier** depuis l'un des 36 bords.
- Tests : disposition du livret (5 sur 5), gemme encerclée par quatre bouchons (cachée, même
  si un rayon la touche après un rebond), retrait de n'importe quel bouchon (redevient
  visible), 300 dispositions aléatoires.
- **Fini quand :** `isVisible(mine)` est fiable ; il servira à la génération **et** à l'aide de
  validation de la grille joueur. ✔

### v0.5 Générateur à graine et unicité (L) : fait

- `rng.ts` : PRNG mulberry32 à graine texte ; `Math.random()` n'est utilisé que pour proposer
  une nouvelle graine (`randomSeed`). `GENERATOR_VERSION` (1) accompagne chaque mine.
- `generate.ts` : tirage des 5 gemmes de la partie de base (position et orientation au hasard,
  rejet si une règle de placement est violée), puis filtre de visibilité (règle e), puis
  unicité. Même graine et même version : même mine.
- `solve.ts` : solveur d'unicité **guidé par les rayons**. Il rejoue les tirs de la signature
  et laisse les gemmes inconnues apparaître au fil du rayon ; la couleur et le point de sortie
  annoncés coupent presque toutes les branches. Une première version, qui énumérait les poses
  des gemmes, ne terminait pas en un temps raisonnable (plus de 10 s par mine).
- Performance mesurée sur 150 mines aléatoires visibles : **123 ms en moyenne, 1,2 s au pire**
  par vérification d'unicité ; 149 mines sur 150 étaient uniques, donc le rejet est rare
  (moins de 3 tirages par mine en moyenne). Pas besoin de Web Worker ni de banque de mines
  pour l'instant ; à revoir si le pire cas gêne l'interface (le solveur a un garde-fou
  `maxNodes` : une recherche interrompue compte comme « non unique »).
- Tests : le solveur donne **exactement les mêmes solutions qu'une énumération exhaustive**
  sur 12 cas à deux gemmes ; il retrouve toujours la mine d'origine ; une mine réellement
  ambiguë (le triangle jaune peut être une colonne plus loin sans qu'aucun tir ne le
  révèle) est refusée avec ses deux solutions ; 100 graines donnent des mines valides,
  visibles et uniques ; même graine, même mine.
- **Fini quand :** « nouvelle mine » répond en un temps acceptable et toute mine produite
  vérifie les trois propriétés. ✔

### v0.6 Interface : grille et tirs (M) : fait

- `game/session.ts` : `GameSession` garde la mine dans un champ privé du langage (`#mine`,
  invisible pour `JSON.stringify`) et n'expose que `fire`, `shots` et `laserCount`. Le résultat
  d'un tir est `{ n, entry, exit, color }` : **ni le trajet du rayon, ni les gemmes touchées**,
  qui trahiraient la mine. Redemander un repère déjà tiré renvoie la même réponse sans compter
  un nouveau laser (le livret l'autorise).
- `ui/board.ts` : grille SVG 10×8 avec les 36 repères cliquables (1–10, 11–18, I–R, A–H).
  Sur le repère d'entrée d'un tir : un badge avec son numéro ; sur le repère de sortie : un
  point de la couleur annoncée.
- `ui/app.ts` : nouvelle partie (graine aléatoire ou `?seed=` dans l'adresse), copie du lien,
  compteur de lasers, historique numéroté (cliquer un tir le met en avant sur la grille),
  message vocal pour les lecteurs d'écran.
- **Décision :** le chemin du rayon n'est **pas** tracé dans la grille de tir, contrairement à ce
  que prévoyait la première version de la roadmap : dans le vrai jeu on ne voit que la sortie et
  la couleur, et tracer le chemin révélerait les gemmes. Le chemin ne sera tracé que sur la
  grille de solution du joueur, pour tester une hypothèse (v0.7).
- Génération de la mine à l'ouverture : environ 0,5 s sur le serveur de développement.
- Vérifié dans un navigateur au format iPhone 13 : tirs, historique, mise en avant, pas de
  débordement horizontal, aucune gemme dans le DOM.
- **Fini quand :** on peut tirer des lasers sur une mine générée et lire les résultats. ✔

### v0.7 Interface : grille de solution (L) : fait

- `game/solution.ts` (logique pure, testée) : une solution est une pose ou « réserve » par
  gemme. `dropGem`, `nudgeGem`, `rotateGem`, `flipGem` (**la rouge seulement**), `removeGem` ;
  toute pose est ramenée dans le plateau (règle c) ; `solutionIssues` signale les règles a à d,
  le recouvrement et la règle e ; `isSubmittable` demande 5 gemmes posées et aucune violation ;
  `compareWithShots` dit, pour chaque tir déjà fait, si la grille du joueur donne le même
  résultat (il n'utilise que les réponses annoncées, jamais la mine).
- Onglet **Ma solution** (`ui/solutionBoard.ts`, `ui/app.ts`) :
  - glisser-déposer au pointeur (souris et doigt) depuis la réserve ou la grille ; relâcher hors
    de la grille remet la gemme dans la réserve ; aimantation à la case ;
  - toucher une gemme la sélectionne ; boutons **Pivoter**, **Retourner** (actif pour la gemme
    rouge seulement) et **Remettre dans la réserve** ;
  - clavier : flèches pour déplacer, `R` pivoter, `F` retourner, `Suppr` retirer, `Entrée`
    sélectionner ;
  - les placements fautifs sont gardés mais signalés (contour rouge en pointillés) avec la
    règle enfreinte en français, plutôt que refusés : le joueur peut corriger en deux gestes ;
  - **outil de vérification d'hypothèse** : toucher un repère simule le tir sur *sa propre*
    grille et en trace le chemin ; sur la grille, chaque repère de tir déjà fait est cerclé de
    vert si la grille du joueur reproduit le résultat, de rouge sinon ; un résumé donne
    « votre grille reproduit k tirs sur n ».
- Vérifié dans un navigateur (souris) : dépôt depuis la réserve, rotation avec remise dans le
  plateau, retournement de la rouge, retournement refusé pour le jaune, flèches, retour à la
  réserve, comparaison avec les tirs. Le glisser au doigt repose sur les mêmes événements
  pointeur ; il reste à le valider sur un vrai téléphone.
- **Fini quand :** le joueur peut construire à la main une solution complète et valide. ✔

### v0.8 Interface : notes et dessin (M) : fait

- `game/notes.ts` (logique pure, testée) : marques de cases (couleur de gemme supposée,
  « vide » ✕, « doute » ?), traits au crayon en cinq encres, gomme (efface la marque de la case
  et les traits qui passent à proximité), **annuler / rétablir** (200 étapes), « tout effacer »
  (lui-même annulable, donc sans confirmation). Les notes sont sérialisables (pour la
  sauvegarde de la v0.10) et n'ont **aucun effet sur la correction**.
- Onglet **Notes** (`ui/notesBoard.ts`) : la grille avec les résultats des tirs en repère, sous
  le calque d'annotation. Poser deux fois la même marque l'enlève. Les marques de couleur
  portent aussi une lettre (R, J, B, Bl) pour ne pas dépendre de la teinte seule.
- Crayon et gomme bloquent le défilement au toucher sur la grille (`touch-action: none`) ;
  les marques de cases le laissent actif. Raccourcis `Ctrl/Cmd + Z` et `Ctrl/Cmd + Y`.
- Vérifié dans un navigateur : trait au crayon, changement d'encre, marques de couleur, ✕ et ?,
  retrait d'une marque, gomme sur un trait, annuler, rétablir, tout effacer puis annuler.
- **Fini quand :** les notes se superposent à la grille de tir ou s'affichent à côté, sans gêner
  les autres interactions. ✔ (onglet dédié, avec les tirs en repère)

### v0.9 Soumission et fin de partie (M) : fait

- `game/verify.ts` : correction par **égalité stricte**, gemme par gemme, en comparant les
  polygones occupés (deux poses équivalentes, comme le parallélogramme tourné de 180°, sont
  égales) ; `compareSolution` donne, par gemme, « bien placée », « mal placée » ou « non posée ».
- `game/probe.ts` : « Qu'y a-t-il en E4 ? » répond « rien » ou la couleur de la gemme ; une case
  que la gemme ne couvre qu'à moitié compte comme occupée.
- `game/session.ts` : statuts `playing`, `won`, `lost`, `abandoned` ; `submit`, `abandon`,
  `probe`, `summary`, chronomètre (horloge injectable pour les tests) ; **une fois la partie
  terminée, plus aucune action n'est possible** ; `reveal()` n'est permis qu'après la fin.
- **Une seule proposition** (`MAX_ATTEMPTS = 1`), comme le jeu officiel à deux joueurs : une
  erreur fait perdre la partie et révèle la mine. La constante permet un mode plus indulgent.
- **Sondages comptés à part des lasers** (« 2 sondages ») ; redemander une case est gratuit.
  Mode « Sonder une case » dans l'onglet Tirs : toucher une case, ou saisir son nom (accessible
  au clavier). Les réponses restent affichées sur la grille et dans la liste des sondages.
- Interface : boutons **Soumettre ma solution** (actif seulement si les 5 gemmes sont posées sans
  violation) et **Abandonner**, chacun avec confirmation ; chronomètre ; onglet **Résultat**
  avec le verdict, les lasers, les sondages, le temps, la graine, la vraie mine, la
  proposition en pointillés (vert / rouge) et une phrase par gemme (« vous l'aviez en F7, elle
  est en A4 ») ; **Nouvelle partie** et **Rejouer cette mine** (même graine).
- Vérifié de bout en bout dans un navigateur : sondes valides et invalides, abandon, victoire
  (les 5 gemmes de la mine reposées à la main), défaite (les gemmes d'une autre mine),
  actions bloquées après la fin, rejeu de la graine.
- **Fini quand :** une partie se joue de la génération au verdict sans erreur. ✔

### v0.10 Sauvegarde locale (S à M) : fait

- `game/save.ts` : format versionné (`SAVE_VERSION = 1`) et **validation stricte**.
  `parseSave` ne renvoie une partie que si tout est cohérent : gemmes exactement celles de la
  partie de base et posées selon les règles, repères et cases valides et sans doublon, statut,
  tentatives et temps plausibles, solution et notes bien formées (taille bornée). Une
  sauvegarde vide, ancienne, tronquée ou modifiée à la main donne `null`.
- `GameSession.toSnapshot / fromSnapshot` : la sauvegarde contient **la mine elle-même**, pas
  seulement la graine, pour survivre à un changement du générateur ; à la reprise les tirs et
  sondes sont **rejoués** sur la mine, ce qui garantit leur cohérence.
- **Temps** : le chronomètre reprend où il s'était arrêté, sans compter le temps passé hors de la
  page (testé avec une horloge injectée).
- `ui/storage.ts` : tout accès au navigateur est dans un `try/catch` (quota, navigation privée,
  stockage désactivé, lecture qui lève une exception). Une sauvegarde illisible est supprimée
  pour ne pas être reproposée. Sans stockage, un avertissement s'affiche et le jeu continue.
- **Sauvegarde automatique** à chaque changement, toutes les 15 s, et quand la page se cache ou
  se ferme (`pagehide`, `visibilitychange`). Sont sauvegardés : la mine, les tirs, les sondes,
  la solution posée, les notes et le temps écoulé. L'historique d'annulation des notes n'est
  pas conservé.
- **Reprise** : à l'ouverture, une partie en cours est proposée (« Reprendre la partie » ou
  « Nouvelle partie »). La sauvegarde est **effacée à la fin de la partie**.
- Hors périmètre v1 (comme prévu) : historique, statistiques, plusieurs parties sauvegardées,
  synchronisation entre appareils (v2).
- Vérifié dans un navigateur : sauvegarde puis rechargement de la page, reprise des tirs, des
  sondes, de la gemme posée, de la note et du temps ; abandon de la sauvegarde ; aucune
  reprise proposée après une partie terminée ; trois types de sauvegarde corrompue ignorés sans
  erreur ; `localStorage` qui lève une exception : avertissement et jeu normal.
- **Fini quand :** fermer l'onglet en pleine partie puis rouvrir le site restaure exactement
  l'état, chronomètre compris. ✔

### v0.11 Page « Règles » et finitions (M) : fait

- **Page « Règles »** (`ui/rules.ts`, adresse `#regles`, lien dans l'en-tête) : but du jeu, grille et
  repères, gemmes (dessinées avec leurs dimensions), règles de placement a à e, trajet du
  rayon avec l'exemple du livret tracé par le simulateur, table des 15 mélanges de couleurs
  générée par `mixColors`, mode d'emploi du site. Elle signale la **particularité de la gemme
  rouge retournable** dans un encadré. Les schémas utilisent les mêmes données que le jeu : ils
  ne peuvent pas contredire le simulateur.
- **Chronomètre en pause** pendant la lecture des règles et quand la page est cachée
  (`GameSession.pause / resume`, testés avec une horloge injectée).
- **Table de chaînes** (`ui/strings.ts`) : onglets, boutons, statuts, réponses aux sondes et
  messages d'aide principaux ; une autre langue ajouterait un objet de même forme.
- **Accessibilité** :
  - les gemmes n'étaient plus distinguées par la seule couleur : **motifs** (rouge hachuré, jaune
    pointillé, bleu rayé, blanc uni) ; les marques de notes portent une lettre ; chaque
    couleur de rayon est aussi écrite en toutes lettres ;
  - clavier : repères et gemmes focalisables, flèches pour déplacer les gemmes, flèches gauche
    et droite entre les onglets, lien d'accès rapide au plateau, formulaire de sonde au clavier ;
  - rôles `tablist` / `tab`, zone `aria-live` pour les résultats, étiquettes explicites ;
    focus toujours visible ; `prefers-reduced-motion` respecté ; thèmes clair et sombre.
- **Mobile et tactile** : onglets défilables, boutons de 44 px, aucune barre de défilement
  horizontale à 360 px, 412 px et 820 px de large ; la grille de solution désactive le défilement
  au doigt (`touch-action: none`) pour que le glisser-déposer ne fasse pas défiler la page, la
  grille de notes aussi quand le crayon ou la gomme est actif.
- Vérifié dans un navigateur : page Règles (5 gemmes, 15 lignes de couleurs), pause du
  chronomètre pendant 3 s de lecture, flèches entre onglets, motifs présents, glisser d'une gemme
  et dessin au crayon avec de **vrais événements tactiles** (profil Pixel 7), aucune erreur.
- Non fait : variantes de difficulté (Diamant, Corps noir), dont les formes sont toujours
  inconnues ; test sur un vrai téléphone.
- **Fini quand :** le parcours complet est validé sur ordinateur et sur téléphone. ✔ (en
  émulation ; un essai sur un vrai téléphone reste souhaitable)

### Critères de sortie : livraison de la v1 : atteints (v1.0.0)

- ✔ Toutes les règles de [`regles.md`](regles.md) de la partie de base sont implémentées et
  testées (201 tests). Seules les extensions Diamant et Corps noir manquent : leurs formes
  sont inconnues.
- ✔ Toute mine générée est valide, visible et unique (100 graines testées ; solveur vérifié contre
  une énumération exhaustive).
- ✔ La sauvegarde locale restaure une partie en cours.
- ✔ Déployée sur GitHub Pages, CI verte.

**Reste à faire avant de s'y fier :** essayer le site sur un vrai téléphone (les tests tactiles
utilisent des événements émulés) et confirmer les dimensions des gemmes sur les pièces.

---

## Vers la v2 : comptes, historique, profil (étapes v1.1 à v1.6)

**Objectif :** connexion Google, historique des parties et page de profil avec deux
statistiques.

Cela impose un **backend**, ce que la v1 évite. Le jeu reste jouable **sans compte** : se
connecter ajoute l'historique, rien de plus.

### v1.1 Choix du backend (S)

Un service géré évite d'écrire un serveur. Deux options réalistes :

| | Supabase | Firebase |
|---|---|---|
| Connexion Google | intégrée | intégrée |
| Base | Postgres (SQL, requêtes d'agrégat simples) | Firestore (documents) |
| Sécurité des données | règles par ligne (RLS) | règles Firestore |
| Statistiques | une requête SQL | calcul côté client ou fonction |

**Recommandation : Supabase**, parce que les deux statistiques demandées sont des
agrégats naturels en SQL et que la sécurité par ligne est simple à écrire. Décision à
confirmer avant de commencer.

### v1.2 Authentification Google (M)

- Connexion et déconnexion OAuth Google ; session persistante.
- Jouer sans être connecté reste possible (sauvegarde locale de la v1 inchangée).
- Écran d'état : connecté / non connecté, avatar et nom affichés.
- Configuration OAuth (écran de consentement, URI de redirection par environnement).
- **Fini quand :** on peut se connecter, se déconnecter, recharger la page et rester connecté.

### v1.3 Modèle de données et sécurité (M)

Table `games` (une ligne par partie terminée), au minimum :

| Champ | Rôle |
|---|---|
| `id`, `user_id` | clés ; `user_id` = utilisateur connecté |
| `seed`, `generator_version` | pour rejouer la mine |
| `status` | `won`, `lost` ou `abandoned` |
| `lasers_count` | lasers tirés pendant la partie |
| `probes_count` | cases sondées (si l'action est retenue) |
| `started_at`, `ended_at`, `duration_s` | temps |
| `shots`, `submission` | JSON : tirs effectués et solution proposée |

- Règles de sécurité : chaque utilisateur ne lit et n'écrit **que ses propres lignes**.
- Migrations versionnées dans le dépôt.
- **Fini quand :** un utilisateur A ne peut jamais lire ni modifier les parties de B
  (test d'accès automatisé).

### v1.4 Enregistrement et historique (M)

- À la fin d'une partie, si connecté : enregistrer la ligne `games`. Gérer l'échec réseau
  (file locale, nouvel essai).
- Page **Historique** : liste paginée (date, résultat, lasers, durée), tri et filtre
  victoire/défaite.
- Option : revoir une partie passée à partir de sa graine et de ses tirs.
- Option : proposer d'importer au premier login les parties terminées stockées en local.
- **Fini quand :** les parties terminées apparaissent dans l'historique, sur n'importe quel
  navigateur où l'on se connecte.

### v1.5 Page de profil (S à M)

Deux statistiques, **calculées à partir de `games`** :

- **Moyenne de lasers tirés avant de gagner** = moyenne de `lasers_count` sur les parties
  **gagnées** uniquement.
- **Pourcentage de parties gagnées** = parties gagnées ÷ parties totales terminées.

Règles de calcul à figer (voir questions ouvertes) :

- Une partie compte dans le total dès qu'elle est terminée : gagnée, perdue ou abandonnée.
  Par défaut, **une partie abandonnée compte comme perdue**.
- Pas de victoire : la moyenne s'affiche « — », jamais 0.
- Pas de partie : « Aucune partie jouée ».
- Affichage : nombre total de parties, victoires, les deux statistiques ; pas de
  classement ni de comparaison entre joueurs.
- **Fini quand :** les valeurs affichées correspondent à un calcul à la main sur un jeu de
  parties de test, cas limites compris.

### v1.6 Vie privée et exploitation (S)

- Ne conserver que le nécessaire de Google (identifiant, nom, avatar).
- Page de confidentialité ; suppression du compte avec **effacement de ses parties**.
- Séparation des environnements (développement / production) et gestion des secrets hors du
  dépôt.

### Critères de sortie : livraison de la v2

- Connexion Google fonctionnelle en production.
- L'historique et le profil reflètent exactement les parties terminées.
- Aucun accès possible aux données d'un autre utilisateur.
- La v1 sans compte continue de fonctionner à l'identique.

### Notes de conception pour la v2

- **Triche et vérification :** les statistiques sont déclarées par le navigateur, donc
  falsifiables. Sans classement, l'enjeu est nul ; on garde pourtant `seed`,
  `generator_version` et `shots` pour pouvoir **rejouer et vérifier côté serveur** plus
  tard si besoin. D'où l'importance de versionner le générateur dès la v1.
- **Futurs possibles, hors v2 :** évolution des statistiques dans le temps, classement,
  défis partagés par graine, variantes avec Diamant et Corps noir.

---

## Vers la v3 : plateau personnalisé et duel contre une IA (étapes v2.1 à v2.7)

**Objectif :** sortir du mode entraînement. Le joueur **cache lui-même ses gemmes** (son plateau) et
affronte une **IA** qui cherche son plateau pendant qu'il cherche celui de l'IA : le premier qui
identifie toutes les gemmes adverses gagne, comme au jeu à deux. Les modes d'entraînement
(v1) restent disponibles.

**Dépend de :** v1 (tout le moteur). La v2 (comptes) est souhaitable pour l'historique et les
statistiques contre l'IA, mais le duel peut d'abord se jouer sans compte.

### v2.1 Éditeur de plateau (M)

- Le joueur place ses 5 gemmes sur son plateau en réutilisant la grille « Gemmes » (glisser-déposer,
  pivoter, retourner la rouge), avec les règles de placement a à e vérifiées en direct.
- Boutons « Au hasard » (réutilise `randomLayout`) et « Valider ».
- **Indicateur d'ambiguïté** : le solveur (`solve.ts`) dit si le plateau est ambigu (plusieurs
  dispositions donnent les mêmes 36 résultats). Au jeu officiel un plateau ambigu est permis ;
  c'est une décision à prendre (voir questions ouvertes).
- Code de partage d'un plateau (position des gemmes encodée) pour le rejouer ou le proposer en défi.
- **Fini quand :** on peut construire, valider et exporter son plateau.

### v2.2 Modèle du duel (M)

- `game/duel.ts` (logique pure, sans DOM) : deux plateaux cachés, une liste de questions par joueur
  (laser ou sonde), réponses données par la machine qui joue le maître du jeu pour les deux côtés.
- Règles de fin de partie du jeu à deux joueurs (livret) : proposition juste = victoire ; fausse =
  défaite immédiate ; si le premier joueur propose juste, l'autre a un dernier tour, et si lui aussi
  réussit, égalité et manche à rejouer. Variantes (essais multiples) via des constantes.
- **Cloisonnement** : chaque camp ne reçoit que les réponses à ses propres questions. Test : aucune
  structure renvoyée à un camp ne contient le plateau de l'autre.
- Deux rythmes, au choix : **tours alternés** (livret) ou **course** (chacun joue à son rythme, sans
  attendre l'autre).
- **Fini quand :** une partie complète joueur contre joueur simulé se déroule dans les tests.

### v2.3 IA : connaissance du plateau adverse (L, risque)

- L'IA ne voit **que les réponses** à ses questions. Elle en déduit l'ensemble des plateaux encore
  possibles.
- Le solveur actuel part de la signature complète (36 tirs) ; il faut le généraliser à une
  information **partielle** (quelques tirs et sondes seulement). Au début, les plateaux possibles se
  comptent en millions : l'IA travaille sur un **échantillon** de plateaux compatibles (tirage par le
  générateur, filtré par les réponses) et vérifie la certitude avec le solveur exact.
- Exécution dans un **Web Worker** pour ne jamais bloquer l'interface ; budget visé : moins de
  500 ms par question.
- **Fini quand :** après chaque réponse, l'IA sait quels plateaux restent possibles, et trouve le
  plateau exact quand la signature est complète.

### v2.4 IA : stratégie et niveaux (M)

- Choix de la prochaine question par **gain d'information** : celle qui partage le mieux les
  plateaux encore possibles (laser ou sonde).
- Moment de la proposition : quand un seul plateau reste compatible (ou, aux niveaux faibles, avec
  une marge de risque).
- **Niveaux** : débutant (questions peu informatives, propose trop tôt), intermédiaire, expert.
  Délai de réflexion simulé pour que l'IA ait un rythme humain en mode course.
- Tests : simulations IA contre IA (nombre moyen de questions par niveau), l'IA ne triche jamais
  (le module ne reçoit pas le plateau adverse), jamais de question illégale.
- **Fini quand :** trois niveaux jouables, mesurés et reproductibles (graine).

### v2.5 Interface du duel (L)

- Écran de duel : son propre plateau (gemmes visibles, questions de l'IA marquées dessus) et le
  plateau de l'adversaire (tirs, sondes, notes, gemmes supposées), réutilisant les composants
  existants ; compatible avec le mode plein écran.
- Indication du tour (ou de l'activité de l'IA en mode course), historique des questions des deux
  camps, proposition finale avec confirmation, écran de résultat avec les deux plateaux révélés.
- **Fini quand :** une partie contre l'IA se joue de l'éditeur de plateau au résultat, sur
  ordinateur et téléphone.

### v2.6 Sauvegarde et historique (S à M)

- Sauvegarde locale de la partie de duel en cours (même mécanisme que la v1, format versionné).
- Si la v2 est livrée : les parties de duel entrent dans l'historique (champs `mode` et `level`),
  et le profil affiche le pourcentage de victoires contre l'IA par niveau.

### v2.7 Équilibrage et finitions (S)

- Parties d'essai à chaque niveau, réglage des niveaux, accessibilité, page Règles complétée
  (règles du duel), textes courts.

### Critères de sortie : livraison de la v3

- Un joueur construit son plateau et joue une partie complète contre l'IA, aux trois niveaux.
- L'IA ne dispose d'aucune information interdite (test automatisé).
- Aucune régression du mode entraînement ni de la sauvegarde.

---

## Vers la v4 : duel en direct contre un autre joueur (étapes v3.1 à v3.7)

**Objectif :** la partie de la v3, mais l'adversaire est **une autre personne**, en ligne et en
temps réel. C'est le jeu de société, à distance.

**Dépend de :** v2 (comptes, pour identifier les joueurs) et v3 (éditeur de plateau, règles du
duel, interface du duel).

**Difficulté centrale : la confiance.** Chaque joueur cache son plateau, mais quelqu'un doit répondre
aux lasers de l'autre sans révéler le plateau. Deux approches :
- **Arbitre serveur (recommandé)** : les deux plateaux sont stockés côté serveur, inaccessibles aux
  joueurs ; le serveur calcule chaque réponse. Comme `src/game/` est du TypeScript pur sans DOM, le
  même code (`shoot`, `probeCell`, `isCorrect`) peut tourner dans une fonction serveur.
- **Pair à pair avec engagement** (sans serveur de jeu) : chaque joueur publie l'empreinte de son
  plateau au départ, répond lui-même aux questions, puis révèle son plateau à la fin pour vérifier
  que toutes ses réponses étaient exactes. Plus léger, mais la triche n'est détectée qu'après coup.

### v3.1 Décisions d'architecture (S)

- Arbitre serveur ou pair à pair ; technologie temps réel (par exemple Supabase Realtime) ; compte
  obligatoire ou invité ; coût et quotas.

### v3.2 Salles et invitations (M)

- Créer une salle (code ou lien), la rejoindre, signaler qu'on est prêt, chacun envoie son plateau
  **sans que l'autre puisse le lire** (règles de sécurité par ligne, ou plateau écrit seulement).
- **Fini quand :** deux comptes se retrouvent dans une salle et valident chacun leur plateau.

### v3.3 Arbitre serveur (L)

- Fonction serveur qui valide un plateau (règles a à e), répond aux lasers et aux sondes, vérifie les
  propositions, impose l'ordre des tours et tient le journal de la partie.
- Réutilise `src/game/` tel quel ; tests partagés avec le front.

### v3.4 Synchronisation temps réel et tours (M)

- Canal temps réel entre les deux joueurs et l'arbitre, machine d'états de la partie, messages
  idempotents (un message rejoué ne change rien), ordre garanti, interface qui reflète l'état serveur.

### v3.5 Robustesse (M)

- Déconnexion et reprise de la partie, délai maximal par tour, abandon et victoire par forfait,
  même compte ouvert dans deux onglets.

### v3.6 Interface de la partie en direct (M)

- Réutilise l'écran de duel de la v3 : salle d'attente, état de l'adversaire (connecté, joue),
  notification de son tour, résultat partagé.

### v3.7 Sécurité, classement et vie privée (M)

- Tests de bout en bout avec **deux clients simulés** ; propriété vérifiée : le plateau d'un joueur
  n'apparaît dans **aucun** message envoyé à l'autre.
- Limitation de débit, signalement d'abus minimal, suppression des données (RGPD).
- Optionnel : classement (Elo) et historique des parties en direct.

### Critères de sortie : livraison de la v4

- Deux personnes jouent une partie complète en direct, sur ordinateur et téléphone.
- Aucune fuite du plateau adverse, aucune triche possible côté client.
- Une déconnexion ne détruit pas la partie.

---

## Évolutions depuis la v1.0.0

- **v1.0.1** : texte minimal dans toute l'interface (libellés courts, plus de paragraphes d'aide,
  page Règles concise).
- **v1.0.2** : l'onglet « Solution » devient **« Gemmes »** ; les gemmes posées et les notes
  s'affichent **en transparence sur l'onglet Tirs**, avec une case à cocher « Notes » pour
  masquer ou afficher les notes ; nouvelle marque de note **« Gris »** pour griser des cases.
- **v1.0.3** : dans l'historique des tirs, une couleur composée garde son nom mais s'affiche avec
  **une pastille par couleur de gemme** qui la compose (violet clair : rouge, bleu, blanc).
- **v1.0.4** : dans l'historique, les pastilles d'une couleur composée sont séparées par un « + »
  et « transparent » n'a **aucune pastille** (ni dans l'historique ni sur les repères) ;
  **sonder = toucher une case** (le bouton et le formulaire « Sonder » disparaissent ; flèches et
  Entrée au clavier) ; un tir ou une sonde demande une **confirmation** en fenêtre modale
  (« Laser en E ? », « Sonder E4 ? ») avec la case « Ne plus demander » valable pour la partie
  (conservée dans la sauvegarde) ; redemander un repère ou une case déjà connus reste gratuit,
  sans confirmation ; plus de cercles rouges et verts autour des repères de l'onglet Gemmes.
- **v1.0.5** : les notes s'affichent aussi **en transparence sur l'onglet Gemmes**, avec la même
  case « Notes » ; sur les repères, le **numéro du tir** figure en haut à droite (entrée) et dans la
  pastille de couleur en bas à droite (sortie), y compris dans l'onglet Notes (pour « transparent » :
  le numéro seul, sans pastille) ; les gemmes ont **le même trait partout** (réserve, grille,
  résultat, transparence), et en transparence le fond s'efface mais les traits restent aussi foncés
  que dans les règles ; sur l'onglet Gemmes, une gemme sélectionnée porte un **bouton rond ↻** à son
  coin haut-droit (et **⇋** pour la rouge) ; la barre « Pivoter / Retourner / Retirer » disparaît
  (pour retirer une gemme : la glisser hors de la grille, ou `Suppr`).
- **v1.0.6** : l'historique des tirs **prolonge la page** au lieu d'être une liste à défiler ; la
  marque « gris » des notes devient **« Vide »**, dessinée par des **stries diagonales grises
  transparentes** (l'ancienne croix ✕ disparaît ; les anciennes sauvegardes « grisée » sont lues
  comme « vide ») ; **correction** : l'onglet Résultat redevient accessible après un autre onglet ;
  sur l'onglet Résultat, les **36 repères sont cliquables** : un laser libre est tiré dans la mine
  révélée et son trajet est tracé (gratuit, hors compteur).
- **v1.0.7** : retour au dessin des gemmes d'avant la v1.0.5 (contour, transparence), puis les gemmes
  portent le **quadrillage des vraies pièces** : les lignes de la grille qui les traversent, en une
  teinte **un peu plus foncée que la gemme**, alignées sur les cases pour aider à les placer (réserve,
  grille, résultat, règles, transparence). Il remplace les motifs hachurés, pointillés et rayés
  de la v0.11. Calcul : `gridSegments` (`game/geometry.ts`, testé).
- **v1.0.8** : l'onglet Notes affiche les gemmes posées **en transparence, comme l'onglet Tirs** (le
  dessin reste possible par-dessus) ; la **version du build** (`v1.0.8`, lue dans `package.json`)
  s'affiche en petit, en haut à droite du site (jeu et page Règles).
- **v1.0.9** : **mode plein écran** pour téléphone en paysage (bouton « Plein écran » dans
  l'en-tête). Une seule grille où l'on peut en même temps tirer des lasers (repères du bord),
  sonder des cases, déplacer les gemmes et dessiner ; la réserve de gemmes est à droite de la
  grille et une colonne d'outils (Jouer, Crayon, Gomme, Vide, encres,
  annuler / rétablir, compteur, chrono, Soumettre / Abandonner) tient à côté. L'outil « Jouer » déplace les
  gemmes et sonde les cases ; avec un outil de dessin, les gemmes deviennent inertes pour que le trait
  passe dessus, mais les repères du bord restent cliquables. Plein écran du navigateur et verrouillage
  en paysage quand le navigateur les permet (Android) ; sur iPhone la grille occupe tout l'écran sans
  barre du navigateur seulement si le site est ajouté à l'écran d'accueil. En portrait : « ↻ Paysage ».
  Correction associée : le « clic » qui suit un geste sur une gemme ne sonde plus la case dessous.
- **v1.0.10** : dans le mode plein écran, les boutons de marques **R, J, B, Bl et ?** sont retirés
  (restent Jouer, Crayon, Gomme, Vide, les encres, annuler / rétablir).
- **v1.0.11** : les boutons ronds de la gemme sélectionnée (pivoter, retourner) **disparaissent** quand
  on change d'onglet, de mode ou d'outil, ou qu'on touche ailleurs que sur une gemme ou ses boutons.
- **v1.0.12** : l'encre **verte** du crayon est supprimée (aucune gemme n'est verte) ; il reste noir,
  rouge, jaune et bleu. Les anciens traits verts des sauvegardes redeviennent noirs.

## Questions ouvertes

- **Duel (v3) : plateau ambigu permis ?** Le jeu officiel l'autorise ; l'entraînement l'interdit
  (une seule solution). Proposition : avertir le joueur et lui laisser le choix, avec une option
  « imposer un plateau unique » pour que la partie reste toujours gagnable.
- **Duel (v3) : « en même temps » ou tour par tour ?** Tu as écrit que l'IA joue en même temps que
  toi : course où chacun joue à son rythme ? Le livret prévoit des tours alternés. Proposition :
  prévoir les deux, avec la course par défaut ; à confirmer.
- **Duel (v3) : règle de fin.** Livret (une erreur = défaite, dernier tour pour le second joueur)
  ou règle plus indulgente (deux essais) ?
- **IA (v3) :** exécutée dans le navigateur (gratuit, hors ligne) : proposition retenue.
- **En direct (v4) :** arbitre serveur ou pair à pair avec engagement ? Compte obligatoire ou
  invités ? Chronomètre par tour ?
- Soumission : une seule tentative (comme à deux joueurs, une erreur = défaite) ou
  plusieurs essais ?
- Un « sondage de case » compte-t-il dans le nombre de lasers ? Proposition : non, on le
  compte à part (`probes_count`), et la moyenne de la v2 ne porte que sur les lasers.
- Une partie abandonnée compte-t-elle comme perdue dans le pourcentage de victoires ?
  Proposition : oui.
- Limite de lasers imposée ou simple compteur ?
- Dimensions des gemmes et règle d de contact : voir [`regles.md`](regles.md).
- Supabase ou Firebase pour la v2 ?
