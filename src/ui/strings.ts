/**
 * Textes de l'interface, en un seul endroit : c'est ici qu'on traduit ou qu'on reformule.
 * Le français est la langue d'origine ; une autre langue ajouterait un objet de même forme.
 * Les phrases qui dépendent de nombres ou de gemmes restent construites dans les composants.
 */
import type { GameStatus, ProbeRecord } from '../game/session';

export const fr = {
  appName: 'Orapa Training',
  skipToContent: 'Aller au plateau',
  nav: {
    rules: 'Règles',
  },
  actions: {
    newGame: 'Nouvelle partie',
    submit: 'Soumettre',
    replay: 'Rejouer',
    showNotes: 'Notes',
    showGems: 'Gemmes',
    undo: 'Annuler',
    redo: 'Rétablir',
    clear: 'Effacer',
    fullscreen: 'Plein écran',
    resume: 'Reprendre',
    reset: 'Réinitialiser',
    rotate: 'Pivoter',
    flip: 'Retourner',
  },
  /** Outils de la colonne de droite (notes et simulation). */
  tools: {
    label: 'Outils',
    fire: 'Tir',
    pencil: 'Crayon',
    line: 'Ligne droite',
    eraser: 'Gomme',
    empty: 'Vide',
    simulate: 'Simuler',
    inks: 'Couleur du crayon',
  },
  status: {
    playing: '',
    won: 'Gagné',
    lost: 'Perdu',
    // Ancienne partie abandonnée (l'abandon n'existe plus) : l'historique la montre encore.
    abandoned: 'Abandonné',
    // Duel seulement.
    draw: 'Égalité',
  } satisfies Record<GameStatus | 'draw', string>,
  lostSignal: 'Signal perdu',
  probe: {
    nothing: 'rien',
    red: 'rouge',
    yellow: 'jaune',
    blue: 'bleue',
    white: 'blanche',
    clear: 'diamant',
    black: 'signal perdu',
  } satisfies Record<ProbeRecord['content'], string>,
  modal: {
    cancel: 'Annuler',
    replaceTitle: 'Partie en cours',
    replaceText: 'Vous allez perdre votre partie en cours.',
    replaceSignIn:
      'Vous allez perdre votre partie en cours. Connectez-vous pour sauvegarder plusieurs parties en même temps.',
    replaceConfirm: 'Continuer',
  },
  /** Bulle verte du premier clic sur un repère (laser) ou une case (sonde) ; le second clic tire. */
  bubble: {
    fire: (label: string) => `Tirer en ${label} ?`,
    probe: (cell: string) => `Tirer en ${cell} ?`,
  },
  /** Écran de résultat : étiquette (lecteurs d'écran) d'un tir que la proposition ne reproduit pas. */
  result: {
    mismatch: 'ne correspond pas à votre proposition',
  },
  /** Bouton jour / nuit de la barre du haut. */
  theme: {
    toDark: 'Mode nuit',
    toLight: 'Mode jour',
  },
  /** Mode daltonien : palette adaptée, motifs sur les gemmes, lettres sur les pastilles. */
  colorblind: {
    label: 'Mode daltonien',
  },
  options: {
    title: 'Extensions',
    diamond: 'Diamant',
    blackBody: 'Corps noir',
    play: 'Jouer',
  },
  account: {
    signIn: 'Connexion',
    signOut: 'Déconnexion',
    signInFailed: 'Connexion impossible.',
    signOutFailed: 'Déconnexion impossible.',
    label: 'Compte',
  },
  home: {
    current: 'Partie en cours',
    blocked: '10 parties en cours au maximum.',
    others: 'Parties en cours',
    import: 'Importer',
    limit: '10 parties en cours au maximum.',
    loadError: 'Chargement impossible.',
    retry: 'Réessayer',
    syncFailed: 'Envoi impossible : réessayez plus tard.',
    gone: 'Partie introuvable.',
    actionFailed: 'Action impossible.',
  },
  history: {
    link: 'Historique',
    title: 'Historique',
    filters: { all: 'Toutes', won: 'Victoires', lost: 'Défaites' },
    sorts: { recent: 'Récentes', oldest: 'Anciennes', shots: 'Moins de tirs' },
    sortLabel: 'Tri',
    empty: 'Aucune partie',
    loading: 'Chargement…',
    error: 'Chargement impossible.',
    retry: 'Réessayer',
    replay: 'Rejouer',
    signInNeeded: 'Connexion requise',
    previous: 'Précédent',
    next: 'Suivant',
    saved: 'Enregistrée',
    pending: 'En attente',
  },
  profile: {
    link: 'Profil',
    title: 'Profil',
    games: 'Parties',
    wins: 'Victoires',
    winRate: 'Victoires (%)',
    avgShots: 'Tirs par victoire',
    none: 'Aucune partie jouée',
    noWin: '—',
    noWinLabel: 'Pas encore de victoire',
    duels: "Duels contre l'IA",
    level: 'Niveau',
    draws: 'Égalités',
    losses: 'Défaites',
    loading: 'Chargement…',
    error: 'Chargement impossible.',
    retry: 'Réessayer',
  },
  privacy: {
    link: 'Confidentialité',
    title: 'Confidentialité',
    delete: 'Supprimer mon compte',
    deleteConfirm: 'Supprimer définitivement',
    confirm: 'Supprimer le compte et toutes ses parties ?',
    confirmLabel: 'Confirmer la suppression',
    deleting: 'Suppression…',
    deleteFailed: 'Suppression impossible.',
    deleted: 'Compte supprimé',
  },
  /** Extensions de la partie en cours, affichées à côté de la graine. */
  extensions: {
    none: 'Sans extension',
    diamond: 'Diamant',
    blackBody: 'Corps noir',
  },
  hints: {
    storageOff: 'Sauvegarde indisponible.',
  },
  /** Duel contre l'IA : textes courts, les règles sont dans la page « Règles ». */
  duel: {
    start: "Duel contre l'IA",
    chip: 'Duel',
    optionsTitle: 'Duel',
    level: 'Niveau',
    levels: { beginner: 'Débutant', intermediate: 'Intermédiaire', expert: 'Expert' },
    toBoard: 'Plateau',
    setupTitle: 'Placez vos gemmes',
    random: 'Au hasard',
    validate: 'Valider',
    code: 'Code',
    codeLabel: 'Code du plateau',
    copy: 'Copier',
    copied: 'Copié',
    importCode: 'Importer',
    importLabel: 'Coller un code',
    importFailed: 'Code invalide',
    yourTurn: 'À vous',
    aiTurn: "L'IA joue…",
    lastTurn: 'Dernier tour : proposez',
    aiLastTurn: "Dernier tour de l'IA…",
    ownBoard: 'Votre plateau',
    enlarge: 'Agrandir votre plateau',
    enlargeGems: 'Agrandir les gemmes',
    aiBoard: "Plateau de l'IA",
    won: 'Gagné',
    lost: 'Perdu',
    draw: 'Égalité',
    aiFound: "L'IA a trouvé",
    replaceTitle: 'Duel en cours',
    replaceText: 'Vous allez perdre votre duel en cours.',
    wait: "Ce n'est pas votre tour.",
    resume: 'Reprendre le duel',
  },
} as const;

export type Strings = typeof fr;

/** Textes actifs. Pour ajouter une langue, choisir ici l'objet selon `navigator.language`. */
export const t: Strings = fr;
