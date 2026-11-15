import { describe, expect, it } from 'vitest';
import type { GameRecord } from '../src/game/record';
import { type HistoryModel, historyPage, pageCount, replayHref } from '../src/ui/history';

const game = (over: Partial<GameRecord> = {}): GameRecord => ({
  id: '00000000-0000-4000-8000-000000000001',
  seed: 'graine',
  generatorVersion: 1,
  extensions: '',
  status: 'won',
  lasersCount: 7,
  probesCount: 0,
  startedAt: '2026-03-01T10:00:00.000Z',
  endedAt: '2026-03-01T10:05:00.000Z',
  durationS: 125,
  shots: [],
  submission: null,
  ...over,
});

const model = (over: Partial<HistoryModel> = {}): HistoryModel => ({
  signedIn: true,
  filter: 'all',
  sort: 'recent',
  page: 0,
  pageSize: 20,
  status: 'ready',
  games: [game()],
  total: 1,
  ...over,
});

describe("page d'historique", () => {
  it('affiche résultat, lasers, durée et lien pour rejouer', () => {
    const html = historyPage(model(), '1.4.0');
    expect(html).toContain('Gagné');
    expect(html).toContain('7 lasers');
    expect(html).toContain('02:05');
    expect(html).toContain('href="./?seed=graine"');
  });

  it("échappe la graine, qui vient de la base (et d'un lien partagé)", () => {
    const seed = '"><img src=x onerror=alert(1)>';
    const html = historyPage(model({ games: [game({ seed })] }), '1.4.0');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('rejoue avec les mêmes extensions', () => {
    expect(replayHref({ seed: 'a b', extensions: 'dn' })).toBe('./?seed=a+b&ext=dn');
    expect(replayHref({ seed: 'x', extensions: 'd' })).toBe('./?seed=x&ext=d');
    expect(replayHref({ seed: 'x', extensions: '' })).toBe('./?seed=x');
  });

  it('demande la connexion sans compte', () => {
    const html = historyPage(model({ signedIn: false }), '1.4.0');
    expect(html).toContain('data-action="sign-in"');
    expect(html).not.toContain('h-list');
  });

  it('gère liste vide, chargement et erreur', () => {
    expect(historyPage(model({ games: [], total: 0 }), 'v')).toContain('Aucune partie');
    expect(historyPage(model({ games: [], total: 0, status: 'loading' }), 'v')).toContain(
      'Chargement',
    );
    const failed = historyPage(model({ games: [], status: 'error' }), 'v');
    expect(failed).toContain('Chargement impossible');
    expect(failed).toContain('data-hpage="retry"');
  });

  it('marque le filtre actif et le tri choisi', () => {
    const html = historyPage(model({ filter: 'won', sort: 'lasers' }), 'v');
    expect(html).toMatch(/aria-pressed="true" data-hfilter="won"/);
    expect(html).toMatch(/<option value="lasers" selected>/);
  });

  it('pagine seulement quand il y a plusieurs pages', () => {
    expect(historyPage(model(), 'v')).not.toContain('data-hpage="next"');
    const first = historyPage(model({ total: 45 }), 'v');
    expect(first).toContain('1 / 3');
    expect(first).toMatch(/data-hpage="prev" disabled/);
    const last = historyPage(model({ total: 45, page: 2 }), 'v');
    expect(last).toMatch(/data-hpage="next" disabled/);
    expect(pageCount(0, 20)).toBe(1);
    expect(pageCount(40, 20)).toBe(2);
    expect(pageCount(41, 20)).toBe(3);
  });
});
