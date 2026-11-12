import { describe, expect, it } from 'vitest';
import {
  MAX_UNDO,
  addStroke,
  cellAt,
  commit,
  emptyNotes,
  eraseAt,
  isEmpty,
  newHistory,
  redo,
  strokeNear,
  toggleMark,
  undo,
} from '../src/game/notes';

describe('notes : marques de cases', () => {
  it('pose une marque sur une case', () => {
    const notes = toggleMark(emptyNotes(), 'E4', 'red');
    expect(notes.marks).toEqual({ E4: 'red' });
  });

  it("remplace la marque d'une case", () => {
    const notes = toggleMark(toggleMark(emptyNotes(), 'E4', 'red'), 'E4', 'empty');
    expect(notes.marks).toEqual({ E4: 'empty' });
  });

  it('enlève la marque quand on la pose deux fois', () => {
    const once = toggleMark(emptyNotes(), 'E4', 'maybe');
    const twice = toggleMark(once, 'E4', 'maybe');
    expect(twice.marks).toEqual({});
    expect(isEmpty(twice)).toBe(true);
  });

  it("ne modifie pas l'état précédent", () => {
    const before = emptyNotes();
    toggleMark(before, 'A1', 'blue');
    expect(before.marks).toEqual({});
  });
});

describe('notes : cases sous un point', () => {
  it('donne le libellé de la case', () => {
    expect(cellAt([3.5, 4.2])).toBe('E4');
    expect(cellAt([0, 0])).toBe('A1');
    expect(cellAt([9.99, 7.99])).toBe('H10');
  });

  it('renvoie null hors de la grille', () => {
    expect(cellAt([-0.1, 2])).toBeNull();
    expect(cellAt([10, 2])).toBeNull();
    expect(cellAt([2, 8])).toBeNull();
  });
});

describe('notes : traits et gomme', () => {
  const stroke = {
    ink: 'red' as const,
    points: [
      [1, 1],
      [3, 1],
    ] as const,
  };

  it('ajoute un trait', () => {
    expect(addStroke(emptyNotes(), stroke).strokes).toHaveLength(1);
  });

  it('ignore un trait sans point', () => {
    const notes = emptyNotes();
    expect(addStroke(notes, { ink: 'ink', points: [] })).toBe(notes);
  });

  it("détecte un trait proche d'un point", () => {
    expect(strokeNear(stroke, [2, 1.2], 0.3)).toBe(true);
    expect(strokeNear(stroke, [2, 2], 0.3)).toBe(false);
    expect(strokeNear({ ink: 'ink', points: [[5, 5]] }, [5.1, 5], 0.3)).toBe(true);
  });

  it('efface le trait touché et la marque de la case', () => {
    let notes = addStroke(emptyNotes(), stroke);
    notes = toggleMark(notes, 'B3', 'white');
    const erased = eraseAt(notes, [2.5, 1.5], 0.3);
    expect(erased.marks).toEqual({});
    expect(erased.strokes).toHaveLength(1);
    const erasedStroke = eraseAt(notes, [2, 0.9], 0.3);
    expect(erasedStroke.strokes).toHaveLength(0);
    expect(erasedStroke.marks).toEqual({ B3: 'white' });
  });

  it("ne change rien quand il n'y a rien à effacer", () => {
    const notes = addStroke(emptyNotes(), stroke);
    expect(eraseAt(notes, [8, 6])).toBe(notes);
  });
});

describe('notes : annuler et rétablir', () => {
  it('annule puis rétablit', () => {
    let history = newHistory();
    history = commit(history, toggleMark(history.present, 'A1', 'red'));
    history = commit(history, toggleMark(history.present, 'A2', 'blue'));
    expect(Object.keys(history.present.marks)).toEqual(['A1', 'A2']);
    history = undo(history);
    expect(Object.keys(history.present.marks)).toEqual(['A1']);
    history = undo(history);
    expect(isEmpty(history.present)).toBe(true);
    history = redo(history);
    expect(Object.keys(history.present.marks)).toEqual(['A1']);
    history = redo(history);
    expect(Object.keys(history.present.marks)).toEqual(['A1', 'A2']);
  });

  it("ne fait rien quand il n'y a plus rien à annuler ou à rétablir", () => {
    const history = newHistory();
    expect(undo(history)).toBe(history);
    expect(redo(history)).toBe(history);
  });

  it('une nouvelle modification vide la pile « rétablir »', () => {
    let history = newHistory();
    history = commit(history, toggleMark(history.present, 'A1', 'red'));
    history = undo(history);
    history = commit(history, toggleMark(history.present, 'C3', 'maybe'));
    expect(history.future).toEqual([]);
    expect(redo(history)).toBe(history);
  });

  it('ne garde pas une modification sans effet', () => {
    const history = newHistory();
    expect(commit(history, history.present)).toBe(history);
  });

  it("limite le nombre d'étapes gardées", () => {
    let history = newHistory();
    for (let i = 0; i < MAX_UNDO + 20; i++) {
      history = commit(history, toggleMark(history.present, 'A1', i % 2 ? 'red' : 'blue'));
    }
    expect(history.past).toHaveLength(MAX_UNDO);
  });
});
