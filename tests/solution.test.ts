import { describe, expect, it } from 'vitest';
import { BOOKLET_LAYOUT } from '../src/game/examples';
import { generateMine } from '../src/game/generate';
import { GEM_SHAPES, type GemId, placedPolygon } from '../src/game/gems';
import { boundingBox } from '../src/game/geometry';
import { GameSession } from '../src/game/session';
import {
  type Solution,
  compareWithShots,
  dropGem,
  emptySolution,
  flipGem,
  isComplete,
  isSubmittable,
  nudgeGem,
  placedGems,
  removeGem,
  rotateGem,
  solutionIssues,
} from '../src/game/solution';

const fromLayout = (layout: typeof BOOKLET_LAYOUT): Solution => {
  let solution = emptySolution();
  for (const p of layout) {
    solution = { ...solution, [p.gem]: p };
  }
  return solution;
};

describe('solution : poser et déplacer', () => {
  it("part d'une réserve pleine", () => {
    const solution = emptySolution();
    expect(placedGems(solution)).toEqual([]);
    expect(isComplete(solution)).toBe(false);
    expect(Object.keys(solution)).toHaveLength(5);
  });

  it('pose une gemme à la case voulue', () => {
    const solution = dropGem(emptySolution(), 'yellow-triangle', 3, 6);
    expect(solution['yellow-triangle']).toMatchObject({ col: 3, row: 6 });
  });

  it('arrondit la position à la case la plus proche', () => {
    const solution = dropGem(emptySolution(), 'yellow-triangle', 2.6, 3.4);
    expect(solution['yellow-triangle']).toMatchObject({ col: 3, row: 3 });
  });

  it('ramène une gemme qui dépasse dans le plateau (règle c)', () => {
    let solution = dropGem(emptySolution(), 'blue-triangle', 9, 7);
    expect(solution['blue-triangle']).toMatchObject({ col: 6, row: 6 });
    solution = dropGem(solution, 'blue-triangle', -3, -2);
    expect(solution['blue-triangle']).toMatchObject({ col: 0, row: 0 });
  });

  it("déplace d'une case sans sortir du plateau", () => {
    let solution = dropGem(emptySolution(), 'white-rhombus', 0, 0);
    solution = nudgeGem(solution, 'white-rhombus', -1, 0);
    expect(solution['white-rhombus']).toMatchObject({ col: 0, row: 0 });
    solution = nudgeGem(solution, 'white-rhombus', 2, 1);
    expect(solution['white-rhombus']).toMatchObject({ col: 2, row: 1 });
  });

  it('retire une gemme', () => {
    const solution = removeGem(dropGem(emptySolution(), 'blue-triangle', 1, 1), 'blue-triangle');
    expect(solution['blue-triangle']).toBeNull();
  });

  it("ne fait rien sur une gemme qui n'est pas posée", () => {
    const solution = emptySolution();
    expect(rotateGem(solution, 'blue-triangle')).toBe(solution);
    expect(flipGem(solution, 'red-parallelogram')).toBe(solution);
    expect(nudgeGem(solution, 'blue-triangle', 1, 1)).toBe(solution);
  });
});

describe('solution : rotation et retournement', () => {
  it("pivote d'un quart de tour et échange largeur et hauteur", () => {
    let solution = dropGem(emptySolution(), 'blue-triangle', 2, 2);
    const before = boundingBox(placedPolygon(solution['blue-triangle']!));
    expect([before.maxX - before.minX, before.maxY - before.minY]).toEqual([4, 2]);
    solution = rotateGem(solution, 'blue-triangle');
    const after = boundingBox(placedPolygon(solution['blue-triangle']!));
    expect([after.maxX - after.minX, after.maxY - after.minY]).toEqual([2, 4]);
  });

  it('garde la gemme dans le plateau après une rotation', () => {
    let solution = dropGem(emptySolution(), 'blue-triangle', 6, 6);
    solution = rotateGem(solution, 'blue-triangle');
    const box = boundingBox(placedPolygon(solution['blue-triangle']!));
    expect(box.maxY).toBeLessThanOrEqual(8);
    expect(solution['blue-triangle']).toMatchObject({ col: 6, row: 4 });
  });

  it("revient à l'orientation de départ après quatre quarts de tour", () => {
    let solution = dropGem(emptySolution(), 'yellow-triangle', 4, 4);
    const start = solution['yellow-triangle']!.orientation;
    for (let i = 0; i < 4; i++) solution = rotateGem(solution, 'yellow-triangle');
    expect(solution['yellow-triangle']!.orientation).toEqual(start);
  });

  it('retourne la gemme rouge', () => {
    let solution = dropGem(emptySolution(), 'red-parallelogram', 2, 2);
    expect(solution['red-parallelogram']!.orientation.flipped).toBe(false);
    solution = flipGem(solution, 'red-parallelogram');
    expect(solution['red-parallelogram']!.orientation.flipped).toBe(true);
    solution = flipGem(solution, 'red-parallelogram');
    expect(solution['red-parallelogram']!.orientation.flipped).toBe(false);
  });

  it('refuse de retourner toute autre gemme', () => {
    const others: GemId[] = ['yellow-triangle', 'blue-triangle', 'white-rhombus', 'white-triangle'];
    for (const gem of others) {
      expect(GEM_SHAPES[gem].flippable).toBe(false);
      const solution = dropGem(emptySolution(), gem, 2, 2);
      expect(flipGem(solution, gem)).toBe(solution);
    }
  });
});

describe('solution : règles', () => {
  it('accepte la disposition du livret, complète et valide', () => {
    const solution = fromLayout(BOOKLET_LAYOUT);
    expect(isComplete(solution)).toBe(true);
    expect(solutionIssues(solution)).toEqual([]);
    expect(isSubmittable(solution)).toBe(true);
  });

  it('refuse une solution incomplète', () => {
    const solution = dropGem(emptySolution(), 'yellow-triangle', 0, 0);
    expect(isSubmittable(solution)).toBe(false);
  });

  it('signale deux gemmes qui se chevauchent, par identifiant', () => {
    let solution = dropGem(emptySolution(), 'yellow-triangle', 3, 3);
    solution = dropGem(solution, 'blue-triangle', 3, 3);
    const issues = solutionIssues(solution);
    expect(issues.map((i) => i.rule)).toContain('overlap');
    expect(issues[0]?.gemIds.sort()).toEqual(['blue-triangle', 'yellow-triangle']);
    expect(isSubmittable(solution)).toBe(false);
  });

  it('signale une gemme collée côte à côte (règle d)', () => {
    let solution = dropGem(emptySolution(), 'blue-triangle', 0, 2);
    solution = dropGem(solution, 'yellow-triangle', 0, 0);
    const rotated = rotateGem(
      rotateGem(rotateGem(solution, 'yellow-triangle'), 'yellow-triangle'),
      'yellow-triangle',
    );
    expect(solutionIssues(rotated).map((i) => i.rule)).toContain('d');
  });
});

describe('solution : comparaison avec les tirs', () => {
  const mine = generateMine('comparaison');
  const truth = fromLayout(mine.placements);

  it('la vraie solution reproduit tous les tirs', () => {
    const session = new GameSession(mine);
    ['1', 'I', 'A', '15', '11', '5'].forEach((label) => session.fire(label));
    const matches = compareWithShots(truth, session.shots);
    expect([...matches.values()]).toEqual([true, true, true, true, true, true]);
  });

  it('une grille vide ne reproduit pas les tirs qui touchent des gemmes', () => {
    const session = new GameSession(mine);
    for (const label of ['1', 'I', 'A', '15', '11', '5']) session.fire(label);
    const matches = compareWithShots(emptySolution(), session.shots);
    const touched = session.shots.filter((shot) => shot.color !== 'transparent');
    expect(touched.length).toBeGreaterThan(0);
    for (const shot of touched) expect(matches.get(shot.n)).toBe(false);
  });

  it('une gemme déplacée fait échouer au moins un tir parmi les 36', () => {
    const session = new GameSession(mine);
    for (let i = 0; i < 36; i++) {
      const label = [...'123456789'].concat(
        ['10', '11', '12', '13', '14', '15', '16', '17', '18'],
        [...'IJKLMNOPQR'],
        [...'ABCDEFGH'],
      )[i]!;
      session.fire(label);
    }
    expect([...compareWithShots(truth, session.shots).values()].every(Boolean)).toBe(true);
    const moved = nudgeGem(truth, 'yellow-triangle', 1, 0);
    const other = nudgeGem(truth, 'yellow-triangle', -1, 0);
    const failures = [moved, other].map(
      (s) => [...compareWithShots(s, session.shots).values()].filter((ok) => !ok).length,
    );
    expect(failures.some((n) => n > 0)).toBe(true);
  });
});
