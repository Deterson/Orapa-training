/**
 * Constantes de la grille. Source : docs/regles.md (« La grille »).
 * Un seul endroit pour les dimensions : ne jamais les écrire en dur ailleurs.
 */

/** Nombre de colonnes (numérotées 1 à 10). */
export const GRID_COLS = 10;

/** Nombre de lignes (lettres A à H). */
export const GRID_ROWS = 8;

/** Points d'entrée sur le bord : un par colonne en haut et en bas, un par ligne à gauche et à droite. */
export const ENTRY_POINT_COUNT = 2 * (GRID_COLS + GRID_ROWS);
