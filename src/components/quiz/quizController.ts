interface Question {
  id: number;
  question: string;
  options: string[];
  answerIndex: number;
}

interface QuizState {
  answers: Record<number, number | null>;
  confirmed: Record<number, boolean>;
}

export class QuizController {
  private quizId: string;
  private questions: Question[];
  private storageKey: string;
  private state: QuizState = { answers: {}, confirmed: {} };

  constructor(quizId: string, questions: Question[]) {
    this.quizId = quizId;
    this.questions = questions;
    this.storageKey = `quiz-state-${quizId}`;
  }

  public init(): void {
    this.loadFromStorage();
    this.questions.forEach(q => this.refreshQuestion(q.id));
    this.updateBanner();
    this.updateProgressBar();
    this.attachEventListeners();
    if (this.isCompleted()) {
      this.showCompletionIfDone();
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      this.state.answers = saved.answers ?? {};
      this.state.confirmed = saved.confirmed ?? {};
    } catch {
      // Ignore corrupted state
    }
  }

  private persistToStorage(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.state));
  }

  private clearStorage(): void {
    localStorage.removeItem(this.storageKey);
  }

  private isCorrect(questionId: number, answerIndex: number | null): boolean {
    const question = this.questions.find(q => q.id === questionId);
    return question !== undefined && answerIndex === question.answerIndex;
  }

  private countConfirmed(): number {
    return Object.keys(this.state.confirmed).length;
  }

  private countScore(): number {
    return Object.keys(this.state.confirmed).reduce((acc, qId) => {
      const numId = Number(qId);
      return acc + (this.isCorrect(numId, this.state.answers[numId]) ? 1 : 0);
    }, 0);
  }

  private isCompleted(): boolean {
    return this.countConfirmed() === this.questions.length;
  }

  private updateBanner(): void {
    const banner = document.getElementById(`score-banner-${this.quizId}`);
    if (!banner) return;

    const confirmed = this.countConfirmed();
    const score = this.countScore();
    const pct = this.questions.length > 0 ? Math.round((score / this.questions.length) * 100) : 0;

    const confirmedEl = banner.querySelector('[data-confirmed]');
    const scoreEl = banner.querySelector('[data-score]');
    const pctEl = banner.querySelector('[data-percentage]');

    if (confirmedEl) confirmedEl.textContent = String(confirmed);
    if (scoreEl) scoreEl.textContent = String(score);
    if (pctEl) pctEl.textContent = `${pct}%`;
  }

  private updateProgressBar(): void {
    const progressEl = document.getElementById(`quiz-progress-${this.quizId}`);
    if (!progressEl) return;

    const fill = progressEl.querySelector('.progress-fill') as HTMLElement;
    if (!fill) return;

    const confirmed = this.countConfirmed();
    const pct = this.questions.length > 0 ? Math.round((confirmed / this.questions.length) * 100) : 0;
    fill.style.width = `${pct}%`;
    fill.classList.toggle('progress-fill--complete', confirmed === this.questions.length);
  }

  private applyOptionStates(questionId: number): void {
    const question = this.questions.find(q => q.id === questionId);
    if (!question) return;

    const confirmed = this.state.confirmed[questionId] === true;
    const selected = this.state.answers[questionId] ?? null;

    question.options.forEach((_, optIdx) => {
      const btn = document.getElementById(`option-${this.quizId}-${questionId}-${optIdx}`) as HTMLButtonElement | null;
      if (!btn) return;

      btn.classList.remove('option-btn--selected', 'option-btn--correct', 'option-btn--incorrect', 'option-btn--dimmed');
      btn.disabled = confirmed;

      if (confirmed) {
        this.setConfirmedOptionStyles(btn, optIdx, question.answerIndex, selected);
      } else {
        this.setPendingOptionStyles(btn, optIdx, selected);
      }
    });
  }

  private setConfirmedOptionStyles(
    btn: HTMLButtonElement,
    optIdx: number,
    answerIndex: number,
    selected: number | null
  ): void {
    const isAnswer = optIdx === answerIndex;
    const isChosen = optIdx === selected;

    if (isAnswer) btn.classList.add('option-btn--correct');
    else if (isChosen) btn.classList.add('option-btn--incorrect');
    else btn.classList.add('option-btn--dimmed');
  }

  private setPendingOptionStyles(
    btn: HTMLButtonElement,
    optIdx: number,
    selected: number | null
  ): void {
    const isSelected = optIdx === selected;
    if (isSelected) btn.classList.add('option-btn--selected');
  }

  private applyCardState(questionId: number): void {
    const card = document.getElementById(`question-${this.quizId}-${questionId}`);
    if (!card) return;
    const confirmed = this.state.confirmed[questionId] === true;
    card.classList.remove('question-card--correct', 'question-card--incorrect');
    if (confirmed) {
      const correct = this.isCorrect(questionId, this.state.answers[questionId]);
      card.classList.add(correct ? 'question-card--correct' : 'question-card--incorrect');
    }
  }

  private applyResultBanner(questionId: number): void {
    const resultEl = document.getElementById(`result-${this.quizId}-${questionId}`);
    if (!resultEl) return;

    const confirmed = this.state.confirmed[questionId] === true;
    const correctBanner = resultEl.querySelector('[data-banner-type="correct"]') as HTMLElement | null;
    const incorrectBanner = resultEl.querySelector('[data-banner-type="incorrect"]') as HTMLElement | null;

    if (correctBanner) correctBanner.style.display = 'none';
    if (incorrectBanner) incorrectBanner.style.display = 'none';

    if (confirmed) {
      const correct = this.isCorrect(questionId, this.state.answers[questionId]);
      if (correct && correctBanner) {
        correctBanner.style.display = 'flex';
      } else if (!correct && incorrectBanner) {
        incorrectBanner.style.display = 'flex';
      }
    }
  }

  private refreshQuestion(questionId: number): void {
    this.applyOptionStates(questionId);
    this.applyCardState(questionId);
    this.applyResultBanner(questionId);
  }

  private confirmAnswer(questionId: number, optionIndex: number): void {
    this.state.answers[questionId] = optionIndex;
    this.state.confirmed[questionId] = true;
    this.persistToStorage();
    this.refreshQuestion(questionId);
    this.updateBanner();
    this.updateProgressBar();
    this.showCompletionIfDone();
  }

  private revealAll(): void {
    this.questions.forEach(q => {
      if (!this.state.confirmed[q.id]) {
        this.state.confirmed[q.id] = true;
        if (this.state.answers[q.id] === undefined) {
          this.state.answers[q.id] = null;
        }
      }
      this.refreshQuestion(q.id);
    });
    this.persistToStorage();
    this.updateBanner();
    this.updateProgressBar();
    this.showCompletionIfDone();
  }

  private resetQuiz(): void {
    this.state.answers = {};
    this.state.confirmed = {};
    this.clearStorage();
    this.questions.forEach(q => this.refreshQuestion(q.id));
    this.updateBanner();
    this.updateProgressBar();
    this.hideCompletion();
  }

  private showCompletionIfDone(): void {
    if (!this.isCompleted()) return;
    const wrapper = document.getElementById(`completion-wrapper-${this.quizId}`);
    if (wrapper) wrapper.style.display = '';

    const revealBtn = document.getElementById(`reveal-${this.quizId}`);
    if (revealBtn) revealBtn.style.display = 'none';

    this.updateCompletionSummary();
  }

  private hideCompletion(): void {
    const wrapper = document.getElementById(`completion-wrapper-${this.quizId}`);
    if (wrapper) wrapper.style.display = 'none';

    const revealBtn = document.getElementById(`reveal-${this.quizId}`);
    if (revealBtn) revealBtn.style.display = '';
  }

  private updateCompletionSummary(): void {
    const score = this.countScore();
    const pct = this.questions.length > 0 ? Math.round((score / this.questions.length) * 100) : 0;

    const scoreEl = document.querySelector(`#completion-${this.quizId} [data-final-score]`);
    const pctEl = document.querySelector(`#completion-${this.quizId} [data-final-pct]`);
    if (scoreEl) scoreEl.textContent = String(score);
    if (pctEl) pctEl.textContent = `${pct}%`;
  }

  private attachEventListeners(): void {
    const island = document.getElementById(`island-${this.quizId}`);
    if (!island) return;

    island.addEventListener('click', event => {
      const target = (event.target as HTMLElement).closest('[data-option-index]') as HTMLButtonElement | null;
      if (target && !target.disabled) {
        const questionId = Number(target.dataset.questionId);
        const optionIndex = Number(target.dataset.optionIndex);
        this.confirmAnswer(questionId, optionIndex);
      }
    });

    const revealBtn = document.getElementById(`reveal-${this.quizId}`);
    if (revealBtn) {
      revealBtn.addEventListener('click', () => this.revealAll());
    }

    const retryBtn = document.getElementById(`retry-${this.quizId}`);
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.resetQuiz());
    }
  }
}
