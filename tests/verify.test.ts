import { describe, expect, it } from 'vitest';
import { BOOKLET_LAYOUT } from '../src/game/examples';
import { type Placement } from '../src/game/gems';
import { compareSolution, isCorrect, samePlacement } from '../src/game/verify';

const find = (gem: Placement['gem']): Placement => {
  const placement = BOOKLET_LAYOUT.find((p) => p.gem === gem);
  if (!placement) throw new Error(gem);
  return placement;
};
const red = find('red-parallelogram');
const yellow = find('yellow-triangle');

describe('correction', () => {
  it("accepte la mine elle-même, quel que soit l'ordre", () => {
    expect(isCorrect(BOOKLET_LAYOUT, BOOKLET_LAYOUT)).toBe(true);
    expect(isCorrect(BOOKLET_LAYOUT, [...BOOKLET_LAYOUT].reverse())).toBe(true);
  });

  it("refuse une gemme déplacée d'une case", () => {
    const moved = BOOKLET_LAYOUT.map((p) =>
      p.gem === 'yellow-triangle' ? { ...p, col: p.col + 1 } : p,
    );
    expect(isCorrect(BOOKLET_LAYOUT, moved)).toBe(false);
    const diffs = compareSolution(BOOKLET_LAYOUT, moved);
    expect(diffs.filter((d) => d.status === 'wrong').map((d) => d.gem)).toEqual([
      'yellow-triangle',
    ]);
    expect(diffs.filter((d) => d.status === 'correct')).toHaveLength(4);
  });

  it('refuse une proposition incomplète et signale la gemme manquante', () => {
    const partial = BOOKLET_LAYOUT.filter((p) => p.gem !== 'blue-triangle');
    expect(isCorrect(BOOKLET_LAYOUT, partial)).toBe(false);
    const missing = compareSolution(BOOKLET_LAYOUT, partial).filter((d) => d.status === 'missing');
    expect(missing.map((d) => d.gem)).toEqual(['blue-triangle']);
    expect(missing[0]?.guess).toBeNull();
  });

  it('refuse une proposition avec une gemme en trop', () => {
    expect(isCorrect(BOOKLET_LAYOUT, [...BOOKLET_LAYOUT, red])).toBe(false);
  });

  it('refuse la gemme rouge du mauvais côté', () => {
    const flipped = {
      ...red,
      orientation: { ...red.orientation, flipped: !red.orientation.flipped },
    };
    expect(samePlacement(red, flipped)).toBe(false);
  });

  it("compare des polygones, pas des numéros d'orientation : deux poses équivalentes sont égales", () => {
    // Le parallélogramme tourné de 180° occupe exactement le même polygone.
    const turned = { ...red, orientation: { ...red.orientation, rotation: 2 as const } };
    expect(samePlacement(red, turned)).toBe(true);
    // Le losange est identique dans ses quatre rotations.
    const rhombus = find('white-rhombus');
    expect(
      samePlacement(rhombus, { ...rhombus, orientation: { ...rhombus.orientation, rotation: 1 } }),
    ).toBe(true);
    expect(
      samePlacement(yellow, { ...yellow, orientation: { ...yellow.orientation, rotation: 1 } }),
    ).toBe(false);
  });
});
