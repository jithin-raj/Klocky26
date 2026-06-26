import {
  Component, ChangeDetectionStrategy, inject
} from '@angular/core';
import { NgFor, NgIf, NgClass } from '@angular/common';
import { ToastService, Toast } from './toast.service';

@Component({
  selector: 'ui-toast-container',
  standalone: true,
  imports: [NgFor, NgIf, NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-container">
      <div
        *ngFor="let t of toastService.toasts(); trackBy: trackById"
        class="toast"
        [ngClass]="'toast-' + t.type"
      >
        <!-- Icon -->
        <span class="toast-icon">
          <!-- Success -->
          <svg *ngIf="t.type === 'success'" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
               stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="9 12 11.5 14.5 15 9.5"/>
          </svg>
          <!-- Error -->
          <svg *ngIf="t.type === 'error'" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M15 9l-6 6M9 9l6 6"/>
          </svg>
          <!-- Warning -->
          <svg *ngIf="t.type === 'warning'" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
               stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <!-- Info -->
          <svg *ngIf="t.type === 'info'" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
               stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="8"/>
            <path d="M12 12v5"/>
          </svg>
        </span>

        <!-- Content -->
        <div class="toast-body">
          <p class="toast-title">{{ t.title }}</p>
          <p class="toast-msg" *ngIf="t.message">{{ t.message }}</p>
        </div>

        <!-- Progress bar -->
        <div class="toast-progress" [style.animation-duration]="t.duration + 'ms'"></div>

        <!-- Close -->
        <button class="toast-close" (click)="toastService.remove(t.id)" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed; top: 24px; left: 50%; transform: translateX(-50%);
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      z-index: 10000; pointer-events: none;
    }
    .toast {
      display: flex; align-items: flex-start; gap: 12px;
      min-width: 300px; max-width: 380px;
      background: #fff; border-radius: 12px;
      box-shadow: 0 8px 28px rgba(0,0,0,.14);
      padding: 14px 16px; position: relative; overflow: hidden;
      pointer-events: all;
      animation: slide-in .25s cubic-bezier(.34,1.56,.64,1) both;
      border-left: 4px solid transparent;
    }

    /* Variants */
    .toast-success { border-left-color: #22c55e; }
    .toast-error   { border-left-color: #ef4444; }
    .toast-warning { border-left-color: #f59e0b; }
    .toast-info    { border-left-color: #3b82f6; }

    .toast-icon {
      display: flex; flex-shrink: 0; margin-top: 1px;
    }
    .toast-icon svg { width: 20px; height: 20px; }
    .toast-success .toast-icon { color: #22c55e; }
    .toast-error   .toast-icon { color: #ef4444; }
    .toast-warning .toast-icon { color: #f59e0b; }
    .toast-info    .toast-icon { color: #3b82f6; }

    .toast-body { flex: 1; min-width: 0; }
    .toast-title {
      margin: 0; font-size: 14px; font-weight: 600; color: #111827;
    }
    .toast-msg {
      margin: 2px 0 0; font-size: 12px; color: #6b7280;
      word-break: break-word;
    }

    /* Progress bar */
    .toast-progress {
      position: absolute; bottom: 0; left: 0; height: 3px;
      background: currentColor; opacity: .25;
      width: 100%;
      animation: shrink linear forwards;
    }
    .toast-success .toast-progress { color: #22c55e; }
    .toast-error   .toast-progress { color: #ef4444; }
    .toast-warning .toast-progress { color: #f59e0b; }
    .toast-info    .toast-progress { color: #3b82f6; }

    /* Close */
    .toast-close {
      display: flex; align-items: center; border: none; background: none;
      cursor: pointer; color: #9ca3af; padding: 2px; align-self: flex-start;
      border-radius: 4px; flex-shrink: 0;
    }
    .toast-close:hover { color: #374151; background: #f3f4f6; }

    @keyframes slide-in {
      from { transform: translateY(-18px); opacity: 0; }
      to   { transform: translateY(0);     opacity: 1; }
    }
    @keyframes shrink {
      from { transform: scaleX(1); transform-origin: left; }
      to   { transform: scaleX(0); transform-origin: left; }
    }
  `],
})
export class UiToastContainerComponent {
  toastService = inject(ToastService);
  trackById = (_: number, t: Toast) => t.id;
}
