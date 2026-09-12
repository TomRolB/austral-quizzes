import { describe, expect, test } from 'vitest';
import type { Question } from '../components/quiz/question';
import {
  MAX_ANSWER_SHAPE_SHARE,
  MAX_CORRECT_LENGTH_RATIO,
  MAX_POSITION_BIAS_PROBABILITY,
  correctToDistractorLengthRatio,
  mostBiasedPosition,
  mostCommonAnswerShape,
} from './biasChecks';

function multiQuestion(optionCount: number, correctCount: number): Question {
  return {
    id: 1,
    question: 'irrelevante',
    options: Array.from({ length: optionCount }, (_, index) => `${'abcdef'[index]}) opción`),
    answerIndexes: Array.from({ length: correctCount }, (_, index) => index),
  };
}

function questionWith(optionCount: number, answerIndex: number): Question {
  return {
    id: 1,
    question: 'irrelevante',
    options: Array.from({ length: optionCount }, (_, index) => `${'abcd'[index]}) opción`),
    answerIndex,
  };
}

function repeat(times: number, build: () => Question): Question[] {
  return Array.from({ length: times }, build);
}

function isFlagged(questions: Question[]): boolean {
  const worst = mostBiasedPosition(questions);
  return worst !== null && worst.probability <= MAX_POSITION_BIAS_PROBABILITY;
}

describe('mostBiasedPosition', () => {
  test('accepts a quiz that spreads its answers evenly', () => {
    const evenlySpread = repeat(6, () => questionWith(3, 0))
      .concat(repeat(6, () => questionWith(3, 1)))
      .concat(repeat(6, () => questionWith(3, 2)));
    expect(isFlagged(evenlySpread)).toBe(false);
  });

  test('flags a quiz that parks most answers on one position', () => {
    const lopsided = repeat(57, () => questionWith(3, 0))
      .concat(repeat(13, () => questionWith(3, 1)))
      .concat(repeat(2, () => questionWith(3, 2)));
    expect(isFlagged(lopsided)).toBe(true);
  });

  test('does not flag a small quiz, where a lopsided tally is ordinary luck', () => {
    const fiveQuestions = [
      questionWith(3, 0),
      questionWith(3, 0),
      questionWith(3, 0),
      questionWith(3, 1),
      questionWith(3, 2),
    ];
    expect(isFlagged(fiveQuestions)).toBe(false);
  });

  test('needs more evidence from a short quiz than from a long one to flag the same share', () => {
    const shortQuiz = repeat(6, () => questionWith(3, 0)).concat(repeat(4, () => questionWith(3, 1)));
    const longQuiz = repeat(60, () => questionWith(3, 0)).concat(repeat(40, () => questionWith(3, 1)));
    expect(isFlagged(shortQuiz)).toBe(false);
    expect(isFlagged(longQuiz)).toBe(true);
  });

  test('expects a rarer position to appear less often, so four-option questions raise the bar', () => {
    const threeOptions = mostBiasedPosition(repeat(20, () => questionWith(3, 0)))!;
    const fourOptions = mostBiasedPosition(repeat(20, () => questionWith(4, 0)))!;
    expect(threeOptions.expected).toBeCloseTo(20 / 3);
    expect(fourOptions.expected).toBeCloseTo(20 / 4);
  });

  test('only counts questions that actually offer the position', () => {
    const mixedWidths = [questionWith(2, 0), questionWith(2, 1), questionWith(4, 3)];
    const lastPosition = mostBiasedPosition(mixedWidths)!;
    expect(lastPosition.optionIndex).toBe(3);
    expect(lastPosition.candidates, 'only the four-option question offers a "d"').toBe(1);
  });

  test('ignores multi-answer questions, which have no single correct position', () => {
    const multiOnly: Question[] = [
      { id: 1, question: 'x', options: ['a) uno', 'b) dos', 'c) tres'], answerIndexes: [0, 1] },
    ];
    expect(mostBiasedPosition(multiOnly)!.candidates).toBe(0);
  });

  test('returns null when there are no questions at all', () => {
    expect(mostBiasedPosition([])).toBeNull();
  });
});

describe('mostCommonAnswerShape', () => {
  test('flags a quiz whose multi-answer questions are all the same shape', () => {
    const allThreeOfFour = repeat(26, () => multiQuestion(4, 3));
    expect(mostCommonAnswerShape(allThreeOfFour)!.share).toBeGreaterThan(MAX_ANSWER_SHAPE_SHARE);
  });

  test('accepts a quiz that mixes shapes', () => {
    const mixed = [
      ...repeat(3, () => multiQuestion(4, 3)),
      ...repeat(3, () => multiQuestion(4, 2)),
      ...repeat(3, () => multiQuestion(5, 3)),
      ...repeat(3, () => multiQuestion(3, 2)),
    ];
    expect(mostCommonAnswerShape(mixed)!.share).toBeLessThanOrEqual(MAX_ANSWER_SHAPE_SHARE);
  });

  test('treats the same correct count over different option counts as different shapes', () => {
    const sameCountDifferentWidth = [
      ...repeat(5, () => multiQuestion(4, 2)),
      ...repeat(5, () => multiQuestion(5, 2)),
    ];
    expect(mostCommonAnswerShape(sameCountDifferentWidth)!.share).toBe(0.5);
  });

  test('reports the shape it found, so a failure says what to vary', () => {
    const shape = mostCommonAnswerShape(repeat(4, () => multiQuestion(5, 3)))!;
    expect(shape.correctCount).toBe(3);
    expect(shape.optionCount).toBe(5);
    expect(shape.count).toBe(4);
    expect(shape.total).toBe(4);
  });

  test('ignores single-answer questions when measuring the shape', () => {
    const mostlySingleAnswer = [...repeat(20, () => questionWith(3, 0)), multiQuestion(4, 2)];
    const shape = mostCommonAnswerShape(mostlySingleAnswer)!;
    expect(shape.total, 'only the multi-answer question counts').toBe(1);
  });

  test('returns null for a quiz without multi-answer questions', () => {
    expect(mostCommonAnswerShape(repeat(5, () => questionWith(3, 0)))).toBeNull();
  });
});

describe('correctToDistractorLengthRatio', () => {
  function questionOf(correct: string, distractors: string[]): Question {
    return { id: 1, question: 'x', options: [`a) ${correct}`, ...distractors.map((d, i) => `${'bcd'[i]}) ${d}`)], answerIndex: 0 };
  }

  test('reports 1 when correct options and distractors are the same length', () => {
    expect(correctToDistractorLengthRatio([questionOf('doce chars!!', ['doce chars!!', 'doce chars!!'])])).toBe(1);
  });

  test('rises above the ceiling when the correct option is the wordy one', () => {
    const wordy = questionOf('una respuesta correcta larga y cuidadosamente matizada', ['corta', 'breve']);
    expect(correctToDistractorLengthRatio([wordy])).toBeGreaterThan(MAX_CORRECT_LENGTH_RATIO);
  });

  test('stays within the ceiling when distractors match the correct option in length', () => {
    const balanced = questionOf('una respuesta correcta larga y cuidadosamente matizada', [
      'una alternativa incorrecta de extensión equivalente',
      'otra alternativa incorrecta de extensión parecida',
    ]);
    expect(correctToDistractorLengthRatio([balanced])).toBeLessThanOrEqual(MAX_CORRECT_LENGTH_RATIO);
  });

  test('measures the option text, not the letter prefix', () => {
    const sameBodies = questionOf('mismo texto', ['mismo texto', 'mismo texto']);
    expect(correctToDistractorLengthRatio([sameBodies])).toBe(1);
  });

  test('counts every correct option of a multi-answer question', () => {
    const multi: Question = {
      id: 1,
      question: 'x',
      options: ['a) larguísima respuesta correcta', 'b) larguísima respuesta correcta', 'c) no'],
      answerIndexes: [0, 1],
    };
    expect(correctToDistractorLengthRatio([multi])).toBeGreaterThan(MAX_CORRECT_LENGTH_RATIO);
  });
});
