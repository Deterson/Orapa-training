/**
 * La grille de jeu, unique : on y tire des lasers (repères du bord), sonde des cases, déplace les
 * gemmes posées et dessine ses notes. Dessin en SVG ; les interactions sont dans app.ts.
 *
 * Ordre des calques, du dessous au dessus : cases sondables, gemmes posées, notes (qui laissent
 * passer le pointeur), marques des sondes, repères du bord, boutons de la gemme sélectionnée.
 */
import type { GemId } from '../game/gems';
import type { ShotResult } from '../game/laser';
import type { Ink, Notes } from '../game/notes';
import type { ProbeRecord, ShotRecord } from '../game/session';
import { type Solution, type SolutionIssue, gemsOf } from '../game/solution';
import { boardFrame, cursorSvg, entryLabelsSvg, probeMarksSvg, probeTargetsSvg } from './board';
import { type Tool } from './notesBoard';
import { notesLayerSvg } from './notesLayer';
import { INK_COLOR, RAY_COLOR } from './palette';
import { gemButtonsSvg, gemGroupSvg } from './solutionBoard';

export interface PlayView {
  solution: Solution;
  selected: GemId | null;
  issues: readonly SolutionIssue[];
  shots: readonly ShotRecord[];
  /** Tir mis en avant dans l'historique. */
  selectedShot: number | null;
  probes: readonly ProbeRecord[];
  /** Notes affichées ; null pour les masquer. */
  notes: Notes | null;
  /** Gemmes posées affichées (case « Gemmes »). */
  showGems: boolean;
  tool: Tool | null;
  ink: Ink;
  /** Tir simulé sur les gemmes du joueur, dont on dessine le trajet. */
  hypothesis: ShotResult | null;
  /** Case du curseur clavier (sonder sans souris). */
  cursor: { row: number; col: number };
}

function points(list: readonly (readonly [number, number])[]): string {
  return list.map(([x, y]) => `${x},${y}`).join(' ');
}

export function playBoardSvg(view: PlayView): string {
  const playing = view.tool === null;
  const gems = view.showGems
    ? gemsOf(view.solution)
        .filter((gem) => view.solution[gem] !== null)
        .map((gem) => gemGroupSvg(view, gem))
        .join('')
    : '';
  const ray = view.hypothesis
    ? `<polyline class="ray-outline" points="${points(view.hypothesis.path)}"/><polyline class="ray" points="${points(view.hypothesis.path)}" stroke="${RAY_COLOR[view.hypothesis.color]}"/>`
    : '';
  const action = view.tool === 'simulate' ? 'hypo' : 'fire';
  const content = [
    // Les cases sondables sont sous les gemmes : une gemme touchée se déplace, une case vide se sonde.
    playing ? probeTargetsSvg() : '',
    `<g class="board-gems">${gems}</g>`,
    `<g id="note-layer" class="board-notes">${view.notes ? notesLayerSvg(view.notes) : ''}</g>`,
    `<polyline id="note-preview" class="note-stroke" points="" stroke="${INK_COLOR[view.ink]}"/>`,
    ray,
    probeMarksSvg(view.probes),
    entryLabelsSvg({ shots: view.shots, selected: view.selectedShot }, action),
    gemButtonsSvg(view),
    playing ? cursorSvg(view.cursor) : '',
  ].join('');
  return boardFrame(
    'Grille de jeu : tirez depuis les repères du bord, sondez les cases, placez vos gemmes, notez',
    content,
    `notes-svg play-svg tool-${view.tool ?? 'play'}`,
  );
}
