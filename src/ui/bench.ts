/**
 * Banc d'essai provisoire : montre la disposition du livret, laisse tirer un laser depuis
 * n'importe quel repère et affiche le résultat. Il sert à éprouver la logique du jeu
 * (géométrie, laser, règles de placement) à la main, y compris sur téléphone.
 * Il sera remplacé par la vraie interface à l'étape v0.6.
 */
import { ENTRY_POINTS, type EntryPoint } from '../game/board';
import { GRID_COLS, GRID_ROWS } from '../game/constants';
import { RESULT_COLOR_LABELS, type GemColor, type ResultColor } from '../game/colors';
import { BOOKLET_LAYOUT } from '../game/examples';
import { GEM_SHAPES, placedPolygon } from '../game/gems';
import { shoot, type ShotResult } from '../game/laser';
import { validatePlacements } from '../game/placement';
import { visibleGemIndices } from '../game/visibility';

const GEM_FILL: Record<GemColor, string> = {
  red: '#c0392b',
  yellow: '#e8b100',
  blue: '#2f6fb5',
  white: '#f4f4f4',
};

const RAY_COLOR: Record<ResultColor, string> = {
  transparent: '#9aa3b2',
  red: '#e74c3c',
  yellow: '#f1c40f',
  blue: '#3498db',
  white: '#ffffff',
  orange: '#e67e22',
  violet: '#8e44ad',
  green: '#27ae60',
  pink: '#ff8fab',
  'light-yellow': '#f7e26b',
  'light-blue': '#8ec5ff',
  'light-violet': '#c3a6ff',
  black: '#222222',
  'light-green': '#9be59b',
  'light-orange': '#ffbf80',
  gray: '#8a8a8a',
};

const ENTRY_LABEL_POSITION = (entry: EntryPoint): [number, number] => {
  const middle = entry.index + 0.5;
  switch (entry.side) {
    case 'top':
      return [middle, -0.5];
    case 'bottom':
      return [middle, GRID_ROWS + 0.5];
    case 'left':
      return [-0.5, middle];
    case 'right':
      return [GRID_COLS + 0.5, middle];
  }
};

function points(list: readonly (readonly [number, number])[]): string {
  return list.map(([x, y]) => `${x},${y}`).join(' ');
}

function gridSvg(shot: ShotResult | null): string {
  const lines: string[] = [];
  for (let x = 0; x <= GRID_COLS; x++) {
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${GRID_ROWS}"/>`);
  }
  for (let y = 0; y <= GRID_ROWS; y++) {
    lines.push(`<line x1="0" y1="${y}" x2="${GRID_COLS}" y2="${y}"/>`);
  }

  const gems = BOOKLET_LAYOUT.map((placement) => {
    const shape = GEM_SHAPES[placement.gem];
    return `<polygon class="gem" points="${points(placedPolygon(placement))}" fill="${GEM_FILL[shape.color]}"><title>${shape.label}</title></polygon>`;
  }).join('');

  const entries = ENTRY_POINTS.map((entry) => {
    const [x, y] = ENTRY_LABEL_POSITION(entry);
    const state =
      shot?.entry === entry.label ? ' is-entry' : shot?.exit === entry.label ? ' is-exit' : '';
    return `<g class="entry${state}" data-entry="${entry.label}" role="button" tabindex="0" aria-label="Tirer depuis ${entry.label}"><rect x="${x - 0.45}" y="${y - 0.45}" width="0.9" height="0.9" rx="0.2"/><text x="${x}" y="${y}">${entry.label}</text></g>`;
  }).join('');

  let ray = '';
  if (shot) {
    const path = points(shot.path);
    ray = `<polyline class="ray-outline" points="${path}"/><polyline class="ray" points="${path}" stroke="${RAY_COLOR[shot.color]}"/>`;
  }

  return `
    <svg viewBox="-1.1 -1.1 ${GRID_COLS + 2.2} ${GRID_ROWS + 2.2}" role="img" aria-label="Mine de 10 colonnes sur 8 lignes avec cinq gemmes">
      <rect class="board" x="0" y="0" width="${GRID_COLS}" height="${GRID_ROWS}"/>
      <g class="grid">${lines.join('')}</g>
      ${gems}
      ${ray}
      ${entries}
    </svg>`;
}

function describeShot(shot: ShotResult | null): string {
  if (!shot) {
    return 'Touchez un repère du bord pour tirer un laser. Essayez le « I » puis le « 15 » : ce sont les deux exemples du livret.';
  }
  const color = RESULT_COLOR_LABELS[shot.color];
  const touched = shot.touched.length
    ? ` Gemmes touchées : ${shot.touched.map((c) => ({ red: 'rouge', yellow: 'jaune', blue: 'bleue', white: 'blanche' })[c]).join(', ')}.`
    : '';
  return `Du point ${shot.entry}, le rayon ressort ${color} en ${shot.exit}.${touched}`;
}

function rulesSummary(): string {
  const violations = validatePlacements(BOOKLET_LAYOUT);
  const visible = visibleGemIndices(BOOKLET_LAYOUT).size;
  const placement =
    violations.length === 0 ? 'valide' : `${violations.length} règle(s) enfreinte(s)`;
  return `Placement : ${placement}. Gemmes atteignables en ligne droite : ${visible} sur ${BOOKLET_LAYOUT.length}.`;
}

export function mountBench(container: HTMLElement): void {
  let shot: ShotResult | null = null;

  const render = (): void => {
    container.innerHTML = `
      <div class="bench-grid">${gridSvg(shot)}</div>
      <p class="bench-result" aria-live="polite">${describeShot(shot)}</p>
      <p class="bench-rules">${rulesSummary()}</p>`;
  };

  const fire = (label: string): void => {
    shot = shoot(BOOKLET_LAYOUT, label);
    render();
  };

  container.addEventListener('click', (event) => {
    const target = (event.target as Element).closest<SVGElement>('[data-entry]');
    if (target?.dataset['entry']) fire(target.dataset['entry']);
  });
  container.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = (event.target as Element).closest<SVGElement>('[data-entry]');
    if (target?.dataset['entry']) {
      event.preventDefault();
      fire(target.dataset['entry']);
    }
  });

  render();
}
