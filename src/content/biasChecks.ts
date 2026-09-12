import { type Question, correctOptionIndexes } from '../components/quiz/question';

export const BIAS_CHECKS = ['answer-position', 'answer-length', 'answer-shape'] as const;

export type BiasCheck = (typeof BIAS_CHECKS)[number];

/**
 * How often multi-answer questions may repeat the same "N correct out of M options" shape. There is
 * no chance baseline here — an author picks the shape — so this is a flat ceiling: above it the
 * student stops weighing each option and just reproduces the pattern.
 */
export const MAX_ANSWER_SHAPE_SHARE = 0.5;

/** Below this many multi-answer questions a repeated shape is arithmetic, not a pattern. */
export const MIN_QUESTIONS_FOR_SHAPE_CHECK = 5;

/**
 * How unlikely a position's tally must be, under the assumption that the quiz places its answers at
 * random, before we call it a bias. Low enough that a well-built quiz is not flagged by chance.
 */
export const MAX_POSITION_BIAS_PROBABILITY = 0.001;

/** Correct options must not read as consistently wordier — the classic "pick the longest" tell. */
export const MAX_CORRECT_LENGTH_RATIO = 1.15;

export interface PositionBias {
  optionIndex: number;
  count: number;
  expected: number;
  candidates: number;
  probability: number;
}

function optionBody(option: string): string {
  return option.replace(/^[a-z]\) /, '');
}

function singleAnswerQuestions(questions: Question[]): Question[] {
  return questions.filter(question => question.answerIndex !== undefined);
}

function widestOptionCount(questions: Question[]): number {
  return questions.reduce((widest, question) => Math.max(widest, question.options.length), 0);
}

/**
 * Probability that a sum of independent coin flips, each with its own probability, lands on `atLeast`
 * or more heads. Exact — the questions carry different option counts, so the flips are not identical.
 */
function chanceOfAtLeast(probabilities: number[], atLeast: number): number {
  let distribution = [1];
  for (const probability of probabilities) {
    const next = new Array(distribution.length + 1).fill(0);
    distribution.forEach((mass, successes) => {
      next[successes] += mass * (1 - probability);
      next[successes + 1] += mass * probability;
    });
    distribution = next;
  }
  return distribution.slice(atLeast).reduce((total, mass) => total + mass, 0);
}

function biasAtPosition(questions: Question[], optionIndex: number): PositionBias {
  const candidates = singleAnswerQuestions(questions).filter(
    question => question.options.length > optionIndex
  );
  const probabilities = candidates.map(question => 1 / question.options.length);
  const count = candidates.filter(question => question.answerIndex === optionIndex).length;

  return {
    optionIndex,
    count,
    candidates: candidates.length,
    expected: probabilities.reduce((total, probability) => total + probability, 0),
    probability: chanceOfAtLeast(probabilities, count),
  };
}

/**
 * The position whose tally is hardest to explain by chance. Its probability is corrected for having
 * looked at every position, so that testing more positions cannot manufacture a finding.
 */
export function mostBiasedPosition(questions: Question[]): PositionBias | null {
  const positions = Array.from({ length: widestOptionCount(questions) }, (_, index) => index);
  const biases = positions.map(optionIndex => biasAtPosition(questions, optionIndex));
  if (biases.length === 0) return null;

  const worst = biases.reduce((hardest, bias) => (bias.probability < hardest.probability ? bias : hardest));
  return { ...worst, probability: Math.min(1, worst.probability * positions.length) };
}

export interface AnswerShape {
  correctCount: number;
  optionCount: number;
  count: number;
  total: number;
  share: number;
}

/**
 * The most repeated shape among the multi-answer questions. Null when a quiz has none, since a quiz
 * of single-answer questions has no shape to give away.
 */
export function mostCommonAnswerShape(questions: Question[]): AnswerShape | null {
  const multiAnswer = questions.filter(question => question.answerIndexes !== undefined);
  if (multiAnswer.length === 0) return null;

  const tally = new Map<string, AnswerShape>();
  for (const question of multiAnswer) {
    const correctCount = (question.answerIndexes as number[]).length;
    const optionCount = question.options.length;
    const key = `${correctCount}/${optionCount}`;
    const seen = tally.get(key);
    if (seen) seen.count++;
    else tally.set(key, { correctCount, optionCount, count: 1, total: multiAnswer.length, share: 0 });
  }

  const shapes = [...tally.values()].map(shape => ({ ...shape, share: shape.count / multiAnswer.length }));
  return shapes.reduce((most, shape) => (shape.count > most.count ? shape : most));
}

export function correctToDistractorLengthRatio(questions: Question[]): number {
  const correctLengths: number[] = [];
  const distractorLengths: number[] = [];

  for (const question of questions) {
    const correctIndexes = correctOptionIndexes(question);
    question.options.forEach((option, optionIndex) => {
      const target = correctIndexes.includes(optionIndex) ? correctLengths : distractorLengths;
      target.push(optionBody(option).length);
    });
  }

  if (correctLengths.length === 0 || distractorLengths.length === 0) return 1;
  return mean(correctLengths) / mean(distractorLengths);
}

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}
