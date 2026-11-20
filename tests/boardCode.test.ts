import { describe, expect, it } from 'vitest';
import { decodeBoard, encodeBoard } from '../src/game/boardCode';
import { generateMine, randomVisibleLayout } from '../src/game/generate';
import { gemsFor } from '../src/game/gems';
import { createRng } from '../src/game/rng';
import { isCorrect } from '../src/game/verify';
import { validatePlacements } from '../src/game/placement';
import { isVisible } from '../src/game/visibility';

describe("code de partage d'un plateau", () => {
  it("encode puis décode à l'identique, partie de base", () => {
    for (let i = 0; i < 40; i++) {
      const { placements } = generateMine(`code-${i}`);
      const code = encodeBoard(placements);
      expect(code).toMatch(/^[A-Za-z0-9_-]{18}$/);
      const decoded = decodeBoard(code);
      expect(decoded).not.toBeNull();
      expect(isCorrect(placements, decoded ?? [])).toBe(true);
    }
  });

  it('gère les extensions', () => {
    for (let i = 0; i < 20; i++) {
      const { placements } = generateMine(`ext-${i}`, { diamond: true, blackBody: true });
      const decoded = decodeBoard(encodeBoard(placements));
      expect(decoded).not.toBeNull();
      expect(decoded?.length).toBe(7);
      expect(isCorrect(placements, decoded ?? [])).toBe(true);
    }
  });

  it('ignore les espaces autour du code', () => {
    const { placements } = generateMine('espaces');
    expect(decodeBoard(`  ${encodeBoard(placements)}\n`)).not.toBeNull();
  });

  it('refuse les codes illisibles ou abîmés', () => {
    const code = encodeBoard(generateMine('abime').placements);
    expect(decodeBoard('')).toBeNull();
    expect(decodeBoard('???')).toBeNull();
    expect(decodeBoard(code.slice(0, -2))).toBeNull();
    const damaged = (code[0] === 'A' ? 'B' : 'A') + code.slice(1);
    expect(decodeBoard(damaged)).toBeNull();
  });

  it('refuse un plateau qui enfreint les règles', () => {
    const { placements } = generateMine('regles');
    // Deux gemmes superposées : le code est bien formé mais le plateau n'est pas jouable.
    const first = placements[0];
    const second = placements[1];
    if (!first || !second) throw new Error('mine incomplète');
    const stacked = [first, { ...second, col: first.col, row: first.row }, ...placements.slice(2)];
    expect(decodeBoard(encodeBoard(stacked))).toBeNull();
  });
});

describe('randomVisibleLayout', () => {
  it('donne des plateaux valides et visibles', () => {
    const rng = createRng('visibles');
    for (let i = 0; i < 30; i++) {
      const layout = randomVisibleLayout(
        rng,
        gemsFor({ diamond: i % 2 === 0, blackBody: i % 3 === 0 }),
      );
      expect(validatePlacements(layout)).toEqual([]);
      expect(isVisible(layout)).toBe(true);
    }
  });
});
