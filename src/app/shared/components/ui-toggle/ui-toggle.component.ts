import {
  Component, Input, forwardRef, ChangeDetectionStrategy
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NgIf } from '@angular/common';

@Component({
  selector: 'ui-toggle',
  standalone: true,
  imports: [NgIf],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => UiToggleComponent),
    multi: true,
  }],
  template: `
    <label class="ui-toggle-wrap" [class.is-row]="row" [class.disabled]="disabled">
      <div class="toggle-info" *ngIf="row && (label || hint)">
        <span class="toggle-main-label" *ngIf="label">{{ label }}</span>
        <span class="toggle-hint" *ngIf="hint">{{ hint }}</span>
      </div>
      <button
        type="button"
        class="track"
        [class.on]="value"
        [class.size-sm]="size === 'sm'"
        [class.size-lg]="size === 'lg'"
        [disabled]="disabled"
        (click)="flip()"
        [attr.aria-checked]="value"
        role="switch"
      >
        <span class="thumb"></span>
      </button>
      <span class="toggle-label" *ngIf="label && !row">{{ label }}</span>
    </label>
  `,
  styles: [`
    :host { display: block; }

    .ui-toggle-wrap {
      display: inline-flex; align-items: center; gap: 10px;
      cursor: pointer; user-select: none;
    }
    .ui-toggle-wrap.is-row {
      display: flex; align-items: center; justify-content: space-between;
      width: 100%; gap: 16px; padding: 16px 0; cursor: default;
    }
    .ui-toggle-wrap.disabled { opacity: .45; pointer-events: none; }

    .toggle-info { display: flex; flex-direction: column; gap: 3px; }
    .toggle-main-label {
      font-size: 14px; font-weight: 500;
      color: var(--ui-toggle-label, rgba(255,255,255,.88));
    }
    .toggle-hint {
      font-size: 12.5px; line-height: 1.4;
      color: var(--ui-toggle-hint, rgba(255,255,255,.38));
    }

    .track {
      position: relative; display: inline-flex; align-items: center;
      width: 44px; height: 24px; border-radius: 12px;
      border: none; background: var(--ui-toggle-track, rgba(255,255,255,.12)); padding: 0;
      flex-shrink: 0;
      cursor: pointer; transition: background .2s;
    }
    .track.size-sm { width: 34px; height: 18px; border-radius: 9px; }
    .track.size-lg { width: 56px; height: 30px; border-radius: 15px; }

    .track.on { background: var(--accent, #0d9488); }

    .thumb {
      position: absolute; left: 3px;
      width: 18px; height: 18px; border-radius: 50%;
      background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.2);
      transition: transform .2s cubic-bezier(.34,1.56,.64,1);
    }
    .track.size-sm .thumb { width: 12px; height: 12px; }
    .track.size-lg .thumb { width: 24px; height: 24px; }

    .track.on .thumb { transform: translateX(20px); }
    .track.size-sm.on .thumb { transform: translateX(16px); }
    .track.size-lg.on .thumb { transform: translateX(26px); }

    .toggle-label {
      font-size: 14px;
      color: var(--ui-toggle-label, rgba(255,255,255,.75));
    }
  `],
})
export class UiToggleComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() hint = '';
  @Input() row = false;
  @Input() disabled = false;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  value = false;
  onChange = (_: any) => {};
  onTouched = () => {};

  flip() {
    this.value = !this.value;
    this.onChange(this.value);
    this.onTouched();
  }

  writeValue(val: boolean) { this.value = !!val; }
  registerOnChange(fn: any) { this.onChange = fn; }
  registerOnTouched(fn: any) { this.onTouched = fn; }
  setDisabledState(d: boolean) { this.disabled = d; }
}
