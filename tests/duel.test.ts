import { describe, expect, it } from 'vitest';
import { Duel, type DuelSetup, firstPlayerOf } from '../src/game/duel';
import { generateMine } from '../src/game/generate';
import type { Placement } from '../src/game/gems';

function setup(seed: string, first: 'player' | 'ai', extra: Partial<DuelSetup> = {}): DuelSetup {
  return {
    seed,
    level: 'expert',
    first,
    playerBoard: generateMine(`${seed}-joueur`).placements,
    ...extra,
  };
}

/** Un plateau voisin mais faux : la gemme rouge est décalée ou retournée. */
function wrongGuess(truth: readonly Placement[]): Placement[] {
  return truth.map((placement, index) =>
    index === 0
      ? {
          ...placement,
          orientation: { ...placement.orientation, flipped: !placement.orientation.flipped },
        }
      : placement,
  );
}

describe('duel : tours et questions', () => {
  it('commence par le camp désigné et alterne', () => {
    const duel = Duel.start(setup('tours', 'player'));
    expect(duel.turn).toBe('player');
    duel.ask('player', { kind: 'fire', label: 'A' });
    expect(duel.turn).toBe('ai');
    duel.ask('ai', { kind: 'probe', label: 'E4' });
    expect(duel.turn).toBe('player');
  });

  it('refuse de jouer hors de son tour', () => {
    const duel = Duel.start(setup('hors-tour', 'player'));
    expect(() => duel.ask('ai', { kind: 'fire', label: 'A' })).toThrow();
    expect(() => duel.propose('ai', [])).toThrow();
  });

  it('une question déjà posée est gratuite : le tour ne passe pas', () => {
    const duel = Duel.start(setup('gratuit', 'player'));
    const first = duel.ask('player', { kind: 'probe', label: 'B3' });
    duel.ask('ai', { kind: 'fire', label: '1' });
    expect(duel.isFree('player', { kind: 'probe', label: 'B3' })).toBe(true);
    const again = duel.ask('player', { kind: 'probe', label: 'B3' });
    expect(again).toEqual(first);
    expect(duel.turn).toBe('player');
  });

  it('le joueur voit les réponses de ses questions seulement dans sa session', () => {
    const duel = Duel.start(setup('sessions', 'player'));
    duel.ask('player', { kind: 'fire', label: 'A' });
    duel.ask('ai', { kind: 'fire', label: 'B' });
    expect(duel.playerSession.shots.map((shot) => shot.entry)).toEqual(['A']);
    expect(duel.aiQuestions.shots.map((shot) => shot.entry)).toEqual(['B']);
  });
});

describe('duel : fin de partie du livret', () => {
  it('une proposition fausse fait perdre aussitôt', () => {
    const board = generateMine('faux-ia').placements;
    const duel = Duel.start(setup('faux', 'player', { aiBoard: board }));
    expect(duel.propose('player', wrongGuess(board))).toBe(false);
    expect(duel.over).toBe(true);
    expect(duel.status).toBe('lost');
    expect(duel.playerSession.status).toBe('lost');
  });

  it("le premier joueur qui trouve laisse un dernier tour : échec de l'autre = victoire", () => {
    const board = generateMine('dernier-ia').placements;
    const mine = generateMine('dernier-joueur').placements;
    const duel = Duel.start(setup('dernier', 'player', { aiBoard: board, playerBoard: mine }));
    expect(duel.propose('player', board)).toBe(true);
    expect(duel.over).toBe(false);
    expect(duel.lastTurnOf).toBe('ai');
    expect(duel.knowledge('ai').lastTurn).toBe(true);
    expect(() => duel.ask('ai', { kind: 'fire', label: 'A' })).toThrow();
    duel.propose('ai', wrongGuess(mine));
    expect(duel.status).toBe('won');
  });

  it('dernier tour réussi : égalité', () => {
    const board = generateMine('egal-ia').placements;
    const mine = generateMine('egal-joueur').placements;
    const duel = Duel.start(setup('egal', 'player', { aiBoard: board, playerBoard: mine }));
    duel.propose('player', board);
    duel.propose('ai', mine);
    expect(duel.over).toBe(true);
    expect(duel.status).toBe('draw');
  });

  it("l'IA qui joue en premier et trouve donne le dernier tour au joueur", () => {
    const board = generateMine('ia-ia').placements;
    const mine = generateMine('ia-joueur').placements;
    const duel = Duel.start(setup('ia-premiere', 'ai', { aiBoard: board, playerBoard: mine }));
    duel.propose('ai', mine);
    expect(duel.lastTurnOf).toBe('player');
    duel.propose('player', wrongGuess(board));
    expect(duel.status).toBe('lost');
    expect(duel.reveal().player).toEqual(mine);
  });

  it('le second à jouer qui trouve gagne sans dernier tour (même nombre de tours)', () => {
    const board = generateMine('second-ia').placements;
    const mine = generateMine('second-joueur').placements;
    const duel = Duel.start(setup('second', 'ai', { aiBoard: board, playerBoard: mine }));
    duel.ask('ai', { kind: 'fire', label: 'A' });
    duel.propose('player', board);
    expect(duel.over).toBe(true);
    expect(duel.status).toBe('won');
  });

  it("plus rien n'est possible après la fin", () => {
    const board = generateMine('fin-ia').placements;
    const duel = Duel.start(setup('fin', 'player', { aiBoard: board }));
    duel.propose('player', wrongGuess(board));
    expect(() => duel.ask('player', { kind: 'fire', label: 'A' })).toThrow();
    expect(() => duel.propose('ai', [])).toThrow();
  });
});

describe('duel : cloisonnement', () => {
  it("ne révèle les plateaux qu'à la fin", () => {
    const duel = Duel.start(setup('secret', 'player'));
    expect(() => duel.reveal()).toThrow();
    expect(() => duel.playerSession.reveal()).toThrow();
  });

  it("ce qui revient à chaque camp ne contient aucune gemme de l'autre plateau", () => {
    const board = generateMine('cloison-ia').placements;
    const mine = generateMine('cloison-joueur').placements;
    const duel = Duel.start(setup('cloison', 'player', { aiBoard: board, playerBoard: mine }));
    duel.ask('player', { kind: 'fire', label: 'A' });
    duel.ask('ai', { kind: 'fire', label: 'C' });
    duel.ask('player', { kind: 'probe', label: 'D5' });
    duel.ask('ai', { kind: 'probe', label: 'E5' });

    for (const side of ['player', 'ai'] as const) {
      const text = JSON.stringify(duel.knowledge(side));
      // Aucune pose de gemme, aucune orientation : seulement des tirs, des sondes et la liste des gemmes.
      expect(text).not.toMatch(/orientation|placements|rotation|"col"|"row"/);
      expect(Object.keys(duel.knowledge(side)).sort()).toEqual([
        'gems',
        'lastTurn',
        'probes',
        'shots',
      ]);
    }
    expect(JSON.stringify(duel.aiQuestions)).not.toMatch(/orientation|placements|rotation/);
    expect(JSON.stringify(duel.playerSession)).toBe('{"seed":"cloison"}');
  });
});

describe('duel : sauvegarde et graine', () => {
  it('un instantané restaure le même duel', () => {
    const duel = Duel.start(setup('instantane', 'player'));
    duel.ask('player', { kind: 'fire', label: 'A' });
    duel.ask('ai', { kind: 'probe', label: 'F2' });
    duel.ask('player', { kind: 'probe', label: 'H10' });
    const copy = Duel.fromSnapshot(JSON.parse(JSON.stringify(duel.toSnapshot())));
    expect(copy.turn).toBe(duel.turn);
    expect(copy.playerSession.shots).toEqual(duel.playerSession.shots);
    expect(copy.playerSession.probes).toEqual(duel.playerSession.probes);
    expect(copy.aiQuestions).toEqual(duel.aiQuestions);
    expect(copy.level).toBe('expert');
  });

  it("le plateau de l'IA et le premier joueur découlent de la graine", () => {
    expect(firstPlayerOf('abc')).toBe(firstPlayerOf('abc'));
    const sides = new Set(Array.from({ length: 40 }, (_, i) => firstPlayerOf(`graine-${i}`)));
    expect(sides.size).toBe(2);
    const a = Duel.start({
      seed: 'meme',
      level: 'beginner',
      playerBoard: generateMine('x').placements,
    });
    const b = Duel.start({
      seed: 'meme',
      level: 'beginner',
      playerBoard: generateMine('y').placements,
    });
    expect(a.first).toBe(b.first);
    a.propose(a.first, []);
    b.propose(b.first, []);
    expect(a.reveal().ai).toEqual(b.reveal().ai);
  });

  it('refuse un plateau du joueur invalide', () => {
    expect(() => Duel.start({ seed: 'x', level: 'expert', playerBoard: [] })).toThrow();
    const board = generateMine('base').placements;
    expect(() =>
      Duel.start({
        seed: 'x',
        level: 'expert',
        playerBoard: board,
        extensions: { diamond: true, blackBody: false },
      }),
    ).toThrow();
  });
});
