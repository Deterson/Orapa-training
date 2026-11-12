/**
 * Application : une partie à la fois, avec la grille de tir et l'historique des tirs.
 * L'état de l'interface se limite à la partie, au tir mis en avant et aux messages.
 */
import { RESULT_COLOR_LABELS } from '../game/colors';
import { GameSession, type ShotRecord } from '../game/session';
import { randomSeed } from '../game/rng';
import { shotBoardSvg } from './board';
import { RAY_COLOR } from './palette';

type Phase = 'loading' | 'ready' | 'error';

interface State {
  phase: Phase;
  session: GameSession | null;
  selected: number | null;
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

export function startApp(root: HTMLElement, version: string): void {
  const state: State = { phase: 'loading', session: null, selected: null, notice: '' };

  const render = (): void => {
    const { session } = state;
    const shots = session?.shots ?? [];
    const board =
      state.phase === 'ready' && session
        ? shotBoardSvg({ shots, selected: state.selected })
        : `<p class="placeholder" role="status">${
            state.phase === 'error' ? 'La génération a échoué.' : 'Génération de la mine…'
          }</p>`;

    const history = shots.length
      ? `<ol class="history">${shots
          .map(
            (shot) =>
              `<li><button type="button" class="shot${state.selected === shot.n ? ' is-selected' : ''}" data-shot="${shot.n}"><span class="n">${shot.n}</span><span class="path"><b>${shot.entry}</b> → <b>${shot.exit}</b></span>${chip(shot.color)}<span class="color-name">${RESULT_COLOR_LABELS[shot.color]}</span></button></li>`,
          )
          .join('')}</ol>`
      : '<p class="hint">Touchez un repère du bord pour tirer un laser.</p>';

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
        <div class="play">
          <section class="board-wrap" aria-label="Grille de tir">${board}</section>
          <aside class="side">
            <div class="counter"><span class="count">${session?.laserCount ?? 0}</span><span class="count-label">laser${(session?.laserCount ?? 0) > 1 ? 's' : ''} tiré${(session?.laserCount ?? 0) > 1 ? 's' : ''}</span></div>
            <h2>Historique des tirs</h2>
            ${history}
          </aside>
        </div>
        <p class="sr-only" aria-live="polite">${state.notice}</p>
      </main>`;
  };

  const startGame = (seed: string): void => {
    state.phase = 'loading';
    state.session = null;
    state.selected = null;
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
    if (!state.session) return;
    const shot = state.session.fire(label);
    state.selected = shot.n;
    state.notice = describe(shot);
    render();
  };

  root.addEventListener('click', (event) => {
    const target = event.target as Element;
    const entry = target.closest<HTMLElement>('[data-fire]');
    if (entry?.dataset['fire']) return fire(entry.dataset['fire']);
    const shot = target.closest<HTMLElement>('[data-shot]');
    if (shot?.dataset['shot']) {
      state.selected = Number(shot.dataset['shot']);
      return render();
    }
    const action = target.closest<HTMLElement>('[data-action]')?.dataset['action'];
    if (action === 'new-game') return startGame(randomSeed());
    if (action === 'copy-link') {
      navigator.clipboard?.writeText(window.location.href).then(
        () => {
          state.notice = 'Lien copié.';
          render();
        },
        () => undefined,
      );
    }
  });

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const entry = (event.target as Element).closest<HTMLElement>('[data-fire]');
    if (entry?.dataset['fire']) {
      event.preventDefault();
      fire(entry.dataset['fire']);
    }
  });

  startGame(seedFromUrl() ?? randomSeed());
}
