import type { GemColor, ResultColor } from '../game/colors';
import { type Polygon, gridSegments } from '../game/geometry';

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
};

export const INK_LABEL: Record<Ink, string> = {
  ink: 'noir',
  red: 'rouge',
  yellow: 'jaune',
  blue: 'bleu',
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

/** Motif des cases « vides » dans les notes : stries diagonales grises, transparentes. */
export const PATTERN_DEFS = `<defs>
  <pattern id="pat-empty" width="0.24" height="0.24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="0.24" stroke="#6b7280" stroke-opacity="0.5" stroke-width="0.07"/></pattern>
</defs>`;

/** Teinte un peu plus foncée de `hex` (#rrggbb) : `factor` < 1 assombrit. */
function darken(hex: string, factor: number): string {
  const channel = (start: number): string =>
    Math.round(parseInt(hex.slice(start, start + 2), 16) * factor)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

/** Couleur du quadrillage de chaque gemme : un peu plus foncée que la gemme elle-même. */
export const GEM_GRID_COLOR: Record<GemColor, string> = {
  red: darken(GEM_FILL.red, 0.78),
  yellow: darken(GEM_FILL.yellow, 0.78),
  blue: darken(GEM_FILL.blue, 0.78),
  white: darken(GEM_FILL.white, 0.8),
};

/**
 * Gemme dessinée : couleur pleine et quadrillage (les lignes de la grille qui traversent la pièce,
 * comme sur les vraies pièces), un peu plus foncé que la couleur de la gemme.
 */
export function gemPolygons(polygon: Polygon, color: GemColor, className = '', title = ''): string {
  const cls = className ? ` class="${className}"` : '';
  const label = title ? `<title>${title}</title>` : '';
  const points = polygon.map(([x, y]) => `${x},${y}`).join(' ');
  const path = gridSegments(polygon)
    .map(([[x1, y1], [x2, y2]]) => `M${x1} ${y1}L${x2} ${y2}`)
    .join('');
  const grid = path ? `<path class="gem-grid" d="${path}" stroke="${GEM_GRID_COLOR[color]}"/>` : '';
  return `<polygon${cls} points="${points}" fill="${GEM_FILL[color]}">${label}</polygon>${grid}`;
}

/** Couleur de texte lisible (sombre ou claire) sur un fond donné en #rrggbb. */
export function readableOn(hex: string): string {
  const channel = (start: number): number => parseInt(hex.slice(start, start + 2), 16) / 255;
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.55 ? '#111111' : '#ffffff';
}
