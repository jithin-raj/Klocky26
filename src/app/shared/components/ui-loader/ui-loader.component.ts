import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { NgIf, NgTemplateOutlet } from '@angular/common';

export type LoaderVariant = 'klocky' | 'spinner' | 'dots' | 'bar' | 'pulse';

@Component({
  selector: 'ui-loader',
  standalone: true,
  imports: [NgIf, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Full-page overlay loader -->
    <div class="ui-loader-overlay" *ngIf="overlay">
      <div class="overlay-backdrop"></div>
      <div class="overlay-content">
        <ng-container [ngTemplateOutlet]="loaderTpl"></ng-container>
        <span class="loader-text" *ngIf="text">{{ text }}</span>
      </div>
    </div>

    <!-- Inline loader -->
    <div class="ui-loader-inline" *ngIf="!overlay">
      <ng-container [ngTemplateOutlet]="loaderTpl"></ng-container>
      <span class="loader-text" *ngIf="text">{{ text }}</span>
    </div>

    <!-- Shared loader shapes -->
    <ng-template #loaderTpl>

      <!-- ── Klock logo loader (default) — animated brand gif ── -->
      <div *ngIf="variant === 'klocky'" class="klocky-loader"
           [style.width.px]="sz" [style.height.px]="sz">
        <img src="/klock-loader-lg.gif" alt="Loading" class="klocky-logo-img"
             [style.width.px]="sz" [style.height.px]="sz"/>
      </div>
      <svg *ngIf="variant === 'spinner'" class="spinner" [attr.width]="size" [attr.height]="size"
           viewBox="0 0 50 50">
        <circle class="track" cx="25" cy="25" r="20" fill="none" stroke-width="4"/>
        <circle class="arc" cx="25" cy="25" r="20" fill="none" stroke-width="4"
                stroke-linecap="round"/>
      </svg>

      <!-- Dots -->
      <div *ngIf="variant === 'dots'" class="dots">
        <span></span><span></span><span></span>
      </div>

      <!-- Bar -->
      <div *ngIf="variant === 'bar'" class="bar-wrap">
        <div class="bar-track">
          <div class="bar-fill"></div>
        </div>
      </div>

      <!-- Pulse -->
      <div *ngIf="variant === 'pulse'" class="pulse"></div>
    </ng-template>
  `,
  styles: [`
    /* ── Overlay ── */
    .ui-loader-overlay {
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
    }
    .overlay-backdrop {
      position: absolute; inset: 0; background: rgba(255,255,255,.7);
      backdrop-filter: blur(3px);
    }
    .overlay-content {
      position: relative; display: flex; flex-direction: column;
      align-items: center; gap: 12px;
    }

    /* ── Inline ── */
    .ui-loader-inline {
      display: inline-flex; align-items: center; gap: 10px;
    }
    .loader-text { font-size: 13px; color: #6b7280; }

    /* ── Spinner ── */
    .spinner { animation: rotate 1s linear infinite; }
    .track { stroke: #e5e7eb; }
    .arc {
      stroke: #4f46e5;
      stroke-dasharray: 80;
      stroke-dashoffset: 60;
    }
    @keyframes rotate { to { transform: rotate(360deg); } }

    /* ── Dots ── */
    .dots { display: flex; gap: 6px; align-items: center; }
    .dots span {
      display: block; width: 10px; height: 10px; border-radius: 50%;
      background: #4f46e5;
      animation: dot-bounce .9s ease-in-out infinite;
    }
    .dots span:nth-child(2) { animation-delay: .15s; }
    .dots span:nth-child(3) { animation-delay: .3s; }
    @keyframes dot-bounce {
      0%, 80%, 100% { transform: scale(.6); opacity: .5; }
      40%           { transform: scale(1);  opacity: 1; }
    }

    /* ── Bar ── */
    .bar-wrap { width: 160px; }
    .bar-track {
      height: 4px; background: #e5e7eb; border-radius: 4px; overflow: hidden;
    }
    .bar-fill {
      height: 100%; width: 40%; background: linear-gradient(90deg,#4f46e5,#7c3aed);
      border-radius: 4px; animation: slide 1.2s ease-in-out infinite;
    }
    @keyframes slide {
      0%   { transform: translateX(-100%); }
      100% { transform: translateX(350%); }
    }

    /* ── Pulse ── */
    .pulse {
      width: 40px; height: 40px; border-radius: 50%;
      background: #4f46e5; opacity: .7;
      animation: pulse-anim 1.2s ease-out infinite;
    }
    @keyframes pulse-anim {
      0%   { transform: scale(.8); opacity: .8; }
      70%  { transform: scale(1.4); opacity: 0; }
      100% { transform: scale(.8); opacity: 0; }
    }

    /* ── Klocky logo loader ── */
    .klocky-loader {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .klocky-logo-img {
      object-fit: contain;
      flex-shrink: 0;
    }
    .klocky-ring {
      position: absolute;
      inset: 0;
      animation: rotate 1.1s linear infinite;
    }
  `],
})
export class UiLoaderComponent {
  @Input() variant: LoaderVariant = 'klocky';
  @Input() size: number | string = 40;
  @Input() text = '';
  @Input() overlay = false;

  get sz(): number {
    return typeof this.size === 'number' ? this.size : parseInt(this.size as string, 10);
  }
}
