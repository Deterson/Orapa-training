/**
 * Dessin des notes (marques de cases et traits), partagé par l'onglet Notes et par l'onglet Tirs,
 * où elles s'affichent en transparence. Aucune dépendance vers les autres composants.
 */
import { parseCell } from '../game/board';
import type { CellMark, Notes, Stroke } from '../game/notes';
import { GEM_FILL, INK_COLOR, MARK_LETTER } from './palette';

function markSvg(cell: string, mark: CellMark): string {
  const position = parseCell(cell);
  if (position === null) return '';
  const { col, row } = position;
  const x = col;
  const y = row;
  if (mark === 'empty') {
    return `<rect class="note-empty" x="${x}" y="${y}" width="1" height="1"/>`;
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
