/**
 * Accès à la table `games` (voir supabase/migrations). Le service est derrière une interface pour
 * que la file d'envoi et l'interface se testent sans réseau.
 */
import {
  type FinishedStatus,
  type GameRecord,
  type ProfileStats,
  parseRow,
  parseStats,
  recordToRow,
} from '../game/record';

export type HistoryFilter = 'all' | 'won' | 'lost';
export type HistorySort = 'recent' | 'oldest' | 'lasers';

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

export interface GamesService {
  /** Enregistre une partie. Idempotent : renvoyer la même partie ne crée pas de doublon. */
  insert(record: GameRecord): Promise<void>;
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

export function statusesFor(filter: HistoryFilter): FinishedStatus[] | null {
  switch (filter) {
    case 'won':
      return ['won'];
    case 'lost':
      return ['lost', 'abandoned'];
    default:
      return null;
  }
}

/** Bornes (incluses) de la page demandée, pour `range`. */
export function pageRange(page: number, pageSize: number): [number, number] {
  const from = Math.max(0, page) * pageSize;
  return [from, from + pageSize - 1];
}

type QueryResult = {
  data: unknown;
  count?: number | null;
  error: { message: string; code?: string } | null;
};

/** La partie du constructeur de requêtes Supabase utilisée ici (remplaçable dans les tests). */
export interface GamesQuery extends PromiseLike<QueryResult> {
  in(column: string, values: readonly string[]): GamesQuery;
  order(column: string, options?: { ascending?: boolean }): GamesQuery;
  range(from: number, to: number): GamesQuery;
}

export interface GamesClientLike {
  from(table: 'games'): {
    upsert(
      row: unknown,
      options: { onConflict: string; ignoreDuplicates: boolean },
    ): PromiseLike<{ error: { message: string; code?: string } | null }>;
    select(columns: string, options: { count: 'exact' }): GamesQuery;
  };
  rpc(
    fn: 'profile_stats',
  ): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
}

export function createGamesService(client: GamesClientLike): GamesService {
  return {
    insert: async (record) => {
      let result;
      try {
        // `ignoreDuplicates` : si la partie est déjà enregistrée (renvoi après une coupure), rien ne change.
        result = await client
          .from('games')
          .upsert(recordToRow(record), { onConflict: 'id', ignoreDuplicates: true });
      } catch (error) {
        throw new GamesError(error instanceof Error ? error.message : 'Réseau indisponible', false);
      }
      if (result.error) {
        throw new GamesError(result.error.message, isPermanentCode(result.error.code));
      }
    },

    list: async (query) => {
      let request = client.from('games').select('*', { count: 'exact' });
      const statuses = statusesFor(query.filter);
      if (statuses) request = request.in('status', statuses);
      if (query.sort === 'lasers') {
        request = request.order('lasers_count', { ascending: true });
        request = request.order('ended_at', { ascending: false });
      } else {
        request = request.order('ended_at', { ascending: query.sort === 'oldest' });
      }
      // `id` départage deux parties de même date : l'ordre reste stable d'une page à l'autre.
      request = request.order('id', { ascending: true });
      const [from, to] = pageRange(query.page, query.pageSize);
      let result: QueryResult;
      try {
        result = await request.range(from, to);
      } catch (error) {
        throw new GamesError(error instanceof Error ? error.message : 'Réseau indisponible', false);
      }
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
        throw new GamesError(error instanceof Error ? error.message : 'Réseau indisponible', false);
      }
      if (result.error) throw new GamesError(result.error.message, false);
      const stats = parseStats(result.data);
      if (stats === null) throw new GamesError('Statistiques illisibles', false);
      return stats;
    },
  };
}
