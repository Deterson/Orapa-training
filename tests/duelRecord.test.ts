import { describe, expect, it } from 'vitest';
import { Duel } from '../src/game/duel';
import { generateMine } from '../src/game/generate';
import { buildRecord, parseDuelStats, parseRow, parseStats, recordToRow } from '../src/game/record';
import { emptySolution, solutionFromPlacements } from '../src/game/solution';
import { createAiClient } from '../src/ui/aiClient';
import { duelOptionsModal, duelSetupPage, ownBoardHtml } from '../src/ui/duelPanel';
import { type HistoryModel, historyPage } from '../src/ui/history';
import { homePage } from '../src/ui/home';
import { profilePage } from '../src/ui/profile';
import { parseRoute, routeHash } from '../src/ui/router';

const ID = '00000000-0000-4000-8000-000000000042';

function finishedDuel(outcome: 'won' | 'lost' | 'draw') {
  const aiBoard = generateMine('enr-ia').placements;
  const mine = generateMine('enr-joueur').placements;
  const duel = Duel.start({
    seed: 'enr',
    level: 'intermediate',
    // Pour une égalité le joueur doit jouer en premier (c'est lui qui donne un dernier tour à l'IA).
    first: outcome === 'draw' ? 'player' : 'ai',
    aiBoard,
    playerBoard: mine,
  });
  if (outcome === 'draw') {
    duel.ask('player', { kind: 'probe', label: 'C3' });
    duel.ask('ai', { kind: 'fire', label: 'A' });
    duel.propose('player', aiBoard);
    duel.propose('ai', mine);
  } else {
    duel.ask('ai', { kind: 'fire', label: 'A' });
    duel.ask('player', { kind: 'probe', label: 'C3' });
    duel.ask('ai', { kind: 'fire', label: 'B' });
    // Gagné : proposition juste du second à jouer. Perdu : proposition fausse.
    duel.propose('player', outcome === 'won' ? aiBoard : []);
  }
  return { duel, aiBoard, mine };
}

describe('enregistrement des duels', () => {
  it('une victoire garde le niveau, le mode et la proposition', () => {
    const { duel, aiBoard } = finishedDuel('won');
    const record = buildRecord({
      id: ID,
      session: duel.playerSession,
      extensions: { diamond: false, blackBody: false },
      startedAt: 1_700_000_000_000,
      endedAt: 1_700_000_300_000,
      submission: [...aiBoard],
      duel: { level: duel.level, outcome: duel.status as 'won' },
    });
    expect(record.mode).toBe('duel');
    expect(record.level).toBe('intermediate');
    expect(record.status).toBe('won');
    expect(record.submission).toHaveLength(5);
    const row = recordToRow(record);
    expect(row.mode).toBe('duel');
    expect(row.level).toBe('intermediate');
    expect(parseRow(JSON.parse(JSON.stringify(row)))).toEqual(record);
  });

  it('un duel perdu sans proposition est enregistré sans proposition', () => {
    const { duel } = finishedDuel('lost');
    const record = buildRecord({
      id: ID,
      session: duel.playerSession,
      extensions: { diamond: false, blackBody: false },
      startedAt: 1_700_000_000_000,
      endedAt: 1_700_000_300_000,
      submission: [],
      duel: { level: duel.level, outcome: 'lost' },
    });
    expect(record.submission).toBeNull();
    expect(parseRow(recordToRow(record))).toEqual(record);
  });

  it("l'égalité n'existe que pour un duel", () => {
    const { duel, aiBoard } = finishedDuel('draw');
    const base = buildRecord({
      id: ID,
      session: duel.playerSession,
      extensions: { diamond: false, blackBody: false },
      startedAt: 1_700_000_000_000,
      endedAt: 1_700_000_300_000,
      submission: [...aiBoard],
      duel: { level: 'expert', outcome: 'draw' },
    });
    expect(parseRow(recordToRow(base))?.status).toBe('draw');
    // Même ligne présentée comme un entraînement : refusée.
    expect(parseRow({ ...recordToRow(base), mode: 'training', level: null })).toBeNull();
  });

  it('refuse un niveau absent ou inconnu, ou un niveau hors duel', () => {
    const { duel, aiBoard } = finishedDuel('won');
    const row = recordToRow(
      buildRecord({
        id: ID,
        session: duel.playerSession,
        extensions: { diamond: false, blackBody: false },
        startedAt: 1,
        endedAt: 2,
        submission: [...aiBoard],
        duel: { level: 'expert', outcome: 'won' },
      }),
    );
    expect(parseRow({ ...row, level: null })).toBeNull();
    expect(parseRow({ ...row, level: 'dieu' })).toBeNull();
    expect(parseRow({ ...row, mode: 'training' })).toBeNull();
    expect(parseRow({ ...row, mode: 'autre' })).toBeNull();
  });

  it('une ancienne ligne sans mode est un entraînement', () => {
    const { duel, aiBoard } = finishedDuel('won');
    const row: Record<string, unknown> = {
      ...recordToRow(
        buildRecord({
          id: ID,
          session: duel.playerSession,
          extensions: { diamond: false, blackBody: false },
          startedAt: 1,
          endedAt: 2,
          submission: [...aiBoard],
        }),
      ),
    };
    delete row['mode'];
    delete row['level'];
    expect(parseRow(row)?.mode).toBe('training');
    expect(parseRow(row)?.level).toBeNull();
  });
});

describe('statistiques de duel', () => {
  it('lit une ligne par niveau, dans l’ordre du débutant à l’expert', () => {
    const stats = parseDuelStats(
      [
        { level: 'expert', total_games: '3', wins: 1, draws: 1, losses: 1 },
        { level: 'beginner', total_games: 4, wins: 3, draws: 0, losses: 1 },
      ].map((row) => ({ ...row, total_games: Number(row.total_games) })),
    );
    expect(stats?.map((row) => row.level)).toEqual(['beginner', 'expert']);
    expect(stats?.[0]?.winRate).toBe(0.75);
  });

  it('refuse des chiffres incohérents', () => {
    expect(
      parseDuelStats([{ level: 'expert', total_games: 3, wins: 1, draws: 1, losses: 0 }]),
    ).toBeNull();
    expect(
      parseDuelStats([{ level: 'dieu', total_games: 1, wins: 1, draws: 0, losses: 0 }]),
    ).toBeNull();
    expect(parseDuelStats('rien')).toBeNull();
  });

  it('le profil montre les duels par niveau, même sans entraînement', () => {
    const base = parseStats({
      total_games: 0,
      wins: 0,
      losses: 0,
      abandoned: 0,
      win_rate: null,
      avg_shots_to_win: null,
    });
    expect(base).not.toBeNull();
    const duels = parseDuelStats([
      { level: 'expert', total_games: 2, wins: 1, draws: 0, losses: 1 },
    ]);
    const html = profilePage({
      user: { id: 'u', name: 'Test', avatarUrl: null },
      status: 'ready',
      stats: { ...(base as NonNullable<typeof base>), duels: duels ?? [] },
    });
    expect(html).toContain('Expert');
    expect(html).toContain('50 %');
    expect(html).not.toContain('Aucune partie jouée');
  });
});

describe('historique des duels', () => {
  const model = (games: HistoryModel['games']): HistoryModel => ({
    signedIn: true,
    filter: 'all',
    sort: 'recent',
    page: 0,
    pageSize: 20,
    status: 'ready',
    games,
    total: games.length,
  });

  it('un duel porte son niveau et ne se rejoue pas', () => {
    const { duel, aiBoard } = finishedDuel('won');
    const record = buildRecord({
      id: ID,
      session: duel.playerSession,
      extensions: { diamond: false, blackBody: false },
      startedAt: 1_700_000_000_000,
      endedAt: 1_700_000_300_000,
      submission: [...aiBoard],
      duel: { level: 'expert', outcome: 'won' },
    });
    const html = historyPage(model([record]));
    expect(html).toContain('Duel · Expert');
    expect(html).not.toContain('h-replay');
    // La graine du duel donne le plateau de l'IA : elle n'apparaît jamais.
    expect(html).not.toContain('enr');
  });

  it("l'égalité s'affiche", () => {
    const { duel, aiBoard } = finishedDuel('draw');
    const record = buildRecord({
      id: ID,
      session: duel.playerSession,
      extensions: { diamond: false, blackBody: false },
      startedAt: 1_700_000_000_000,
      endedAt: 1_700_000_300_000,
      submission: [...aiBoard],
      duel: { level: 'beginner', outcome: 'draw' },
    });
    expect(historyPage(model([record]))).toContain('Égalité');
  });
});

describe('pièces du duel', () => {
  it('la fenêtre propose les trois niveaux et les extensions', () => {
    const html = duelOptionsModal({
      level: 'expert',
      extensions: { diamond: true, blackBody: false },
    });
    for (const label of ['Débutant', 'Intermédiaire', 'Expert', 'Diamant', 'Corps noir']) {
      expect(html).toContain(label);
    }
    expect(html).toMatch(/value="expert" checked/);
    expect(html).toMatch(/id="duel-ext-diamond" checked/);
  });

  it('la page du plateau : « Valider » et le code ne sont disponibles que pour un plateau valide', () => {
    const empty = duelSetupPage({
      solution: emptySolution(),
      selected: null,
      issues: [],
      valid: false,
      notice: '',
    });
    expect(empty).toMatch(/data-action="validate-board" disabled/);
    expect(empty).toMatch(/data-action="copy-code" disabled/);
    const board = generateMine('page').placements;
    const full = duelSetupPage({
      solution: solutionFromPlacements(board),
      selected: null,
      issues: [],
      valid: true,
      notice: '',
    });
    expect(full).not.toMatch(/data-action="validate-board" disabled/);
    expect(full).toMatch(/id="board-code" readonly value="[A-Za-z0-9_-]{18}"/);
  });

  it('le plateau du joueur montre les questions de l’IA', () => {
    const board = generateMine('mien').placements;
    const html = ownBoardHtml({
      board,
      shots: [{ n: 1, entry: 'A', exit: '5', color: 'red' }],
      probes: [{ n: 1, cell: 'C3', content: 'nothing' }],
      fresh: { shot: null, probe: null },
    });
    expect(html).toContain('Votre plateau');
    expect(html).toContain('real-gem');
    expect(html).toContain('probe-nothing');
  });

  it('le plateau du joueur est petit et cliquable, en grand il n’a plus de bouton', () => {
    const model = {
      board: generateMine('taille').placements,
      shots: [],
      probes: [],
      fresh: { shot: null, probe: null },
    };
    const small = ownBoardHtml(model);
    expect(small).toContain('is-small');
    expect(small).toContain('data-action="own-expand"');
    const big = ownBoardHtml(model, true);
    expect(big).toContain('is-big');
    expect(big).not.toContain('<button');
    expect(big).not.toContain('own-expand');
  });

  it('l’accueil propose le duel, sans montrer la graine d’un duel en cours', () => {
    const html = homePage({
      current: { seed: 'secret-ia', extensions: 'Sans extension', shots: 3, duel: 'Expert' },
      newGameBlocked: false,
      accounts: false,
      signedIn: false,
      canImport: false,
      others: [],
      othersStatus: 'idle',
      limitReached: false,
    });
    expect(html).toContain('data-action="new-duel"');
    expect(html).toContain('Duel · Expert');
    expect(html).not.toContain('secret-ia');
  });

  it('le plateau du duel a son adresse', () => {
    expect(parseRoute('#/duel')).toBe('duel');
    expect(parseRoute(routeHash('duel'))).toBe('duel');
  });
});

describe('client de l’IA', () => {
  it('calcule dans la page quand il n’y a pas de Worker', async () => {
    const duel = Duel.start({
      seed: 'client',
      level: 'beginner',
      first: 'ai',
      playerBoard: generateMine('client-j').placements,
    });
    const client = createAiClient({
      level: 'beginner',
      seed: 'client',
      gems: duel.gems,
      worker: false,
    });
    const { move, delay } = await client.decide(duel.knowledge('ai'));
    expect(['fire', 'probe', 'propose']).toContain(move.kind);
    expect(delay).toBeGreaterThan(0);
    client.dispose();
    await expect(client.decide(duel.knowledge('ai'))).rejects.toThrow();
  });
});
