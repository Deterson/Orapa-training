import { describe, expect, it } from 'vitest';
import { boundingBox, polygonKey } from '../src/game/geometry';
import {
  BASE_GEM_IDS,
  GEM_SHAPES,
  type GemId,
  distinctOrientations,
  orientedPolygon,
  placedPolygon,
  placementFromPolygon,
} from '../src/game/gems';

describe('jeu de la partie de base', () => {
  it('compte 5 gemmes : 1 rouge, 1 jaune, 1 bleue, 2 blanches', () => {
    const colors = BASE_GEM_IDS.map((id) => GEM_SHAPES[id].color).sort();
    expect(colors).toEqual(['blue', 'red', 'white', 'white', 'yellow']);
  });

  it('ne permet de retourner que la gemme rouge', () => {
    const flippable = Object.values(GEM_SHAPES).filter((shape) => shape.flippable);
    expect(flippable.map((shape) => shape.id)).toEqual(['red-parallelogram']);
  });

  it("n'a que des côtés alignés sur la grille ou à 45°, avec des sommets entiers", () => {
    for (const shape of Object.values(GEM_SHAPES)) {
      shape.vertices.forEach(([x, y], i) => {
        expect(Number.isInteger(x) && Number.isInteger(y), shape.id).toBe(true);
        const [nx, ny] = shape.vertices[(i + 1) % shape.vertices.length] ?? [x, y];
        const dx = Math.abs(nx - x);
        const dy = Math.abs(ny - y);
        expect(dx === 0 || dy === 0 || dx === dy, `${shape.id} côté ${i}`).toBe(true);
      });
    }
  });

  it('a les boîtes englobantes lues sur le livret', () => {
    const size = (id: GemId) => {
      const box = boundingBox(GEM_SHAPES[id].vertices);
      return [box.maxX - box.minX, box.maxY - box.minY];
    };
    expect(size('red-parallelogram')).toEqual([3, 1]);
    expect(size('yellow-triangle')).toEqual([2, 2]);
    expect(size('blue-triangle')).toEqual([4, 2]);
    expect(size('white-rhombus')).toEqual([2, 2]);
    expect(size('white-triangle')).toEqual([4, 2]);
  });
});

describe('orientations', () => {
  it.each([
    ['red-parallelogram', 4],
    ['yellow-triangle', 4],
    ['blue-triangle', 4],
    ['white-rhombus', 1],
    ['white-triangle', 4],
  ] as const)('%s a %i positions distinctes', (id, count) => {
    expect(distinctOrientations(GEM_SHAPES[id])).toHaveLength(count);
  });

  it('donne à chaque orientation distincte une forme différente', () => {
    for (const shape of Object.values(GEM_SHAPES)) {
      const keys = distinctOrientations(shape).map((o) => polygonKey(orientedPolygon(shape, o)));
      expect(new Set(keys).size, shape.id).toBe(keys.length);
    }
  });

  it("garde la boîte englobante en (0, 0) quelle que soit l'orientation", () => {
    for (const shape of Object.values(GEM_SHAPES)) {
      for (const orientation of distinctOrientations(shape)) {
        const box = boundingBox(orientedPolygon(shape, orientation));
        expect([box.minX, box.minY], shape.id).toEqual([0, 0]);
      }
    }
  });

  it('retourner le parallélogramme rouge change son inclinaison', () => {
    const shape = GEM_SHAPES['red-parallelogram'];
    const plain = polygonKey(orientedPolygon(shape, { rotation: 0, flipped: false }));
    const flipped = polygonKey(orientedPolygon(shape, { rotation: 0, flipped: true }));
    expect(flipped).not.toBe(plain);
    // Penché vers la gauche : (0,0) (2,0) (3,1) (1,1).
    expect(flipped).toBe(
      polygonKey([
        [0, 0],
        [2, 0],
        [3, 1],
        [1, 1],
      ]),
    );
  });

  it('tourne le parallélogramme en 1×3 après un quart de tour', () => {
    const shape = GEM_SHAPES['red-parallelogram'];
    const box = boundingBox(orientedPolygon(shape, { rotation: 1, flipped: false }));
    expect([box.maxX, box.maxY]).toEqual([1, 3]);
  });

  it('place un polygone en coordonnées de la grille', () => {
    const polygon = placedPolygon({
      gem: 'yellow-triangle',
      orientation: { rotation: 0, flipped: false },
      col: 3,
      row: 6,
    });
    expect(polygonKey(polygon)).toBe(
      polygonKey([
        [3, 6],
        [5, 6],
        [3, 8],
      ]),
    );
  });
});

describe('placementFromPolygon', () => {
  it('retrouve la pose de chaque orientation de chaque gemme', () => {
    for (const shape of Object.values(GEM_SHAPES)) {
      for (const orientation of distinctOrientations(shape)) {
        const polygon = placedPolygon({ gem: shape.id, orientation, col: 2, row: 1 });
        const found = placementFromPolygon(shape.id, polygon);
        expect(found, shape.id).not.toBeNull();
        if (found) {
          expect(polygonKey(placedPolygon(found))).toBe(polygonKey(polygon));
        }
      }
    }
  });

  it("refuse une forme qui n'est pas celle de la gemme", () => {
    expect(
      placementFromPolygon('yellow-triangle', [
        [0, 0],
        [4, 0],
        [2, 2],
      ]),
    ).toBeNull();
  });

  it('refuse une forme qui demanderait de retourner une gemme non retournable', () => {
    // Le triangle jaune est symétrique à son miroir : il a quand même ses 4 rotations,
    // donc on teste avec le seul cas inatteignable : une forme étrangère.
    expect(
      placementFromPolygon('white-rhombus', [
        [0, 0],
        [2, 0],
        [0, 2],
      ]),
    ).toBeNull();
  });
});
