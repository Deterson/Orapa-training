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
    backToGame: 'Retour à la partie',
  },
  tabs: {
    shots: 'Tirs',
    solution: 'Ma solution',
    notes: 'Notes',
    result: 'Résultat',
  },
  actions: {
    newGame: 'Nouvelle partie',
    copyLink: 'Copier le lien',
    submit: 'Soumettre ma solution',
    abandon: 'Abandonner',
    replay: 'Rejouer cette mine',
    probe: 'Sonder une case',
    resume: 'Reprendre la partie',
    rotate: '↻ Pivoter',
    flip: '⇋ Retourner',
    putBack: 'Remettre dans la réserve',
  },
  status: {
    playing: '',
    won: 'Bravo, mine reconstituée !',
    lost: 'Raté : la proposition était fausse',
    abandoned: 'Partie abandonnée',
  } satisfies Record<GameStatus, string>,
  probe: {
    nothing: 'rien',
    red: 'une gemme rouge',
    yellow: 'une gemme jaune',
    blue: 'une gemme bleue',
    white: 'une gemme blanche',
  } satisfies Record<ProbeRecord['content'], string>,
  hints: {
    fire: 'Touchez un repère du bord pour tirer un laser.',
    submitNeeds:
      'Pour soumettre : posez les 5 gemmes sans enfreindre de règle (onglet « Ma solution »).',
    storageOff:
      'La sauvegarde automatique est indisponible dans ce navigateur (navigation privée ?) : la partie ne sera pas conservée si vous fermez la page.',
  },
} as const;

export type Strings = typeof fr;

/** Textes actifs. Pour ajouter une langue, choisir ici l'objet selon `navigator.language`. */
export const t: Strings = fr;
