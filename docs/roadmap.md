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
- **Mode « daltonien »** : option de l'interface (mémorisée) qui ne repose plus sur la seule teinte.
  Palette adaptée aux daltoniens pour les gemmes, les rayons, les pastilles de l'historique et les
  encres, et motifs ou lettres en plus de la couleur (par exemple des hachures par gemme, comme les
  stries du « vide »). À valider avec des joueurs concernés ; les règles du jeu ne changent pas.

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

- **v1.0.1** : texte minimal dans toute l'interface.
- **v1.0.2** : onglet « Gemmes », gemmes et notes en transparence sur les tirs, case « Notes ».
- **v1.0.3** : une pastille par couleur de gemme dans l'historique des tirs.
- **v1.0.4** : sonder en touchant une case, confirmation par modale (remplacée en 2.0.6), « transparent » sans pastille.
- **v1.0.5** : numéro du tir sur les repères, boutons ronds ↻ ⇋ sur la gemme sélectionnée.
- **v1.0.6** : marque « Vide » (stries grises), 36 repères cliquables au résultat pour des lasers libres.
- **v1.0.7** : quadrillage des vraies pièces sur les gemmes (`gridSegments`).
- **v1.0.8** : version du build affichée en petit.
- **v1.0.9** : mode plein écran pour téléphone en paysage, une seule grille.
- **v1.0.10** : marques R, J, B, Bl et « ? » retirées du plein écran.
- **v1.0.11** : boutons ronds de la gemme masqués quand on touche ailleurs.
- **v1.0.12** : encre verte supprimée.
- **v1.0.13** : extensions Diamant et Corps noir (choix au début de partie, `?ext=`, « signal perdu »).
- **v1.0.14** : modale de résumé d'un tir déjà fait, réserve du plein écran élargie.
- **v1.0.15** : Diamant affiché creux.
- **v1.0.16** : génération instantanée, `GENERATOR_VERSION` passée à 2.
- **v1.0.17** : sondes comptées comme des tirs (compteur unique), extensions nommées « Diamant » et « Corps noir »
  partout, sonder un corps noir répond « signal perdu » et un diamant « diamant ».
- **v2.0.0** : livraison de la v2 (étapes v1.1 à v1.6), fusionnée avec la v1.0.17 ; les numéros v2.1 à v2.7
  désignent des **étapes** de la v3, pas des versions du site.
- **v2.0.1** : vue de jeu en une seule grille (outils Crayon, Ligne droite, Gomme, Vide, Simuler, réserve de
  gemmes, « Soumettre » en vert) ; abandon et horloge retirés ; mode daltonien ajouté à la roadmap (v3).
- **v2.0.2** : annuler ↶ et rétablir ↷ avec symboles, modes cachés *notes* et *gemmes*, bouton « Gemmes ».
- **v2.0.3** : cases « Notes » et « Gemmes » l'une au-dessus de l'autre.
- **v2.0.4** : « Nouvelle partie » active sans compte, avec modale de confirmation de la perte de la partie en cours.
- **v2.0.5** : plus de confirmation de laser à la souris (remplacé en 2.0.6).
- **v2.0.6** : rotation des gemmes autour de leur axe (centre de la boîte, case de droite du Corps noir et du
  Diamant), bouton ↻ fixe et absent sur le losange, tir en deux clics avec bulle verte, animations de l'historique et des pastilles.
- **v2.0.7** : bulle de tir plus petite à la souris et au-dessus de la cible, cible entourée en vert, résultat
  affiché 0,5 s après le tir dans l'animation.
- **v2.0.8** : la bordure des gemmes passe au-dessus de leur quadrillage, et une gemme glissée au bord de la grille passe au-dessus des repères de tir.
- **v2.0.9** : bouton jour / nuit à gauche des boutons de droite de la barre du haut (`ui/theme.ts`, choix mémorisé).
- **v2.0.10** : plus de liste de règles enfreintes sous les gemmes : seuls le contour rouge des gemmes et « Soumettre » désactivé le signalent.
- **v2.0.11** : bouton de rotation recalé : une case plus bas pour toutes les gemmes, et une case moins à droite pour le Diamant et le Corps noir.
- **v2.0.12** : bouton « Tir » à gauche de « Gemmes » (repères et cases tirent sans sélectionner la gemme dessous), « Gomme » devient une icône à droite des couleurs.
- **v2.0.13** : tirer depuis le repère d'arrivée d'un tir précédent est interdit (trajet réversible) : le résumé de ce tir s'ouvre à la place, sans coût (`GameSession.fire`).
- **v2.0.14** : correction : le contour vert de la cible disparaît avec la bulle quand on clique ailleurs (il restait affiché), y compris hors de l'application.
- **v2.0.15** : le résumé d'un tir déjà fait n'est plus une modale mais une infobulle temporaire en bas de l'écran, comme « signal perdu ».
- **v2.0.16** : le numéro d'un résultat transparent, sur le repère de sortie, est blanc avec un contour noir de 1 px.
- **v2.0.17** : l'infobulle de résumé d'un tir déjà fait est plus grande (texte et pastilles).
- **v2.0.18** : l'historique des tirs défile sans barre du navigateur : une barre légère en surimpression, à droite, visible au survol seulement (`ui/scrollbar.ts`) ; sa position est conservée entre deux affichages.
- **v2.0.19** : historique : les sondes sont des cartes comme les tirs (« 5 B6 = ● », « rien », signal perdu, Diamant en miniature, `ui/historyCards.ts`) ; survoler une carte la met en avant provisoirement tant que rien n'est sélectionné, un clic la sélectionne, un reclic la désélectionne ; un tir n'est plus sélectionné d'office.
- **v2.0.20** : toucher un repère déjà tiré sélectionne de nouveau ce tir : ses repères de départ et d'arrivée sont surlignés (comportement perdu en 2.0.19).
- **v2.0.21** : bouton « Réinitialiser » sous la réserve de gemmes : remet toutes les gemmes dans la réserve (`resetSolution`).
- **v2.0.22** : un clic ailleurs désélectionne le tir (ou la sonde) mis en avant, dans l'historique comme sur les repères et la grille.

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
- ~~Nombre maximal de parties en cours par compte~~ : décidé pour la v2, 10 (imposé par la base).
