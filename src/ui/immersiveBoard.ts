/**
 * Plateau du mode plein écran (téléphone en paysage) : une seule grille où l'on peut, en même temps,
 * tirer des lasers (repères du bord), sonder des cases, déplacer les gemmes et dessiner. La réserve
 * de gemmes est à droite de la grille pour que le tout tienne dans la hauteur de l'écran.
 */
import { GRID_COLS } from '../game/constants';
import { BASE_GEM_IDS, type GemId } from '../game/gems';
import type { Ink, Notes } from '../game/notes';
import type { ProbeRecord, ShotRecord } from '../game/session';
import type { Solution, SolutionIssue } from '../game/solution';
import { boardFrame, entryLabelsSvg, probeMarksSvg, probeTargetsSvg } from './board';
import { notesLayerSvg } from './notesLayer';
import { INK_COLOR } from './palette';
import { gemButtonsSvg, gemGroupSvg } from './solutionBoard';

/** Outil actif : « move » = jouer (bords, cases, gemmes) ; les autres dessinent sur la grille. */
export type ImmersiveTool = 'move' | 'pencil' | 'eraser' | 'empty';

export interface ImmersiveView {
  solution: Solution;
  selected: GemId | null;
  issues: readonly SolutionIssue[];
  shots: readonly ShotRecord[];
  probes: readonly ProbeRecord[];
  notes: Notes;
  tool: ImmersiveTool;
  ink: Ink;
  /** Partie terminée : plus de tirs ni de sondes. */
  finished: boolean;
}

/** Largeur ajoutée à droite de la grille pour la réserve. */
const SIDE_WIDTH = 6.3;
const TRAY_X = 11.5;

export function immersiveBoardSvg(view: ImmersiveView): string {
  const tray = `<rect class="tray" x="${TRAY_X}" y="-0.3" width="${GRID_COLS + SIDE_WIDTH - TRAY_X - 0.5 + 0.2}" height="9.3" rx="0.3"/>`;
  const gems = BASE_GEM_IDS.map((gem) => gemGroupSvg(view, gem, 'side')).join('');
  const probing = view.tool === 'move' && !view.finished;
  const content = [
    tray,
    // Les cases sondables sont sous les gemmes : une gemme touchée se déplace, une case vide se sonde.
    probing ? probeTargetsSvg() : '',
    gems,
    `<g id="note-layer" class="immersive-notes">${notesLayerSvg(view.notes)}</g>`,
    `<polyline id="note-preview" class="note-stroke" points="" stroke="${INK_COLOR[view.ink]}"/>`,
    probeMarksSvg(view.probes),
    entryLabelsSvg({ shots: view.shots, selected: null }),
    gemButtonsSvg(view),
  ].join('');
  return boardFrame(
    'Plateau plein écran : tirez depuis les bords, sondez les cases, déplacez les gemmes, dessinez',
    content,
    `notes-svg immersive-svg tool-${view.tool}`,
    0,
    SIDE_WIDTH,
  );
}
