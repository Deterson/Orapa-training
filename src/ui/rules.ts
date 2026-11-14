/**
 * Page « Règles » : les règles du jeu à l'usage des joueurs. Source : docs/regles.md.
 * Les schémas sont dessinés à partir des mêmes données que le jeu (formes, table des couleurs,
 * simulateur), donc ils ne peuvent pas dire autre chose que le jeu.
 */
import { RESULT_COLOR_LABELS, mixColors, type GemColor } from '../game/colors';
import {
  BASE_GEM_IDS,
  EXTENSION_GEM_IDS,
  GEM_SHAPES,
  type GemId,
  orientedPolygon,
  placedPolygon,
} from '../game/gems';
import { BOOKLET_LAYOUT } from '../game/examples';
import { boundingBox } from '../game/geometry';
import { shoot } from '../game/laser';
import { boardFrame, entryLabelsSvg } from './board';
import { RAY_COLOR, gemPolygons, lostSignalHtml } from './palette';
import { t } from './strings';

const COLORS: readonly GemColor[] = ['red', 'yellow', 'blue', 'white'];

function points(list: readonly (readonly [number, number])[]): string {
  return list.map(([x, y]) => `${x},${y}`).join(' ');
}

/** Petit dessin d'une gemme dans son orientation de départ. */
function gemFigure(id: GemId): string {
  const shape = GEM_SHAPES[id];
  const polygon = orientedPolygon(shape, { rotation: 0, flipped: false });
  const { maxX, maxY } = boundingBox(polygon);
  const pad = 0.25;
  return `<figure class="gem-figure">
    <svg viewBox="${-pad} ${-pad} ${maxX + 2 * pad} ${maxY + 2 * pad}" role="img" aria-label="${shape.label}" style="width:${(maxX + 2 * pad) * 26}px">
      ${gemPolygons(polygon, shape.color, 'real-gem')}
    </svg>
    <figcaption><b>${shape.label}</b><br>${maxX} × ${maxY}${shape.flippable ? '<br><span class="flip-note">retournable</span>' : ''}</figcaption>
  </figure>`;
}

/** Schéma d'exemple du livret : la mine et le trajet du tir depuis le repère 15. */
function exampleBoard(): string {
  const gems = BOOKLET_LAYOUT.map((placement) => {
    const shape = GEM_SHAPES[placement.gem];
    return gemPolygons(placedPolygon(placement), shape.color, 'real-gem', shape.label);
  }).join('');
  const shot = shoot(BOOKLET_LAYOUT, '15');
  const path = points(shot.path);
  const ray = `<polyline class="ray-outline" points="${path}"/><polyline class="ray" points="${path}" stroke="${RAY_COLOR[shot.color]}"/>`;
  return boardFrame(
    'Exemple : le rayon entre par le repère 15 et ressort en 8',
    `${gems}${ray}${entryLabelsSvg(null, 'none', false)}`,
    'rules-board',
  );
}

/** Table des couleurs, construite avec la même fonction que le simulateur. */
function colorTable(): string {
  const rows: string[] = [];
  for (let mask = 1; mask < 16; mask++) {
    const touched = COLORS.filter((_, bit) => (mask & (1 << bit)) !== 0);
    const result = mixColors(touched);
    rows.push(
      `<tr><td>${touched.map((c) => COLOR_NAME[c]).join(' + ')}</td><td><span class="chip" style="background:${RAY_COLOR[result]}" aria-hidden="true"></span> ${RESULT_COLOR_LABELS[result]}</td></tr>`,
    );
  }
  return `<div class="scroll"><table class="rules-table"><thead><tr><th>Gemmes</th><th>Couleur</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

const COLOR_NAME: Record<GemColor, string> = {
  red: 'rouge',
  yellow: 'jaune',
  blue: 'bleu',
  white: 'blanc',
};

export function rulesPage(version: string): string {
  return `
    <article class="rules">
      <p><a class="back" href="#jeu">← ${t.nav.backToGame}</a></p>
      <h1>Règles</h1>

      <h2>But</h2>
      <p>Retrouver les gemmes cachées (5, plus les extensions choisies). Une seule solution possible.</p>

      <h2>Grille</h2>
      <p>10 × 8. Case : ligne A–H + colonne 1–10 (<b>E4</b>). Repères du bord : 1–10 haut, 11–18 droite, I–R bas, A–H gauche.</p>

      <h2>Gemmes</h2>
      <div class="gem-figures">${BASE_GEM_IDS.map(gemFigure).join('')}</div>
      <p class="note-box"><b>La rouge se retourne</b> (quadrillage foncé des deux côtés). Les autres : jamais.</p>

      <h2>Extensions</h2>
      <p>Au choix, au début de la partie.</p>
      <div class="gem-figures">${EXTENSION_GEM_IDS.map(gemFigure).join('')}</div>
      <ul class="rule-list">
        <li><b>Diamant</b> : dévie le rayon, sans changer sa couleur.</li>
        <li><b>Diamant noir</b> : absorbe le rayon. ${lostSignalHtml()} <b>Signal perdu</b> : ni sortie, ni couleur. Se pose sur sa base.</li>
      </ul>

      <h2>Placement</h2>
      <ul class="rule-list">
        <li>Sur la grille, dans le plateau, face quadrillée visible.</li>
        <li>Pas côte à côte : contact par un point seulement.</li>
        <li>Chaque gemme visible en ligne droite depuis un bord.</li>
      </ul>

      <h2>Rayon</h2>
      <p>Il avance droit et rebondit : face à 45° → virage de 90°, face droite → demi-tour. Résultat : <b>sortie + couleur</b>.</p>
      ${exampleBoard()}
      <p class="hint">15 → violet clair en 8.</p>

      <h2>Couleurs</h2>
      <p>Seules les couleurs <b>différentes</b> touchées comptent.</p>
      ${colorTable()}

      <h2>Jouer</h2>
      <ul class="rule-list">
        <li><b>Tirs</b> : touchez un repère (laser) ou une case (sonde). Vos gemmes et vos notes y apparaissent en transparence.</li>
        <li><b>Gemmes</b> : posez les gemmes ; touchez un repère pour tester un tir sur votre grille.</li>
        <li><b>Soumettre</b> : une seule proposition.</li>
      </ul>
      <p><a class="back" href="#jeu">← ${t.nav.backToGame}</a></p>
      <p class="hint">Orapa Mine : J. Choi et W. Gill (Gameology, Miraludo) · v${version}</p>
    </article>`;
}
