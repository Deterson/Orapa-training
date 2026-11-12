import { describe, expect, it } from 'vitest';
import { ENTRY_POINTS } from '../src/game/board';
import { BOOKLET_LAYOUT } from '../src/game/examples';
import { shoot, shootAll } from '../src/game/laser';
import { place, randomValidLayout, seededRandom } from './helpers';

describe('exemples du livret (schéma de la page 2)', () => {
  it('depuis le point I, le rayon ressort rouge en I', () => {
    const result = shoot(BOOKLET_LAYOUT, 'I');
    expect(result.exit).toBe('I');
    expect(result.color).toBe('red');
    expect(result.touched).toEqual(['red']);
  });

  it('depuis le point 15, le rayon ressort violet clair en 8', () => {
    const result = shoot(BOOKLET_LAYOUT, '15');
    expect(result.exit).toBe('8');
    expect(result.color).toBe('light-violet');
    // Losange blanc, puis parallélogramme rouge, puis grand triangle bleu.
    expect(result.touched).toEqual(['white', 'red', 'blue']);
    expect(result.hits.map((hit) => hit.gem)).toEqual([1, 0, 4]);
  });

  it('trace le chemin du point 15 : trois virages à angle droit', () => {
    const { path } = shoot(BOOKLET_LAYOUT, '15');
    expect(path).toEqual([
      [10, 4.5],
      [2.5, 4.5],
      [2.5, 1.5],
      [7.5, 1.5],
      [7.5, 0],
    ]);
  });
});

describe('rayon sans obstacle', () => {
  it('traverse la grille et sort en face, transparent', () => {
    expect(shoot([], '1')).toMatchObject({ exit: 'I', color: 'transparent', hits: [] });
    expect(shoot([], '10')).toMatchObject({ exit: 'R' });
    expect(shoot([], 'I')).toMatchObject({ exit: '1' });
    expect(shoot([], 'A')).toMatchObject({ exit: '11' });
    expect(shoot([], '18')).toMatchObject({ exit: 'H' });
    expect(shoot([], '15')).toMatchObject({ exit: 'E' });
  });

  it('accepte les minuscules et refuse un repère inconnu', () => {
    expect(shoot([], 'i').entry).toBe('I');
    expect(() => shoot([], 'Z')).toThrow();
    expect(() => shoot([], '19')).toThrow();
  });
});

describe('réflexions', () => {
  const yellowInCorner = place('yellow-triangle', [
    [0, 0],
    [2, 0],
    [0, 2],
  ]);

  it('repart en sens inverse sur une face perpendiculaire', () => {
    // La gemme est collée au bord gauche : le rayon de la ligne A touche son côté vertical.
    const result = shoot([yellowInCorner], 'A');
    expect(result).toMatchObject({ exit: 'A', color: 'yellow' });
    expect(result.path).toEqual([
      [0, 0.5],
      [0, 0.5],
      [0, 0.5],
    ]);
  });

  it('tourne de 90° sur une face à 45°', () => {
    // Depuis le bas, colonne 1 : touche l'hypoténuse en (0,5 ; 1,5) puis part vers la droite.
    const result = shoot([yellowInCorner], 'I');
    expect(result).toMatchObject({ exit: '12', color: 'yellow' });
    expect(result.path).toEqual([
      [0.5, 8],
      [0.5, 1.5],
      [10, 1.5],
    ]);
  });

  it('une gemme blanche seule rend le rayon blanc', () => {
    const rhombus = place('white-rhombus', [
      [4, 3],
      [5, 4],
      [4, 5],
      [3, 4],
    ]);
    expect(shoot([rhombus], 'E')).toMatchObject({ color: 'white' });
  });

  it("ne compte qu'une fois une couleur touchée par deux gemmes", () => {
    // Le rayon du point 15 rebondit sur le losange blanc, puis sur le grand triangle blanc.
    const rhombus = place('white-rhombus', [
      [2, 4],
      [3, 5],
      [2, 6],
      [1, 5],
    ]);
    const triangle = place('white-triangle', [
      [1, 0],
      [5, 0],
      [3, 2],
    ]);
    const result = shoot([rhombus, triangle], '15');
    expect(result.hits.map((hit) => hit.gem)).toEqual([0, 1]);
    expect(result.touched).toEqual(['white']);
    expect(result.color).toBe('white');
    expect(result.exit).toBe('B');
  });
});

describe('couleurs mélangées sur un trajet', () => {
  it("mélange rouge, bleu et blanc du livret dans l'ordre du contact", () => {
    const result = shoot(BOOKLET_LAYOUT, '15');
    expect(result.touched).toEqual(['white', 'red', 'blue']);
    expect(result.color).toBe('light-violet');
  });
});

describe('propriétés sur 36 entrées', () => {
  it("donne un résultat pour chacun des 36 points d'entrée", () => {
    const results = shootAll(BOOKLET_LAYOUT);
    expect(results).toHaveLength(36);
    expect(results.map((r) => r.entry)).toEqual(ENTRY_POINTS.map((p) => p.label));
  });

  it('est réversible sur la disposition du livret', () => {
    for (const result of shootAll(BOOKLET_LAYOUT)) {
      const back = shoot(BOOKLET_LAYOUT, result.exit);
      expect(back.exit, `${result.entry} → ${result.exit}`).toBe(result.entry);
      expect([...back.touched].sort()).toEqual([...result.touched].sort());
      expect(back.color).toBe(result.color);
    }
  });

  it('est réversible, sans boucle, sur 300 dispositions valides tirées au hasard', () => {
    const random = seededRandom(2024);
    let checked = 0;
    for (let i = 0; i < 300; i++) {
      const layout = randomValidLayout(random);
      if (layout === null) continue;
      checked++;
      const results = shootAll(layout);
      const exits = new Set<string>();
      for (const result of results) {
        // Aucune exception : le rayon sort toujours.
        exits.add(result.exit);
        const back = shoot(layout, result.exit);
        expect(back.exit).toBe(result.entry);
        expect(back.color).toBe(result.color);
      }
      // Réversible veut dire que « entrée → sortie » est un appariement : 36 sorties distinctes.
      expect(exits.size).toBe(36);
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("le trajet reste dans le plateau et ne tourne qu'à angle droit", () => {
    const random = seededRandom(7);
    for (let i = 0; i < 50; i++) {
      const layout = randomValidLayout(random);
      if (layout === null) continue;
      for (const { path } of shootAll(layout)) {
        for (const [x, y] of path) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(10);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(8);
        }
        for (let k = 1; k < path.length; k++) {
          const [x1, y1] = path[k - 1] ?? [0, 0];
          const [x2, y2] = path[k] ?? [0, 0];
          expect(x1 === x2 || y1 === y2).toBe(true);
        }
      }
    }
  });
});
