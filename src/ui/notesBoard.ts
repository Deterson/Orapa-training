/**
 * Calque de notes : marques de cases et traits au crayon, par-dessus la grille et les
 * résultats de tirs. Dessin en SVG ; les interactions sont dans app.ts.
 */
import { parseCell } from '../game/board';
import type { CellMark, Ink, Notes, NotesHistory, Stroke } from '../game/notes';
import type { ShotRecord } from '../game/session';
import { boardFrame, entryLabelsSvg } from './board';
import { GEM_FILL, INK_COLOR, INK_LABEL, MARK_LABEL, MARK_LETTER } from './palette';

export type Tool = 'pencil' | 'eraser' | CellMark;

export interface NotesView {
  history: NotesHistory;
  shots: readonly ShotRecord[];
  tool: Tool;
  ink: Ink;
}

const COLOR_MARKS = ['red', 'yellow', 'blue', 'white'] as const;
const OTHER_MARKS = ['empty', 'maybe'] as const;

function markSvg(cell: string, mark: CellMark): string {
  const position = parseCell(cell);
  if (position === null) return '';
  const { col, row } = position;
  const x = col;
  const y = row;
  if (mark === 'empty') {
    return `<g class="note-mark"><line x1="${x + 0.25}" y1="${y + 0.25}" x2="${x + 0.75}" y2="${y + 0.75}"/><line x1="${x + 0.75}" y1="${y + 0.25}" x2="${x + 0.25}" y2="${y + 0.75}"/></g>`;
  }
  if (mark === 'maybe') {
    return `<text class="note-maybe" x="${x + 0.5}" y="${y + 0.52}">?</text>`;
  }
  return `<g class="note-color"><rect x="${x + 0.06}" y="${y + 0.06}" width="0.88" height="0.88" rx="0.12" fill="${GEM_FILL[mark]}"/><text x="${x + 0.5}" y="${y + 0.52}">${MARK_LETTER[mark] ?? ''}</text></g>`;
}

function strokeSvg(stroke: Stroke): string {
  const color = INK_COLOR[stroke.ink];
  const [first] = stroke.points;
  if (stroke.points.length === 1 && first) {
    return `<circle class="note-dot" cx="${first[0]}" cy="${first[1]}" r="0.07" fill="${color}"/>`;
  }
  const points = stroke.points.map(([x, y]) => `${x},${y}`).join(' ');
  return `<polyline class="note-stroke" points="${points}" stroke="${color}"/>`;
}

export function notesLayerSvg(notes: Notes): string {
  const marks = Object.entries(notes.marks)
    .map(([cell, mark]) => markSvg(cell, mark))
    .join('');
  return `${marks}${notes.strokes.map(strokeSvg).join('')}`;
}

export function notesBoardSvg(view: NotesView): string {
  const content = `${entryLabelsSvg({ shots: view.shots, selected: null }, 'note', undefined, false)}<g id="note-layer">${notesLayerSvg(view.history.present)}</g><polyline id="note-preview" class="note-stroke" points="" stroke="${INK_COLOR[view.ink]}"/>`;
  return boardFrame(
    'Grille de notes : posez des marques sur les cases ou dessinez au crayon',
    content,
    `notes-svg tool-${view.tool}`,
  );
}

export function notesToolbar(view: NotesView): string {
  const { tool, ink, history } = view;
  const pressed = (name: Tool): string => `aria-pressed="${tool === name}"`;
  const colorTools = COLOR_MARKS.map(
    (mark) =>
      `<button type="button" class="tool swatch" data-tool="${mark}" ${pressed(mark)} aria-label="Marquer une gemme ${MARK_LABEL[mark]}" title="Gemme ${MARK_LABEL[mark]}"><span style="background:${GEM_FILL[mark]}" aria-hidden="true"></span>${MARK_LETTER[mark]}</button>`,
  ).join('');
  const otherTools = OTHER_MARKS.map(
    (mark) =>
      `<button type="button" class="tool" data-tool="${mark}" ${pressed(mark)} aria-label="${mark === 'empty' ? 'Case vide' : 'Doute'}">${mark === 'empty' ? '✕' : '?'}</button>`,
  ).join('');
  const inks = (['ink', 'red', 'yellow', 'blue', 'green'] as const)
    .map(
      (name) =>
        `<button type="button" class="ink" data-ink="${name}" aria-pressed="${ink === name}" aria-label="Encre ${INK_LABEL[name]}" title="Encre ${INK_LABEL[name]}"><span style="background:${INK_COLOR[name]}" aria-hidden="true"></span></button>`,
    )
    .join('');
  return `
    <div class="notes-tools" role="toolbar" aria-label="Outils de notes">
      <button type="button" class="tool" data-tool="pencil" ${pressed('pencil')}>Crayon</button>
      <button type="button" class="tool" data-tool="eraser" ${pressed('eraser')}>Gomme</button>
      <span class="inks" role="group" aria-label="Couleur du crayon">${inks}</span>
    </div>
    <div class="notes-tools" role="toolbar" aria-label="Marques de cases">${colorTools}${otherTools}</div>
    <div class="notes-tools" role="toolbar" aria-label="Historique des notes">
      <button type="button" class="ghost" data-action="undo" aria-label="Annuler" title="Annuler"${history.past.length ? '' : ' disabled'}>↶</button>
      <button type="button" class="ghost" data-action="redo" aria-label="Rétablir" title="Rétablir"${history.future.length ? '' : ' disabled'}>↷</button>
      <button type="button" class="ghost" data-action="clear-notes"${Object.keys(history.present.marks).length + history.present.strokes.length ? '' : ' disabled'}>Effacer</button>
    </div>`;
}
