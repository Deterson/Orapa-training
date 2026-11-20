import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENTRY_POINTS, cellLabel } from '../src/game/board';
import { Belief, layoutKey, occupancy, placementsOf } from '../src/game/ai/belief';
import { LEVELS } from '../src/game/ai/levels';
import { AiPlayer, playAiTurn } from '../src/game/ai/player';
import { poseOf } from '../src/game/ai/poses';
import { type AiLevel, Duel } from '../src/game/duel';
import { generateMine } from '../src/game/generate';
import { shoot } from '../src/game/laser';
import { probeCell } from '../src/game/probe';
import { createRng } from '../src/game/rng';
import { validatePlacements } from '../src/game/placement';
import { isVisible } from '../src/game/visibility';

const ALL_CELLS = Array.from({ length: 80 }, (_, i) =>
  cellLabel({ row: Math.floor(i / 10), col: i % 10 }),
);

/** Réponses d'une mine à une liste de lasers et de sondes (ce que l'IA recevrait). */
function answersOf(seed: string, entries: readonly string[], cells: readonly string[]) {
  const truth = generateMine(seed).placements;
  return {
    truth,
    shots: entries.map((entry, index) => {
      const result = shoot(truth, entry);
      return { n: index + 1, entry, exit: result.exit, color: result.color };
    }),
    probes: cells.map((cell, index) => {
      const at = ALL_CELLS.indexOf(cell);
      return {
        n: index + 1,
        cell,
        content: probeCell(truth, { row: Math.floor(at / 10), col: at % 10 }),
      };
    }),
  };
}

describe('IA : aucune information interdite', () => {
  const dir = join(__dirname, '..', 'src', 'game', 'ai');
  const sources = readdirSync(dir)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => ({ name, text: readFileSync(join(dir, name), 'utf8') }));

  it("le module de l'IA n'importe jamais la session, ni le duel autrement que pour ses types", () => {
    for (const { name, text } of sources) {
      expect(text, name).not.toMatch(/from '\.\.\/session'/);
      expect(text, name).not.toMatch(/\bGameSession\b/);
      expect(text, name).not.toMatch(/\.reveal\(|toSnapshot|fromSnapshot/);
      // Le duel n'est importé que pour des types : jamais de valeur, donc aucun accès au plateau adverse.
      for (const line of text.split('\n').filter((l) => /from '\.\.\/duel'/.test(l))) {
        expect(line, name).toMatch(/^import type /);
      }
    }
  });

  it('une réflexion ne dépend que des réponses reçues', () => {
    const a = answersOf('secret-a', ['A', 'C', '3'], ['D4']);
    const gems = a.truth.map((p) => p.gem);
    const knowledge = { gems, shots: a.shots, probes: a.probes, lastTurn: false };
    const one = new AiPlayer('intermediate', 'x', gems).decide(structuredClone(knowledge));
    const two = new AiPlayer('intermediate', 'x', gems).decide(structuredClone(knowledge));
    expect(one).toEqual(two);
  });
});

describe('IA : plateaux compatibles', () => {
  it('toutes les particules respectent les réponses reçues et les règles', () => {
    const { shots, probes, truth } = answersOf(
      'compat',
      ['A', 'D', '2', '15', 'J'],
      ['C3', 'F6', 'H9'],
    );
    const belief = new Belief(
      truth.map((p) => p.gem),
      createRng('compat'),
      { size: 24 },
    );
    belief.update({ shots, probes }, 20_000);
    expect(belief.consistent).toBe(true);
    expect(belief.particles).toHaveLength(24);
    for (const layout of belief.particles) {
      const placements = placementsOf(layout);
      expect(validatePlacements(placements)).toEqual([]);
      expect(isVisible(placements)).toBe(true);
      for (const shot of shots) {
        const result = shoot(placements, shot.entry);
        expect([result.exit, result.color]).toEqual([shot.exit, shot.color]);
      }
      const owner = occupancy(layout);
      for (const probe of probes) {
        expect(owner[ALL_CELLS.indexOf(probe.cell)] ?? 'nothing').toBe(probe.content);
      }
    }
  });

  it("au début, tous les plateaux sont possibles : l'échantillon est varié", () => {
    const gems = generateMine('debut').placements.map((p) => p.gem);
    const belief = new Belief(gems, createRng('debut'), { size: 30 });
    belief.update({ shots: [], probes: [] }, 20_000);
    expect(belief.distinct()).toBeGreaterThan(25);
  });

  it("trouve le plateau exact quand l'information suffit", () => {
    for (const seed of ['exact-1', 'exact-2', 'exact-3']) {
      const entries = ENTRY_POINTS.map((p) => p.label);
      const { truth, shots, probes } = answersOf(seed, entries, ALL_CELLS);
      const belief = new Belief(
        truth.map((p) => p.gem),
        createRng(seed),
        { size: 12 },
      );
      belief.update({ shots, probes }, 200_000);
      expect(belief.consistent).toBe(true);
      expect(belief.distinct()).toBe(1);
      const expected = layoutKey(truth.map((p) => poseOf(p)!));
      expect(layoutKey(belief.modal()!.layout)).toBe(expected);
    }
  }, 60_000);
});

/** Une IA seule contre un plateau ; l'adversaire passif pose des sondes à chaque tour. */
function solo(level: AiLevel, seed: string) {
  const duel = Duel.start({
    seed,
    level,
    first: 'player',
    playerBoard: generateMine(`${seed}-p`).placements,
  });
  const ai = new AiPlayer(level, seed, duel.gems);
  const moves: string[] = [];
  let questions = 0;
  let correct: boolean | null = null;
  let spare = 0;
  for (let turn = 0; turn < 60 && !duel.over; turn++) {
    if (duel.turn === 'ai') duel.ask('ai', { kind: 'probe', label: ALL_CELLS[spare++] ?? 'A1' });
    const played = playAiTurn(duel, 'player', ai);
    if (played.move.kind === 'propose') {
      correct = played.correct;
      moves.push(`propose:${String(played.correct)}`);
      break;
    }
    questions++;
    moves.push(`${played.move.kind}:${played.move.label}`);
  }
  return { duel, moves, ai, questions, correct };
}

describe('IA : coups légaux et reproductibles', () => {
  it('ne pose jamais de question déjà posée, et finit par proposer', () => {
    for (const level of ['beginner', 'intermediate'] as const) {
      const { moves } = solo(level, 'legal');
      const questions = moves.filter((move) => !move.startsWith('propose'));
      expect(new Set(questions).size).toBe(questions.length);
      expect(moves.at(-1)).toMatch(/^propose:/);
    }
  });

  it('joue les mêmes coups à graine égale', () => {
    expect(solo('beginner', 'repro').moves).toEqual(solo('beginner', 'repro').moves);
    expect(solo('intermediate', 'repro2').moves).toEqual(solo('intermediate', 'repro2').moves);
  });

  it("le calcul d'une réflexion reste dans son budget", () => {
    for (const level of ['beginner', 'intermediate'] as const) {
      const { ai } = solo(level, 'budget');
      const { budget, verify } = LEVELS[level];
      expect(ai.lastWork).toBeLessThan((budget + verify) * 1.5);
    }
  });

  it("au dernier tour, l'IA propose", () => {
    const duel = Duel.start({
      seed: 'dernier-tour',
      level: 'beginner',
      first: 'player',
      playerBoard: generateMine('dt-p').placements,
      aiBoard: generateMine('dt-ai').placements,
    });
    duel.propose('player', generateMine('dt-ai').placements);
    const ai = new AiPlayer('beginner', 'dt', duel.gems);
    expect(ai.decide(duel.knowledge('ai')).kind).toBe('propose');
  });
});

describe('IA : niveaux mesurés', () => {
  it("l'expert trouve plus souvent que le débutant", () => {
    const seeds = ['m1', 'm2', 'm3', 'm4', 'm5'];
    const share = (level: AiLevel): number =>
      seeds.filter((seed) => solo(level, seed).correct === true).length / seeds.length;
    const expert = share('expert');
    expect(expert).toBeGreaterThanOrEqual(0.6);
    expect(expert).toBeGreaterThan(share('beginner'));
  }, 240_000);
});
