import type { QuizKind } from '../../content/quizKinds';
import type { QuizProgress } from '../quiz/quizStorage';

export type KindFilter = QuizKind | 'all';

export interface QuizListFilters {
  kind: KindFilter;
  onlyUnsolved: boolean;
}

export interface ListedQuiz {
  kind: QuizKind;
  progress: QuizProgress;
}

export const SHOW_EVERY_QUIZ: QuizListFilters = { kind: 'all', onlyUnsolved: false };

/** A quiz being retried was finished at least once, so it already counts as solved. */
export function hasBeenSolved(progress: QuizProgress): boolean {
  return progress.status === 'completed' || progress.retrying;
}

export function isListed(quiz: ListedQuiz, filters: QuizListFilters): boolean {
  const matchesKind = filters.kind === 'all' || quiz.kind === filters.kind;
  const matchesSolvedState = !filters.onlyUnsolved || !hasBeenSolved(quiz.progress);
  return matchesKind && matchesSolvedState;
}
