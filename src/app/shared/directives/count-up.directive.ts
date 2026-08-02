import { Directive, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, inject } from '@angular/core';

// ─────────────────────────────────────────────────────────────────────────────
// CountUp — animates a host element's text from its previous number to a new
// one whenever [countUp] changes, instead of the value just popping in.
//
//   <span class="stat-value" [countUp]="presentCount()"></span>
//   <span [countUp]="total" countUpSuffix="%"></span>
//
// Skips the animation (jumps straight to the final value) under
// prefers-reduced-motion.
// ─────────────────────────────────────────────────────────────────────────────

@Directive({
  selector: '[countUp]',
  standalone: true,
})
export class CountUpDirective implements OnChanges, OnDestroy {
  @Input('countUp') value = 0;
  @Input() countUpDuration = 700;
  @Input() countUpSuffix = '';

  private readonly el = inject(ElementRef<HTMLElement>);
  private _raf?: number;
  private _prev = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['value']) return;
    const from = changes['value'].isFirstChange() ? 0 : this._prev;
    const to = this.value || 0;
    this._prev = to;
    this._animate(from, to);
  }

  private _animate(from: number, to: number): void {
    if (this._raf) cancelAnimationFrame(this._raf);
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || from === to) {
      this.el.nativeElement.textContent = `${to}${this.countUpSuffix}`;
      return;
    }
    const duration = this.countUpDuration;
    const start = performance.now();
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const val = Math.round(from + (to - from) * easeOutCubic(t));
      this.el.nativeElement.textContent = `${val}${this.countUpSuffix}`;
      if (t < 1) this._raf = requestAnimationFrame(step);
    };
    this._raf = requestAnimationFrame(step);
  }

  ngOnDestroy(): void {
    if (this._raf) cancelAnimationFrame(this._raf);
  }
}
