import { describe, expect, it } from 'vitest';
import type { AccountUser } from '../src/backend/auth';
import { headerHtml } from '../src/ui/header';
import { type HomeModel, homePage } from '../src/ui/home';
import { type View, parseRoute, routeHash } from '../src/ui/router';

describe('routeur', () => {
  it("l'accueil par défaut", () => {
    for (const hash of ['', '#', '#/', '#/inconnue', '#autre'])
      expect(parseRoute(hash)).toBe('home');
  });

  it('comprend les adresses des pages', () => {
    expect(parseRoute('#/partie')).toBe('game');
    expect(parseRoute('#/regles')).toBe('rules');
    expect(parseRoute('#/historique')).toBe('history');
    expect(parseRoute('#/profil')).toBe('profile');
    expect(parseRoute('#/confidentialite')).toBe('privacy');
    expect(parseRoute('#/partie/')).toBe('game');
  });

  it('comprend encore les anciennes adresses', () => {
    expect(parseRoute('#regles')).toBe('rules');
    expect(parseRoute('#historique')).toBe('history');
    expect(parseRoute('#profil')).toBe('profile');
    expect(parseRoute('#confidentialite')).toBe('privacy');
    expect(parseRoute('#jeu')).toBe('game');
  });

  it("l'adresse d'une page redonne la même page", () => {
    for (const view of ['home', 'game', 'rules', 'history', 'profile', 'privacy'] as View[]) {
      expect(parseRoute(routeHash(view))).toBe(view);
    }
  });
});

const user = (over: Partial<AccountUser> = {}): AccountUser => ({
  id: 'u',
  name: 'Ada Lovelace',
  avatarUrl: 'https://lh3.googleusercontent.com/a',
  ...over,
});

const header = (over: Partial<Parameters<typeof headerHtml>[0]> = {}) =>
  headerHtml({
    version: '2.0.0',
    view: 'home',
    newGameBlocked: false,
    accountReady: true,
    user: null,
    ...over,
  });

describe('barre du haut', () => {
  it("à gauche : titre vers l'accueil, version, Nouvelle partie, Règles", () => {
    const html = header();
    const left = html.slice(html.indexOf('tb-left'), html.indexOf('tb-right'));
    expect(left).toContain('href="#/"');
    expect(left).toContain('Orapa Training');
    expect(left).toContain('v2.0.0');
    expect(left).toContain('data-action="new-game"');
    expect(left).toContain('href="#/regles"');
    // la version suit immédiatement le titre
    expect(left.indexOf('v2.0.0')).toBeGreaterThan(left.indexOf('Orapa Training'));
    expect(left.indexOf('v2.0.0')).toBeLessThan(left.indexOf('data-action="new-game"'));
  });

  it('déconnecté : seulement « Connexion » à droite', () => {
    const right = header().split('tb-right')[1] ?? '';
    expect(right).toContain('data-action="sign-in"');
    expect(right).toContain('Connexion');
    expect(right).not.toContain('Historique');
    expect(right).not.toContain('Profil');
  });

  it("connecté : Historique, Profil avec l'avatar sans le nom, Déconnexion", () => {
    const html = header({ user: user() });
    const right = html.split('tb-right')[1] ?? '';
    expect(right).toContain('href="#/historique"');
    expect(right).toContain('href="#/profil"');
    expect(right).toContain('lh3.googleusercontent.com');
    expect(right).toContain('data-action="sign-out"');
    expect(right).not.toContain('Ada');
    expect(right).not.toContain('Lovelace');
    expect(right.indexOf('Historique')).toBeLessThan(right.indexOf('Profil'));
    expect(right.indexOf('Profil')).toBeLessThan(right.indexOf('Déconnexion'));
  });

  it('sans avatar : une icône de personne, toujours sans le nom', () => {
    const html = header({ user: user({ avatarUrl: null }) });
    expect(html).toContain('avatar-icon');
    expect(html).not.toContain('Ada');
  });

  it("échappe l'adresse de l'avatar", () => {
    const html = header({ user: user({ avatarUrl: 'https://x.test/a.png"onerror="x' }) });
    expect(html).not.toContain('"onerror="');
  });

  it("aucun bouton de compte tant que la session n'est pas lue (ou sans backend)", () => {
    const right = header({ accountReady: false }).split('tb-right')[1] ?? '';
    expect(right).not.toContain('data-action');
  });

  it('« Nouvelle partie » est désactivée quand elle est bloquée', () => {
    expect(header({ newGameBlocked: true })).toMatch(/data-action="new-game" disabled/);
    expect(header({ newGameBlocked: false })).not.toMatch(/data-action="new-game" disabled/);
  });

  it('signale la page courante', () => {
    expect(header({ view: 'rules' })).toMatch(/href="#\/regles" aria-current="page"/);
  });
});

describe('accueil', () => {
  const current = { seed: 'abc<b>', extensions: 'Diamant', shots: 3, elapsedMs: 125_000 };
  const home = (over: Partial<HomeModel> = {}): HomeModel => ({
    current,
    confirmAbandon: false,
    newGameBlocked: false,
    accounts: false,
    signedIn: false,
    canImport: false,
    others: [],
    othersStatus: 'idle',
    confirmRemote: null,
    limitReached: false,
    ...over,
  });

  it('montre la partie en cours avec Reprendre et Abandonner', () => {
    const html = homePage(home({ confirmAbandon: false, newGameBlocked: true, accounts: false }));
    expect(html).toContain('3 tirs');
    expect(html).toContain('02:05');
    expect(html).toContain('Diamant');
    expect(html).toContain('data-action="resume-game"');
    expect(html).toContain('data-action="ask-abandon"');
    expect(html).not.toContain('<b>');
  });

  it("demande confirmation avant d'abandonner", () => {
    const html = homePage(home({ confirmAbandon: true, newGameBlocked: true, accounts: false }));
    expect(html).toContain('data-action="confirm-abandon"');
    expect(html).toContain('data-action="cancel-confirm"');
    expect(html).not.toContain('data-action="resume-game"');
  });

  it('bloque « Nouvelle partie » avec une partie en cours, et explique comment faire', () => {
    const offline = homePage(
      home({ confirmAbandon: false, newGameBlocked: true, accounts: false }),
    );
    expect(offline).toMatch(/data-action="new-game" disabled|disabled>Nouvelle/);
    expect(offline).toContain('Reprendre ou abandonner');
    const withAccounts = homePage(
      home({ confirmAbandon: false, newGameBlocked: true, accounts: true }),
    );
    expect(withAccounts).toContain('se connecter');
  });

  it('sans partie : seulement « Nouvelle partie », disponible', () => {
    const html = homePage(home({ current: null, accounts: true }));
    expect(html).not.toContain('home-card');
    expect(html).not.toMatch(/new-game"[^>]*disabled/);
  });

  describe('avec un compte', () => {
    const remote = (over: Partial<HomeModel['others'][number]> = {}) => ({
      id: '00000000-0000-4000-8000-000000000001',
      seed: 'serveur<i>',
      extensions: 'Corps noir',
      shots: 5,
      elapsedMs: 61_000,
      updatedAt: '2026-03-01T10:05:00.000Z',
      ...over,
    });
    const signedIn = (over: Partial<HomeModel> = {}) =>
      home({ accounts: true, signedIn: true, othersStatus: 'ready', ...over });

    it('liste les parties en cours du compte avec Reprendre et Abandonner', () => {
      const html = homePage(signedIn({ others: [remote()] }));
      expect(html).toContain('Parties en cours');
      expect(html).toContain('5 tirs');
      expect(html).toContain('Corps noir');
      expect(html).toContain(
        'data-action="resume-remote" data-id="00000000-0000-4000-8000-000000000001"',
      );
      expect(html).toContain('data-action="ask-abandon-remote"');
      expect(html).not.toContain('<i>');
    });

    it("demande confirmation avant d'abandonner une partie du compte", () => {
      const id = remote().id;
      const html = homePage(signedIn({ others: [remote()], confirmRemote: id }));
      expect(html).toContain('data-action="confirm-abandon-remote"');
      expect(html).not.toContain('data-action="resume-remote"');
    });

    it('ne liste rien pour un visiteur sans compte', () => {
      expect(homePage(home({ others: [remote()] }))).not.toContain('home-others');
    });

    it("propose d'importer la partie locale", () => {
      expect(homePage(signedIn({ canImport: true }))).toContain('data-action="import-game"');
      expect(homePage(signedIn({ canImport: false }))).not.toContain('import-game');
    });

    it('gère chargement, erreur avec « Réessayer » et liste vide', () => {
      expect(homePage(signedIn({ othersStatus: 'loading' }))).toContain('Chargement');
      const failed = homePage(signedIn({ othersStatus: 'error' }));
      expect(failed).toContain('data-action="retry-playing"');
      expect(homePage(signedIn({ others: [] }))).not.toContain('home-others');
    });

    it('dix parties en cours : plus de nouvelle partie, avec la raison', () => {
      const html = homePage(signedIn({ limitReached: true, newGameBlocked: true, current: null }));
      expect(html).toContain('10 parties en cours au maximum');
      expect(html).toMatch(/new-game"[^>]*disabled/);
    });
  });
});
