import { describe, expect, it } from 'vitest';
import { generateMine } from '../src/game/generate';
import { shoot } from '../src/game/laser';
import { GameSession } from '../src/game/session';
import { compareSolution } from '../src/game/verify';
import { resultBoardSvg, simulationRaySvg } from '../src/ui/resultBoard';

const mine = generateMine('resultat');
const session = new GameSession(mine);
session.fire('1');
session.probe('C3');
const diffs = compareSolution(mine.placements, mine.placements);
const base = {
  shots: session.shots,
  probes: session.probes,
  explored: null,
  simulated: null,
  selectedShot: null,
  selectedProbe: null,
};

describe('écran de résultat', () => {
  it('sans tir sélectionné : pas de tracé simulé', () => {
    expect(resultBoardSvg(diffs, base)).not.toContain('sim-ray');
  });

  it('un tir sélectionné est simulé : tracé de la proposition, sous les repères du bord', () => {
    const simulated = shoot(mine.placements, '1');
    const html = resultBoardSvg(diffs, { ...base, simulated, selectedShot: 1 });
    expect(html).toContain('class="sim-ray"');
    expect(html.indexOf('sim-ray')).toBeLessThan(html.indexOf('data-explore="1"'));
    // Le repère du tir sélectionné est surligné.
    expect(html).toMatch(/class="entry[^"]*is-selected[^"]*" data-explore="1"/);
  });

  it('le tracé provisoire du survol est marqué pour être retiré en sortant', () => {
    expect(simulationRaySvg(shoot(mine.placements, '1'), true)).toContain('sim-ray is-preview');
  });

  it('les sondes ont un contour caché, visible une fois sélectionnées', () => {
    const idle = resultBoardSvg(diffs, base);
    expect(idle).toContain('data-cell="C3"');
    expect(idle).not.toContain('probe-ring is-selected');
    const selected = resultBoardSvg(diffs, { ...base, selectedProbe: 'C3' });
    expect(selected).toContain('probe-ring is-selected');
  });

  it('plus de liste de texte en bas : le détail est dans l’historique', () => {
    expect(resultBoardSvg(diffs, base)).not.toContain('class="diff"');
  });
});
