import { describe, expect, it } from 'vitest';
import {
  type GamesClientLike,
  type GamesQuery,
  GamesError,
  createGamesService,
  isPermanentCode,
  pageRange,
  statusesFor,
} from '../src/backend/games';
import { recordToRow } from '../src/game/record';
import type { GameRecord } from '../src/game/record';

const record: GameRecord = {
  id: '00000000-0000-4000-8000-000000000001',
  seed: 'graine',
  generatorVersion: 1,
  extensions: 'dn',
  status: 'lost',
  lasersCount: 2,
  probesCount: 1,
  startedAt: '2026-03-01T10:00:00.000Z',
  endedAt: '2026-03-01T10:05:00.000Z',
  durationS: 300,
  shots: ['1', 'A'],
  submission: [
    { gem: 'red-parallelogram', orientation: { rotation: 1, flipped: true }, col: 3, row: 2 },
  ],
};

type Result = {
  data: unknown;
  count?: number | null;
  error: { message: string; code?: string } | null;
};

/** Faux constructeur de requêtes : note les appels, répond avec `result`. */
function fakeClient(result: Result, throws = false) {
  const calls: unknown[][] = [];
  const query: GamesQuery = {
    in: (...args) => (calls.push(['in', ...args]), query),
    order: (...args) => (calls.push(['order', ...args]), query),
    range: (...args) => (calls.push(['range', ...args]), query),
    then: (onfulfilled, onrejected) =>
      (throws ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(result)).then(
        onfulfilled,
        onrejected,
      ),
  };
  const client: GamesClientLike = {
    from: (table) => {
      calls.push(['from', table]);
      return {
        upsert: (row, options) => {
          calls.push(['upsert', row, options]);
          return throws
            ? Promise.reject(new TypeError('Failed to fetch'))
            : Promise.resolve({ error: result.error });
        },
        select: (columns, options) => (calls.push(['select', columns, options]), query),
      };
    },
    rpc: (fn) => {
      calls.push(['rpc', fn]);
      return throws ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(result);
    },
  };
  return { client, calls };
}

describe('service des parties', () => {
  it('envoie la partie sans doublon possible (upsert qui ignore les doublons)', async () => {
    const { client, calls } = fakeClient({ data: null, error: null });
    await createGamesService(client).insert(record);
    expect(calls).toEqual([
      ['from', 'games'],
      ['upsert', recordToRow(record), { onConflict: 'id', ignoreDuplicates: true }],
    ]);
  });

  it("n'envoie jamais d'identifiant d'utilisateur : c'est la base qui le remplit", () => {
    expect(Object.keys(recordToRow(record))).not.toContain('user_id');
  });

  it('classe les erreurs : contrainte = définitive, le reste = à réessayer', async () => {
    const insert = (code?: string) =>
      createGamesService(fakeClient({ data: null, error: { message: 'x', code } }).client).insert(
        record,
      );
    await expect(insert('23514')).rejects.toMatchObject({ permanent: true });
    await expect(insert('22P02')).rejects.toMatchObject({ permanent: true });
    await expect(insert('42501')).rejects.toMatchObject({ permanent: false });
    await expect(insert('PGRST301')).rejects.toMatchObject({ permanent: false });
    await expect(insert(undefined)).rejects.toMatchObject({ permanent: false });
    await expect(insert()).rejects.toBeInstanceOf(GamesError);
  });

  it('une coupure réseau est une erreur à réessayer', async () => {
    const { client } = fakeClient({ data: null, error: null }, true);
    await expect(createGamesService(client).insert(record)).rejects.toMatchObject({
      permanent: false,
    });
    await expect(
      createGamesService(client).list({ filter: 'all', sort: 'recent', page: 0, pageSize: 20 }),
    ).rejects.toBeInstanceOf(GamesError);
  });

  it('demande la page triée et filtrée', async () => {
    const row = recordToRow(record);
    const { client, calls } = fakeClient({ data: [row], count: 41, error: null });
    const page = await createGamesService(client).list({
      filter: 'lost',
      sort: 'shots',
      page: 2,
      pageSize: 20,
    });
    expect(page).toEqual({ games: [record], total: 41 });
    expect(calls).toEqual([
      ['from', 'games'],
      ['select', '*', { count: 'exact' }],
      ['in', 'status', ['lost', 'abandoned']],
      ['order', 'shots_count', { ascending: true }],
      ['order', 'ended_at', { ascending: false }],
      ['order', 'id', { ascending: true }],
      ['range', 40, 59],
    ]);
  });

  it('trie par date, récentes puis anciennes, sans filtre pour « toutes »', async () => {
    for (const [sort, ascending] of [
      ['recent', false],
      ['oldest', true],
    ] as const) {
      const { client, calls } = fakeClient({ data: [], count: 0, error: null });
      await createGamesService(client).list({ filter: 'all', sort, page: 0, pageSize: 20 });
      expect(calls.some((call) => call[0] === 'in')).toBe(false);
      expect(calls).toContainEqual(['order', 'ended_at', { ascending }]);
    }
  });

  it('écarte les lignes illisibles sans échouer', async () => {
    const { client } = fakeClient({
      data: [recordToRow(record), { id: 'cassé' }, null],
      count: 3,
      error: null,
    });
    const page = await createGamesService(client).list({
      filter: 'all',
      sort: 'recent',
      page: 0,
      pageSize: 20,
    });
    expect(page.games).toEqual([record]);
    expect(page.total).toBe(3);
  });

  it('signale une erreur de la base', async () => {
    const { client } = fakeClient({
      data: null,
      error: { message: 'JWT expired', code: 'PGRST301' },
    });
    await expect(
      createGamesService(client).list({ filter: 'all', sort: 'recent', page: 0, pageSize: 20 }),
    ).rejects.toThrow('JWT expired');
  });

  it('calcule les bornes de page et les filtres', () => {
    expect(pageRange(0, 20)).toEqual([0, 19]);
    expect(pageRange(3, 10)).toEqual([30, 39]);
    expect(pageRange(-2, 20)).toEqual([0, 19]);
    expect(statusesFor('all')).toBeNull();
    expect(statusesFor('won')).toEqual(['won']);
    expect(statusesFor('lost')).toEqual(['lost', 'abandoned']);
    expect(isPermanentCode('23505')).toBe(true);
    expect(isPermanentCode('08006')).toBe(false);
    expect(isPermanentCode(undefined)).toBe(false);
  });

  describe('statistiques', () => {
    const row = {
      total_games: 6,
      wins: 3,
      losses: 1,
      abandoned: 2,
      win_rate: 0.5,
      avg_shots_to_win: 7.67,
    };

    it('appelle la fonction du profil et lit la ligne', async () => {
      const { client, calls } = fakeClient({ data: [row], error: null });
      expect(await createGamesService(client).stats()).toEqual({
        total: 6,
        wins: 3,
        losses: 1,
        abandoned: 2,
        winRate: 0.5,
        avgShotsToWin: 7.67,
      });
      expect(calls).toEqual([['rpc', 'profile_stats']]);
    });

    it('échoue proprement sur une erreur, une coupure ou une réponse illisible', async () => {
      const failing = fakeClient({ data: null, error: { message: 'JWT expired' } }).client;
      await expect(createGamesService(failing).stats()).rejects.toThrow('JWT expired');
      const offline = fakeClient({ data: null, error: null }, true).client;
      await expect(createGamesService(offline).stats()).rejects.toBeInstanceOf(GamesError);
      const odd = fakeClient({ data: [{ total_games: 'x' }], error: null }).client;
      await expect(createGamesService(odd).stats()).rejects.toThrow('illisibles');
    });
  });
});
