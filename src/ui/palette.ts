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
