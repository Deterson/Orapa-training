import { describe, expect, it } from 'vitest';
import { BOOKLET_LAYOUT } from '../src/game/examples';
import type { Placement } from '../src/game/gems';
import { isValidPlacement, validatePlacements } from '../src/game/placement';
import { place } from './helpers';

const rules = (placements: readonly Placement[]) =>
  validatePlacements(placements).map((v) => v.rule);

describe('placement valide', () => {
  it('accepte la disposition du livret', () => {
    expect(validatePlacements(BOOKLET_LAYOUT)).toEqual([]);
    expect(isValidPlacement(BOOKLET_LAYOUT)).toBe(true);
  });

  it('accepte une grille vide et une seule gemme', () => {
    expect(isValidPlacement([])).toBe(true);
    expect(
      isValidPlacement([
        place('white-rhombus', [
          [4, 3],
          [5, 4],
          [4, 5],
          [3, 4],
        ]),
      ]),
    ).toBe(true);
  });

  it('accepte des gemmes collées au bord', () => {
    const corner = place('yellow-triangle', [
      [0, 0],
      [2, 0],
      [0, 2],
    ]);
    const farCorner = place('blue-triangle', [
      [6, 8],
      [10, 8],
      [8, 6],
    ]);
    expect(isValidPlacement([corner, farCorner])).toBe(true);
  });

  it('accepte un contact par un coin', () => {
    const a = place('yellow-triangle', [
      [0, 0],
      [2, 0],
      [0, 2],
    ]);
    const b = place('blue-triangle', [
      [2, 0],
      [2, 4],
      [4, 2],
    ]);
    expect(rules([a, b])).toEqual([]);
  });

  it("accepte un sommet posé contre le milieu d'un côté", () => {
    const a = place('yellow-triangle', [
      [0, 0],
      [2, 0],
      [0, 2],
    ]);
    const b = place('blue-triangle', [
      [1, 1],
      [1, 5],
      [3, 3],
    ]);
    expect(rules([a, b])).toEqual([]);
  });
});

describe('règle a : face quadrillée visible', () => {
  it('accepte la gemme rouge retournée', () => {
    const flipped = place('red-parallelogram', [
      [0, 0],
      [2, 0],
      [3, 1],
      [1, 1],
    ]);
    expect(flipped.orientation.flipped).toBe(true);
    expect(isValidPlacement([flipped])).toBe(true);
  });

  it('refuse toute autre gemme retournée', () => {
    const bad: Placement = {
      gem: 'yellow-triangle',
      orientation: { rotation: 0, flipped: true },
      col: 0,
      row: 0,
    };
    expect(rules([bad])).toEqual(['a']);
  });
});

describe('règle b : alignement sur la grille', () => {
  it("refuse une position qui n'est pas sur la grille", () => {
    const base = place('yellow-triangle', [
      [0, 0],
      [2, 0],
      [0, 2],
    ]);
    expect(rules([{ ...base, col: 1.5 }])).toEqual(['b']);
    expect(rules([{ ...base, row: 0.25 }])).toEqual(['b']);
  });

  it("refuse une rotation qui n'est pas un quart de tour", () => {
    const base = place('yellow-triangle', [
      [0, 0],
      [2, 0],
      [0, 2],
    ]);
    const crooked = { ...base, orientation: { ...base.orientation, rotation: 5 as 0 } };
    expect(rules([crooked])).toEqual(['b']);
  });
});

describe('règle c : dans le plateau', () => {
  it('refuse une gemme qui dépasse à droite, en bas, à gauche ou en haut', () => {
    const base = place('blue-triangle', [
      [0, 0],
      [4, 0],
      [2, 2],
    ]);
    expect(rules([{ ...base, col: 7 }])).toEqual(['c']);
    expect(rules([{ ...base, row: 7 }])).toEqual(['c']);
    expect(rules([{ ...base, col: -1 }])).toEqual(['c']);
    expect(rules([{ ...base, row: -1 }])).toEqual(['c']);
  });

  it('accepte la gemme qui touche exactement le bord', () => {
    const base = place('blue-triangle', [
      [0, 0],
      [4, 0],
      [2, 2],
    ]);
    expect(rules([{ ...base, col: 6, row: 6 }])).toEqual([]);
  });
});

describe('règle d : pas côte à côte', () => {
  it('refuse le losange blanc collé au parallélogramme rouge (schéma d du livret)', () => {
    const rhombus = place('white-rhombus', [
      [1, 0],
      [2, 1],
      [1, 2],
      [0, 1],
    ]);
    const red = place('red-parallelogram', [
      [2, 1],
      [4, 1],
      [3, 2],
      [1, 2],
    ]);
    const violations = validatePlacements([rhombus, red]);
    expect(violations.map((v) => v.rule)).toEqual(['d']);
    expect(violations[0]?.gems).toEqual([0, 1]);
    expect(violations[0]?.message).toContain('règle d');
  });

  it('refuse deux gemmes qui partagent un côté droit', () => {
    // Le côté bas du triangle jaune (de x = 0 à 2) longe le côté haut du grand triangle bleu.
    const a = place('yellow-triangle', [
      [0, 0],
      [0, 2],
      [2, 2],
    ]);
    const b = place('blue-triangle', [
      [0, 2],
      [4, 2],
      [2, 4],
    ]);
    expect(rules([a, b])).toEqual(['d']);
  });
});

describe('recouvrement et doublons', () => {
  it('refuse deux gemmes qui se chevauchent', () => {
    const a = place('yellow-triangle', [
      [0, 0],
      [2, 0],
      [0, 2],
    ]);
    const b = place('blue-triangle', [
      [0, 0],
      [4, 0],
      [2, 2],
    ]);
    expect(rules([a, b])).toEqual(['overlap']);
  });

  it('refuse la même gemme posée deux fois', () => {
    const a = place('yellow-triangle', [
      [0, 0],
      [2, 0],
      [0, 2],
    ]);
    const b = place('yellow-triangle', [
      [5, 5],
      [7, 5],
      [5, 7],
    ]);
    expect(rules([a, b])).toEqual(['duplicate']);
  });

  it('signale plusieurs violations à la fois', () => {
    const wrongFace: Placement = {
      gem: 'yellow-triangle',
      orientation: { rotation: 0, flipped: true },
      col: 9,
      row: 0,
    };
    expect(rules([wrongFace]).sort()).toEqual(['a', 'c']);
  });
});
