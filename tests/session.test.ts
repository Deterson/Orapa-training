import { describe, expect, it } from 'vitest';
import { ENTRY_POINTS } from '../src/game/board';
import { generateMine } from '../src/game/generate';
import { shoot } from '../src/game/laser';
import { GameSession } from '../src/game/session';

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
