import type { GemColor, ResultColor } from '../game/colors';

/** Remplissage des gemmes. */
export const GEM_FILL: Record<GemColor, string> = {
  red: '#c0392b',
  yellow: '#e8b100',
  blue: '#2f6fb5',
  white: '#f4f4f4',
};

/** Couleur d'affichage de chaque couleur de rayon annoncée. */
export const RAY_COLOR: Record<ResultColor, string> = {
  transparent: '#9aa3b2',
  red: '#e74c3c',
  yellow: '#f1c40f',
  blue: '#3498db',
  white: '#ffffff',
  orange: '#e67e22',
  violet: '#8e44ad',
  green: '#27ae60',
  pink: '#ff8fab',
  'light-yellow': '#f7e26b',
  'light-blue': '#8ec5ff',
  'light-violet': '#c3a6ff',
  black: '#222222',
  'light-green': '#9be59b',
  'light-orange': '#ffbf80',
  gray: '#8a8a8a',
};

import type { CellMark, Ink } from '../game/notes';

/** Couleur de l'encre du crayon. */
export const INK_COLOR: Record<Ink, string> = {
  ink: 'var(--fg)',
  red: '#d33a2c',
  yellow: '#e8b100',
  blue: '#2f6fb5',
  green: '#1e9e50',
};

export const INK_LABEL: Record<Ink, string> = {
  ink: 'noir',
  red: 'rouge',
  yellow: 'jaune',
  blue: 'bleu',
  green: 'vert',
};

/** Marques de couleur : lettre affichée en plus de la teinte, pour ne pas dépendre de la couleur seule. */
export const MARK_LETTER: Partial<Record<CellMark, string>> = {
  red: 'R',
  yellow: 'J',
  blue: 'B',
  white: 'Bl',
};

export const MARK_LABEL: Record<CellMark, string> = {
  red: 'rouge',
  yellow: 'jaune',
  blue: 'bleue',
  white: 'blanche',
  empty: 'vide',
  maybe: 'doute',
};
