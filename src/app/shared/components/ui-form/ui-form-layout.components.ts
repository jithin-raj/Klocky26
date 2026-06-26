import { Component, ChangeDetectionStrategy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

// ─────────────────────────────────────────────────────────────────────────────
// Reusable form layout primitives (org-themed). These are presentational only —
// the host owns state/validation. Compose them around the existing ui-* controls
// (ui-input, ui-select, ui-datepicker, ui-toggle, …) for a consistent look.
//
//   <ui-form-section title="Identity" description="Who this person is">
//     <ui-form-grid>
//       <ui-form-field label="First name" [required]="true" [error]="errors.firstName">
//         <ui-input … />
//       </ui-form-field>
//       <ui-form-field label="Notes" [full]="true">…</ui-form-field>
//     </ui-form-grid>
//   </ui-form-section>
// ─────────────────────────────────────────────────────────────────────────────

/** A titled card section grouping related fields. Project `[actions]` for a header-right slot. */
@Component({
  selector: 'ui-form-section',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ufs">
      @if (title || description) {
        <header class="ufs-head">
          <div class="ufs-headings">
            @if (title) { <h3 class="ufs-title">{{ title }}</h3> }
            @if (description) { <p class="ufs-desc">{{ description }}</p> }
          </div>
          <div class="ufs-actions"><ng-content select="[actions]"></ng-content></div>
        </header>
      }
      <div class="ufs-body"><ng-content></ng-content></div>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .ufs {
      border: 1.5px solid #eef1f5; border-radius: 14px;
      background: #fff; padding: 20px 22px; margin-bottom: 18px;
    }
    .ufs-head {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 12px; margin-bottom: 16px;
    }
    .ufs-headings { display: flex; flex-direction: column; gap: 3px; }
    .ufs-title {
      margin: 0; font-size: 14px; font-weight: 700; color: #0f172a;
      letter-spacing: -0.2px;
      position: relative; padding-left: 12px;
    }
    .ufs-title::before {
      content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%);
      width: 4px; height: 15px; border-radius: 3px; background: var(--accent, #6366f1);
    }
    .ufs-desc { margin: 0; font-size: 12.5px; color: #94a3b8; padding-left: 12px; }
    .ufs-actions { flex-shrink: 0; }
    .ufs-body { display: block; }
  `],
})
export class UiFormSectionComponent {
  @Input() title = '';
  @Input() description = '';
}

/** Responsive field grid — defaults to 2 columns, collapses to 1 on narrow screens. */
@Component({
  selector: 'ui-form-grid',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="ufg" [style.--ufg-cols]="columns"><ng-content></ng-content></div>`,
  styles: [`
    :host { display: block; }
    .ufg {
      display: grid;
      grid-template-columns: repeat(var(--ufg-cols, 2), minmax(0, 1fr));
      gap: 16px 18px;
    }
    @media (max-width: 640px) {
      .ufg { grid-template-columns: 1fr; }
    }
  `],
})
export class UiFormGridComponent {
  @Input() columns = 2;
}

/** Field wrapper: consistent label + required mark + hint/error line around any control. */
@Component({
  selector: 'ui-form-field',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="uff" [class.uff--full]="full">
      @if (label) {
        <label class="uff-label" [attr.for]="for || null">
          {{ label }}@if (required) { <span class="uff-req">*</span> }
        </label>
      }
      <div class="uff-control"><ng-content></ng-content></div>
      @if (error) {
        <p class="uff-error">{{ error }}</p>
      } @else if (hint) {
        <p class="uff-hint">{{ hint }}</p>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .uff { display: flex; flex-direction: column; gap: 6px; }
    .uff--full { grid-column: 1 / -1; }
    .uff-label { font-size: 12.5px; font-weight: 600; color: #374151; }
    .uff-req { color: #ef4444; margin-left: 1px; }
    .uff-control { display: block; }
    .uff-hint { margin: 0; font-size: 11.5px; color: #94a3b8; }
    .uff-error { margin: 0; font-size: 11.5px; color: #dc2626; font-weight: 500; }
  `],
})
export class UiFormFieldComponent {
  @Input() label = '';
  @Input() hint = '';
  @Input() error = '';
  @Input() required = false;
  /** Span the full grid width (e.g. for textareas). */
  @Input() full = false;
  /** Optional `for` to associate the label with a control id. */
  @Input() for = '';
}
