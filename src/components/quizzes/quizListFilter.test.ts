import { describe, expect, test } from 'vitest';
import type { QuizProgress } from '../quiz/quizStorage';
import { type ListedQuiz, SHOW_EVERY_QUIZ, hasBeenSolved, isListed } from './quizListFilter';

const total = 10;

const untouched: QuizProgress = { status: 'none', confirmed: 0, total, retrying: false };
const halfAnswered: QuizProgress = { status: 'in-progress', confirmed: 5, total, retrying: false };
const finished: QuizProgress = { status: 'completed', confirmed: total, total, retrying: false };
const retryingAfterFinishing: QuizProgress = { status: 'in-progress', confirmed: 3, total, retrying: true };

const untouchedModel: ListedQuiz = { kind: 'model', progress: untouched };
const finishedModel: ListedQuiz = { kind: 'model', progress: finished };
const untouchedPractice: ListedQuiz = { kind: 'practice', progress: untouched };

describe('hasBeenSolved', () => {
  test.each([
    { case: 'an untouched quiz', progress: untouched, solved: false },
    { case: 'a half answered quiz never finished before', progress: halfAnswered, solved: false },
    { case: 'a finished quiz', progress: finished, solved: true },
    { case: 'a quiz being retried after finishing it once', progress: retryingAfterFinishing, solved: true },
  ])('reports $case as solved: $solved', ({ progress, solved }) => {
    expect(hasBeenSolved(progress)).toBe(solved);
  });
});

describe('isListed', () => {
  test('shows every quiz when no filter is active', () => {
    const quizzes = [untouchedModel, finishedModel, untouchedPractice];
    expect(quizzes.filter(quiz => isListed(quiz, SHOW_EVERY_QUIZ))).toEqual(quizzes);
  });

  test('keeps only real exam models when filtering by models', () => {
    const quizzes = [untouchedModel, untouchedPractice];
    expect(quizzes.filter(quiz => isListed(quiz, { kind: 'model', onlyUnsolved: false }))).toEqual([
      untouchedModel,
    ]);
  });

  test('keeps only content-based practice when filtering by practice', () => {
    const quizzes = [untouchedModel, untouchedPractice];
    expect(quizzes.filter(quiz => isListed(quiz, { kind: 'practice', onlyUnsolved: false }))).toEqual([
      untouchedPractice,
    ]);
  });

  test('hides solved quizzes when only unsolved ones are requested', () => {
    const quizzes = [untouchedModel, finishedModel, untouchedPractice];
    expect(quizzes.filter(quiz => isListed(quiz, { kind: 'all', onlyUnsolved: true }))).toEqual([
      untouchedModel,
      untouchedPractice,
    ]);
  });

  test('combines both filters, so an unsolved practice quiz is hidden when filtering by models', () => {
    const quizzes = [untouchedModel, finishedModel, untouchedPractice];
    expect(quizzes.filter(quiz => isListed(quiz, { kind: 'model', onlyUnsolved: true }))).toEqual([
      untouchedModel,
    ]);
  });
});
