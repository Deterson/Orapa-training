/**
 * Enregistrement d'une partie terminée (table `games`, voir supabase/migrations). Logique pure :
 * construit la ligne à partir d'une session finie, et valide une ligne lue ou à envoyer avec les
 * mêmes bornes que les contraintes SQL, pour qu'une partie refusée par la base ne puisse pas
 * bloquer la file d'envoi.
 */
import { parseEntryLabel } from './board';
import { ALL_GEM_IDS, type Extensions, type GemId, type Placement } from './gems';
import type { GameSession, GameStatus } from './session';

export type FinishedStatus = Exclude<GameStatus, 'playing'>;
export const FINISHED_STATUSES: readonly FinishedStatus[] = ['won', 'lost', 'abandoned'];

export interface GameRecord {
  /** Identifiant tiré au début de la partie : renvoyer la même partie ne crée pas de doublon. */
  id: string;
  seed: string;
  generatorVersion: number;
  /** Extensions comme dans l'adresse du site : '', 'd', 'n' ou 'dn'. */
  extensions: string;
  status: FinishedStatus;
  lasersCount: number;
  probesCount: number;
  /** Dates ISO 8601. */
  startedAt: string;
  endedAt: string;
  durationS: number;
  /** Repères tirés, dans l'ordre. */
  shots: string[];
  /** Gemmes proposées ; null pour une partie abandonnée. */
  submission: Placement[] | null;
}

/** La ligne telle que la base la reçoit (sans `user_id`, rempli par la base). */
export interface GameRow {
  id: string;
  seed: string;
  generator_version: number;
  extensions: string;
  status: FinishedStatus;
  lasers_count: number;
  probes_count: number;
  started_at: string;
  ended_at: string;
  duration_s: number;
  shots: string[];
  submission: Placement[] | null;
}

/** Code des extensions, identique à celui de l'adresse (`ext=dn`). */
export function extensionsCode(extensions: Readonly<Extensions>): string {
  return `${extensions.diamond ? 'd' : ''}${extensions.blackBody ? 'n' : ''}`;
}

export function extensionsFromCode(code: string): Extensions {
  return { diamond: code.includes('d'), blackBody: code.includes('n') };
}

export interface BuildInput {
  id: string;
  session: GameSession;
  extensions: Readonly<Extensions>;
  /** Début et fin de la partie, en millisecondes (Date.now). */
  startedAt: number;
  endedAt: number;
  /** Gemmes proposées à la soumission ; ignorées si la partie est abandonnée. */
  submission: readonly Placement[];
}

/** Enregistrement d'une partie terminée. Lève une erreur si la partie est encore en cours. */
export function buildRecord(input: BuildInput): GameRecord {
  const { session } = input;
  if (!session.finished) throw new Error('La partie doit être terminée pour être enregistrée.');
  const summary = session.summary;
  const status = summary.status as FinishedStatus;
  const startedAt = Math.min(input.startedAt, input.endedAt);
  return {
    id: input.id,
    seed: summary.seed,
    generatorVersion: session.generatorVersion,
    extensions: extensionsCode(input.extensions),
    status,
    lasersCount: summary.lasers,
    probesCount: summary.probes,
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(input.endedAt).toISOString(),
    durationS: Math.max(0, Math.round(summary.elapsedMs / 1000)),
    shots: session.shots.map((shot) => shot.entry),
    submission: status === 'abandoned' ? null : input.submission.map(cleanPlacement),
  };
}

/** Une pose, avec uniquement ses champs connus (rien d'autre n'est envoyé). */
function cleanPlacement(placement: Placement): Placement {
  return {
    gem: placement.gem,
    orientation: {
      rotation: placement.orientation.rotation,
      flipped: placement.orientation.flipped,
    },
    col: placement.col,
    row: placement.row,
  };
}

export function recordToRow(record: GameRecord): GameRow {
  return {
    id: record.id,
    seed: record.seed,
    generator_version: record.generatorVersion,
    extensions: record.extensions,
    status: record.status,
    lasers_count: record.lasersCount,
    probes_count: record.probesCount,
    started_at: record.startedAt,
    ended_at: record.endedAt,
    duration_s: record.durationS,
    shots: record.shots,
    submission: record.submission,
  };
}

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseDate(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function parseSubmissionPlacement(value: unknown): Placement | null {
  if (!isRecord(value) || !isRecord(value['orientation'])) return null;
  const { gem, col, row } = value;
  const { rotation, flipped } = value['orientation'];
  if (typeof gem !== 'string' || !ALL_GEM_IDS.includes(gem as GemId)) return null;
  if (!isInt(col, -20, 40) || !isInt(row, -20, 40) || !isInt(rotation, 0, 3)) return null;
  if (typeof flipped !== 'boolean') return null;
  return {
    gem: gem as GemId,
    orientation: { rotation: rotation as 0 | 1 | 2 | 3, flipped },
    col,
    row,
  };
}

/**
 * Lit une partie (ligne de la base ou élément de la file d'envoi) : renvoie null si une valeur est
 * hors des bornes de la table `games`. `row` peut avoir les noms de colonnes SQL (snake_case).
 */
export function parseRow(value: unknown): GameRecord | null {
  if (!isRecord(value)) return null;
  const { id, seed, extensions, status } = value;
  const generatorVersion = value['generator_version'];
  const lasers = value['lasers_count'];
  const probes = value['probes_count'];
  const duration = value['duration_s'];
  if (typeof id !== 'string' || !UUID.test(id)) return null;
  if (typeof seed !== 'string' || seed.length < 1 || seed.length > 200) return null;
  if (!isInt(generatorVersion, 1, 1_000_000)) return null;
  if (typeof extensions !== 'string' || !['', 'd', 'n', 'dn'].includes(extensions)) return null;
  if (typeof status !== 'string' || !FINISHED_STATUSES.includes(status as FinishedStatus)) {
    return null;
  }
  if (!isInt(lasers, 0, 36) || !isInt(probes, 0, 80) || !isInt(duration, 0, 31_536_000)) {
    return null;
  }
  const started = parseDate(value['started_at']);
  const ended = parseDate(value['ended_at']);
  if (started === null || ended === null || ended < started) return null;
  const shots = value['shots'];
  if (!Array.isArray(shots) || shots.length !== lasers) return null;
  if (!shots.every((shot) => typeof shot === 'string' && parseEntryLabel(shot) !== null)) {
    return null;
  }
  if (new Set(shots).size !== shots.length) return null;
  let submission: Placement[] | null = null;
  const rawSubmission = value['submission'];
  if (rawSubmission === null || rawSubmission === undefined) {
    if (status !== 'abandoned') return null;
  } else {
    if (status === 'abandoned') return null;
    if (!Array.isArray(rawSubmission) || rawSubmission.length < 1 || rawSubmission.length > 7) {
      return null;
    }
    const placements = rawSubmission.map(parseSubmissionPlacement);
    if (placements.some((placement) => placement === null)) return null;
    submission = placements as Placement[];
  }
  return {
    id,
    seed,
    generatorVersion,
    extensions,
    status: status as FinishedStatus,
    lasersCount: lasers,
    probesCount: probes,
    startedAt: new Date(started).toISOString(),
    endedAt: new Date(ended).toISOString(),
    durationS: duration,
    shots: shots as string[],
    submission,
  };
}
