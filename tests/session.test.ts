import { describe, expect, it } from 'vitest';
import { ENTRY_POINTS } from '../src/game/board';
import { generateMine } from '../src/game/generate';
import { shoot } from '../src/game/laser';
import { GameSession, MAX_ATTEMPTS } from '../src/game/session';
import { BASE_GEM_IDS } from '../src/game/gems';

const mine = generateMine('session');

describe('partie en cours : tirs', () => {
  it('annonce le point de sortie et la couleur du simulateur', () => {
    const session = new GameSession(mine);
    const record = session.fire('15');
    const expected = shoot(mine.placements, '15');
    expect(record).toEqual({ n: 1, entry: '15', exit: expected.exit, color: expected.color });
  });

  it('numère les tirs et compte les lasers', () => {
    const session = new GameSession(mine);
    expect(session.laserCount).toBe(0);
    session.fire('1');
    session.fire('I');
    session.fire('A');
    expect(session.shots.map((s) => s.n)).toEqual([1, 2, 3]);
    expect(session.laserCount).toBe(3);
  });

  it('ne compte pas deux fois le même repère', () => {
    const session = new GameSession(mine);
    const first = session.fire('1');
    const again = session.fire('1');
    expect(again).toEqual(first);
    expect(session.laserCount).toBe(1);
  });

  it('accepte les minuscules et refuse un repère inconnu', () => {
    const session = new GameSession(mine);
    expect(session.fire('i').entry).toBe('I');
    expect(() => session.fire('Z')).toThrow();
    expect(session.laserCount).toBe(1);
  });

  it('permet de tirer depuis les 36 repères', () => {
    const session = new GameSession(mine);
    for (const entry of ENTRY_POINTS) session.fire(entry.label);
    expect(session.laserCount).toBe(36);
  });

  it('ne laisse pas fuiter la mine', () => {
    const session = new GameSession(mine);
    session.fire('1');
    const exposed = JSON.stringify(session) + Object.keys(session).join(',');
    expect(exposed).not.toContain('triangle');
    expect(exposed).not.toContain('rhombus');
    expect(exposed).not.toContain('parallelogram');
    expect(exposed).not.toContain('placements');
    // Le trajet du rayon (qui trahirait les gemmes) n'est pas non plus dans la réponse.
    expect(Object.keys(session.shots[0] ?? {}).sort()).toEqual(['color', 'entry', 'exit', 'n']);
  });

  it('génère la mine de la graine', () => {
    const session = GameSession.start('graine-de-test');
    expect(session.seed).toBe('graine-de-test');
    expect(session.fire('1').entry).toBe('1');
  });
});

describe('partie en cours : sondes de case', () => {
  it('répond « rien » ou la couleur de la gemme', () => {
    const session = new GameSession(mine);
    const answers = new Set<string>();
    for (const row of 'ABCDEFGH') {
      for (let col = 1; col <= 10; col++) answers.add(session.probe(`${row}${col}`).content);
    }
    expect(answers.has('nothing')).toBe(true);
    expect([...answers].filter((a) => a !== 'nothing').sort()).toEqual([
      'blue',
      'red',
      'white',
      'yellow',
    ]);
  });

  it('compte les sondes à part des lasers, et redemander une case est gratuit', () => {
    const session = new GameSession(mine);
    session.fire('1');
    const first = session.probe('E4');
    expect(session.probe('e4')).toEqual(first);
    expect(session.probes).toHaveLength(1);
    expect(session.laserCount).toBe(1);
  });

  it('refuse une case inconnue', () => {
    expect(() => new GameSession(mine).probe('K1')).toThrow();
  });
});

describe('partie en cours : soumission', () => {
  it('gagne avec la bonne proposition', () => {
    const session = new GameSession(mine);
    const result = session.submit(mine.placements);
    expect(result).toEqual({ correct: true, attemptsLeft: 0, status: 'won' });
    expect(session.finished).toBe(true);
  });

  it("perd avec une mauvaise proposition quand il n'y a qu'une tentative", () => {
    expect(MAX_ATTEMPTS).toBe(1);
    const session = new GameSession(mine);
    const result = session.submit([]);
    expect(result).toEqual({ correct: false, attemptsLeft: 0, status: 'lost' });
    expect(session.status).toBe('lost');
  });

  it('refuse toute action une fois la partie terminée', () => {
    const session = new GameSession(mine);
    session.submit(mine.placements);
    expect(() => session.fire('1')).toThrow();
    expect(() => session.probe('A1')).toThrow();
    expect(() => session.submit(mine.placements)).toThrow();
    expect(() => session.abandon()).toThrow();
  });

  it('abandonner termine la partie', () => {
    const session = new GameSession(mine);
    session.abandon();
    expect(session.status).toBe('abandoned');
    expect(() => session.fire('1')).toThrow();
  });
});

describe('partie en cours : révélation', () => {
  it('ne révèle pas la mine pendant la partie', () => {
    const session = new GameSession(mine);
    expect(() => session.reveal()).toThrow();
  });

  it('révèle la mine à la fin', () => {
    for (const end of [(s: GameSession) => s.abandon(), (s: GameSession) => s.submit([])]) {
      const session = new GameSession(mine);
      end(session);
      expect(session.reveal().map((p) => p.gem)).toEqual([...BASE_GEM_IDS]);
    }
  });
});

describe('partie en cours : chronomètre', () => {
  it('mesure le temps de jeu et le fige à la fin', () => {
    let time = 1000;
    const session = new GameSession(mine, { now: () => time });
    expect(session.elapsedMs()).toBe(0);
    time += 5000;
    expect(session.elapsedMs()).toBe(5000);
    session.abandon();
    time += 60_000;
    expect(session.elapsedMs()).toBe(5000);
  });

  it('résume la partie', () => {
    let time = 0;
    const session = new GameSession(mine, { now: () => time });
    session.fire('1');
    session.fire('I');
    session.probe('A1');
    time = 12_000;
    session.submit(mine.placements);
    expect(session.summary).toEqual({
      seed: 'session',
      status: 'won',
      lasers: 2,
      probes: 1,
      attempts: 1,
      elapsedMs: 12_000,
    });
  });
});
