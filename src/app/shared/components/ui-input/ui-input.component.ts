import {
  Component, Input, forwardRef, ChangeDetectionStrategy, ChangeDetectorRef, inject
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';

@Component({
  selector: 'ui-input',
  standalone: true,
  imports: [NgIf, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => UiInputComponent),
    multi: true,
  }],
  template: `
    <div class="ui-field" [class.has-error]="error">
      <label *ngIf="label" class="ui-label">{{ label }}
        <span class="required" *ngIf="required">*</span>
      </label>
      <div class="ui-input-wrap" [class.disabled]="disabled">
        <ng-content select="[prefix]"></ng-content>
        <input
          class="ui-input"
          [type]="type"
          [placeholder]="placeholder"
          [disabled]="disabled"
          [attr.maxlength]="maxlength ?? null"
          [attr.inputmode]="inputmode || null"
          [attr.autocomplete]="autocomplete || null"
          [attr.pattern]="pattern || null"
          [attr.min]="min ?? null"
          [attr.max]="max ?? null"
          [(ngModel)]="value"
          (ngModelChange)="onChange($event)"
          (blur)="onTouched()"
        />
        <ng-content select="[suffix]"></ng-content>
      </div>
      <span class="ui-hint" *ngIf="hint && !error">{{ hint }}</span>
      <span class="ui-error" *ngIf="error">{{ error }}</span>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .ui-field { display: flex; flex-direction: column; gap: 4px; }

    .ui-label {
      font-size: 13px; font-weight: 620; color: #374151;
    }
    .required { color: #ef4444; margin-left: 3px; font-size: 13px; font-weight: 700; position: relative; top: -1px; }

    .ui-input-wrap {
      display: flex; align-items: center;
      border: 1.5px solid #e2e8f0; border-radius: 10px;
      background: #fff; transition: border-color .15s, box-shadow .15s;
      overflow: hidden;
    }
    .ui-input-wrap:focus-within {
      border-color: var(--accent, #4f46e5);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #4f46e5) 12%, transparent);
    }
    .has-error .ui-input-wrap {
      border-color: #ef4444;
    }
    .has-error .ui-input-wrap:focus-within {
      box-shadow: 0 0 0 3px rgba(239, 68, 68, .12);
    }
    .disabled { background: #f9fafb; opacity: .6; pointer-events: none; }

    .ui-input {
      flex: 1; border: none; outline: none; padding: 10px 14px;
      font-size: 14px; color: #1e293b; background: transparent;
      font-family: inherit; min-width: 0;
    }
    .ui-input::placeholder { color: #9ca3af; }

    .ui-hint { font-size: 12px; color: #6b7280; }
    .ui-error { font-size: 12px; color: #ef4444; }

    :host ::ng-deep [prefix], :host ::ng-deep [suffix] {
      display: flex; align-items: center; padding: 0 10px; color: #9ca3af;
    }
  `],
})
export class UiInputComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() type = 'text';
  @Input() placeholder = '';
  @Input() hint = '';
  @Input() error = '';
  @Input() required = false;
  @Input() disabled = false;
  @Input() maxlength: number | null = null;
  @Input() inputmode = '';
  @Input() autocomplete = '';
  @Input() pattern = '';
  @Input() min: number | null = null;
  @Input() max: number | null = null;

  private cdr = inject(ChangeDetectorRef);

  value: any = '';

  onChange = (_: any) => {};
  onTouched = () => {};

  // markForCheck so an externally-corrected value (e.g. a clamped number) re-renders under OnPush.
  writeValue(val: any) { this.value = val ?? ''; this.cdr.markForCheck(); }
  registerOnChange(fn: any) { this.onChange = fn; }
  registerOnTouched(fn: any) { this.onTouched = fn; }
  setDisabledState(d: boolean) { this.disabled = d; this.cdr.markForCheck(); }
}
