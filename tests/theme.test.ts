import { describe, expect, it } from 'vitest';
import { THEME_KEY, nextTheme, parseTheme, readTheme, saveTheme } from '../src/ui/theme';

const memory = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
};

describe('thème jour / nuit', () => {
  it('ne reconnaît que « light » et « dark »', () => {
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('dark')).toBe('dark');
    for (const bad of ['', 'Dark', 'auto', null, undefined, 3]) expect(parseTheme(bad)).toBeNull();
  });

  it('bascule de l’un à l’autre', () => {
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('light');
  });

  it('mémorise le choix et le relit', () => {
    const storage = memory();
    expect(readTheme(storage)).toBeNull();
    expect(saveTheme(storage, 'dark')).toBe(true);
    expect(storage.data.get(THEME_KEY)).toBe('dark');
    expect(readTheme(storage)).toBe('dark');
  });

  it('ignore une valeur modifiée à la main', () => {
    expect(readTheme(memory({ [THEME_KEY]: 'sepia' }))).toBeNull();
  });

  it('fonctionne sans stockage, ou avec un stockage qui lève une exception', () => {
    const broken = {
      getItem: () => {
        throw new Error('bloqué');
      },
      setItem: () => {
        throw new Error('plein');
      },
    };
    expect(readTheme(null)).toBeNull();
    expect(saveTheme(null, 'dark')).toBe(false);
    expect(readTheme(broken)).toBeNull();
    expect(saveTheme(broken, 'dark')).toBe(false);
  });
});
