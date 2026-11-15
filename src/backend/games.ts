/**
 * Accès à la table `games` (voir supabase/migrations). Le service est derrière une interface pour
 * que la file d'envoi, la synchronisation et l'interface se testent sans réseau.
 */
import {
  type FinishedStatus,
  type GameRecord,
  type PlayingSummary,
  type ProfileStats,
  type ProgressRecord,
  parsePlayingSummary,
  parseProgressSnapshot,
  parseRow,
  parseStats,
  progressToPatch,
  progressToRow,
  recordToRow,
} from '../game/record';
import type { SaveData } from '../game/save';

export type HistoryFilter = 'all' | 'won' | 'lost';
export type HistorySort = 'recent' | 'oldest' | 'shots';

export interface HistoryQuery {
  /** `lost` regroupe les parties perdues et abandonnées (une partie abandonnée compte comme perdue). */
  filter: HistoryFilter;
  sort: HistorySort;
  /** Numéro de page, à partir de 0. */
  page: number;
  pageSize: number;
}

export interface HistoryPage {
  games: GameRecord[];
  /** Nombre de parties correspondant au filtre, toutes pages confondues. */
  total: number;
}

/** Une partie en cours rechargée depuis le serveur. */
export interface LoadedProgress {
  save: SaveData;
  updatedAt: string;
}

export interface GamesService {
  /**
   * Enregistre la fin d'une partie : la partie en cours correspondante devient gagnée, perdue ou
   * abandonnée ; si elle n'existait pas côté serveur, elle est créée terminée. Idempotent :
   * renvoyer la même fin (nouvel essai) ne change rien.
   */
  finish(record: GameRecord): Promise<void>;
  /** Met à jour la partie en cours (la crée si elle n'existe pas encore). */
  saveProgress(progress: ProgressRecord): Promise<void>;
  /** Les parties en cours du compte, la plus récemment modifiée d'abord. */
  listPlaying(): Promise<PlayingSummary[]>;
  /** Le snapshot d'une partie en cours, ou null si elle n'existe plus (terminée, supprimée). */
  loadPlaying(id: string): Promise<LoadedProgress | null>;
  /** Abandonne une partie en cours du compte (sans la charger). */
  abandonPlaying(id: string, startedAt: string): Promise<void>;
  list(query: HistoryQuery): Promise<HistoryPage>;
  /** Statistiques du profil de l'utilisateur connecté. */
  stats(): Promise<ProfileStats>;
}

/** Échec d'une requête. `permanent` : la base refuse la donnée elle-même, inutile de réessayer. */
export class GamesError extends Error {
  readonly permanent: boolean;
  constructor(message: string, permanent: boolean) {
    super(message);
    this.name = 'GamesError';
    this.permanent = permanent;
  }
}

/** Erreurs SQL de classe 22 (donnée invalide) et 23 (contrainte violée) : réessayer ne servirait à rien. */
export function isPermanentCode(code: unknown): boolean {
  return typeof code === 'string' && /^(22|23)/.test(code);
}

/** Statuts d'une partie terminée selon le filtre de l'historique (jamais `playing`). */
export function statusesFor(filter: HistoryFilter): FinishedStatus[] {
  switch (filter) {
    case 'won':
      return ['won'];
    case 'lost':
      return ['lost', 'abandoned'];
    default:
      return ['won', 'lost', 'abandoned'];
  }
}

/** Bornes (incluses) de la page demandée, pour `range`. */
export function pageRange(page: number, pageSize: number): [number, number] {
  const from = Math.max(0, page) * pageSize;
  return [from, from + pageSize - 1];
}

type DbError = { message: string; code?: string } | null;

type QueryResult = {
  data: unknown;
  count?: number | null;
  error: DbError;
};

/** La partie du constructeur de requêtes Supabase utilisée ici (remplaçable dans les tests). */
export interface GamesQuery extends PromiseLike<QueryResult> {
  in(column: string, values: readonly string[]): GamesQuery;
  eq(column: string, value: string): GamesQuery;
  order(column: string, options?: { ascending?: boolean }): GamesQuery;
  range(from: number, to: number): GamesQuery;
  limit(count: number): GamesQuery;
  /** Après une modification : renvoyer les colonnes des lignes modifiées. */
  select(columns: string): GamesQuery;
}

export interface GamesClientLike {
  from(table: 'games'): {
    upsert(
      row: unknown,
      options: { onConflict: string; ignoreDuplicates: boolean },
    ): PromiseLike<{ error: DbError }>;
    update(values: unknown): GamesQuery;
    select(columns: string, options?: { count: 'exact' }): GamesQuery;
  };
  rpc(fn: 'profile_stats'): PromiseLike<{ data: unknown; error: DbError }>;
}

const networkError = (error: unknown): GamesError =>
  new GamesError(error instanceof Error ? error.message : 'Réseau indisponible', false);

export function createGamesService(client: GamesClientLike): GamesService {
  /** Attend une requête ; une coupure réseau devient une erreur « à réessayer ». */
  const run = async (request: PromiseLike<QueryResult>): Promise<QueryResult> => {
    try {
      return await request;
    } catch (error) {
      throw networkError(error);
    }
  };

  const fail = (error: NonNullable<DbError>): GamesError =>
    new GamesError(error.message, isPermanentCode(error.code));

  /** Crée la ligne si elle n'existe pas ; si elle existe déjà (même terminée), ne change rien. */
  const insertIgnoring = async (row: unknown): Promise<void> => {
    let result;
    try {
      result = await client.from('games').upsert(row, { onConflict: 'id', ignoreDuplicates: true });
    } catch (error) {
      throw networkError(error);
    }
    if (result.error) throw fail(result.error);
  };

  const updated = (result: QueryResult): boolean =>
    Array.isArray(result.data) && result.data.length > 0;

  return {
    finish: async (record) => {
      const row = recordToRow(record);
      const result = await run(
        client
          .from('games')
          .update({
            status: row.status,
            lasers_count: row.lasers_count,
            probes_count: row.probes_count,
            ended_at: row.ended_at,
            duration_s: row.duration_s,
            shots: row.shots,
            submission: row.submission,
            snapshot: null,
          })
          .eq('id', row.id)
          // Seule une partie encore en cours peut être terminée (la base le garantit aussi).
          .eq('status', 'playing')
          .select('id'),
      );
      if (result.error) throw fail(result.error);
      if (!updated(result)) await insertIgnoring({ ...row, snapshot: null });
    },

    saveProgress: async (progress) => {
      const result = await run(
        client
          .from('games')
          .update(progressToPatch(progress))
          .eq('id', progress.id)
          .eq('status', 'playing')
          .select('id'),
      );
      if (result.error) throw fail(result.error);
      if (!updated(result)) await insertIgnoring(progressToRow(progress));
    },

    listPlaying: async () => {
      const result = await run(
        client
          .from('games')
          .select('id,seed,extensions,lasers_count,probes_count,duration_s,started_at,updated_at')
          .eq('status', 'playing')
          .order('updated_at', { ascending: false })
          .limit(50),
      );
      if (result.error) throw new GamesError(result.error.message, false);
      const rows = Array.isArray(result.data) ? (result.data as unknown[]) : [];
      return rows.map(parsePlayingSummary).filter((game): game is PlayingSummary => game !== null);
    },

    loadPlaying: async (id) => {
      const result = await run(
        client
          .from('games')
          .select('snapshot,updated_at')
          .eq('id', id)
          .eq('status', 'playing')
          .limit(1),
      );
      if (result.error) throw new GamesError(result.error.message, false);
      const row = Array.isArray(result.data) ? (result.data[0] as unknown) : null;
      if (typeof row !== 'object' || row === null) return null;
      const { snapshot, updated_at: updatedAt } = row as Record<string, unknown>;
      const save = parseProgressSnapshot(snapshot);
      if (save === null || typeof updatedAt !== 'string') {
        throw new GamesError('Partie illisible', false);
      }
      return { save, updatedAt };
    },

    abandonPlaying: async (id, startedAt) => {
      // La fin ne peut pas précéder le début (l'horloge de cet appareil peut retarder sur l'autre).
      const endedAt = new Date(Math.max(Date.now(), Date.parse(startedAt) || 0)).toISOString();
      const result = await run(
        client
          .from('games')
          .update({ status: 'abandoned', snapshot: null, ended_at: endedAt, submission: null })
          .eq('id', id)
          .eq('status', 'playing')
          .select('id'),
      );
      if (result.error) throw fail(result.error);
    },

    list: async (query) => {
      let request = client
        .from('games')
        .select('*', { count: 'exact' })
        .in('status', statusesFor(query.filter));
      if (query.sort === 'shots') {
        request = request.order('shots_count', { ascending: true });
        request = request.order('ended_at', { ascending: false });
      } else {
        request = request.order('ended_at', { ascending: query.sort === 'oldest' });
      }
      // `id` départage deux parties de même date : l'ordre reste stable d'une page à l'autre.
      request = request.order('id', { ascending: true });
      const [from, to] = pageRange(query.page, query.pageSize);
      const result = await run(request.range(from, to));
      if (result.error) throw new GamesError(result.error.message, false);
      const rows = Array.isArray(result.data) ? (result.data as unknown[]) : [];
      const games = rows.map(parseRow).filter((game): game is GameRecord => game !== null);
      return { games, total: result.count ?? games.length };
    },

    stats: async () => {
      let result;
      try {
        result = await client.rpc('profile_stats');
      } catch (error) {
        throw networkError(error);
      }
      if (result.error) throw new GamesError(result.error.message, false);
      const stats = parseStats(result.data);
      if (stats === null) throw new GamesError('Statistiques illisibles', false);
      return stats;
    },
  };
}
