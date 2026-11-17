/**
 * Écran de résultat : la vraie mine, avec les gemmes du joueur en pointillés (vert si bien placée, rouge
 * sinon). Le détail se lit dans l'historique des tirs (cartes en rouge pour les tirs que la proposition ne
 * reproduit pas) ; en survolant ou en sélectionnant une carte, le tir est simulé sur la proposition du joueur.
 */
import { parseEntryLabel } from '../game/board';
import { GEM_SHAPES, placedPolygon } from '../game/gems';
import type { ShotResult } from '../game/laser';
import type { ProbeRecord, ShotRecord } from '../game/session';
import type { GemDiff } from '../game/verify';
import { boardFrame, entryLabelsSvg, labelCenter, probeRingSvg } from './board';
import { RAY_COLOR, gemPolygons } from './palette';

function points(list: readonly (readonly [number, number])[]): string {
  return list.map(([x, y]) => `${x},${y}`).join(' ');
}

/** Anneau autour d'un repère du bord. */
function ringSvg(label: string): string {
  const entry = parseEntryLabel(label);
  if (entry === null) return '';
  const [x, y] = labelCenter(entry);
  return `<rect class="explore-ring" x="${x - 0.5}" y="${y - 0.5}" width="1" height="1" rx="0.25"/>`;
}

/**
 * Trajet d'un tir simulé sur la proposition du joueur (le même tracé que l'outil « Simuler »). `preview` :
 * tracé provisoire, posé par le survol d'une carte, que l'application retire en sortant.
 */
export function simulationRaySvg(result: ShotResult, preview = false): string {
  const path = points(result.path);
  return `<g class="sim-ray${preview ? ' is-preview' : ''}"><polyline class="ray-outline" points="${path}"/><polyline class="ray" points="${path}" stroke="${RAY_COLOR[result.color]}"/></g>`;
}

export interface ResultView {
  shots: readonly ShotRecord[];
  probes: readonly ProbeRecord[];
  /** Laser libre tiré dans la vraie mine (clic sur un repère), avec son trajet. */
  explored: ShotResult | null;
  /** Tir sélectionné dans l'historique, simulé sur la proposition du joueur. */
  simulated: ShotResult | null;
  selectedShot: number | null;
  selectedProbe: string | null;
}

/**
 * La vraie mine et la proposition du joueur. Les 36 repères restent cliquables : la partie est
 * finie, on peut donc tirer des lasers librement et en voir le trajet dans la mine révélée.
 */
export function resultBoardSvg(diffs: readonly GemDiff[], view: ResultView): string {
  const actual = diffs
    .map(({ actual: placement }) => {
      const shape = GEM_SHAPES[placement.gem];
      return gemPolygons(placedPolygon(placement), shape.color, 'real-gem', shape.label);
    })
    .join('');
  const guesses = diffs
    .filter((diff) => diff.guess !== null)
    .map(
      (diff) =>
        `<polygon class="guess-gem ${diff.status === 'correct' ? 'is-correct' : 'is-wrong'}" points="${points(placedPolygon(diff.guess!))}"/>`,
    )
    .join('');
  const { explored, simulated } = view;
  const ray = explored
    ? `<polyline class="ray-outline" points="${points(explored.path)}"/><polyline class="ray" points="${points(explored.path)}" stroke="${RAY_COLOR[explored.color]}"/>${ringSvg(explored.entry)}${ringSvg(explored.exit)}`
    : '';
  const rings = view.probes.map((probe) => probeRingSvg(probe.cell, view.selectedProbe)).join('');
  return boardFrame(
    'La vraie mine et votre proposition : touchez un repère pour tirer un laser',
    `${actual}${guesses}${rings}${ray}${simulated ? simulationRaySvg(simulated) : ''}${entryLabelsSvg({ shots: view.shots, selected: view.selectedShot }, 'explore')}`,
    'result-svg',
  );
}
