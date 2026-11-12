/**
 * Générateur pseudo-aléatoire à graine : une même graine redonne toujours la même suite.
 * Ne jamais utiliser Math.random() dans src/game/ : les mines doivent être rejouables.
 */

export interface Rng {
  /** Nombre dans [0, 1). */
  next(): number;
  /** Entier dans [0, max). */
  int(max: number): number;
  /** Élément au hasard d'une liste non vide. */
  pick<T>(items: readonly T[]): T;
}

/** Empreinte 32 bits d'un texte (FNV-1a), pour transformer une graine texte en nombre. */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 : petit générateur 32 bits, rapide et de bonne qualité statistique. */
export function createRng(seed: string | number): Rng {
  let state = (typeof seed === 'number' ? seed : hashSeed(seed)) >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (max) => Math.floor(next() * max),
    pick: <T>(items: readonly T[]): T => {
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) throw new Error('Liste vide');
      return item;
    },
  };
}

const SEED_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** Graine courte et lisible, pour une nouvelle partie. Seul endroit qui utilise Math.random(). */
export function randomSeed(length = 6): string {
  let seed = '';
  for (let i = 0; i < length; i++) {
    seed += SEED_ALPHABET.charAt(Math.floor(Math.random() * SEED_ALPHABET.length));
  }
  return seed;
}
