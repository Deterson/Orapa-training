import type { GemPaint, ResultColor } from '../game/colors';
import { type Polygon, gridSegments } from '../game/geometry';

/** Remplissage des gemmes. */
export const GEM_FILL: Record<GemPaint, string> = {
  red: '#c0392b',
  yellow: '#e8b100',
  blue: '#2f6fb5',
  white: '#f4f4f4',
  // Diamant : verre bleuté ; diamant noir : presque noir.
  clear: '#c9e9f5',
  black: '#1f1f25',
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
export const GEM_GRID_COLOR: Record<GemPaint, string> = {
  red: darken(GEM_FILL.red, 0.78),
  yellow: darken(GEM_FILL.yellow, 0.78),
  blue: darken(GEM_FILL.blue, 0.78),
  white: darken(GEM_FILL.white, 0.8),
  clear: darken(GEM_FILL.clear, 0.78),
  // Sur le noir, un quadrillage plus foncé ne se verrait pas : plus clair.
  black: '#4a4a55',
};

/** Lettre affichée sur la marque d'une sonde, en plus de la couleur. */
export const PAINT_LETTER: Record<GemPaint, string> = {
  red: 'R',
  yellow: 'J',
  blue: 'B',
  white: 'Bl',
  clear: 'D',
  black: '',
};

/** Contenu du pictogramme « signal perdu » : un symbole wifi rouge barré, dans une boîte 24×24. */
const LOST_SIGNAL_PATHS = `<path d="M2.6 9.2a13.6 13.6 0 0 1 18.8 0M6.2 12.9a8.4 8.4 0 0 1 11.6 0M9.8 16.5a3.2 3.2 0 0 1 4.4 0" fill="none" stroke="#d92d20" stroke-width="2.3" stroke-linecap="round"/><circle cx="12" cy="19.8" r="1.5" fill="#d92d20"/><path d="M4 3.5L20 21" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="0.9"/><path d="M4 3.5L20 21" stroke="#d92d20" stroke-width="2.6" stroke-linecap="round"/>`;

/** Pictogramme « signal perdu » dans une grille SVG, centré en (cx, cy), de côté `size` (en cases). */
export function lostSignalSvg(cx: number, cy: number, size: number): string {
  const scale = size / 24;
  return `<g class="lost-signal" transform="translate(${cx - 12 * scale} ${cy - 12 * scale}) scale(${scale})" aria-hidden="true">${LOST_SIGNAL_PATHS}</g>`;
}

/** Le même pictogramme dans le texte (historique, message). */
export function lostSignalHtml(): string {
  return `<svg class="lost-signal-icon" viewBox="0 0 24 24" aria-hidden="true">${LOST_SIGNAL_PATHS}</svg>`;
}

/**
 * Gemme dessinée : couleur pleine et quadrillage (les lignes de la grille qui traversent la pièce,
 * comme sur les vraies pièces), un peu plus foncé que la couleur de la gemme.
 */
export function gemPolygons(polygon: Polygon, color: GemPaint, className = '', title = ''): string {
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
