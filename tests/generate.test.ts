import { describe, expect, it } from 'vitest';
import { BASE_GEM_IDS } from '../src/game/gems';
import {
  GENERATOR_VERSION,
  generateMine,
  generateMineWithReport,
  randomLayout,
} from '../src/game/generate';
import { validatePlacements } from '../src/game/placement';
import { createRng, hashSeed, randomSeed } from '../src/game/rng';
import { isUnique } from '../src/game/solve';
import { isVisible } from '../src/game/visibility';

describe('générateur pseudo-aléatoire', () => {
  it('redonne la même suite pour la même graine', () => {
    const a = createRng('abc');
    const b = createRng('abc');
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(
      Array.from({ length: 5 }, () => b.next()),
    );
  });

  it('donne des suites différentes pour des graines différentes', () => {
    expect(createRng('abc').next()).not.toBe(createRng('abd').next());
    expect(hashSeed('abc')).not.toBe(hashSeed('abd'));
  });

  it('reste dans [0, 1) et sur des entiers bornés', () => {
    const rng = createRng(42);
    for (let i = 0; i < 1000; i++) {
      const x = rng.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      expect(rng.int(7)).toBeLessThan(7);
    }
  });

  it('fabrique des graines lisibles', () => {
    expect(randomSeed()).toMatch(/^[a-z2-9]{6}$/);
  });
});

describe("tirage d'une disposition", () => {
  it('place les 5 gemmes de la partie de base sans enfreindre les règles a à d', () => {
    const rng = createRng('layout');
    for (let i = 0; i < 50; i++) {
      const layout = randomLayout(rng);
      if (layout === null) continue;
      expect(layout.map((p) => p.gem)).toEqual([...BASE_GEM_IDS]);
      expect(validatePlacements(layout)).toEqual([]);
    }
  });
});

describe("génération d'une mine", () => {
  it('est déterministe : même graine, même mine', () => {
    expect(generateMine('orapa')).toEqual(generateMine('orapa'));
  });

  it('change avec la graine', () => {
    const seeds = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6'];
    const mines = seeds.map((seed) => JSON.stringify(generateMine(seed).placements));
    expect(new Set(mines).size).toBeGreaterThan(1);
  });

  it('note la graine et la version du générateur', () => {
    const mine = generateMine('versionne');
    expect(mine.seed).toBe('versionne');
    expect(mine.generatorVersion).toBe(GENERATOR_VERSION);
  });

  it('produit des mines valides, visibles et uniques sur 100 graines', () => {
    let attempts = 0;
    for (let i = 0; i < 100; i++) {
      const report = generateMineWithReport(`graine-${i}`);
      attempts += report.attempts;
      const { placements } = report.mine;
      expect(placements.map((p) => p.gem)).toEqual([...BASE_GEM_IDS]);
      expect(validatePlacements(placements), `graine-${i}`).toEqual([]);
      expect(isVisible(placements), `graine-${i}`).toBe(true);
      expect(isUnique(placements), `graine-${i}`).toBe(true);
    }
    // Le rejet est rare : en moyenne moins de 3 tirages par mine.
    expect(attempts / 100).toBeLessThan(3);
  }, 180_000);
});
