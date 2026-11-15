/**
 * Application : une partie à la fois, avec la grille de tir, la grille de solution et
 * l'historique des tirs. L'état de l'interface est petit : la partie, la solution du joueur,
 * l'onglet affiché et la sélection.
 */
import { RESULT_COLOR_LABELS, componentColors } from '../game/colors';
import { cellLabel } from '../game/board';
import { GRID_COLS, GRID_ROWS } from '../game/constants';
import {
  type Extensions,
  GEM_SHAPES,
  type GemId,
  NO_EXTENSIONS,
  extensionsOf,
  gemsFor,
} from '../game/gems';
import { type ShotResult, isAbsorbed, shoot } from '../game/laser';
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
import { INK_COLOR, INK_LABEL, RAY_COLOR, lostSignalHtml } from './palette';
import { diffLine, resultBoardSvg } from './resultBoard';
import type { AccountUser } from '../backend/auth';
import type { Backend } from '../backend';
import type { HistoryFilter, HistorySort } from '../backend/games';
import { type ProgressSync, createProgressSync } from '../backend/sync';
import {
  type GameRecord,
  MAX_PLAYING,
  type PlayingSummary,
  buildProgress,
  extensionsCode,
  extensionsFromCode,
  type ProfileStats,
  buildRecord,
  parseRow,
  recordToRow,
} from '../game/record';
import { browserOutbox } from '../backend/outbox';
import { formatTime, plural } from './format';
import { escapeHtml } from './html';
import { headerHtml } from './header';
import { homePage } from './home';
import { type View, parseRoute, routeHash } from './router';
import { privacyPage } from './privacy';
import { profilePage } from './profile';
import { historyPage, isHistoryFilter, isHistorySort, pageCount } from './history';
import { rulesPage } from './rules';
import { browserSaveStore } from './storage';
import { t } from './strings';
import { type ImmersiveTool, immersiveBoardSvg } from './immersiveBoard';
import { gemOrigin, gemSize, solutionBoardSvg } from './solutionBoard';

type Phase = 'idle' | 'loading' | 'options' | 'ready' | 'error';
type Tab = 'shots' | 'solution' | 'notes' | 'result';
type Ask =
  | { kind: 'fire'; label: string }
  | { kind: 'probe'; cell: string }
  /** Résumé d'un tir déjà fait (numéro du tir) : aucune action, il se ferme d'un clic. */
  | { kind: 'recap'; n: number };

interface State {
  phase: Phase;
  /** Page affichée : la partie, les règles (« #regles ») ou l'historique (« #historique »). */
  view: View;
  session: GameSession | null;
  tab: Tab;
  /** Tir mis en avant dans l'historique. */
  selected: number | null;
  solution: Solution;
  selectedGem: GemId | null;
  /** Tir simulé sur la grille du joueur. */
  hypothesis: ShotResult | null;
  /** Laser tiré après la fin de la partie, dans la mine révélée. */
  explored: ShotResult | null;
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
  /** Mode plein écran (paysage) : tout sur une seule grille. */
  immersive: boolean;
  /** Outil actif du mode plein écran. */
  itool: ImmersiveTool;
  /** Action définitive en attente de confirmation. */
  confirm: 'submit' | 'abandon' | null;
  /** Choix des extensions en cours (fenêtre de début de partie) ; null quand elle est fermée. */
  choose: Extensions | null;
  /** Message « signal perdu » affiché un instant. */
  toast: boolean;
  notice: string;
  /** Backend branché (v2) ; null tant qu'il n'est pas chargé ou si le site n'est pas configuré. */
  backend: Backend | null;
  /** Compte Google connecté, ou null. */
  account: AccountUser | null;
  /** Vrai quand la session enregistrée a été lue (avant : on ne sait pas encore si on est connecté). */
  authReady: boolean;
  /** Identité de la partie en cours (historique) ; null hors partie. */
  game: {
    id: string;
    startedAt: number;
    /** Compte auquel la partie était reliée au dernier enregistrement local (voir SaveData.owner). */
    owner?: string;
    /** La partie est synchronisée avec le compte connecté. */
    synced: boolean;
    /**
     * Partie lancée avant que le compte soit connu (lien partagé, au chargement de la page) : si un
     * compte apparaît, elle lui est reliée d'office.
     */
    autoImport?: boolean;
  } | null;
  /** Parties en cours du compte, sur le serveur. */
  playing: { status: 'idle' | 'loading' | 'ready' | 'error'; games: PlayingSummary[] };
  /** Partie du compte dont l'abandon attend confirmation (accueil). */
  confirmRemote: string | null;
  /** Envoi de la partie terminée à l'historique : null (rien à envoyer), en attente, enregistrée. */
  recorded: 'pending' | 'saved' | null;
  history: {
    filter: HistoryFilter;
    sort: HistorySort;
    page: number;
    status: 'loading' | 'ready' | 'error';
    games: GameRecord[];
    total: number;
  };
  profile: { status: 'loading' | 'ready' | 'error'; stats: ProfileStats | null };
  /** Suppression du compte (page Confidentialité). */
  deletion: 'idle' | 'confirm' | 'busy' | 'error';
}

const HISTORY_PAGE_SIZE = 20;

/** Identifiant d'une partie : un UUID tiré par le navigateur. */
function newGameId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    const hex = (n: number): string =>
      Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
  }
}

function seedFromUrl(): string | null {
  try {
    const seed = new URLSearchParams(window.location.search).get('seed')?.trim();
    return seed ? seed : null;
  } catch {
    return null;
  }
}

/** Extensions demandées par l'adresse : `ext=d` (Diamant), `ext=n` (Corps noir), `ext=dn` (les deux). */
function extensionsFromUrl(): Extensions {
  try {
    const flags = new URLSearchParams(window.location.search).get('ext') ?? '';
    return { diamond: flags.includes('d'), blackBody: flags.includes('n') };
  } catch {
    return NO_EXTENSIONS;
  }
}

function writeSeedToUrl(seed: string, extensions: Readonly<Extensions> = NO_EXTENSIONS): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('seed', seed);
    const flags = `${extensions.diamond ? 'd' : ''}${extensions.blackBody ? 'n' : ''}`;
    if (flags) url.searchParams.set('ext', flags);
    else url.searchParams.delete('ext');
    window.history.replaceState(null, '', url);
  } catch {
    // L'adresse reste telle quelle : sans conséquence pour le jeu.
  }
}

/** Extensions d'une partie du compte, d'après son code (`d`, `n`, `dn`). */
function extensionsLabelOfCode(code: string): string {
  const { diamond, blackBody } = extensionsFromCode(code);
  const names = [diamond ? t.extensions.diamond : '', blackBody ? t.extensions.blackBody : ''];
  return names.filter(Boolean).join(' · ') || t.extensions.none;
}

/** Pictogramme « plein écran » (quatre coins). */
const FULLSCREEN_ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function viewFromHash(): View {
  try {
    return parseRoute(window.location.hash);
  } catch {
    return 'home';
  }
}

/** Retire la graine de l'adresse (partie terminée ou lien ignoré) : un rechargement ne relance rien. */
function clearSeedFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('seed');
    url.searchParams.delete('ext');
    window.history.replaceState(null, '', url);
  } catch {
    // L'adresse reste telle quelle : sans conséquence pour le jeu.
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

/** Résultat d'un tir en toutes lettres : « E → 4, bleu » ou « E → signal perdu ». */
function outcomeText(outcome: Pick<ShotRecord, 'entry' | 'exit' | 'color'>): string {
  return isAbsorbed(outcome)
    ? `${outcome.entry} → ${t.lostSignal.toLowerCase()}`
    : `${outcome.entry} → ${outcome.exit}, ${RESULT_COLOR_LABELS[outcome.color]}`;
}

/** Même résultat, avec le pictogramme pour un rayon absorbé (sous la grille). */
function outcomeHtml(outcome: Pick<ShotRecord, 'entry' | 'exit' | 'color'>): string {
  return isAbsorbed(outcome)
    ? `${outcome.entry} → ${lostSignalHtml()} ${t.lostSignal.toLowerCase()}`
    : `${outcome.entry} → ${outcome.exit} · ${RESULT_COLOR_LABELS[outcome.color]}`;
}

function describe(shot: ShotRecord): string {
  return `${shot.n} : ${outcomeText(shot)}`;
}

/** Extensions en jeu, en quelques mots : « Sans extension », « Diamant », « Diamant · Corps noir »... */
function extensionsLabel(gems: readonly GemId[]): string {
  const { diamond, blackBody } = extensionsOf(gems);
  const names = [diamond ? t.extensions.diamond : '', blackBody ? t.extensions.blackBody : ''];
  return names.filter(Boolean).join(' · ') || t.extensions.none;
}

/** Point de l'écran converti en coordonnées de la grille (unité : la case). */
function toBoardPoint(svg: SVGSVGElement, clientX: number, clientY: number): [number, number] {
  const matrix = svg.getScreenCTM();
  if (!matrix) return [0, 0];
  const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  return [point.x, point.y];
}

export interface App {
  /** Branche le backend (connexion Google) une fois chargé ; sans lui le site reste en mode v1. */
  attachBackend(backend: Backend): void;
  /** Le backend, configuré, n'a pas pu se charger : le site continue sans compte. */
  backendUnavailable(): void;
}

export interface AppOptions {
  /** Le site est configuré pour utiliser un compte (le backend va se charger) : les pages de compte attendent. */
  accountsConfigured?: boolean;
}

export function startApp(
  root: HTMLElement,
  version: string,
  { accountsConfigured = false }: AppOptions = {},
): App {
  let accountsExpected = accountsConfigured;
  const state: State = {
    phase: 'idle',
    view: viewFromHash(),
    session: null,
    tab: 'shots',
    selected: null,
    solution: emptySolution(),
    selectedGem: null,
    hypothesis: null,
    explored: null,
    notes: newHistory(),
    tool: 'pencil',
    ink: 'ink',
    ask: null,
    skipConfirm: false,
    cursor: { row: 0, col: 0 },
    showNotes: true,
    immersive: false,
    itool: 'move',
    confirm: null,
    choose: null,
    toast: false,
    notice: '',
    backend: null,
    account: null,
    authReady: false,
    game: null,
    playing: { status: 'idle', games: [] },
    confirmRemote: null,
    recorded: null,
    history: { filter: 'all', sort: 'recent', page: 0, status: 'loading', games: [], total: 0 },
    profile: { status: 'loading', stats: null },
    deletion: 'idle',
  };
  const store = browserSaveStore();
  const outbox = browserOutbox();

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
      notes: state.showNotes ? state.notes.present : null,
    });
    const hypothesis = state.hypothesis
      ? `<p class="hypo">${outcomeHtml(state.hypothesis)}</p>`
      : '';
    const status = `${placed}/${total}${session.shots.length ? ` · ${matching}/${session.shots.length} tirs` : ''}`;
    return `
      ${board}
      ${optionsPanel()}
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
        ${recordStatusHtml()}
        ${resultBoardSvg(diffs, session.shots, state.explored)}
        ${state.explored ? `<p class="hypo">${outcomeHtml(state.explored)}</p>` : ''}
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
    return `<div class="actions"><button type="button" data-action="ask-submit"${ready ? '' : ' disabled title="Toutes les gemmes, bien placées"'}>${t.actions.submit}</button><button type="button" class="ghost" data-action="ask-abandon">${t.actions.abandon}</button></div>`;
  };

  /** Sous la grille de tir : afficher ou non les notes en transparence. */
  const optionsPanel = (): string =>
    `<div class="notes-tools"><label class="check"><input type="checkbox" id="show-notes" data-toggle="notes"${state.showNotes ? ' checked' : ''} />${t.actions.showNotes}</label></div>`;

  /** Message « signal perdu », quelques secondes, quand le Corps noir absorbe un rayon ou une sonde. */
  const toastHtml = (): string =>
    state.toast
      ? `<div class="toast" role="status">${lostSignalHtml()}<span>${t.lostSignal}</span></div>`
      : '';

  let toastTimer: number | undefined;
  /** Affiche le message sans refaire l'affichage au moment de le retirer. */
  const showLostSignal = (): void => {
    state.toast = true;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      state.toast = false;
      root.querySelector('.toast')?.remove();
    }, 2600);
  };

  /** Fenêtre de début de partie : quelles extensions jouer ? */
  const optionsModal = (choose: Extensions): string => {
    return `<div class="modal-backdrop" data-options-backdrop><div class="modal" role="dialog" aria-modal="true" aria-label="${t.options.title}"><p class="modal-title">${t.options.title}</p><label class="check"><input type="checkbox" id="ext-diamond"${choose.diamond ? ' checked' : ''} />${t.options.diamond}</label><label class="check"><input type="checkbox" id="ext-black"${choose.blackBody ? ' checked' : ''} />${t.options.blackBody}</label><div class="actions"><button type="button" data-action="start-game">${t.options.play}</button><button type="button" class="ghost" data-action="cancel-options">${t.modal.cancel}</button></div></div></div>`;
  };

  /** Fenêtre modale de confirmation d'un tir ou d'une sonde. */
  const modal = (): string => {
    const { ask } = state;
    if (state.choose) return optionsModal(state.choose);
    if (!ask) return '';
    if (ask.kind === 'recap') return recapModal(ask.n);
    const title = ask.kind === 'fire' ? t.modal.fire(ask.label) : t.modal.probe(ask.cell);
    return `<div class="modal-backdrop" data-modal-backdrop><div class="modal" role="dialog" aria-modal="true" aria-label="${title}"><p class="modal-title">${title}</p><label class="check"><input type="checkbox" id="skip-confirm" />${t.modal.dontAsk}</label><div class="actions"><button type="button" data-action="modal-confirm">${t.modal.confirm}</button><button type="button" class="ghost" data-action="modal-cancel">${t.modal.cancel}</button></div></div></div>`;
  };

  /** Résumé d'un tir déjà fait : « E → F » et les pastilles de la couleur obtenue. Un clic n'importe où le ferme. */
  const recapModal = (n: number): string => {
    const shot = state.session?.shots.find((candidate) => candidate.n === n);
    if (!shot) return '';
    const lost = isAbsorbed(shot);
    const route = lost ? `${shot.entry} → ${lostSignalHtml()}` : `${shot.entry} → ${shot.exit}`;
    const result = lost
      ? t.lostSignal
      : shot.color === 'transparent'
        ? RESULT_COLOR_LABELS[shot.color]
        : chips(shot.color);
    return `<div class="modal-backdrop" data-modal-backdrop data-recap><div class="modal recap" role="dialog" aria-modal="true" aria-label="${outcomeText(shot)}"><button type="button" class="modal-close" data-action="modal-cancel" aria-label="${t.modal.close}">×</button><p class="modal-title">${route}</p><p class="recap-result">${result}</p></div></div>`;
  };

  let sync: ProgressSync | null = null;

  /**
   * Sauvegarde automatique de la partie en cours (rien à sauvegarder une fois terminée), et, si elle
   * est reliée au compte, signalement de sa dernière version au module de synchronisation (qui espace
   * les envois et n'envoie que ce qui a changé).
   */
  const persist = (): void => {
    const { session, game } = state;
    if (state.phase !== 'ready' || !session || session.finished) return;
    const synced = game?.synced === true && state.account !== null;
    const save: SaveData = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      session: session.toSnapshot(),
      solution: state.solution,
      notes: state.notes.present,
      skipConfirm: state.skipConfirm,
      ...(game ? { gameId: game.id, startedAt: game.startedAt } : {}),
      ...(synced && state.account ? { owner: state.account.id } : {}),
    };
    store.save(save);
    if (synced && game && sync) {
      sync.push(buildProgress({ id: game.id, save, startedAt: game.startedAt }));
    }
  };

  /** Le chronomètre ne tourne que pendant qu'on joue : pas pendant la lecture des règles ni page cachée. */
  const syncClock = (): void => {
    const session = state.session;
    if (!session) return;
    if (state.view === 'game' && document.visibilityState === 'visible') session.resume();
    else session.pause();
  };

  /** Bouton d'outil du mode plein écran. */
  const hudTool = (tool: ImmersiveTool, label: string, extra = ''): string =>
    `<button type="button" class="tool" data-itool="${tool}" aria-pressed="${state.itool === tool}"${extra}>${label}</button>`;

  /** Colonne d'outils à droite de la grille en plein écran. */
  const immersiveHud = (session: GameSession): string => {
    const inks = (['ink', 'red', 'yellow', 'blue'] as const)
      .map(
        (name) =>
          `<button type="button" class="ink" data-ink="${name}" aria-pressed="${state.ink === name}" aria-label="Encre ${INK_LABEL[name]}"><span style="background:${INK_COLOR[name]}" aria-hidden="true"></span></button>`,
      )
      .join('');
    const count = session.shotCount;
    return `
      <aside class="immersive-hud" aria-label="Outils">
        <div class="hud-top">
          <button type="button" class="ghost" data-action="exit-immersive" aria-label="Quitter le plein écran">✕</button>
          <span class="hud-meta"><b>${count}</b> tir${plural(count, '', 's')} · <span id="timer">${formatTime(session.elapsedMs())}</span></span>
        </div>
        <div class="hud-grid">
          ${hudTool('move', 'Jouer')}
          ${hudTool('pencil', 'Crayon')}
          ${hudTool('eraser', 'Gomme')}
          ${hudTool('empty', '<span class="empty-swatch" aria-hidden="true"></span>Vide', ' aria-label="Case vide"')}
        </div>
        <div class="hud-inks" role="group" aria-label="Couleur du crayon">${inks}</div>
        <div class="hud-grid">
          <button type="button" class="ghost" data-action="undo" aria-label="Annuler"${state.notes.past.length ? '' : ' disabled'}>↶</button>
          <button type="button" class="ghost" data-action="redo" aria-label="Rétablir"${state.notes.future.length ? '' : ' disabled'}>↷</button>
        </div>
        ${actionsPanel(session)}
      </aside>`;
  };

  const renderImmersive = (session: GameSession): void => {
    const board = immersiveBoardSvg({
      solution: state.solution,
      selected: state.selectedGem,
      issues: solutionIssues(state.solution),
      shots: session.shots,
      probes: session.probes,
      notes: state.notes.present,
      tool: state.itool,
      ink: state.ink,
      finished: session.finished,
    });
    root.innerHTML = `
      <div class="immersive" role="application" aria-label="Plein écran">
        <div class="immersive-board">${board}</div>
        ${immersiveHud(session)}
        <div class="rotate-hint" aria-hidden="true">↻ Paysage</div>
        <p class="sr-only" aria-live="polite">${state.notice}</p>
        ${toastHtml()}
        ${modal()}
      </div>`;
  };

  /** Une partie est en cours dans cette fenêtre (chargée ou sauvegardée) : pas terminée, pas abandonnée. */
  const inProgress = (): boolean =>
    state.session !== null && state.phase === 'ready' && !state.session.finished;

  /**
   * Dix parties en cours sur le compte : plus de nouvelle partie tant qu'on n'en termine pas une.
   * Une partie locale pas encore importée compte aussi (elle le sera avant d'en lancer une autre).
   */
  const limitReached = (): boolean =>
    state.account !== null &&
    state.playing.games.length + (inProgress() && state.game?.synced === false ? 1 : 0) >=
      MAX_PLAYING;

  /** « Nouvelle partie » indisponible : sans compte, une seule partie à la fois. */
  const newGameBlocked = (): boolean => (state.account === null && inProgress()) || limitReached();

  /** La vue Partie n'a de sens que s'il y a une partie (ou qu'elle se génère). */
  const gameAvailable = (): boolean =>
    state.session !== null || state.phase === 'loading' || state.phase === 'error';

  /** Barre du haut + contenu + éléments communs (modale, annonces pour lecteurs d'écran). */
  const page = (body: string, before = ''): string => `${before}${headerHtml({
    version,
    view: state.view,
    newGameBlocked: newGameBlocked(),
    accountReady: state.backend !== null && state.authReady,
    user: state.account,
  })}
      <main class="app">${body}</main>
      <p class="sr-only" aria-live="polite">${state.notice}</p>
      ${toastHtml()}
      ${modal()}`;

  const homeGame = (session: GameSession) => ({
    seed: session.seed,
    extensions: extensionsLabel(session.gems),
    shots: session.shotCount,
    elapsedMs: session.elapsedMs(),
  });

  const render = (): void => {
    syncClock();
    document.documentElement.classList.toggle(
      'is-immersive',
      state.immersive && state.view === 'game',
    );
    if (
      state.immersive &&
      state.view === 'game' &&
      state.phase === 'ready' &&
      state.session &&
      !state.session.finished
    ) {
      renderImmersive(state.session);
      persist();
      return;
    }
    if (state.view === 'rules') {
      root.innerHTML = page(rulesPage());
      return;
    }
    if (state.view === 'privacy') {
      root.innerHTML = page(
        privacyPage({
          backend: state.backend !== null,
          signedIn: state.account !== null,
          deletion: state.deletion,
        }),
      );
      return;
    }
    if ((state.view === 'history' || state.view === 'profile') && !state.backend) {
      if (accountsExpected) {
        // Le backend se charge : on attend de savoir si l'on est connecté.
        root.innerHTML = page(
          `<article class="history-page"><p class="placeholder" role="status">${t.history.loading}</p></article>`,
        );
        return;
      }
      // Site sans compte : ces pages n'existent pas, on retombe sur l'accueil.
      state.view = 'home';
    }
    if (state.view === 'history' || state.view === 'profile') {
      let body: string;
      if (!state.authReady) {
        body = `<article class="history-page"><p class="placeholder" role="status">${t.history.loading}</p></article>`;
      } else if (state.view === 'history') {
        body = historyPage({
          signedIn: state.account !== null,
          ...state.history,
          pageSize: HISTORY_PAGE_SIZE,
        });
      } else {
        body = profilePage({ user: state.account, ...state.profile });
      }
      root.innerHTML = page(body);
      return;
    }
    if (state.view === 'game' && !gameAvailable()) state.view = 'home';
    if (state.view === 'home') {
      const current = inProgress() && state.session ? homeGame(state.session) : null;
      root.innerHTML = page(
        homePage({
          current,
          confirmAbandon: state.confirm === 'abandon' && current !== null,
          newGameBlocked: newGameBlocked(),
          accounts: state.backend !== null,
          signedIn: state.account !== null,
          canImport: current !== null && state.account !== null && state.game?.synced === false,
          // La partie chargée dans cette fenêtre est déjà montrée en haut : pas de doublon dans la liste.
          others: state.playing.games
            .filter((game) => !(current && game.id === state.game?.id))
            .map((game) => ({
              id: game.id,
              seed: game.seed,
              extensions: extensionsLabelOfCode(game.extensions),
              shots: game.lasersCount + game.probesCount,
              elapsedMs: game.durationS * 1000,
              updatedAt: game.updatedAt,
            })),
          othersStatus: state.playing.status,
          confirmRemote: state.confirmRemote,
          limitReached: limitReached(),
        }),
      );
      persist();
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
        const view = {
          history: state.notes,
          shots,
          gems: placedGems(state.solution),
          tool: state.tool,
          ink: state.ink,
        };
        board = `${notesBoardSvg(view)}${notesToolbar(view)}`;
      }
    } else {
      board = `<p class="placeholder" role="status">${
        state.phase === 'error' ? 'Échec de la génération.' : 'Génération…'
      }</p>`;
    }

    const history = shots.length
      ? `<ol class="history" aria-label="Tirs">${shots
          .map(
            (shot) =>
              `<li><button type="button" class="shot${state.selected === shot.n ? ' is-selected' : ''}" data-shot="${shot.n}"><span class="n">${shot.n}</span><span class="path"><b>${shot.entry}</b> → ${isAbsorbed(shot) ? lostSignalHtml() : `<b>${shot.exit}</b>`}</span>${chips(shot.color)}<span class="color-name">${isAbsorbed(shot) ? t.lostSignal.toLowerCase() : RESULT_COLOR_LABELS[shot.color]}</span></button></li>`,
          )
          .join('')}</ol>`
      : '';

    const count = session?.shotCount ?? 0;
    const extensions = session ? extensionsLabel(session.gems) : '';
    const probeHistory = session?.probes.length
      ? `<ul class="probe-list" aria-label="Sondages">${(session?.probes ?? [])
          .map(
            (probe) =>
              `<li><b>${probe.cell}</b> · ${probe.content === 'black' ? `${lostSignalHtml()} ` : ''}${t.probe[probe.content]}</li>`,
          )
          .join('')}</ul>`
      : '';
    const gameBar = `
        <div class="gamebar">
          <code class="seed" title="Graine">${session ? escapeHtml(session.seed) : '…'}</code>${
            extensions
              ? `
          <span class="ext-chip" title="Extensions">${extensions}</span>`
              : ''
          }
          <button type="button" class="ghost" data-action="copy-link" title="${t.actions.copyLinkHint}"${session ? '' : ' disabled'}>${t.actions.copyLink}</button>
          <button type="button" class="ghost icon-btn fs-btn" data-action="enter-immersive" aria-label="${t.actions.fullscreen}" title="${t.actions.fullscreen}"${session && !session.finished ? '' : ' disabled'}>${FULLSCREEN_ICON}</button>
        </div>`;
    root.innerHTML = page(
      `${gameBar}
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
            <div class="counter"><span class="count">${count}</span><span class="count-label">tir${plural(count, '', 's')}</span></div>
            <p class="meta"><span id="timer">${formatTime(session?.elapsedMs() ?? 0)}</span></p>
            ${session ? actionsPanel(session) : ''}
            ${history}
            ${probeHistory}
          </aside>
        </div>
        ${state.backend ? `<footer class="foot"><a class="nav-link" href="${routeHash('privacy')}">${t.privacy.link}</a></footer>` : ''}`,
      `<a class="skip-link" href="#plateau" data-action="skip">${t.skipToContent}</a>`,
    );
    persist();
  };

  // ---------- Actions ----------

  /** Affiche la page : charge ce qu'elle montre (historique, profil) puis dessine. */
  const enterView = (view: View): void => {
    if (view === 'history') loadHistory();
    if (view === 'profile') loadProfile();
    if (view === 'home') loadPlayingList();
    render();
    if (view !== 'game') window.scrollTo(0, 0);
  };

  /** Va à une page et met son adresse dans la barre du navigateur (le bouton Retour marche). */
  const navigate = (view: View): void => {
    state.confirm = null;
    leaveImmersive();
    state.view = view;
    const hash = routeHash(view);
    if (window.location.hash !== hash) window.location.hash = hash;
    enterView(view);
  };

  /** Adresse qui relance la mine en cours (graine et extensions), à partager ou à rouvrir plus tard. */
  const shareLink = (): string => {
    const url = new URL(window.location.href);
    url.hash = '';
    url.search = '';
    if (state.session) {
      url.searchParams.set('seed', state.session.seed);
      const code = extensionsCode(extensionsOf(state.session.gems));
      if (code) url.searchParams.set('ext', code);
    }
    return url.toString();
  };

  /** Remet une partie sauvegardée en mémoire (chronomètre en pause tant qu'on n'est pas sur la vue Partie). */
  const loadSave = (save: SaveData, id?: string): void => {
    state.session = GameSession.fromSnapshot(save.session);
    state.solution = save.solution;
    state.notes = newHistory(save.notes);
    state.skipConfirm = save.skipConfirm;
    state.game = {
      id: id ?? save.gameId ?? newGameId(),
      startedAt: save.startedAt ?? Math.max(0, save.savedAt - save.session.elapsedMs),
      ...(save.owner ? { owner: save.owner } : {}),
      // Au chargement de la page le compte n'est pas encore connu : voir `onAccount`.
      synced: save.owner !== undefined && save.owner === state.account?.id,
    };
    state.recorded = null;
    state.selected = null;
    state.selectedGem = null;
    state.hypothesis = null;
    state.explored = null;
    state.ask = null;
    state.confirm = null;
    state.tab = 'shots';
    state.phase = 'ready';
    writeSeedToUrl(state.session.seed, extensionsOf(state.session.gems));
  };

  const startGame = (seed: string, extensions: Readonly<Extensions> = NO_EXTENSIONS): void => {
    store.clear();
    state.choose = null;
    state.toast = false;
    state.phase = 'loading';
    state.session = null;
    state.game = null;
    state.recorded = null;
    state.selected = null;
    state.solution = emptySolution(gemsFor(extensions));
    state.selectedGem = null;
    state.hypothesis = null;
    state.explored = null;
    state.notes = newHistory();
    state.ask = null;
    state.skipConfirm = false;
    state.confirm = null;
    state.tab = 'shots';
    state.notice = '';
    navigate('game');
    // Laisse le navigateur afficher « Génération… » avant le calcul de la mine.
    window.setTimeout(() => {
      try {
        state.session = GameSession.start(seed, extensions);
        state.game = { id: newGameId(), startedAt: Date.now(), synced: false };
        // Connecté : la partie est enregistrée sur le compte dès le début (reprise sur un autre appareil).
        if (state.account && state.backend && sync) {
          state.game.synced = true;
          state.game.owner = state.account.id;
        }
        if (!state.account && (!state.authReady || accountsExpected)) state.game.autoImport = true;
        state.phase = 'ready';
        writeSeedToUrl(seed, extensions);
      } catch {
        state.phase = 'error';
      }
      render();
    }, 30);
  };

  /** Ouvre la fenêtre de choix des extensions (début de partie). */
  const openOptions = (): void => {
    state.choose = { ...(state.session ? extensionsOf(state.session.gems) : NO_EXTENSIONS) };
    render();
    root.querySelector<HTMLElement>('#ext-diamond')?.focus();
  };

  /** Lance la partie avec les extensions cochées, ou referme la fenêtre. */
  const closeOptions = (play: boolean): void => {
    if (!state.choose) return;
    if (!play) {
      state.choose = null;
      return render();
    }
    const checked = (id: string): boolean =>
      root.querySelector<HTMLInputElement>(`#${id}`)?.checked ?? false;
    void beginGame(randomSeed(), {
      diamond: checked('ext-diamond'),
      blackBody: checked('ext-black'),
    });
  };

  const doFire = (label: string): void => {
    if (!state.session || state.session.finished) return;
    const shot = state.session.fire(label);
    state.selected = shot.n;
    state.notice = describe(shot);
    if (isAbsorbed(shot)) showLostSignal();
    render();
  };

  const doProbe = (label: string): void => {
    const { session } = state;
    if (!session || session.finished) return;
    try {
      const record = session.probe(label);
      state.notice = `${record.cell} : ${t.probe[record.content]}`;
      if (record.content === 'black') showLostSignal();
    } catch {
      state.notice = `« ${label} » : case invalide (A1 à H10).`;
    }
    render();
  };

  /** Entre en plein écran : navigateur en plein écran et écran verrouillé en paysage quand c'est possible. */
  const enterImmersive = (): void => {
    state.immersive = true;
    state.itool = 'move';
    state.selectedGem = null;
    try {
      void document.documentElement
        .requestFullscreen?.({ navigationUI: 'hide' })
        ?.catch(() => undefined);
    } catch {
      // Pas de plein écran navigateur (iPhone) : la grille occupe déjà tout l'écran de la page.
    }
    try {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (value: string) => Promise<void>;
      };
      void orientation.lock?.('landscape')?.catch(() => undefined);
    } catch {
      // Verrouillage d'orientation indisponible : l'indication « Paysage » s'affiche en portrait.
    }
    render();
  };

  const leaveImmersive = (): void => {
    if (!state.immersive) return;
    state.immersive = false;
    state.selectedGem = null;
    try {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      screen.orientation?.unlock?.();
    } catch {
      // Rien à défaire.
    }
  };

  // ---------- Historique (v2) ----------

  const recordStatusHtml = (): string =>
    state.recorded === null
      ? ''
      : `<p class="record-status" role="status">${state.recorded === 'saved' ? `✓ ${t.history.saved}` : t.history.pending}</p>`;

  let retryTimer: number | undefined;
  let retryDelay = 15_000;

  /** Envoie les parties en attente de l'utilisateur connecté ; en cas de coupure, réessaie plus tard. */
  const flushOutbox = async (): Promise<void> => {
    const { backend, account } = state;
    if (!backend || !account || outbox.pending(account.id).length === 0) return;
    const result = await outbox.flush(account.id, backend.games);
    if (state.account?.id !== account.id) return;
    window.clearTimeout(retryTimer);
    if (result.retry) {
      retryTimer = window.setTimeout(() => void flushOutbox(), retryDelay);
      retryDelay = Math.min(retryDelay * 2, 300_000);
    } else {
      retryDelay = 15_000;
    }
    if (result.sent > 0 && state.view === 'history') loadHistory();
    if (result.sent > 0 && state.view === 'profile') loadProfile();
    if (result.sent > 0 && state.view === 'home') loadPlayingList();
    if (state.recorded === 'pending' && state.game && !outbox.has(account.id, state.game.id)) {
      state.recorded = 'saved';
      render();
    }
  };

  /** Met la partie terminée en file d'envoi (connecté seulement) puis tente l'envoi. */
  const recordGame = (): void => {
    const { session, game, account, backend } = state;
    if (!session?.finished || !game || !account || !backend) return;
    try {
      const record = buildRecord({
        id: game.id,
        session,
        extensions: extensionsOf(session.gems),
        startedAt: game.startedAt,
        endedAt: Date.now(),
        submission: placedGems(state.solution),
      });
      // Une partie que la base refuserait ne doit pas rester bloquée en file.
      if (parseRow(recordToRow(record)) === null) return;
      sync?.forget(game.id);
      outbox.add(account.id, record);
      state.recorded = 'pending';
      void flushOutbox();
    } catch {
      // L'enregistrement échoue : la partie reste jouable, sans historique.
    }
  };

  let historyToken = 0;

  /** Charge la page d'historique demandée ; une réponse tardive d'une demande dépassée est ignorée. */
  const loadHistory = (): void => {
    const { backend, account, history } = state;
    if (!backend || !account) return;
    const token = ++historyToken;
    history.status = 'loading';
    if (state.view === 'history') render();
    backend.games
      .list({
        filter: history.filter,
        sort: history.sort,
        page: history.page,
        pageSize: HISTORY_PAGE_SIZE,
      })
      .then(
        (result) => {
          if (token !== historyToken) return;
          const last = pageCount(result.total, HISTORY_PAGE_SIZE) - 1;
          if (history.page > last) {
            history.page = last;
            return loadHistory();
          }
          history.games = result.games;
          history.total = result.total;
          history.status = 'ready';
          if (state.view === 'history') render();
        },
        () => {
          if (token !== historyToken) return;
          history.status = 'error';
          if (state.view === 'history') render();
        },
      );
  };

  let profileToken = 0;

  /** Charge les statistiques du profil ; une réponse tardive d'une demande dépassée est ignorée. */
  const loadProfile = (): void => {
    const { backend, account, profile } = state;
    if (!backend || !account) return;
    const token = ++profileToken;
    profile.status = 'loading';
    if (state.view === 'profile') render();
    backend.games.stats().then(
      (stats) => {
        if (token !== profileToken) return;
        profile.stats = stats;
        profile.status = 'ready';
        if (state.view === 'profile') render();
      },
      () => {
        if (token !== profileToken) return;
        profile.status = 'error';
        if (state.view === 'profile') render();
      },
    );
  };

  // ---------- Parties en cours du compte (v2) ----------

  let playingToken = 0;

  /** Recharge la liste des parties en cours du compte ; une réponse tardive d'une demande dépassée est ignorée. */
  const loadPlayingList = (): void => {
    const { backend, account } = state;
    if (!backend || !account) return;
    const token = ++playingToken;
    state.playing.status = 'loading';
    if (state.view === 'home') render();
    backend.games.listPlaying().then(
      (games) => {
        if (token !== playingToken) return;
        state.playing = { status: 'ready', games };
        if (state.view === 'home') render();
      },
      () => {
        if (token !== playingToken) return;
        state.playing.status = 'error';
        if (state.view === 'home') render();
      },
    );
  };

  /**
   * Avant de remplacer la partie chargée par une autre : s'assurer qu'elle est sur le compte. Une partie
   * seulement locale y est importée d'office (sinon elle serait perdue). Faux si l'envoi échoue.
   */
  const secureCurrent = async (): Promise<boolean> => {
    const { game, account, backend } = state;
    if (!account || !backend || !sync || !game || !inProgress()) return true;
    if (!game.synced) {
      game.synced = true;
      game.owner = account.id;
    }
    persist();
    await sync.flush();
    return !sync.pending().includes(game.id);
  };

  let starting = false;

  /** Lance une partie : celle qui est chargée est d'abord mise à l'abri sur le compte. */
  const beginGame = async (seed: string, extensions: Readonly<Extensions>): Promise<void> => {
    if (starting) return;
    starting = true;
    try {
      if (state.account && !(await secureCurrent())) {
        state.choose = null;
        state.notice = t.home.syncFailed;
        render();
        return;
      }
      startGame(seed, extensions);
    } finally {
      starting = false;
    }
  };

  /** Reprend une partie du compte : elle remplace celle qui est chargée (mise à l'abri avant). */
  const resumeRemote = async (id: string): Promise<void> => {
    const { backend, account } = state;
    if (!backend || !account || starting) return;
    if (state.game?.id === id && inProgress()) return navigate('game');
    starting = true;
    try {
      if (!(await secureCurrent())) {
        state.notice = t.home.syncFailed;
        return;
      }
      const loaded = await backend.games.loadPlaying(id);
      if (!loaded) {
        state.notice = t.home.gone;
        loadPlayingList();
        return;
      }
      store.clear();
      loadSave({ ...loaded.save, owner: account.id }, id);
      persist();
      navigate('game');
    } catch {
      state.notice = t.home.actionFailed;
    } finally {
      starting = false;
      render();
    }
  };

  /** Abandonne une partie du compte sans la charger : elle entre dans l'historique comme abandonnée. */
  const abandonRemote = async (id: string): Promise<void> => {
    const { backend } = state;
    const game = state.playing.games.find((candidate) => candidate.id === id);
    state.confirmRemote = null;
    if (!backend || !game) return render();
    try {
      await backend.games.abandonPlaying(id, game.startedAt);
    } catch {
      state.notice = t.home.actionFailed;
    }
    loadPlayingList();
  };

  /** Ajoute au compte la partie locale en cours. */
  const importCurrent = async (): Promise<void> => {
    const { game, account } = state;
    if (!account || !game || !inProgress() || game.synced) return;
    if (limitReached()) {
      state.notice = t.home.limit;
      return render();
    }
    game.synced = true;
    game.owner = account.id;
    persist();
    render();
    await sync?.flush();
    loadPlayingList();
  };

  /** Supprime le compte et ses parties, puis revient au jeu (sans compte). */
  const deleteAccount = (): void => {
    const { backend, account } = state;
    if (!backend || !account) return;
    state.deletion = 'busy';
    render();
    backend.auth.deleteAccount().then(
      () => {
        outbox.discard(account.id);
        state.deletion = 'idle';
        state.recorded = null;
        state.notice = t.privacy.deleted;
        navigate('home');
      },
      () => {
        state.deletion = 'error';
        render();
      },
    );
  };

  /** Termine la partie et affiche le résultat. */
  const showResult = (): void => {
    leaveImmersive();
    store.clear();
    clearSeedFromUrl();
    state.confirm = null;
    state.ask = null;
    state.tab = 'result';
    state.notice = state.session ? t.status[state.session.status] : '';
    recordGame();
    render();
  };

  /** Ouvre la confirmation, sauf si elle est désactivée ou si la réponse est déjà connue (gratuit). */
  const askFire = (label: string): void => {
    const session = state.session;
    if (!session || session.finished) return;
    const known = session.shots.find((shot) => shot.entry === label);
    if (known) {
      // Déjà tiré : gratuit, on en montre le résumé.
      state.selected = known.n;
      state.ask = { kind: 'recap', n: known.n };
      render();
      root.querySelector<HTMLElement>('.modal-close')?.focus();
      return;
    }
    if (state.skipConfirm) return doFire(label);
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
    if (!confirmed || ask.kind === 'recap') return render();
    if (skip) state.skipConfirm = true;
    if (ask.kind === 'fire') doFire(ask.label);
    else doProbe(ask.cell);
  };

  /** Après la fin de la partie : tire un laser libre dans la mine révélée et en trace le trajet. */
  const exploreMine = (label: string): void => {
    const session = state.session;
    if (!session || !session.finished) return;
    state.explored = shoot(session.reveal(), label);
    state.notice = outcomeText(state.explored);
    if (isAbsorbed(state.explored)) showLostSignal();
    render();
  };

  const testOnSolution = (label: string): void => {
    try {
      state.hypothesis = shoot(placedGems(state.solution), label);
      state.notice = outcomeText(state.hypothesis);
      if (isAbsorbed(state.hypothesis)) showLostSignal();
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
  /** Horodatage du dernier geste sur une gemme : le « clic » qui le suit ne doit pas sonder la case dessous. */
  let lastGemGesture = 0;

  const beginDrag = (event: PointerEvent, element: SVGGElement, gem: GemId): void => {
    if (state.session?.finished) return;
    const svg = element.ownerSVGElement;
    if (!svg) return;
    event.preventDefault();
    const start = toBoardPoint(svg, event.clientX, event.clientY);
    const [originX, originY] = gemOrigin(state.solution, gem, state.immersive ? 'side' : 'bottom');
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
      lastGemGesture = Date.now();
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
  const beginNotes = (event: PointerEvent, tool: Tool): void => {
    const board = (): SVGSVGElement | null => root.querySelector<SVGSVGElement>('.notes-svg');
    const point = (e: PointerEvent): NotePoint => {
      const svg = board();
      return svg ? toBoardPoint(svg, e.clientX, e.clientY) : [0, 0];
    };
    const start = point(event);
    if (cellAt(start) === null) return;
    event.preventDefault();
    const { ink } = state;
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
    if (state.immersive) {
      const target = event.target as Element;
      if (state.itool === 'move') {
        const element = target.closest<SVGGElement>('[data-gem]');
        const gem = element?.dataset['gem'] as GemId | undefined;
        if (element && gem) beginDrag(event, element, gem);
      } else if (target.closest('.notes-svg')) {
        beginNotes(event, state.itool);
      }
      return;
    }
    if (state.tab === 'notes') {
      if ((event.target as Element).closest('.notes-svg')) beginNotes(event, state.tool);
      return;
    }
    if (state.tab !== 'solution') return;
    const element = (event.target as Element).closest<SVGGElement>('[data-gem]');
    const gem = element?.dataset['gem'] as GemId | undefined;
    if (element && gem) beginDrag(event, element, gem);
  });

  root.addEventListener('click', (event) => {
    const target = event.target as Element;
    // Un clic ailleurs que sur une gemme ou ses boutons ronds désélectionne la gemme : les boutons
    // disparaissent aussitôt (retirés du DOM sans refaire l'affichage, pour ne pas perdre le clic).
    if (
      state.selectedGem !== null &&
      !target.closest('[data-gem], .gem-btn') &&
      Date.now() - lastGemGesture > 500
    ) {
      state.selectedGem = null;
      root.querySelectorAll('.gem-btn').forEach((element) => element.remove());
      root
        .querySelectorAll('.gem-g.is-selected')
        .forEach((element) => element.classList.remove('is-selected'));
    }
    if (target.closest('[data-recap]')) return closeAsk(false);
    if (target.hasAttribute('data-modal-backdrop')) return closeAsk(false);
    if (target.hasAttribute('data-options-backdrop')) {
      closeOptions(false);
      return;
    }
    const entry = target.closest<HTMLElement>('[data-fire]');
    if (entry?.dataset['fire']) return askFire(entry.dataset['fire']);
    const probeTarget = target.closest<HTMLElement>('[data-probe]');
    if (probeTarget?.dataset['probe']) {
      if (Date.now() - lastGemGesture < 500) return;
      return askProbe(probeTarget.dataset['probe']);
    }
    const explore = target.closest<HTMLElement>('[data-explore]');
    if (explore?.dataset['explore']) return exploreMine(explore.dataset['explore']);
    const hypo = target.closest<HTMLElement>('[data-hypo]');
    if (hypo?.dataset['hypo']) return testOnSolution(hypo.dataset['hypo']);
    const tab = target.closest<HTMLElement>('[data-tab]')?.dataset['tab'];
    if (tab === 'shots' || tab === 'solution' || tab === 'notes' || tab === 'result') {
      state.tab = tab;
      state.selectedGem = null;
      return render();
    }
    const itool = target.closest<HTMLElement>('[data-itool]')?.dataset['itool'];
    if (itool) {
      state.itool = itool as ImmersiveTool;
      state.selectedGem = null;
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
      if (state.immersive) state.itool = 'pencil';
      else if (state.tool !== 'pencil') state.tool = 'pencil';
      return render();
    }
    const shot = target.closest<HTMLElement>('[data-shot]');
    if (shot?.dataset['shot']) {
      state.selected = Number(shot.dataset['shot']);
      return render();
    }
    const hfilter = target.closest<HTMLElement>('[data-hfilter]')?.dataset['hfilter'];
    if (isHistoryFilter(hfilter)) {
      state.history.filter = hfilter;
      state.history.page = 0;
      return loadHistory();
    }
    const hpage = target.closest<HTMLElement>('[data-hpage]')?.dataset['hpage'];
    if (hpage) {
      if (hpage === 'prev') state.history.page = Math.max(0, state.history.page - 1);
      if (hpage === 'next') state.history.page++;
      return loadHistory();
    }
    const action = target.closest<HTMLElement>('[data-action]')?.dataset['action'];
    switch (action) {
      case 'sign-in':
        // La page est quittée pour Google : on sauvegarde d'abord la partie en cours.
        persist();
        void state.backend?.auth.signIn().catch(() => {
          state.notice = t.account.signInFailed;
          render();
        });
        return;
      case 'import-game':
        void importCurrent();
        return;
      case 'resume-remote': {
        const id = target.closest<HTMLElement>('[data-id]')?.dataset['id'];
        if (id) void resumeRemote(id);
        return;
      }
      case 'ask-abandon-remote':
        state.confirmRemote = target.closest<HTMLElement>('[data-id]')?.dataset['id'] ?? null;
        return render();
      case 'confirm-abandon-remote': {
        const id = target.closest<HTMLElement>('[data-id]')?.dataset['id'];
        if (id) void abandonRemote(id);
        return;
      }
      case 'retry-playing':
        return loadPlayingList();
      case 'ask-delete-account':
        state.deletion = 'confirm';
        return render();
      case 'cancel-delete-account':
        state.deletion = 'idle';
        return render();
      case 'confirm-delete-account':
        return deleteAccount();
      case 'retry-profile':
        return loadProfile();
      case 'sign-out':
        // Les dernières modifications des parties en cours partent avant la fin de la session.
        void (async () => {
          try {
            persist();
            await sync?.flush();
            await state.backend?.auth.signOut();
          } catch {
            state.notice = t.account.signOutFailed;
            render();
          }
        })();
        return;
      case 'enter-immersive':
        return enterImmersive();
      case 'exit-immersive':
        leaveImmersive();
        return render();
      case 'new-game':
        if (newGameBlocked()) return;
        return openOptions();
      case 'resume-game':
        if (state.session) {
          state.notice = 'Reprise';
          navigate('game');
        }
        return;
      case 'start-game':
        return closeOptions(true);
      case 'cancel-options':
        return closeOptions(false);
      case 'rotate':
        withSelectedGem(rotateGem);
        root.querySelector<SVGElement>('[data-action="rotate"]')?.focus();
        return;
      case 'flip':
        withSelectedGem(flipGem);
        root.querySelector<SVGElement>('[data-action="flip"]')?.focus();
        return;
      case 'skip':
        event.preventDefault();
        root.querySelector<HTMLElement>('#plateau')?.focus();
        return;
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
        state.confirmRemote = null;
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
        if (state.session) void beginGame(state.session.seed, extensionsOf(state.session.gems));
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
        navigator.clipboard?.writeText(shareLink()).then(
          () => {
            state.notice = 'Lien copié';
            render();
          },
          () => undefined,
        );
    }
  });

  root.addEventListener('change', (event) => {
    const select = (event.target as Element).closest<HTMLSelectElement>('select[data-hsort]');
    if (select) {
      if (isHistorySort(select.value)) {
        state.history.sort = select.value;
        state.history.page = 0;
        loadHistory();
      }
      return;
    }
    const target = event.target as HTMLInputElement;
    if (target.dataset['toggle'] !== 'notes') return;
    state.showNotes = target.checked;
    render();
    root.querySelector<HTMLInputElement>('#show-notes')?.focus();
  });

  root.addEventListener('keydown', (event) => {
    const target = event.target as Element;
    if (state.choose) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeOptions(false);
      }
      return;
    }
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
    const gemButton = target.closest('.gem-btn');
    if (gemButton && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      gemButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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
        state.selectedGem = null;
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
    const exploreEntry = target.closest<HTMLElement>('[data-explore]')?.dataset['explore'];
    if (fireEntry) {
      event.preventDefault();
      askFire(fireEntry);
    } else if (hypoEntry) {
      event.preventDefault();
      testOnSolution(hypoEntry);
    } else if (exploreEntry) {
      event.preventDefault();
      exploreMine(exploreEntry);
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
    const next = viewFromHash();
    if (next === state.view) return;
    if (next === 'game' && !gameAvailable()) return navigate('home');
    state.view = next;
    state.confirm = null;
    enterView(next);
  });
  document.addEventListener('fullscreenchange', () => {
    // Sortie du plein écran navigateur (Échap, geste retour) : on quitte aussi le mode plein écran.
    if (!document.fullscreenElement && state.immersive) {
      state.immersive = false;
      render();
    }
  });
  const saveAndSend = (): void => {
    persist();
    void sync?.flush();
  };
  window.addEventListener('pagehide', saveAndSend);
  document.addEventListener('visibilitychange', () => {
    syncClock();
    if (document.visibilityState === 'hidden') saveAndSend();
  });

  // Au chargement : une partie sauvegardée revient en mémoire (l'accueil la propose) ; sinon, un lien
  // avec une graine lance cette mine ; sinon on arrive sur l'accueil.
  const saved = store.load();
  const linkSeed = seedFromUrl();
  if (saved && saved.session.status === 'playing') {
    loadSave(saved);
    // Lien vers une autre mine alors qu'une partie est en cours : sans compte, une seule partie à la
    // fois, donc on garde la partie en cours et on oublie le lien.
    if (linkSeed && linkSeed !== saved.session.mine.seed) {
      clearSeedFromUrl();
      writeSeedToUrl(
        saved.session.mine.seed,
        extensionsOf(saved.session.mine.placements.map((placement) => placement.gem)),
      );
      if (state.view === 'game') state.view = 'home';
    }
    render();
  } else if (linkSeed) {
    startGame(linkSeed, extensionsFromUrl());
  } else {
    if (state.view === 'game') state.view = 'home';
    render();
  }
  // La page affichée peut différer de l'adresse (partie introuvable, page de compte sans compte) :
  // on corrige l'adresse sans ajouter d'entrée à l'historique.
  if (viewFromHash() !== state.view) {
    try {
      const url = new URL(window.location.href);
      url.hash = routeHash(state.view);
      window.history.replaceState(null, '', url);
    } catch {
      // L'adresse reste telle quelle : sans conséquence pour le jeu.
    }
  }

  return {
    backendUnavailable: () => {
      accountsExpected = false;
      render();
      if (viewFromHash() !== state.view) {
        try {
          const url = new URL(window.location.href);
          url.hash = routeHash(state.view);
          window.history.replaceState(null, '', url);
        } catch {
          // L'adresse reste telle quelle : sans conséquence pour le jeu.
        }
      }
    },
    attachBackend: (backend) => {
      state.backend = backend;
      sync = createProgressSync(backend.games, {
        // La base refuse cette partie (par exemple dix parties en cours) : elle reste seulement locale.
        onRejected: (id) => {
          if (state.game?.id !== id) return;
          state.game.synced = false;
          delete state.game.owner;
          render();
        },
      });
      const onAccount = (user: AccountUser | null): void => {
        const changed = user?.id !== state.account?.id;
        if (changed) {
          sync?.reset();
          // La partie chargée n'est reliée qu'au compte qui l'a envoyée ; sans compte, elle est locale.
          if (state.game) {
            state.game.synced = user !== null && state.game.owner === user.id;
            if (!state.game.synced) delete state.game.owner;
            if (user && state.game.autoImport && inProgress()) {
              state.game.synced = true;
              state.game.owner = user.id;
              delete state.game.autoImport;
            }
          }
          state.playing = { status: 'idle', games: [] };
          playingToken++;
          state.confirmRemote = null;
          // Autre compte ou déconnexion : l'historique et le profil affichés ne sont plus les bons.
          state.history = { ...state.history, page: 0, status: 'loading', games: [], total: 0 };
          state.profile = { status: 'loading', stats: null };
          historyToken++;
          profileToken++;
        }
        state.account = user;
        if (changed && user) {
          void flushOutbox();
          loadPlayingList();
          if (state.view === 'history') loadHistory();
          if (state.view === 'profile') loadProfile();
        }
        render();
      };
      backend.auth.onChange(onAccount);
      void backend.auth.ready().then((user) => {
        state.authReady = true;
        onAccount(user);
      });
      window.addEventListener('online', () => {
        void flushOutbox();
        void sync?.flush();
      });
    },
  };
}
