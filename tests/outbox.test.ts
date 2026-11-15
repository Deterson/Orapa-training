import { describe, expect, it } from 'vitest';
import { GamesError, type GamesService } from '../src/backend/games';
import { OUTBOX_KEY, OUTBOX_LIMIT, createOutbox } from '../src/backend/outbox';
import type { GameRecord } from '../src/game/record';

const record = (n: number): GameRecord => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  seed: `graine-${n}`,
  generatorVersion: 1,
  extensions: '',
  status: 'won',
  lasersCount: 1,
  probesCount: 0,
  startedAt: '2026-03-01T10:00:00.000Z',
  endedAt: '2026-03-01T10:05:00.000Z',
  durationS: 300,
  shots: ['1'],
  submission: [
    { gem: 'red-parallelogram', orientation: { rotation: 0, flipped: false }, col: 1, row: 1 },
  ],
});

/** localStorage factice. */
function memoryStorage(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(OUTBOX_KEY, initial);
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

/** Service factice : `failWith` décide du sort de chaque envoi. */
function fakeGames(failWith: (r: GameRecord) => Error | null = () => null) {
  const sent: string[] = [];
  const service: GamesService = {
    insert: (r) => {
      const error = failWith(r);
      if (error) return Promise.reject(error);
      sent.push(r.id);
      return Promise.resolve();
    },
    list: () => Promise.resolve({ games: [], total: 0 }),
    stats: () => Promise.reject(new Error('inutilisé')),
  };
  return { sent, service };
}

describe("file d'envoi", () => {
  it("envoie les parties dans l'ordre et vide la file", async () => {
    const box = createOutbox(memoryStorage());
    box.add('A', record(1));
    box.add('A', record(2));
    const { sent, service } = fakeGames();
    expect(await box.flush('A', service)).toEqual({ sent: 2, remaining: 0, retry: false });
    expect(sent).toEqual([record(1).id, record(2).id]);
    expect(box.pending('A')).toEqual([]);
  });

  it('ne met pas deux fois la même partie', () => {
    const box = createOutbox(memoryStorage());
    box.add('A', record(1));
    box.add('A', record(1));
    expect(box.pending('A')).toHaveLength(1);
  });

  it('garde la partie en cas de coupure et la renvoie ensuite', async () => {
    const store = memoryStorage();
    const box = createOutbox(store);
    box.add('A', record(1));
    const down = fakeGames(() => new GamesError('Failed to fetch', false));
    expect(await box.flush('A', down.service)).toEqual({ sent: 0, remaining: 1, retry: true });
    // Même après un rechargement de la page (nouvelle file sur le même stockage).
    const reloaded = createOutbox(store);
    expect(reloaded.pending('A')).toEqual([record(1)]);
    const up = fakeGames();
    expect(await reloaded.flush('A', up.service)).toEqual({ sent: 1, remaining: 0, retry: false });
    expect(store.data.has(OUTBOX_KEY)).toBe(false);
  });

  it("s'arrête à la première coupure et garde la suite", async () => {
    const box = createOutbox(memoryStorage());
    box.add('A', record(1));
    box.add('A', record(2));
    const { sent, service } = fakeGames((r) =>
      r.id === record(1).id ? new GamesError('réseau', false) : null,
    );
    const result = await box.flush('A', service);
    expect(result).toEqual({ sent: 0, remaining: 2, retry: true });
    expect(sent).toEqual([]);
  });

  it('retire une partie que la base refuse définitivement, sans bloquer les autres', async () => {
    const box = createOutbox(memoryStorage());
    box.add('A', record(1));
    box.add('A', record(2));
    const { sent, service } = fakeGames((r) =>
      r.id === record(1).id ? new GamesError('contrainte', true) : null,
    );
    expect(await box.flush('A', service)).toEqual({ sent: 1, remaining: 0, retry: false });
    expect(sent).toEqual([record(2).id]);
  });

  it("n'envoie jamais la partie d'un utilisateur sous le compte d'un autre", async () => {
    const box = createOutbox(memoryStorage());
    box.add('A', record(1));
    box.add('B', record(2));
    const { sent, service } = fakeGames();
    await box.flush('B', service);
    expect(sent).toEqual([record(2).id]);
    expect(box.pending('A')).toEqual([record(1)]);
    expect(box.has('A', record(1).id)).toBe(true);
    expect(box.has('B', record(1).id)).toBe(false);
  });

  it('ne lance pas deux envois en même temps pour le même utilisateur', async () => {
    const box = createOutbox(memoryStorage());
    box.add('A', record(1));
    let calls = 0;
    const service: GamesService = {
      insert: async () => {
        calls++;
        await Promise.resolve();
      },
      list: () => Promise.resolve({ games: [], total: 0 }),
      stats: () => Promise.reject(new Error('inutilisé')),
    };
    const [first, second] = await Promise.all([box.flush('A', service), box.flush('A', service)]);
    expect(calls).toBe(1);
    expect(first).toBe(second);
  });

  it('limite la taille de la file', () => {
    const box = createOutbox(memoryStorage());
    for (let n = 1; n <= OUTBOX_LIMIT + 5; n++) box.add('A', record(n));
    const pending = box.pending('A');
    expect(pending).toHaveLength(OUTBOX_LIMIT);
    expect(pending[0]).toEqual(record(6));
  });

  it('ignore un contenu corrompu ou modifié à la main', () => {
    for (const text of [
      'pas du json',
      '{"a":1}',
      '[1,"x",null]',
      JSON.stringify([{ userId: 'A', record: { id: 'x' } }]),
    ]) {
      expect(createOutbox(memoryStorage(text)).pending('A')).toEqual([]);
    }
  });

  it("fonctionne sans stockage (en mémoire) et si le stockage refuse d'écrire", async () => {
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => undefined,
    };
    for (const backend of [null, full]) {
      const box = createOutbox(backend);
      box.add('A', record(1));
      expect(box.pending('A')).toHaveLength(1);
      const { service } = fakeGames();
      expect((await box.flush('A', service)).sent).toBe(1);
    }
  });
});
