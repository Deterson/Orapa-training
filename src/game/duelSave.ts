/**
 * Sauvegarde locale du duel en cours : même principe que la partie d'entraînement (`save.ts`), avec une
 * validation stricte (une sauvegarde lue dans le navigateur peut être vide, ancienne, tronquée ou modifiée
 * à la main : `parseDuelSave` ne renvoie un duel que si tout est cohérent, sinon null).
 */
import { AI_LEVELS, type AiLevel, type Camp, type DuelSnapshot, isValidBoard } from './duel';
import type { Placement } from './gems';
import type { Notes } from './notes';
import {
  GAME_ID,
  isFiniteNumber,
  isRecord,
  parseNotes,
  parsePlacement,
  parseSnapshot,
  parseSolution,
} from './save';
import type { Solution } from './solution';

/** À incrémenter quand le format change de façon incompatible : l'ancienne sauvegarde est alors ignorée. */
export const DUEL_SAVE_VERSION = 1;

export interface DuelSaveData {
  version: typeof DUEL_SAVE_VERSION;
  savedAt: number;
  duel: DuelSnapshot;
  /** Plateau que le joueur est en train de proposer. */
  solution: Solution;
  notes: Notes;
  /** Identifiant et début du duel (historique du compte) ; absents s'il n'est pas enregistré. */
  gameId?: string;
  startedAt?: number;
}

const CAMPS: readonly Camp[] = ['player', 'ai'];
const PHASES = ['playing', 'lastTurn', 'over'] as const;

const isCamp = (value: unknown): value is Camp => CAMPS.includes(value as Camp);
const isLevel = (value: unknown): value is AiLevel => AI_LEVELS.includes(value as AiLevel);

function parseGuess(value: unknown): Placement[] | null | undefined {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length > 7) return undefined;
  const placements = value.map(parsePlacement);
  return placements.some((p) => p === null) ? undefined : (placements as Placement[]);
}

function parseDuel(value: unknown): DuelSnapshot | null {
  if (!isRecord(value) || value['version'] !== 1) return null;
  const { seed, level, first, turn, phase, solver, winner } = value;
  if (typeof seed !== 'string' || !isLevel(level) || !isCamp(first) || !isCamp(turn)) return null;
  if (!PHASES.includes(phase as (typeof PHASES)[number])) return null;
  if (solver !== null && !isCamp(solver)) return null;
  if (winner !== null && winner !== 'draw' && !isCamp(winner)) return null;
  const player = parseSnapshot(value['player']);
  const ai = parseSnapshot(value['ai']);
  if (player === null || ai === null) return null;
  const guesses = value['guesses'];
  if (!isRecord(guesses)) return null;
  const playerGuess = parseGuess(guesses['player']);
  const aiGuess = parseGuess(guesses['ai']);
  if (playerGuess === undefined || aiGuess === undefined) return null;
  // Les deux plateaux portent les mêmes gemmes et respectent les règles a à e.
  const gems = player.mine.placements.map((placement) => placement.gem);
  if (!isValidBoard(player.mine.placements, gems) || !isValidBoard(ai.mine.placements, gems)) {
    return null;
  }
  return {
    version: 1,
    seed,
    level,
    first,
    turn,
    phase: phase as DuelSnapshot['phase'],
    solver: solver as Camp | null,
    winner: winner as DuelSnapshot['winner'],
    guesses: { player: playerGuess, ai: aiGuess },
    player,
    ai,
  };
}

/** Lit une sauvegarde de duel déjà décodée du JSON. Renvoie null si elle n'est pas entièrement valide. */
export function parseDuelSave(raw: unknown): DuelSaveData | null {
  if (!isRecord(raw) || raw['version'] !== DUEL_SAVE_VERSION) return null;
  const duel = parseDuel(raw['duel']);
  if (duel === null) return null;
  const solution = parseSolution(
    raw['solution'],
    duel.player.mine.placements.map((placement) => placement.gem),
  );
  const notes = parseNotes(raw['notes']);
  const savedAt = raw['savedAt'];
  if (solution === null || notes === null || !isFiniteNumber(savedAt)) return null;
  const data: DuelSaveData = { version: DUEL_SAVE_VERSION, savedAt, duel, solution, notes };
  const { gameId, startedAt } = raw;
  if (gameId !== undefined) {
    if (typeof gameId !== 'string' || !GAME_ID.test(gameId)) return null;
    data.gameId = gameId;
  }
  if (startedAt !== undefined) {
    if (!isFiniteNumber(startedAt) || startedAt < 0 || startedAt > savedAt) return null;
    data.startedAt = startedAt;
  }
  return data;
}
