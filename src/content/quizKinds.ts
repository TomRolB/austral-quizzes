export const QUIZ_KINDS = ['model', 'practice'] as const;

export type QuizKind = (typeof QUIZ_KINDS)[number];

export const QUIZ_KIND_LABELS: Record<QuizKind, string> = {
  model: 'Modelo real',
  practice: 'Basado en contenido',
};
