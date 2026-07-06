interface Question {
  id: number;
  question: string;
  options: string[];
  answerIndex: number;
}

type AnswerMap = Record<number, number | null>;
type ConfirmedMap = Record<number, boolean>;

interface CurrentRun {
  answers: AnswerMap;
  confirmed: ConfirmedMap;
}

interface ArchivedRun {
  completedAt: number;
  score: number;
  total: number;
}

interface PersistedState {
  version: number;
  current: CurrentRun;
  history: ArchivedRun[];
}

interface RunView {
  label: string;
  when: string;
  score: number;
  total: number;
  isCurrent: boolean;
}

const STATE_VERSION = 2;

export class QuizController {
  private readonly quizId: string;
  private readonly questions: Question[];
  private readonly storageKey: string;
  private state: PersistedState = QuizController.emptyState();
  private island: HTMLElement | null = null;

  constructor(quizId: string, questions: Question[]) {
    this.quizId = quizId;
    this.questions = questions;
    this.storageKey = `quiz-state-${quizId}`;
  }

  public init(): void {
    this.island = document.getElementById(`island-${this.quizId}`);
    this.loadFromStorage();
    this.questions.forEach(question => this.refreshQuestion(question.id));
    this.refreshGlobalUi();
    this.attachEventListeners();
    if (this.isCompleted()) {
      this.showCompletionIfDone();
    }
  }

  private static emptyState(): PersistedState {
    return { version: STATE_VERSION, current: { answers: {}, confirmed: {} }, history: [] };
  }

  private get answers(): AnswerMap {
    return this.state.current.answers;
  }

  private get confirmed(): ConfirmedMap {
    return this.state.current.confirmed;
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      this.state = QuizController.migrate(JSON.parse(raw));
    } catch {
      this.state = QuizController.emptyState();
    }
  }

  private static migrate(saved: any): PersistedState {
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

  private persistToStorage(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.state));
  }

  private isCorrect(questionId: number, answerIndex: number | null): boolean {
    const question = this.questions.find(candidate => candidate.id === questionId);
    return question !== undefined && answerIndex === question.answerIndex;
  }

  private countConfirmed(): number {
    return Object.keys(this.confirmed).length;
  }

  private countScore(): number {
    return Object.keys(this.confirmed).reduce((total, questionId) => {
      const numericId = Number(questionId);
      return total + (this.isCorrect(numericId, this.answers[numericId]) ? 1 : 0);
    }, 0);
  }

  private isCompleted(): boolean {
    return this.countConfirmed() === this.questions.length;
  }

  private percentageOf(score: number): number {
    return this.questions.length > 0 ? Math.round((score / this.questions.length) * 100) : 0;
  }

  private updateBanner(): void {
    const banner = document.getElementById(`score-banner-${this.quizId}`);
    if (!banner) return;

    const score = this.countScore();
    this.setText(banner.querySelector('[data-confirmed]'), String(this.countConfirmed()));
    this.setText(banner.querySelector('[data-score]'), String(score));
    this.setText(banner.querySelector('[data-percentage]'), `${this.percentageOf(score)}%`);
  }

  private setText(element: Element | null, value: string): void {
    if (element) element.textContent = value;
  }

  private updateProgressBar(): void {
    const progressEl = document.getElementById(`quiz-progress-${this.quizId}`);
    const fill = progressEl?.querySelector('.progress-fill') as HTMLElement | null;
    if (!fill) return;

    const confirmed = this.countConfirmed();
    const pct = this.questions.length > 0 ? Math.round((confirmed / this.questions.length) * 100) : 0;
    fill.style.width = `${pct}%`;
    fill.classList.toggle('progress-fill--complete', confirmed === this.questions.length);
  }

  private applyOptionStates(questionId: number): void {
    const question = this.questions.find(candidate => candidate.id === questionId);
    if (!question) return;

    const confirmed = this.confirmed[questionId] === true;
    const selected = this.answers[questionId] ?? null;

    question.options.forEach((_, optionIndex) => {
      const btn = document.getElementById(`option-${this.quizId}-${questionId}-${optionIndex}`) as HTMLButtonElement | null;
      if (!btn) return;

      btn.classList.remove('option-btn--selected', 'option-btn--correct', 'option-btn--incorrect', 'option-btn--dimmed');
      btn.disabled = confirmed;

      if (confirmed) {
        this.setConfirmedOptionStyles(btn, optionIndex, question.answerIndex, selected);
      } else if (optionIndex === selected) {
        btn.classList.add('option-btn--selected');
      }
    });
  }

  private setConfirmedOptionStyles(
    btn: HTMLButtonElement,
    optionIndex: number,
    answerIndex: number,
    selected: number | null
  ): void {
    if (optionIndex === answerIndex) btn.classList.add('option-btn--correct');
    else if (optionIndex === selected) btn.classList.add('option-btn--incorrect');
    else btn.classList.add('option-btn--dimmed');
  }

  private applyCardState(questionId: number): void {
    const card = document.getElementById(`question-${this.quizId}-${questionId}`);
    if (!card) return;
    card.classList.remove('question-card--correct', 'question-card--incorrect');
    if (this.confirmed[questionId] === true) {
      const correct = this.isCorrect(questionId, this.answers[questionId]);
      card.classList.add(correct ? 'question-card--correct' : 'question-card--incorrect');
    }
  }

  private applyResultBanner(questionId: number): void {
    const resultEl = document.getElementById(`result-${this.quizId}-${questionId}`);
    if (!resultEl) return;

    const correctBanner = resultEl.querySelector('[data-banner-type="correct"]') as HTMLElement | null;
    const incorrectBanner = resultEl.querySelector('[data-banner-type="incorrect"]') as HTMLElement | null;
    if (correctBanner) correctBanner.style.display = 'none';
    if (incorrectBanner) incorrectBanner.style.display = 'none';

    if (this.confirmed[questionId] !== true) return;
    const correct = this.isCorrect(questionId, this.answers[questionId]);
    const activeBanner = correct ? correctBanner : incorrectBanner;
    if (activeBanner) activeBanner.style.display = 'flex';
  }

  private refreshQuestion(questionId: number): void {
    this.applyOptionStates(questionId);
    this.applyCardState(questionId);
    this.applyResultBanner(questionId);
  }

  private refreshGlobalUi(): void {
    this.updateBanner();
    this.updateProgressBar();
    this.updateRetryVisibility();
  }

  private confirmAnswer(questionId: number, optionIndex: number): void {
    this.answers[questionId] = optionIndex;
    this.confirmed[questionId] = true;
    this.persistToStorage();
    this.refreshQuestion(questionId);
    this.refreshGlobalUi();
    this.showCompletionIfDone();
  }

  private revealAll(): void {
    this.questions.forEach(question => {
      if (!this.confirmed[question.id]) {
        this.confirmed[question.id] = true;
        if (this.answers[question.id] === undefined) {
          this.answers[question.id] = null;
        }
      }
      this.refreshQuestion(question.id);
    });
    this.persistToStorage();
    this.refreshGlobalUi();
    this.showCompletionIfDone();
  }

  private retryQuiz(): void {
    this.archiveCurrentRun();
    this.state.current = { answers: {}, confirmed: {} };
    this.persistToStorage();
    this.questions.forEach(question => this.refreshQuestion(question.id));
    this.refreshGlobalUi();
    this.hideCompletion();
  }

  private archiveCurrentRun(): void {
    if (!this.isCompleted()) return;
    this.state.history.push({
      completedAt: Date.now(),
      score: this.countScore(),
      total: this.questions.length,
    });
  }

  private showCompletionIfDone(): void {
    if (!this.isCompleted()) return;
    this.toggleCompletion(true);
    this.updateCompletionSummary();
    this.renderRunHistory();
  }

  private hideCompletion(): void {
    this.toggleCompletion(false);
  }

  private toggleCompletion(completed: boolean): void {
    const wrapper = document.getElementById(`completion-wrapper-${this.quizId}`);
    if (wrapper) wrapper.style.display = completed ? '' : 'none';
    this.forEachAction('reveal', btn => (btn.style.display = completed ? 'none' : ''));
  }

  private updateRetryVisibility(): void {
    const hasProgress = this.countConfirmed() > 0;
    this.forEachAction('retry-request', btn => {
      if (btn.dataset.scope === 'toolbar') btn.style.display = hasProgress ? '' : 'none';
    });
  }

  private updateCompletionSummary(): void {
    const score = this.countScore();
    this.setText(document.querySelector(`#completion-${this.quizId} [data-final-score]`), String(score));
    this.setText(document.querySelector(`#completion-${this.quizId} [data-final-pct]`), `${this.percentageOf(score)}%`);
  }

  private comparableRuns(): RunView[] {
    const runs: RunView[] = this.state.history.map((run, index) => ({
      label: `Intento ${index + 1}`,
      when: this.formatDate(run.completedAt),
      score: run.score,
      total: run.total,
      isCurrent: false,
    }));

    if (this.isCompleted()) {
      runs.push({
        label: `Intento ${runs.length + 1}`,
        when: 'Actual',
        score: this.countScore(),
        total: this.questions.length,
        isCurrent: true,
      });
    }
    return runs;
  }

  private formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private renderRunHistory(): void {
    const wrapper = document.getElementById(`run-history-${this.quizId}`);
    const body = document.getElementById(`run-history-body-${this.quizId}`);
    if (!wrapper || !body) return;

    const runs = this.comparableRuns();
    if (runs.length < 2) {
      wrapper.style.display = 'none';
      return;
    }

    const bestScore = Math.max(...runs.map(run => run.score));
    wrapper.style.display = '';
    body.innerHTML = runs.map(run => this.runRowHtml(run, bestScore)).join('');
  }

  private runRowHtml(run: RunView, bestScore: number): string {
    const isBest = run.score === bestScore;
    const rowClass = run.isCurrent ? 'run-history__row run-history__row--current' : 'run-history__row';
    const bestBadge = isBest ? '<span class="run-history__best">Mejor</span>' : '';
    return `
      <tr class="${rowClass}">
        <th scope="row">${run.label}${bestBadge}</th>
        <td>${run.when}</td>
        <td>${run.score} / ${run.total}</td>
        <td class="run-history__pct">${this.percentageOf(run.score)}%</td>
      </tr>`;
  }

  private forEachAction(action: string, apply: (btn: HTMLElement) => void): void {
    this.island?.querySelectorAll<HTMLElement>(`[data-action="${action}"]`).forEach(apply);
  }

  private toggleRetryDialog(open: boolean): void {
    const dialog = document.getElementById(`retry-dialog-${this.quizId}`);
    dialog?.classList.toggle('dialog--open', open);
  }

  private attachEventListeners(): void {
    if (!this.island) return;
    this.island.addEventListener('click', event => this.handleIslandClick(event));
  }

  private handleIslandClick(event: Event): void {
    const target = event.target as HTMLElement;

    const option = target.closest('[data-option-index]') as HTMLButtonElement | null;
    if (option && !option.disabled) {
      this.confirmAnswer(Number(option.dataset.questionId), Number(option.dataset.optionIndex));
      return;
    }

    const actionEl = target.closest('[data-action]') as HTMLElement | null;
    if (actionEl) this.runAction(actionEl.dataset.action);
  }

  private runAction(action: string | undefined): void {
    switch (action) {
      case 'reveal':
        this.revealAll();
        break;
      case 'retry-request':
        this.toggleRetryDialog(true);
        break;
      case 'retry-confirm':
        this.toggleRetryDialog(false);
        this.retryQuiz();
        break;
      case 'retry-cancel':
        this.toggleRetryDialog(false);
        break;
    }
  }
}
