import { describe, expect, it } from 'vitest';
import { newHistory } from '../src/game/notes';
import { emptySolution, rotateGem } from '../src/game/solution';
import { EXTENSION_GEM_IDS, BASE_GEM_IDS, type GemId } from '../src/game/gems';
import { footerHtml, isDrawingTool, toolsHtml } from '../src/ui/notesBoard';
import type { Pending } from '../src/ui/board';
import { playBoardSvg } from '../src/ui/playBoard';
import { gemButtonsSvg, trayHtml } from '../src/ui/solutionBoard';
import type { ProbeRecord, ShotRecord } from '../src/game/session';

const baseView = {
  solution: emptySolution(),
  selected: null,
  issues: [],
  shots: [],
  selectedShot: null,
  selectedProbe: null as string | null,
  probes: [],
  notes: null,
  showGems: true,
  tool: null,
  ink: 'ink' as const,
  hypothesis: null,
  cursor: { row: 0, col: 0 },
  pending: null as Pending | null,
  fresh: { shot: null as number | null, probe: null as string | null },
};

describe('outils de notes', () => {
  it('propose tir, crayon, ligne droite, gomme, vide et simulation, sans les anciennes marques', () => {
    const html = toolsHtml({ tool: null, ink: 'ink' });
    for (const tool of ['fire', 'pencil', 'line', 'eraser', 'empty', 'simulate']) {
      expect(html).toContain(`data-tool="${tool}"`);
    }
    for (const gone of ['red', 'yellow', 'blue', 'white', 'maybe']) {
      expect(html).not.toContain(`data-tool="${gone}"`);
    }
    expect(html).not.toContain('>?<');
  });

  it('le bouton « Tir » est à gauche de « Gemmes », « Crayon » et « Ligne droite »', () => {
    const html = toolsHtml({ tool: null, ink: 'ink' });
    const at = (needle: string): number => html.indexOf(needle);
    expect(at('data-tool="fire"')).toBeLessThan(at('data-mode="gems"'));
    expect(at('data-mode="gems"')).toBeLessThan(at('data-tool="pencil"'));
    expect(at('data-tool="pencil"')).toBeLessThan(at('data-tool="line"'));
    expect(toolsHtml({ tool: 'fire', ink: 'ink' })).toMatch(/data-tool="fire" aria-pressed="true"/);
  });

  it('la gomme n’est plus un bouton texte : une icône à droite des couleurs', () => {
    const html = toolsHtml({ tool: null, ink: 'ink' });
    expect(html).not.toContain('>Gomme<');
    expect(html).toMatch(/data-tool="eraser"[^>]*aria-label="Gomme"[^>]*><svg/);
    expect(html.indexOf('data-ink="blue"')).toBeLessThan(html.indexOf('data-tool="eraser"'));
    // Dans la rangée des couleurs, après la dernière.
    const inkRow = html.slice(html.indexOf('ink-row'), html.indexOf('data-tool="empty"'));
    expect(inkRow).toContain('data-tool="eraser"');
  });

  it('la classe du bouton gomme n’entre pas en collision avec celle de la grille (tool-eraser)', () => {
    // La grille porte « tool-<outil> » : un bouton qui réutiliserait « tool-eraser » recevrait les mêmes
    // règles CSS que la grille, et inversement (la grille rétrécissait à la taille d'un bouton).
    const tools = toolsHtml({ tool: 'eraser', ink: 'ink' });
    expect(tools).not.toContain('tool-eraser');
    expect(playBoardSvg({ ...baseView, tool: 'eraser' })).toContain('tool-eraser');
  });

  it('le bouton « Gemmes » précède « Crayon » et marque le mode gemmes', () => {
    const none = toolsHtml({ tool: null, ink: 'ink' });
    expect(none.indexOf('data-mode="gems"')).toBeLessThan(none.indexOf('data-tool="pencil"'));
    expect(none).toMatch(/data-mode="gems" aria-pressed="true"/);
    expect(toolsHtml({ tool: 'pencil', ink: 'ink' })).toMatch(
      /data-mode="gems" aria-pressed="false"/,
    );
  });

  it('propose les encres, noir compris', () => {
    const html = toolsHtml({ tool: 'pencil', ink: 'black' });
    for (const ink of ['ink', 'black', 'red', 'yellow', 'blue']) {
      expect(html).toContain(`data-ink="${ink}"`);
    }
    expect(html).toMatch(/data-ink="black" aria-pressed="true"/);
    expect(html).toMatch(/data-tool="pencil" aria-pressed="true"/);
  });

  it('seuls crayon, ligne, gomme et vide dessinent', () => {
    expect(isDrawingTool(null)).toBe(false);
    expect(isDrawingTool('simulate')).toBe(false);
    expect(isDrawingTool('fire')).toBe(false);
    for (const tool of ['pencil', 'line', 'eraser', 'empty'] as const) {
      expect(isDrawingTool(tool)).toBe(true);
    }
  });

  it('le pied de grille porte les deux cases à cocher et annuler / rétablir / effacer', () => {
    const html = footerHtml({ history: newHistory(), showNotes: true, showGems: false });
    expect(html).toContain('data-toggle="notes" checked');
    expect(html).toContain('>↶</button>');
    expect(html).toContain('>↷</button>');
    // Annuler / rétablir à gauche, cases à cocher à droite.
    expect(html.indexOf('data-action="undo"')).toBeLessThan(html.indexOf('data-toggle="notes"'));
    expect(html).not.toContain('data-toggle="gems" checked');
    for (const action of ['undo', 'redo', 'clear-notes']) {
      expect(html).toMatch(new RegExp(`data-action="${action}"[^>]*disabled`));
    }
  });
});

describe('grille de jeu unique', () => {
  it('sans outil : les repères tirent et les cases se sondent', () => {
    const html = playBoardSvg(baseView);
    expect(html).toContain('data-fire="1"');
    expect(html).toContain('data-probe="A1"');
    expect(html).not.toContain('data-hypo');
  });

  it('avec un outil de dessin : plus de sonde, les repères tirent encore', () => {
    const html = playBoardSvg({ ...baseView, tool: 'line' });
    expect(html).not.toContain('data-probe');
    expect(html).toContain('data-fire="1"');
  });

  it('un outil de dessin met en mode notes, sinon en mode gemmes', () => {
    expect(playBoardSvg({ ...baseView, tool: 'pencil' })).toContain('mode-notes');
    expect(playBoardSvg({ ...baseView, tool: null })).toContain('mode-gems');
    expect(playBoardSvg({ ...baseView, tool: 'simulate' })).toContain('mode-gems');
  });

  it('avec l’outil « Tir » : repères et cases tirent, en mode gemmes', () => {
    const html = playBoardSvg({ ...baseView, tool: 'fire' });
    expect(html).toContain('data-fire="1"');
    expect(html).toContain('data-probe="A1"');
    expect(html).toContain('tool-fire');
    expect(html).toContain('mode-gems');
  });

  it('en simulation : les repères testent sur les gemmes du joueur', () => {
    const html = playBoardSvg({ ...baseView, tool: 'simulate' });
    expect(html).toContain('data-hypo="1"');
    expect(html).not.toContain('data-fire');
  });
});

describe('bulle de confirmation du tir', () => {
  it('sans tir annoncé : aucune bulle', () => {
    expect(playBoardSvg(baseView)).not.toContain('shot-bubble');
  });

  it('annonce un laser : « Tirer en E ? » au-dessus du repère, qui est entouré en vert', () => {
    const html = playBoardSvg({ ...baseView, pending: { kind: 'fire', label: 'E' } });
    // La queue est en bas : la bulle est au-dessus du repère.
    expect(html).toContain('class="shot-bubble from-bottom"');
    expect(html).toContain('>Tirer en E ?<');
    expect(html).toContain('class="pending-ring"');
    // Un repère du haut n'a pas de place au-dessus : la bulle passe au-dessous.
    const top = playBoardSvg({ ...baseView, pending: { kind: 'fire', label: '3' } });
    expect(top).toContain('class="shot-bubble from-top"');
    // Elle laisse passer le pointeur : le second clic tombe sur le repère.
    expect(html.indexOf('shot-bubble')).toBeGreaterThan(html.indexOf('data-fire="E"'));
  });

  it('annonce une sonde : « Tirer en E4 ? » au-dessus de la case, ou en dessous en haut de grille', () => {
    const middle = playBoardSvg({ ...baseView, pending: { kind: 'probe', cell: 'E4' } });
    expect(middle).toContain('>Tirer en E4 ?<');
    expect(middle).toContain('from-bottom');
    expect(middle).toContain('class="pending-ring"');
    const top = playBoardSvg({ ...baseView, pending: { kind: 'probe', cell: 'A4' } });
    expect(top).toContain('from-top');
  });

  it('un repère ou une case inconnus ne dessinent rien', () => {
    expect(playBoardSvg({ ...baseView, pending: { kind: 'fire', label: 'ZZ' } })).not.toContain(
      'shot-bubble',
    );
    expect(playBoardSvg({ ...baseView, pending: { kind: 'probe', cell: 'Z99' } })).not.toContain(
      'shot-bubble',
    );
  });
});

describe('apparition animée des marques', () => {
  const shot: ShotRecord = {
    n: 1,
    entry: '1',
    exit: '11',
    color: 'red',
    path: [],
  } as unknown as ShotRecord;
  const probe: ProbeRecord = { cell: 'E4', content: 'nothing' } as ProbeRecord;

  it("anime seulement les pastilles du dernier tir, pas celles d'avant", () => {
    const fresh = playBoardSvg({ ...baseView, shots: [shot], fresh: { shot: 1, probe: null } });
    // Le tir (pastille d'entrée) apparaît d'abord, le résultat (pastille de sortie) 0,5 s plus tard.
    expect(fresh).toContain('class="pop"');
    expect(fresh).toContain('class="pop pop-late"');
    const old = playBoardSvg({ ...baseView, shots: [shot] });
    expect(old).not.toContain('class="pop"');
  });

  it('anime la marque de la case qui vient d’être sondée', () => {
    const fresh = playBoardSvg({
      ...baseView,
      probes: [probe],
      fresh: { shot: null, probe: 'E4' },
    });
    expect(fresh).toContain('probe-nothing pop');
    expect(playBoardSvg({ ...baseView, probes: [probe] })).not.toContain('pop');
  });
});

describe('boutons de la gemme sélectionnée', () => {
  const place = (gem: GemId, rotation: 0 | 1 | 2 | 3, col: number, row: number) => ({
    ...emptySolution(),
    [gem]: { gem, orientation: { rotation, flipped: false }, col, row },
  });
  const rotateButtonCenter = (solution: ReturnType<typeof emptySolution>, gem: GemId) => {
    const html = gemButtonsSvg({ solution, selected: gem });
    const match = /data-action="rotate".*?<circle cx="([\d.-]+)" cy="([\d.-]+)"/.exec(html);
    return match ? [Number(match[1]), Number(match[2])] : null;
  };

  it('le bouton de rotation ne bouge pas quand on fait tourner la gemme', () => {
    for (const gem of [
      'blue-triangle',
      'red-parallelogram',
      'white-triangle',
      'black-body',
    ] as const) {
      let solution = place(gem, 0, 3, 3);
      const first = rotateButtonCenter(solution, gem);
      expect(first).not.toBeNull();
      for (let turn = 0; turn < 4; turn++) {
        solution = rotateGem(solution, gem);
        expect(rotateButtonCenter(solution, gem)).toEqual(first);
      }
    }
  });

  it('le bouton se pose au coin haut-droit de la gemme (0,15 case vers l’extérieur), sans décalage', () => {
    const expected: [GemId, [number, number]][] = [
      // Boîte 4 × 2 en (3, 3) : coin haut-droit (7, 3).
      ['blue-triangle', [7.15, 2.85]],
      ['white-triangle', [7.15, 2.85]],
      // Boîte 3 × 1 : coin (6, 3).
      ['red-parallelogram', [6.15, 2.85]],
      // Boîte 2 × 2 : coin (5, 3).
      ['yellow-triangle', [5.15, 2.85]],
      // Boîte 2 × 1, axe sur la case de droite : le bouton ne déborde pas d'une case vers la droite.
      ['black-body', [5.15, 2.85]],
      ['diamond', [5.15, 2.85]],
    ];
    for (const [gem, [x, y]] of expected) {
      const [cx, cy] = rotateButtonCenter(place(gem, 0, 3, 3), gem) ?? [];
      expect(cx).toBeCloseTo(x, 5);
      expect(cy).toBeCloseTo(y, 5);
    }
  });

  it('le losange blanc n’a pas de bouton de rotation', () => {
    const html = gemButtonsSvg({
      solution: place('white-rhombus', 0, 3, 3),
      selected: 'white-rhombus',
    });
    expect(html).not.toContain('data-action="rotate"');
  });

  it('la gemme rouge garde son bouton de retournement', () => {
    const html = gemButtonsSvg({
      solution: place('red-parallelogram', 0, 3, 3),
      selected: 'red-parallelogram',
    });
    expect(html).toContain('data-action="rotate"');
    expect(html).toContain('data-action="flip"');
  });
});

describe('réserve des gemmes', () => {
  it('ne montre que les gemmes pas encore posées', () => {
    const view = { solution: emptySolution(), selected: null, issues: [] };
    const html = trayHtml(view);
    for (const gem of BASE_GEM_IDS) expect(html).toContain(`data-gem="${gem}"`);
    for (const gem of EXTENSION_GEM_IDS) expect(html).not.toContain(`data-gem="${gem}"`);
    const placed = {
      ...view.solution,
      'blue-triangle': {
        gem: 'blue-triangle' as const,
        orientation: { rotation: 0 as const, flipped: false },
        col: 0,
        row: 0,
      },
    };
    expect(trayHtml({ ...view, solution: placed })).not.toContain('data-gem="blue-triangle"');
  });
});
