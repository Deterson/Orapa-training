import { describe, expect, it } from 'vitest';
import { newHistory } from '../src/game/notes';
import { emptySolution } from '../src/game/solution';
import { EXTENSION_GEM_IDS, BASE_GEM_IDS } from '../src/game/gems';
import { footerHtml, isDrawingTool, toolsHtml } from '../src/ui/notesBoard';
import { playBoardSvg } from '../src/ui/playBoard';
import { trayHtml } from '../src/ui/solutionBoard';

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
