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
import { generateMine } from '../src/game/generate';
import { GameSession } from '../src/game/session';
import { SAVE_VERSION, type SaveData } from '../src/game/save';
import { emptySolution } from '../src/game/solution';
import { emptyNotes } from '../src/game/notes';
import { buildProgress, recordToRow } from '../src/game/record';
import type { GameRecord } from '../src/game/record';

const ID = '00000000-0000-4000-8000-000000000001';

const record: GameRecord = {
  id: ID,
  seed: 'graine',
  generatorVersion: 1,
  extensions: 'dn',
  status: 'lost',
  mode: 'training',
  level: null,
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
const ok = (data: unknown = null, count?: number): Result => ({ data, count, error: null });

/**
 * Faux client : chaque requête attendue (select, update ou upsert) consomme la réponse suivante de
 * `responses` ; tous les appels sont notés dans l'ordre.
 */
function fakeClient(responses: Result[], throws = false) {
  const calls: unknown[][] = [];
  const next = (): Promise<Result> =>
    throws
      ? Promise.reject(new TypeError('Failed to fetch'))
      : Promise.resolve(responses.shift() ?? ok());
  const query: GamesQuery = {
    in: (...args) => (calls.push(['in', ...args]), query),
    eq: (...args) => (calls.push(['eq', ...args]), query),
    order: (...args) => (calls.push(['order', ...args]), query),
    range: (...args) => (calls.push(['range', ...args]), query),
    limit: (...args) => (calls.push(['limit', ...args]), query),
    select: (...args) => (calls.push(['select', ...args]), query),
    then: (onfulfilled, onrejected) => next().then(onfulfilled, onrejected),
  };
  const client: GamesClientLike = {
    from: (table) => {
      calls.push(['from', table]);
      return {
        upsert: (row, options) => {
          calls.push(['upsert', row, options]);
          return next();
        },
        update: (values) => (calls.push(['update', values]), query),
        select: (columns, options) => (calls.push(['select', columns, options]), query),
      };
    },
    rpc: (fn) => {
      calls.push(['rpc', fn]);
      return next();
    },
  };
  return { client, calls };
}

/** Une partie en cours avec quelques tirs, comme l'interface la sauvegarde. */
function progress() {
  const session = new GameSession(generateMine('serveur'), { now: () => 1_000_000 });
  session.fire('1');
  session.fire('15');
  session.probe('E4');
  const save: SaveData = {
    version: SAVE_VERSION,
    savedAt: 1_700_000_000_000,
    session: session.toSnapshot(),
    solution: emptySolution(),
    notes: emptyNotes(),
    skipConfirm: false,
    owner: 'compte',
  };
  return { save, record: buildProgress({ id: ID, save, startedAt: 1_699_999_000_000 }) };
}

describe('fin de partie', () => {
  it('termine la partie en cours (mise à jour limitée aux parties en cours)', async () => {
    const { client, calls } = fakeClient([ok([{ id: ID }])]);
    await createGamesService(client).finish(record);
    const row = recordToRow(record);
    expect(calls).toEqual([
      ['from', 'games'],
      [
        'update',
        {
          status: 'lost',
          lasers_count: 2,
          probes_count: 1,
          ended_at: row.ended_at,
          duration_s: 300,
          shots: ['1', 'A'],
          submission: row.submission,
          snapshot: null,
        },
      ],
      ['eq', 'id', ID],
      ['eq', 'status', 'playing'],
      ['select', 'id'],
    ]);
  });

  it("si la partie n'existait pas côté serveur, la crée terminée (sans doublon possible)", async () => {
    const { client, calls } = fakeClient([ok([]), ok()]);
    await createGamesService(client).finish(record);
    expect(calls.at(-1)).toEqual([
      'upsert',
      { ...recordToRow(record), snapshot: null },
      { onConflict: 'id', ignoreDuplicates: true },
    ]);
  });

  it("n'envoie jamais d'identifiant d'utilisateur : c'est la base qui le remplit", () => {
    expect(Object.keys(recordToRow(record))).not.toContain('user_id');
  });

  it('classe les erreurs : contrainte = définitive, le reste = à réessayer', async () => {
    const finish = (code?: string) =>
      createGamesService(fakeClient([{ data: null, error: { message: 'x', code } }]).client).finish(
        record,
      );
    await expect(finish('23514')).rejects.toMatchObject({ permanent: true });
    await expect(finish('22P02')).rejects.toMatchObject({ permanent: true });
    await expect(finish('42501')).rejects.toMatchObject({ permanent: false });
    await expect(finish('PGRST301')).rejects.toMatchObject({ permanent: false });
    await expect(finish(undefined)).rejects.toMatchObject({ permanent: false });
    await expect(finish()).rejects.toBeInstanceOf(GamesError);
  });

  it('une coupure réseau est une erreur à réessayer', async () => {
    const { client } = fakeClient([], true);
    const games = createGamesService(client);
    await expect(games.finish(record)).rejects.toMatchObject({ permanent: false });
    await expect(games.listPlaying()).rejects.toBeInstanceOf(GamesError);
    await expect(
      games.list({ filter: 'all', sort: 'recent', page: 0, pageSize: 20 }),
    ).rejects.toBeInstanceOf(GamesError);
  });
});

describe('parties en cours', () => {
  it('met à jour la partie en cours avec les seules colonnes qui évoluent', async () => {
    const { record: p } = progress();
    const { client, calls } = fakeClient([ok([{ id: ID }])]);
    await createGamesService(client).saveProgress(p);
    expect(calls[1]).toEqual([
      'update',
      {
        lasers_count: 2,
        probes_count: 1,
        duration_s: p.durationS,
        shots: ['1', '15'],
        snapshot: p.snapshot,
      },
    ]);
    expect(calls.slice(2)).toEqual([
      ['eq', 'id', ID],
      ['eq', 'status', 'playing'],
      ['select', 'id'],
    ]);
  });

  it('crée la partie à la première synchronisation', async () => {
    const { record: p } = progress();
    const { client, calls } = fakeClient([ok([]), ok()]);
    await createGamesService(client).saveProgress(p);
    const [, row, options] = calls.at(-1) ?? [];
    expect(options).toEqual({ onConflict: 'id', ignoreDuplicates: true });
    expect(row).toMatchObject({
      id: ID,
      status: 'playing',
      ended_at: null,
      submission: null,
      seed: 'serveur',
      lasers_count: 2,
      probes_count: 1,
    });
    expect(Object.keys(row as object)).not.toContain('user_id');
  });

  it("n'envoie pas le compte auquel la sauvegarde est reliée", () => {
    const { record: p } = progress();
    expect(p.snapshot.owner).toBeUndefined();
    expect(p.snapshot.gameId).toBe(ID);
  });

  it('une erreur de contrainte (dixième partie dépassée…) est définitive', async () => {
    const { record: p } = progress();
    const { client } = fakeClient([
      ok([]),
      { data: null, error: { message: 'Trop de parties en cours', code: '23514' } },
    ]);
    await expect(createGamesService(client).saveProgress(p)).rejects.toMatchObject({
      permanent: true,
    });
  });

  it("liste les parties en cours, la plus récente d'abord, sans leur snapshot", async () => {
    const row = {
      id: ID,
      seed: 'a',
      extensions: 'd',
      lasers_count: 1,
      probes_count: 2,
      duration_s: 61,
      started_at: '2026-03-01T10:00:00+00:00',
      updated_at: '2026-03-01T10:05:00.5+00:00',
    };
    const { client, calls } = fakeClient([ok([row, { id: 'cassé' }, null])]);
    const games = await createGamesService(client).listPlaying();
    expect(games).toEqual([
      {
        id: ID,
        seed: 'a',
        extensions: 'd',
        lasersCount: 1,
        probesCount: 2,
        durationS: 61,
        startedAt: '2026-03-01T10:00:00.000Z',
        updatedAt: '2026-03-01T10:05:00.500Z',
      },
    ]);
    expect(calls).toContainEqual([
      'select',
      'id,seed,extensions,lasers_count,probes_count,duration_s,started_at,updated_at',
      undefined,
    ]);
    expect(calls).toContainEqual(['eq', 'status', 'playing']);
    expect(calls).toContainEqual(['order', 'updated_at', { ascending: false }]);
    expect(JSON.stringify(calls)).not.toContain('snapshot');
  });

  it("recharge le snapshot d'une partie en cours, validé comme une sauvegarde locale", async () => {
    const { record: p } = progress();
    const json = JSON.parse(JSON.stringify(p.snapshot)) as unknown;
    const { client } = fakeClient([
      ok([{ snapshot: json, updated_at: '2026-03-01T10:05:00+00:00' }]),
    ]);
    const loaded = await createGamesService(client).loadPlaying(ID);
    expect(loaded?.save.session.mine.seed).toBe('serveur');
    expect(loaded?.save.gameId).toBe(ID);
    expect(loaded?.updatedAt).toBe('2026-03-01T10:05:00+00:00');
  });

  it("renvoie null si la partie n'est plus en cours, refuse un snapshot modifié", async () => {
    const empty = fakeClient([ok([])]).client;
    expect(await createGamesService(empty).loadPlaying(ID)).toBeNull();
    const broken = fakeClient([ok([{ snapshot: { version: 1 }, updated_at: 'x' }])]).client;
    await expect(createGamesService(broken).loadPlaying(ID)).rejects.toThrow('illisible');
  });
});

describe('historique', () => {
  it('demande la page triée et filtrée', async () => {
    const row = recordToRow(record);
    const { client, calls } = fakeClient([ok([row], 41)]);
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

  it('« toutes » exclut les parties en cours', async () => {
    for (const [sort, ascending] of [
      ['recent', false],
      ['oldest', true],
    ] as const) {
      const { client, calls } = fakeClient([ok([], 0)]);
      await createGamesService(client).list({ filter: 'all', sort, page: 0, pageSize: 20 });
      expect(calls).toContainEqual(['in', 'status', ['won', 'lost', 'abandoned', 'draw']]);
      expect(calls).toContainEqual(['order', 'ended_at', { ascending }]);
    }
  });

  it('écarte les lignes illisibles sans échouer', async () => {
    const { client } = fakeClient([ok([recordToRow(record), { id: 'cassé' }, null], 3)]);
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
    const { client } = fakeClient([
      { data: null, error: { message: 'JWT expired', code: 'PGRST301' } },
    ]);
    await expect(
      createGamesService(client).list({ filter: 'all', sort: 'recent', page: 0, pageSize: 20 }),
    ).rejects.toThrow('JWT expired');
  });

  it('calcule les bornes de page et les filtres', () => {
    expect(pageRange(0, 20)).toEqual([0, 19]);
    expect(pageRange(3, 10)).toEqual([30, 39]);
    expect(pageRange(-2, 20)).toEqual([0, 19]);
    expect(statusesFor('all')).toEqual(['won', 'lost', 'abandoned', 'draw']);
    expect(statusesFor('won')).toEqual(['won']);
    expect(statusesFor('lost')).toEqual(['lost', 'abandoned']);
    expect(isPermanentCode('23505')).toBe(true);
    expect(isPermanentCode('08006')).toBe(false);
    expect(isPermanentCode(undefined)).toBe(false);
  });
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
    const { client, calls } = fakeClient([ok([row])]);
    expect(await createGamesService(client).stats()).toEqual({
      total: 6,
      wins: 3,
      losses: 1,
      abandoned: 2,
      winRate: 0.5,
      avgShotsToWin: 7.67,
    });
    // Les duels ont leur propre fonction ; ici elle ne répond rien : le profil n'en souffre pas.
    expect(calls).toEqual([
      ['rpc', 'profile_stats'],
      ['rpc', 'duel_stats'],
    ]);
  });

  it('ajoute les duels par niveau quand il y en a', async () => {
    const duels = [
      { level: 'beginner', total_games: 2, wins: 1, draws: 1, losses: 0 },
      { level: 'expert', total_games: 1, wins: 0, draws: 0, losses: 1 },
    ];
    const { client } = fakeClient([ok([row]), ok(duels)]);
    const stats = await createGamesService(client).stats();
    expect(stats.total).toBe(6);
    expect(stats.duels?.map((duel) => [duel.level, duel.wins, duel.draws, duel.losses])).toEqual([
      ['beginner', 1, 1, 0],
      ['expert', 0, 0, 1],
    ]);
  });

  it("un échec des duels ne prive pas le profil de ses chiffres d'entraînement", async () => {
    const { client } = fakeClient([ok([row]), { data: null, error: { message: 'absente' } }]);
    const stats = await createGamesService(client).stats();
    expect(stats.total).toBe(6);
    expect(stats.duels).toBeUndefined();
  });

  it('échoue proprement sur une erreur, une coupure ou une réponse illisible', async () => {
    const failing = fakeClient([{ data: null, error: { message: 'JWT expired' } }]).client;
    await expect(createGamesService(failing).stats()).rejects.toThrow('JWT expired');
    const offline = fakeClient([], true).client;
    await expect(createGamesService(offline).stats()).rejects.toBeInstanceOf(GamesError);
    const odd = fakeClient([ok([{ total_games: 'x' }])]).client;
    await expect(createGamesService(odd).stats()).rejects.toThrow('illisibles');
  });
});
