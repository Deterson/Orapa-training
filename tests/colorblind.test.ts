import { afterEach, describe, expect, it } from 'vitest';
import { COLORBLIND_KEY, readColorblind, saveColorblind } from '../src/ui/colorblind';
import { chips } from '../src/ui/historyCards';
import { headerHtml } from '../src/ui/header';
import {
  GEM_FILL,
  GEM_PATTERN,
  RAY_COLOR,
  gemPolygons,
  isColorblind,
  setColorblind,
} from '../src/ui/palette';
import { GEM_SHAPES, orientedPolygon } from '../src/game/gems';

const memory = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
};

afterEach(() => setColorblind(false));

describe('mode daltonien', () => {
  const polygon = orientedPolygon(GEM_SHAPES['red-parallelogram'], { rotation: 0, flipped: false });

  it('change la palette sans toucher aux règles, et revient à la normale', () => {
    const normal = { ...GEM_FILL };
    const normalRay = { ...RAY_COLOR };
    setColorblind(true);
    expect(isColorblind()).toBe(true);
    expect(GEM_FILL.red).not.toBe(normal.red);
    expect(RAY_COLOR.violet).not.toBe(normalRay.violet);
    // Rouge, jaune et bleu restent distincts les uns des autres.
    expect(new Set([GEM_FILL.red, GEM_FILL.yellow, GEM_FILL.blue]).size).toBe(3);
    setColorblind(false);
    expect(GEM_FILL).toEqual(normal);
    expect(RAY_COLOR).toEqual(normalRay);
  });

  it('ajoute un motif par gemme colorée, pas à la blanche ni au Diamant', () => {
    expect(gemPolygons(polygon, 'red')).not.toContain('gem-pattern');
    setColorblind(true);
    expect(gemPolygons(polygon, 'red')).toContain(`url(#${GEM_PATTERN.red})`);
    expect(gemPolygons(polygon, 'yellow')).toContain(`url(#${GEM_PATTERN.yellow})`);
    expect(gemPolygons(polygon, 'blue')).toContain(`url(#${GEM_PATTERN.blue})`);
    expect(gemPolygons(polygon, 'white')).not.toContain('gem-pattern');
    expect(gemPolygons(polygon, 'clear')).not.toContain('gem-pattern');
    // Trois motifs différents : on ne distingue pas les gemmes par la teinte seule.
    expect(new Set(Object.values(GEM_PATTERN)).size).toBe(3);
  });

  it('les pastilles de l’historique portent leur lettre', () => {
    expect(chips('violet')).toContain('data-letter="R"');
    expect(chips('violet')).toContain('data-letter="B"');
    expect(chips('light-violet')).toContain('data-letter="Bl"');
  });

  it('se mémorise comme le thème, et se passe du stockage', () => {
    const storage = memory();
    expect(readColorblind(storage)).toBe(false);
    expect(saveColorblind(storage, true)).toBe(true);
    expect(storage.data.get(COLORBLIND_KEY)).toBe('1');
    expect(readColorblind(storage)).toBe(true);
    saveColorblind(storage, false);
    expect(readColorblind(storage)).toBe(false);
    expect(saveColorblind(null, true)).toBe(false);
    expect(readColorblind(null)).toBe(false);
    const broken = {
      getItem: () => {
        throw new Error('bloqué');
      },
      setItem: () => {
        throw new Error('bloqué');
      },
    };
    expect(readColorblind(broken)).toBe(false);
    expect(saveColorblind(broken, true)).toBe(false);
  });

  it('la barre du haut a son bouton, enfoncé quand le mode est actif', () => {
    const model = {
      version: '3.0.0',
      view: 'home' as const,
      newGameBlocked: false,
      accountReady: false,
      user: null,
      theme: 'light' as const,
    };
    expect(headerHtml(model)).toContain('data-action="toggle-colorblind" aria-pressed="false"');
    expect(headerHtml({ ...model, colorblind: true })).toContain('aria-pressed="true"');
  });
});
