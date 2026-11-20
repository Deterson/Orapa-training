/**
 * Web Worker de l'IA : le calcul (plusieurs centaines de millisecondes aux niveaux élevés) ne bloque jamais
 * l'interface. Il ne reçoit que la liste des gemmes et les réponses aux questions de l'IA (`Knowledge`).
 */
import { AiPlayer } from '../game/ai/player';
import type { AiLevel, Knowledge } from '../game/duel';
import type { GemId } from '../game/gems';

export type WorkerRequest =
  | { type: 'init'; level: AiLevel; seed: string; gems: GemId[] }
  | { type: 'decide'; id: number; knowledge: Knowledge };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: unknown): void;
};

let ai: AiPlayer | null = null;

scope.onmessage = (event) => {
  const message = event.data;
  if (message.type === 'init') {
    ai = new AiPlayer(message.level, message.seed, message.gems);
    return;
  }
  if (ai === null) return;
  try {
    const move = ai.decide(message.knowledge);
    scope.postMessage({ id: message.id, move, delay: ai.thinkingDelay() });
  } catch (error) {
    scope.postMessage({ id: message.id, error: String(error) });
  }
};
