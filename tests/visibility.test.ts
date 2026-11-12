import { describe, expect, it } from 'vitest';
import { BOOKLET_LAYOUT } from '../src/game/examples';
import type { Placement } from '../src/game/gems';
import {
  hiddenGemIndices,
  isVisible,
  visibilityViolations,
  visibleGemIndices,
} from '../src/game/visibility';
import { shootAll } from '../src/game/laser';
import { place, randomValidLayout, seededRandom } from './helpers';

/**
 * Losange blanc au centre, entouré de quatre gemmes qui bouchent chacune de ses deux colonnes
 * ou deux lignes d'approche, des deux côtés. Aucun rayon droit ne peut l'atteindre.
 */
function encircled(): { layout: Placement[]; hidden: number } {
  const layout: Placement[] = [
    place('white-rhombus', [
      [5, 3],
      [6, 4],
      [5, 5],
      [4, 4],
    ]), // 0 : la cible, lignes D–E, colonnes 5–6
    place('blue-triangle', [
      [1, 2],
      [1, 6],
      [3, 4],
    ]), // 1 : à gauche, base verticale contre l'extérieur
    place('white-triangle', [
      [9, 2],
      [9, 6],
      [7, 4],
    ]), // 2 : à droite
    place('red-parallelogram', [
      [5, 0],
      [7, 0],
      [6, 1],
      [4, 1],
    ]), // 3 : en haut
    place('yellow-triangle', [
      [4, 6],
      [4, 8],
      [6, 8],
    ]), // 4 : en bas
  ];
  return { layout, hidden: 0 };
}

describe('règle e : visibilité', () => {
  it('voit les cinq gemmes de la disposition du livret', () => {
    expect(visibleGemIndices(BOOKLET_LAYOUT).size).toBe(5);
    expect(hiddenGemIndices(BOOKLET_LAYOUT)).toEqual([]);
    expect(isVisible(BOOKLET_LAYOUT)).toBe(true);
    expect(visibilityViolations(BOOKLET_LAYOUT)).toEqual([]);
  });

  it('une grille vide et une gemme seule sont visibles', () => {
    expect(isVisible([])).toBe(true);
    const lone = place('white-rhombus', [
      [5, 3],
      [6, 4],
      [5, 5],
      [4, 4],
    ]);
    expect(isVisible([lone])).toBe(true);
  });

  it('refuse une gemme encerclée', () => {
    const { layout, hidden } = encircled();
    expect(hiddenGemIndices(layout)).toEqual([hidden]);
    expect(isVisible(layout)).toBe(false);
  });

  it('décrit la violation en français, avec la règle e', () => {
    const { layout } = encircled();
    const violations = visibilityViolations(layout);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ rule: 'e', gems: [0] });
    expect(violations[0]?.message).toContain('Losange blanc');
    expect(violations[0]?.message).toContain('règle e');
  });

  it('les quatre bouchons restent visibles', () => {
    const { layout } = encircled();
    expect([...visibleGemIndices(layout)].sort()).toEqual([1, 2, 3, 4]);
  });

  it('retirer un seul bouchon rend la cible visible', () => {
    const { layout } = encircled();
    for (const removed of [1, 2, 3, 4]) {
      const partial = layout.filter((_, index) => index !== removed);
      expect(isVisible(partial), `sans la gemme ${removed}`).toBe(true);
    }
  });

  it('ne compte pas une gemme atteinte seulement après un rebond', () => {
    // Un rayon peut toucher la cible après avoir rebondi sur un bouchon : cela ne la rend pas
    // visible, il faut une ligne droite depuis le bord.
    const { layout, hidden } = encircled();
    const reachedAfterBounce = shootAll(layout).some((shot) =>
      shot.hits.some((hit, order) => hit.gem === hidden && order > 0),
    );
    expect(reachedAfterBounce).toBe(true);
    expect(hiddenGemIndices(layout)).toEqual([hidden]);
  });

  it('accepte ou refuse chaque disposition aléatoire sans erreur', () => {
    const random = seededRandom(99);
    let visible = 0;
    let hidden = 0;
    for (let i = 0; i < 300; i++) {
      const layout = randomValidLayout(random);
      if (layout === null) continue;
      if (isVisible(layout)) visible++;
      else hidden++;
      // Cohérence : les gemmes visibles et cachées se partagent exactement la liste.
      const seen = visibleGemIndices(layout).size;
      expect(seen + hiddenGemIndices(layout).length).toBe(layout.length);
    }
    // La plupart des dispositions au hasard sont visibles ; quelques-unes ne le sont pas.
    expect(visible).toBeGreaterThan(hidden);
  });
});
