/**
 * Ce que l'IA croit du plateau adverse : un échantillon de plateaux encore compatibles avec les réponses
 * reçues (« particules »). Au début tous les plateaux sont possibles (des millions) : on ne les énumère pas,
 * on en garde quelques dizaines, tirés par le générateur. À chaque réponse :
 *  - les particules qui la contredisent sont **réparées** : on réévalue toutes les poses d'une gemme (les
 *    autres restant en place) et l'on prend une pose qui respecte toutes les réponses (échantillonnage de Gibbs) ;
 *  - les particules en double sont **renouvelées** par le même mouvement, pour garder de la diversité ;
 *  - celles qu'on n'a pas su réparer sont remplacées par des copies de particules valides.
 *
 * Le budget de calcul est compté en **tirs simulés** (un tir = une unité), pas en millisecondes : à graine
 * égale l'IA joue exactement les mêmes coups, quelle que soit la machine. À peu près 20 µs l'unité.
 *
 * L'IA ne voit que `Answers` (réponses à ses propres questions) : jamais le plateau adverse.
 */
import { ENTRY_POINTS, parseCell } from '../board';
import type { Knowledge } from '../duel';
import { GEM_SHAPES, type GemId, type Placement } from '../gems';
import { randomVisibleLayout } from '../generate';
import { shoot } from '../laser';
import type { ProbeContent } from '../probe';
import type { Rng } from '../rng';
import { isVisible } from '../visibility';
import { CELL_COUNT, type Pose, cellIndex, compatible, poseOf, posesOf } from './poses';

/** Un plateau candidat : une pose par gemme, dans l'ordre des gemmes de la partie. */
export type Layout = readonly Pose[];

export type Answers = Pick<Knowledge, 'shots' | 'probes'>;

interface ProbeAnswer {
  cell: number;
  content: ProbeContent;
}

interface Prepared {
  shots: Answers['shots'];
  probes: ProbeAnswer[];
}

/** Coût d'un contrôle de visibilité (règle e) : un tir depuis chacun des 36 repères. */
const VISIBILITY_WORK = ENTRY_POINTS.length;

export function placementsOf(layout: Layout): Placement[] {
  return layout.map((pose) => pose.placement);
}

/** Pour chaque case, la couleur de la gemme qui la recouvre, ou null. */
export function occupancy(layout: Layout): (ProbeContent | null)[] {
  const owner: (ProbeContent | null)[] = new Array<ProbeContent | null>(CELL_COUNT).fill(null);
  for (const pose of layout) {
    const paint = GEM_SHAPES[pose.placement.gem].color;
    for (const cell of pose.cells) owner[cell] = paint;
  }
  return owner;
}

export function layoutKey(layout: Layout): string {
  return layout
    .map((pose) => pose.key)
    .sort()
    .join('/');
}

export interface BeliefOptions {
  /** Nombre de particules. */
  size: number;
}

export class Belief {
  readonly #gems: readonly GemId[];
  readonly #rng: Rng;
  readonly #size: number;
  #particles: Layout[] = [];
  /** Unités de calcul dépensées depuis le début de la mise à jour en cours. */
  #work = 0;
  #budget = 0;
  /** Faux si la dernière mise à jour n'a pas retrouvé de plateau compatible avec toutes les réponses. */
  #consistent = true;

  constructor(gems: readonly GemId[], rng: Rng, { size }: BeliefOptions) {
    this.#gems = gems;
    this.#rng = rng;
    this.#size = size;
  }

  get particles(): readonly Layout[] {
    return this.#particles;
  }

  /** Vrai si toutes les particules respectent toutes les réponses. */
  get consistent(): boolean {
    return this.#consistent;
  }

  /** Unités de calcul dépensées par la dernière mise à jour. */
  get work(): number {
    return this.#work;
  }

  /** Nombre de plateaux différents dans l'échantillon. */
  distinct(): number {
    return new Set(this.#particles.map(layoutKey)).size;
  }

  /** Le plateau le plus fréquent de l'échantillon et sa part (0 à 1). */
  modal(): { layout: Layout; share: number } | null {
    const counts = new Map<string, { layout: Layout; count: number }>();
    for (const layout of this.#particles) {
      const key = layoutKey(layout);
      const known = counts.get(key);
      if (known) known.count++;
      else counts.set(key, { layout, count: 1 });
    }
    let best: { layout: Layout; count: number } | null = null;
    for (const entry of counts.values()) if (!best || entry.count > best.count) best = entry;
    return best ? { layout: best.layout, share: best.count / this.#particles.length } : null;
  }

  // ---------- Réponses contredites ----------

  #prepare(answers: Answers): Prepared {
    const probes: ProbeAnswer[] = [];
    for (const probe of answers.probes) {
      const cell = parseCell(probe.cell);
      if (cell) probes.push({ cell: cellIndex(cell.row, cell.col), content: probe.content });
    }
    return { shots: answers.shots, probes };
  }

  /** Nombre de réponses que ce plateau contredit (0 = compatible). */
  #cost(layout: Layout, answers: Prepared): number {
    let cost = 0;
    if (answers.probes.length > 0) {
      const owner = occupancy(layout);
      for (const probe of answers.probes) {
        if ((owner[probe.cell] ?? 'nothing') !== probe.content) cost++;
      }
    }
    if (answers.shots.length > 0) {
      const placements = placementsOf(layout);
      for (const shot of answers.shots) {
        this.#work++;
        const result = shoot(placements, shot.entry);
        if (result.exit !== shot.exit || result.color !== shot.color) cost++;
      }
    }
    return cost;
  }

  #visible(layout: Layout): boolean {
    this.#work += VISIBILITY_WORK;
    return isVisible(placementsOf(layout));
  }

  // ---------- Mouvement de Gibbs ----------

  /**
   * Réévalue toutes les poses de la gemme `index` (les autres gemmes restant en place) et renvoie celles
   * qui contredisent le moins de réponses, avec ce nombre. La pose actuelle en fait partie.
   */
  #sweep(layout: Layout, index: number, answers: Prepared): { cost: number; poses: Pose[] } {
    const current = layout[index];
    if (!current) return { cost: Infinity, poses: [] };
    const gem = current.placement.gem;
    const paint = GEM_SHAPES[gem].color;
    const others = layout.filter((_, other) => other !== index);
    const owner = occupancy(others);
    const otherPlacements = placementsOf(others);
    let best = Infinity;
    let poses: Pose[] = [];
    for (const pose of posesOf(gem)) {
      if (!others.every((neighbour) => compatible(pose, neighbour))) continue;
      let cost = 0;
      for (const probe of answers.probes) {
        const actual = pose.cells.includes(probe.cell) ? paint : (owner[probe.cell] ?? 'nothing');
        if (actual !== probe.content && ++cost > best) break;
      }
      if (cost <= best && answers.shots.length > 0) {
        const placements = [...otherPlacements, pose.placement];
        for (const shot of answers.shots) {
          if (cost > best) break;
          this.#work++;
          const result = shoot(placements, shot.entry);
          if (result.exit !== shot.exit || result.color !== shot.color) cost++;
        }
      }
      if (cost > best) continue;
      if (cost < best) {
        best = cost;
        poses = [pose];
      } else {
        poses.push(pose);
      }
    }
    return { cost: best, poses };
  }

  #replace(layout: Layout, index: number, pose: Pose): Layout {
    const next = layout.slice();
    next[index] = pose;
    return next;
  }

  /** Une de ces poses, au hasard, qui rend le plateau visible (règle e) ; null si aucune ne convient. */
  #pickVisible(layout: Layout, index: number, poses: readonly Pose[], tries = 6): Layout | null {
    const current = layout[index];
    const pool = poses.slice();
    for (let attempt = 0; attempt < tries && pool.length > 0; attempt++) {
      const [pose] = pool.splice(this.#rng.int(pool.length), 1);
      if (!pose) break;
      if (current && pose.key === current.key) return layout;
      const next = this.#replace(layout, index, pose);
      if (this.#visible(next)) return next;
    }
    return null;
  }

  #shuffled(count: number): number[] {
    const order = Array.from({ length: count }, (_, index) => index);
    for (let i = order.length - 1; i > 0; i--) {
      const j = this.#rng.int(i + 1);
      const a = order[i];
      const b = order[j];
      if (a !== undefined && b !== undefined) {
        order[i] = b;
        order[j] = a;
      }
    }
    return order;
  }

  /** Répare un plateau qui contredit des réponses : un plateau compatible et visible, ou null. */
  #repair(start: Layout, answers: Prepared, rounds = 3): Layout | null {
    let current = start;
    for (let round = 0; round < rounds; round++) {
      for (const index of this.#shuffled(current.length)) {
        if (this.#work >= this.#budget) return null;
        const { cost, poses } = this.#sweep(current, index, answers);
        if (poses.length === 0) continue;
        if (cost === 0) {
          const fixed = this.#pickVisible(current, index, poses);
          if (fixed) return fixed;
          continue;
        }
        // Une seule gemme ne suffit pas : on avance quand même vers une pose moins contredite.
        current = this.#replace(current, index, this.#rng.pick(poses));
      }
    }
    return null;
  }

  /** Renouvelle un plateau compatible : une gemme change de pose, au hasard parmi celles qui conviennent. */
  #mix(layout: Layout, answers: Prepared): Layout {
    const index = this.#rng.int(layout.length);
    const { cost, poses } = this.#sweep(layout, index, answers);
    if (cost !== 0 || poses.length === 0) return layout;
    return this.#pickVisible(layout, index, poses, 4) ?? layout;
  }

  /**
   * Explore autour d'un plateau : `kick` gemmes sont reposées au hasard, puis le plateau est réparé. Les
   * autres plateaux compatibles diffèrent souvent de plusieurs gemmes à la fois, qu'un mouvement d'une seule
   * gemme ne trouve pas.
   */
  #explore(base: Layout, answers: Prepared, kick: number): Layout | null {
    let layout = base;
    const moved = this.#shuffled(base.length).slice(0, kick);
    for (const index of moved) {
      const current = layout[index];
      if (!current) return null;
      const others = layout.filter((_, other) => other !== index);
      const options = posesOf(current.placement.gem).filter(
        (pose) =>
          pose.key !== current.key && others.every((neighbour) => compatible(pose, neighbour)),
      );
      if (options.length === 0) return null;
      layout = this.#replace(layout, index, this.#rng.pick(options));
    }
    return this.#repair(layout, answers, 2);
  }

  /** Repart de zéro : un plateau tiré au hasard, réparé. Trouve des plateaux compatibles éloignés de ceux qu'on a déjà. */
  #restart(answers: Prepared): Layout | null {
    return this.#repair(this.#fresh(), answers);
  }

  /** Un plateau compatible nouveau : tantôt autour d'un plateau connu, tantôt en repartant de zéro. */
  #discover(from: Layout, answers: Prepared): Layout | null {
    return this.#rng.next() < 0.5
      ? this.#restart(answers)
      : this.#explore(from, answers, 2 + this.#rng.int(2));
  }

  #fresh(): Layout {
    this.#work += VISIBILITY_WORK;
    return randomVisibleLayout(this.#rng, this.#gems).map((placement) => {
      const pose = poseOf(placement);
      if (!pose) throw new Error('Pose hors catalogue');
      return pose;
    });
  }

  /**
   * Met l'échantillon à jour avec les réponses connues (toutes, depuis le début : la mise à jour ne
   * dépend pas de l'historique des appels). `budget` : unités de calcul au plus (tirs simulés).
   */
  update(answers: Answers, budget: number): void {
    const prepared = this.#prepare(answers);
    this.#work = 0;
    this.#budget = budget;
    while (this.#particles.length < this.#size && this.#work < budget) {
      this.#particles.push(this.#fresh());
    }
    const costs = this.#particles.map((layout) => this.#cost(layout, prepared));
    const good: Layout[] = this.#particles.filter((_, index) => costs[index] === 0);

    // Réparer les particules contredites, de la moins à la plus contredite, tant qu'il reste du budget.
    const broken = this.#particles
      .map((layout, index) => ({ layout, cost: costs[index] ?? 0 }))
      .filter((entry) => entry.cost > 0)
      .sort((a, b) => a.cost - b.cost);
    for (const { layout } of broken) {
      if (this.#work >= budget) break;
      const fixed = this.#repair(layout, prepared);
      if (fixed) good.push(fixed);
    }

    this.#consistent = good.length > 0;
    let particles = good;
    if (good.length === 0) {
      // Aucun plateau compatible trouvé : on garde les moins mauvais plutôt que rien.
      particles = broken.slice(0, this.#size).map((entry) => entry.layout);
    }
    // Il en manque : copies de particules valides.
    const base = particles.slice();
    for (let next = 0; particles.length < this.#size && base.length > 0; next++) {
      const copy = base[next % base.length];
      if (copy) particles.push(copy);
    }
    this.#particles = particles.slice(0, this.#size);

    // Renouveler les doublons (et quelques autres) pour garder de la diversité.
    if (this.#consistent) {
      const counts = new Map<string, number>();
      for (const layout of this.#particles) {
        const key = layoutKey(layout);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      for (const index of this.#shuffled(this.#particles.length)) {
        // Le reste du budget sert à explorer.
        if (this.#work >= budget * 0.6) break;
        const layout = this.#particles[index];
        if (!layout) continue;
        const key = layoutKey(layout);
        const copies = counts.get(key) ?? 1;
        if (copies <= 1 && this.#rng.next() < 0.7) continue;
        const mixed = this.#mix(layout, prepared);
        const mixedKey = layoutKey(mixed);
        if (mixedKey !== key) {
          this.#particles[index] = mixed;
          counts.set(key, copies - 1);
          counts.set(mixedKey, (counts.get(mixedKey) ?? 0) + 1);
        }
      }
      // Exploration : des plateaux qui diffèrent de plusieurs gemmes à la fois.
      for (let attempt = 0; attempt < 8 && this.#work < budget; attempt++) {
        const from = this.#particles[this.#rng.int(this.#particles.length)];
        const found = from ? this.#discover(from, prepared) : null;
        if (found) this.#insert(found);
      }
    }
  }

  /** Remplace une particule en double par ce plateau, s'il est nouveau ; sans effet s'il n'y a pas de double. */
  #insert(layout: Layout): void {
    const key = layoutKey(layout);
    const counts = new Map<string, number>();
    for (const other of this.#particles) {
      const otherKey = layoutKey(other);
      counts.set(otherKey, (counts.get(otherKey) ?? 0) + 1);
    }
    if (counts.has(key)) return;
    const slot = this.#particles.findIndex((other) => (counts.get(layoutKey(other)) ?? 0) > 1);
    if (slot >= 0) this.#particles[slot] = layout;
  }

  /** Un autre plateau compatible existe : il prend la place d'une copie du plus probable. Renvoie vrai. */
  #replaceModal(modal: Layout, found: Layout): boolean {
    const modalKey = layoutKey(modal);
    const slot = this.#particles.findIndex((layout) => layoutKey(layout) === modalKey);
    this.#particles[slot >= 0 ? slot : this.#particles.length - 1] = found;
    return true;
  }

  /**
   * Cherche un plateau compatible différent du plus probable, en changeant la pose d'une ou plusieurs gemmes : s'il
   * en existe un, le plateau le plus probable n'est pas certain. L'ajoute à l'échantillon quand il en trouve un.
   */
  findAlternative(answers: Answers, budget: number): boolean {
    const modal = this.modal();
    if (!modal) return false;
    const prepared = this.#prepare(answers);
    this.#work = 0;
    this.#budget = budget;
    for (const index of this.#shuffled(modal.layout.length)) {
      if (this.#work >= budget) break;
      const current = modal.layout[index];
      const { cost, poses } = this.#sweep(modal.layout, index, prepared);
      if (cost !== 0 || !current) continue;
      const others = poses.filter((pose) => pose.key !== current.key);
      const found = this.#pickVisible(modal.layout, index, others, 8);
      if (found && found !== modal.layout) return this.#replaceModal(modal.layout, found);
    }
    // Un plateau qui diffère de plusieurs gemmes à la fois : mouvement plus large.
    const modalKey = layoutKey(modal.layout);
    for (let attempt = 0; attempt < 8 && this.#work < budget; attempt++) {
      const found = this.#discover(modal.layout, prepared);
      if (found && layoutKey(found) !== modalKey) return this.#replaceModal(modal.layout, found);
    }
    return false;
  }
}
