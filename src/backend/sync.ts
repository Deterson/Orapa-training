/**
 * Synchronisation des parties en cours avec le serveur. L'interface signale souvent que la partie a
 * changé (à chaque affichage) : ce module n'envoie que la dernière version de chaque partie, au plus
 * une fois par `delayMs`, et seulement si elle a vraiment changé (le temps qui passe seul ne compte
 * pas). En cas de coupure il réessaie avec des délais croissants ; un refus définitif de la base
 * abandonne la partie concernée (et prévient l'interface).
 */
import type { ProgressRecord } from '../game/record';
import { type GamesService, GamesError } from './games';

export interface ProgressSyncOptions {
  /** Délai entre deux envois d'une même partie (par défaut 8 s). */
  delayMs?: number;
  /** Délai maximal entre deux nouvelles tentatives après une coupure (par défaut 5 min). */
  maxRetryMs?: number;
  /** Appelé quand la base refuse définitivement une partie : elle ne sera plus synchronisée. */
  onRejected?: (id: string, error: GamesError) => void;
  /** Minuterie, remplaçable dans les tests. */
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface ProgressSync {
  /** Signale la dernière version d'une partie en cours ; la toute première est envoyée tout de suite. */
  push(progress: ProgressRecord): void;
  /** Envoie tout de suite ce qui attend ; résolu quand c'est fait (ou échoué : voir `pending`). */
  flush(): Promise<void>;
  /** Parties en attente d'envoi. */
  pending(): string[];
  /** Oublie une partie (terminée, ou compte changé) : rien ne sera plus envoyé pour elle. */
  forget(id: string): void;
  /** Oublie tout (changement de compte). */
  reset(): void;
}

/** Ce qui compte comme un changement : tout, sauf l'heure de sauvegarde et le temps écoulé. */
export function changeKey(progress: ProgressRecord): string {
  const { snapshot } = progress;
  return JSON.stringify({
    ...progress,
    durationS: 0,
    snapshot: { ...snapshot, savedAt: 0, session: { ...snapshot.session, elapsedMs: 0 } },
  });
}

export function createProgressSync(
  games: Pick<GamesService, 'saveProgress'>,
  {
    delayMs = 8000,
    maxRetryMs = 300_000,
    onRejected,
    setTimer = (callback, ms) => setTimeout(callback, ms),
    clearTimer = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  }: ProgressSyncOptions = {},
): ProgressSync {
  /** Dernière version de chaque partie, tant qu'elle n'est pas envoyée. */
  const waiting = new Map<string, ProgressRecord>();
  /** Dernière version envoyée de chaque partie (clé de changement). */
  const sent = new Map<string, string>();
  let timer: unknown = null;
  let retryMs = delayMs;
  let running: Promise<void> | null = null;
  let again = false;

  const schedule = (ms: number): void => {
    if (timer !== null) return;
    timer = setTimer(() => {
      timer = null;
      void run();
    }, ms);
  };

  const sendAll = async (): Promise<void> => {
    let failed = false;
    for (const [id, progress] of [...waiting]) {
      const key = changeKey(progress);
      if (sent.get(id) === key) {
        if (waiting.get(id) === progress) waiting.delete(id);
        continue;
      }
      try {
        await games.saveProgress(progress);
      } catch (error) {
        if (error instanceof GamesError && error.permanent) {
          waiting.delete(id);
          sent.delete(id);
          onRejected?.(id, error);
          continue;
        }
        failed = true;
        continue;
      }
      // Une version plus récente a pu arriver pendant l'envoi : elle reste en attente.
      sent.set(id, key);
      if (waiting.get(id) === progress) waiting.delete(id);
    }
    if (failed) {
      schedule(retryMs);
      retryMs = Math.min(retryMs * 2, maxRetryMs);
    } else {
      retryMs = delayMs;
      // Une version plus récente est arrivée pendant l'envoi : on la programme.
      if (waiting.size > 0) schedule(delayMs);
    }
  };

  const run = (): Promise<void> => {
    // Un seul envoi à la fois ; une demande arrivée pendant l'envoi relance un tour ensuite.
    if (running) {
      again = true;
      return running;
    }
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
    running = (async () => {
      do {
        again = false;
        await sendAll();
      } while (again);
    })().finally(() => {
      running = null;
    });
    return running;
  };

  return {
    push: (progress) => {
      const first = !sent.has(progress.id) && !waiting.has(progress.id);
      waiting.set(progress.id, progress);
      if (first) void run();
      else schedule(delayMs);
    },
    flush: () => (waiting.size === 0 && !running ? Promise.resolve() : run()),
    pending: () => [...waiting.keys()],
    forget: (id) => {
      waiting.delete(id);
      sent.delete(id);
    },
    reset: () => {
      waiting.clear();
      sent.clear();
      retryMs = delayMs;
      if (timer !== null) {
        clearTimer(timer);
        timer = null;
      }
    },
  };
}
