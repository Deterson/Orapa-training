/**
 * Choix de la prochaine question par gain d'information : celle dont les réponses partagent le mieux
 * l'échantillon de plateaux encore possibles (entropie de Shannon de la répartition des réponses).
 * Laser et sonde de case sont comparées sur le même pied (elles comptent pareil).
 */
import { ENTRY_POINTS } from '../board';
import { cellLabel } from '../board';
import type { Question } from '../duel';
import { shoot } from '../laser';
import type { Rng } from '../rng';
import { type Layout, occupancy, placementsOf } from './belief';
import { CELL_COUNT } from './poses';

export interface Asked {
  /** Repères déjà tirés. */
  entries: ReadonlySet<string>;
  /** Repères d'arrivée de tirs déjà faits : les tirer ne rapprendrait rien (trajet réversible). */
  exits: ReadonlySet<string>;
  /** Cases déjà sondées. */
  cells: ReadonlySet<string>;
}

/** Questions encore utiles : ni déjà posées, ni gratuites. */
export function remainingQuestions(asked: Asked): Question[] {
  const questions: Question[] = [];
  for (const { label } of ENTRY_POINTS) {
    if (!asked.entries.has(label) && !asked.exits.has(label))
      questions.push({ kind: 'fire', label });
  }
  for (let index = 0; index < CELL_COUNT; index++) {
    const label = cellLabel({ row: Math.floor(index / 10), col: index % 10 });
    if (!asked.cells.has(label)) questions.push({ kind: 'probe', label });
  }
  return questions;
}

function entropy(counts: Iterable<number>, total: number): number {
  let bits = 0;
  for (const count of counts) {
    const p = count / total;
    bits -= p * Math.log2(p);
  }
  return bits;
}

/** Mélange partiel (Fisher-Yates) : les `count` premiers éléments d'un tirage au hasard. */
function sample<T>(items: readonly T[], count: number, rng: Rng): T[] {
  const copy = items.slice();
  const take = Math.min(count, copy.length);
  for (let i = 0; i < take; i++) {
    const j = i + rng.int(copy.length - i);
    const a = copy[i];
    const b = copy[j];
    if (a !== undefined && b !== undefined) {
      copy[i] = b;
      copy[j] = a;
    }
  }
  return copy.slice(0, take);
}

/**
 * La question qui apprend le plus sur ces plateaux possibles (à égalité, au hasard). `pool` : nombre de
 * questions comparées, tirées au hasard parmi celles qui restent (null : toutes). Null s'il n'en reste aucune.
 */
export function bestQuestion(
  particles: readonly Layout[],
  asked: Asked,
  rng: Rng,
  pool: number | null,
): Question | null {
  const all = remainingQuestions(asked);
  if (all.length === 0) return null;
  const candidates = pool === null ? all : sample(all, pool, rng);
  const owners = particles.map(occupancy);
  const placements = particles.map(placementsOf);
  let best: { question: Question; score: number } | null = null;
  for (const question of candidates) {
    const counts = new Map<string, number>();
    particles.forEach((_, index) => {
      let answer: string;
      if (question.kind === 'fire') {
        const result = shoot(placements[index] ?? [], question.label);
        answer = `${result.exit}|${result.color}`;
      } else {
        const row = 'ABCDEFGH'.indexOf(question.label.charAt(0));
        const col = Number(question.label.slice(1)) - 1;
        answer = owners[index]?.[row * 10 + col] ?? 'nothing';
      }
      counts.set(answer, (counts.get(answer) ?? 0) + 1);
    });
    // Un peu de bruit pour départager les ex æquo sans toujours choisir la même question.
    const score = entropy(counts.values(), particles.length) + rng.next() * 1e-6;
    if (!best || score > best.score) best = { question, score };
  }
  return best?.question ?? null;
}

/** Une question au hasard parmi celles qui restent. */
export function randomQuestion(asked: Asked, rng: Rng): Question | null {
  const all = remainingQuestions(asked);
  return all.length ? rng.pick(all) : null;
}
