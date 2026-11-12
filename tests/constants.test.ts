import { describe, expect, it } from 'vitest';
import { ENTRY_POINT_COUNT, GRID_COLS, GRID_ROWS } from '../src/game/constants';

describe('constantes de la grille', () => {
  it('suit le livret : 10 colonnes × 8 lignes', () => {
    expect(GRID_COLS).toBe(10);
    expect(GRID_ROWS).toBe(8);
  });

  it("compte 36 points d'entrée (1–18 et A–R)", () => {
    expect(ENTRY_POINT_COUNT).toBe(36);
  });
});
