export type AnswerMap = Record<number, number | null>;
export type ConfirmedMap = Record<number, boolean>;

export interface CurrentRun {
  answers: AnswerMap;
  confirmed: ConfirmedMap;
}

export interface ArchivedRun {
  completedAt: number;
  score: number;
  total: number;
}

export interface QuizState {
  version: number;
  current: CurrentRun;
  history: ArchivedRun[];
}

export const STATE_VERSION = 2;

export function storageKeyFor(quizId: string): string {
  return `quiz-state-${quizId}`;
}

export function emptyQuizState(): QuizState {
  return { version: STATE_VERSION, current: { answers: {}, confirmed: {} }, history: [] };
}

export function parseQuizState(raw: string | null): QuizState {
  if (!raw) return emptyQuizState();
  try {
    return migrate(JSON.parse(raw));
  } catch {
    return emptyQuizState();
  }
}

function migrate(saved: any): QuizState {
  if (saved?.version === STATE_VERSION && saved.current) {
    return {
      version: STATE_VERSION,
      current: {
        answers: saved.current.answers ?? {},
        confirmed: saved.current.confirmed ?? {},
      },
      history: Array.isArray(saved.history) ? saved.history : [],
    };
  }
  return {
    version: STATE_VERSION,
    current: { answers: saved?.answers ?? {}, confirmed: saved?.confirmed ?? {} },
    history: [],
  };
}

export type QuizStatus = 'none' | 'in-progress' | 'completed';

export interface QuizProgress {
  status: QuizStatus;
  confirmed: number;
  total: number;
  retrying: boolean;
}

export function summarizeProgress(state: QuizState, total: number): QuizProgress {
  const confirmed = Object.keys(state.current.confirmed).length;
  const hasPreviousRuns = state.history.length > 0;

  if (confirmed > 0) {
    const completed = confirmed >= total;
    return { status: completed ? 'completed' : 'in-progress', confirmed, total, retrying: hasPreviousRuns && !completed };
  }

  if (hasPreviousRuns) {
    return { status: 'completed', confirmed: total, total, retrying: false };
  }

  return { status: 'none', confirmed: 0, total, retrying: false };
}
