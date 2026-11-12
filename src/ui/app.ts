/**
 * Application : une partie à la fois, avec la grille de tir, la grille de solution et
 * l'historique des tirs. L'état de l'interface est petit : la partie, la solution du joueur,
 * l'onglet affiché et la sélection.
 */
import { RESULT_COLOR_LABELS } from '../game/colors';
import { GRID_COLS, GRID_ROWS } from '../game/constants';
import { GEM_SHAPES, type GemId } from '../game/gems';
import { type ShotResult, shoot } from '../game/laser';
import { randomSeed } from '../game/rng';
import { GameSession, type GameStatus, type ProbeRecord, type ShotRecord } from '../game/session';
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
import { type Tool, notesBoardSvg, notesLayerSvg, notesToolbar } from './notesBoard';
import { RAY_COLOR } from './palette';
import { diffLine, resultBoardSvg } from './resultBoard';
import { browserSaveStore } from './storage';
import { gemOrigin, gemSize, solutionBoardSvg } from './solutionBoard';

type Phase = 'loading' | 'resume' | 'ready' | 'error';
type Tab = 'shots' | 'solution' | 'notes' | 'result';

interface State {
  phase: Phase;
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
  /** Mode « sonder une case » de l'onglet Tirs. */
  probing: boolean;
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

function chip(color: ShotRecord['color']): string {
  return `<span class="chip" style="background:${RAY_COLOR[color]}" aria-hidden="true"></span>`;
}

function describe(shot: ShotRecord): string {
  return `Tir ${shot.n} : du repère ${shot.entry}, le rayon ressort ${RESULT_COLOR_LABELS[shot.color]} en ${shot.exit}.`;
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

const PROBE_TEXT: Record<ProbeRecord['content'], string> = {
  nothing: 'rien',
  red: 'une gemme rouge',
  yellow: 'une gemme jaune',
  blue: 'une gemme bleue',
  white: 'une gemme blanche',
};

const STATUS_TITLE: Record<GameStatus, string> = {
  playing: '',
  won: 'Bravo, mine reconstituée !',
  lost: 'Raté : la proposition était fausse',
  abandoned: 'Partie abandonnée',
};

export function startApp(root: HTMLElement, version: string): void {
  const state: State = {
    phase: 'loading',
    session: null,
    tab: 'shots',
    selected: null,
    solution: emptySolution(),
    selectedGem: null,
    hypothesis: null,
    notes: newHistory(),
    tool: 'pencil',
    ink: 'ink',
    probing: false,
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
      matches,
      hypothesis: state.hypothesis,
    });
    const selected = state.selectedGem;
    const flippable = selected !== null && GEM_SHAPES[selected].flippable;
    const placedSelected = selected !== null && state.solution[selected] !== null;
    const selectionText = selected
      ? `Gemme sélectionnée : ${GEM_SHAPES[selected].label}.`
      : 'Touchez une gemme pour la sélectionner, glissez-la pour la déplacer.';
    const hypothesis = state.hypothesis
      ? `<p class="hypo">Sur votre grille, le tir depuis ${state.hypothesis.entry} ressortirait ${RESULT_COLOR_LABELS[state.hypothesis.color]} en ${state.hypothesis.exit}.</p>`
      : '<p class="hint">Touchez un repère du bord pour tester un tir sur votre grille.</p>';
    const comparison = session.shots.length
      ? `Votre grille reproduit ${matching} tir${plural(matching, '', 's')} sur ${session.shots.length}.`
      : 'Faites quelques tirs pour pouvoir comparer.';
    return `
      ${board}
      <div class="toolbar" role="toolbar" aria-label="Actions sur la gemme sélectionnée">
        <button type="button" data-action="rotate"${placedSelected ? '' : ' disabled'}>↻ Pivoter</button>
        <button type="button" data-action="flip"${placedSelected && flippable ? '' : ' disabled'} title="Seule la gemme rouge peut être retournée">⇋ Retourner</button>
        <button type="button" class="ghost" data-action="remove"${placedSelected ? '' : ' disabled'}>Remettre dans la réserve</button>
      </div>
      <p class="hint">${selectionText}</p>
      <p class="status"><b>${placed}</b> gemme${plural(placed, '', 's')} sur ${total} posée${plural(placed, '', 's')}. ${comparison}</p>
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
    const guessed = placedGems(state.solution).length > 0;
    return `
      <div class="result is-${summary.status}">
        <h2>${STATUS_TITLE[summary.status]}</h2>
        <dl class="stats">
          <div><dt>Lasers</dt><dd>${summary.lasers}</dd></div>
          <div><dt>Sondages</dt><dd>${summary.probes}</dd></div>
          <div><dt>Temps</dt><dd>${formatTime(summary.elapsedMs)}</dd></div>
          <div><dt>Graine</dt><dd>${summary.seed}</dd></div>
        </dl>
        ${resultBoardSvg(diffs)}
        <p class="hint">Les gemmes pleines sont la vraie mine${guessed ? ' ; les contours en pointillés sont votre proposition (vert : bien placée, rouge : à corriger)' : ''}.</p>
        <ul class="diff">${diffs.map((diff) => `<li class="${diff.status}">${diffLine(diff)}</li>`).join('')}</ul>
        <div class="actions">
          <button type="button" data-action="new-game">Nouvelle partie</button>
          <button type="button" class="ghost" data-action="replay">Rejouer cette mine</button>
        </div>
      </div>`;
  };

  /** Soumettre ou abandonner, avec confirmation car l'action est définitive. */
  const actionsPanel = (session: GameSession): string => {
    if (session.finished) return '';
    if (state.confirm === 'submit') {
      return `<div class="confirm" role="alertdialog" aria-label="Confirmer la soumission"><p>Soumettre cette solution ? Une erreur met fin à la partie.</p><div class="actions"><button type="button" data-action="confirm-submit">Oui, soumettre</button><button type="button" class="ghost" data-action="cancel-confirm">Annuler</button></div></div>`;
    }
    if (state.confirm === 'abandon') {
      return `<div class="confirm" role="alertdialog" aria-label="Confirmer l'abandon"><p>Abandonner la partie et révéler la mine ?</p><div class="actions"><button type="button" data-action="confirm-abandon">Oui, abandonner</button><button type="button" class="ghost" data-action="cancel-confirm">Annuler</button></div></div>`;
    }
    const ready = isSubmittable(state.solution);
    return `<div class="actions"><button type="button" data-action="ask-submit"${ready ? '' : ' disabled'}>Soumettre ma solution</button><button type="button" class="ghost" data-action="ask-abandon">Abandonner</button></div>${ready ? '' : '<p class="hint">Pour soumettre : posez les 5 gemmes sans enfreindre de règle (onglet « Ma solution »).</p>'}`;
  };

  const probePanel = (session: GameSession): string => {
    if (session.finished) return '';
    return `<div class="notes-tools"><button type="button" class="tool" data-action="toggle-probe" aria-pressed="${state.probing}">Sonder une case</button></div>${
      state.probing
        ? `<form class="probe-form" data-form="probe"><label for="probe-input">Case à sonder</label><input id="probe-input" name="cell" type="text" inputmode="text" autocomplete="off" maxlength="3" placeholder="E4" /><button type="submit">Sonder</button></form><p class="hint">Touchez une case de la grille, ou saisissez son nom. Une sonde se compte à part des lasers.</p>`
        : '<p class="hint">« Qu\'y a-t-il en E4 ? » : la réponse est « rien » ou la couleur de la gemme.</p>'
    }`;
  };

  const resumePanel = (save: SaveData): string => {
    const { session } = save;
    const when = new Date(save.savedAt).toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    return `
      <div class="resume" role="alertdialog" aria-label="Reprendre la partie en cours">
        <h2>Une partie est en cours</h2>
        <p>Mine <b>${session.mine.seed}</b> : ${session.shots.length} laser${plural(session.shots.length, '', 's')}, ${session.probes.length} sondage${plural(session.probes.length, '', 's')}, ${formatTime(session.elapsedMs)} de jeu. Sauvegardée le ${when}.</p>
        <div class="actions">
          <button type="button" data-action="resume">Reprendre la partie</button>
          <button type="button" class="ghost" data-action="discard-save">Nouvelle partie</button>
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
    });
  };

  const render = (): void => {
    const { session } = state;
    const shots = session?.shots ?? [];
    let board: string;
    if (state.phase === 'ready' && session) {
      if (state.tab === 'shots') {
        board = `${shotBoardSvg(
          { shots, selected: state.selected },
          { probes: session.probes, probing: state.probing && !session.finished },
        )}${probePanel(session)}`;
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
        state.phase === 'error' ? 'La génération a échoué.' : 'Génération de la mine…'
      }</p>`;
    }

    const history = shots.length
      ? `<ol class="history">${shots
          .map(
            (shot) =>
              `<li><button type="button" class="shot${state.selected === shot.n ? ' is-selected' : ''}" data-shot="${shot.n}"><span class="n">${shot.n}</span><span class="path"><b>${shot.entry}</b> → <b>${shot.exit}</b></span>${chip(shot.color)}<span class="color-name">${RESULT_COLOR_LABELS[shot.color]}</span></button></li>`,
          )
          .join('')}</ol>`
      : '<p class="hint">Touchez un repère du bord pour tirer un laser.</p>';

    const count = session?.laserCount ?? 0;
    const probeCount = session?.probes.length ?? 0;
    const probeHistory = probeCount
      ? `<h2>Sondages</h2><ul class="probe-list">${(session?.probes ?? [])
          .map((probe) => `<li><b>${probe.cell}</b> : ${PROBE_TEXT[probe.content]}</li>`)
          .join('')}</ul>`
      : '';
    root.innerHTML = `
      <main class="app">
        <header class="top">
          <div>
            <p class="badge">Version ${version}</p>
            <h1>Orapa Training</h1>
          </div>
          <div class="seed-box">
            <span class="seed-label">Graine</span>
            <code class="seed">${session?.seed ?? '…'}</code>
            <button type="button" class="ghost" data-action="copy-link"${session ? '' : ' disabled'}>Copier le lien</button>
            <button type="button" data-action="new-game">Nouvelle partie</button>
          </div>
        </header>
        ${store.available ? '' : '<p class="warning" role="status">La sauvegarde automatique est indisponible dans ce navigateur (navigation privée ?) : la partie ne sera pas conservée si vous fermez la page.</p>'}
        <div class="play">
          <section class="board-wrap" aria-label="Plateau">
            <div class="tabs" role="tablist">
              <button type="button" role="tab" class="tab${state.tab === 'shots' ? ' is-active' : ''}" aria-selected="${state.tab === 'shots'}" data-tab="shots">Tirs</button>
              <button type="button" role="tab" class="tab${state.tab === 'solution' ? ' is-active' : ''}" aria-selected="${state.tab === 'solution'}" data-tab="solution">Ma solution</button>
              <button type="button" role="tab" class="tab${state.tab === 'notes' ? ' is-active' : ''}" aria-selected="${state.tab === 'notes'}" data-tab="notes">Notes</button>${
                session?.finished
                  ? `<button type="button" role="tab" class="tab${state.tab === 'result' ? ' is-active' : ''}" aria-selected="${state.tab === 'result'}" data-tab="result">Résultat</button>`
                  : ''
              }
            </div>
            ${board}
          </section>
          <aside class="side">
            <div class="counter"><span class="count">${count}</span><span class="count-label">laser${plural(count, '', 's')} tiré${plural(count, '', 's')}</span></div>
            <p class="meta">${probeCount} sondage${plural(probeCount, '', 's')} · <span class="timer-label">temps</span> <span id="timer">${formatTime(session?.elapsedMs() ?? 0)}</span></p>
            ${session ? actionsPanel(session) : ''}
            <h2>Historique des tirs</h2>
            ${history}
            ${probeHistory}
          </aside>
        </div>
        <p class="sr-only" aria-live="polite">${state.notice}</p>
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
    state.probing = false;
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

  const fire = (label: string): void => {
    if (!state.session || state.session.finished) return;
    const shot = state.session.fire(label);
    state.selected = shot.n;
    state.notice = describe(shot);
    render();
  };

  const probe = (label: string): void => {
    const { session } = state;
    if (!session || session.finished) return;
    try {
      const record = session.probe(label);
      state.notice = `Case ${record.cell} : ${PROBE_TEXT[record.content]}.`;
    } catch {
      state.notice = `« ${label} » n'est pas une case : indiquez une ligne de A à H puis une colonne de 1 à 10, par exemple E4.`;
    }
    render();
  };

  /** Termine la partie et affiche le résultat. */
  const showResult = (): void => {
    store.clear();
    state.confirm = null;
    state.probing = false;
    state.tab = 'result';
    state.notice = state.session ? STATUS_TITLE[state.session.status] : '';
    render();
  };

  const testOnSolution = (label: string): void => {
    try {
      state.hypothesis = shoot(placedGems(state.solution), label);
      state.notice = `Sur votre grille, le tir depuis ${label} ressortirait ${RESULT_COLOR_LABELS[state.hypothesis.color]} en ${state.hypothesis.exit}.`;
    } catch {
      state.hypothesis = null;
      state.notice = "Impossible de suivre le rayon : corrigez d'abord les gemmes mal placées.";
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
        state.notice = `${GEM_SHAPES[gem].label} posée.`;
      } else {
        editSolution(removeGem(state.solution, gem), null);
        state.notice = `${GEM_SHAPES[gem].label} remise dans la réserve.`;
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
    const entry = target.closest<HTMLElement>('[data-fire]');
    if (entry?.dataset['fire']) return fire(entry.dataset['fire']);
    const probeTarget = target.closest<HTMLElement>('[data-probe]');
    if (probeTarget?.dataset['probe']) return probe(probeTarget.dataset['probe']);
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
      case 'resume':
        if (state.pending) {
          const save = state.pending;
          state.session = GameSession.fromSnapshot(save.session);
          state.solution = save.solution;
          state.notes = newHistory(save.notes);
          state.pending = null;
          state.phase = 'ready';
          writeSeedToUrl(state.session.seed);
          state.notice = 'Partie reprise.';
        }
        return render();
      case 'discard-save':
        return startGame(seedFromUrl() ?? randomSeed());
      case 'toggle-probe':
        state.probing = !state.probing;
        return render();
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
            state.notice = 'Lien copié.';
            render();
          },
          () => undefined,
        );
    }
  });

  root.addEventListener('submit', (event) => {
    const form = event.target as HTMLFormElement;
    if (form.dataset['form'] !== 'probe') return;
    event.preventDefault();
    const input = form.querySelector<HTMLInputElement>('input[name="cell"]');
    if (input?.value.trim()) probe(input.value);
  });

  root.addEventListener('keydown', (event) => {
    const target = event.target as Element;
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
      fire(fireEntry);
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
  window.addEventListener('pagehide', persist);
  document.addEventListener('visibilitychange', () => {
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
