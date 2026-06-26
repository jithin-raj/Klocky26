import {
  Component, ChangeDetectionStrategy, inject, Input, Output, EventEmitter
} from '@angular/core';
import { NgIf } from '@angular/common';
import { ModalService } from './modal.service';

/**
 * Two usage modes:
 * 1. Service-driven (confirm dialogs):  <ui-modal-outlet> in app shell
 * 2. Template-driven (custom content):  <ui-modal [open]="true" (closed)="...">
 */
@Component({
  selector: 'ui-modal',
  standalone: true,
  imports: [NgIf],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui-modal-backdrop" *ngIf="open" (click)="onBackdropClick($event)">
      <div [class]="'ui-modal-box modal-size-' + size + (variant === 'danger' ? ' modal-danger' : '')"
           role="dialog"
           aria-modal="true" (click)="$event.stopPropagation()">

        <!-- Header -->
        <div class="modal-header" *ngIf="title">
          <h3 class="modal-title">{{ title }}</h3>
          <button class="modal-close" (click)="closed.emit(false)" type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="modal-body">
          <p class="modal-message" *ngIf="message">{{ message }}</p>
          <ng-content></ng-content>
        </div>

        <!-- Footer -->
        <div class="modal-footer" *ngIf="confirmLabel || cancelLabel">
          <button
            *ngIf="cancelLabel"
            class="modal-btn btn-cancel"
            (click)="closed.emit(false)"
            type="button"
          >{{ cancelLabel }}</button>
          <button
            *ngIf="confirmLabel"
            class="modal-btn btn-confirm"
            [class.btn-danger]="variant === 'danger'"
            (click)="closed.emit(true)"
            type="button"
          >{{ confirmLabel }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ui-modal-backdrop {
      position: fixed; inset: 0; background: rgba(15,23,42,.45);
      backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      z-index: 5000; padding: 20px;
      animation: fade-in .2s ease;
    }
    .ui-modal-box {
      background: #fff; border-radius: 16px; width: 100%; max-width: 480px;
      box-shadow: 0 20px 60px rgba(0,0,0,.18);
      /* NOTE: no 'both' fill-mode — a retained transform (scale 1) would make
         this box a containing block for any position:fixed descendant (e.g. the
         ui-select dropdown panel), shifting/clipping it. Letting the transform
         revert to none after the entrance keeps fixed panels viewport-anchored. */
      animation: scale-in .2s cubic-bezier(.34,1.56,.64,1);
      overflow: hidden;
    }
    /* Size variants */
    .modal-size-sm  { max-width: 360px; }
    .modal-size-md  { max-width: 480px; }
    .modal-size-lg  { max-width: 640px; }
    .modal-size-xl  { max-width: 820px; }
    .modal-size-xxl { max-width: 1040px; }

    /* Header */
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 24px 0;
    }
    .modal-title {
      margin: 0; font-size: 17px; font-weight: 700; color: #111827;
    }
    .modal-close {
      display: flex; border: none; background: none; cursor: pointer;
      color: #9ca3af; padding: 4px; border-radius: 6px;
      transition: background .12s, color .12s;
    }
    .modal-close:hover { background: #f3f4f6; color: #374151; }

    /* Body */
    .modal-body { padding: 16px 24px; }
    .modal-message { margin: 0; font-size: 14px; color: #4b5563; line-height: 1.6; }

    /* Footer */
    .modal-footer {
      display: flex; justify-content: flex-end; gap: 10px;
      padding: 0 24px 20px;
    }
    .modal-btn {
      padding: 9px 20px; border-radius: 9px; border: none;
      font-size: 14px; font-weight: 600; cursor: pointer;
      transition: background .15s, box-shadow .15s;
    }
    .btn-cancel {
      background: #f3f4f6; color: #374151;
    }
    .btn-cancel:hover { background: #e5e7eb; }
    .btn-confirm {
      background: #4f46e5; color: #fff;
      box-shadow: 0 2px 8px rgba(79,70,229,.3);
    }
    .btn-confirm:hover { background: #4338ca; }
    .btn-danger { background: #ef4444 !important; box-shadow: 0 2px 8px rgba(239,68,68,.3) !important; }
    .btn-danger:hover { background: #dc2626 !important; }

    /* Danger modal top strip */
    .modal-danger .modal-header::before {
      content: ''; display: block; height: 4px;
      position: absolute; top: 0; left: 0; right: 0;
      background: #ef4444; border-radius: 16px 16px 0 0;
    }

    @keyframes fade-in {
      from { opacity: 0; } to { opacity: 1; }
    }
    @keyframes scale-in {
      from { transform: scale(.9); opacity: 0; }
      to   { transform: scale(1);  opacity: 1; }
    }
  `],
})
export class UiModalComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() message = '';
  @Input() confirmLabel = '';
  @Input() cancelLabel = '';
  @Input() size: 'sm' | 'md' | 'lg' | 'xl' | 'xxl' = 'md';
  @Input() variant: 'default' | 'danger' = 'default';
  @Input() closeOnBackdrop = true;

  @Output() closed = new EventEmitter<boolean>();

  onBackdropClick(e: MouseEvent) {
    if (this.closeOnBackdrop) this.closed.emit(false);
  }
}

/**
 * Place <ui-modal-outlet> in app shell (shell.component.html) to get
 * service-driven confirm dialogs anywhere via ModalService.
 */
@Component({
  selector: 'ui-modal-outlet',
  standalone: true,
  imports: [UiModalComponent, NgIf],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-modal
      *ngIf="svc.state() as s"
      [open]="true"
      [title]="s.title || 'Confirm'"
      [message]="s.message || ''"
      [confirmLabel]="s.confirmLabel || 'OK'"
      [cancelLabel]="s.cancelLabel || 'Cancel'"
      [size]="s.size || 'md'"
      [variant]="s.variant || 'default'"
      (closed)="svc.close($event)"
    ></ui-modal>
  `,
})
export class UiModalOutletComponent {
  svc = inject(ModalService);
}
