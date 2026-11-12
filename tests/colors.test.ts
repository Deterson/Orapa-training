import { describe, expect, it } from 'vitest';
import { type GemColor, type ResultColor, mixColors } from '../src/game/colors';

// Table du livret et du schéma des couleurs (docs/regles.md).
const TABLE: [GemColor[], ResultColor][] = [
  [[], 'transparent'],
  [['red'], 'red'],
  [['blue'], 'blue'],
  [['yellow'], 'yellow'],
  [['white'], 'white'],
  [['red', 'yellow'], 'orange'],
  [['red', 'blue'], 'violet'],
  [['blue', 'yellow'], 'green'],
  [['red', 'white'], 'pink'],
  [['yellow', 'white'], 'light-yellow'],
  [['blue', 'white'], 'light-blue'],
  [['red', 'blue', 'white'], 'light-violet'],
  [['red', 'blue', 'yellow'], 'black'],
  [['blue', 'yellow', 'white'], 'light-green'],
  [['red', 'yellow', 'white'], 'light-orange'],
  [['red', 'blue', 'yellow', 'white'], 'gray'],
];

describe('mélange des couleurs', () => {
  it.each(TABLE)('%j donne %s', (touched, expected) => {
    expect(mixColors(touched)).toBe(expected);
  });

  it('couvre les 16 combinaisons, toutes différentes', () => {
    expect(TABLE).toHaveLength(16);
    expect(new Set(TABLE.map(([, result]) => result)).size).toBe(16);
  });

  it("ne dépend pas de l'ordre", () => {
    expect(mixColors(['white', 'red'])).toBe(mixColors(['red', 'white']));
    expect(mixColors(['blue', 'yellow', 'red'])).toBe('black');
  });

  it("ne compte qu'une fois chaque couleur", () => {
    expect(mixColors(['white', 'white', 'red'])).toBe('pink');
    expect(mixColors(['red', 'red', 'red'])).toBe('red');
  });
});
