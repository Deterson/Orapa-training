import { describe, expect, it } from 'vitest';
import { scrollDeltaFor, thumbGeometry } from '../src/ui/scrollbar';

describe('barre de défilement légère', () => {
  it('pas de barre quand tout tient dans la zone', () => {
    expect(thumbGeometry(400, 400, 0).visible).toBe(false);
    expect(thumbGeometry(400, 380, 0).visible).toBe(false);
    expect(thumbGeometry(0, 800, 0).visible).toBe(false);
  });

  it('la poignée est proportionnelle au contenu visible', () => {
    const half = thumbGeometry(400, 800, 0);
    expect(half).toEqual({ visible: true, top: 0, height: 200 });
  });

  it('suit le défilement, de haut en bas', () => {
    const middle = thumbGeometry(400, 800, 200);
    expect(middle.top).toBeCloseTo(100, 5);
    const bottom = thumbGeometry(400, 800, 400);
    expect(bottom.top + bottom.height).toBeCloseTo(400, 5);
  });

  it('reste attrapable pour une très longue liste, et ne sort jamais de la zone', () => {
    const long = thumbGeometry(400, 100_000, 99_600);
    expect(long.height).toBe(28);
    expect(long.top + long.height).toBeLessThanOrEqual(400);
    expect(thumbGeometry(400, 800, -50).top).toBe(0);
    const past = thumbGeometry(400, 800, 5000);
    expect(past.top + past.height).toBeLessThanOrEqual(400);
  });

  it('glisser la poignée fait défiler dans la même proportion', () => {
    // Zone de 400, contenu de 800, poignée de 200 : 100 px de poignée = 200 px de défilement.
    expect(scrollDeltaFor(100, 400, 800, 200)).toBeCloseTo(200, 5);
    expect(scrollDeltaFor(-50, 400, 800, 200)).toBeCloseTo(-100, 5);
    expect(scrollDeltaFor(10, 400, 800, 400)).toBe(0);
  });
});
