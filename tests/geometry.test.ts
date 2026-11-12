import { describe, expect, it } from 'vitest';
import {
  type Polygon,
  boundingBox,
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
