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
    rotate: 'Pivoter',
    flip: 'Retourner',
  },
  /** Outils de la colonne de droite (notes et simulation). */
  tools: {
    label: 'Outils',
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
  } satisfies Record<GameStatus, string>,
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
    fire: (label: string) => `Laser en ${label} ?`,
    probe: (cell: string) => `Sonder ${cell} ?`,
    confirm: 'Confirmer',
    cancel: 'Annuler',
    close: 'Fermer',
    dontAsk: 'Ne plus demander',
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
    blocked: 'Partie en cours',
    blockedSignIn: 'Terminer la partie en cours, ou se connecter.',
    blockedNoAccount: 'Terminer la partie en cours.',
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
} as const;

export type Strings = typeof fr;

/** Textes actifs. Pour ajouter une langue, choisir ici l'objet selon `navigator.language`. */
export const t: Strings = fr;
