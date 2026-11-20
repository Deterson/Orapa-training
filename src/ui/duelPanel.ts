/**
 * Duel contre l'IA : pièces d'affichage propres au duel (fenêtre des options, page du plateau du joueur,
 * son plateau avec les questions de l'IA, indication du tour). Aucune logique de jeu ici. Le reste de la
 * vue de jeu (grille, historique, gemmes, soumission) est celui de l'entraînement.
 */
import { AI_LEVELS, type AiLevel, type Camp, type DuelStatus } from '../game/duel';
import type { Extensions, Placement } from '../game/gems';
import { GEM_SHAPES, placedPolygon } from '../game/gems';
import type { ProbeRecord, ShotRecord } from '../game/session';
import { type Solution, type SolutionIssue, gemsOf, placedGems } from '../game/solution';
import { encodeBoard } from '../game/boardCode';
import { boardFrame, entryLabelsSvg, probeMarksSvg } from './board';
import { escapeHtml } from './html';
import { gemPolygons } from './palette';
import { gemButtonsSvg, gemGroupSvg, trayHtml } from './solutionBoard';
import { t } from './strings';

/** Fenêtre de début de duel : extensions et niveau de l'IA. */
export interface DuelChoice {
  extensions: Extensions;
  level: AiLevel;
}

export function duelOptionsModal(choice: DuelChoice): string {
  const levels = AI_LEVELS.map(
    (level) =>
      `<label class="check"><input type="radio" name="duel-level" value="${level}"${choice.level === level ? ' checked' : ''} />${t.duel.levels[level]}</label>`,
  ).join('');
  return `<div class="modal-backdrop" data-duel-options-backdrop><div class="modal" role="dialog" aria-modal="true" aria-label="${t.duel.optionsTitle}"><p class="modal-title">${t.duel.optionsTitle}</p><div class="duel-levels" role="radiogroup" aria-label="${t.duel.level}">${levels}</div><label class="check"><input type="checkbox" id="duel-ext-diamond"${choice.extensions.diamond ? ' checked' : ''} />${t.options.diamond}</label><label class="check"><input type="checkbox" id="duel-ext-black"${choice.extensions.blackBody ? ' checked' : ''} />${t.options.blackBody}</label><div class="actions"><button type="button" data-action="duel-to-board">${t.duel.toBoard}</button><button type="button" class="ghost" data-action="cancel-duel-options">${t.modal.cancel}</button></div></div></div>`;
}

/** La grille du plateau en construction : gemmes déplaçables, boutons de rotation et de retournement. */
export function editorBoardSvg(view: {
  solution: Solution;
  selected: Parameters<typeof gemButtonsSvg>[0]['selected'];
  issues: readonly SolutionIssue[];
}): string {
  const gems = gemsOf(view.solution)
    .filter((gem) => view.solution[gem] !== null)
    .map((gem) => gemGroupSvg(view, gem))
    .join('');
  return boardFrame(
    'Votre plateau : placez vos gemmes',
    `<g class="board-gems">${gems}</g>${entryLabelsSvg(null, 'fire', false)}${gemButtonsSvg(view)}`,
    'notes-svg play-svg tool-play mode-gems',
  );
}

export interface SetupModel {
  solution: Solution;
  selected: Parameters<typeof gemButtonsSvg>[0]['selected'];
  issues: readonly SolutionIssue[];
  /** Le plateau est complet et respecte toutes les règles : « Valider » et le code sont disponibles. */
  valid: boolean;
  /** Message sous le code (« Copié », « Code invalide »), vide sinon. */
  notice: string;
}

/** Page du plateau : le joueur cache ses gemmes avant le duel. */
export function duelSetupPage(model: SetupModel): string {
  const placed = placedGems(model.solution);
  const total = gemsOf(model.solution).length;
  const code = model.valid ? encodeBoard(placed) : '';
  const codeRow = `<div class="code-row">
      <label class="code-label">${t.duel.code}<input type="text" id="board-code" readonly value="${escapeHtml(code)}" aria-label="${t.duel.codeLabel}"${model.valid ? '' : ' disabled'} /></label>
      <button type="button" class="ghost" data-action="copy-code"${model.valid ? '' : ' disabled'}>${t.duel.copy}</button>
    </div>
    <div class="code-row">
      <input type="text" id="import-code" placeholder="${t.duel.importLabel}" aria-label="${t.duel.importLabel}" autocomplete="off" spellcheck="false" />
      <button type="button" class="ghost" data-action="import-code">${t.duel.importCode}</button>
    </div>
    <p class="hint" role="status">${escapeHtml(model.notice)}</p>`;
  return `<article class="duel-setup">
    <h1 class="sr-only">${t.duel.setupTitle}</h1>
    <div class="play is-setup">
      <section class="play-center" id="plateau" tabindex="-1" aria-label="${t.duel.setupTitle}">${editorBoardSvg(model)}</section>
      <aside class="play-side">
        ${trayHtml(model)}
        <div class="status-row">
          <p class="status">${placed.length}/${total}</p>
          <button type="button" class="ghost reset-btn" data-action="reset-gems"${placed.length ? '' : ' disabled'}>${t.actions.reset}</button>
        </div>
        <button type="button" class="ghost" data-action="random-board">${t.duel.random}</button>
        <button type="button" class="submit-btn" data-action="validate-board"${model.valid ? '' : ' disabled'}>${t.duel.validate}</button>
        ${codeRow}
      </aside>
    </div>
  </article>`;
}

export interface OwnBoardModel {
  board: readonly Placement[];
  /** Questions de l'IA et leurs réponses, marquées sur le plateau du joueur. */
  shots: readonly ShotRecord[];
  probes: readonly ProbeRecord[];
  /** Dernière question de l'IA : sa marque apparaît avec une petite animation. */
  fresh: { shot: number | null; probe: string | null };
  /** Proposition de l'IA (écran de résultat), en pointillés. */
  guess?: readonly Placement[] | null;
}

/** Le plateau du joueur, en petit : ses gemmes et les questions de l'IA. */
export function ownBoardSvg(model: OwnBoardModel): string {
  const gems = model.board
    .map((placement) => {
      const shape = GEM_SHAPES[placement.gem];
      return gemPolygons(placedPolygon(placement), shape.color, 'real-gem', shape.label);
    })
    .join('');
  const guess = (model.guess ?? [])
    .map(
      (placement) =>
        `<polygon class="guess-gem is-wrong" points="${placedPolygon(placement)
          .map(([x, y]) => `${x},${y}`)
          .join(' ')}"/>`,
    )
    .join('');
  return boardFrame(
    t.duel.ownBoard,
    `${gems}${guess}${probeMarksSvg(model.probes, model.fresh.probe)}${entryLabelsSvg({ shots: model.shots, selected: null, fresh: model.fresh.shot }, 'fire', false)}`,
    'own-svg',
  );
}

/** Colonne du plateau du joueur : titre court et grille. */
export function ownBoardHtml(model: OwnBoardModel): string {
  return `<section class="own-board" aria-label="${t.duel.ownBoard}"><p class="own-title">${t.duel.ownBoard}</p>${ownBoardSvg(model)}</section>`;
}

export interface DuelBarModel {
  level: AiLevel;
  turn: Camp;
  over: boolean;
  /** Le joueur a le dernier tour : il ne peut plus que proposer. */
  playerLastTurn: boolean;
  /** L'IA a le dernier tour (elle propose). */
  aiLastTurn: boolean;
  /** L'IA réfléchit. */
  thinking: boolean;
}

/** Indication du tour, à côté du niveau. */
export function duelStatusText(model: DuelBarModel): string {
  if (model.over) return '';
  if (model.playerLastTurn) return t.duel.lastTurn;
  if (model.aiLastTurn) return t.duel.aiLastTurn;
  return model.turn === 'player' && !model.thinking ? t.duel.yourTurn : t.duel.aiTurn;
}

export function duelBarHtml(model: DuelBarModel): string {
  const status = duelStatusText(model);
  const mine = model.turn === 'player' && !model.over && !model.thinking;
  return `<span class="ext-chip duel-chip" title="${t.duel.level}">${t.duel.chip} · ${t.duel.levels[model.level]}</span>${
    status
      ? `<span class="turn-chip${mine ? ' is-mine' : ''}" role="status" aria-live="polite">${status}</span>`
      : ''
  }`;
}

/** Titre de l'issue du duel. */
export function duelOutcomeText(status: DuelStatus): string {
  return status === 'won' ? t.duel.won : status === 'lost' ? t.duel.lost : t.duel.draw;
}
