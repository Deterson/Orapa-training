/**
 * Solveur d'unicité. Source : CLAUDE.md (« Contrainte d'unicité »).
 *
 * Étant donné la signature d'une mine (le résultat des 36 tirs), cherche toutes les dispositions
 * valides (règles a à e) de l'ensemble de gemmes qui produisent exactement cette signature.
 * Une mine est « unique » quand la seule disposition trouvée est elle-même.
 *
 * Méthode : on « rejoue » les tirs de la signature l'un après l'autre en laissant les gemmes
 * inconnues apparaître au fil du rayon. À chaque segment de rayon, deux cas :
 *   - aucune gemme non posée n'est sur ce segment : on écarte toutes les poses qui le croisent ;
 *   - une gemme non posée est la première touchée : on la pose (une branche par pose possible),
 *     on écarte les poses des autres qui seraient touchées avant elle, puis on continue le rayon.
 * La couleur et le point de sortie annoncés par la signature coupent la plupart des branches :
 * les couleurs touchées doivent rester dans l'ensemble annoncé, et le rayon doit sortir au bon
 * endroit avec exactement ce mélange de couleurs.
 * Une disposition s'obtient ainsi d'une seule façon, donc on ne la compte qu'une fois.
 */
import { ENTRY_POINTS } from './board';
import { GRID_COLS, GRID_ROWS } from './constants';
import { colorMask, GEM_COLOR_BIT, isMixColor } from './colors';
import {
  BASE_GEM_IDS,
  GEM_SHAPES,
  type GemId,
  type Placement,
  distinctOrientations,
  orientedPolygon,
  placedPolygon,
} from './gems';
import { type Polygon, boundingBox, relation } from './geometry';
import {
  type Signature,
  type Vec,
  exitPointAt,
  findFirstHit,
  isAbsorbed,
  reflect,
  sameSignature,
  shootAll,
  signatureOf,
  startOf,
} from './laser';
import { isVisible } from './visibility';

export interface SolveOptions {
  /** Arrêt dès que ce nombre de solutions est trouvé (2 suffit pour tester l'unicité). */
  limit?: number;
  /** Garde-fou : nombre maximal de segments de rayon explorés avant d'abandonner. */
  maxNodes?: number;
}

export interface SolveResult {
  solutions: Placement[][];
  /** Faux si la recherche a été interrompue (limite de nœuds) : le résultat est alors partiel. */
  complete: boolean;
  nodes: number;
}

interface Candidate {
  placement: Placement;
  polygon: Polygon;
  /** Ce que la gemme fait au rayon : le colorer, le laisser tel quel (Diamant) ou l'absorber. */
  kind: 'mix' | 'clear' | 'black';
  /** Bit de sa couleur (0 pour le Diamant et le Corps noir). */
  bit: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Une gemme est soit à placer (liste de poses encore possibles), soit posée. */
interface State {
  domains: (readonly Candidate[] | null)[];
  placed: (Candidate | null)[];
}

/**
 * Tir qui n'a rien touché : transparent et sorti en face, comme sur un plateau vide. (Un tir
 * transparent mais dévié a touché le Diamant : il ne compte pas comme vide.)
 */
function emptyShots(signature: Signature): boolean[] {
  const straight = shootAll([]);
  return signature.map(
    (outcome, i) => outcome.color === 'transparent' && outcome.exit === straight[i]?.exit,
  );
}

/** Lignes et colonnes que traverse un tir non vide : bits 0-9 colonnes, 10-17 lignes. */
function occupiedLines(empty: readonly boolean[]): number {
  let mask = 0;
  ENTRY_POINTS.forEach((entry, i) => {
    if (empty[i]) return;
    const vertical = entry.side === 'top' || entry.side === 'bottom';
    mask |= 1 << (vertical ? entry.index : GRID_COLS + entry.index);
  });
  return mask;
}

/**
 * Poses d'une gemme qui ne croisent que des lignes occupées. Un polygone convexe croise
 * exactement les colonnes et les lignes de sa boîte englobante.
 */
function candidatesFor(gem: GemId, occupied: number): Candidate[] {
  const shape = GEM_SHAPES[gem];
  const result: Candidate[] = [];
  for (const orientation of distinctOrientations(shape)) {
    const box = boundingBox(orientedPolygon(shape, orientation));
    const width = box.maxX;
    const height = box.maxY;
    for (let col = 0; col + width <= GRID_COLS; col++) {
      for (let row = 0; row + height <= GRID_ROWS; row++) {
        const lines = (((1 << width) - 1) << col) | ((((1 << height) - 1) << row) << GRID_COLS);
        if ((lines & ~occupied) !== 0) continue;
        const placement: Placement = { gem, orientation, col, row };
        result.push({
          placement,
          polygon: placedPolygon(placement),
          kind: isMixColor(shape.color) ? 'mix' : shape.color,
          bit: isMixColor(shape.color) ? GEM_COLOR_BIT[shape.color] : 0,
          minX: col,
          maxX: col + width,
          minY: row,
          maxY: row + height,
        });
      }
    }
  }
  return result;
}

/** Deux poses sont compatibles si leurs gemmes ne se recouvrent pas et ne sont pas côte à côte. */
function compatible(a: Candidate, b: Candidate): boolean {
  if (a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY) return true;
  const contact = relation(a.polygon, b.polygon);
  return contact === 'apart' || contact === 'point';
}

function boundaryDistance(position: Vec, dir: Vec): number {
  if (dir[0] === 1) return GRID_COLS - position[0];
  if (dir[0] === -1) return position[0];
  return dir[1] === 1 ? GRID_ROWS - position[1] : position[1];
}

function popCount(mask: number): number {
  let count = 0;
  for (let m = mask; m > 0; m &= m - 1) count++;
  return count;
}

/** Cherche les dispositions valides de ces gemmes qui donnent exactement cette signature. */
export function solve(
  signature: Signature,
  gems: readonly GemId[] = BASE_GEM_IDS,
  { limit = 2, maxNodes = 300_000 }: SolveOptions = {},
): SolveResult {
  const empty = emptyShots(signature);
  const occupied = occupiedLines(empty);
  const solutions: Placement[][] = [];
  let nodes = 0;
  let complete = true;
  const stop = (): boolean => solutions.length >= limit || !complete;

  // Tirs à rejouer : tous sauf les tirs vides (déjà pris en compte par `occupied`), en commençant
  // par ceux qui touchent le moins de couleurs, donc les plus contraignants. Un rayon absorbé ne
  // dit rien de ses couleurs : toutes sont permises avant le Corps noir.
  const shots = ENTRY_POINTS.map((entry, index) => {
    const outcome = signature[index] ?? { exit: '', color: 'transparent' as const };
    const absorbed = isAbsorbed(outcome);
    return {
      entry,
      exit: outcome.exit,
      absorbed,
      mask: absorbed ? 0 : colorMask(outcome.color),
      allowed: absorbed ? 15 : colorMask(outcome.color),
    };
  })
    .filter((_, index) => !empty[index])
    .sort((a, b) => popCount(a.allowed) - popCount(b.allowed));

  type Shot = (typeof shots)[number];
  /** Cette gemme peut-elle être touchée par ce rayon ? */
  const canTouch = (candidate: Candidate, shot: Shot): boolean =>
    candidate.kind === 'black'
      ? shot.absorbed
      : candidate.kind === 'clear' || (candidate.bit & shot.allowed) !== 0;

  const finish = (state: State): void => {
    if (state.domains.some((domain) => domain !== null)) return;
    const placements = state.placed.map((c) => c?.placement as Placement);
    if (sameSignature(signatureOf(placements), signature) && isVisible(placements)) {
      solutions.push(placements);
    }
  };

  const nextShot = (state: State, index: number): void => {
    if (stop()) return;
    const shot = shots[index];
    if (shot === undefined) {
      finish(state);
      return;
    }
    const { from, dir } = startOf(shot.entry);
    advance(state, index, from, dir, 0);
  };

  /** Suit le rayon du tir `index` depuis `position`, avec `touched` pour couleurs déjà touchées. */
  const advance = (state: State, index: number, position: Vec, dir: Vec, touched: number): void => {
    if (stop()) return;
    if (++nodes > maxNodes) {
      complete = false;
      return;
    }
    const shot = shots[index];
    if (shot === undefined) return;

    // Première gemme déjà posée sur le segment, sinon le bord.
    const placedGems: number[] = [];
    const placedPolygons: Polygon[] = [];
    state.placed.forEach((candidate, gem) => {
      if (candidate) {
        placedGems.push(gem);
        placedPolygons.push(candidate.polygon);
      }
    });
    const placedHit = findFirstHit(placedPolygons, position, dir);
    const reach = placedHit ? placedHit.distance : boundaryDistance(position, dir);

    // Poses des gemmes non posées qui seraient touchées avant `reach`.
    const blocked: { gem: number; candidate: Candidate; distance: number }[] = [];
    const clear: (readonly Candidate[] | null)[] = state.domains.map((domain, gem) => {
      if (!domain) return null;
      const free: Candidate[] = [];
      for (const candidate of domain) {
        const hit = findFirstHit([candidate.polygon], position, dir);
        if (hit !== null && hit.distance < reach) {
          blocked.push({ gem, candidate, distance: hit.distance });
        } else {
          free.push(candidate);
        }
      }
      return free;
    });

    // Cas 1 : aucune gemme non posée sur ce segment.
    if (clear.every((domain) => domain === null || domain.length > 0)) {
      const next: State = { domains: clear, placed: state.placed };
      if (placedHit === null) {
        const exit = exitPointAt(position, dir);
        if (exit.label === shot.exit && touched === shot.mask) nextShot(next, index + 1);
      } else {
        const gem = placedGems[placedHit.gem];
        const hit = gem === undefined ? null : (state.placed[gem] ?? null);
        if (hit !== null && canTouch(hit, shot)) {
          if (hit.kind === 'black') {
            // Le rayon s'arrête là : c'est bien un tir absorbé (canTouch l'a vérifié).
            nextShot(next, index + 1);
          } else {
            const bounced = reflect(dir, placedHit.edgeVector);
            advance(next, index, placedHit.point, bounced, touched | hit.bit);
          }
        }
      }
    }

    // Cas 2 : une gemme non posée est la première touchée, une branche par pose possible.
    for (const { gem, candidate, distance } of blocked) {
      if (!canTouch(candidate, shot)) continue;
      const domains: (readonly Candidate[] | null)[] = [];
      let dead = false;
      for (let other = 0; other < state.domains.length && !dead; other++) {
        const domain = state.domains[other];
        if (other === gem || !domain) {
          domains.push(null);
          continue;
        }
        const kept = domain.filter(
          (c) =>
            compatible(candidate, c) &&
            !blocked.some((b) => b.candidate === c && b.distance < distance),
        );
        if (kept.length === 0) dead = true;
        domains.push(kept);
      }
      if (dead) continue;
      const placed = state.placed.slice();
      placed[gem] = candidate;
      advance({ domains, placed }, index, position, dir, touched);
      if (stop()) return;
    }
  };

  const domains = gems.map((gem) => candidatesFor(gem, occupied));
  if (domains.every((domain) => domain.length > 0)) {
    nextShot({ domains, placed: gems.map(() => null) }, 0);
  }
  return { solutions, complete, nodes };
}

/** Vrai si cette disposition est la seule qui produise sa signature. */
export function isUnique(placements: readonly Placement[], options?: SolveOptions): boolean {
  const gems = placements.map((p) => p.gem);
  const { solutions, complete } = solve(signatureOf(placements), gems, { limit: 2, ...options });
  return complete && solutions.length === 1;
}
