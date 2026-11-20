/**
 * Enregistrement d'une partie terminée (table `games`, voir supabase/migrations). Logique pure :
 * construit la ligne à partir d'une session finie, et valide une ligne lue ou à envoyer avec les
 * mêmes bornes que les contraintes SQL, pour qu'une partie refusée par la base ne puisse pas
 * bloquer la file d'envoi.
 */
import { parseEntryLabel } from './board';
import { AI_LEVELS, type AiLevel } from './duel';
import { ALL_GEM_IDS, type Extensions, type GemId, type Placement, extensionsOf } from './gems';
import { GAME_ID, type SaveData, parseSave } from './save';
import type { GameSession, GameStatus } from './session';

/** Issue d'une partie terminée. `draw` n'existe que pour un duel (égalité). */
export type FinishedStatus = Exclude<GameStatus, 'playing'> | 'draw';
export const FINISHED_STATUSES: readonly FinishedStatus[] = ['won', 'lost', 'abandoned', 'draw'];

/** Entraînement seul, ou duel contre l'IA (v3). */
export type GameMode = 'training' | 'duel';

export interface GameRecord {
  /** Identifiant tiré au début de la partie : renvoyer la même partie ne crée pas de doublon. */
  id: string;
  seed: string;
  generatorVersion: number;
  /** Extensions comme dans l'adresse du site : '', 'd', 'n' ou 'dn'. */
  extensions: string;
  status: FinishedStatus;
  /** Entraînement ou duel. */
  mode: GameMode;
  /** Niveau de l'IA pour un duel, null sinon. */
  level: AiLevel | null;
  lasersCount: number;
  probesCount: number;
  /** Dates ISO 8601. */
  startedAt: string;
  endedAt: string;
  durationS: number;
  /** Repères tirés, dans l'ordre. */
  shots: string[];
  /** Gemmes proposées ; null pour une partie abandonnée, ou un duel que le joueur n'a pas eu le temps de proposer. */
  submission: Placement[] | null;
}

/** La ligne telle que la base la reçoit (sans `user_id`, rempli par la base). */
export interface GameRow {
  id: string;
  seed: string;
  generator_version: number;
  extensions: string;
  status: FinishedStatus;
  mode: GameMode;
  level: AiLevel | null;
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
  /** Duel contre l'IA : niveau et issue du duel (qui peut être une égalité, que la session ne connaît pas). */
  duel?: { level: AiLevel; outcome: 'won' | 'lost' | 'draw' };
}

/** Enregistrement d'une partie terminée. Lève une erreur si la partie est encore en cours. */
export function buildRecord(input: BuildInput): GameRecord {
  const { session } = input;
  if (!session.finished) throw new Error('La partie doit être terminée pour être enregistrée.');
  const summary = session.summary;
  const status: FinishedStatus = input.duel
    ? input.duel.outcome
    : (summary.status as FinishedStatus);
  const startedAt = Math.min(input.startedAt, input.endedAt);
  return {
    id: input.id,
    seed: summary.seed,
    generatorVersion: session.generatorVersion,
    extensions: extensionsCode(input.extensions),
    status,
    mode: input.duel ? 'duel' : 'training',
    level: input.duel ? input.duel.level : null,
    lasersCount: session.shots.length,
    probesCount: session.probes.length,
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(input.endedAt).toISOString(),
    durationS: Math.max(0, Math.round(summary.elapsedMs / 1000)),
    shots: session.shots.map((shot) => shot.entry),
    // Un duel peut finir sans que le joueur ait rien proposé (l'IA a trouvé la première) : pas de proposition.
    submission:
      status === 'abandoned' || (input.duel && input.submission.length === 0)
        ? null
        : input.submission.map(cleanPlacement),
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
    mode: record.mode,
    level: record.level,
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
  if (typeof id !== 'string' || !GAME_ID.test(id)) return null;
  if (typeof seed !== 'string' || seed.length < 1 || seed.length > 200) return null;
  if (!isInt(generatorVersion, 1, 1_000_000)) return null;
  if (typeof extensions !== 'string' || !['', 'd', 'n', 'dn'].includes(extensions)) return null;
  if (typeof status !== 'string' || !FINISHED_STATUSES.includes(status as FinishedStatus)) {
    return null;
  }
  // Une ligne sans mode (ancienne partie, ancienne file d'envoi) est une partie d'entraînement.
  const mode = value['mode'] ?? 'training';
  const rawLevel = value['level'] ?? null;
  if (mode !== 'training' && mode !== 'duel') return null;
  if (mode === 'duel' ? !AI_LEVELS.includes(rawLevel as AiLevel) : rawLevel !== null) return null;
  if (status === 'draw' && mode !== 'duel') return null;
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
    if (status !== 'abandoned' && mode !== 'duel') return null;
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
    mode,
    level: rawLevel as AiLevel | null,
    lasersCount: lasers,
    probesCount: probes,
    startedAt: new Date(started).toISOString(),
    endedAt: new Date(ended).toISOString(),
    durationS: duration,
    shots: shots as string[],
    submission,
  };
}

/** Statistiques du profil, calculées par la base (fonction `profile_stats`) sur les parties terminées. */
export interface ProfileStats {
  /** Parties terminées : gagnées, perdues et abandonnées (un abandon compte comme une défaite). */
  total: number;
  wins: number;
  losses: number;
  abandoned: number;
  /** Part de victoires entre 0 et 1 ; null sans aucune partie. */
  winRate: number | null;
  /** Moyenne de tirs (lasers et sondes) sur les parties gagnées ; null sans victoire (jamais 0 par défaut). */
  avgShotsToWin: number | null;
  /** Duels contre l'IA, par niveau (absent sans duel). Ils ne comptent pas dans les chiffres ci-dessus. */
  duels?: DuelLevelStats[];
}

/** Résultats des duels contre l'IA à un niveau (fonction `duel_stats`). */
export interface DuelLevelStats {
  level: AiLevel;
  total: number;
  wins: number;
  draws: number;
  losses: number;
  /** Part de victoires entre 0 et 1. */
  winRate: number;
}

const count = (value: unknown): number | null => (isInt(value, 0, 1e9) ? value : null);
const nullableNumber = (value: unknown, max: number): number | null | undefined => {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max ? n : undefined;
};

/** Lit la ligne renvoyée par `profile_stats` (les nombres décimaux peuvent arriver en texte). */
export function parseStats(value: unknown): ProfileStats | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!isRecord(row)) return null;
  const total = count(row['total_games']);
  const wins = count(row['wins']);
  const losses = count(row['losses']);
  const abandoned = count(row['abandoned']);
  const winRate = nullableNumber(row['win_rate'], 1);
  const avgShotsToWin = nullableNumber(row['avg_shots_to_win'], 116);
  if (total === null || wins === null || losses === null || abandoned === null) return null;
  if (winRate === undefined || avgShotsToWin === undefined) return null;
  // Cohérence : les trois issues font le total, et sans partie ou sans victoire pas de chiffre.
  if (wins + losses + abandoned !== total) return null;
  if ((total === 0) !== (winRate === null)) return null;
  if ((wins === 0) !== (avgShotsToWin === null)) return null;
  return { total, wins, losses, abandoned, winRate, avgShotsToWin };
}

/** Lit les lignes renvoyées par `duel_stats` : une par niveau joué, dans l'ordre débutant, intermédiaire, expert. */
export function parseDuelStats(value: unknown): DuelLevelStats[] | null {
  if (!Array.isArray(value)) return null;
  const rows: DuelLevelStats[] = [];
  for (const row of value) {
    if (!isRecord(row)) return null;
    const level = row['level'];
    const total = count(row['total_games']);
    const wins = count(row['wins']);
    const draws = count(row['draws']);
    const losses = count(row['losses']);
    if (!AI_LEVELS.includes(level as AiLevel) || total === null || total === 0) return null;
    if (wins === null || draws === null || losses === null) return null;
    if (wins + draws + losses !== total) return null;
    rows.push({ level: level as AiLevel, total, wins, draws, losses, winRate: wins / total });
  }
  return rows.sort((a, b) => AI_LEVELS.indexOf(a.level) - AI_LEVELS.indexOf(b.level));
}

// ---------- Parties en cours (côté serveur) ----------

/** Nombre maximal de parties en cours par compte (aussi imposé par la base). */
export const MAX_PLAYING = 10;
/** Taille maximale du snapshot envoyé, en caractères JSON (la base accepte jusqu'à 250 000). */
export const SNAPSHOT_LIMIT = 200_000;

/** Une partie en cours, telle qu'elle est enregistrée sur le serveur. */
export interface ProgressRecord {
  id: string;
  seed: string;
  generatorVersion: number;
  extensions: string;
  lasersCount: number;
  probesCount: number;
  /** Date ISO du début de la partie. */
  startedAt: string;
  /** Temps de jeu écoulé, en secondes. */
  durationS: number;
  /** Repères tirés, dans l'ordre. */
  shots: string[];
  /** La sauvegarde du site (mine comprise : réservé au propriétaire, voir la sécurité par ligne). */
  snapshot: SaveData;
}

/**
 * La sauvegarde à envoyer : sans le compte auquel elle est reliée, et, si elle dépasse la taille
 * permise, sans les traits au crayon des notes (les marques de cases restent).
 */
export function compactSave(save: SaveData): SaveData {
  const { owner: _owner, ...rest } = save;
  void _owner;
  if (JSON.stringify(rest).length <= SNAPSHOT_LIMIT) return rest;
  return { ...rest, notes: { ...rest.notes, strokes: [] } };
}

export interface ProgressInput {
  id: string;
  save: SaveData;
  /** Début de la partie, en millisecondes. */
  startedAt: number;
}

export function buildProgress({ id, save, startedAt }: ProgressInput): ProgressRecord {
  const { session } = save;
  const gems = session.mine.placements.map((placement) => placement.gem);
  return {
    id,
    seed: session.mine.seed,
    generatorVersion: session.mine.generatorVersion,
    extensions: extensionsCode(extensionsOf(gems)),
    lasersCount: session.shots.length,
    probesCount: session.probes.length,
    startedAt: new Date(Math.min(startedAt, save.savedAt)).toISOString(),
    durationS: Math.max(0, Math.round(session.elapsedMs / 1000)),
    shots: [...session.shots],
    snapshot: compactSave({ ...save, gameId: id }),
  };
}

/** La ligne à créer (première synchronisation). */
export function progressToRow(progress: ProgressRecord) {
  return {
    id: progress.id,
    seed: progress.seed,
    generator_version: progress.generatorVersion,
    extensions: progress.extensions,
    status: 'playing' as const,
    lasers_count: progress.lasersCount,
    probes_count: progress.probesCount,
    started_at: progress.startedAt,
    ended_at: null,
    duration_s: progress.durationS,
    shots: progress.shots,
    submission: null,
    snapshot: progress.snapshot,
  };
}

/** Les colonnes qui changent pendant la partie (synchronisations suivantes). */
export function progressToPatch(progress: ProgressRecord) {
  return {
    lasers_count: progress.lasersCount,
    probes_count: progress.probesCount,
    duration_s: progress.durationS,
    shots: progress.shots,
    snapshot: progress.snapshot,
  };
}

/** Une partie en cours vue de l'accueil (sans son snapshot, qui est lourd). */
export interface PlayingSummary {
  id: string;
  seed: string;
  extensions: string;
  lasersCount: number;
  probesCount: number;
  durationS: number;
  startedAt: string;
  updatedAt: string;
}

export function parsePlayingSummary(value: unknown): PlayingSummary | null {
  if (!isRecord(value)) return null;
  const { id, seed, extensions } = value;
  const lasers = value['lasers_count'];
  const probes = value['probes_count'];
  const duration = value['duration_s'];
  const started = parseDate(value['started_at']);
  const updated = parseDate(value['updated_at']);
  if (typeof id !== 'string' || !GAME_ID.test(id)) return null;
  if (typeof seed !== 'string' || seed.length < 1 || seed.length > 200) return null;
  if (typeof extensions !== 'string' || !['', 'd', 'n', 'dn'].includes(extensions)) return null;
  if (!isInt(lasers, 0, 36) || !isInt(probes, 0, 80) || !isInt(duration, 0, 31_536_000))
    return null;
  if (started === null || updated === null) return null;
  return {
    id,
    seed,
    extensions,
    lasersCount: lasers,
    probesCount: probes,
    durationS: duration,
    startedAt: new Date(started).toISOString(),
    updatedAt: new Date(updated).toISOString(),
  };
}

/** Lit le snapshot d'une partie en cours : la même validation stricte que la sauvegarde locale. */
export function parseProgressSnapshot(value: unknown): SaveData | null {
  return parseSave(value);
}
