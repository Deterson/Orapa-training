/**
 * Le joueur IA. Il ne reçoit que `Knowledge` (réponses à ses propres questions) : jamais le plateau
 * adverse, ni la session, ni le duel (test automatisé : `tests/ai.test.ts`). À graine égale et mêmes
 * réponses, il joue les mêmes coups (le budget de calcul est compté en tirs simulés, pas en millisecondes).
 */
import type { AiLevel, Camp, Duel, Knowledge, Question } from '../duel';
import type { GemId, Placement } from '../gems';
import { createRng } from '../rng';
import { Belief, placementsOf } from './belief';
import { LEVELS, type LevelConfig } from './levels';
import { bestQuestion, randomQuestion } from './strategy';

export type AiMove = Question | { kind: 'propose'; guess: Placement[] };

export class AiPlayer {
  readonly level: AiLevel;
  readonly #config: LevelConfig;
  readonly #rng;
  readonly #belief: Belief;
  #thoughts = 0;

  constructor(level: AiLevel, seed: string, gems: readonly GemId[]) {
    this.level = level;
    this.#config = LEVELS[level];
    this.#rng = createRng(`${seed}/ia/${level}`);
    this.#belief = new Belief(gems, this.#rng, { size: this.#config.particles });
  }

  /** Unités de calcul de la dernière réflexion (pour les mesures). */
  get lastWork(): number {
    return this.#belief.work;
  }

  /** Nombre de plateaux différents que l'IA juge encore possibles. */
  get possibleBoards(): number {
    return this.#belief.distinct();
  }

  /** Délai de réflexion à afficher, en ms (rythme humain ; sans effet sur le jeu). */
  thinkingDelay(): number {
    const [min, max] = this.#config.thinkMs;
    return min + this.#rng.next() * (max - min);
  }

  /** Le coup suivant : une question (laser ou sonde) ou une proposition de plateau. */
  decide(knowledge: Knowledge): AiMove {
    const config = this.#config;
    const budget = config.budget * (this.#thoughts === 0 ? config.warmupFactor : 1);
    this.#thoughts++;
    this.#belief.update(knowledge, budget);

    const guess = (): AiMove => {
      const modal = this.#belief.modal();
      return { kind: 'propose', guess: modal ? placementsOf(modal.layout) : [] };
    };
    // Dernier tour : plus de question possible.
    if (knowledge.lastTurn) return guess();

    const asked = {
      entries: new Set(knowledge.shots.map((shot) => shot.entry)),
      exits: new Set(knowledge.shots.map((shot) => shot.exit)),
      cells: new Set(knowledge.probes.map((probe) => probe.cell)),
    };
    const count = knowledge.shots.length + knowledge.probes.length;

    const question = (): Question | null =>
      this.#rng.next() < config.randomQuestion
        ? randomQuestion(asked, this.#rng)
        : bestQuestion(this.#belief.particles, asked, this.#rng, config.pool);

    if (count >= config.maxQuestions) return guess();
    if (count >= config.minQuestions) {
      const modal = this.#belief.modal();
      if (modal && modal.share >= config.proposeShare && this.#belief.consistent) {
        // Sûr de soi ? On cherche encore un autre plateau compatible avant de se lancer.
        const doubt = config.verify > 0 && this.#belief.findAlternative(knowledge, config.verify);
        if (!doubt) return guess();
      }
    }
    return question() ?? guess();
  }
}

/** Joue un tour de ce camp avec cette IA : pose la question ou fait la proposition dans le duel. */
export function playAiTurn(
  duel: Duel,
  camp: Camp,
  ai: AiPlayer,
): { move: AiMove; correct: boolean | null } {
  const move = ai.decide(duel.knowledge(camp));
  if (move.kind === 'propose') return { move, correct: duel.propose(camp, move.guess) };
  duel.ask(camp, move);
  return { move, correct: null };
}
