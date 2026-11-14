import { describe, expect, it } from 'vitest';
import {
  ALL_GEM_IDS,
  BASE_GEM_IDS,
  GEM_SHAPES,
  type GemId,
  type Placement,
  distinctOrientations,
  extensionsOf,
  gemsFor,
  orientedPolygon,
  placedPolygon,
} from '../src/game/gems';
import { GRID_COLS, GRID_ROWS } from '../src/game/constants';
import { generateMine } from '../src/game/generate';
import { boundingBox, polygonKey } from '../src/game/geometry';
import { ABSORBED, sameSignature, shoot, signatureOf } from '../src/game/laser';
import { probeCell } from '../src/game/probe';
import { validatePlacements } from '../src/game/placement';
import { parseSave, SAVE_VERSION } from '../src/game/save';
import { GameSession } from '../src/game/session';
import { emptySolution, gemsOf, isComplete } from '../src/game/solution';
import { isUnique, solve } from '../src/game/solve';
import { isVisible } from '../src/game/visibility';
import { place, randomValidLayout, seededRandom } from './helpers';

const keyOf = (layout: readonly Placement[]): string =>
  layout
    .map((p) => `${p.gem}:${polygonKey(placedPolygon(p))}`)
    .sort()
    .join('|');

describe('gemmes des extensions', () => {
  it('le Diamant est un demi-losange 2×1, transparent, non retournable', () => {
    const diamond = GEM_SHAPES.diamond;
    expect(diamond.color).toBe('clear');
    expect(diamond.flippable).toBe(false);
    expect(distinctOrientations(diamond)).toHaveLength(4);
    expect(boundingBox(diamond.vertices)).toMatchObject({ maxX: 2, maxY: 1 });
  });

  it('le Corps noir est un rectangle 2×1, qui pivote et ne se retourne pas', () => {
    const body = GEM_SHAPES['black-body'];
    expect(body.color).toBe('black');
    expect(body.flippable).toBe(false);
    expect(distinctOrientations(body)).toHaveLength(2);
    const sizes = distinctOrientations(body).map((o) => {
      const box = boundingBox(orientedPolygon(body, o));
      return [box.maxX, box.maxY];
    });
    expect(sizes).toEqual([
      [2, 1],
      [1, 2],
    ]);
  });

  it('la rouge reste la seule gemme retournable', () => {
    expect(ALL_GEM_IDS.filter((id) => GEM_SHAPES[id].flippable)).toEqual(['red-parallelogram']);
  });

  it('compose la liste des gemmes selon les extensions choisies', () => {
    expect(gemsFor({ diamond: false, blackBody: false })).toEqual([...BASE_GEM_IDS]);
    expect(gemsFor({ diamond: true, blackBody: false })).toEqual([...BASE_GEM_IDS, 'diamond']);
    expect(gemsFor({ diamond: true, blackBody: true })).toEqual([...ALL_GEM_IDS]);
    expect(extensionsOf(gemsFor({ diamond: false, blackBody: true }))).toEqual({
      diamond: false,
      blackBody: true,
    });
  });
});

describe('rayon et extensions', () => {
  // Diamant (0,0) (2,0) (1,1) en C2:D2 posé à plat ; face oblique à gauche et à droite.
  const diamond = place('diamond', [
    [2, 3],
    [4, 3],
    [3, 4],
  ]);

  it('le Diamant dévie le rayon sans le colorer', () => {
    // Depuis le bas de la colonne 3 (x = 2,5), le rayon monte, touche la face oblique gauche...
    const shot = shoot([diamond], 'K');
    expect(shot.color).toBe('transparent');
    expect(shot.touched).toEqual([]);
    expect(shot.hits).toHaveLength(1);
    // ... et ressort à gauche (rangée D), pas en face.
    expect(shot.exit).toBe('D');
  });

  it('une gemme colorée touchée après le Diamant donne seule sa couleur', () => {
    const yellow = place('yellow-triangle', [
      [0, 3],
      [2, 3],
      [0, 5],
    ]);
    const colors = (layout: Placement[]) => signatureOf(layout).map((o) => o.color);
    expect(colors([yellow]).some((c) => c === 'yellow')).toBe(true);
    // Avec le Diamant en plus, aucune couleur nouvelle n'apparaît.
    for (const color of colors([yellow, diamond])) {
      expect(['transparent', 'yellow']).toContain(color);
    }
  });

  const body = place('black-body', [
    [3, 3],
    [5, 3],
    [5, 4],
    [3, 4],
  ]);

  it('le Corps noir absorbe le rayon : ni sortie, ni couleur', () => {
    const shot = shoot([body], '4');
    expect(shot.exit).toBe(ABSORBED);
    expect(shot.color).toBe('transparent');
    expect(shot.hits).toHaveLength(1);
    // Un tir qui le rate traverse normalement.
    expect(shoot([body], '1').exit).toBe('I');
  });

  it("absorbe aussi un rayon qui a touché d'autres gemmes avant", () => {
    // Le rayon de la colonne 4 rebondit sur le triangle jaune, puis file vers le Corps noir.
    const yellow = place('yellow-triangle', [
      [3, 0],
      [3, 2],
      [5, 2],
    ]);
    const farBody = place('black-body', [
      [6, 0],
      [8, 0],
      [8, 1],
      [6, 1],
    ]);
    const shot = shoot([yellow, farBody], '4');
    expect(shot.touched).toEqual(['yellow']);
    expect(shot.exit).toBe(ABSORBED);
  });

  it('sonde : « clear » pour le Diamant, « black » pour le Corps noir', () => {
    expect(probeCell([diamond, body], { row: 3, col: 2 })).toBe('clear');
    expect(probeCell([diamond, body], { row: 3, col: 3 })).toBe('clear');
    expect(probeCell([diamond, body], { row: 5, col: 4 })).toBe('nothing');
    expect(probeCell([body], { row: 3, col: 4 })).toBe('black');
  });
});

describe('solveur et extensions', () => {
  const POOLS: [GemId, GemId][] = [
    ['diamond', 'yellow-triangle'],
    ['diamond', 'white-rhombus'],
    ['black-body', 'white-rhombus'],
    ['black-body', 'yellow-triangle'],
    ['diamond', 'black-body'],
  ];

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

  function bruteForce(layout: readonly Placement[]): string[] {
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

  it("donne le même ensemble de solutions qu'une énumération exhaustive (2 gemmes)", () => {
    const random = seededRandom(23);
    let compared = 0;
    for (let i = 0; compared < 15 && i < 600; i++) {
      const [gemA, gemB] = POOLS[compared % POOLS.length] as [GemId, GemId];
      const pair: Placement[] = [];
      for (const gem of [gemA, gemB]) {
        const orientations = distinctOrientations(GEM_SHAPES[gem]);
        const orientation = orientations[Math.floor(random() * orientations.length)];
        if (orientation === undefined) continue;
        const box = boundingBox(orientedPolygon(GEM_SHAPES[gem], orientation));
        pair.push({
          gem,
          orientation,
          col: Math.floor(random() * (GRID_COLS - box.maxX + 1)),
          row: Math.floor(random() * (GRID_ROWS - box.maxY + 1)),
        });
      }
      if (pair.length !== 2 || validatePlacements(pair).length > 0 || !isVisible(pair)) continue;
      compared++;
      const { solutions, complete } = solve(signatureOf(pair), [gemA, gemB], {
        limit: Infinity,
        maxNodes: 2_000_000,
      });
      expect(complete).toBe(true);
      expect(solutions.map(keyOf).sort()).toEqual(bruteForce(pair));
    }
    expect(compared).toBe(15);
  }, 300_000);

  it('retrouve la vraie disposition parmi les solutions (7 gemmes)', () => {
    const random = seededRandom(31);
    let checked = 0;
    for (let i = 0; checked < 4 && i < 200; i++) {
      const base = randomValidLayout(random);
      if (base === null) continue;
      // Ajoute le Diamant et le Corps noir en les tirant au hasard.
      const layout = [...base];
      for (const gem of ['diamond', 'black-body'] as const) {
        for (let attempt = 0; attempt < 200; attempt++) {
          const poses = allPoses(gem);
          const candidate = poses[Math.floor(random() * poses.length)];
          if (candidate !== undefined && validatePlacements([...layout, candidate]).length === 0) {
            layout.push(candidate);
            break;
          }
        }
      }
      if (layout.length !== 7 || !isVisible(layout)) continue;
      checked++;
      const { solutions } = solve(
        signatureOf(layout),
        layout.map((p) => p.gem),
        { limit: 10, maxNodes: 1_000_000 },
      );
      expect(solutions.map(keyOf)).toContain(keyOf(layout));
    }
    expect(checked).toBe(4);
  }, 300_000);
});

describe('génération avec extensions', () => {
  const CASES = [
    { diamond: true, blackBody: false },
    { diamond: false, blackBody: true },
    { diamond: true, blackBody: true },
  ];

  it.each(CASES)(
    'mines valides, visibles et uniques avec %o',
    (extensions) => {
      for (let i = 0; i < 6; i++) {
        const { placements } = generateMine(`ext-${i}`, extensions);
        expect(placements.map((p) => p.gem)).toEqual(gemsFor(extensions));
        expect(validatePlacements(placements)).toEqual([]);
        expect(isVisible(placements)).toBe(true);
        expect(isUnique(placements)).toBe(true);
      }
    },
    180_000,
  );

  it('ne change pas les mines de la partie de base', () => {
    expect(generateMine('orapa', { diamond: false, blackBody: false })).toEqual(
      generateMine('orapa'),
    );
  });
});

describe('partie et sauvegarde avec extensions', () => {
  it('la partie annonce ses gemmes et le signal absorbé', () => {
    const session = GameSession.start('abs-1', { diamond: false, blackBody: true });
    expect(session.gems).toEqual(gemsFor({ diamond: false, blackBody: true }));
    for (let i = 1; i <= 36; i++) {
      // Les 36 repères : au moins un rayon est absorbé (le Corps noir est visible, règle e).
      const label = i <= 10 ? String(i) : i <= 18 ? String(i) : '';
      if (label !== '') session.fire(label);
    }
    expect(session.shots.some((shot) => shot.exit === ABSORBED)).toBe(true);
  }, 60_000);

  it('une solution vide porte sur les gemmes de la partie', () => {
    const gems = gemsFor({ diamond: true, blackBody: false });
    const solution = emptySolution(gems);
    expect(gemsOf(solution)).toEqual(gems);
    expect(isComplete(solution)).toBe(false);
  });

  it('sauvegarde et relit une partie avec extensions', () => {
    const session = GameSession.start('sav-1', { diamond: true, blackBody: true });
    const data = {
      version: SAVE_VERSION,
      savedAt: 1,
      session: session.toSnapshot(),
      solution: emptySolution(session.gems),
      notes: { marks: {}, strokes: [] },
      skipConfirm: false,
    };
    const parsed = parseSave(JSON.parse(JSON.stringify(data)));
    expect(parsed).not.toBeNull();
    expect(gemsOf(parsed?.solution ?? {})).toEqual([...ALL_GEM_IDS]);
    // Une solution qui ne porte pas sur les gemmes de la mine est refusée.
    expect(parseSave({ ...data, solution: emptySolution() })).toBeNull();
  }, 60_000);
});
