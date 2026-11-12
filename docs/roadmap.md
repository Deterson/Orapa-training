# Roadmap

Deux versions livrables : **v1** = le jeu complet, jouable hors ligne, avec une simple
sauvegarde locale ; **v2** = comptes Google, historique et page de profil.

**Numérotation.** Une étape porte le numéro de la version qu'elle prépare, pas de celle
qu'elle livre : les étapes **v0.1 à v0.11** construisent la **v1**, qui sort quand la
v0.11 est terminée ; les étapes **v1.1 à v1.6** construisent la **v2**, qui sort quand la
v1.6 est terminée. La version v1.0 est donc la première version complète du jeu.

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

### v0.8 Interface : notes et dessin (M)

- Calque d'annotation par case : couleur, croix « vide », crayon, gomme, annuler/rétablir.
- Aucun effet sur la correction.
- **Fini quand :** les notes se superposent à la grille de tir ou s'affichent à côté,
  sans gêner les autres interactions.

### v0.9 Soumission et fin de partie (M)

- Soumission : égalité stricte entre la grille joueur et la mine.
- Écran de résultat : verdict, lasers tirés, temps, mine révélée, différences (gemmes
  manquantes, mal placées, en trop).
- Actions : nouvelle partie, abandonner/révéler.
- Action « sonder une case » (« Qu'y a-t-il en E4 ? ») et sa règle de comptage (voir
  questions ouvertes).
- **Fini quand :** une partie se joue de la génération au verdict sans erreur.

### v0.10 Sauvegarde locale (S à M)

- Sauvegarde automatique de la **partie en cours** dans le navigateur (`localStorage` ou
  IndexedDB) : mine (les gemmes elles-mêmes, pas seulement la graine, pour survivre à un
  changement du générateur), tirs effectués, notes, grille de solution, temps écoulé,
  statut.
- Format **versionné** (`schemaVersion`) avec migration ou abandon propre d'une sauvegarde
  trop ancienne.
- Au retour sur le site : proposer « Reprendre la partie » ou « Nouvelle partie ».
- Tout accès au stockage dans un `try/catch` (navigation privée, stockage plein ou
  désactivé) : le jeu fonctionne sans sauvegarde.
- Effacement de la sauvegarde à la fin de partie.
- **Hors périmètre v1 :** historique, statistiques, plusieurs parties sauvegardées,
  synchronisation entre appareils.
- **Fini quand :** fermer l'onglet en pleine partie puis rouvrir le site restaure
  exactement l'état, chronomètre compris.

### v0.11 Page « Règles » et finitions (M)

- Page de règles dans le site, issue de [`regles.md`](regles.md), qui mentionne la
  particularité de la **gemme rouge retournable** (deux faces quadrillées, seule pièce
  concernée).
- Accessibilité : noms des couleurs en texte et motifs en plus de la teinte (daltonisme),
  navigation clavier.
- Mobile et tactile : tailles de cibles, glisser-déposer testé au doigt.
- Textes dans une table de chaînes (français d'abord).
- Option : variantes de difficulté (Diamant, Corps noir) une fois leurs formes confirmées.
- **Fini quand :** parcours complet validé sur ordinateur et téléphone.

### Critères de sortie : livraison de la v1

- Toutes les règles de [`regles.md`](regles.md) implémentées et testées.
- Toute mine générée est valide, visible et unique.
- La sauvegarde locale restaure une partie en cours.
- Déployée, CI verte.

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

## Questions ouvertes

- Soumission : une seule tentative (comme à deux joueurs, une erreur = défaite) ou
  plusieurs essais ?
- Un « sondage de case » compte-t-il dans le nombre de lasers ? Proposition : non, on le
  compte à part (`probes_count`), et la moyenne de la v2 ne porte que sur les lasers.
- Une partie abandonnée compte-t-elle comme perdue dans le pourcentage de victoires ?
  Proposition : oui.
- Limite de lasers imposée ou simple compteur ?
- Dimensions des gemmes et règle d de contact : voir [`regles.md`](regles.md).
- Supabase ou Firebase pour la v2 ?
