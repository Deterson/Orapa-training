import { describe, expect, it } from 'vitest';
import { capacity, chooseFit, planHistory } from '../src/ui/historyLayout';

describe('disposition de l’historique', () => {
  it('capacité d’une colonne : au moins une carte', () => {
    // 600 px de haut, cartes de 40 px, 6 px d'écart : (600 + 6) / 46 = 13 cartes.
    expect(capacity(600, 40, 6)).toBe(13);
    expect(capacity(10, 40, 6)).toBe(1);
    expect(capacity(-50, 40, 6)).toBe(1);
    expect(capacity(600, 0, 6)).toBe(1);
  });

  it('une colonne tant que tout tient', () => {
    expect(planHistory(13, 13, 11, true).cols).toBe(1);
    expect(planHistory(0, 13, 11, true).cols).toBe(1);
  });

  it('deux colonnes dès qu’une ne suffit plus, la première remplie d’abord', () => {
    expect(planHistory(14, 13, 11, true)).toEqual({ cols: 2, rows: 11 });
    // La seconde colonne se remplit jusqu'à la capacité de deux colonnes (22 ici).
    expect(planHistory(22, 13, 11, true)).toEqual({ cols: 2, rows: 11 });
  });

  it('au-delà de deux colonnes pleines, elles se partagent la liste (qui défile)', () => {
    expect(planHistory(23, 13, 11, true)).toEqual({ cols: 2, rows: 12 });
    expect(planHistory(89, 13, 11, true)).toEqual({ cols: 2, rows: 45 });
  });

  it('deux colonnes impossibles : une colonne, qui défile', () => {
    expect(planHistory(89, 13, 11, false).cols).toBe(1);
  });

  it('la seconde colonne s’ouvre dans la marge à gauche quand elle y tient', () => {
    // Une colonne et son écart : 198 px. Avec le bord de sécurité de 8 px, il faut 206 px de marge.
    expect(chooseFit(212, 198, true)).toBe('margin');
    expect(chooseFit(206, 198, false)).toBe('margin');
    expect(chooseFit(205, 198, false)).toBeNull();
  });

  it('sans assez de marge : on élargit la page sur grand écran seulement', () => {
    expect(chooseFit(60, 198, true)).toBe('shift');
    expect(chooseFit(60, 198, false)).toBeNull();
  });
});
