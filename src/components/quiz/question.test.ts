import { expect, test } from 'vitest';
import {
  type Question,
  allowsMultipleAnswers,
  correctOptionIndexes,
  correctOptionLabels,
  isSelectionCorrect,
  toggleOption,
} from './question';

const singleAnswerQuestion: Question = {
  id: 1,
  question: '¿Cuál es la misión de una empresa?',
  options: ['Misión', 'Visión', 'Estrategia'],
  answerIndex: 0,
};

const multipleAnswerQuestion: Question = {
  id: 2,
  question: 'Señale los elementos de un puesto de trabajo',
  options: ['Procesos', 'Resultados', 'Competencias', 'Expectativas'],
  answerIndexes: [0, 1, 2],
};

const singleCorrectButMultipleChoiceQuestion: Question = {
  id: 3,
  question: 'Seleccione una o más de una',
  options: ['Correcta', 'Incorrecta'],
  answerIndexes: [0],
};

test('a question with answerIndex only accepts a single selection', () => {
  expect(allowsMultipleAnswers(singleAnswerQuestion)).toBe(false);
  expect(correctOptionIndexes(singleAnswerQuestion)).toEqual([0]);
});

test('a question with answerIndexes accepts several selections', () => {
  expect(allowsMultipleAnswers(multipleAnswerQuestion)).toBe(true);
  expect(correctOptionIndexes(multipleAnswerQuestion)).toEqual([0, 1, 2]);
});

test('a multiple-choice question with one correct option still renders as multiple choice', () => {
  expect(allowsMultipleAnswers(singleCorrectButMultipleChoiceQuestion)).toBe(true);
});

test('correct labels map every correct index to its option text', () => {
  expect(correctOptionLabels(multipleAnswerQuestion)).toEqual(['Procesos', 'Resultados', 'Competencias']);
});

test('a selection matching every correct option scores as correct, regardless of click order', () => {
  expect(isSelectionCorrect(multipleAnswerQuestion, [2, 0, 1])).toBe(true);
});

test('a selection missing one correct option scores as incorrect', () => {
  expect(isSelectionCorrect(multipleAnswerQuestion, [0, 1])).toBe(false);
});

test('a selection adding a wrong option to every correct one scores as incorrect', () => {
  expect(isSelectionCorrect(multipleAnswerQuestion, [0, 1, 2, 3])).toBe(false);
});

test('an empty selection scores as incorrect', () => {
  expect(isSelectionCorrect(multipleAnswerQuestion, [])).toBe(false);
  expect(isSelectionCorrect(singleAnswerQuestion, [])).toBe(false);
});

test('a single-answer question scores its one correct option as correct', () => {
  expect(isSelectionCorrect(singleAnswerQuestion, [0])).toBe(true);
  expect(isSelectionCorrect(singleAnswerQuestion, [1])).toBe(false);
});

test('toggling an unselected option adds it', () => {
  expect(toggleOption([0, 2], 1)).toEqual([0, 2, 1]);
});

test('toggling an already selected option removes it', () => {
  expect(toggleOption([0, 1, 2], 1)).toEqual([0, 2]);
});

test('toggling does not mutate the original selection', () => {
  const selection = [0, 1];
  toggleOption(selection, 2);
  expect(selection).toEqual([0, 1]);
});
