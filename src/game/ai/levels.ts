/**
 * Les trois niveaux de l'IA, réglés par des données : taille de l'échantillon de plateaux, budget de
 * calcul (en tirs simulés, voir `belief.ts`), façon de choisir les questions et moment de la proposition.
 * Valeurs à régler par simulations (`tests/ai.test.ts`).
 */
import type { AiLevel } from '../duel';

export interface LevelConfig {
  /** Plateaux gardés en mémoire (l'échantillon). */
  particles: number;
  /** Unités de calcul (tirs simulés) par réflexion ; ≈ 20 µs l'unité, donc 25 000 ≈ 0,5 s. */
  budget: number;
  /** Budget de la première réflexion, multiplié (reprise d'une partie : beaucoup de réponses d'un coup). */
  warmupFactor: number;
  /** Unités de calcul pour chercher un autre plateau compatible avant de proposer ; 0 = pas de vérification. */
  verify: number;
  /** Questions évaluées à chaque tour (tirées au hasard) ; null = toutes. */
  pool: number | null;
  /** Probabilité de poser une question au hasard, sans la comparer aux autres. */
  randomQuestion: number;
  /** Part de l'échantillon que doit représenter le plateau le plus probable pour le proposer. 1 = unanimité. */
  proposeShare: number;
  /** Pas de proposition avant ce nombre de questions. */
  minQuestions: number;
  /** Au-delà, l'IA propose son meilleur plateau, quoi qu'il arrive. */
  maxQuestions: number;
  /** Délai de réflexion affiché à l'écran (ms), pour un rythme humain. Sans effet sur le jeu. */
  thinkMs: readonly [number, number];
}

export const LEVELS: Readonly<Record<AiLevel, LevelConfig>> = {
  beginner: {
    particles: 12,
    budget: 4_000,
    warmupFactor: 2,
    verify: 0,
    pool: 6,
    randomQuestion: 0.4,
    proposeShare: 0.6,
    minQuestions: 6,
    maxQuestions: 16,
    thinkMs: [900, 1800],
  },
  intermediate: {
    particles: 32,
    budget: 12_000,
    warmupFactor: 3,
    verify: 1_500,
    pool: 20,
    randomQuestion: 0.05,
    proposeShare: 0.9,
    minQuestions: 6,
    maxQuestions: 30,
    thinkMs: [700, 1400],
  },
  expert: {
    particles: 48,
    budget: 22_000,
    warmupFactor: 3,
    verify: 40_000,
    pool: null,
    randomQuestion: 0,
    proposeShare: 1,
    minQuestions: 10,
    maxQuestions: 40,
    thinkMs: [500, 1000],
  },
};

export const LEVEL_LABELS: Readonly<Record<AiLevel, string>> = {
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  expert: 'Expert',
};
