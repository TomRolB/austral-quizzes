export interface Question {
  id: number;
  question: string;
  options: string[];
  answerIndex?: number;
  answerIndexes?: number[];
}

export function allowsMultipleAnswers(question: Question): boolean {
  return question.answerIndexes !== undefined;
}

export function correctOptionIndexes(question: Question): number[] {
  if (question.answerIndexes !== undefined) return question.answerIndexes;
  return question.answerIndex === undefined ? [] : [question.answerIndex];
}

export function correctOptionLabels(question: Question): string[] {
  return correctOptionIndexes(question).map(optionIndex => question.options[optionIndex]);
}

export function isSelectionCorrect(question: Question, selection: number[]): boolean {
  const correctIndexes = correctOptionIndexes(question);
  if (selection.length !== correctIndexes.length) return false;
  return correctIndexes.every(optionIndex => selection.includes(optionIndex));
}

export function toggleOption(selection: number[], optionIndex: number): number[] {
  return selection.includes(optionIndex)
    ? selection.filter(selectedIndex => selectedIndex !== optionIndex)
    : [...selection, optionIndex];
}
