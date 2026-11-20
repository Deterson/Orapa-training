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
Chaque étape se termine par des tests verts et un commit. Une fois faite, elle est réduite à une ou deux
phrases (le détail vit dans le code, les tests et le dépôt git).

Les règles de référence sont dans [`regles.md`](regles.md). Les spécifications de la
génération, de l'interface et de la soumission sont dans [`../CLAUDE.md`](../CLAUDE.md).

## État d'avancement

**Fait**

- **v1 livrée (v1.0.0)** : le jeu complet (règles, générateur à graine, tirs, sondes, gemmes, notes, soumission, sauvegarde locale, page Règles) ; ses évolutions v1.0.1 à v1.0.17 sont listées plus bas.
- **v2 complète côté code (v2.0.0)** : connexion Google, parties en cours et terminées sur le compte, historique, profil, confidentialité et suppression du compte (Supabase) ; l'interface de jeu a été refondue de la v2.0.1 à la v2.0.27.
- **v3 livrée (v3.0.0)** : le joueur cache ses gemmes et affronte une IA à trois niveaux (tours alternés, règle du livret), éditeur de plateau avec code de partage, duels sauvegardés en local et, une fois terminés, dans l'historique et le profil (migration SQL), mode daltonien.

**Reste à faire**

- **Mise en service de la v2** : projet Supabase, identifiant Google, variables du dépôt, essai réel de la connexion et d'une partie complète ; contact et mentions légales si la loi l'exige.
- **Restes des versions livrées** : essayer le site sur un vrai téléphone, confirmer les dimensions des gemmes sur les pièces, revoir une partie terminée case par case (non fait en v1.4).
- **Mise en service de la v3** : appliquer la migration `20261120000001_duels.sql` (et lancer `npm run test:db`, non exécuté faute de Postgres), régler les niveaux de l'IA sur de vraies parties, valider le mode daltonien avec des joueurs concernés.
- **v4** (étapes v3.1 à v3.7) : duel en direct contre un autre joueur.
- Les décisions en attente sont dans « Questions ouvertes », en bas de page.

---

## Vers la v1 : le jeu complet, sauvegarde locale (étapes v0.1 à v0.11) : livrée (v1.0.0)

**Objectif :** toutes les règles du jeu dans un site statique jouable de bout en bout, sans compte ni
serveur, avec une sauvegarde locale de la partie en cours.

### v0.1 Socle du projet (S) : fait

Vite + TypeScript strict, Vitest, ESLint et Prettier, CI (`ci.yml`) et déploiement GitHub Pages (`deploy.yml`).

### v0.2 Modèle de données et géométrie (M) : fait

Grille et 36 repères (`board.ts`), gemmes comme données avec rotations et retournement de la rouge seule
(`gems.ts`), géométrie exacte (`geometry.ts`) et règles de placement a à d avec messages en français (`placement.ts`).

### v0.3 Simulateur de laser (M) : fait

Propagation du rayon (`laser.ts`) et table de mélange des couleurs (`colors.ts`), testées sur les deux
exemples du livret et la réversibilité de 300 dispositions.

### v0.4 Visibilité des gemmes (S) : fait

`visibility.ts` (règle e : une gemme est touchée en premier par un rayon droit depuis un bord), pour la
génération et l'aide de validation.

### v0.5 Générateur à graine (M) : fait

`rng.ts` (mulberry32) et `generate.ts` (tirage, rejet si une règle est violée, filtre de visibilité) ; même
graine et même version (`GENERATOR_VERSION`), même mine.

### v0.6 Interface : grille et tirs (M) : fait

`GameSession` garde la mine dans un champ privé (un tir ne renvoie que entrée, sortie et couleur), grille SVG
à 36 repères cliquables et historique des tirs ; le chemin du rayon n'est jamais tracé.

### v0.7 Interface : grille de solution (L) : fait

`solution.ts` (poser, déplacer, pivoter, retourner la rouge, règles en direct, `compareWithShots`) et
glisser-déposer au pointeur, clavier compris, avec l'outil de vérification d'hypothèse (tir simulé sur sa grille).

### v0.8 Interface : notes et dessin (M) : fait

`notes.ts` : crayon, gomme, marques de cases et annuler / rétablir ; les notes n'ont aucun effet sur la correction.

### v0.9 Soumission et fin de partie (M) : fait

`verify.ts` (égalité stricte gemme par gemme), `probe.ts` (sonder une case), statuts de partie, **une seule
proposition** (`MAX_ATTEMPTS = 1`) et écran de résultat avec la vraie mine ; plus rien n'est possible après la fin.

### v0.10 Sauvegarde locale (S à M) : fait

`save.ts` (format versionné, validation stricte, mine stockée telle quelle), accès au stockage protégé
(`storage.ts`), sauvegarde automatique et reprise, effacée à la fin de la partie.

### v0.11 Page « Règles » et finitions (M) : fait

Page « Règles » dont les schémas viennent des données du jeu, table de chaînes (`strings.ts`), accessibilité
(clavier, `aria-live`, thèmes, mouvement réduit) et mobile / tactile.

### Critères de sortie : livraison de la v1 : atteints (v1.0.0)

Toutes les règles de la partie de base sont testées, toute mine générée est valide et visible (100 graines), la
sauvegarde locale restaure la partie, le site est déployé et la CI verte. **Reste :** essayer le site sur un
vrai téléphone et confirmer les dimensions des gemmes sur les pièces.

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
  propose (« Reprendre »). « Nouvelle partie » la remplace, après une
  modale de confirmation qui avertit de la perte et invite à se connecter. Pas de liste, pas d'historique, pas de profil.
- **« Nouvelle partie »** (accueil) ouvre la fenêtre des **extensions** (Diamant, Corps noir),
  la même qu'au début d'une partie, puis lance la génération et ouvre la vue Partie.
- **Avec compte** : plusieurs parties en cours en même temps, chacune reprise depuis l'accueil.
  Les parties en cours sont donc **stockées côté serveur** (voir v1.3), pas seulement les parties
  terminées.
- Une partie « en cours » n'entre pas dans les statistiques ; une partie terminée ou abandonnée y
  entre.

### v1.1 Choix du backend (S) : fait

**Supabase** (connexion Google intégrée, statistiques en SQL, sécurité par ligne testée en CI) ; code écrit
sans projet : sans `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` le site reste en mode v1 ([`backend.md`](backend.md)).
Une partie abandonnée compte comme perdue.

### v1.2 Vues, navigation et authentification Google (M) : fait

`backend/` (configuration, `auth.ts`, client créé à la demande), connexion Google (PKCE) à session persistante,
routeur par adresse, barre du haut, accueil et une seule partie à la fois sans compte.

### v1.3 Modèle de données et sécurité (M) : fait

Table `games` et sécurité par ligne forcée (migrations de `supabase/migrations/` : chacun ne lit, n'écrit et ne
supprime que ses parties, `anon` n'a aucun droit), parties en cours côté serveur (`snapshot`, dix au plus par
compte), testées en SQL (`npm run test:db`) ; `record.ts` produit l'enregistrement d'une partie, jamais la mine.

### v1.4 Parties enregistrées et historique (M) : fait

Parties terminées envoyées par une file locale sans doublon (`outbox.ts`), parties en cours synchronisées
(`sync.ts`), page Historique (filtre, tri, « Rejouer »), « Importer » la partie locale à la connexion ; la graine
est échappée partout (faille corrigée). Pas fait : revoir une partie case par case.

### v1.5 Vue Profil (S à M) : fait

`profile_stats()` en SQL : **% de victoires** = gagnées ÷ terminées (une abandonnée compte comme perdue) et
**moyenne de tirs** (lasers + sondes) sur les seules victoires, « — » sans victoire ; page Profil (`#/profil`).

### v1.6 Vie privée et exploitation (S) : fait

Page Confidentialité, suppression du compte (`delete_my_account()`, parties en cascade), un projet Supabase par
environnement (variables du dépôt en production), politique de sécurité du contenu et test anti-secret.

### Critères de sortie : livraison de la v2 (v2.0.0)

**Code et tests atteints :** trois vues, historique et profil exacts, aucun accès aux données d'autrui (tests SQL
en CI), v1 inchangée sans variables. **Reste pour la mise en service :** essayer la connexion Google réelle et une
partie complète (projet Supabase et variables du dépôt créés), et ajouter contact et mentions légales à la page
Confidentialité si la loi l'exige.

### Notes de conception pour la v2

- **Triche et vérification :** les statistiques sont déclarées par le navigateur, donc
  falsifiables. Sans classement, l'enjeu est nul ; on garde pourtant `seed`,
  `generator_version` et `shots` pour pouvoir **rejouer et vérifier côté serveur** plus
  tard si besoin. D'où l'importance de versionner le générateur dès la v1.
- **Futurs possibles, hors v2 :** évolution des statistiques dans le temps, classement,
  défis partagés par graine, variantes avec Diamant et Corps noir.

---

## Vers la v3 : plateau personnalisé et duel contre une IA (étapes v2.1 à v2.7) : livrée (v3.0.0)

**Objectif :** sortir du mode entraînement. Le joueur **cache lui-même ses gemmes** (son plateau) et
affronte une **IA** qui cherche son plateau pendant qu'il cherche celui de l'IA : le premier qui
identifie toutes les gemmes adverses gagne, comme au jeu à deux. Les modes d'entraînement (v1) restent
disponibles. Règles du duel : [`regles.md`](regles.md) (« Duel contre l'IA »).

### v2.1 Éditeur de plateau (M) : fait

Page « Plateau » (`#/duel`) : on place ses gemmes comme dans la vue de jeu (glisser-déposer, pivoter, retourner la rouge), règles a à e en direct, « Au hasard » (`randomVisibleLayout`), « Valider » et **code de partage** (`game/boardCode.ts`, 18 caractères pour la partie de base, importable). Extensions au choix.

### v2.2 Modèle du duel (M) : fait

`game/duel.ts` : deux `GameSession` croisées (chaque camp cherche le plateau de l'autre, champ privé), **tours alternés** et règle du livret (proposition fausse = défaite, dernier tour au second si le premier trouve, égalité) ; chaque camp ne reçoit que `knowledge(camp)`, testé. Le rythme « course » prévu au départ est abandonné (décision du propriétaire : il se réduisait à qui répond le plus vite).

### v2.3 IA : connaissance du plateau adverse (L, risque) : fait

`game/ai/belief.ts` : un **échantillon de plateaux compatibles** avec les réponses reçues, réparé par un échantillonnage de Gibbs (on réévalue toutes les poses d'une gemme), renouvelé et exploré par redémarrages ; budget en **tirs simulés** (reproductible à graine égale), exécution dans un **Web Worker** (`ui/aiWorker.ts`, repli dans la page). Retrouve le plateau exact quand l'information suffit (testé avec les 36 lasers et les 80 sondes).

### v2.4 IA : stratégie et niveaux (M) : fait

Question choisie par **gain d'information** (entropie des réponses sur l'échantillon, laser et sonde comparés), niveaux réglés par des données (`ai/levels.ts`) : débutant (propose trop tôt, ~6 % de réussite), intermédiaire (~80 %, 13 questions), expert (~86 %, 10 questions, vérifie qu'aucun autre plateau n'est compatible avant de proposer). L'IA ne reçoit jamais le plateau (test qui lit ses sources) et joue les mêmes coups à graine égale.

### v2.5 Interface du duel (L) : fait

Même vue de jeu que l'entraînement : la grille de jeu est celle du plateau de l'IA, le plateau du joueur s'affiche en petit avec les questions de l'IA, indication du tour, « L'IA joue… » (délai de réflexion simulé), dernier tour, résultat Gagné / Perdu / Égalité avec les deux plateaux révélés. Un seul duel à la fois, qui remplace la partie en cours après confirmation ; la graine d'un duel n'est jamais montrée (elle donne le plateau de l'IA).

### v2.6 Sauvegarde et historique (S à M) : fait

Sauvegarde locale du duel (`game/duelSave.ts`, validation stricte, clé séparée) reprise au rechargement, y compris quand c'était à l'IA de jouer ; duels terminés dans l'historique du compte (colonnes `mode` et `level`, issue `draw`, migration `20261120000001_duels.sql`, test SQL non exécuté ici) et, au profil, victoires, égalités et défaites **par niveau** (`duel_stats()`) ; les statistiques d'entraînement ne comptent pas les duels.

### v2.7 Équilibrage et finitions (S) : fait

Niveaux mesurés par simulations IA contre IA (voir v2.4), page Règles complétée, **mode daltonien** (œil de la barre du haut, mémorisé) : palette d'Okabe et Ito, un motif par gemme colorée (hachures, points, quadrillage), lettres sur les pastilles de l'historique. Reste : valider avec des joueurs daltoniens et régler les niveaux sur de vraies parties.

### Critères de sortie : livraison de la v3

Un joueur construit son plateau et joue une partie complète contre l'IA aux trois niveaux, l'IA ne dispose d'aucune information interdite (test automatisé), aucune régression de l'entraînement ni de la sauvegarde : atteints (v3.0.0).

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

Une ligne par version, dans l'ordre.

- **v1.0.1** : texte minimal dans toute l'interface.
- **v1.0.2** : onglet « Gemmes », gemmes et notes en transparence sur les tirs, case « Notes ».
- **v1.0.3** : une pastille par couleur de gemme dans l'historique des tirs.
- **v1.0.4** : sonder en touchant une case (confirmation par modale, remplacée en 2.0.6), « transparent » sans pastille.
- **v1.0.5** : numéro du tir sur les repères, boutons ronds ↻ ⇋ sur la gemme sélectionnée.
- **v1.0.6** : marque « Vide » (stries grises), 36 repères cliquables au résultat pour des lasers libres.
- **v1.0.7** : quadrillage des vraies pièces sur les gemmes (`gridSegments`).
- **v1.0.8** : version du build affichée en petit.
- **v1.0.9** : mode plein écran pour téléphone en paysage, une seule grille.
- **v1.0.10** : marques R, J, B, Bl et « ? » retirées du plein écran.
- **v1.0.11** : boutons ronds de la gemme masqués quand on touche ailleurs.
- **v1.0.12** : encre verte supprimée.
- **v1.0.13** : extensions Diamant et Corps noir (choix au début de partie, `?ext=`, « signal perdu »).
- **v1.0.14** : modale de résumé d'un tir déjà fait (remplacée en 2.0.15), réserve du plein écran élargie.
- **v1.0.15** : Diamant affiché creux.
- **v1.0.16** : génération instantanée, `GENERATOR_VERSION` passée à 2.
- **v1.0.17** : sondes comptées comme des tirs (compteur unique), extensions nommées « Diamant » et « Corps noir », sonder un corps noir répond « signal perdu ».
- **v2.0.0** : livraison de la v2 (étapes v1.1 à v1.6) fusionnée avec la v1.0.17 ; les v2.1 à v2.7 sont des **étapes** de la v3, pas des versions du site.
- **v2.0.1** : vue de jeu en une seule grille (Crayon, Ligne droite, Gomme, Vide, Simuler, réserve, « Soumettre » vert), abandon et horloge retirés.
- **v2.0.2** : annuler ↶ et rétablir ↷ avec symboles, modes cachés *notes* et *gemmes*, bouton « Gemmes ».
- **v2.0.3** : cases « Notes » et « Gemmes » l'une au-dessus de l'autre.
- **v2.0.4** : « Nouvelle partie » active sans compte, avec modale de confirmation de la perte de la partie en cours.
- **v2.0.5** : plus de confirmation de laser à la souris (remplacé en 2.0.6).
- **v2.0.6** : rotation des gemmes autour de leur axe, tir en deux clics avec bulle verte, animations de l'historique et des pastilles.
- **v2.0.7** : bulle de tir plus petite à la souris et au-dessus de la cible, cible entourée en vert, résultat 0,5 s après le tir.
- **v2.0.8** : bordure des gemmes au-dessus de leur quadrillage, gemme glissée au-dessus des repères du bord.
- **v2.0.9** : bouton jour / nuit dans la barre du haut (`ui/theme.ts`, choix mémorisé).
- **v2.0.10** : plus de liste de règles enfreintes : seuls le contour rouge des gemmes et « Soumettre » désactivé le signalent.
- **v2.0.11** : bouton de rotation recalé (une case plus bas, une case moins à droite pour le Diamant et le Corps noir).
- **v2.0.12** : bouton « Tir » à gauche de « Gemmes », « Gomme » devient une icône à droite des couleurs.
- **v2.0.13** : tirer depuis le repère d'arrivée d'un tir précédent ouvre le résumé de ce tir, sans coût (`GameSession.fire`).
- **v2.0.14** : le contour vert de la cible disparaît avec la bulle quand on clique ailleurs.
- **v2.0.15** : le résumé d'un tir déjà fait devient une infobulle temporaire en bas de l'écran, comme « signal perdu ».
- **v2.0.16** : numéro d'un résultat transparent en blanc cerclé de noir (1 px) sur le repère de sortie.
- **v2.0.17** : infobulle de résumé d'un tir déjà fait plus grande (texte et pastilles).
- **v2.0.18** : l'historique défile sans barre du navigateur : barre légère en surimpression, visible au survol (`ui/scrollbar.ts`).
- **v2.0.19** : sondes en cartes dans l'historique (`ui/historyCards.ts`) ; survol, clic et reclic mettent en avant ou désélectionnent une carte.
- **v2.0.20** : toucher un repère déjà tiré sélectionne de nouveau ce tir (repères de départ et d'arrivée surlignés).
- **v2.0.21** : bouton « Réinitialiser » sous la réserve : remet toutes les gemmes dans la réserve (`resetSolution`).
- **v2.0.22** : un clic ailleurs désélectionne le tir (ou la sonde) mis en avant.
- **v2.0.23** : « Réinitialiser » passe sur la ligne « 4/7 · 5/13 tirs », tout à droite, pour ne plus faire descendre « Soumettre ».
- **v2.0.24** : historique sur deux colonnes avant de défiler, détail de la soumission dans l'historique (tirs en désaccord entourés de rouge, simulés au survol), aperçu du diamant inversé.
- **v2.0.25** : première colonne de l'historique à gauche, seconde à droite ; la colonne en plus s'ouvre dans la marge à gauche sans déplacer la grille.
- **v2.0.26** : survoler un repère déjà tiré met en avant son tir : repères de départ et d'arrivée, et carte de l'historique.
- **v2.0.27** : sur grand écran, la place de la seconde colonne de l'historique est réservée (vide) dès le premier tir : rien ne bouge au passage à deux colonnes.
- **v3.0.0** : livraison de la v3 (étapes v2.1 à v2.7) : duel contre l'IA à trois niveaux, éditeur de plateau et code de partage, sauvegarde et historique des duels, mode daltonien.

## Questions ouvertes

- ~~Duel (v3) : « en même temps » ou tour par tour ?~~ Décidé en v3.0.0 : **tours alternés** seulement (la « course » se réduisait à qui répond le plus vite).
- ~~Duel (v3) : règle de fin.~~ Décidé en v3.0.0 : **règle du livret** (une erreur = défaite, dernier tour au second si le premier trouve, égalité) ; variante indulgente possible via des constantes (`DUEL_RULES`, `MAX_ATTEMPTS`).
- ~~IA (v3) : exécutée dans le navigateur~~ Décidé en v3.0.0 : oui, dans un Web Worker.
- Duel : extensions au choix (décidé), mais l'IA y est moins bien réglée : à mesurer.
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
- ~~Nombre maximal de parties en cours par compte~~ : décidé pour la v2, 10 (imposé par la base).
