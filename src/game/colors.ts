/**
 * Couleurs des gemmes et couleur résultante d'un rayon.
 * Source : docs/regles.md (« Couleurs »).
 */

/** Couleur d'une gemme de la partie de base. */
export type GemColor = 'red' | 'yellow' | 'blue' | 'white';

/** Couleur annoncée pour un rayon. */
export type ResultColor =
  | 'transparent'
  | 'red'
  | 'yellow'
  | 'blue'
  | 'white'
  | 'orange'
  | 'violet'
  | 'green'
  | 'pink'
  | 'light-yellow'
  | 'light-blue'
  | 'light-violet'
  | 'black'
  | 'light-green'
  | 'light-orange'
  | 'gray';

/** Bit de chaque couleur dans le masque des couleurs touchées. */
export const GEM_COLOR_BIT: Record<GemColor, number> = { red: 1, yellow: 2, blue: 4, white: 8 };
const BIT = GEM_COLOR_BIT;

/** Table de mélange indexée par le masque des couleurs distinctes touchées (rouge=1, jaune=2, bleu=4, blanc=8). */
const MIX_TABLE: readonly ResultColor[] = [
  'transparent', // 0 : aucune
  'red', // 1
  'yellow', // 2
  'orange', // 3 : rouge + jaune
  'blue', // 4
  'violet', // 5 : rouge + bleu
  'green', // 6 : jaune + bleu
  'black', // 7 : rouge + jaune + bleu
  'white', // 8
  'pink', // 9 : rouge + blanc
  'light-yellow', // 10 : jaune + blanc
  'light-orange', // 11 : rouge + jaune + blanc
  'light-blue', // 12 : bleu + blanc
  'light-violet', // 13 : rouge + bleu + blanc
  'light-green', // 14 : jaune + bleu + blanc
  'gray', // 15 : les quatre
];

/**
 * Couleur résultante d'un rayon qui a touché ces gemmes.
 * Seul l'ensemble des couleurs distinctes compte : ni l'ordre ni le nombre de contacts.
 */
export function mixColors(touched: Iterable<GemColor>): ResultColor {
  let mask = 0;
  for (const color of touched) {
    mask |= BIT[color];
  }
  const result = MIX_TABLE[mask];
  if (result === undefined) {
    throw new Error(`Masque de couleurs invalide : ${mask}`);
  }
  return result;
}

const MASK_OF_RESULT = new Map<ResultColor, number>(MIX_TABLE.map((color, mask) => [color, mask]));

/** Masque des couleurs de gemmes touchées qui donne cette couleur (l'inverse de mixColors). */
export function colorMask(result: ResultColor): number {
  const mask = MASK_OF_RESULT.get(result);
  if (mask === undefined) throw new Error(`Couleur inconnue : ${result}`);
  return mask;
}

/** Les couleurs de gemmes qui composent une couleur de rayon (vide pour « transparent »). */
export function componentColors(result: ResultColor): GemColor[] {
  const mask = colorMask(result);
  return (Object.keys(GEM_COLOR_BIT) as GemColor[]).filter(
    (color) => (mask & GEM_COLOR_BIT[color]) !== 0,
  );
}

export const RESULT_COLOR_LABELS: Record<ResultColor, string> = {
  transparent: 'transparent',
  red: 'rouge',
  yellow: 'jaune',
  blue: 'bleu',
  white: 'blanc',
  orange: 'orange',
  violet: 'violet',
  green: 'vert',
  pink: 'rose',
  'light-yellow': 'jaune clair',
  'light-blue': 'bleu clair',
  'light-violet': 'violet clair',
  black: 'noir',
  'light-green': 'vert clair',
  'light-orange': 'orange clair',
  gray: 'gris',
};

export const GEM_COLOR_LABELS: Record<GemColor, string> = {
  red: 'rouge',
  yellow: 'jaune',
  blue: 'bleue',
  white: 'blanche',
};
