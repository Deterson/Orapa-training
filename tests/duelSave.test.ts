import { describe, expect, it } from 'vitest';
import { Duel } from '../src/game/duel';
import { DUEL_SAVE_VERSION, type DuelSaveData, parseDuelSave } from '../src/game/duelSave';
import { generateMine } from '../src/game/generate';
import { emptyNotes } from '../src/game/notes';
import { emptySolution } from '../src/game/solution';
import { DUEL_SAVE_KEY, SAVE_KEY, createDuelStore } from '../src/ui/storage';

function sampleSave(): DuelSaveData {
  const duel = Duel.start({
    seed: 'sauvegarde',
    level: 'intermediate',
    first: 'player',
    playerBoard: generateMine('sv-joueur').placements,
  });
  duel.ask('player', { kind: 'fire', label: 'A' });
  duel.ask('ai', { kind: 'probe', label: 'C4' });
  return {
    version: DUEL_SAVE_VERSION,
    savedAt: 1_700_000_000_000,
    duel: duel.toSnapshot(),
    solution: emptySolution(duel.gems),
    notes: emptyNotes(),
  };
}

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe('sauvegarde du duel', () => {
  it('survit à un aller-retour par le JSON et reprend le même duel', () => {
    const save = sampleSave();
    const parsed = parseDuelSave(JSON.parse(JSON.stringify(save)));
    expect(parsed).not.toBeNull();
    const duel = Duel.fromSnapshot(parsed?.duel ?? save.duel);
    expect(duel.turn).toBe('player');
    expect(duel.playerSession.shots.map((shot) => shot.entry)).toEqual(['A']);
    expect(duel.aiQuestions.probes.map((probe) => probe.cell)).toEqual(['C4']);
    expect(duel.level).toBe('intermediate');
  });

  it('refuse une sauvegarde illisible, ancienne ou modifiée', () => {
    const save = sampleSave();
    expect(parseDuelSave(null)).toBeNull();
    expect(parseDuelSave({})).toBeNull();
    expect(parseDuelSave({ ...save, version: 99 })).toBeNull();
    expect(parseDuelSave({ ...save, duel: { ...save.duel, level: 'dieu' } })).toBeNull();
    expect(parseDuelSave({ ...save, duel: { ...save.duel, turn: 'moi' } })).toBeNull();
    expect(parseDuelSave({ ...save, notes: 12 })).toBeNull();
    // Un plateau modifié à la main qui enfreint les règles.
    const first = save.duel.ai.mine.placements[0];
    const second = save.duel.ai.mine.placements[1];
    if (!first || !second) throw new Error('mine incomplète');
    const broken = structuredClone(save);
    broken.duel.ai.mine.placements[1] = { ...second, col: first.col, row: first.row };
    expect(parseDuelSave(broken)).toBeNull();
  });

  it('garde la proposition de chaque camp', () => {
    const save = sampleSave();
    const board = save.duel.player.mine.placements;
    const duel = Duel.fromSnapshot(save.duel);
    duel.propose('player', board);
    const parsed = parseDuelSave(JSON.parse(JSON.stringify({ ...save, duel: duel.toSnapshot() })));
    expect(parsed?.duel.guesses.player).toHaveLength(5);
    expect(parsed?.duel.guesses.ai).toBeNull();
  });

  it('le stockage du duel est séparé de celui de la partie d’entraînement', () => {
    const storage = memoryStorage();
    const store = createDuelStore(storage);
    expect(store.available).toBe(true);
    expect(store.save(sampleSave())).toBe(true);
    expect(storage.getItem(DUEL_SAVE_KEY)).not.toBeNull();
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    expect(store.load()?.duel.seed).toBe('sauvegarde');
    store.clear();
    expect(store.load()).toBeNull();
  });

  it('supprime une sauvegarde corrompue au lieu de la reproposer', () => {
    const storage = memoryStorage();
    storage.setItem(DUEL_SAVE_KEY, '{pas du json');
    expect(createDuelStore(storage).load()).toBeNull();
    expect(storage.getItem(DUEL_SAVE_KEY)).toBeNull();
  });

  it('sans stockage, le jeu continue', () => {
    const store = createDuelStore(null);
    expect(store.available).toBe(false);
    expect(store.save(sampleSave())).toBe(false);
    expect(store.load()).toBeNull();
  });
});
