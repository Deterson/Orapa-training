/**
 * Accès à l'IA depuis l'interface : un Web Worker quand le navigateur en offre un (le calcul ne bloque
 * jamais l'écran), sinon le même calcul dans la page, avec un budget réduit pour rester fluide.
 * Dans les deux cas l'IA ne reçoit que `Knowledge` : les réponses à ses propres questions.
 */
import { AiPlayer, type AiMove } from '../game/ai/player';
import type { AiLevel, Knowledge } from '../game/duel';
import type { GemId } from '../game/gems';
import type { WorkerRequest } from './aiWorker';

export interface AiDecision {
  move: AiMove;
  /** Délai de réflexion à laisser paraître, en ms (rythme humain). */
  delay: number;
}

export interface AiClient {
  /** Le prochain coup de l'IA pour ce qu'elle sait. Rejeté si le client est arrêté entre-temps. */
  decide(knowledge: Knowledge): Promise<AiDecision>;
  /** Arrête le calcul et libère le worker. */
  dispose(): void;
}

export interface AiClientOptions {
  level: AiLevel;
  seed: string;
  gems: readonly GemId[];
  /** Faux : calcul dans la page (tests, navigateurs sans Worker). Par défaut : Worker si disponible. */
  worker?: boolean;
}

/** Calcul dans la page : le coup est calculé après la fin de la tâche en cours, pour laisser l'écran respirer. */
function inPageClient({ level, seed, gems }: AiClientOptions): AiClient {
  const ai = new AiPlayer(level, seed, gems);
  let disposed = false;
  return {
    decide: (knowledge) =>
      new Promise((resolve, reject) => {
        setTimeout(() => {
          if (disposed) return reject(new Error('IA arrêtée'));
          try {
            resolve({ move: ai.decide(knowledge), delay: ai.thinkingDelay() });
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        }, 0);
      }),
    dispose: () => {
      disposed = true;
    },
  };
}

function workerClient(options: AiClientOptions, worker: Worker): AiClient {
  const pending = new Map<
    number,
    { resolve: (decision: AiDecision) => void; reject: (error: Error) => void }
  >();
  let next = 0;
  let fallback: AiClient | null = null;

  /** Le worker a échoué (script bloqué, erreur) : on continue dans la page. */
  const fail = (error: Error): void => {
    worker.terminate();
    fallback = inPageClient(options);
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };

  worker.onmessage = (
    event: MessageEvent<{ id: number; move?: AiMove; delay?: number; error?: string }>,
  ) => {
    const { id, move, delay, error } = event.data;
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);
    if (error !== undefined || move === undefined)
      request.reject(new Error(error ?? 'Réponse vide'));
    else request.resolve({ move, delay: delay ?? 0 });
  };
  worker.onerror = () => fail(new Error('Worker en erreur'));
  const init: WorkerRequest = {
    type: 'init',
    level: options.level,
    seed: options.seed,
    gems: [...options.gems],
  };
  worker.postMessage(init);

  return {
    decide: (knowledge) => {
      if (fallback) return fallback.decide(knowledge);
      return new Promise((resolve, reject) => {
        const id = next++;
        pending.set(id, { resolve, reject });
        const request: WorkerRequest = { type: 'decide', id, knowledge };
        worker.postMessage(request);
      }).catch((error: unknown) => {
        // Le worker est tombé pendant le calcul : on refait ce coup dans la page.
        if (fallback) return fallback.decide(knowledge);
        throw error;
      }) as Promise<AiDecision>;
    },
    dispose: () => {
      worker.terminate();
      fallback?.dispose();
      for (const request of pending.values()) request.reject(new Error('IA arrêtée'));
      pending.clear();
    },
  };
}

export function createAiClient(options: AiClientOptions): AiClient {
  const useWorker = options.worker ?? typeof Worker !== 'undefined';
  if (useWorker) {
    try {
      const worker = new Worker(new URL('./aiWorker.ts', import.meta.url), { type: 'module' });
      return workerClient(options, worker);
    } catch {
      // Pas de Worker (ou script refusé) : le calcul se fait dans la page.
    }
  }
  return inPageClient(options);
}
