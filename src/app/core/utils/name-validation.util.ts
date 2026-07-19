// ─────────────────────────────────────────────────────────────────────────────
// Shared "name" field validation — org name, display name, legal name,
// employee first/last name, department/office/leave-type name, etc.
//
// Rule: letters, numbers and single spaces only. No special characters
// (no punctuation, no symbols, no leading/trailing/double spaces).
// One regex, reused everywhere a name-shaped field needs validating —
// keep this the single source of truth rather than inlining copies.
// ─────────────────────────────────────────────────────────────────────────────

import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Alphanumeric words separated by single spaces — no other characters allowed. */
export const NAME_PATTERN = /^[a-zA-Z0-9]+(?: [a-zA-Z0-9]+)*$/;

export const NAME_VALIDATION_MESSAGE = 'Only letters, numbers and spaces are allowed — no special characters.';

/** Plain-JS check for manual/signal-based form validation (e.g. a hand-written validate() method). */
export function isValidName(value: string | null | undefined): boolean {
  if (!value) return false;
  return NAME_PATTERN.test(value.trim());
}

/** Reactive Forms validator — pairs with Validators.required, doesn't itself reject empty values. */
export function nameFormatValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value) return null;
    return NAME_PATTERN.test(String(value).trim()) ? null : { nameFormat: true };
  };
}
