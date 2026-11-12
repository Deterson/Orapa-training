# Roadmap

Deux versions : **v1** = le jeu complet, jouable hors ligne, avec une simple sauvegarde
locale ; **v2** = comptes Google, historique et page de profil.

Tailles indicatives : S (≈ une demi-journée), M (1 à 2 jours), L (3 jours ou plus).
Chaque étape se termine par des tests verts et un commit.

Les règles de référence sont dans [`regles.md`](regles.md). Les spécifications de la
génération, de l'interface et de la soumission sont dans [`../CLAUDE.md`](../CLAUDE.md).

---

## v1 : le jeu complet, sauvegarde locale

**Objectif :** toutes les règles du jeu implémentées et un site statique jouable de bout en
bout. Aucun compte, aucun serveur. La seule persistance est une sauvegarde locale de la
partie en cours, pour la reprendre plus tard dans le même navigateur.

### 1.0 Socle du projet (S)

- Vite + TypeScript, Vitest, ESLint/Prettier.
- Arborescence `src/game/`, `src/ui/`, `tests/` (voir CLAUDE.md).
- CI GitHub Actions : lint + tests + build à chaque push.
- Déploiement statique (GitHub Pages) sur la branche principale.
- **Fini quand :** une page vide se déploie et la CI est verte.

### 1.1 Modèle de données et géométrie (M)

- Grille 10×8, coordonnées de cases (« E4 »), points d'entrée/sortie (1–18, A–R) avec
  conversions dans les deux sens.
- Gemmes décrites comme **données** (listes de sommets), avec rotations par quarts de tour
  et **retournement réservé à la gemme rouge** (4 positions distinctes).
- Primitives géométriques : intersection de polygones sur coordonnées entières.
- Validation du placement, règles a à d : alignement sur la grille, pas de dépassement,
  **intersection vide ou réduite à un point** entre deux gemmes.
- Tests : chaque forme et chaque orientation ; cas d'intersection (segment partagé refusé,
  contact par un sommet accepté, sommet contre milieu de côté accepté).
- **Fini quand :** on peut poser des gemmes dans une grille de données et en tirer un
  verdict de validité fiable.

### 1.2 Simulateur de laser (M)

- Propagation sur les centres de cases : virage de 90° sur face à 45°, demi-tour sur face
  perpendiculaire.
- Accumulation des couleurs distinctes et table de mélange complète.
- Résultat : point de sortie + couleur (ou « signal absorbé » pour le Corps noir).
- Tests : les **deux exemples du livret** (I → rouge en I ; 15 → violet clair en 8) ;
  chaque ligne de la table des couleurs ; propriété **réversibilité** (tirer depuis le point
  de sortie ramène au point d'entrée, avec le même ensemble de couleurs) ; aucun rayon ne
  boucle.
- **Fini quand :** les 36 entrées d'une mine quelconque donnent un résultat, et les tests
  des exemples du livret passent.

### 1.3 Visibilité des gemmes (S)

- Règle e : pour chaque gemme, existe-t-il un tir **sans rebond préalable** qui la touche
  en premier ?
- Tests sur des configurations construites à la main (gemme encerclée = refusée).
- **Fini quand :** `isVisible(mine)` est fiable ; il servira à la génération **et** à
  l'aide de validation de la grille joueur.

### 1.4 Générateur à graine et unicité (L)

- PRNG à graine (`?seed=`), version du générateur incluse dans la graine/sauvegarde.
- Tirage des gemmes (partie de base : 1 rouge, 1 jaune, 1 bleue, 2 blanches), position et
  orientation aléatoires, rejet si une règle de placement est violée.
- Filtre de visibilité, puis **solveur d'unicité** : backtracking élagué par la signature
  complète (36 tirs) ; la mine n'est gardée que si elle est la seule solution.
- Mesurer : taux de rejet, temps de génération. Budget visé < 1 s ; sinon Web Worker, puis
  précalcul d'une banque de mines.
- Tests sur des centaines de graines : mines valides, visibles, uniques ; même graine =
  même mine.
- **Risque :** le solveur peut être lent ou rejeter beaucoup. Prototyper tôt, avant l'UI.
- **Fini quand :** « nouvelle mine » répond en un temps acceptable et toute mine produite
  vérifie les trois propriétés.

### 1.5 Interface : grille et tirs (M)

- Rendu SVG de la grille 10×8, repères de bord (1–10, 11–18, I–R, A–H).
- Clic sur un repère = tir ; tracé du chemin du rayon, point de sortie coloré.
- Historique numéroté des tirs, compteur de lasers.
- Gemmes **jamais** exposées à l'UI avant la fin de partie : l'UI n'appelle que la fonction
  de tir.
- **Fini quand :** on peut tirer des lasers sur une mine générée et lire les résultats.

### 1.6 Interface : grille de solution (L)

- Réserve de gemmes, glisser-déposer au pointeur (souris et tactile), aimantation à la
  grille.
- Rotation par quarts de tour ; **bouton « retourner » uniquement pour la gemme rouge**.
- Placements invalides refusés ou signalés avec la règle enfreinte (a à e).
- Outil de vérification d'hypothèse : lancer la simulation sur **sa propre grille** et
  comparer au résultat réel d'un tir.
- **Fini quand :** le joueur peut construire une solution complète et valide à la main.

### 1.7 Interface : notes et dessin (M)

- Calque d'annotation par case : couleur, croix « vide », crayon, gomme, annuler/rétablir.
- Aucun effet sur la correction.
- **Fini quand :** les notes se superposent à la grille de tir ou s'affichent à côté,
  sans gêner les autres interactions.

### 1.8 Soumission et fin de partie (M)

- Soumission : égalité stricte entre la grille joueur et la mine.
- Écran de résultat : verdict, lasers tirés, temps, mine révélée, différences (gemmes
  manquantes, mal placées, en trop).
- Actions : nouvelle partie, abandonner/révéler.
- Action « sonder une case » (« Qu'y a-t-il en E4 ? ») et sa règle de comptage (voir
  questions ouvertes).
- **Fini quand :** une partie se joue de la génération au verdict sans erreur.

### 1.9 Sauvegarde locale (S à M)

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

### 1.10 Page « Règles » et finitions (M)

- Page de règles dans le site, issue de [`regles.md`](regles.md), qui mentionne la
  particularité de la **gemme rouge retournable** (deux faces quadrillées, seule pièce
  concernée).
- Accessibilité : noms des couleurs en texte et motifs en plus de la teinte (daltonisme),
  navigation clavier.
- Mobile et tactile : tailles de cibles, glisser-déposer testé au doigt.
- Textes dans une table de chaînes (français d'abord).
- Option : variantes de difficulté (Diamant, Corps noir) une fois leurs formes confirmées.
- **Fini quand :** parcours complet validé sur ordinateur et téléphone.

### Critères de sortie de la v1

- Toutes les règles de [`regles.md`](regles.md) implémentées et testées.
- Toute mine générée est valide, visible et unique.
- La sauvegarde locale restaure une partie en cours.
- Déployée, CI verte.

---

## v2 : comptes, historique, profil

**Objectif :** connexion Google, historique des parties et page de profil avec deux
statistiques.

Cela impose un **backend**, ce que la v1 évite. Le jeu reste jouable **sans compte** : se
connecter ajoute l'historique, rien de plus.

### 2.0 Choix du backend (S)

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

### 2.1 Authentification Google (M)

- Connexion et déconnexion OAuth Google ; session persistante.
- Jouer sans être connecté reste possible (sauvegarde locale de la v1 inchangée).
- Écran d'état : connecté / non connecté, avatar et nom affichés.
- Configuration OAuth (écran de consentement, URI de redirection par environnement).
- **Fini quand :** on peut se connecter, se déconnecter, recharger la page et rester connecté.

### 2.2 Modèle de données et sécurité (M)

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

### 2.3 Enregistrement et historique (M)

- À la fin d'une partie, si connecté : enregistrer la ligne `games`. Gérer l'échec réseau
  (file locale, nouvel essai).
- Page **Historique** : liste paginée (date, résultat, lasers, durée), tri et filtre
  victoire/défaite.
- Option : revoir une partie passée à partir de sa graine et de ses tirs.
- Option : proposer d'importer au premier login les parties terminées stockées en local.
- **Fini quand :** les parties terminées apparaissent dans l'historique, sur n'importe quel
  navigateur où l'on se connecte.

### 2.4 Page de profil (S à M)

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

### 2.5 Vie privée et exploitation (S)

- Ne conserver que le nécessaire de Google (identifiant, nom, avatar).
- Page de confidentialité ; suppression du compte avec **effacement de ses parties**.
- Séparation des environnements (développement / production) et gestion des secrets hors du
  dépôt.

### Critères de sortie de la v2

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
