/**
 * Accès à la sauvegarde locale. Tout est protégé par try/catch : navigation privée, stockage
 * plein ou désactivé, données corrompues… dans tous les cas le jeu continue sans sauvegarde.
 */
import { type SaveData, parseSave } from '../game/save';

/** Clé du navigateur. Le numéro de version du format est dans les données, pas dans la clé. */
export const SAVE_KEY = 'orapa-training:save';

type Backend = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface SaveStore {
  /** Vrai si le navigateur accepte d'écrire (faux en navigation privée stricte, par exemple). */
  readonly available: boolean;
  /** La sauvegarde valide, ou null (absente, illisible, ancienne ou modifiée). */
  load(): SaveData | null;
  /** Renvoie faux si l'écriture a échoué. */
  save(data: SaveData): boolean;
  clear(): void;
}

export function createSaveStore(backend: Backend | null): SaveStore {
  const attempt = <T>(action: (storage: Backend) => T, fallback: T): T => {
    if (backend === null) return fallback;
    try {
      return action(backend);
    } catch {
      return fallback;
    }
  };

  const available = attempt((storage) => {
    const probe = `${SAVE_KEY}:probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return true;
  }, false);

  return {
    available,
    load: () =>
      attempt((storage) => {
        const text = storage.getItem(SAVE_KEY);
        if (text === null) return null;
        let decoded: unknown = null;
        try {
          decoded = JSON.parse(text);
        } catch {
          // Texte qui n'est pas du JSON : traité comme une sauvegarde invalide, ci-dessous.
        }
        const data = parseSave(decoded);
        // Une sauvegarde illisible ne sert plus à rien : on la supprime pour ne pas la reproposer.
        if (data === null) storage.removeItem(SAVE_KEY);
        return data;
      }, null),
    save: (data) =>
      attempt((storage) => {
        storage.setItem(SAVE_KEY, JSON.stringify(data));
        return true;
      }, false),
    clear: () => attempt((storage) => storage.removeItem(SAVE_KEY), undefined),
  };
}

/** La sauvegarde dans le localStorage du navigateur. */
export function browserSaveStore(): SaveStore {
  try {
    return createSaveStore(window.localStorage);
  } catch {
    // Même lire window.localStorage peut lever une exception (cookies bloqués).
    return createSaveStore(null);
  }
}
