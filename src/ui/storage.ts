/**
 * Accès à la sauvegarde locale. Tout est protégé par try/catch : navigation privée, stockage
 * plein ou désactivé, données corrompues… dans tous les cas le jeu continue sans sauvegarde.
 */
import { type DuelSaveData, parseDuelSave } from '../game/duelSave';
import { type SaveData, parseSave } from '../game/save';

/** Clé du navigateur. Le numéro de version du format est dans les données, pas dans la clé. */
export const SAVE_KEY = 'orapa-training:save';
/** Clé du duel en cours (une partie de duel à la fois, indépendante de la partie d'entraînement). */
export const DUEL_SAVE_KEY = 'orapa-training:duel';

type Backend = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface SaveStore<T = SaveData> {
  /** Vrai si le navigateur accepte d'écrire (faux en navigation privée stricte, par exemple). */
  readonly available: boolean;
  /** La sauvegarde valide, ou null (absente, illisible, ancienne ou modifiée). */
  load(): T | null;
  /** Renvoie faux si l'écriture a échoué. */
  save(data: T): boolean;
  clear(): void;
}

function createStore<T>(
  key: string,
  parse: (raw: unknown) => T | null,
  backend: Backend | null,
): SaveStore<T> {
  const attempt = <R>(action: (storage: Backend) => R, fallback: R): R => {
    if (backend === null) return fallback;
    try {
      return action(backend);
    } catch {
      return fallback;
    }
  };

  const available = attempt((storage) => {
    const probe = `${key}:probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return true;
  }, false);

  return {
    available,
    load: () =>
      attempt((storage) => {
        const text = storage.getItem(key);
        if (text === null) return null;
        let decoded: unknown = null;
        try {
          decoded = JSON.parse(text);
        } catch {
          // Texte qui n'est pas du JSON : traité comme une sauvegarde invalide, ci-dessous.
        }
        const data = parse(decoded);
        // Une sauvegarde illisible ne sert plus à rien : on la supprime pour ne pas la reproposer.
        if (data === null) storage.removeItem(key);
        return data;
      }, null),
    save: (data) =>
      attempt((storage) => {
        storage.setItem(key, JSON.stringify(data));
        return true;
      }, false),
    clear: () => attempt((storage) => storage.removeItem(key), undefined),
  };
}

export function createSaveStore(backend: Backend | null): SaveStore {
  return createStore(SAVE_KEY, parseSave, backend);
}

export function createDuelStore(backend: Backend | null): SaveStore<DuelSaveData> {
  return createStore(DUEL_SAVE_KEY, parseDuelSave, backend);
}

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    // Même lire window.localStorage peut lever une exception (cookies bloqués).
    return null;
  }
}

/** La sauvegarde dans le localStorage du navigateur. */
export function browserSaveStore(): SaveStore {
  return createSaveStore(browserStorage());
}

/** La sauvegarde du duel dans le localStorage du navigateur. */
export function browserDuelStore(): SaveStore<DuelSaveData> {
  return createDuelStore(browserStorage());
}
