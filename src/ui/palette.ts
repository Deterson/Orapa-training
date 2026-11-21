import {
  type GemPaint,
  RESULT_COLOR_LABELS,
  type ResultColor,
  componentColors,
} from '../game/colors';
import { type Polygon, gridSegments } from '../game/geometry';

/** Remplissage des gemmes (palette normale). */
const GEM_FILL_NORMAL: Record<GemPaint, string> = {
  red: '#c0392b',
  yellow: '#e8b100',
  blue: '#2f6fb5',
  white: '#f4f4f4',
  // Diamant : verre bleuté, dessiné creux (voir gemPolygons) ; corps noir : presque noir.
  clear: '#a3ccec',
  black: '#1f1f25',
};

/** Couleur d'affichage de chaque couleur de rayon annoncée (palette normale). */
const RAY_COLOR_NORMAL: Record<ResultColor, string> = {
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

/** Couleur de l'encre du crayon (palette normale). */
const INK_COLOR_NORMAL: Record<Ink, string> = {
  // S'adapte au thème : sombre en clair, clair en sombre.
  ink: 'var(--fg)',
  black: '#000000',
  red: '#d33a2c',
  yellow: '#e8b100',
  blue: '#2f6fb5',
};

/*
 * Mode daltonien : palette d'Okabe et Ito, conçue pour rester distincte avec les formes courantes de
 * daltonisme (rouge et vert confondus, bleu et jaune). Elle ne suffit pas seule : en plus, chaque gemme
 * colorée porte un motif (hachures, points, quadrillage fin) et les pastilles de l'historique une lettre.
 */
const GEM_FILL_CB: Record<GemPaint, string> = {
  red: '#d55e00',
  yellow: '#f0e442',
  blue: '#0072b2',
  white: '#f4f4f4',
  clear: '#a3ccec',
  black: '#1f1f25',
};

const RAY_COLOR_CB: Record<ResultColor, string> = {
  transparent: '#9aa3b2',
  red: '#d55e00',
  yellow: '#f0e442',
  blue: '#0072b2',
  white: '#ffffff',
  orange: '#e69f00',
  violet: '#cc79a7',
  green: '#009e73',
  pink: '#f7c6d9',
  'light-yellow': '#f8f2a8',
  'light-blue': '#56b4e9',
  'light-violet': '#e6bdd6',
  black: '#222222',
  'light-green': '#7fd3b8',
  'light-orange': '#f5cf86',
  gray: '#8a8a8a',
};

const INK_COLOR_CB: Record<Ink, string> = {
  ink: 'var(--fg)',
  black: '#000000',
  red: '#d55e00',
  yellow: '#e69f00',
  blue: '#0072b2',
};

/** Remplissage des gemmes. */
export const GEM_FILL: Record<GemPaint, string> = { ...GEM_FILL_NORMAL };

/** Couleur d'affichage de chaque couleur de rayon annoncée. */
export const RAY_COLOR: Record<ResultColor, string> = { ...RAY_COLOR_NORMAL };

/** Couleur de l'encre du crayon. */
export const INK_COLOR: Record<Ink, string> = { ...INK_COLOR_NORMAL };

export const INK_LABEL: Record<Ink, string> = {
  ink: 'auto',
  black: 'noir',
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
  <pattern id="pat-red" width="0.26" height="0.26" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="0.26" stroke="#000" stroke-opacity="0.42" stroke-width="0.07"/></pattern>
  <pattern id="pat-yellow" width="0.3" height="0.3" patternUnits="userSpaceOnUse"><circle cx="0.15" cy="0.15" r="0.055" fill="#000" fill-opacity="0.5"/></pattern>
  <pattern id="pat-blue" width="0.26" height="0.26" patternUnits="userSpaceOnUse"><path d="M0 0.13H0.26M0.13 0V0.26" stroke="#fff" stroke-opacity="0.55" stroke-width="0.05"/></pattern>
</defs>`;

/**
 * Nom d'une couleur de rayon pour l'infobulle des pastilles : une couleur composée montre l'addition des
 * couleurs de gemmes (« rouge + bleu + blanc = violet clair »), une couleur simple son nom seul.
 */
export function colorSumLabel(color: ResultColor): string {
  const parts = componentColors(color);
  return parts.length > 1
    ? `${parts.map((part) => RESULT_COLOR_LABELS[part]).join(' + ')} = ${RESULT_COLOR_LABELS[color]}`
    : RESULT_COLOR_LABELS[color];
}

/** Opacité du centre du Diamant : sa bordure est pleine, son intérieur seulement teinté. */
export const CLEAR_FILL_OPACITY = 0.3;

/** Teinte un peu plus foncée de `hex` (#rrggbb) : `factor` < 1 assombrit. */
function darken(hex: string, factor: number): string {
  const channel = (start: number): string =>
    Math.round(parseInt(hex.slice(start, start + 2), 16) * factor)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

/** Couleur du quadrillage de chaque gemme : un peu plus foncée que la gemme elle-même. */
function gridColors(fill: Record<GemPaint, string>): Record<GemPaint, string> {
  return {
    red: darken(fill.red, 0.78),
    yellow: darken(fill.yellow, 0.78),
    blue: darken(fill.blue, 0.78),
    white: darken(fill.white, 0.8),
    clear: darken(fill.clear, 0.8),
    // Sur le noir, un quadrillage plus foncé ne se verrait pas : plus clair.
    black: '#4a4a55',
  };
}

export const GEM_GRID_COLOR: Record<GemPaint, string> = gridColors(GEM_FILL);

let colorblindMode = false;

/** Le mode daltonien est-il actif ? */
export function isColorblind(): boolean {
  return colorblindMode;
}

/**
 * Active ou désactive le mode daltonien : palette adaptée, motifs sur les gemmes, lettres sur les pastilles.
 * Les règles du jeu ne changent pas. À appeler avant d'afficher : tout le dessin relit ces tables.
 */
export function setColorblind(on: boolean): void {
  colorblindMode = on;
  Object.assign(GEM_FILL, on ? GEM_FILL_CB : GEM_FILL_NORMAL);
  Object.assign(RAY_COLOR, on ? RAY_COLOR_CB : RAY_COLOR_NORMAL);
  Object.assign(INK_COLOR, on ? INK_COLOR_CB : INK_COLOR_NORMAL);
  Object.assign(GEM_GRID_COLOR, gridColors(GEM_FILL));
}

/** Motif de chaque gemme colorée en mode daltonien (la blanche, le Diamant et le Corps noir n'en ont pas). */
export const GEM_PATTERN: Partial<Record<GemPaint, string>> = {
  red: 'pat-red',
  yellow: 'pat-yellow',
  blue: 'pat-blue',
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
  // Diamant : bordure franche, centre à 30 % d'opacité (le verre laisse voir la grille dessous).
  const hollow = color === 'clear';
  const classes = [className, hollow ? 'gem-clear' : ''].filter(Boolean).join(' ');
  const cls = classes ? ` class="${classes}"` : '';
  const opacity = hollow ? ` fill-opacity="${CLEAR_FILL_OPACITY}"` : '';
  const label = title ? `<title>${title}</title>` : '';
  const points = polygon.map(([x, y]) => `${x},${y}`).join(' ');
  const path = gridSegments(polygon)
    .map(([[x1, y1], [x2, y2]]) => `M${x1} ${y1}L${x2} ${y2}`)
    .join('');
  const grid = path ? `<path class="gem-grid" d="${path}" stroke="${GEM_GRID_COLOR[color]}"/>` : '';
  // Mode daltonien : un motif par gemme colorée, en plus de la couleur.
  const pattern = GEM_PATTERN[color];
  const hatch =
    colorblindMode && pattern
      ? `<polygon class="gem-pattern" points="${points}" fill="url(#${pattern})" pointer-events="none"/>`
      : '';
  // Trois calques : le fond, le quadrillage, puis la bordure par-dessus (elle ne passe pas sous le quadrillage).
  const edge = `<polygon class="gem-edge${hollow ? ' gem-edge-clear' : ''}" points="${points}" fill="none"/>`;
  return `<polygon${cls} points="${points}" fill="${GEM_FILL[color]}"${opacity}>${label}</polygon>${hatch}${grid}${edge}`;
}

/** Couleur de texte lisible (sombre ou claire) sur un fond donné en #rrggbb. */
export function readableOn(hex: string): string {
  const channel = (start: number): number => parseInt(hex.slice(start, start + 2), 16) / 255;
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.55 ? '#111111' : '#ffffff';
}
