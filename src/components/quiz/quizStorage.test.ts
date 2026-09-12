import { describe, expect, test } from 'vitest';
import {
  STATE_VERSION,
  emptyQuizState,
  parseQuizState,
  storageKeyFor,
  summarizeProgress,
} from './quizStorage';

function storedAs(state: unknown): string {
  return JSON.stringify(state);
}

describe('parseQuizState', () => {
  test('returns an empty state when nothing was stored', () => {
    expect(parseQuizState(null)).toEqual(emptyQuizState());
  });

  test('returns an empty state when the stored value is not valid JSON', () => {
    expect(parseQuizState('not json at all')).toEqual(emptyQuizState());
  });

  test('keeps selections and history of a current-version state', () => {
    const saved = storedAs({
      version: STATE_VERSION,
      current: { answers: { 1: [0, 2] }, confirmed: { 1: true } },
      history: [{ completedAt: 1700000000000, score: 4, total: 10 }],
    });

    expect(parseQuizState(saved)).toEqual({
      version: STATE_VERSION,
      current: { answers: { 1: [0, 2] }, confirmed: { 1: true } },
      history: [{ completedAt: 1700000000000, score: 4, total: 10 }],
    });
  });

  test('migrates a version 2 single-answer selection into a one-element selection', () => {
    const savedByPreviousVersion = storedAs({
      version: 2,
      current: { answers: { 1: 0, 2: 3 }, confirmed: { 1: true, 2: true } },
      history: [{ completedAt: 1700000000000, score: 1, total: 2 }],
    });

    expect(parseQuizState(savedByPreviousVersion)).toEqual({
      version: STATE_VERSION,
      current: { answers: { 1: [0], 2: [3] }, confirmed: { 1: true, 2: true } },
      history: [{ completedAt: 1700000000000, score: 1, total: 2 }],
    });
  });

  test('migrates a revealed question stored with a null selection into an empty selection', () => {
    const savedWithRevealedQuestion = storedAs({
      version: 2,
      current: { answers: { 1: null }, confirmed: { 1: true } },
      history: [],
    });

    expect(parseQuizState(savedWithRevealedQuestion).current.answers).toEqual({ 1: [] });
  });

  test('migrates the oldest shape, which stored answers without a current run', () => {
    const savedBeforeRunsExisted = storedAs({ answers: { 1: 2 }, confirmed: { 1: true } });

    expect(parseQuizState(savedBeforeRunsExisted)).toEqual({
      version: STATE_VERSION,
      current: { answers: { 1: [2] }, confirmed: { 1: true } },
      history: [],
    });
  });

  test('drops a history that was not stored as a list', () => {
    const savedWithBrokenHistory = storedAs({
      version: STATE_VERSION,
      current: { answers: {}, confirmed: {} },
      history: 'corrupted',
    });

    expect(parseQuizState(savedWithBrokenHistory).history).toEqual([]);
  });
});

describe('summarizeProgress', () => {
  const total = 10;

  function stateWith(confirmedCount: number, history: { completedAt: number; score: number; total: number }[] = []) {
    const confirmed: Record<number, boolean> = {};
    for (let questionId = 1; questionId <= confirmedCount; questionId++) confirmed[questionId] = true;
    return { version: STATE_VERSION, current: { answers: {}, confirmed }, history };
  }

  const archivedRun = { completedAt: 1700000000000, score: 7, total };

  test('reports no progress on an untouched quiz', () => {
    expect(summarizeProgress(stateWith(0), total)).toEqual({
      status: 'none',
      confirmed: 0,
      total,
      retrying: false,
    });
  });

  test('reports a partially answered quiz as in progress', () => {
    expect(summarizeProgress(stateWith(3), total)).toEqual({
      status: 'in-progress',
      confirmed: 3,
      total,
      retrying: false,
    });
  });

  test('reports a fully answered quiz as completed', () => {
    expect(summarizeProgress(stateWith(total), total)).toEqual({
      status: 'completed',
      confirmed: total,
      total,
      retrying: false,
    });
  });

  test('flags a partially answered quiz that already has an archived run as a retry', () => {
    expect(summarizeProgress(stateWith(3, [archivedRun]), total).retrying).toBe(true);
  });

  test('reports a quiz whose only run was archived as completed', () => {
    expect(summarizeProgress(stateWith(0, [archivedRun]), total)).toEqual({
      status: 'completed',
      confirmed: total,
      total,
      retrying: false,
    });
  });
});

describe('storageKeyFor', () => {
  test('namespaces the key per quiz so two quizzes never share progress', () => {
    expect(storageKeyFor('quiz-fh-p1')).toBe('quiz-state-quiz-fh-p1');
    expect(storageKeyFor('quiz-fh-p1')).not.toBe(storageKeyFor('quiz-fh-p2'));
  });
});
