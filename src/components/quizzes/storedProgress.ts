import { type QuizProgress, parseQuizState, storageKeyFor, summarizeProgress } from '../quiz/quizStorage';

/** Reads the browser's localStorage, so only client-side scripts can call it. */
export function loadStoredProgress(quizId: string, questionCount: number): QuizProgress {
  return summarizeProgress(parseQuizState(localStorage.getItem(storageKeyFor(quizId))), questionCount);
}
