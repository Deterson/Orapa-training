/**
 * Une partie en cours. Elle garde la mine cachée et ne laisse sortir que ce qu'un joueur a le droit
 * de savoir : le résultat de chaque tir (point de sortie et couleur), jamais le trajet du rayon
 * ni la position des gemmes. L'interface ne manipule que cet objet. Source : CLAUDE.md.
 */
import { parseEntryLabel } from './board';
import type { ResultColor } from './colors';
import { type Mine, generateMine } from './generate';
import { shoot } from './laser';

/** Résultat annoncé d'un tir. */
export interface ShotRecord {
  /** Numéro du tir, à partir de 1. */
  n: number;
  entry: string;
  exit: string;
  color: ResultColor;
}

export class GameSession {
  readonly seed: string;
  /** Champ privé du langage : invisible pour JSON.stringify, les boucles et l'interface. */
  readonly #mine: Mine;
  #shots: ShotRecord[] = [];

  constructor(mine: Mine) {
    this.#mine = mine;
    this.seed = mine.seed;
  }

  /** Nouvelle partie : génère la mine de cette graine (quelques dixièmes de seconde). */
  static start(seed: string): GameSession {
    return new GameSession(generateMine(seed));
  }

  /** Tirs effectués, dans l'ordre. */
  get shots(): readonly ShotRecord[] {
    return this.#shots;
  }

  /** Nombre de lasers tirés : ne diminue jamais. */
  get laserCount(): number {
    return this.#shots.length;
  }

  /**
   * Tire un laser depuis ce repère. Redemander un repère déjà tiré renvoie la réponse déjà donnée
   * sans compter un nouveau tir : le livret autorise de redemander une réponse gratuitement.
   */
  fire(label: string): ShotRecord {
    const entry = parseEntryLabel(label);
    if (entry === null) {
      throw new Error(`Point d'entrée inconnu : « ${label} »`);
    }
    const already = this.#shots.find((shot) => shot.entry === entry.label);
    if (already) return already;

    const { exit, color } = shoot(this.#mine.placements, entry);
    const record: ShotRecord = { n: this.#shots.length + 1, entry: entry.label, exit, color };
    this.#shots.push(record);
    return record;
  }
}
