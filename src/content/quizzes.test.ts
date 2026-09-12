import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';
import { type Question, correctOptionIndexes } from '../components/quiz/question';

const QUIZZES_DIR = join(import.meta.dirname, 'quizzes');

interface Quiz {
  courseId: string;
  courseName: string;
  courseIcon: string;
  id: string;
  title: string;
  description: string;
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

function comparableStem(question: Question): string {
  return question.question.toLowerCase().replace(/[^0-9a-záéíóúñü]/g, '');
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

  test('asks each question only once', () => {
    const stems = quiz.questions.map(comparableStem);
    const repeated = duplicatesIn(stems);
    const repeatedQuestionIds = quiz.questions
      .filter(question => repeated.includes(comparableStem(question)))
      .map(question => question.id);
    expect(repeatedQuestionIds, 'these questions share a stem with an earlier one').toEqual([]);
  });
});
