/**
 * File d'envoi des parties terminées : une partie est d'abord mise en file, dans le navigateur,
 * puis envoyée ; en cas de coupure elle reste en file et repart plus tard. Chaque entrée porte
 * l'identifiant de l'utilisateur qui jouait : sur un navigateur partagé, la partie de A ne part
 * jamais sous le compte de B.
 */
import { type GameRecord, parseRow, recordToRow } from '../game/record';
import { type GamesService, GamesError } from './games';

export const OUTBOX_KEY = 'orapa-training:outbox';
/** Au-delà, les plus anciennes entrées sont abandonnées (le navigateur n'est pas une base de données). */
export const OUTBOX_LIMIT = 50;

type Backend = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

interface Entry {
  userId: string;
  record: GameRecord;
}

export interface FlushResult {
  /** Parties envoyées pendant cet appel. */
  sent: number;
  /** Parties de cet utilisateur encore en file. */
  remaining: number;
  /** Vrai si un envoi a échoué pour une raison qui peut passer (réseau, session) : réessayer plus tard. */
  retry: boolean;
}

export interface Outbox {
  add(userId: string, record: GameRecord): void;
  /** Parties en attente pour cet utilisateur. */
  pending(userId: string): GameRecord[];
  has(userId: string, id: string): boolean;
  /** Oublie toutes les parties en attente de cet utilisateur (suppression du compte). */
  discard(userId: string): void;
  flush(userId: string, games: GamesService): Promise<FlushResult>;
}

export function createOutbox(backend: Backend | null): Outbox {
  // Copie en mémoire : si le stockage refuse d'écrire, la file fonctionne tout de même pour la session.
  let entries: Entry[] | null = null;

  const read = (): Entry[] => {
    if (entries) return entries;
    entries = [];
    try {
      const text = backend?.getItem(OUTBOX_KEY);
      const decoded: unknown = text ? JSON.parse(text) : [];
      if (Array.isArray(decoded)) {
        for (const item of decoded as unknown[]) {
          if (typeof item !== 'object' || item === null) continue;
          const { userId, record } = item as { userId?: unknown; record?: unknown };
          const parsed = parseRow(record);
          if (typeof userId === 'string' && userId && parsed)
            entries.push({ userId, record: parsed });
        }
      }
    } catch {
      // Contenu illisible ou stockage indisponible : file vide.
    }
    return entries;
  };

  const write = (): void => {
    try {
      if (!backend) return;
      const list = read();
      if (list.length === 0) backend.removeItem(OUTBOX_KEY);
      else {
        backend.setItem(
          OUTBOX_KEY,
          JSON.stringify(
            list.map(({ userId, record }) => ({ userId, record: recordToRow(record) })),
          ),
        );
      }
    } catch {
      // Plein ou interdit : on garde la copie en mémoire.
    }
  };

  const flushing = new Map<string, Promise<FlushResult>>();

  const pending = (userId: string): GameRecord[] =>
    read()
      .filter((entry) => entry.userId === userId)
      .map((entry) => entry.record);

  return {
    add: (userId, record) => {
      const list = read();
      if (list.some((entry) => entry.userId === userId && entry.record.id === record.id)) return;
      list.push({ userId, record });
      while (list.length > OUTBOX_LIMIT) list.shift();
      write();
    },
    pending,
    has: (userId, id) => pending(userId).some((record) => record.id === id),
    discard: (userId) => {
      const list = read();
      for (let i = list.length - 1; i >= 0; i--) if (list[i]?.userId === userId) list.splice(i, 1);
      write();
    },
    flush: (userId, games) => {
      // Un seul envoi à la fois : deux déclencheurs rapprochés ne doublent pas les requêtes.
      const running = flushing.get(userId);
      if (running) return running;
      const run = (async (): Promise<FlushResult> => {
        let sent = 0;
        let retry = false;
        for (const record of pending(userId)) {
          try {
            await games.finish(record);
            sent++;
          } catch (error) {
            // Refus définitif de la base : la partie ne passera jamais, on la retire de la file.
            if (!(error instanceof GamesError && error.permanent)) {
              retry = true;
              break;
            }
          }
          const list = read();
          const index = list.findIndex(
            (entry) => entry.userId === userId && entry.record.id === record.id,
          );
          if (index >= 0) list.splice(index, 1);
          write();
        }
        return { sent, remaining: pending(userId).length, retry };
      })().finally(() => {
        flushing.delete(userId);
      });
      flushing.set(userId, run);
      return run;
    },
  };
}

/** La file dans le localStorage du navigateur. */
export function browserOutbox(): Outbox {
  try {
    return createOutbox(window.localStorage);
  } catch {
    return createOutbox(null);
  }
}
