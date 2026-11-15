import { describe, expect, it, vi } from 'vitest';
import { GamesError } from '../src/backend/games';
import { changeKey, createProgressSync } from '../src/backend/sync';
import { generateMine } from '../src/game/generate';
import { emptyNotes } from '../src/game/notes';
import { type ProgressRecord, buildProgress } from '../src/game/record';
import { SAVE_VERSION } from '../src/game/save';
import { GameSession } from '../src/game/session';
import { emptySolution } from '../src/game/solution';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';

/** Une partie avec `shots` tirs et `elapsed` ms de jeu. */
function progress(id: string, shots: string[], elapsed = 1000): ProgressRecord {
  let clock = 0;
  const session = new GameSession(generateMine('sync'), { now: () => clock });
  for (const shot of shots) session.fire(shot);
  clock += elapsed;
  return buildProgress({
    id,
    save: {
      version: SAVE_VERSION,
      savedAt: 1_700_000_000_000 + elapsed,
      session: session.toSnapshot(),
      solution: emptySolution(),
      notes: emptyNotes(),
      skipConfirm: false,
    },
    startedAt: 1_690_000_000_000,
  });
}

/** Minuterie à la main : `tick(ms)` déclenche ce qui est programmé. */
function manualTimers() {
  const timers: { at: number; callback: () => void; id: number }[] = [];
  let now = 0;
  let nextId = 1;
  return {
    setTimer: (callback: () => void, ms: number) => {
      const id = nextId++;
      timers.push({ at: now + ms, callback, id });
      return id;
    },
    clearTimer: (handle: unknown) => {
      const index = timers.findIndex((timer) => timer.id === handle);
      if (index >= 0) timers.splice(index, 1);
    },
    count: () => timers.length,
    async tick(ms: number) {
      now += ms;
      for (const timer of timers.filter((candidate) => candidate.at <= now)) {
        timers.splice(timers.indexOf(timer), 1);
        timer.callback();
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
  };
}

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('synchronisation des parties en cours', () => {
  it('envoie tout de suite la première version, puis au plus une fois par délai', async () => {
    const timers = manualTimers();
    const saved: string[][] = [];
    const sync = createProgressSync(
      { saveProgress: (p) => (saved.push(p.shots), Promise.resolve()) },
      { delayMs: 8000, ...timers },
    );
    sync.push(progress(A, ['1']));
    await flushPromises();
    expect(saved).toEqual([['1']]);

    // Plusieurs changements rapprochés : une seule requête, avec la dernière version.
    sync.push(progress(A, ['1', '2']));
    sync.push(progress(A, ['1', '2', '3']));
    await timers.tick(7000);
    expect(saved).toHaveLength(1);
    await timers.tick(1500);
    expect(saved).toEqual([['1'], ['1', '2', '3']]);
    expect(sync.pending()).toEqual([]);
  });

  it("n'envoie rien quand seul le temps a avancé", async () => {
    const timers = manualTimers();
    const saveProgress = vi.fn(() => Promise.resolve());
    const sync = createProgressSync({ saveProgress }, { delayMs: 8000, ...timers });
    sync.push(progress(A, ['1'], 1000));
    await flushPromises();
    sync.push(progress(A, ['1'], 60_000));
    await timers.tick(9000);
    expect(saveProgress).toHaveBeenCalledTimes(1);
    expect(sync.pending()).toEqual([]);
    expect(changeKey(progress(A, ['1'], 1000))).toBe(changeKey(progress(A, ['1'], 60_000)));
    expect(changeKey(progress(A, ['1'], 1000))).not.toBe(changeKey(progress(A, ['1', '2'], 1000)));
  });

  it("garde l'envoi en attente en cas de coupure et réessaie avec des délais croissants", async () => {
    const timers = manualTimers();
    let online = false;
    const saveProgress = vi.fn(() =>
      online ? Promise.resolve() : Promise.reject(new GamesError('Failed to fetch', false)),
    );
    const sync = createProgressSync(
      { saveProgress },
      { delayMs: 8000, maxRetryMs: 20_000, ...timers },
    );
    sync.push(progress(A, ['1']));
    await flushPromises();
    expect(sync.pending()).toEqual([A]);
    await timers.tick(8000);
    expect(saveProgress).toHaveBeenCalledTimes(2);
    await timers.tick(10_000); // le délai a doublé : pas encore
    expect(saveProgress).toHaveBeenCalledTimes(2);
    online = true;
    await timers.tick(10_000);
    expect(saveProgress).toHaveBeenCalledTimes(3);
    expect(sync.pending()).toEqual([]);
  });

  it('abandonne une partie refusée définitivement et prévient, sans bloquer les autres', async () => {
    const timers = manualTimers();
    const rejected: string[] = [];
    const saved: string[] = [];
    const sync = createProgressSync(
      {
        saveProgress: (p) =>
          p.id === A
            ? Promise.reject(new GamesError('Trop', true))
            : (saved.push(p.id), Promise.resolve()),
      },
      { ...timers, onRejected: (id) => rejected.push(id) },
    );
    sync.push(progress(A, ['1']));
    sync.push(progress(B, ['1']));
    await sync.flush();
    await flushPromises();
    expect(rejected).toEqual([A]);
    expect(saved).toEqual([B]);
    expect(sync.pending()).toEqual([]);
  });

  it('« flush » envoie tout de suite ce qui attend', async () => {
    const timers = manualTimers();
    const saved: string[][] = [];
    const sync = createProgressSync(
      { saveProgress: (p) => (saved.push(p.shots), Promise.resolve()) },
      timers,
    );
    sync.push(progress(A, ['1']));
    await flushPromises();
    sync.push(progress(A, ['1', '2']));
    expect(sync.pending()).toEqual([A]);
    await sync.flush();
    expect(saved).toEqual([['1'], ['1', '2']]);
    expect(sync.pending()).toEqual([]);
    // Rien à envoyer : résolu aussitôt, sans requête.
    await sync.flush();
    expect(saved).toHaveLength(2);
  });

  it("n'envoie jamais deux requêtes en même temps", async () => {
    const timers = manualTimers();
    let inFlight = 0;
    let max = 0;
    const releases: (() => void)[] = [];
    const sync = createProgressSync(
      {
        saveProgress: () => {
          inFlight++;
          max = Math.max(max, inFlight);
          return new Promise<void>((resolve) =>
            releases.push(() => {
              inFlight--;
              resolve();
            }),
          );
        },
      },
      timers,
    );
    sync.push(progress(A, ['1']));
    const first = sync.flush();
    const second = sync.flush();
    sync.push(progress(A, ['1', '2']));
    releases.shift()?.();
    await flushPromises();
    releases.shift()?.();
    await Promise.all([first, second]);
    expect(max).toBe(1);
  });

  it("une version arrivée pendant l'envoi n'est pas perdue", async () => {
    const timers = manualTimers();
    const saved: string[][] = [];
    let release: () => void = () => undefined;
    const sync = createProgressSync(
      {
        saveProgress: (p) =>
          new Promise<void>((resolve) => {
            saved.push(p.shots);
            release = resolve;
          }),
      },
      { delayMs: 8000, ...timers },
    );
    sync.push(progress(A, ['1']));
    await flushPromises();
    sync.push(progress(A, ['1', '2'])); // pendant l'envoi de la première
    release();
    await flushPromises();
    expect(sync.pending()).toEqual([A]);
    await timers.tick(8500);
    release();
    await flushPromises();
    expect(saved).toEqual([['1'], ['1', '2']]);
    expect(sync.pending()).toEqual([]);
  });

  it('« forget » et « reset » oublient les parties (terminées, ou compte changé)', async () => {
    const timers = manualTimers();
    const saveProgress = vi.fn(() => Promise.resolve());
    const sync = createProgressSync({ saveProgress }, timers);
    sync.push(progress(A, ['1']));
    await flushPromises();
    sync.push(progress(A, ['1', '2']));
    sync.forget(A);
    expect(sync.pending()).toEqual([]);
    await timers.tick(60_000);
    expect(saveProgress).toHaveBeenCalledTimes(1);

    sync.push(progress(B, ['1']));
    sync.reset();
    expect(sync.pending()).toEqual([]);
    expect(timers.count()).toBe(0);
  });
});
