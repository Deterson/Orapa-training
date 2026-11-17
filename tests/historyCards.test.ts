import { describe, expect, it } from 'vitest';
import type { ProbeRecord, ShotRecord } from '../src/game/session';
import { probeCardHtml, probeResultHtml, shotCardHtml } from '../src/ui/historyCards';

const idle = { selected: false, fresh: false };
const probe = (cell: string, content: ProbeRecord['content'], n = 5): ProbeRecord => ({
  n,
  cell,
  content,
});

describe('cartes de l’historique', () => {
  it('une sonde s’affiche comme « 5   B6   =   résultat », dans une carte comme les tirs', () => {
    const html = probeCardHtml(probe('B6', 'red'), idle);
    expect(html).toContain('class="shot is-probe"');
    expect(html).toContain('<span class="n">5</span>');
    expect(html).toContain('<b>B6</b> =');
    expect(html).toContain('class="chip"');
    // Même gabarit qu'un tir au laser : un bouton « shot », un numéro, un trajet.
    const shot = { n: 1, entry: 'E', exit: 'K', color: 'blue' } as ShotRecord;
    expect(shotCardHtml(shot, idle, 'E → K')).toContain('class="shot"');
  });

  it('« B6 = rien » : le mot, sans pastille', () => {
    const html = probeCardHtml(probe('B6', 'nothing'), idle);
    expect(html).toContain('= <span class="res">rien</span>');
    expect(html).not.toContain('class="chip"');
  });

  it('une gemme de couleur : une pastille de cette couleur', () => {
    for (const color of ['red', 'yellow', 'blue', 'white'] as const) {
      expect(probeResultHtml(color)).toContain('class="chip"');
    }
  });

  it('signal perdu : le pictogramme du signal perdu', () => {
    const html = probeResultHtml('black');
    expect(html).toContain('lost-signal-icon');
    expect(html).not.toContain('class="chip"');
  });

  it('diamant : le demi-losange en miniature', () => {
    const html = probeResultHtml('clear');
    expect(html).toContain('class="gem-mini"');
    expect(html).toContain('gem-edge-clear');
    expect(html).toContain('<polygon');
  });

  it('la sélection et le dernier tir se marquent, avec l’état pour les lecteurs d’écran', () => {
    const selected = probeCardHtml(probe('B6', 'nothing'), { selected: true, fresh: true });
    expect(selected).toContain('is-selected');
    expect(selected).toContain('aria-pressed="true"');
    expect(selected).toContain('<li class="is-new">');
    expect(probeCardHtml(probe('B6', 'nothing'), idle)).toContain('aria-pressed="false"');
  });

  it('chaque carte porte de quoi la retrouver et la sélectionner', () => {
    expect(probeCardHtml(probe('B6', 'nothing'), idle)).toContain('data-probe-card="B6"');
    const shot = { n: 3, entry: '2', exit: 'C', color: 'blue' } as ShotRecord;
    expect(shotCardHtml(shot, idle, 'x')).toContain('data-shot="3"');
  });
});
