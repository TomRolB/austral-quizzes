export type AnswerMap = Record<number, number[]>;
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

export const STATE_VERSION = 3;

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
  const run = saved?.current ?? saved;
  const keepsHistory = saved?.version === STATE_VERSION || saved?.current !== undefined;
  return {
    version: STATE_VERSION,
    current: {
      answers: asAnswerMap(run?.answers),
      confirmed: run?.confirmed ?? {},
    },
    history: keepsHistory && Array.isArray(saved?.history) ? saved.history : [],
  };
}

function asAnswerMap(saved: any): AnswerMap {
  const answers: AnswerMap = {};
  for (const [questionId, selection] of Object.entries(saved ?? {})) {
    answers[Number(questionId)] = asSelection(selection);
  }
  return answers;
}

function asSelection(saved: unknown): number[] {
  if (Array.isArray(saved)) return saved.filter(optionIndex => typeof optionIndex === 'number');
  return typeof saved === 'number' ? [saved] : [];
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
