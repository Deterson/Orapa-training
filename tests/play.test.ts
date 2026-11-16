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
  it('propose crayon, ligne droite, gomme, vide et simulation, sans les anciennes marques', () => {
    const html = toolsHtml({ tool: null, ink: 'ink' });
    for (const tool of ['pencil', 'line', 'eraser', 'empty', 'simulate']) {
      expect(html).toContain(`data-tool="${tool}"`);
    }
    for (const gone of ['red', 'yellow', 'blue', 'white', 'maybe']) {
      expect(html).not.toContain(`data-tool="${gone}"`);
    }
    expect(html).not.toContain('>?<');
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

  it('annonce un laser : « Tirer en E ? », bulle verte à l’intérieur de la grille', () => {
    const html = playBoardSvg({ ...baseView, pending: { kind: 'fire', label: 'E' } });
    expect(html).toContain('class="shot-bubble from-left"');
    expect(html).toContain('>Tirer en E ?<');
    // Elle laisse passer le pointeur : le second clic tombe sur le repère.
    expect(html.indexOf('shot-bubble')).toBeGreaterThan(html.indexOf('data-fire="E"'));
  });

  it('annonce une sonde : « Tirer en E4 ? » au-dessus de la case, ou en dessous en haut de grille', () => {
    const middle = playBoardSvg({ ...baseView, pending: { kind: 'probe', cell: 'E4' } });
    expect(middle).toContain('>Tirer en E4 ?<');
    expect(middle).toContain('from-bottom');
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
    expect(fresh).toContain('class="pop"');
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
