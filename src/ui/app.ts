/**
 * Application : une partie à la fois, avec la grille de tir, la grille de solution et
 * l'historique des tirs. L'état de l'interface est petit : la partie, la solution du joueur,
 * l'onglet affiché et la sélection.
 */
import { RESULT_COLOR_LABELS, componentColors } from '../game/colors';
import { cellLabel } from '../game/board';
import { GRID_COLS, GRID_ROWS } from '../game/constants';
import { GEM_SHAPES, type GemId } from '../game/gems';
import { type ShotResult, shoot } from '../game/laser';
import { randomSeed } from '../game/rng';
import { GameSession, type ShotRecord } from '../game/session';
import { SAVE_VERSION, type SaveData } from '../game/save';
import { compareSolution } from '../game/verify';
import {
  type Solution,
  compareWithShots,
  dropGem,
  emptySolution,
  flipGem,
  isSubmittable,
  nudgeGem,
  placedGems,
  removeGem,
  rotateGem,
  solutionIssues,
} from '../game/solution';
import {
  type Ink,
  type NotePoint,
  type NotesHistory,
  addStroke,
  cellAt,
  commit,
  emptyNotes,
  eraseAt,
  newHistory,
  redo,
  toggleMark,
  undo,
} from '../game/notes';
import { shotBoardSvg } from './board';
import { type Tool, notesBoardSvg, notesToolbar } from './notesBoard';
import { notesLayerSvg } from './notesLayer';
import { RAY_COLOR } from './palette';
import { diffLine, resultBoardSvg } from './resultBoard';
import { rulesPage } from './rules';
import { browserSaveStore } from './storage';
import { t } from './strings';
import { gemOrigin, gemSize, solutionBoardSvg } from './solutionBoard';

type Phase = 'loading' | 'resume' | 'ready' | 'error';
type Tab = 'shots' | 'solution' | 'notes' | 'result';
type View = 'game' | 'rules';
type Ask = { kind: 'fire'; label: string } | { kind: 'probe'; cell: string };

interface State {
  phase: Phase;
  /** Page affichée : la partie ou les règles (adresse « #regles »). */
  view: View;
  session: GameSession | null;
  tab: Tab;
  /** Tir mis en avant dans l'historique. */
  selected: number | null;
  solution: Solution;
  selectedGem: GemId | null;
  /** Tir simulé sur la grille du joueur. */
  hypothesis: ShotResult | null;
  notes: NotesHistory;
  tool: Tool;
  ink: Ink;
  /** Tir ou sonde en attente de confirmation (fenêtre modale). */
  ask: Ask | null;
  /** Confirmations désactivées pour cette partie. */
  skipConfirm: boolean;
  /** Case du curseur clavier de l'onglet Tirs. */
  cursor: { row: number; col: number };
  /** Notes affichées en transparence dans l'onglet Tirs. */
  showNotes: boolean;
  /** Action définitive en attente de confirmation. */
  confirm: 'submit' | 'abandon' | null;
  /** Partie sauvegardée proposée à la reprise. */
  pending: SaveData | null;
  notice: string;
}

function seedFromUrl(): string | null {
  try {
    const seed = new URLSearchParams(window.location.search).get('seed')?.trim();
    return seed ? seed : null;
  } catch {
    return null;
  }
}

function writeSeedToUrl(seed: string): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('seed', seed);
    window.history.replaceState(null, '', url);
  } catch {
    // L'adresse reste telle quelle : sans conséquence pour le jeu.
  }
}

function viewFromHash(): View {
  try {
    return window.location.hash === '#regles' ? 'rules' : 'game';
  } catch {
    return 'game';
  }
}

/**
 * Pastilles d'un résultat : une par couleur de gemme qui le compose, séparées par un « + »
 * (violet clair = rouge + bleu + blanc). Aucune pastille pour « transparent ». Le nom reste écrit.
 */
function chips(color: ShotRecord['color']): string {
  const parts = componentColors(color);
  if (parts.length === 0) return '';
  const dots = parts
    .map((part) => `<span class="chip" style="background:${RAY_COLOR[part]}"></span>`)
    .join('<span class="plus">+</span>');
  return `<span class="chips" aria-hidden="true">${dots}</span>`;
}

function describe(shot: ShotRecord): string {
  return `${shot.n} : ${shot.entry} → ${shot.exit}, ${RESULT_COLOR_LABELS[shot.color]}`;
}

function plural(count: number, one: string, many: string): string {
  return count > 1 ? many : one;
}

/** Point de l'écran converti en coordonnées de la grille (unité : la case). */
function toBoardPoint(svg: SVGSVGElement, clientX: number, clientY: number): [number, number] {
  const matrix = svg.getScreenCTM();
  if (!matrix) return [0, 0];
  const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  return [point.x, point.y];
}

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function startApp(root: HTMLElement, version: string): void {
  const state: State = {
    phase: 'loading',
    view: viewFromHash(),
    session: null,
    tab: 'shots',
    selected: null,
    solution: emptySolution(),
    selectedGem: null,
    hypothesis: null,
    notes: newHistory(),
    tool: 'pencil',
    ink: 'ink',
    ask: null,
    skipConfirm: false,
    cursor: { row: 0, col: 0 },
    showNotes: true,
    confirm: null,
    pending: null,
    notice: '',
  };
  const store = browserSaveStore();

  // ---------- Affichage ----------

  const solutionPanel = (session: GameSession): string => {
    const issues = solutionIssues(state.solution);
    const matches = compareWithShots(state.solution, session.shots);
    const matching = [...matches.values()].filter(Boolean).length;
    const placed = placedGems(state.solution).length;
    const total = Object.keys(state.solution).length;
    const board = solutionBoardSvg({
      solution: state.solution,
      selected: state.selectedGem,
      issues,
      shots: session.shots,
      hypothesis: state.hypothesis,
    });
    const selected = state.selectedGem;
    const flippable = selected !== null && GEM_SHAPES[selected].flippable;
    const placedSelected = selected !== null && state.solution[selected] !== null;
    const hypothesis = state.hypothesis
      ? `<p class="hypo">${state.hypothesis.entry} → ${state.hypothesis.exit} · ${RESULT_COLOR_LABELS[state.hypothesis.color]}</p>`
      : '';
    const status = `${placed}/${total}${session.shots.length ? ` · ${matching}/${session.shots.length} tirs` : ''}`;
    return `
      ${board}
      <div class="toolbar" role="toolbar" aria-label="Actions sur la gemme sélectionnée">
        <button type="button" data-action="rotate"${placedSelected ? '' : ' disabled'}>${t.actions.rotate}</button>
        <button type="button" data-action="flip"${placedSelected && flippable ? '' : ' disabled'} title="Rouge seulement">${t.actions.flip}</button>
        <button type="button" class="ghost" data-action="remove"${placedSelected ? '' : ' disabled'}>${t.actions.putBack}</button>
      </div>
      <p class="status">${status}</p>
      ${hypothesis}
      ${
        issues.length
          ? `<ul class="issues">${issues.map((issue) => `<li>${issue.message}</li>`).join('')}</ul>`
          : ''
      }`;
  };

  const resultPanel = (session: GameSession): string => {
    const summary = session.summary;
    const diffs = compareSolution(session.reveal(), placedGems(state.solution));
    return `
      <div class="result is-${summary.status}">
        <h2>${t.status[summary.status]}</h2>
        ${resultBoardSvg(diffs)}
        <ul class="diff">${diffs.map((diff) => `<li class="${diff.status}">${diffLine(diff)}</li>`).join('')}</ul>
        <div class="actions">
          <button type="button" data-action="new-game">${t.actions.newGame}</button>
          <button type="button" class="ghost" data-action="replay">${t.actions.replay}</button>
        </div>
      </div>`;
  };

  /** Soumettre ou abandonner, avec confirmation car l'action est définitive. */
  const actionsPanel = (session: GameSession): string => {
    if (session.finished) return '';
    if (state.confirm === 'submit') {
      return `<div class="confirm" role="alertdialog" aria-label="Confirmer"><p>Soumettre ?</p><div class="actions"><button type="button" data-action="confirm-submit">${t.actions.submit}</button><button type="button" class="ghost" data-action="cancel-confirm">Annuler</button></div></div>`;
    }
    if (state.confirm === 'abandon') {
      return `<div class="confirm" role="alertdialog" aria-label="Confirmer"><p>Abandonner ?</p><div class="actions"><button type="button" data-action="confirm-abandon">${t.actions.abandon}</button><button type="button" class="ghost" data-action="cancel-confirm">Annuler</button></div></div>`;
    }
    const ready = isSubmittable(state.solution);
    return `<div class="actions"><button type="button" data-action="ask-submit"${ready ? '' : ' disabled title="5 gemmes valides requises"'}>${t.actions.submit}</button><button type="button" class="ghost" data-action="ask-abandon">${t.actions.abandon}</button></div>`;
  };

  /** Sous la grille de tir : afficher ou non les notes en transparence. */
  const optionsPanel = (): string =>
    `<div class="notes-tools"><label class="check"><input type="checkbox" id="show-notes" data-toggle="notes"${state.showNotes ? ' checked' : ''} />${t.actions.showNotes}</label></div>`;

  /** Fenêtre modale de confirmation d'un tir ou d'une sonde. */
  const modal = (): string => {
    const { ask } = state;
    if (!ask) return '';
    const title = ask.kind === 'fire' ? t.modal.fire(ask.label) : t.modal.probe(ask.cell);
    return `<div class="modal-backdrop" data-modal-backdrop><div class="modal" role="dialog" aria-modal="true" aria-label="${title}"><p class="modal-title">${title}</p><label class="check"><input type="checkbox" id="skip-confirm" />${t.modal.dontAsk}</label><div class="actions"><button type="button" data-action="modal-confirm">${t.modal.confirm}</button><button type="button" class="ghost" data-action="modal-cancel">${t.modal.cancel}</button></div></div></div>`;
  };

  const resumePanel = (save: SaveData): string => {
    const { session } = save;
    return `
      <div class="resume" role="alertdialog" aria-label="Partie en cours">
        <h2>Partie en cours</h2>
        <p><b>${session.mine.seed}</b> · ${session.shots.length} laser${plural(session.shots.length, '', 's')} · ${session.probes.length} sonde${plural(session.probes.length, '', 's')} · ${formatTime(session.elapsedMs)}</p>
        <div class="actions">
          <button type="button" data-action="resume">${t.actions.resume}</button>
          <button type="button" class="ghost" data-action="discard-save">${t.actions.newGame}</button>
        </div>
      </div>`;
  };

  /** Sauvegarde automatique de la partie en cours (rien à sauvegarder une fois terminée). */
  const persist = (): void => {
    const { session } = state;
    if (state.phase !== 'ready' || !session || session.finished) return;
    store.save({
      version: SAVE_VERSION,
      savedAt: Date.now(),
      session: session.toSnapshot(),
      solution: state.solution,
      notes: state.notes.present,
      skipConfirm: state.skipConfirm,
    });
  };

  /** Le chronomètre ne tourne que pendant qu'on joue : pas pendant la lecture des règles ni page cachée. */
  const syncClock = (): void => {
    const session = state.session;
    if (!session) return;
    if (state.view === 'game' && document.visibilityState === 'visible') session.resume();
    else session.pause();
  };

  const render = (): void => {
    syncClock();
    if (state.view === 'rules') {
      root.innerHTML = `<main class="app">${rulesPage(version)}</main>`;
      return;
    }
    const { session } = state;
    const shots = session?.shots ?? [];
    let board: string;
    if (state.phase === 'ready' && session) {
      if (state.tab === 'shots') {
        board = `${shotBoardSvg(
          { shots, selected: state.selected },
          {
            probes: session.probes,
            probeable: !session.finished,
            cursor: state.cursor,
            gems: placedGems(state.solution),
            notes: state.showNotes ? state.notes.present : null,
          },
        )}${optionsPanel()}`;
      } else if (state.tab === 'result' && session.finished) {
        board = resultPanel(session);
      } else if (state.tab === 'solution') {
        board = solutionPanel(session);
      } else {
        const view = { history: state.notes, shots, tool: state.tool, ink: state.ink };
        board = `${notesBoardSvg(view)}${notesToolbar(view)}`;
      }
    } else if (state.phase === 'resume' && state.pending) {
      board = resumePanel(state.pending);
    } else {
      board = `<p class="placeholder" role="status">${
        state.phase === 'error' ? 'Échec de la génération.' : 'Génération…'
      }</p>`;
    }

    const history = shots.length
      ? `<ol class="history" aria-label="Tirs">${shots
          .map(
            (shot) =>
              `<li><button type="button" class="shot${state.selected === shot.n ? ' is-selected' : ''}" data-shot="${shot.n}"><span class="n">${shot.n}</span><span class="path"><b>${shot.entry}</b> → <b>${shot.exit}</b></span>${chips(shot.color)}<span class="color-name">${RESULT_COLOR_LABELS[shot.color]}</span></button></li>`,
          )
          .join('')}</ol>`
      : '';

    const count = session?.laserCount ?? 0;
    const probeCount = session?.probes.length ?? 0;
    const probeHistory = probeCount
      ? `<ul class="probe-list" aria-label="Sondages">${(session?.probes ?? [])
          .map((probe) => `<li><b>${probe.cell}</b> · ${t.probe[probe.content]}</li>`)
          .join('')}</ul>`
      : '';
    root.innerHTML = `
      <a class="skip-link" href="#plateau" data-action="skip">${t.skipToContent}</a>
      <main class="app">
        <header class="top">
          <div>
            <h1>${t.appName}</h1>
          </div>
          <div class="seed-box">
            <code class="seed" title="Graine">${session?.seed ?? '…'}</code>
            <button type="button" class="ghost" data-action="copy-link"${session ? '' : ' disabled'}>${t.actions.copyLink}</button>
            <a class="nav-link" href="#regles">${t.nav.rules}</a>
            <button type="button" data-action="new-game">${t.actions.newGame}</button>
          </div>
        </header>
        ${store.available ? '' : `<p class="warning" role="status">${t.hints.storageOff}</p>`}
        <div class="play">
          <section class="board-wrap" id="plateau" tabindex="-1" aria-label="Plateau">
            <div class="tabs" role="tablist">
              <button type="button" role="tab" class="tab${state.tab === 'shots' ? ' is-active' : ''}" aria-selected="${state.tab === 'shots'}" data-tab="shots">${t.tabs.shots}</button>
              <button type="button" role="tab" class="tab${state.tab === 'solution' ? ' is-active' : ''}" aria-selected="${state.tab === 'solution'}" data-tab="solution">${t.tabs.solution}</button>
              <button type="button" role="tab" class="tab${state.tab === 'notes' ? ' is-active' : ''}" aria-selected="${state.tab === 'notes'}" data-tab="notes">${t.tabs.notes}</button>${
                session?.finished
                  ? `<button type="button" role="tab" class="tab${state.tab === 'result' ? ' is-active' : ''}" aria-selected="${state.tab === 'result'}" data-tab="result">${t.tabs.result}</button>`
                  : ''
              }
            </div>
            ${board}
          </section>
          <aside class="side">
            <div class="counter"><span class="count">${count}</span><span class="count-label">laser${plural(count, '', 's')}</span></div>
            <p class="meta">${probeCount} sonde${plural(probeCount, '', 's')} · <span id="timer">${formatTime(session?.elapsedMs() ?? 0)}</span></p>
            ${session ? actionsPanel(session) : ''}
            ${history}
            ${probeHistory}
          </aside>
        </div>
        <p class="sr-only" aria-live="polite">${state.notice}</p>
        ${modal()}
      </main>`;
    persist();
  };

  // ---------- Actions ----------

  const startGame = (seed: string): void => {
    store.clear();
    state.pending = null;
    state.phase = 'loading';
    state.session = null;
    state.selected = null;
    state.solution = emptySolution();
    state.selectedGem = null;
    state.hypothesis = null;
    state.notes = newHistory();
    state.ask = null;
    state.skipConfirm = false;
    state.confirm = null;
    state.tab = 'shots';
    state.notice = '';
    render();
    // Laisse le navigateur afficher « Génération… » avant le calcul de la mine.
    window.setTimeout(() => {
      try {
        state.session = GameSession.start(seed);
        state.phase = 'ready';
        writeSeedToUrl(seed);
      } catch {
        state.phase = 'error';
      }
      render();
    }, 30);
  };

  const doFire = (label: string): void => {
    if (!state.session || state.session.finished) return;
    const shot = state.session.fire(label);
    state.selected = shot.n;
    state.notice = describe(shot);
    render();
  };

  const doProbe = (label: string): void => {
    const { session } = state;
    if (!session || session.finished) return;
    try {
      const record = session.probe(label);
      state.notice = `${record.cell} : ${t.probe[record.content]}`;
    } catch {
      state.notice = `« ${label} » : case invalide (A1 à H10).`;
    }
    render();
  };

  /** Termine la partie et affiche le résultat. */
  const showResult = (): void => {
    store.clear();
    state.confirm = null;
    state.ask = null;
    state.tab = 'result';
    state.notice = state.session ? t.status[state.session.status] : '';
    render();
  };

  /** Ouvre la confirmation, sauf si elle est désactivée ou si la réponse est déjà connue (gratuit). */
  const askFire = (label: string): void => {
    const session = state.session;
    if (!session || session.finished) return;
    if (state.skipConfirm || session.shots.some((shot) => shot.entry === label))
      return doFire(label);
    state.ask = { kind: 'fire', label };
    render();
    root.querySelector<HTMLElement>('[data-action="modal-confirm"]')?.focus();
  };

  const askProbe = (cell: string): void => {
    const session = state.session;
    if (!session || session.finished) return;
    if (state.skipConfirm || session.probes.some((probe) => probe.cell === cell))
      return doProbe(cell);
    state.ask = { kind: 'probe', cell };
    render();
    root.querySelector<HTMLElement>('[data-action="modal-confirm"]')?.focus();
  };

  const closeAsk = (confirmed: boolean): void => {
    const ask = state.ask;
    if (!ask) return;
    const skip = root.querySelector<HTMLInputElement>('#skip-confirm')?.checked ?? false;
    state.ask = null;
    if (!confirmed) return render();
    if (skip) state.skipConfirm = true;
    if (ask.kind === 'fire') doFire(ask.label);
    else doProbe(ask.cell);
  };

  const testOnSolution = (label: string): void => {
    try {
      state.hypothesis = shoot(placedGems(state.solution), label);
      state.notice = `${label} → ${state.hypothesis.exit}, ${RESULT_COLOR_LABELS[state.hypothesis.color]}`;
    } catch {
      state.hypothesis = null;
      state.notice = 'Rayon impossible à suivre : corrigez les gemmes.';
    }
    render();
  };

  /** Applique une modification de la solution : le tir simulé n'est plus à jour. */
  const editSolution = (next: Solution, gem: GemId | null = state.selectedGem): void => {
    if (state.session?.finished) return;
    state.solution = next;
    state.selectedGem = gem;
    state.hypothesis = null;
    render();
  };

  const withSelectedGem = (change: (solution: Solution, gem: GemId) => Solution): void => {
    const gem = state.selectedGem;
    if (gem) editSolution(change(state.solution, gem));
  };

  /** Glisser-déposer d'une gemme, au pointeur (souris ou doigt). */
  const beginDrag = (event: PointerEvent, element: SVGGElement, gem: GemId): void => {
    if (state.session?.finished) return;
    const svg = element.ownerSVGElement;
    if (!svg) return;
    event.preventDefault();
    const start = toBoardPoint(svg, event.clientX, event.clientY);
    const [originX, originY] = gemOrigin(state.solution, gem);
    const { width, height } = gemSize(state.solution, gem);
    let moved = false;

    const delta = (e: PointerEvent): [number, number] => {
      const [x, y] = toBoardPoint(svg, e.clientX, e.clientY);
      return [x - start[0], y - start[1]];
    };
    const onMove = (e: PointerEvent): void => {
      const [dx, dy] = delta(e);
      if (Math.hypot(dx, dy) > 0.2) moved = true;
      element.setAttribute('transform', `translate(${dx} ${dy})`);
      element.classList.add('is-dragging');
    };
    const finish = (e: PointerEvent, cancelled: boolean): void => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      if (cancelled) return render();
      const [dx, dy] = delta(e);
      if (!moved) {
        state.selectedGem = state.selectedGem === gem ? null : gem;
        return render();
      }
      const x = originX + dx;
      const y = originY + dy;
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const onBoard =
        centerX > -0.5 && centerX < GRID_COLS + 0.5 && centerY > -0.5 && centerY < GRID_ROWS + 0.5;
      if (onBoard) {
        editSolution(dropGem(state.solution, gem, x, y), gem);
        state.notice = `${GEM_SHAPES[gem].label} posée`;
      } else {
        editSolution(removeGem(state.solution, gem), null);
        state.notice = `${GEM_SHAPES[gem].label} retirée`;
      }
    };
    const onUp = (e: PointerEvent): void => finish(e, false);
    const onCancel = (e: PointerEvent): void => finish(e, true);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  };

  /** Crayon, gomme et marques de cases sur la grille de notes. */
  const beginNotes = (event: PointerEvent): void => {
    const board = (): SVGSVGElement | null => root.querySelector<SVGSVGElement>('.notes-svg');
    const point = (e: PointerEvent): NotePoint => {
      const svg = board();
      return svg ? toBoardPoint(svg, e.clientX, e.clientY) : [0, 0];
    };
    const start = point(event);
    if (cellAt(start) === null) return;
    event.preventDefault();
    const { tool, ink } = state;
    const base = state.notes;
    let moved = false;
    const points: NotePoint[] = [start];
    let working = base.present;

    const eraseTo = (p: NotePoint): void => {
      const next = eraseAt(working, p);
      if (next === working) return;
      working = next;
      state.notes = { ...base, present: working };
      const layer = root.querySelector('#note-layer');
      if (layer) layer.innerHTML = notesLayerSvg(working);
    };
    if (tool === 'eraser') eraseTo(start);

    const onMove = (e: PointerEvent): void => {
      const p = point(e);
      if (Math.hypot(p[0] - start[0], p[1] - start[1]) > 0.15) moved = true;
      if (tool === 'pencil') {
        const last = points.at(-1) ?? start;
        const inside: NotePoint = [
          Math.min(Math.max(p[0], 0), GRID_COLS),
          Math.min(Math.max(p[1], 0), GRID_ROWS),
        ];
        if (Math.hypot(inside[0] - last[0], inside[1] - last[1]) < 0.06) return;
        points.push(inside);
        root
          .querySelector('#note-preview')
          ?.setAttribute('points', points.map(([x, y]) => `${x},${y}`).join(' '));
      } else if (tool === 'eraser') {
        eraseTo(p);
      }
    };
    const finish = (e: PointerEvent, cancelled: boolean): void => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      state.notes = base;
      if (!cancelled) {
        if (tool === 'pencil') {
          const rounded = points.map(([x, y]): NotePoint => [
            Math.round(x * 100) / 100,
            Math.round(y * 100) / 100,
          ]);
          state.notes = commit(base, addStroke(base.present, { ink, points: rounded }));
        } else if (tool === 'eraser') {
          state.notes = commit(base, working);
        } else if (!moved) {
          const cell = cellAt(point(e));
          if (cell) state.notes = commit(base, toggleMark(base.present, cell, tool));
        }
      }
      render();
    };
    const onUp = (e: PointerEvent): void => finish(e, false);
    const onCancel = (e: PointerEvent): void => finish(e, true);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  };

  // ---------- Événements ----------

  root.addEventListener('pointerdown', (event) => {
    if (event.button > 0) return;
    if (state.tab === 'notes') {
      if ((event.target as Element).closest('.notes-svg')) beginNotes(event);
      return;
    }
    if (state.tab !== 'solution') return;
    const element = (event.target as Element).closest<SVGGElement>('[data-gem]');
    const gem = element?.dataset['gem'] as GemId | undefined;
    if (element && gem) beginDrag(event, element, gem);
  });

  root.addEventListener('click', (event) => {
    const target = event.target as Element;
    if (target.hasAttribute('data-modal-backdrop')) return closeAsk(false);
    const entry = target.closest<HTMLElement>('[data-fire]');
    if (entry?.dataset['fire']) return askFire(entry.dataset['fire']);
    const probeTarget = target.closest<HTMLElement>('[data-probe]');
    if (probeTarget?.dataset['probe']) return askProbe(probeTarget.dataset['probe']);
    const hypo = target.closest<HTMLElement>('[data-hypo]');
    if (hypo?.dataset['hypo']) return testOnSolution(hypo.dataset['hypo']);
    const tab = target.closest<HTMLElement>('[data-tab]')?.dataset['tab'];
    if (tab === 'shots' || tab === 'solution' || tab === 'notes') {
      state.tab = tab;
      return render();
    }
    const tool = target.closest<HTMLElement>('[data-tool]')?.dataset['tool'];
    if (tool) {
      state.tool = tool as Tool;
      return render();
    }
    const ink = target.closest<HTMLElement>('[data-ink]')?.dataset['ink'];
    if (ink) {
      state.ink = ink as Ink;
      if (state.tool !== 'pencil') state.tool = 'pencil';
      return render();
    }
    const shot = target.closest<HTMLElement>('[data-shot]');
    if (shot?.dataset['shot']) {
      state.selected = Number(shot.dataset['shot']);
      return render();
    }
    const action = target.closest<HTMLElement>('[data-action]')?.dataset['action'];
    switch (action) {
      case 'new-game':
        return startGame(randomSeed());
      case 'rotate':
        return withSelectedGem(rotateGem);
      case 'flip':
        return withSelectedGem(flipGem);
      case 'remove':
        if (state.selectedGem) editSolution(removeGem(state.solution, state.selectedGem), null);
        return;
      case 'skip':
        event.preventDefault();
        root.querySelector<HTMLElement>('#plateau')?.focus();
        return;
      case 'resume':
        if (state.pending) {
          const save = state.pending;
          state.session = GameSession.fromSnapshot(save.session);
          state.solution = save.solution;
          state.notes = newHistory(save.notes);
          state.skipConfirm = save.skipConfirm;
          state.pending = null;
          state.phase = 'ready';
          writeSeedToUrl(state.session.seed);
          state.notice = 'Reprise';
        }
        return render();
      case 'discard-save':
        return startGame(seedFromUrl() ?? randomSeed());
      case 'modal-confirm':
        return closeAsk(true);
      case 'modal-cancel':
        return closeAsk(false);
      case 'ask-submit':
        if (state.session && isSubmittable(state.solution)) state.confirm = 'submit';
        return render();
      case 'ask-abandon':
        state.confirm = 'abandon';
        return render();
      case 'cancel-confirm':
        state.confirm = null;
        return render();
      case 'confirm-submit':
        if (state.session && isSubmittable(state.solution)) {
          state.session.submit(placedGems(state.solution));
          return showResult();
        }
        state.confirm = null;
        return render();
      case 'confirm-abandon':
        state.session?.abandon();
        return showResult();
      case 'replay':
        if (state.session) startGame(state.session.seed);
        return;
      case 'undo':
        state.notes = undo(state.notes);
        return render();
      case 'redo':
        state.notes = redo(state.notes);
        return render();
      case 'clear-notes':
        state.notes = commit(state.notes, emptyNotes());
        return render();
      case 'copy-link':
        navigator.clipboard?.writeText(window.location.href).then(
          () => {
            state.notice = 'Lien copié';
            render();
          },
          () => undefined,
        );
    }
  });

  root.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    if (target.dataset['toggle'] !== 'notes') return;
    state.showNotes = target.checked;
    render();
    root.querySelector<HTMLInputElement>('#show-notes')?.focus();
  });

  root.addEventListener('keydown', (event) => {
    const target = event.target as Element;
    if (state.ask) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAsk(false);
      }
      return;
    }
    if (target.closest('[data-cursor]')) {
      const step: Record<string, [number, number]> = {
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
      };
      const move = step[event.key];
      if (move) {
        event.preventDefault();
        state.cursor = {
          row: Math.min(Math.max(state.cursor.row + move[0], 0), GRID_ROWS - 1),
          col: Math.min(Math.max(state.cursor.col + move[1], 0), GRID_COLS - 1),
        };
        render();
        root.querySelector<SVGElement>('[data-cursor]')?.focus();
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        askProbe(cellLabel(state.cursor));
      }
      return;
    }
    const tabButton = target.closest<HTMLElement>('[role="tab"]');
    if (tabButton && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      const tabs = [...root.querySelectorAll<HTMLElement>('[role="tab"]')];
      const index = tabs.indexOf(tabButton);
      const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      const name = next?.dataset['tab'];
      if (name === 'shots' || name === 'solution' || name === 'notes' || name === 'result') {
        event.preventDefault();
        state.tab = name;
        render();
        root.querySelector<HTMLElement>(`[data-tab="${name}"]`)?.focus();
      }
      return;
    }
    if (state.tab === 'notes' && (event.ctrlKey || event.metaKey)) {
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        state.notes = undo(state.notes);
        return render();
      }
      if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        state.notes = redo(state.notes);
        return render();
      }
    }
    const gemElement = target.closest<HTMLElement>('[data-gem]');
    if (gemElement?.dataset['gem'] && state.tab === 'solution') {
      const gem = gemElement.dataset['gem'] as GemId;
      const move = (dCol: number, dRow: number): void => {
        if (state.solution[gem]) editSolution(nudgeGem(state.solution, gem, dCol, dRow), gem);
      };
      const handled = ((): boolean => {
        switch (event.key) {
          case 'ArrowLeft':
            return (move(-1, 0), true);
          case 'ArrowRight':
            return (move(1, 0), true);
          case 'ArrowUp':
            return (move(0, -1), true);
          case 'ArrowDown':
            return (move(0, 1), true);
          case 'r':
          case 'R':
            return (editSolution(rotateGem(state.solution, gem), gem), true);
          case 'f':
          case 'F':
            return (editSolution(flipGem(state.solution, gem), gem), true);
          case 'Delete':
          case 'Backspace':
            return (editSolution(removeGem(state.solution, gem), null), true);
          case 'Enter':
          case ' ':
            return ((state.selectedGem = state.selectedGem === gem ? null : gem), render(), true);
          default:
            return false;
        }
      })();
      if (handled) event.preventDefault();
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const fireEntry = target.closest<HTMLElement>('[data-fire]')?.dataset['fire'];
    const hypoEntry = target.closest<HTMLElement>('[data-hypo]')?.dataset['hypo'];
    if (fireEntry) {
      event.preventDefault();
      askFire(fireEntry);
    } else if (hypoEntry) {
      event.preventDefault();
      testOnSolution(hypoEntry);
    }
  });

  // Chronomètre : met à jour le texte sans refaire tout l'affichage. Le temps écoulé est aussi
  // sauvegardé régulièrement, au cas où la page serait fermée sans prévenir.
  let ticks = 0;
  window.setInterval(() => {
    const session = state.session;
    const timer = root.querySelector('#timer');
    if (session && timer) timer.textContent = formatTime(session.elapsedMs());
    if (++ticks % 15 === 0) persist();
  }, 1000);
  window.addEventListener('hashchange', () => {
    state.view = viewFromHash();
    render();
    if (state.view === 'rules') window.scrollTo(0, 0);
  });
  window.addEventListener('pagehide', persist);
  document.addEventListener('visibilitychange', () => {
    syncClock();
    if (document.visibilityState === 'hidden') persist();
  });

  // Une partie sauvegardée est proposée à la reprise ; sinon on en commence une neuve.
  const saved = store.load();
  if (saved && saved.session.status === 'playing') {
    state.pending = saved;
    state.phase = 'resume';
    render();
  } else {
    startGame(seedFromUrl() ?? randomSeed());
  }
}
