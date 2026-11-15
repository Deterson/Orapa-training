import { describe, expect, it } from 'vitest';
import { type ProfileStats, parseStats } from '../src/game/record';
import { type ProfileModel, formatAvgShots, formatWinRate, profilePage } from '../src/ui/profile';

const stats = (over: Partial<ProfileStats> = {}): ProfileStats => ({
  total: 6,
  wins: 3,
  losses: 1,
  abandoned: 2,
  winRate: 0.5,
  avgShotsToWin: 7.67,
  ...over,
});

const model = (over: Partial<ProfileModel> = {}): ProfileModel => ({
  user: { id: 'u', name: 'Ada', avatarUrl: null },
  status: 'ready',
  stats: stats(),
  ...over,
});

describe('lecture des statistiques', () => {
  const row = {
    total_games: 6,
    wins: 3,
    losses: 1,
    abandoned: 2,
    win_rate: '0.5000',
    avg_shots_to_win: '7.67',
  };

  it('lit la ligne de la base (décimaux en texte ou en nombre, ligne seule ou tableau)', () => {
    expect(parseStats(row)).toEqual(stats());
    expect(parseStats([{ ...row, win_rate: 0.5, avg_shots_to_win: 7.67 }])).toEqual(stats());
  });

  it('sans partie : taux et moyenne null', () => {
    const empty = {
      total_games: 0,
      wins: 0,
      losses: 0,
      abandoned: 0,
      win_rate: null,
      avg_shots_to_win: null,
    };
    expect(parseStats(empty)).toEqual({
      total: 0,
      wins: 0,
      losses: 0,
      abandoned: 0,
      winRate: null,
      avgShotsToWin: null,
    });
  });

  it('sans victoire : taux 0 mais moyenne null, jamais 0', () => {
    const lost = {
      total_games: 3,
      wins: 0,
      losses: 1,
      abandoned: 2,
      win_rate: 0,
      avg_shots_to_win: null,
    };
    expect(parseStats(lost)).toMatchObject({ winRate: 0, avgShotsToWin: null });
  });

  it('refuse les lignes incohérentes', () => {
    const bad: Record<string, unknown>[] = [
      { ...row, total_games: 7 },
      { ...row, wins: -1 },
      { ...row, wins: 1.5 },
      { ...row, win_rate: 1.2 },
      { ...row, win_rate: 'abc' },
      { ...row, avg_shots_to_win: 117 },
      { ...row, avg_shots_to_win: null },
      { ...row, win_rate: null },
      { total_games: 0, wins: 0, losses: 0, abandoned: 0, win_rate: 0, avg_shots_to_win: null },
    ];
    for (const value of bad) expect(parseStats(value)).toBeNull();
    for (const value of [null, undefined, 3, 'x', []]) expect(parseStats(value)).toBeNull();
  });
});

describe('affichage des statistiques', () => {
  it('formate au plus une décimale, à la française', () => {
    expect(formatWinRate(stats({ winRate: 0.5 }))).toMatch(/^50\s%$/);
    expect(formatWinRate(stats({ winRate: 2 / 3 }))).toMatch(/^66,7\s%$/);
    expect(formatWinRate(stats({ winRate: 1 }))).toMatch(/^100\s%$/);
    expect(formatWinRate(stats({ winRate: 0 }))).toMatch(/^0\s%$/);
    expect(formatAvgShots(stats({ avgShotsToWin: 7.67 }))).toBe('7,7');
    expect(formatAvgShots(stats({ avgShotsToWin: 12 }))).toBe('12');
    expect(formatAvgShots(stats({ avgShotsToWin: 0 }))).toBe('0');
  });

  it('« — » sans victoire ou sans partie, jamais 0', () => {
    expect(formatAvgShots(stats({ wins: 0, avgShotsToWin: null }))).toBe('—');
    expect(formatWinRate(stats({ total: 0, winRate: null }))).toBe('—');
  });

  it('montre les quatre chiffres', () => {
    const html = profilePage(model());
    expect(html).toContain('Parties');
    expect(html).toMatch(/Victoires<\/dt><dd>3</);
    expect(html).toMatch(/Victoires \(%\)<\/dt><dd>50\s%</);
    expect(html).toContain('7,7');
  });

  it('« Aucune partie jouée » sans partie, « — » pour la moyenne sans victoire', () => {
    const none = profilePage(
      model({
        stats: stats({
          total: 0,
          wins: 0,
          losses: 0,
          abandoned: 0,
          winRate: null,
          avgShotsToWin: null,
        }),
      }),
    );
    expect(none).toContain('Aucune partie jouée');
    expect(none).not.toContain('p-stats');
    const noWin = profilePage(
      model({
        stats: stats({ wins: 0, losses: 3, abandoned: 3, winRate: 0, avgShotsToWin: null }),
      }),
    );
    expect(noWin).toMatch(/Tirs par victoire<\/dt><dd aria-label="Pas encore de victoire">—</);
  });

  it('gère chargement, erreur et absence de compte', () => {
    expect(profilePage(model({ status: 'loading', stats: null }))).toContain('Chargement');
    const failed = profilePage(model({ status: 'error', stats: null }));
    expect(failed).toContain('data-action="retry-profile"');
    expect(profilePage(model({ user: null }))).toContain('data-action="sign-in"');
  });

  it('échappe le nom du compte', () => {
    const html = profilePage(
      model({ user: { id: 'u', name: '<script>x</script>', avatarUrl: null } }),
    );
    expect(html).not.toContain('<script>');
  });
});
