import { Injectable, signal } from '@angular/core';

export interface UpgradePromptState {
  /** 'feature' = a premium feature toggle; 'seats' = employee/seat cap reached. */
  mode: 'feature' | 'seats';
  /** Feature code the user tried to enable (mode === 'feature'). */
  feature?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// UpgradePromptService — signal-driven, app-root mounted (like the toast/modal
// outlets). Any gated action can surface the "subscribe to unlock" prompt
// without wiring the modal component itself.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class UpgradePromptService {
  readonly state = signal<UpgradePromptState | null>(null);

  /** Premium feature the user tried to enable. */
  open(feature: string): void {
    this.state.set({ mode: 'feature', feature });
  }

  /** Employee/seat cap reached — upgrade or add seats. */
  openSeatLimit(): void {
    this.state.set({ mode: 'seats' });
  }

  close(): void {
    this.state.set(null);
  }
}
