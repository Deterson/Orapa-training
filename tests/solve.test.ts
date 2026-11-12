import { describe, expect, it } from 'vitest';
import { BOOKLET_LAYOUT } from '../src/game/examples';
import {
  type GemId,
  type Placement,
  distinctOrientations,
  GEM_SHAPES,
  orientedPolygon,
  placedPolygon,
} from '../src/game/gems';
import { boundingBox, polygonKey } from '../src/game/geometry';
import { GRID_COLS, GRID_ROWS } from '../src/game/constants';
import { sameSignature, signatureOf } from '../src/game/laser';
import { validatePlacements } from '../src/game/placement';
import { isUnique, solve } from '../src/game/solve';
import { isVisible } from '../src/game/visibility';
import { randomValidLayout, seededRandom } from './helpers';

const keyOf = (layout: readonly Placement[]): string =>
  layout
    .map((p) => `${p.gem}:${polygonKey(placedPolygon(p))}`)
    .sort()
    .join('|');

/** Toutes les poses d'une gemme dans la grille. */
function allPoses(gem: GemId): Placement[] {
  const shape = GEM_SHAPES[gem];
  const poses: Placement[] = [];
  for (const orientation of distinctOrientations(shape)) {
    const box = boundingBox(orientedPolygon(shape, orientation));
    for (let col = 0; col + box.maxX <= GRID_COLS; col++) {
      for (let row = 0; row + box.maxY <= GRID_ROWS; row++) {
        poses.push({ gem, orientation, col, row });
      }
    }
  }
  return poses;
}

/** Énumération exhaustive : toutes les paires valides et visibles qui donnent cette signature. */
function bruteForcePairs(layout: readonly Placement[]): string[] {
  const signature = signatureOf(layout);
  const [first, second] = layout.map((p) => p.gem) as [GemId, GemId];
  const found: string[] = [];
  for (const a of allPoses(first)) {
    for (const b of allPoses(second)) {
      const pair = [a, b];
      if (validatePlacements(pair).length > 0) continue;
      if (!sameSignature(signatureOf(pair), signature)) continue;
      if (!isVisible(pair)) continue;
      found.push(keyOf(pair));
    }
  }
  return found.sort();
}

describe("solveur d'unicité : exactitude", () => {
  it('retrouve la mine du livret parmi ses solutions', () => {
    const { solutions, complete } = solve(signatureOf(BOOKLET_LAYOUT), undefined, { limit: 10 });
    expect(complete).toBe(true);
    expect(solutions.map(keyOf)).toContain(keyOf(BOOKLET_LAYOUT));
  });

  it('ne renvoie que des dispositions valides, visibles et de même signature', () => {
    const random = seededRandom(5);
    let checked = 0;
    for (let i = 0; i < 30; i++) {
      const layout = randomValidLayout(random);
      if (layout === null || !isVisible(layout)) continue;
      checked++;
      const signature = signatureOf(layout);
      const { solutions, complete } = solve(signature, undefined, { limit: 5 });
      expect(complete).toBe(true);
      expect(solutions.map(keyOf)).toContain(keyOf(layout));
      for (const solution of solutions) {
        expect(validatePlacements(solution)).toEqual([]);
        expect(isVisible(solution)).toBe(true);
        expect(sameSignature(signatureOf(solution), signature)).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it("donne le même ensemble de solutions qu'une énumération exhaustive (2 gemmes)", () => {
    const random = seededRandom(17);
    const pools: [GemId, GemId][] = [
      ['white-rhombus', 'yellow-triangle'],
      ['white-rhombus', 'red-parallelogram'],
      ['white-rhombus', 'blue-triangle'],
      ['yellow-triangle', 'red-parallelogram'],
    ];
    let compared = 0;
    for (let i = 0; compared < 12 && i < 400; i++) {
      const full = randomValidLayout(random);
      if (full === null) continue;
      const [gemA, gemB] = pools[compared % pools.length] as [GemId, GemId];
      const layout = full.filter((p) => p.gem === gemA || p.gem === gemB);
      if (layout.length !== 2 || !isVisible(layout)) continue;
      compared++;
      const expected = bruteForcePairs(layout);
      const { solutions, complete } = solve(signatureOf(layout), [gemA, gemB], {
        limit: Infinity,
        maxNodes: 1_000_000,
      });
      expect(complete).toBe(true);
      expect(solutions.map(keyOf).sort()).toEqual(expected);
    }
    expect(compared).toBe(12);
  }, 120_000);

  it("signale une recherche interrompue plutôt qu'une fausse unicité", () => {
    const result = solve(signatureOf(BOOKLET_LAYOUT), undefined, { limit: 2, maxNodes: 3 });
    expect(result.complete).toBe(false);
    expect(isUnique(BOOKLET_LAYOUT, { maxNodes: 3 })).toBe(false);
  });
});

describe('isUnique', () => {
  // Mine réelle (graine 1 des tests) ambiguë : le triangle jaune peut être une colonne plus à
  // gauche sans qu'aucun des 36 tirs ne le révèle.
  const layout = (yellowCol: number): Placement[] => [
    { gem: 'red-parallelogram', orientation: { rotation: 1, flipped: true }, col: 0, row: 5 },
    {
      gem: 'yellow-triangle',
      orientation: { rotation: 0, flipped: false },
      col: yellowCol,
      row: 4,
    },
    { gem: 'blue-triangle', orientation: { rotation: 0, flipped: false }, col: 1, row: 6 },
    { gem: 'white-rhombus', orientation: { rotation: 0, flipped: false }, col: 4, row: 0 },
    { gem: 'white-triangle', orientation: { rotation: 0, flipped: false }, col: 0, row: 0 },
  ];

  it('refuse une mine ambiguë et trouve ses deux solutions', () => {
    expect(isVisible(layout(3))).toBe(true);
    expect(isUnique(layout(3))).toBe(false);
    const { solutions } = solve(signatureOf(layout(3)), undefined, { limit: 5 });
    expect(solutions.map(keyOf).sort()).toEqual([keyOf(layout(2)), keyOf(layout(3))].sort());
  });

  it('les deux solutions ont bien la même signature', () => {
    expect(sameSignature(signatureOf(layout(2)), signatureOf(layout(3)))).toBe(true);
  });

  it("accepte une mine dont la signature n'a qu'une solution", () => {
    const random = seededRandom(3);
    let unique = 0;
    for (let i = 0; i < 20; i++) {
      const candidate = randomValidLayout(random);
      if (candidate !== null && isVisible(candidate) && isUnique(candidate)) unique++;
    }
    expect(unique).toBeGreaterThan(10);
  });
});
