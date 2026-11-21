/**
 * Cartes de l'historique des tirs (colonne de gauche) : un tir au laser (« 1   E → K   ● »), une sonde de case
 * (« 5   B6   =   ● ») ; même présentation, même sélection. Fonctions pures : tout vient des arguments.
 */
import { componentColors, isMixColor } from '../game/colors';
import { GEM_SHAPES, orientedPolygon } from '../game/gems';
import { isAbsorbed } from '../game/laser';
import type { ProbeRecord, ShotRecord } from '../game/session';
import { PAINT_LETTER, RAY_COLOR, colorSumLabel, gemPolygons, lostSignalHtml } from './palette';
import { t } from './strings';

/**
 * Pastilles d'un résultat : une par couleur de gemme qui le compose, séparées par un « + »
 * (violet clair = rouge + bleu + blanc). « Transparent » : une pastille au simple contour blanc.
 * Le nom de la couleur n'est pas écrit : il apparaît au survol de la souris.
 */
export function chips(color: ShotRecord['color']): string {
  const parts = componentColors(color);
  const dots =
    parts.length === 0
      ? '<span class="chip chip-clear"></span>'
      : parts
          .map(
            (part) =>
              `<span class="chip" data-letter="${PAINT_LETTER[part]}" style="background:${RAY_COLOR[part]}"></span>`,
          )
          .join('<span class="plus">+</span>');
  const title = colorSumLabel(color);
  return `<span class="chips" aria-hidden="true" title="${title}">${dots}</span>`;
}

/**
 * Le Diamant en miniature (demi-losange creux), pour la réponse « diamant » d'une sonde. Toujours le même
 * dessin, pointe en haut (l'inverse de la réserve) : la sonde ne dit rien de son orientation réelle.
 */
function diamondMiniature(): string {
  const polygon = orientedPolygon(GEM_SHAPES['diamond'], { rotation: 2, flipped: false });
  return `<svg class="gem-mini" viewBox="-0.1 -0.1 2.2 1.2" aria-hidden="true" focusable="false">${gemPolygons(polygon, 'clear')}</svg>`;
}

/** Ce que répond une sonde, en image : rien (mot), pastille de couleur, signal perdu (pictogramme) ou Diamant. */
export function probeResultHtml(content: ProbeRecord['content']): string {
  if (content === 'nothing') return t.probe.nothing;
  if (content === 'black') return lostSignalHtml();
  if (content === 'clear') return diamondMiniature();
  return isMixColor(content) ? chips(content) : t.probe[content];
}

export interface CardState {
  /** Carte sélectionnée (reste en avant jusqu'à ce qu'on la reclique). */
  selected: boolean;
  /** Dernier tir : ses éléments apparaissent avec une petite animation. */
  fresh: boolean;
  /** Écran de résultat : la proposition du joueur ne reproduit pas ce tir (la carte est entourée de rouge). */
  wrong?: boolean;
}

/** Classes d'une carte : sélectionnée, et (au résultat) en désaccord avec la proposition. */
function cardClasses(state: CardState, extra = ''): string {
  return ['shot', extra, state.selected ? 'is-selected' : '', state.wrong ? 'is-wrong' : '']
    .filter(Boolean)
    .join(' ');
}

/** Tir au laser : « 1   E → K   ● », le trajet à gauche, les pastilles à droite. */
export function shotCardHtml(shot: ShotRecord, state: CardState, label: string): string {
  const lost = isAbsorbed(shot);
  const exit = lost
    ? `<span class="res">${lostSignalHtml()}</span>`
    : `<b class="res">${shot.exit}</b>`;
  return `<li${state.fresh ? ' class="is-new"' : ''}><button type="button" class="${cardClasses(state)}" data-shot="${shot.n}" aria-label="${label}" aria-pressed="${state.selected}"><span class="n">${shot.n}</span><span class="path"><b>${shot.entry}</b> → ${exit}</span>${lost ? '' : chips(shot.color)}</button></li>`;
}

/** Sonde de case : « 5   B6   =   ● » (ou « rien », le signal perdu, le Diamant en miniature). */
export function probeCardHtml(probe: ProbeRecord, state: CardState): string {
  const label = `${probe.cell} : ${t.probe[probe.content]}${state.wrong ? `, ${t.result.mismatch}` : ''}`;
  return `<li${state.fresh ? ' class="is-new"' : ''}><button type="button" class="${cardClasses(state, 'is-probe')}" data-probe-card="${probe.cell}" aria-label="${label}" aria-pressed="${state.selected}"><span class="n">${probe.n}</span><span class="path"><b>${probe.cell}</b> = <span class="res">${probeResultHtml(probe.content)}</span></span></button></li>`;
}
