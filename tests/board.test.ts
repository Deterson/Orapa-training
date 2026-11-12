import { describe, expect, it } from 'vitest';
import {
  ENTRY_POINTS,
  cellLabel,
  entryDirection,
  entryPoint,
  exitSide,
  parseCell,
  parseEntryLabel,
} from '../src/game/board';
import { GRID_COLS, GRID_ROWS } from '../src/game/constants';

describe('cases', () => {
  it('nomme les cases comme le livret : ligne A–H puis colonne 1–10', () => {
    expect(cellLabel({ row: 4, col: 3 })).toBe('E4');
    expect(cellLabel({ row: 1, col: 2 })).toBe('B3');
    expect(cellLabel({ row: 0, col: 0 })).toBe('A1');
    expect(cellLabel({ row: 7, col: 9 })).toBe('H10');
  });

  it('relit les 80 libellés de cases dans les deux sens', () => {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        expect(parseCell(cellLabel({ row, col }))).toEqual({ row, col });
      }
    }
  });

  it('accepte les minuscules et refuse ce qui est hors de la grille', () => {
    expect(parseCell('e4')).toEqual({ row: 4, col: 3 });
    for (const bad of ['', 'E', '4', 'I4', 'A0', 'A11', 'E04x', 'AA1']) {
      expect(parseCell(bad), bad).toBeNull();
    }
  });

  it('refuse de nommer une case hors de la grille', () => {
    expect(() => cellLabel({ row: 8, col: 0 })).toThrow();
    expect(() => cellLabel({ row: 0, col: 10 })).toThrow();
  });
});

describe("points d'entrée", () => {
  it('en compte 36, tous distincts', () => {
    expect(ENTRY_POINTS).toHaveLength(36);
    expect(new Set(ENTRY_POINTS.map((p) => p.label)).size).toBe(36);
  });

  it('suit la numérotation du livret', () => {
    expect(entryPoint('top', 0).label).toBe('1');
    expect(entryPoint('top', 9).label).toBe('10');
    expect(entryPoint('right', 0).label).toBe('11');
    expect(entryPoint('right', 7).label).toBe('18');
    expect(entryPoint('bottom', 0).label).toBe('I');
    expect(entryPoint('bottom', 9).label).toBe('R');
    expect(entryPoint('left', 0).label).toBe('A');
    expect(entryPoint('left', 7).label).toBe('H');
  });

  it('place le 15 sur la ligne E à droite et le I sur la colonne 1 en bas', () => {
    expect(parseEntryLabel('15')).toEqual({ label: '15', side: 'right', index: 4 });
    expect(parseEntryLabel('I')).toEqual({ label: 'I', side: 'bottom', index: 0 });
  });

  it('relit chaque repère, accepte les minuscules, refuse le reste', () => {
    for (const point of ENTRY_POINTS) {
      expect(parseEntryLabel(point.label)).toEqual(point);
    }
    expect(parseEntryLabel('i')).toEqual(entryPoint('bottom', 0));
    for (const bad of ['', '0', '19', 'S', 'Z', '1A', 'AB']) {
      expect(parseEntryLabel(bad), bad).toBeNull();
    }
  });

  it('refuse un point du bord inexistant', () => {
    expect(() => entryPoint('top', 10)).toThrow();
    expect(() => entryPoint('left', 8)).toThrow();
    expect(() => entryPoint('left', -1)).toThrow();
  });

  it("envoie le rayon perpendiculairement au bord, vers l'intérieur", () => {
    expect(entryDirection('top')).toEqual([0, 1]);
    expect(entryDirection('right')).toEqual([-1, 0]);
    expect(entryDirection('bottom')).toEqual([0, -1]);
    expect(entryDirection('left')).toEqual([1, 0]);
  });

  it('sort du côté vers lequel avance le rayon', () => {
    expect(exitSide(1, 0)).toBe('right');
    expect(exitSide(-1, 0)).toBe('left');
    expect(exitSide(0, 1)).toBe('bottom');
    expect(exitSide(0, -1)).toBe('top');
  });
});
