import { describe, expect, it } from 'vitest';
import { generateMine } from '../src/game/generate';
import { type SaveData, SAVE_VERSION, parseSave } from '../src/game/save';
import { GameSession } from '../src/game/session';
import { dropGem, emptySolution, rotateGem } from '../src/game/solution';
import { addStroke, emptyNotes, toggleMark } from '../src/game/notes';
import { SAVE_KEY, createSaveStore } from '../src/ui/storage';

const mine = generateMine('sauvegarde');

function sampleSave(): SaveData {
  const session = new GameSession(mine);
  session.fire('1');
  session.fire('15');
  session.probe('E4');
  let solution = dropGem(emptySolution(), 'blue-triangle', 2, 2);
  solution = rotateGem(solution, 'blue-triangle');
  let notes = toggleMark(toggleMark(emptyNotes(), 'B3', 'red'), 'C4', 'grey');
  notes = addStroke(notes, {
    ink: 'blue',
    points: [
      [1, 1],
      [2, 2.5],
    ],
  });
  return {
    version: SAVE_VERSION,
    savedAt: 1700000000000,
    session: session.toSnapshot(),
    solution,
    notes,
  };
}

/** La sauvegarde telle qu'elle ressort du navigateur : texte JSON puis décodage. */
const roundTrip = (data: unknown): unknown => JSON.parse(JSON.stringify(data));

describe('instantané de partie', () => {
  it('reprend une partie avec ses tirs et ses sondes', () => {
    const original = new GameSession(mine);
    original.fire('1');
    original.fire('I');
    original.probe('E4');
    const restored = GameSession.fromSnapshot(original.toSnapshot() as never);
    expect(restored.shots).toEqual(original.shots);
    expect(restored.probes).toEqual(original.probes);
    expect(restored.laserCount).toBe(2);
    expect(restored.seed).toBe(original.seed);
  });

  it('peut continuer à jouer après la reprise', () => {
    const original = new GameSession(mine);
    original.fire('1');
    const restored = GameSession.fromSnapshot(original.toSnapshot());
    expect(restored.fire('1')).toEqual(original.shots[0]);
    expect(restored.fire('I').n).toBe(2);
    expect(restored.submit(mine.placements).correct).toBe(true);
  });

  it('reprend le temps écoulé sans compter le temps passé hors de la page', () => {
    let time = 0;
    const original = new GameSession(mine, { now: () => time });
    time = 7000;
    const snapshot = original.toSnapshot();
    expect(snapshot.elapsedMs).toBe(7000);
    // La page est fermée pendant une heure, puis rouverte.
    time = 7000 + 3_600_000;
    const restored = GameSession.fromSnapshot(snapshot, { now: () => time });
    expect(restored.elapsedMs()).toBe(7000);
    time += 2000;
    expect(restored.elapsedMs()).toBe(9000);
  });

  it('reprend aussi une partie terminée, sans pouvoir la rejouer', () => {
    const original = new GameSession(mine);
    original.fire('1');
    original.abandon();
    const restored = GameSession.fromSnapshot(original.toSnapshot());
    expect(restored.status).toBe('abandoned');
    expect(() => restored.fire('I')).toThrow();
    expect(restored.reveal()).toEqual(mine.placements);
  });
});

describe("validation d'une sauvegarde", () => {
  it('accepte une sauvegarde complète après un aller-retour JSON', () => {
    const data = sampleSave();
    const parsed = parseSave(roundTrip(data));
    expect(parsed).toEqual(data);
  });

  it("refuse tout ce qui n'est pas une sauvegarde", () => {
    for (const bad of [null, undefined, 42, 'texte', [], {}, { version: SAVE_VERSION }]) {
      expect(parseSave(bad)).toBeNull();
    }
  });

  it('refuse une autre version du format', () => {
    expect(parseSave({ ...(roundTrip(sampleSave()) as object), version: 0 })).toBeNull();
    expect(parseSave({ ...(roundTrip(sampleSave()) as object), version: 999 })).toBeNull();
  });

  it('refuse une mine modifiée : gemme inconnue, chevauchement, gemme manquante', () => {
    const base = roundTrip(sampleSave()) as {
      session: { mine: { placements: Record<string, unknown>[] } };
    };
    const mutate = (change: (placements: Record<string, unknown>[]) => void): unknown => {
      const copy = roundTrip(base) as typeof base;
      change(copy.session.mine.placements);
      return copy;
    };
    expect(
      parseSave(
        mutate((p) => {
          p[0]!['gem'] = 'diamant';
        }),
      ),
    ).toBeNull();
    expect(
      parseSave(
        mutate((p) => {
          p.pop();
        }),
      ),
    ).toBeNull();
    expect(
      parseSave(
        mutate((p) => {
          p[1]!['col'] = p[0]!['col'];
          p[1]!['row'] = p[0]!['row'];
        }),
      ),
    ).toBeNull();
    expect(
      parseSave(
        mutate((p) => {
          p[0]!['col'] = 1.5;
        }),
      ),
    ).toBeNull();
  });

  it('refuse des tirs, sondes ou temps invalides', () => {
    const base = roundTrip(sampleSave()) as { session: Record<string, unknown> };
    const bad = (key: string, value: unknown): unknown => {
      const copy = roundTrip(base) as typeof base;
      copy.session[key] = value;
      return copy;
    };
    expect(parseSave(bad('shots', ['Z']))).toBeNull();
    expect(parseSave(bad('shots', ['1', '1']))).toBeNull();
    expect(parseSave(bad('probes', ['K1']))).toBeNull();
    expect(parseSave(bad('elapsedMs', -5))).toBeNull();
    expect(parseSave(bad('elapsedMs', 'long'))).toBeNull();
    expect(parseSave(bad('status', 'gagné'))).toBeNull();
    expect(parseSave(bad('attempts', 7))).toBeNull();
  });

  it('refuse une solution ou des notes invalides', () => {
    const base = roundTrip(sampleSave()) as {
      solution: Record<string, unknown>;
      notes: Record<string, unknown>;
    };
    const withSolution = roundTrip(base) as typeof base;
    withSolution.solution['yellow-triangle'] = {
      gem: 'blue-triangle',
      orientation: { rotation: 0, flipped: false },
      col: 0,
      row: 0,
    };
    expect(parseSave(withSolution)).toBeNull();
    const withMark = roundTrip(base) as typeof base;
    (withMark.notes['marks'] as Record<string, string>)['Z9'] = 'red';
    expect(parseSave(withMark)).toBeNull();
    const withInk = roundTrip(base) as typeof base;
    (withInk.notes['strokes'] as { ink: string }[])[0]!.ink = 'rose';
    expect(parseSave(withInk)).toBeNull();
  });
});

/** Faux localStorage en mémoire. */
function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

describe('stockage local', () => {
  it('enregistre, relit puis efface la sauvegarde', () => {
    const store = createSaveStore(memoryStorage());
    expect(store.available).toBe(true);
    expect(store.load()).toBeNull();
    const data = sampleSave();
    expect(store.save(data)).toBe(true);
    expect(store.load()).toEqual(data);
    store.clear();
    expect(store.load()).toBeNull();
  });

  it('supprime une sauvegarde illisible au lieu de la reproposer', () => {
    const backend = memoryStorage();
    backend.setItem(SAVE_KEY, '{pas du json');
    const store = createSaveStore(backend);
    expect(store.load()).toBeNull();
    expect(backend.getItem(SAVE_KEY)).toBeNull();
    backend.setItem(SAVE_KEY, JSON.stringify({ version: 1 }));
    expect(store.load()).toBeNull();
    expect(backend.getItem(SAVE_KEY)).toBeNull();
  });

  it('fonctionne sans stockage : rien ne plante', () => {
    for (const store of [createSaveStore(null)]) {
      expect(store.available).toBe(false);
      expect(store.load()).toBeNull();
      expect(store.save(sampleSave())).toBe(false);
      expect(() => store.clear()).not.toThrow();
    }
  });

  it("fonctionne quand le navigateur refuse d'écrire (quota, navigation privée)", () => {
    const refusing: Storage = {
      ...memoryStorage(),
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const store = createSaveStore(refusing);
    expect(store.available).toBe(false);
    expect(store.save(sampleSave())).toBe(false);
    expect(store.load()).toBeNull();
  });

  it('fonctionne quand même la lecture lève une exception', () => {
    const broken: Storage = {
      ...memoryStorage(),
      getItem: () => {
        throw new Error('SecurityError');
      },
    };
    const store = createSaveStore(broken);
    expect(store.load()).toBeNull();
  });
});
