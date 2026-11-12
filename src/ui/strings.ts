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
    backToGame: 'Retour',
  },
  tabs: {
    shots: 'Tirs',
    solution: 'Gemmes',
    notes: 'Notes',
    result: 'Résultat',
  },
  actions: {
    newGame: 'Nouvelle partie',
    copyLink: 'Lien',
    submit: 'Soumettre',
    abandon: 'Abandonner',
    replay: 'Rejouer',
    showNotes: 'Notes',
    resume: 'Reprendre',
    rotate: '↻ Pivoter',
    flip: '⇋ Retourner',
    putBack: 'Retirer',
  },
  status: {
    playing: '',
    won: 'Gagné',
    lost: 'Perdu',
    abandoned: 'Abandonné',
  } satisfies Record<GameStatus, string>,
  probe: {
    nothing: 'rien',
    red: 'rouge',
    yellow: 'jaune',
    blue: 'bleue',
    white: 'blanche',
  } satisfies Record<ProbeRecord['content'], string>,
  modal: {
    fire: (label: string) => `Laser en ${label} ?`,
    probe: (cell: string) => `Sonder ${cell} ?`,
    confirm: 'Confirmer',
    cancel: 'Annuler',
    dontAsk: 'Ne plus demander',
  },
  hints: {
    storageOff: 'Sauvegarde indisponible.',
  },
} as const;

export type Strings = typeof fr;

/** Textes actifs. Pour ajouter une langue, choisir ici l'objet selon `navigator.language`. */
export const t: Strings = fr;
