import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';
import { type Question, correctOptionIndexes } from '../components/quiz/question';
import {
  type AnswerShape,
  type BiasCheck,
  MAX_ANSWER_SHAPE_SHARE,
  MAX_CORRECT_LENGTH_RATIO,
  MAX_POSITION_BIAS_PROBABILITY,
  MIN_QUESTIONS_FOR_SHAPE_CHECK,
  correctToDistractorLengthRatio,
  mostBiasedPosition,
  mostCommonAnswerShape,
} from './biasChecks';

const QUIZZES_DIR = join(import.meta.dirname, 'quizzes');

interface Quiz {
  courseId: string;
  courseName: string;
  courseIcon: string;
  id: string;
  title: string;
  description: string;
  ignoredBiasChecks?: BiasCheck[];
  questions: Question[];
}

interface QuizFile {
  name: string;
  quiz: Quiz;
}

function quizFilePaths(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return quizFilePaths(path);
    return entry.name.endsWith('.json') ? [path] : [];
  });
}

function loadQuizFiles(): QuizFile[] {
  return quizFilePaths(QUIZZES_DIR).map(path => ({
    name: relative(QUIZZES_DIR, path).replace(/\\/g, '/'),
    quiz: JSON.parse(readFileSync(path, 'utf8')) as Quiz,
  }));
}

function duplicatesIn<T>(values: T[]): T[] {
  const seen = new Set<T>();
  return values.filter(value => (seen.has(value) ? true : (seen.add(value), false)));
}

const quizFiles = loadQuizFiles();

test('the quizzes collection is not empty', () => {
  expect(quizFiles.length).toBeGreaterThan(0);
});

test('every quiz declares a unique id, so two quizzes never share stored progress', () => {
  const ids = quizFiles.map(file => file.quiz.id);
  expect(duplicatesIn(ids)).toEqual([]);
});

describe.each(quizFiles)('$name', ({ quiz }) => {
  test('declares the course and quiz metadata the listing pages read', () => {
    for (const field of ['courseId', 'courseName', 'courseIcon', 'id', 'title', 'description'] as const) {
      expect(quiz[field], `missing "${field}"`).toBeTruthy();
    }
  });

  test('has questions', () => {
    expect(quiz.questions.length).toBeGreaterThan(0);
  });

  test('numbers every question uniquely', () => {
    expect(duplicatesIn(quiz.questions.map(question => question.id))).toEqual([]);
  });

  test.each(quiz.questions.map(question => [question.id, question] as const))(
    'question %i is answerable',
    (id, question) => {
      const declaresSingle = question.answerIndex !== undefined;
      const declaresMultiple = question.answerIndexes !== undefined;
      expect(
        declaresSingle !== declaresMultiple,
        `question ${id} must declare either answerIndex or answerIndexes, not both or neither`
      ).toBe(true);

      expect(question.question.trim(), `question ${id} has an empty stem`).not.toBe('');
      expect(question.options.length, `question ${id} needs at least two options`).toBeGreaterThan(1);
      expect(duplicatesIn(question.options), `question ${id} repeats an option`).toEqual([]);

      const correctIndexes = correctOptionIndexes(question);
      expect(correctIndexes.length, `question ${id} marks no correct option`).toBeGreaterThan(0);
      expect(duplicatesIn(correctIndexes), `question ${id} repeats a correct index`).toEqual([]);
      for (const optionIndex of correctIndexes) {
        expect(
          optionIndex >= 0 && optionIndex < question.options.length,
          `question ${id} points at option ${optionIndex}, but it only has ${question.options.length}`
        ).toBe(true);
      }
      expect(
        correctIndexes.length,
        `question ${id} marks every option correct, so it cannot be answered wrong`
      ).toBeLessThanOrEqual(question.options.length);
    }
  );

  const ignored = quiz.ignoredBiasChecks ?? [];

  test.skipIf(ignored.includes('answer-position'))(
    'spreads the correct answer across option positions',
    () => {
      const worst = mostBiasedPosition(quiz.questions);
      if (worst === null) return;

      expect(
        worst.probability,
        `option ${letterFor(worst.optionIndex)} is correct in ${worst.count} of ${worst.candidates} ` +
          `questions that offer it, where chance predicts ${worst.expected.toFixed(1)}; ` +
          `a quiz placing its answers at random would do that ${asOdds(worst.probability)}`
      ).toBeGreaterThan(MAX_POSITION_BIAS_PROBABILITY);
    }
  );

  test.skipIf(ignored.includes('answer-shape'))(
    'varies how many options its multi-answer questions mark correct',
    ({ skip }) => {
      const shape = mostCommonAnswerShape(quiz.questions);
      skip(shape === null, 'no multi-answer questions, so there is no shape to give away');

      const repeated = shape as AnswerShape;
      skip(
        repeated.total < MIN_QUESTIONS_FOR_SHAPE_CHECK,
        `only ${repeated.total} multi-answer question(s), so a repeated shape is arithmetic, not a pattern`
      );

      expect(
        repeated.share,
        `${repeated.count} of ${repeated.total} multi-answer questions mark ${repeated.correctCount} ` +
          `of ${repeated.optionCount} options correct; that shape is predictable enough to answer ` +
          `without reading the options`
      ).toBeLessThanOrEqual(MAX_ANSWER_SHAPE_SHARE);
    }
  );

  test.skipIf(ignored.includes('answer-length'))(
    'does not make the correct answer the wordiest one',
    () => {
      const ratio = correctToDistractorLengthRatio(quiz.questions);
      expect(
        ratio,
        `correct options average ${ratio.toFixed(2)}x the length of the distractors; ` +
          `lengthen the distractors so "pick the longest" stops being a winning strategy`
      ).toBeLessThanOrEqual(MAX_CORRECT_LENGTH_RATIO);
    }
  );
});

function letterFor(optionIndex: number): string {
  return String.fromCharCode('a'.charCodeAt(0) + optionIndex);
}

function asOdds(probability: number): string {
  if (probability === 0) return 'essentially never';
  return `about once in ${Math.round(1 / probability).toLocaleString('en-US')} quizzes`;
}
