/**
 * Page « Règles » : les règles du jeu à l'usage des joueurs. Source : docs/regles.md.
 * Les schémas sont dessinés à partir des mêmes données que le jeu (formes, table des couleurs,
 * simulateur), donc ils ne peuvent pas dire autre chose que le jeu.
 */
import { RESULT_COLOR_LABELS, mixColors, type GemColor } from '../game/colors';
import {
  GEM_SHAPES,
  BASE_GEM_IDS,
  distinctOrientations,
  orientedPolygon,
  placedPolygon,
} from '../game/gems';
import { BOOKLET_LAYOUT } from '../game/examples';
import { boundingBox } from '../game/geometry';
import { shoot } from '../game/laser';
import { boardFrame, entryLabelsSvg } from './board';
import { PATTERN_DEFS, RAY_COLOR, gemPolygons } from './palette';
import { t } from './strings';

const COLORS: readonly GemColor[] = ['red', 'yellow', 'blue', 'white'];

function points(list: readonly (readonly [number, number])[]): string {
  return list.map(([x, y]) => `${x},${y}`).join(' ');
}

/** Petit dessin d'une gemme dans son orientation de départ. */
function gemFigure(id: (typeof BASE_GEM_IDS)[number]): string {
  const shape = GEM_SHAPES[id];
  const polygon = orientedPolygon(shape, { rotation: 0, flipped: false });
  const { maxX, maxY } = boundingBox(polygon);
  const pad = 0.25;
  const orientations = distinctOrientations(shape).length;
  return `<figure class="gem-figure">
    <svg viewBox="${-pad} ${-pad} ${maxX + 2 * pad} ${maxY + 2 * pad}" role="img" aria-label="${shape.label}" style="width:${(maxX + 2 * pad) * 26}px">
      ${PATTERN_DEFS}${gemPolygons(points(polygon), shape.color, 'real-gem')}
    </svg>
    <figcaption><b>${shape.label}</b><br>${maxX} × ${maxY} cases · ${orientations} position${orientations > 1 ? 's' : ''}${shape.flippable ? '<br><span class="flip-note">Peut être retournée</span>' : ''}</figcaption>
  </figure>`;
}

/** Schéma d'exemple du livret : la mine et le trajet du tir depuis le repère 15. */
function exampleBoard(): string {
  const gems = BOOKLET_LAYOUT.map((placement) => {
    const shape = GEM_SHAPES[placement.gem];
    return gemPolygons(points(placedPolygon(placement)), shape.color, 'real-gem', shape.label);
  }).join('');
  const shot = shoot(BOOKLET_LAYOUT, '15');
  const path = points(shot.path);
  const ray = `<polyline class="ray-outline" points="${path}"/><polyline class="ray" points="${path}" stroke="${RAY_COLOR[shot.color]}"/>`;
  return boardFrame(
    'Exemple : le rayon entre par le repère 15 et ressort en 8',
    `${gems}${ray}${entryLabelsSvg(null, 'none', undefined, false)}`,
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
  return `<div class="scroll"><table class="rules-table"><thead><tr><th>Gemmes touchées</th><th>Couleur annoncée</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

const COLOR_NAME: Record<GemColor, string> = {
  red: 'rouge',
  yellow: 'jaune',
  blue: 'bleu',
  white: 'blanc',
};

export function rulesPage(): string {
  return `
    <article class="rules">
      <p><a class="back" href="#jeu">← ${t.nav.backToGame}</a></p>
      <h1>Règles d'Orapa Mine</h1>
      <p class="lede">Orapa Mine est un jeu de déduction de Junghee Choi et Wanjin Gill (Gameology, édition française Miraludo). Ici, la machine cache des gemmes dans une mine ; à vous de les retrouver en envoyant des rayons depuis les bords.</p>

      <h2>But du jeu</h2>
      <p>Retrouver la position <b>exacte</b> des 5 gemmes cachées. Chaque partie a <b>une seule réponse possible</b> : tout ce qu'il faut pour la deviner est dans les résultats des tirs. Si vous vous trompez, c'est que vous n'avez pas tiré assez de lasers.</p>

      <h2>La grille et les repères</h2>
      <p>La mine est une grille de <b>10 colonnes × 8 lignes</b>. Une case se nomme par sa ligne (A à H, de haut en bas) puis sa colonne (1 à 10, de gauche à droite) : « E4 ».</p>
      <p>Les <b>36 repères</b> du bord servent à tirer et à lire les résultats : <b>1 à 10</b> en haut (colonnes), <b>11 à 18</b> à droite (lignes), <b>I à R</b> en bas (colonnes) et <b>A à H</b> à gauche (lignes). Le rayon entre perpendiculairement au bord.</p>

      <h2>Les gemmes</h2>
      <p>La partie compte <b>5 gemmes</b> : 1 rouge, 1 jaune, 1 bleue et 2 blanches. Chacune a un coin sur un coin de la grille et se pose bien droite.</p>
      <div class="gem-figures">${BASE_GEM_IDS.map(gemFigure).join('')}</div>
      <p class="note-box"><b>Particularité de la gemme rouge.</b> Les pièces ont leur quadrillage sur une face. Seule la gemme rouge porte un quadrillage foncé sur ses <b>deux</b> faces : elle peut être <b>retournée</b> (penchée vers la droite ou vers la gauche). Toutes les autres gemmes se posent face quadrillée visible et ne se retournent jamais, seulement pivotées par quarts de tour.</p>

      <h2>Où peut-on poser les gemmes ?</h2>
      <ol class="rule-list">
        <li><b>Face visible.</b> Les lignes de la surface doivent être visibles (pas de retournement, sauf la rouge).</li>
        <li><b>Sur la grille.</b> Chaque coin d'une gemme est sur un coin de la grille ; pas de pose de travers.</li>
        <li><b>Dans le plateau.</b> Une gemme peut toucher le bord, pas le dépasser.</li>
        <li><b>Pas côte à côte.</b> Deux gemmes ne se touchent que par un point (un coin contre un coin, ou un coin contre le milieu d'un côté), jamais le long d'un côté, et ne se chevauchent pas.</li>
        <li><b>Accessible.</b> Chaque gemme doit pouvoir être atteinte en ligne droite par un laser parti d'un bord, sans rebond.</li>
      </ol>

      <h2>Le rayon</h2>
      <p>Le rayon est transparent au départ. Il avance tout droit, horizontalement ou verticalement, au milieu des cases, jusqu'à toucher une gemme. Il ne la traverse jamais : il <b>rebondit</b>. Sur une face inclinée à 45° il tourne de 90° ; sur une face droite touchée de face, il repart en sens inverse. Il ressort toujours, parfois par son point d'entrée.</p>
      <p>À chaque tir, vous apprenez deux choses : le <b>repère de sortie</b> et la <b>couleur</b> du rayon.</p>
      ${exampleBoard()}
      <p class="hint">Exemple du livret : depuis le repère 15, le rayon rebondit sur le losange blanc, le parallélogramme rouge et le grand triangle bleu, puis ressort <b>violet clair en 8</b>.</p>

      <h2>Les couleurs</h2>
      <p>Au contact d'une gemme, le rayon prend sa couleur ; plusieurs gemmes se mélangent. Si le rayon touche plusieurs fois la même couleur, <b>seule la première compte</b> : la couleur finale ne dépend que des couleurs différentes touchées, pas de leur nombre ni de leur ordre.</p>
      ${colorTable()}
      <p class="hint">Dans cette application, chaque couleur est aussi écrite en toutes lettres, et les gemmes portent un motif : rouge hachuré, jaune pointillé, bleu rayé, blanc uni.</p>

      <h2>Jouer ici</h2>
      <ul class="rule-list">
        <li><b>Tirs</b> : touchez un repère du bord. Le compteur compte les lasers ; redemander un repère déjà tiré est gratuit.</li>
        <li><b>Sonder une case</b> : « Qu'y a-t-il en E4 ? » La réponse est « rien » ou la couleur de la gemme. Les sondages sont comptés à part des lasers.</li>
        <li><b>Ma solution</b> : glissez les gemmes de la réserve vers la grille, pivotez-les (et retournez la rouge). Touchez un repère pour <b>tester un tir sur votre propre grille</b> : les repères déjà tirés s'entourent de vert si votre grille donne le même résultat, de rouge sinon.</li>
        <li><b>Notes</b> : crayon, marques de cases, gomme, annuler et rétablir. Elles n'ont aucun effet sur la correction.</li>
        <li><b>Soumettre</b> : seulement quand les 5 gemmes sont posées sans enfreindre de règle. <b>Une seule proposition</b> : une erreur met fin à la partie et révèle la mine, comme au jeu à deux.</li>
        <li><b>Graine</b> : chaque mine a une graine. Copiez le lien pour rejouer ou comparer la même mine avec quelqu'un d'autre.</li>
        <li><b>Sauvegarde</b> : la partie en cours est conservée dans ce navigateur ; vous pourrez la reprendre en revenant sur le site.</li>
      </ul>
      <p><a class="back" href="#jeu">← ${t.nav.backToGame}</a></p>
    </article>`;
}
