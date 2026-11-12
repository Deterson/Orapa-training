/**
 * Une partie en cours. Elle garde la mine cachée et ne laisse sortir que ce qu'un joueur a le droit
 * de savoir : le résultat de chaque tir (point de sortie et couleur), la réponse à chaque
 * sonde de case, jamais le trajet du rayon ni la position des gemmes avant la fin de la partie.
 * L'interface ne manipule que cet objet. Source : CLAUDE.md.
 */
import { type Cell, cellLabel, parseCell, parseEntryLabel } from './board';
import type { ResultColor } from './colors';
import { type Mine, generateMine } from './generate';
import type { Placement } from './gems';
import { shoot } from './laser';
import { type ProbeContent, probeCell } from './probe';
import { isCorrect } from './verify';

/**
 * Nombre de propositions autorisées. Une seule, comme le jeu officiel à deux joueurs : une
 * erreur fait perdre la partie. À augmenter pour un mode plus indulgent.
 */
export const MAX_ATTEMPTS = 1;

export type GameStatus = 'playing' | 'won' | 'lost' | 'abandoned';

/** Résultat annoncé d'un tir. */
export interface ShotRecord {
  /** Numéro du tir, à partir de 1. */
  n: number;
  entry: string;
  exit: string;
  color: ResultColor;
}

/** Réponse à une sonde de case. */
export interface ProbeRecord {
  n: number;
  /** Libellé de la case, par exemple « E4 ». */
  cell: string;
  content: ProbeContent;
}

export interface SubmitResult {
  correct: boolean;
  /** Propositions restantes ; 0 quand la partie est terminée. */
  attemptsLeft: number;
  status: GameStatus;
}

/** Bilan d'une partie terminée. */
export interface GameSummary {
  seed: string;
  status: GameStatus;
  lasers: number;
  probes: number;
  attempts: number;
  elapsedMs: number;
}

/**
 * Tout ce qu'il faut pour reprendre une partie. Contient la mine : à réserver à la sauvegarde,
 * l'interface ne doit pas s'en servir pour autre chose. Les tirs et sondes sont rejoués à la
 * restauration, ce qui garantit leur cohérence avec la mine.
 */
export interface SessionSnapshot {
  mine: Mine;
  /** Repères tirés, dans l'ordre. */
  shots: string[];
  /** Cases sondées, dans l'ordre. */
  probes: string[];
  attempts: number;
  status: GameStatus;
  elapsedMs: number;
}

export interface SessionOptions {
  /** Horloge, injectable pour les tests. */
  now?: () => number;
}

export class GameSession {
  readonly seed: string;
  /** Champ privé du langage : invisible pour JSON.stringify, les boucles et l'interface. */
  readonly #mine: Mine;
  readonly #now: () => number;
  #shots: ShotRecord[] = [];
  #probes: ProbeRecord[] = [];
  #status: GameStatus = 'playing';
  #attempts = 0;
  #elapsedBefore = 0;
  /** Début de la période de jeu en cours, ou null quand le chronomètre est en pause. */
  #resumedAt: number | null;
  #finishedAt: number | null = null;

  constructor(mine: Mine, { now = Date.now }: SessionOptions = {}) {
    this.#mine = mine;
    this.#now = now;
    this.#resumedAt = now();
    this.seed = mine.seed;
  }

  /** Nouvelle partie : génère la mine de cette graine (quelques dixièmes de seconde). */
  static start(seed: string): GameSession {
    return new GameSession(generateMine(seed));
  }

  /** Instantané pour la sauvegarde locale (voir SessionSnapshot). */
  toSnapshot(): SessionSnapshot {
    return {
      mine: this.#mine,
      shots: this.#shots.map((shot) => shot.entry),
      probes: this.#probes.map((probe) => probe.cell),
      attempts: this.#attempts,
      status: this.#status,
      elapsedMs: this.elapsedMs(),
    };
  }

  /** Reprend une partie sauvegardée : les tirs et sondes sont rejoués sur la mine. */
  static fromSnapshot(snapshot: SessionSnapshot, options: SessionOptions = {}): GameSession {
    const session = new GameSession(snapshot.mine, options);
    for (const entry of snapshot.shots) session.fire(entry);
    for (const cell of snapshot.probes) session.probe(cell);
    session.#attempts = snapshot.attempts;
    session.#elapsedBefore = snapshot.elapsedMs;
    session.#resumedAt = session.#now();
    if (snapshot.status !== 'playing') {
      session.pause();
      session.#status = snapshot.status;
      session.#finishedAt = session.#now();
    }
    return session;
  }

  get status(): GameStatus {
    return this.#status;
  }

  get finished(): boolean {
    return this.#status !== 'playing';
  }

  /** Tirs effectués, dans l'ordre. */
  get shots(): readonly ShotRecord[] {
    return this.#shots;
  }

  /** Sondes de case effectuées, dans l'ordre. */
  get probes(): readonly ProbeRecord[] {
    return this.#probes;
  }

  /** Nombre de lasers tirés : ne diminue jamais. */
  get laserCount(): number {
    return this.#shots.length;
  }

  get attempts(): number {
    return this.#attempts;
  }

  /** Temps de jeu écoulé, figé à la fin de la partie. */
  elapsedMs(): number {
    if (this.#resumedAt === null) return this.#elapsedBefore;
    const until = this.#finishedAt ?? this.#now();
    return this.#elapsedBefore + (until - this.#resumedAt);
  }

  /** Met le chronomètre en pause (règles ouvertes, page cachée). Sans effet une fois terminée. */
  pause(): void {
    if (this.#resumedAt === null || this.finished) return;
    this.#elapsedBefore += this.#now() - this.#resumedAt;
    this.#resumedAt = null;
  }

  /** Relance le chronomètre après une pause. */
  resume(): void {
    if (this.#resumedAt !== null || this.finished) return;
    this.#resumedAt = this.#now();
  }

  get summary(): GameSummary {
    return {
      seed: this.seed,
      status: this.#status,
      lasers: this.laserCount,
      probes: this.#probes.length,
      attempts: this.#attempts,
      elapsedMs: this.elapsedMs(),
    };
  }

  #assertPlaying(): void {
    if (this.finished) {
      throw new Error('La partie est terminée.');
    }
  }

  #finish(status: GameStatus): void {
    this.pause();
    this.#status = status;
    this.#finishedAt = this.#now();
  }

  /**
   * Tire un laser depuis ce repère. Redemander un repère déjà tiré renvoie la réponse déjà donnée
   * sans compter un nouveau tir : le livret autorise de redemander une réponse gratuitement.
   */
  fire(label: string): ShotRecord {
    this.#assertPlaying();
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

  /** « Qu'y a-t-il en E4 ? » Compté à part des lasers ; redemander une case est gratuit. */
  probe(label: string): ProbeRecord {
    this.#assertPlaying();
    const cell: Cell | null = parseCell(label);
    if (cell === null) {
      throw new Error(`Case inconnue : « ${label} »`);
    }
    const name = cellLabel(cell);
    const already = this.#probes.find((probe) => probe.cell === name);
    if (already) return already;

    const record: ProbeRecord = {
      n: this.#probes.length + 1,
      cell: name,
      content: probeCell(this.#mine.placements, cell),
    };
    this.#probes.push(record);
    return record;
  }

  /**
   * Soumet une proposition. Correcte : la partie est gagnée. Fausse : elle est perdue quand il
   * n'y a plus de proposition disponible (voir MAX_ATTEMPTS).
   */
  submit(guess: readonly Placement[]): SubmitResult {
    this.#assertPlaying();
    this.#attempts++;
    const correct = isCorrect(this.#mine.placements, guess);
    if (correct) {
      this.#finish('won');
    } else if (this.#attempts >= MAX_ATTEMPTS) {
      this.#finish('lost');
    }
    return {
      correct,
      attemptsLeft: this.finished ? 0 : MAX_ATTEMPTS - this.#attempts,
      status: this.#status,
    };
  }

  /** Renonce et révèle la mine. */
  abandon(): void {
    this.#assertPlaying();
    this.#finish('abandoned');
  }

  /** La vraie mine : réservée aux parties terminées. */
  reveal(): readonly Placement[] {
    if (!this.finished) {
      throw new Error("La mine ne se révèle qu'à la fin de la partie.");
    }
    return this.#mine.placements;
  }
}
