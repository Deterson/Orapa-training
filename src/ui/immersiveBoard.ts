/**
 * Plateau du mode plein écran (téléphone en paysage) : une seule grille où l'on peut, en même temps,
 * tirer des lasers (repères du bord), sonder des cases, déplacer les gemmes et dessiner. La réserve
 * de gemmes est à droite de la grille pour que le tout tienne dans la hauteur de l'écran.
 */
import type { GemId } from '../game/gems';
import type { Ink, Notes } from '../game/notes';
import type { ProbeRecord, ShotRecord } from '../game/session';
import { type Solution, type SolutionIssue, gemsOf } from '../game/solution';
import {
  type Pending,
  boardFrame,
  bubbleSvg,
  entryLabelsSvg,
  probeMarksSvg,
  probeTargetsSvg,
} from './board';
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
  /** Tir ou sonde annoncé par la bulle verte, qui part au second clic. */
  pending: Pending | null;
  /** Dernier tir et dernière case sondée : leurs marques apparaissent en s'animant. */
  fresh: { shot: number | null; probe: string | null };
}

/** Largeur ajoutée à droite de la grille pour la réserve. */
const SIDE_WIDTH = 6.7;
const TRAY_X = 11.4;
/** Bord droit de la réserve : assez loin pour contenir la gemme la plus à droite (jaune, corps noir). */
const TRAY_RIGHT = 16.8;

export function immersiveBoardSvg(view: ImmersiveView): string {
  const tray = `<rect class="tray" x="${TRAY_X}" y="-0.3" width="${TRAY_RIGHT - TRAY_X}" height="9.3" rx="0.3"/>`;
  const gems = gemsOf(view.solution)
    .map((gem) => gemGroupSvg(view, gem, 'side'))
    .join('');
  const probing = view.tool === 'move' && !view.finished;
  const content = [
    tray,
    // Les cases sondables sont sous les gemmes : une gemme touchée se déplace, une case vide se sonde.
    probing ? probeTargetsSvg() : '',
    gems,
    `<g id="note-layer" class="immersive-notes">${notesLayerSvg(view.notes)}</g>`,
    `<polyline id="note-preview" class="note-stroke" points="" stroke="${INK_COLOR[view.ink]}"/>`,
    probeMarksSvg(view.probes, view.fresh.probe),
    entryLabelsSvg({ shots: view.shots, selected: null, fresh: view.fresh.shot }),
    gemButtonsSvg(view),
    bubbleSvg(view.pending),
  ].join('');
  return boardFrame(
    'Plateau plein écran : tirez depuis les bords, sondez les cases, déplacez les gemmes, dessinez',
    content,
    `notes-svg immersive-svg tool-${view.tool}`,
    0,
    SIDE_WIDTH,
  );
}
