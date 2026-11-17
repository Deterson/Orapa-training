/**
 * Outils de la colonne de droite (tir, crayon, ligne droite, vide, simulation, couleurs et gomme) et rangée
 * du bas de la grille (afficher les notes et les gemmes ; annuler, rétablir, effacer). Le dessin des
 * notes est dans notesLayer.ts ; les interactions sont dans app.ts.
 */
import type { Ink, NotesHistory } from '../game/notes';
import { INK_COLOR, INK_LABEL } from './palette';
import { t } from './strings';

/**
 * Outil actif. Aucun (null) = « jouer » : les repères tirent, les cases sondent, les gemmes se
 * déplacent. « fire » (bouton « Tir ») : les repères tirent et les cases sondent, mais les gemmes posées
 * laissent passer le pointeur : toucher une case ne sélectionne plus la gemme dessous. « simulate » : les
 * repères testent un tir sur les gemmes posées par le joueur.
 */
export type Tool = 'fire' | 'pencil' | 'line' | 'eraser' | 'empty' | 'simulate';

/** Outils qui dessinent sur la grille (les gemmes posées n'interceptent alors plus le pointeur). */
export function isDrawingTool(tool: Tool | null): tool is 'pencil' | 'line' | 'eraser' | 'empty' {
  return tool !== null && tool !== 'simulate' && tool !== 'fire';
}

/** Pictogramme de gomme, à droite des couleurs. */
const ERASER_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>';

const INKS: readonly Ink[] = ['ink', 'black', 'red', 'yellow', 'blue'];

export interface ToolsView {
  tool: Tool | null;
  ink: Ink;
}

/**
 * Colonne d'outils : cliquer l'outil actif le désactive (retour au jeu). Deux modes, sans interrupteur
 * propre : **notes** quand un outil de dessin est actif, **gemmes** sinon (bouton « Gemmes », ou clic
 * hors de la grille). Chaque mode estompe légèrement l'autre calque (voir playBoard.ts).
 */
export function toolsHtml({ tool, ink }: ToolsView): string {
  const pressed = (name: Tool): string => `aria-pressed="${tool === name}"`;
  const button = (name: Tool, label: string, content = label, extraClass = ''): string =>
    `<button type="button" class="tool${extraClass}" data-tool="${name}" ${pressed(name)} aria-label="${label}" title="${label}">${content}</button>`;
  const inks = INKS.map((name) => {
    const swatch =
      name === 'ink'
        ? '<span class="ink-auto" aria-hidden="true"></span>'
        : `<span style="background:${INK_COLOR[name]}" aria-hidden="true"></span>`;
    return `<button type="button" class="ink" data-ink="${name}" aria-pressed="${ink === name}" aria-label="Encre ${INK_LABEL[name]}" title="Encre ${INK_LABEL[name]}">${swatch}</button>`;
  }).join('');
  return `<div class="tools" role="toolbar" aria-label="${t.tools.label}">
      <div class="tool-row">${button('fire', t.tools.fire)}<button type="button" class="tool" data-mode="gems" aria-pressed="${tool === null}" title="${t.actions.showGems}">${t.actions.showGems}</button>${button('pencil', t.tools.pencil)}${button('line', t.tools.line)}</div>
      <div class="tool-row ink-row" role="group" aria-label="${t.tools.inks}">${inks}${button('eraser', t.tools.eraser, ERASER_ICON, ' eraser-btn')}</div>
      <div class="tool-row">${button('empty', t.tools.empty, `<span class="empty-swatch" aria-hidden="true"></span>${t.tools.empty}`)}${button('simulate', t.tools.simulate)}</div>
    </div>`;
}

export interface FooterView {
  history: NotesHistory;
  showNotes: boolean;
  showGems: boolean;
}

/** Sous la grille : annuler (↶), rétablir (↷), effacer à gauche ; cases « Notes » et « Gemmes » à droite. */
export function footerHtml({ history, showNotes, showGems }: FooterView): string {
  const hasNotes = Object.keys(history.present.marks).length + history.present.strokes.length > 0;
  return `<div class="board-foot">
      <div class="board-undo" role="toolbar" aria-label="Historique des notes">
        <button type="button" class="ghost" data-action="undo" aria-label="${t.actions.undo}" title="${t.actions.undo}"${history.past.length ? '' : ' disabled'}>↶</button>
        <button type="button" class="ghost" data-action="redo" aria-label="${t.actions.redo}" title="${t.actions.redo}"${history.future.length ? '' : ' disabled'}>↷</button>
        <button type="button" class="ghost" data-action="clear-notes"${hasNotes ? '' : ' disabled'}>${t.actions.clear}</button>
      </div>
      <div class="board-toggles">
        <label class="check"><input type="checkbox" data-toggle="notes"${showNotes ? ' checked' : ''} />${t.actions.showNotes}</label>
        <label class="check"><input type="checkbox" data-toggle="gems"${showGems ? ' checked' : ''} />${t.actions.showGems}</label>
      </div>
    </div>`;
}
