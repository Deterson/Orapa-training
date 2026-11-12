import { describe, expect, it } from 'vitest';
import { BOOKLET_LAYOUT } from '../src/game/examples';
import { parseCell } from '../src/game/board';
import { GRID_COLS, GRID_ROWS } from '../src/game/constants';
import { placedPolygon } from '../src/game/gems';
import { probeCell } from '../src/game/probe';

const at = (label: string) => probeCell(BOOKLET_LAYOUT, parseCell(label)!);

describe('sonder une case', () => {
  it('répond « rien » sur une case vide', () => {
    expect(at('A1')).toBe('nothing');
    expect(at('E8')).toBe('nothing');
    expect(at('H10')).toBe('nothing');
  });

  it('donne la couleur de la gemme qui occupe la case', () => {
    // Parallélogramme rouge sur la ligne B, colonnes 1 à 3.
    expect(at('B2')).toBe('red');
    // Losange blanc, au centre de ses deux lignes et deux colonnes.
    expect(at('E3')).toBe('white');
    // Grand triangle bleu, dont l'apex est en colonne 8.
    expect(at('C9')).toBe('blue');
  });

  it("compte une case que la gemme ne couvre qu'à moitié", () => {
    // La diagonale du petit triangle jaune coupe la case G5 en deux.
    expect(at('G4')).toBe('yellow');
    expect(at('H4')).toBe('yellow');
  });

  it('ne compte pas une case que la gemme touche seulement par un coin ou un côté', () => {
    // Le triangle jaune (cases G4-H5) ne déborde pas sur G6.
    expect(at('G6')).toBe('nothing');
    // Le losange (colonnes 2 et 3, lignes E et F) ne touche la case E1 que par son sommet (1, 5).
    expect(at('E1')).toBe('nothing');
    // Il recouvre en revanche la moitié de chacune de ses quatre cases.
    for (const cell of ['E2', 'E3', 'F2', 'F3']) expect(at(cell)).toBe('white');
  });

  it('est cohérent avec les polygones : une case est « occupée » si elle recouvre une gemme', () => {
    let occupied = 0;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (probeCell(BOOKLET_LAYOUT, { row, col }) !== 'nothing') occupied++;
      }
    }
    // Aire des gemmes : rouge 2, jaune 2, bleu 4, losange 2, grand blanc 4 = 14 cases d'aire ;
    // chaque demi-case compte pour une case occupée, donc au moins 14 cases sondées occupées.
    const area = BOOKLET_LAYOUT.reduce((sum, p) => {
      const points = placedPolygon(p);
      let twice = 0;
      points.forEach(([x, y], i) => {
        const [nx, ny] = points[(i + 1) % points.length] ?? [x, y];
        twice += x * ny - nx * y;
      });
      return sum + Math.abs(twice) / 2;
    }, 0);
    expect(area).toBe(14);
    expect(occupied).toBeGreaterThanOrEqual(area);
  });
});
