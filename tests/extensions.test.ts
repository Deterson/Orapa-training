import { describe, expect, it } from 'vitest';
import {
  ALL_GEM_IDS,
  BASE_GEM_IDS,
  GEM_SHAPES,
  type Placement,
  distinctOrientations,
  extensionsOf,
  gemsFor,
  orientedPolygon,
} from '../src/game/gems';
import { generateMine } from '../src/game/generate';
import { boundingBox } from '../src/game/geometry';
import { ABSORBED, shoot, shootAll } from '../src/game/laser';
import { probeCell } from '../src/game/probe';
import { validatePlacements } from '../src/game/placement';
import { parseSave, SAVE_VERSION } from '../src/game/save';
import { GameSession } from '../src/game/session';
import { emptySolution, gemsOf, isComplete } from '../src/game/solution';
import { isVisible } from '../src/game/visibility';
import { place } from './helpers';

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
    const colors = (layout: Placement[]) => shootAll(layout).map((o) => o.color);
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

describe('génération avec extensions', () => {
  const CASES = [
    { diamond: true, blackBody: false },
    { diamond: false, blackBody: true },
    { diamond: true, blackBody: true },
  ];

  it.each(CASES)(
    'mines valides et visibles avec %o',
    (extensions) => {
      for (let i = 0; i < 6; i++) {
        const { placements } = generateMine(`ext-${i}`, extensions);
        expect(placements.map((p) => p.gem)).toEqual(gemsFor(extensions));
        expect(validatePlacements(placements)).toEqual([]);
        expect(isVisible(placements)).toBe(true);
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
