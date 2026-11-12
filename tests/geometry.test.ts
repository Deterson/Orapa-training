import { describe, expect, it } from 'vitest';
import {
  type Polygon,
  boundingBox,
  gridSegments,
  mirrorX,
  normalize,
  polygonKey,
  relation,
  rotateQuarterTurn,
  translate,
} from '../src/game/geometry';

const TRIANGLE: Polygon = [
  [0, 0],
  [2, 0],
  [0, 2],
];

describe('transformations', () => {
  it("tourne d'un quart de tour dans le sens horaire (y vers le bas)", () => {
    // Le point à l'est (1, 0) passe au sud (0, 1).
    expect(rotateQuarterTurn([[1, 0]])).toEqual([[-0, 1]]);
  });

  it("revient à l'identique après quatre quarts de tour", () => {
    let polygon: Polygon = TRIANGLE;
    for (let i = 0; i < 4; i++) polygon = rotateQuarterTurn(polygon);
    expect(polygonKey(polygon)).toBe(polygonKey(TRIANGLE));
  });

  it('applique un miroir et recale la boîte en (0, 0)', () => {
    const mirrored = normalize(mirrorX(TRIANGLE));
    expect(polygonKey(mirrored)).toBe(
      polygonKey([
        [2, 0],
        [0, 0],
        [2, 2],
      ]),
    );
    expect(boundingBox(mirrored)).toEqual({ minX: 0, maxX: 2, minY: 0, maxY: 2 });
  });

  it('déplace un polygone', () => {
    expect(translate([[1, 1]], 2, 3)).toEqual([[3, 4]]);
  });
});

describe('relation entre deux polygones convexes', () => {
  it('« apart » : aucun point commun', () => {
    expect(relation(TRIANGLE, translate(TRIANGLE, 5, 5))).toBe('apart');
  });

  it('« apart » : proches mais séparés', () => {
    expect(relation(TRIANGLE, translate(TRIANGLE, 3, 0))).toBe('apart');
  });

  it('« overlap » : recouvrement partiel', () => {
    expect(relation(TRIANGLE, translate(TRIANGLE, 1, 0))).toBe('overlap');
  });

  it('« overlap » : polygones identiques', () => {
    expect(relation(TRIANGLE, TRIANGLE)).toBe('overlap');
  });

  it("« overlap » : l'un contenu dans l'autre", () => {
    const big: Polygon = [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ];
    const small: Polygon = [
      [1, 1],
      [2, 1],
      [2, 2],
      [1, 2],
    ];
    expect(relation(big, small)).toBe('overlap');
  });

  it('« point » : coin contre coin', () => {
    // Le sommet (2, 0) du premier triangle est aussi celui du second.
    const other: Polygon = [
      [2, 0],
      [4, 0],
      [2, 2],
    ];
    expect(relation(TRIANGLE, other)).toBe('point');
  });

  it("« point » : un sommet contre le milieu d'un côté", () => {
    // Le sommet (1, 1) touche le milieu de l'hypoténuse du triangle de référence.
    const other: Polygon = [
      [1, 1],
      [3, 1],
      [1, 3],
    ];
    expect(relation(TRIANGLE, other)).toBe('point');
  });

  it('« segment » : côté entier partagé', () => {
    const square: Polygon = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ];
    expect(relation(square, translate(square, 2, 0))).toBe('segment');
  });

  it('« segment » : côtés qui se recouvrent en partie', () => {
    const square: Polygon = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ];
    expect(relation(square, translate(square, 2, 1))).toBe('segment');
  });

  it('« point » : côtés alignés qui ne se touchent que par une extrémité', () => {
    const square: Polygon = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ];
    expect(relation(square, translate(square, 2, 2))).toBe('point');
  });

  it('« apart » : côtés alignés mais disjoints', () => {
    const square: Polygon = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ];
    expect(relation(square, translate(square, 2, 3))).toBe('apart');
  });

  it('« segment » : côté diagonal partagé (schéma d du livret)', () => {
    const rhombus: Polygon = [
      [1, 0],
      [2, 1],
      [1, 2],
      [0, 1],
    ];
    const parallelogram: Polygon = [
      [2, 1],
      [4, 1],
      [3, 2],
      [1, 2],
    ];
    expect(relation(rhombus, parallelogram)).toBe('segment');
  });

  it('est symétrique', () => {
    const other: Polygon = [
      [1, 1],
      [3, 1],
      [1, 3],
    ];
    expect(relation(other, TRIANGLE)).toBe(relation(TRIANGLE, other));
  });
});

describe('quadrillage des gemmes', () => {
  const sorted = (segments: ReturnType<typeof gridSegments>) =>
    segments.map((segment) => JSON.stringify(segment)).sort();

  it('découpe les lignes de la grille dans le petit triangle', () => {
    // Triangle (0,0) (2,0) (0,2) : une ligne verticale et une horizontale, chacune d'une case.
    expect(sorted(gridSegments(TRIANGLE))).toEqual(
      sorted([
        [
          [1, 0],
          [1, 1],
        ],
        [
          [0, 1],
          [1, 1],
        ],
      ]),
    );
  });

  it('découpe le grand triangle (base 4, hauteur 2) en lignes de longueurs 1, 2, 1 et un trait horizontal', () => {
    const big: Polygon = [
      [0, 0],
      [4, 0],
      [2, 2],
    ];
    expect(sorted(gridSegments(big))).toEqual(
      sorted([
        [
          [1, 0],
          [1, 1],
        ],
        [
          [2, 0],
          [2, 2],
        ],
        [
          [3, 0],
          [3, 1],
        ],
        [
          [1, 1],
          [3, 1],
        ],
      ]),
    );
  });

  it('ne trace rien pour un polygone qui tient dans une case', () => {
    expect(
      gridSegments([
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ]),
    ).toEqual([]);
  });

  it("ne trace que des traits horizontaux ou verticaux, à l'intérieur de la boîte du polygone", () => {
    const rhombus: Polygon = [
      [1, 0],
      [2, 1],
      [1, 2],
      [0, 1],
    ];
    const box = boundingBox(rhombus);
    const segments = gridSegments(rhombus);
    expect(segments.length).toBeGreaterThan(0);
    for (const [[x1, y1], [x2, y2]] of segments) {
      expect(x1 === x2 || y1 === y2).toBe(true);
      for (const [x, y] of [
        [x1, y1],
        [x2, y2],
      ] as const) {
        expect(x).toBeGreaterThanOrEqual(box.minX);
        expect(x).toBeLessThanOrEqual(box.maxX);
        expect(y).toBeGreaterThanOrEqual(box.minY);
        expect(y).toBeLessThanOrEqual(box.maxY);
      }
    }
  });

  it('suit la gemme quand elle est déplacée : les traits restent sur la grille', () => {
    const moved = translate(TRIANGLE, 3, 4);
    expect(sorted(gridSegments(moved))).toEqual(
      sorted([
        [
          [4, 4],
          [4, 5],
        ],
        [
          [3, 5],
          [4, 5],
        ],
      ]),
    );
  });

  it('une pièce à position fractionnaire garde son propre quadrillage', () => {
    const shifted = translate(TRIANGLE, 0.4, 9.7);
    const rounded = gridSegments(shifted).map((segment) =>
      segment.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]),
    );
    // Mêmes traits que le triangle d'origine, décalés de (0,4 ; 9,7).
    expect(rounded.map((segment) => JSON.stringify(segment)).sort()).toEqual(
      [
        [
          [1.4, 9.7],
          [1.4, 10.7],
        ],
        [
          [0.4, 10.7],
          [1.4, 10.7],
        ],
      ]
        .map((segment) => JSON.stringify(segment))
        .sort(),
    );
  });
});
