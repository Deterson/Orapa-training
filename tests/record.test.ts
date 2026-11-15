import { describe, expect, it } from 'vitest';
import { generateMine } from '../src/game/generate';
import { GameSession } from '../src/game/session';
import { emptyNotes } from '../src/game/notes';
import { SAVE_VERSION, type SaveData } from '../src/game/save';
import { emptySolution } from '../src/game/solution';
import {
  SNAPSHOT_LIMIT,
  type GameRecord,
  buildProgress,
  buildRecord,
  compactSave,
  parsePlayingSummary,
  parseProgressSnapshot,
  extensionsCode,
  extensionsFromCode,
  parseRow,
  recordToRow,
} from '../src/game/record';

const ID = '3f2b8c1e-9a4d-4e6b-8c1a-0123456789ab';
const mine = generateMine('enregistrement');

function finished(how: 'won' | 'lost' | 'abandoned'): {
  session: GameSession;
  guess: typeof mine.placements;
} {
  let clock = 1_000_000;
  const session = new GameSession(mine, { now: () => clock });
  session.fire('1');
  session.fire('15');
  session.probe('E4');
  clock += 125_400;
  if (how === 'abandoned') session.abandon();
  else session.submit(how === 'won' ? mine.placements : mine.placements.slice(1));
  return { session, guess: how === 'won' ? mine.placements : mine.placements.slice(1) };
}

describe("enregistrement d'une partie", () => {
  it('décrit une victoire', () => {
    const { session, guess } = finished('won');
    const record = buildRecord({
      id: ID,
      session,
      extensions: { diamond: false, blackBody: false },
      startedAt: Date.parse('2026-03-01T10:00:00Z'),
      endedAt: Date.parse('2026-03-01T10:02:05Z'),
      submission: guess,
    });
    expect(record).toMatchObject({
      id: ID,
      seed: 'enregistrement',
      generatorVersion: mine.generatorVersion,
      extensions: '',
      status: 'won',
      lasersCount: 2,
      probesCount: 1,
      startedAt: '2026-03-01T10:00:00.000Z',
      endedAt: '2026-03-01T10:02:05.000Z',
      durationS: 125,
      shots: ['1', '15'],
    });
    expect(record.submission).toHaveLength(mine.placements.length);
  });

  it("une partie perdue garde la proposition fausse, une abandonnée n'en a pas", () => {
    const lost = finished('lost');
    const lostRecord = buildRecord({
      id: ID,
      session: lost.session,
      extensions: { diamond: false, blackBody: false },
      startedAt: 0,
      endedAt: 1000,
      submission: lost.guess,
    });
    expect(lostRecord.status).toBe('lost');
    expect(lostRecord.submission).toHaveLength(mine.placements.length - 1);

    const gave = finished('abandoned');
    const gaveRecord = buildRecord({
      id: ID,
      session: gave.session,
      extensions: { diamond: false, blackBody: false },
      startedAt: 0,
      endedAt: 1000,
      submission: gave.guess,
    });
    expect(gaveRecord.status).toBe('abandoned');
    expect(gaveRecord.submission).toBeNull();
  });

  it('refuse une partie en cours', () => {
    const session = new GameSession(mine);
    expect(() =>
      buildRecord({
        id: ID,
        session,
        extensions: { diamond: false, blackBody: false },
        startedAt: 0,
        endedAt: 1,
        submission: [],
      }),
    ).toThrow();
  });

  it("ne met jamais la mine dans l'enregistrement d'une partie abandonnée ou perdue", () => {
    const { session } = finished('abandoned');
    const record = buildRecord({
      id: ID,
      session,
      extensions: { diamond: false, blackBody: false },
      startedAt: 0,
      endedAt: 1000,
      submission: [],
    });
    expect(JSON.stringify(record)).not.toContain('"placements"');
  });

  it("code les extensions comme l'adresse du site", () => {
    expect(extensionsCode({ diamond: false, blackBody: false })).toBe('');
    expect(extensionsCode({ diamond: true, blackBody: false })).toBe('d');
    expect(extensionsCode({ diamond: false, blackBody: true })).toBe('n');
    expect(extensionsCode({ diamond: true, blackBody: true })).toBe('dn');
    expect(extensionsFromCode('dn')).toEqual({ diamond: true, blackBody: true });
    expect(extensionsFromCode('')).toEqual({ diamond: false, blackBody: false });
  });
});

describe("lecture d'une ligne", () => {
  const won = (): GameRecord => {
    const { session, guess } = finished('won');
    return buildRecord({
      id: ID,
      session,
      extensions: { diamond: true, blackBody: false },
      startedAt: Date.parse('2026-03-01T10:00:00Z'),
      endedAt: Date.parse('2026-03-01T10:02:05Z'),
      submission: guess,
    });
  };

  it("relit ce qu'elle a écrit (aller-retour par JSON)", () => {
    const record = won();
    const row = JSON.parse(JSON.stringify(recordToRow(record))) as unknown;
    expect(parseRow(row)).toEqual(record);
  });

  it('accepte les dates telles que Postgres les renvoie', () => {
    const row = {
      ...recordToRow(won()),
      started_at: '2026-03-01T10:00:00+00:00',
      ended_at: '2026-03-01T10:02:05.123456+00:00',
    };
    expect(parseRow(row)?.startedAt).toBe('2026-03-01T10:00:00.000Z');
  });

  const bad: [string, (row: Record<string, unknown>) => void][] = [
    ['identifiant', (r) => (r['id'] = 'abc')],
    ['graine vide', (r) => (r['seed'] = '')],
    ['graine trop longue', (r) => (r['seed'] = 'x'.repeat(201))],
    ['version', (r) => (r['generator_version'] = 0)],
    ['extension', (r) => (r['extensions'] = 'x')],
    ['statut', (r) => (r['status'] = 'draw')],
    ['statut en cours', (r) => (r['status'] = 'playing')],
    ['lasers négatifs', (r) => (r['lasers_count'] = -1)],
    ['lasers > 36', (r) => (r['lasers_count'] = 37)],
    ['sondes > 80', (r) => (r['probes_count'] = 81)],
    ['durée négative', (r) => (r['duration_s'] = -1)],
    ['fin avant début', (r) => (r['ended_at'] = '2020-01-01T00:00:00Z')],
    ['date invalide', (r) => (r['started_at'] = 'hier')],
    ['lasers ≠ tirs', (r) => (r['lasers_count'] = 3)],
    ['repère inconnu', (r) => (r['shots'] = ['1', 'Z9'])],
    ['repère en double', (r) => (r['shots'] = ['1', '1'])],
    ['tirs hors tableau', (r) => (r['shots'] = 'ab')],
    ['victoire sans proposition', (r) => (r['submission'] = null)],
    ['proposition vide', (r) => (r['submission'] = [])],
    ['proposition hors tableau', (r) => (r['submission'] = { gem: 'x' })],
    [
      'gemme inconnue',
      (r) =>
        (r['submission'] = [
          { gem: 'inconnue', col: 0, row: 0, orientation: { rotation: 0, flipped: false } },
        ]),
    ],
    [
      'rotation',
      (r) =>
        (r['submission'] = [
          {
            gem: 'red-parallelogram',
            col: 0,
            row: 0,
            orientation: { rotation: 7, flipped: false },
          },
        ]),
    ],
  ];
  it.each(bad)('refuse : %s', (_name, mutate) => {
    const row = { ...recordToRow(won()) } as Record<string, unknown>;
    mutate(row);
    expect(parseRow(row)).toBeNull();
  });

  it('refuse une partie abandonnée avec proposition', () => {
    const row = { ...recordToRow(won()), status: 'abandoned' };
    expect(parseRow(row)).toBeNull();
  });

  it('accepte une partie abandonnée sans proposition', () => {
    const { session } = finished('abandoned');
    const record = buildRecord({
      id: ID,
      session,
      extensions: { diamond: false, blackBody: false },
      startedAt: 0,
      endedAt: 1,
      submission: [],
    });
    expect(parseRow(recordToRow(record))).toEqual(record);
  });

  it("refuse ce qui n'est pas un objet", () => {
    for (const value of [null, 1, 'x', [], undefined]) expect(parseRow(value)).toBeNull();
  });
});

describe('partie en cours (serveur)', () => {
  const session = new GameSession(generateMine('en-cours'), { now: () => 5_000 });
  session.fire('1');
  session.probe('E4');
  const base: SaveData = {
    version: SAVE_VERSION,
    savedAt: 1_700_000_000_000,
    session: session.toSnapshot(),
    solution: emptySolution(),
    notes: emptyNotes(),
    skipConfirm: true,
    owner: 'compte-a',
  };

  it('décrit la partie : tirs, sondes, temps, extensions', () => {
    const p = buildProgress({ id: ID, save: base, startedAt: 1_699_999_000_000 });
    expect(p).toMatchObject({
      id: ID,
      seed: 'en-cours',
      extensions: '',
      lasersCount: 1,
      probesCount: 1,
      shots: ['1'],
      startedAt: new Date(1_699_999_000_000).toISOString(),
    });
    expect(p.snapshot.gameId).toBe(ID);
    // Le snapshot garde la mine (réservé au propriétaire), mais pas le compte.
    expect(p.snapshot.session.mine.placements.length).toBeGreaterThan(4);
    expect('owner' in p.snapshot).toBe(false);
  });

  it('un snapshot trop gros perd ses traits au crayon, pas ses marques de cases', () => {
    const stroke = {
      ink: 'ink' as const,
      points: Array.from({ length: 5000 }, (_, i): [number, number] => [i, i]),
    };
    const heavy: SaveData = {
      ...base,
      notes: { marks: { A1: 'red' }, strokes: Array.from({ length: 10 }, () => stroke) },
    };
    expect(JSON.stringify(heavy).length).toBeGreaterThan(SNAPSHOT_LIMIT);
    const compact = compactSave(heavy);
    expect(compact.notes.strokes).toEqual([]);
    expect(compact.notes.marks).toEqual({ A1: 'red' });
    expect(JSON.stringify(compact).length).toBeLessThanOrEqual(SNAPSHOT_LIMIT);
    // Une sauvegarde normale n'est pas touchée.
    expect(compactSave(base).notes).toEqual(base.notes);
  });

  it('le snapshot compacté est une sauvegarde valide', () => {
    const p = buildProgress({ id: ID, save: base, startedAt: 1_699_999_000_000 });
    expect(parseProgressSnapshot(JSON.parse(JSON.stringify(p.snapshot)))).toEqual(p.snapshot);
    expect(parseProgressSnapshot({ ...p.snapshot, version: 99 })).toBeNull();
  });

  it("lit le résumé d'une partie en cours et refuse les lignes incohérentes", () => {
    const row = {
      id: ID,
      seed: 'a',
      extensions: 'n',
      lasers_count: 3,
      probes_count: 4,
      duration_s: 90,
      started_at: '2026-03-01T10:00:00Z',
      updated_at: '2026-03-01T10:01:30Z',
    };
    expect(parsePlayingSummary(row)).toMatchObject({ id: ID, lasersCount: 3, probesCount: 4 });
    for (const patch of [
      { id: 'x' },
      { seed: '' },
      { extensions: 'z' },
      { lasers_count: 37 },
      { probes_count: -1 },
      { duration_s: 1.5 },
      { updated_at: 'hier' },
    ]) {
      expect(parsePlayingSummary({ ...row, ...patch })).toBeNull();
    }
    expect(parsePlayingSummary(null)).toBeNull();
  });
});
