const VISIBLE_CLASS = 'scroll-top--visible';
const MIN_DISTANCE_FROM_TOP = 600;

export class ScrollToTopController {
  private readonly button: HTMLElement | null;
  private lastScrollY = 0;

  constructor(buttonId: string) {
    this.button = document.getElementById(buttonId);
  }

  public init(): void {
    if (!this.button) return;
    this.lastScrollY = window.scrollY;
    window.addEventListener('scroll', () => this.onScroll(), { passive: true });
    this.button.addEventListener('click', () => this.scrollToTop());
  }

  private onScroll(): void {
    const currentY = window.scrollY;
    const scrollingUp = currentY < this.lastScrollY;
    const farFromTop = currentY > MIN_DISTANCE_FROM_TOP;
    this.setVisible(scrollingUp && farFromTop);
    this.lastScrollY = currentY;
  }

  private setVisible(visible: boolean): void {
    this.button?.classList.toggle(VISIBLE_CLASS, visible);
  }

  private scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
