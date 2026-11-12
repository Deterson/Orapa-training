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
  grey: 'grisée',
  empty: 'vide',
  maybe: 'doute',
};

/**
 * Motifs ajoutés aux couleurs des gemmes : la couleur ne doit pas être le seul moyen de les
 * distinguer (daltonisme, écran en noir et blanc). Rouge : hachures, jaune : points,
 * bleu : lignes horizontales, blanc : uni.
 */
export const PATTERN_DEFS = `<defs>
  <pattern id="pat-red" width="0.3" height="0.3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="0.3" stroke="#000" stroke-opacity="0.38" stroke-width="0.07"/></pattern>
  <pattern id="pat-yellow" width="0.32" height="0.32" patternUnits="userSpaceOnUse"><circle cx="0.16" cy="0.16" r="0.05" fill="#000" fill-opacity="0.45"/></pattern>
  <pattern id="pat-blue" width="0.3" height="0.3" patternUnits="userSpaceOnUse"><line x1="0" y1="0.15" x2="0.3" y2="0.15" stroke="#fff" stroke-opacity="0.5" stroke-width="0.06"/></pattern>
</defs>`;

/** Gemme dessinée : couleur pleine puis motif par-dessus (le blanc reste uni). */
export function gemPolygons(points: string, color: GemColor, className = '', title = ''): string {
  const cls = className ? ` class="${className}"` : '';
  const label = title ? `<title>${title}</title>` : '';
  const base = `<polygon${cls} points="${points}" fill="${GEM_FILL[color]}">${label}</polygon>`;
  if (color === 'white') return base;
  return `${base}<polygon class="gem-pattern" points="${points}" fill="url(#pat-${color})" pointer-events="none"/>`;
}
