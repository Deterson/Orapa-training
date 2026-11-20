/**
 * Le duel : deux plateaux cachés, une liste de questions par camp (laser ou sonde) et la règle de fin
 * du jeu à deux joueurs. Logique pure, sans DOM. La machine joue le maître du jeu pour les deux côtés :
 * chaque camp ne reçoit que les réponses à ses propres questions.
 *
 * Structure : chaque camp cherche le plateau de l'autre dans une `GameSession` (mine = plateau adverse,
 * champ privé). Le camp `player` est l'humain, le camp `ai` la machine ; l'interface ne manipule que
 * `playerSession`, et l'IA ne reçoit que `knowledge('ai')` (voir `ai/`).
 *
 * Règle de fin (livret, voir docs/regles.md) : tours alternés, un tour = une question (laser ou sonde)
 * ou une proposition. Une proposition fausse fait perdre aussitôt. Une proposition juste gagne, sauf si
 * son auteur jouait en premier : l'autre, qui a joué un tour de moins, a alors un dernier tour (une
 * proposition) ; s'il réussit aussi, c'est une égalité.
 */
import { cellLabel, parseCell } from './board';
import { type Mine, GENERATOR_VERSION, generateMine } from './generate';
import { type Extensions, type GemId, type Placement, NO_EXTENSIONS, gemsFor } from './gems';
import { createRng } from './rng';
import {
  GameSession,
  type ProbeRecord,
  type SessionOptions,
  type SessionSnapshot,
  type ShotRecord,
} from './session';
import { validatePlacements } from './placement';
import { isVisible } from './visibility';

export type Camp = 'player' | 'ai';

/** Niveaux de l'IA (voir `ai/levels.ts`). */
export type AiLevel = 'beginner' | 'intermediate' | 'expert';
export const AI_LEVELS: readonly AiLevel[] = ['beginner', 'intermediate', 'expert'];

/**
 * Règles du duel, en constantes pour pouvoir les assouplir. Le nombre de propositions par camp est
 * `MAX_ATTEMPTS` (session.ts).
 */
export const DUEL_RULES = {
  /** Si celui qui joue en premier propose juste, l'autre a un dernier tour. */
  lastTurn: true,
} as const;

/** Issue du duel, du point de vue du joueur. */
export type DuelStatus = 'playing' | 'won' | 'lost' | 'draw';

export type Question = { kind: 'fire'; label: string } | { kind: 'probe'; label: string };

/** Ce qu'un camp a le droit de savoir : les réponses à ses propres questions, jamais le plateau adverse. */
export interface Knowledge {
  /** Les gemmes de la partie : chaque joueur les connaît. */
  gems: readonly GemId[];
  shots: readonly ShotRecord[];
  probes: readonly ProbeRecord[];
  /** Dernier tour : ce camp ne peut plus que proposer. */
  lastTurn: boolean;
}

export interface DuelSnapshot {
  version: 1;
  seed: string;
  level: AiLevel;
  /** Camp qui joue en premier. */
  first: Camp;
  turn: Camp;
  phase: 'playing' | 'lastTurn' | 'over';
  /** Camp dont la proposition juste a ouvert le dernier tour de l'autre. */
  solver: Camp | null;
  winner: Camp | 'draw' | null;
  /** Dernière proposition de chaque camp (pour l'écran de résultat). */
  guesses: Record<Camp, Placement[] | null>;
  /** Le joueur cherche le plateau de l'IA : la mine de cette session est celui de l'IA. */
  player: SessionSnapshot;
  /** L'IA cherche le plateau du joueur : la mine de cette session est celui du joueur. */
  ai: SessionSnapshot;
}

export interface DuelSetup {
  seed: string;
  extensions?: Readonly<Extensions>;
  level: AiLevel;
  /** Plateau du joueur (règles a à e respectées, mêmes gemmes que la partie). */
  playerBoard: readonly Placement[];
  /** Plateau de l'IA ; par défaut tiré de la graine. */
  aiBoard?: readonly Placement[];
  /** Camp qui joue en premier ; par défaut tiré de la graine. */
  first?: Camp;
}

function other(side: Camp): Camp {
  return side === 'player' ? 'ai' : 'player';
}

function mineOf(seed: string, placements: readonly Placement[]): Mine {
  return { seed, generatorVersion: GENERATOR_VERSION, placements: [...placements] };
}

/** Vrai si ce plateau est jouable avec exactement ces gemmes (règles a à e). */
export function isValidBoard(placements: readonly Placement[], gems: readonly GemId[]): boolean {
  const ids = placements.map((placement) => placement.gem);
  return (
    ids.length === gems.length &&
    gems.every((gem) => ids.includes(gem)) &&
    validatePlacements(placements).length === 0 &&
    isVisible(placements)
  );
}

/** Qui joue en premier pour cette graine : tiré à pile ou face, rejouable. */
export function firstPlayerOf(seed: string): Camp {
  return createRng(`${seed}/premier`).next() < 0.5 ? 'player' : 'ai';
}

export class Duel {
  readonly seed: string;
  readonly level: AiLevel;
  readonly first: Camp;
  readonly #sessions: Record<Camp, GameSession>;
  #turn: Camp;
  #phase: 'playing' | 'lastTurn' | 'over' = 'playing';
  #solver: Camp | null = null;
  #winner: Camp | 'draw' | null = null;
  #guesses: Record<Camp, Placement[] | null> = { player: null, ai: null };

  private constructor(
    seed: string,
    level: AiLevel,
    first: Camp,
    sessions: Record<Camp, GameSession>,
    turn: Camp,
  ) {
    this.seed = seed;
    this.level = level;
    this.first = first;
    this.#sessions = sessions;
    this.#turn = turn;
  }

  /** Nouveau duel : le plateau de l'IA et le camp qui commence viennent de la graine. */
  static start(setup: DuelSetup, options: SessionOptions = {}): Duel {
    const extensions = setup.extensions ?? NO_EXTENSIONS;
    const gems = gemsFor(extensions);
    if (!isValidBoard(setup.playerBoard, gems)) {
      throw new Error(
        'Plateau du joueur invalide : toutes les gemmes, bien placées (règles a à e).',
      );
    }
    const aiBoard = setup.aiBoard ?? generateMine(setup.seed, extensions).placements;
    if (!isValidBoard(aiBoard, gems)) throw new Error("Plateau de l'IA invalide.");
    const first = setup.first ?? firstPlayerOf(setup.seed);
    return new Duel(
      setup.seed,
      setup.level,
      first,
      {
        // Le joueur cherche le plateau de l'IA, et l'IA celui du joueur.
        player: new GameSession(mineOf(setup.seed, aiBoard), options),
        ai: new GameSession(mineOf(setup.seed, setup.playerBoard), options),
      },
      first,
    );
  }

  /** Reprend un duel sauvegardé : les questions sont rejouées sur les plateaux. */
  static fromSnapshot(snapshot: DuelSnapshot, options: SessionOptions = {}): Duel {
    const duel = new Duel(
      snapshot.seed,
      snapshot.level,
      snapshot.first,
      {
        player: GameSession.fromSnapshot(snapshot.player, options),
        ai: GameSession.fromSnapshot(snapshot.ai, options),
      },
      snapshot.turn,
    );
    duel.#phase = snapshot.phase;
    duel.#solver = snapshot.solver;
    duel.#winner = snapshot.winner;
    duel.#guesses = { player: snapshot.guesses.player, ai: snapshot.guesses.ai };
    return duel;
  }

  /** Instantané pour la sauvegarde locale : contient les deux plateaux, à ne pas montrer à l'IA. */
  toSnapshot(): DuelSnapshot {
    return {
      version: 1,
      seed: this.seed,
      level: this.level,
      first: this.first,
      turn: this.#turn,
      phase: this.#phase,
      solver: this.#solver,
      winner: this.#winner,
      guesses: { player: this.#guesses.player, ai: this.#guesses.ai },
      player: this.#sessions.player.toSnapshot(),
      ai: this.#sessions.ai.toSnapshot(),
    };
  }

  /** La partie du joueur : il y cherche le plateau de l'IA (tirs, sondes, proposition). */
  get playerSession(): GameSession {
    return this.#sessions.player;
  }

  /** Le plateau du joueur : il le connaît (c'est lui qui l'a posé) ; l'IA, elle, ne le voit jamais. */
  get ownBoard(): readonly Placement[] {
    return this.#sessions.ai.toSnapshot().mine.placements;
  }

  /** Les gemmes de la partie. */
  get gems(): readonly GemId[] {
    return this.#sessions.player.gems;
  }

  /** Les questions de l'IA et leurs réponses : le joueur les voit passer, elles se marquent sur son plateau. */
  get aiQuestions(): { shots: readonly ShotRecord[]; probes: readonly ProbeRecord[] } {
    const session = this.#sessions.ai;
    return { shots: session.shots, probes: session.probes };
  }

  /** À qui de jouer ; pendant le dernier tour, le camp qui a le droit de proposer. */
  get turn(): Camp {
    return this.#turn;
  }

  get over(): boolean {
    return this.#phase === 'over';
  }

  /** Dernier tour en cours : le camp dont c'est le tour ne peut plus que proposer. */
  get lastTurnOf(): Camp | null {
    return this.#phase === 'lastTurn' ? this.#turn : null;
  }

  /** Issue du duel, du point de vue du joueur. */
  get status(): DuelStatus {
    if (this.#winner === null) return 'playing';
    if (this.#winner === 'draw') return 'draw';
    return this.#winner === 'player' ? 'won' : 'lost';
  }

  /** Ce que ce camp sait : les réponses à ses questions seulement (voir `Knowledge`). */
  knowledge(side: Camp): Knowledge {
    const session = this.#sessions[side];
    return {
      gems: [...session.gems],
      shots: session.shots.map((shot) => ({ ...shot })),
      probes: session.probes.map((probe) => ({ ...probe })),
      lastTurn: this.lastTurnOf === side,
    };
  }

  #assertTurn(side: Camp): void {
    if (this.over) throw new Error('Le duel est terminé.');
    if (this.#turn !== side) throw new Error("Ce n'est pas son tour.");
  }

  /**
   * Pose une question. Une question déjà posée (ou un tir inverse d'un tir fait) est gratuite : elle renvoie
   * la même réponse et le tour ne passe pas. Une question nouvelle passe la main à l'autre camp.
   */
  ask(side: Camp, question: Question): ShotRecord | ProbeRecord {
    this.#assertTurn(side);
    if (this.#phase === 'lastTurn') throw new Error('Dernier tour : proposez.');
    const session = this.#sessions[side];
    const before = session.shotCount;
    let record: ShotRecord | ProbeRecord;
    if (question.kind === 'fire') {
      record = session.fire(question.label);
    } else {
      const cell = parseCell(question.label);
      if (cell === null) throw new Error(`Case inconnue : « ${question.label} »`);
      record = session.probe(cellLabel(cell));
    }
    if (session.shotCount > before) this.#turn = other(side);
    return record;
  }

  /** Vrai si cette question ne coûterait rien (déjà posée) : le tour ne passerait pas. */
  isFree(side: Camp, question: Question): boolean {
    const session = this.#sessions[side];
    if (question.kind === 'probe') {
      const cell = parseCell(question.label);
      return cell !== null && session.probes.some((probe) => probe.cell === cellLabel(cell));
    }
    return session.shots.some(
      (shot) => shot.entry === question.label || shot.exit === question.label,
    );
  }

  /** Propose un plateau. Voir la règle de fin en tête de fichier. Renvoie vrai si la proposition est juste. */
  propose(side: Camp, guess: readonly Placement[]): boolean {
    this.#assertTurn(side);
    const session = this.#sessions[side];
    this.#guesses[side] = [...guess];
    const result = session.submit(guess);

    if (this.#phase === 'lastTurn') {
      // Dernier tour : réussir égalise, rater laisse la victoire à celui qui avait trouvé.
      this.#end(result.correct ? 'draw' : other(side));
      return result.correct;
    }
    if (result.correct) {
      if (DUEL_RULES.lastTurn && side === this.first) {
        this.#phase = 'lastTurn';
        this.#solver = side;
        this.#turn = other(side);
      } else {
        this.#end(side);
      }
    } else if (session.finished) {
      this.#end(other(side));
    } else {
      // Plusieurs propositions autorisées (MAX_ATTEMPTS > 1) : la main passe.
      this.#turn = other(side);
    }
    return result.correct;
  }

  #end(winner: Camp | 'draw'): void {
    this.#phase = 'over';
    this.#winner = winner;
    for (const side of ['player', 'ai'] as const) {
      const won = winner === 'draw' || winner === side;
      this.#sessions[side].conclude(won ? 'won' : 'lost');
    }
  }

  /** Les deux plateaux, à la fin du duel seulement. */
  reveal(): {
    player: readonly Placement[];
    ai: readonly Placement[];
    guesses: Record<Camp, readonly Placement[] | null>;
  } {
    if (!this.over) throw new Error('Les plateaux ne se révèlent qu’à la fin du duel.');
    return {
      // La session de l'IA cherche le plateau du joueur, et inversement.
      player: this.#sessions.ai.reveal(),
      ai: this.#sessions.player.reveal(),
      guesses: { player: this.#guesses.player, ai: this.#guesses.ai },
    };
  }
}
