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
  sur une face perpendiculaire. `shoot` tire depuis un repère, `shootAll` depuis les 36.
  Le résultat donne l'entrée, la sortie, la couleur, les
  couleurs touchées, les contacts et le trajet à dessiner.
- `colors.ts` : table de mélange des 16 combinaisons, indexée par l'ensemble des couleurs
  distinctes touchées.
- « Signal absorbé » : il n'existe que pour le Corps noir (extension, ajoutée en v1.0.13).
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

### v0.5 Générateur à graine (M) : fait

- `rng.ts` : PRNG mulberry32 à graine texte ; `Math.random()` n'est utilisé que pour proposer
  une nouvelle graine (`randomSeed`). `GENERATOR_VERSION` accompagne chaque mine.
- `generate.ts` : tirage des 5 gemmes de la partie de base (position et orientation au hasard,
  rejet si une règle de placement est violée), puis filtre de visibilité (règle e). Même graine
  et même version : même mine.
- Tests : 100 graines donnent des mines valides et visibles ; même graine, même mine.
- **Fini quand :** « nouvelle mine » répond immédiatement et toute mine produite est valide et
  visible. ✔

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
  compteur de tirs, historique numéroté (cliquer un tir le met en avant sur la grille),
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
- **Sondages** (comptés comme des tirs depuis la v1.0.17) ; redemander une case est gratuit.
  Mode « Sonder une case » dans l'onglet Tirs : toucher une case, ou saisir son nom (accessible
  au clavier). Les réponses restent affichées sur la grille et dans la liste des sondages.
- Interface : boutons **Soumettre ma solution** (actif seulement si les 5 gemmes sont posées sans
  violation) et **Abandonner**, chacun avec confirmation ; chronomètre ; onglet **Résultat**
  avec le verdict, le temps, la graine, la vraie mine, la
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
- ✔ Toute mine générée est valide et visible (100 graines testées).
- ✔ La sauvegarde locale restaure une partie en cours.
- ✔ Déployée sur GitHub Pages, CI verte.

**Reste à faire avant de s'y fier :** essayer le site sur un vrai téléphone (les tests tactiles
utilisent des événements émulés) et confirmer les dimensions des gemmes sur les pièces.

---

## Vers la v2 : comptes, historique, profil (étapes v1.1 à v1.6)

**Objectif :** connexion Google, historique des parties et page de profil avec deux
statistiques.

Cela impose un **backend**, ce que la v1 évite. Le jeu reste jouable **sans compte**, mais
limité à **une seule partie à la fois** (voir « Vues et compte » ci-dessous) : se connecter débloque
plusieurs parties, la liste des parties en cours, l'historique et le profil.

### Vues et compte (valable pour toute la v2)

Le site passe d'une page de jeu à **trois vues** (plus la page Règles, inchangée). Navigation par
l'adresse (`#/`, `#/partie`, `#/profil`, `#regles`), sans rechargement ; un lien `?seed=…` ouvre
directement la vue partie.

| Vue | Adresse | Contenu |
|---|---|---|
| **Accueil** (vue par défaut) | `#/` | la **partie en cours** (bouton « Reprendre »), la **liste des parties non terminées** (connecté seulement), le bouton **« Nouvelle partie »** |
| **Partie** | `#/partie` | la vue actuelle : grille de tir, notes, gemmes à placer, résultat, plein écran |
| **Profil** | `#/profil` (connecté) | nom Google, **pourcentage de parties gagnées**, moyenne de tirs avant victoire, **historique** des parties jouées |

- **En-tête** : le **titre du site**, en haut à gauche, ramène à l'accueil ; en haut à droite, un
  bouton **« Connexion »** (non connecté) ou **« Déconnexion »** (connecté) qui lance l'OAuth Google ;
  la version du build reste en petit à côté. Le nom du joueur, cliquable, mène au profil.
- **Sans compte** : **une seule partie à la fois**, celle de la sauvegarde locale. L'accueil la
  propose (« Reprendre »). Tant qu'elle n'est ni terminée ni abandonnée, « Nouvelle partie » n'est
  pas disponible (reprendre, abandonner ou se connecter) ; une fois terminée, on peut en lancer une
  autre. Pas de liste, pas d'historique, pas de profil.
- **« Nouvelle partie »** (accueil) ouvre la fenêtre des **extensions** (Diamant, Corps noir),
  la même qu'au début d'une partie, puis lance la génération et ouvre la vue Partie.
- **Avec compte** : plusieurs parties en cours en même temps, chacune reprise depuis l'accueil.
  Les parties en cours sont donc **stockées côté serveur** (voir v1.3), pas seulement les parties
  terminées.
- Une partie « en cours » n'entre pas dans les statistiques ; une partie terminée ou abandonnée y
  entre.

### v1.1 Choix du backend (S) : fait

Un service géré évite d'écrire un serveur. Deux options étaient réalistes :

| | Supabase | Firebase |
|---|---|---|
| Connexion Google | intégrée | intégrée |
| Base | Postgres (SQL, requêtes d'agrégat simples) | Firestore (documents) |
| Sécurité des données | règles par ligne (RLS) | règles Firestore |
| Statistiques | une requête SQL | calcul côté client ou fonction |

**Décision : Supabase**, parce que les deux statistiques demandées sont des agrégats naturels
en SQL et que la sécurité par ligne est simple à écrire (et à tester en SQL pur dans la CI).

Autres décisions prises avec le propriétaire :

- **Une partie abandonnée compte comme perdue** dans le pourcentage de victoires ; la moyenne de
  lasers ne porte que sur les victoires.
- **Le code est écrit sans projet Supabase** : clés dans `VITE_SUPABASE_URL` et
  `VITE_SUPABASE_ANON_KEY` ; sans clés, le site reste en mode v1 (aucun bouton de connexion). La
  création du projet, l'identifiant OAuth Google et les variables du déploiement sont à faire par
  le propriétaire : guide pas à pas dans [`backend.md`](backend.md).
- **Sécurité par ligne testée en CI** : des tests SQL sur un Postgres vide (deux utilisateurs
  simulés), en plus des tests Vitest.
- Pas d'import des parties locales au premier login : la v1 n'en garde aucune (la sauvegarde est
  effacée à la fin de la partie).
- **Fini quand :** le choix est écrit et le guide de mise en place existe. ✔

### v1.2 Vues, navigation et authentification Google (M) : fait

**Fait (authentification)** :

- `src/backend/` : `config.ts` (lit `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` ; absentes ou
  invalides : `null`), `auth.ts` (service de connexion au-dessus d'un client Supabase, testé avec un
  faux client), `index.ts` (crée le client **à la demande** : sans configuration, la bibliothèque
  n'est même pas téléchargée).
- Connexion et déconnexion OAuth Google (flux PKCE), session persistante (gérée par Supabase),
  retour sur la page sans paramètres : la partie en cours est sauvegardée en local avant de partir
  et reprise au retour.
- Le service ne retient que l'identifiant, le nom et l'avatar (https uniquement) ; le nom est échappé
  avant d'être affiché. Les renouvellements de jeton ne redessinent pas la page.
- En-tête : bouton « Se connecter » ; connecté : avatar, nom, « Déconnexion ». Aucun changement sans
  configuration. Jouer sans compte fonctionne comme avant.
- Configuration OAuth, écran de consentement et adresses de redirection : [`backend.md`](backend.md)
  (étapes à faire par le propriétaire). `.env.example` donne les deux variables.
- Vérifié dans un navigateur avec une configuration factice : bouton absent sans variables, présent
  avec ; session simulée : avatar et nom affichés, balise dans le nom neutralisée. La connexion
  Google réelle reste à essayer une fois le projet Supabase créé.
- **Fini quand :** on peut se connecter, se déconnecter, recharger la page et rester connecté. (Code
  et tests ✔ ; essai réel en attente du projet Supabase.)

**Fait (vues et navigation, v2.1.0)** :

- **Routeur** par adresse (`ui/router.ts`, testé) : `#/` accueil (par défaut), `#/partie`,
  `#/regles`, `#/historique`, `#/profil`, `#/confidentialite` ; les anciennes adresses restent
  comprises ; une page de compte sans compte configuré, ou `#/partie` sans partie, retombe sur
  l'accueil (l'adresse est corrigée sans ajouter d'entrée à l'historique du navigateur). Un lien
  `?seed=…` lance cette mine directement ; la graine est retirée de l'adresse quand la partie se
  termine (un rechargement ne relance rien).
- **Barre du haut** (`ui/header.ts`, sur toutes les pages sauf le plein écran, collée en haut) : à
  gauche « Orapa Training » (ramène à l'accueil) suivi de la **version**, « Nouvelle partie »,
  « Règles » ; à droite « Historique », « Profil » (avatar du compte, jamais le nom ; icône de
  personne sans avatar), « Déconnexion », ou « Connexion » si déconnecté. Sans backend : aucun
  bouton de compte ; aucun bouton avant que la session soit lue (pas de clignotement).
- **Accueil** (`ui/home.ts`) : la partie en cours (graine, extensions, tirs, temps ; Reprendre,
  Abandonner avec confirmation) et « Nouvelle partie » (fenêtre des extensions). Une partie
  sauvegardée revient en mémoire au chargement ; sur `#/partie` un rechargement la reprend
  directement (plus d'écran « Reprendre » intermédiaire).
- **Sans compte, une seule partie à la fois** : « Nouvelle partie » est désactivée (barre et accueil)
  tant que la partie n'est ni terminée ni abandonnée ; un lien vers une autre mine est ignoré
  (la partie en cours est gardée). Après la fin, « Nouvelle partie » et « Rejouer » refonctionnent.
- **Barre de la partie** : graine, extensions, « Lien » (copie l'adresse `?seed=…&ext=…` qui relance
  la même mine, pour la partager ou la rouvrir) et **plein écran** devenu un **pictogramme**, affiché
  seulement sur écran tactile (`pointer: coarse`).
- Avec compte, cette règle est levée (v2.2.0) : plusieurs parties en cours, enregistrées sur le compte
  (voir v1.3 et v1.4).
- Vérifié dans un navigateur : accueil avec et sans partie, démarrage, rechargement sur la partie et
  sur l'accueil, lien vers une autre mine, abandon depuis l'accueil, lien partagé, retour arrière,
  `#/partie` sans partie, pages de compte sans backend, icône de plein écran masquée sur ordinateur
  et affichée (sans débordement horizontal) sur un profil de téléphone.
- **Fini quand :** on navigue entre les trois vues, on peut se connecter, se déconnecter, recharger
  la page et rester connecté. ✔ (essai réel de la connexion en attente du projet Supabase)

### v1.3 Modèle de données et sécurité (M) : fait

Table `games` (une ligne par partie terminée), migration
`supabase/migrations/20261115000001_games.sql` :

| Champ | Rôle |
|---|---|
| `id`, `user_id` | `id` tiré par le navigateur au début de la partie (renvoyer la même partie ne crée pas de doublon) ; `user_id` = utilisateur connecté, rempli par la base |
| `seed`, `generator_version`, `extensions` | pour rejouer la mine (`extensions` : `''`, `d`, `n` ou `dn`, comme l'adresse) |
| `status` | `won`, `lost` ou `abandoned` |
| `lasers_count`, `probes_count`, `shots_count` | lasers tirés, cases sondées, et leur total `shots_count` (colonne calculée : depuis la v1.0.17 un laser et une sonde comptent chacun pour un tir) |
| `started_at`, `ended_at`, `duration_s` | temps |
| `shots`, `submission` | JSON : repères tirés dans l'ordre, gemmes proposées (`null` si abandon) |

- **Sécurité par ligne** (RLS, forcée) : chaque utilisateur ne lit, n'écrit et ne supprime que ses
  parties ; `anon` n'a aucun droit ; **aucun droit de mise à jour** (une partie est immuable).
  Contraintes de forme : statut, bornes, `lasers_count` = nombre de repères tirés, proposition
  présente sauf abandon, tailles de JSON bornées. La migration 4 (v1.0.17) ajoute `shots_count`,
  colonne **calculée** = lasers + sondes (un seul compteur de tirs, comme en jeu).
- **Tests SQL** (`supabase/tests/`, `npm run test:db`, job `database` de la CI avec un Postgres
  vide) : deux utilisateurs simulés ; A ne lit, n'écrit au nom de B, ne modifie ni ne supprime les
  parties de B (et inversement) ; `anon` bloqué ; identifiant déjà pris par un autre : rien n'est
  écrasé ni révélé ; contraintes de forme ; suppression du compte emporte ses parties. Vérifiés
  « à l'envers » : affaiblir une politique (lecture, écriture, droit de mise à jour, RLS coupée) fait
  échouer les tests.
- `src/game/record.ts` : `buildRecord` (partie terminée → enregistrement), `recordToRow`,
  `parseRow` (valide une ligne avec les mêmes bornes que la base : une partie refusée par la base ne
  peut pas bloquer la file d'envoi de la v1.4). Aucune mine dans l'enregistrement.
- **Fini quand :** un utilisateur A ne peut jamais lire ni modifier les parties de B (test d'accès
  automatisé). ✔
- **Parties en cours côté serveur (v2.2.0)**, migration `20261115000005_playing_games.sql` : la table
  contient aussi des parties **en cours** (`status = 'playing'`, colonne `snapshot` = la sauvegarde
  du site, mine comprise, `ended_at` vide) en plus des terminées (`snapshot` effacé). `updated_at`
  suit chaque modification. Règles : un propriétaire ne **modifie** que ses parties **en cours** et
  seulement les colonnes qui évoluent (jamais le propriétaire, la graine, l'identifiant) ; une partie
  terminée redevient **immuable** ; au plus **10 parties en cours par compte** (déclencheur, erreur
  `23514`) ; snapshot borné à 250 000 caractères ; les parties en cours sont **hors de l'historique
  et des statistiques**. Le snapshot (qui contient la mine) n'est lisible que par son propriétaire.
  Tests SQL (`progress.test.sql`) : formes valides et invalides, B ne lit ni ne modifie ni ne
  supprime les parties en cours de A, synchronisation, colonnes verrouillées, fin de partie puis
  immuabilité, terminer deux fois, abandon, limite de dix (et place libérée à la fin d'une partie),
  statistiques sans les parties en cours, suppression du compte. Vérifiés « à l'envers » : politique
  de modification trop large, droit de modification trop large, limite retirée, contraintes
  retirées, statistiques qui comptent les parties en cours.

### v1.4 Parties enregistrées et historique (M) : fait pour les parties terminées

- **Enregistrement** : à la fin d'une partie (victoire, défaite ou abandon), si le joueur est
  connecté, la partie est mise dans une **file d'envoi** locale (`backend/outbox.ts`) puis envoyée
  (`backend/games.ts`, `upsert` qui ignore les doublons : renvoyer la même partie ne crée rien).
  Chaque partie a un identifiant tiré au début (conservé par la sauvegarde locale, donc stable
  après une reprise). La mine n'est jamais envoyée : graine, version du générateur, extensions,
  repères tirés et proposition suffisent à la rejouer. Sans compte, rien n'est enregistré.
- **Coupure réseau** : la partie reste en file (même après rechargement), nouvel essai à la
  connexion, au retour du réseau (`online`) et par délais croissants (15 s à 5 min). Chaque entrée
  porte l'utilisateur qui jouait : la partie de A ne part jamais sous le compte de B. Un refus
  définitif de la base (contrainte violée) retire l'entrée au lieu de la rejouer sans fin ; la file
  est bornée (50). Sur l'écran de résultat : « ✓ Enregistrée » ou « En attente ».
- **Page Historique** (`#historique`, lien visible une fois connecté, `ui/history.ts`) : liste
  paginée (20 par page) avec date, résultat, tirs (lasers + sondes), durée et lien **Rejouer** (même graine, mêmes
  extensions) ; filtre Toutes / Victoires / Défaites (les abandons comptent comme des défaites,
  comme dans les statistiques) ; tri Récentes / Anciennes / Moins de tirs (départage stable par
  identifiant) ; états chargement, vide et erreur avec « Réessayer ». Déconnexion ou changement de
  compte : la liste affichée est oubliée.
- **Correction de sécurité** : la graine (venant de l'adresse `?seed=` ou de la sauvegarde) était
  insérée sans échappement dans l'en-tête et dans l'écran de reprise : un lien piégé pouvait
  exécuter du script dans la page, ce qui devient grave avec une session de compte. Elle est
  maintenant échappée partout (et vérifiée dans un navigateur).
- Non fait, volontairement : revoir une partie passée case par case (« Rejouer » refait la même
  mine, le déroulé des tirs est conservé en base pour plus tard) ; import des parties locales au
  premier login (la v1 n'en garde aucune).
- Tests : file d'envoi (coupure, rechargement, utilisateurs séparés, refus définitif, un seul envoi
  à la fois, stockage corrompu ou plein), service (requêtes, erreurs, lignes illisibles), page
  (échappement, états, pagination), sauvegarde (identité de la partie, anciennes sauvegardes).
  Vérifié dans un navigateur avec une API Supabase simulée : envoi réel par `supabase-js`
  (`on_conflict=id`, `resolution=ignore-duplicates`), historique, filtre, tri, coupure puis envoi au
  rechargement.
- **Fini quand :** les parties terminées apparaissent dans l'historique, sur n'importe quel
  navigateur où l'on se connecte. (Code et tests ✔ ; essai réel en attente du projet Supabase.)
- **Parties en cours (v2.2.0)** : connecté, la partie est **créée en base au lancement** et sa
  sauvegarde est **synchronisée** (`backend/sync.ts`) : la dernière version de chaque partie, au plus
  toutes les 8 s, seulement si elle a changé (le temps qui passe seul ne compte pas), avec délais
  croissants après une coupure, envoi immédiat à la déconnexion, au retour du réseau et quand la page
  se cache ; un refus définitif de la base (dix parties…) laisse la partie seulement locale. La fin
  de partie passe la ligne à `won`, `lost` ou `abandoned` (file d'envoi existante, `finish` : mise à
  jour de la partie en cours, sinon création terminée, sans doublon).
- **Accueil** : la partie chargée dans la fenêtre, puis la **liste des parties en cours du compte**
  (graine, extensions, tirs, temps, dernière modification ; Reprendre, Abandonner avec confirmation,
  sans les charger). « Reprendre » charge le snapshot (validé comme une sauvegarde locale) ; la partie
  chargée jusque-là est d'abord mise à l'abri sur le compte. Avec un compte, « Nouvelle partie » est
  toujours possible, sauf à dix parties en cours (message sur l'accueil).
- **Import** : la partie locale en cours n'est jamais envoyée sans accord : à la connexion l'accueil
  propose **« Importer »** ; elle est aussi importée d'office avant qu'on lance ou reprenne une autre
  partie (sinon elle serait perdue), et si elle a été lancée par un lien avant que le compte soit
  connu. Chaque sauvegarde locale garde le compte auquel sa partie est reliée (`owner`) : la partie
  d'un compte ne part jamais sous un autre. Déconnecté, la partie chargée redevient locale.
- Vérifié dans un navigateur avec un faux serveur PostgREST en mémoire et deux « appareils » : création
  au lancement, synchronisation espacée, liste et reprise sur l'autre appareil, deux parties en
  cours, abandon à distance, fin de partie sans doublon, limite de dix, import, lien partagé avec
  compte, coupure puis retour du réseau, déconnexion.
- **Pas fait** : l'historique reste une **page à part** (`#/historique`) et non dans la vue Profil, à
  la demande du propriétaire ; deux appareils qui jouent la **même** partie en même temps s'écrasent
  (la dernière version gagne).
### v1.5 Vue Profil (S à M) : fait (page séparée `#profil`, historique à part)

Deux statistiques, **calculées par la base à partir de `games`** (fonction `profile_stats()`,
migration `20261115000002_profile_stats.sql`, droit d'exécution réservé aux utilisateurs connectés,
filtre explicite sur l'utilisateur en plus de la sécurité par ligne) :

- **Moyenne de tirs avant de gagner** (lasers **et** sondes, depuis la v1.0.17) = moyenne de
  `shots_count` sur les parties **gagnées** uniquement (arrondie à 2 décimales en base, 1 à
  l'écran). La fonction a été recréée par la migration `20261115000004_shots_count.sql`
  (`avg_shots_to_win`) ; la migration 2 reste telle quelle.
- **Pourcentage de parties gagnées** = parties gagnées ÷ parties totales terminées (1 décimale au
  plus à l'écran : « 66,7 % »).

Règles de calcul (figées, testées) :

- Une partie compte dans le total dès qu'elle est terminée : gagnée, perdue ou abandonnée ;
  **une partie abandonnée compte comme perdue**.
- Pas de victoire : la moyenne vaut `null` et s'affiche « — », jamais 0 (une vraie moyenne de 0
  tir, possible, s'affiche « 0 »). Le pourcentage vaut alors 0 %.
- Pas de partie : « Aucune partie jouée » (taux et moyenne `null`).
- Affichage (`#profil`, `ui/profile.ts`) : avatar et nom, nombre de parties, victoires, % de
  victoires, tirs par victoire ; pas de classement ni de comparaison entre joueurs. Chargement,
  erreur avec « Réessayer » ; les chiffres sont rechargés quand une partie en file est envoyée.
- Tests SQL (`supabase/tests/profile.test.sql`) sur des jeux de parties dont les résultats sont
  calculés à la main : mélange de victoires, défaites et abandons (3 victoires sur 6 parties,
  moyenne 5 + 10 + 8 = 7,67 ; les tirs des parties perdues ou abandonnées ne comptent pas ; un
  joueur dont les victoires comptent des sondes : (3 + 2 + 4) / 2 = 4,5 tirs),
  aucun joueur, aucune victoire, une seule victoire, victoires à 0 laser, isolation entre
  utilisateurs, accès refusé sans connexion. Les tests échouent si l'on change la règle (moyenne sur
  toutes les parties, abandons exclus du total, moyenne ramenée à 0). Tests Vitest : lecture et
  cohérence de la ligne reçue, mise en forme, états de la page.
- **Fini quand :** les valeurs affichées correspondent à un calcul à la main sur un jeu de parties
  de test, cas limites compris. ✔

### v1.6 Vie privée et exploitation (S) : fait

- **Données minimales** : le site n'utilise du compte Google que le **nom** et l'**avatar**
  (l'identifiant sert de clé) ; Supabase garde aussi l'adresse e-mail pour la connexion (on ne peut
  pas la refuser), le site ne la lit jamais. Chaque partie ne contient ni la mine, ni les notes, ni
  les dessins.
- **Page Confidentialité** (`#confidentialite`, lien en bas du jeu une fois le backend branché et
  sur la page Profil) : ce qui est gardé et où (Supabase ; navigateur), ce qui ne l'est jamais, les
  droits (consulter, se déconnecter, supprimer). Sans backend, la page dit que rien ne quitte le
  navigateur.
- **Suppression du compte** : bouton avec confirmation ; la fonction SQL `delete_my_account()`
  (`security definer`, sans paramètre : elle ne vise que `auth.uid()`) supprime le compte, et ses
  parties partent avec (clé étrangère en cascade) ; la session locale et la file d'envoi de cet
  utilisateur sont effacées, retour au jeu sans compte. En cas d'échec, rien n'est supprimé et on
  reste connecté. Tests SQL (`account.test.sql`) : refusé sans connexion, n'efface que l'appelant et
  ses parties, un compte déjà supprimé ne provoque pas d'erreur.
- **Environnements et secrets** : un projet Supabase par environnement ; la configuration passe par
  `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (publiques) : `.env.local` en développement,
  *variables* du dépôt GitHub en production (`deploy.yml` les transmet au build ; absentes, le site
  est publié sans connexion). Les fichiers `.env*` sont ignorés par git (sauf `.env.example`). Le
  secret client Google reste dans Supabase. Un test échoue si `service_role`, `sb_secret_` ou un
  jeton JWT apparaît dans le code du site, ou si une autre variable `VITE_*` est lue.
- **Politique de sécurité du contenu** (build seulement) : `script-src 'self'`, requêtes sortantes
  limitées au projet Supabase configuré, avatars Google en https. Vérifiée dans un navigateur sur le
  build : aucune violation en jeu normal, un script injecté ne s'exécute pas. Elle double la
  correction d'échappement de la v1.4.
- **Fini quand :** un utilisateur peut effacer son compte et ses parties, et aucun secret n'est dans
  le dépôt. ✔

### Critères de sortie : livraison de la v2 (v2.2.0)

- **Code et tests : atteints.** Les trois vues sont navigables, le titre ramène à l'accueil, l'accueil
  liste les parties en cours ; historique et profil reflètent exactement les parties terminées (tests
  SQL et Vitest) ; aucun accès possible aux données d'un autre utilisateur (tests SQL, en CI) ;
  la v1 sans compte fonctionne à l'identique (sans variables, aucun bouton, aucun appel réseau, la
  bibliothèque n'est pas chargée).
- **Reste à faire par le propriétaire, pour la mise en service** : créer le projet Supabase, appliquer
  les migrations, créer l'identifiant OAuth Google, renseigner les variables du dépôt (guide pas à
  pas : [`backend.md`](backend.md)), puis **essayer la connexion Google réelle** et une partie
  complète de bout en bout. Tout ce qui précède a été vérifié contre une API Supabase simulée, pas
  contre un vrai projet.
- Ajouter, si la loi l'exige pour ce site, un contact et les mentions légales sur la page
  Confidentialité (le texte actuel n'en contient pas).

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
- Elle ne dispose que d'une information **partielle** (quelques tirs et sondes). Au début, les
  plateaux possibles se comptent en millions : l'IA travaille sur un **échantillon** de plateaux
  compatibles (tirage par le générateur, filtré par les réponses).
- Exécution dans un **Web Worker** pour ne jamais bloquer l'interface ; budget visé : moins de
  500 ms par question.
- **Fini quand :** après chaque réponse, l'IA sait quels plateaux restent possibles, et trouve le
  plateau exact quand l'information suffit.

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
- **v1.0.13** : les **extensions**. Au début de chaque nouvelle partie, une fenêtre propose le
  **Diamant** (demi-losange 2×1, transparent : il dévie le rayon sans changer sa couleur) et le
  **Corps noir** (rectangle 2×1 posé sur sa base, il absorbe le rayon). Le générateur, la sauvegarde, la réserve de gemmes (normale et plein écran), le résultat et la page
  Règles les gèrent ; le choix figure dans l'adresse (`?seed=…&ext=dn`). Un rayon ou une sonde
  absorbés affichent un **signal wifi rouge barré « Signal perdu »** (message, historique, repère
  d'entrée, case sondée).
- **v1.0.14** : en plein écran, la réserve est élargie pour contenir toutes les gemmes (le **triangle
  jaune** et le **corps noir** dépassaient de son cadre) ; **toucher un repère déjà tiré** ouvre une
  **modale de résumé** (« E → F » et les pastilles de la couleur obtenue ; « transparent » écrit en
  toutes lettres, « Signal perdu » avec son pictogramme) qui se ferme par sa croix ou d'un clic
  n'importe où. C'est gratuit et sans confirmation, même si « Ne plus demander » est coché.
- **v1.0.15** : le **Diamant** s'affiche **creux** : bordure bleue franche et centre de la même teinte à
  30 % d'opacité (grille visible au travers), dans la réserve, la grille, le résultat, les règles et
  les sondes.
- **v1.0.16** : la génération ne filtre plus que par les règles de placement (a à d) et la visibilité
  (règle e) ; elle est instantanée et la suite de tests passe de 48 s à 1 s. `GENERATOR_VERSION` passe
  à 2 : une même graine ne redonne plus la mine d'avant (les sauvegardes, qui stockent la mine
  elle-même, ne sont pas touchées).
- **v1.0.17** : Les extensions s'appellent **Diamant** et **Corps noir** partout (interface, règles, docs). Les
  **sondes comptent comme des lasers** : un seul compteur de **tirs** (lasers + sondes de cases), le
  compteur de sondes disparaît ; `shots_count` remplace `lasers_count` et `probes_count` en v2. Les
  **extensions** de la partie (« Sans extension », « Diamant », « Corps noir ») s'affichent à côté de
  la graine. Arbitrage du propriétaire, noté dans `regles.md` : sonder un corps noir répond
  « signal perdu », sonder un diamant répond « diamant ».

- **v2.0.0** : première livraison de la v2 (étapes v1.1 à v1.6 : Supabase, connexion Google, historique
  des parties terminées, profil, confidentialité), fusionnée avec la v1.0.17 en **v2.0.1** (sondes
  comptées comme des tirs, migration 4).
- **v2.1.0** : barre du haut (titre + version, Nouvelle partie, Règles ; Historique, Profil avec
  avatar, Connexion / Déconnexion), routeur (`#/`, `#/partie`…), accueil, une seule partie à la fois
  sans compte, plein écran en pictogramme sur écran tactile seulement (voir v1.2).
- **v2.2.0** : parties en cours côté serveur (migration 5), liste sur l'accueil, reprise sur un autre
  appareil, import, abandon à distance, dix parties en cours au plus (voir v1.3 et v1.4). La v2 est
  complète côté code ; reste la mise en service.

## Questions ouvertes

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
- ~~Un « sondage de case » compte-t-il dans le nombre de lasers ?~~ Décidé en v1.0.17 : oui, un seul
  compteur de **tirs** (lasers + sondes) ; la moyenne du profil porte sur les tirs.
- ~~Une partie abandonnée compte-t-elle comme perdue dans le pourcentage de victoires ?~~ Décidé en
  v1.1 : oui.
- Limite de tirs imposée ou simple compteur ?
- Dimensions des gemmes : voir [`regles.md`](regles.md). (Règle d de contact : tranchée, voir `regles.md`.)
- ~~Supabase ou Firebase pour la v2 ?~~ Décidé en v1.1 : Supabase.
- ~~Nombre maximal de parties en cours par compte~~ : décidé en v2.2.0, 10 (imposé par la base).
