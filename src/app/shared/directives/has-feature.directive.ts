import {
  Directive, Input, TemplateRef, ViewContainerRef, inject, effect,
} from '@angular/core';
import { SubscriptionService } from '../../core/services/subscription.service';

// ─────────────────────────────────────────────────────────────────────────────
// *hasFeature — structural directive gated on the org's subscription features.
//
//   <div *hasFeature="'geofencing'">…geofencing settings…</div>
//
// Optional else template renders a "locked / upgrade" state instead of hiding
// (preferred for settings so users still see the feature exists):
//
//   <div *hasFeature="'analytics'; else locked">…</div>
//   <ng-template #locked>… greyed "Upgrade to unlock" …</ng-template>
//
// Reactive: re-evaluates when SubscriptionService.state() changes.
// FE gating is UX only — the server still enforces the feature.
// ─────────────────────────────────────────────────────────────────────────────

@Directive({
  selector: '[hasFeature]',
  standalone: true,
})
export class HasFeatureDirective {
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);
  private readonly subscription = inject(SubscriptionService);

  private key = '';
  private elseTpl: TemplateRef<unknown> | null = null;
  private shown: 'main' | 'else' | null = null;

  constructor() {
    effect(() => {
      this.subscription.state();  // re-run when subscription state changes
      this.update();
    });
  }

  @Input() set hasFeature(code: string) {
    this.key = code;
    this.update();
  }

  @Input() set hasFeatureElse(tpl: TemplateRef<unknown> | null) {
    this.elseTpl = tpl;
    this.shown = null;   // force a re-render into the (possibly new) else template
    this.update();
  }

  private update(): void {
    const allowed = !!this.key && this.subscription.hasFeature(this.key);
    const target: 'main' | 'else' = allowed ? 'main' : 'else';
    if (this.shown === target) return;

    this.vcr.clear();
    if (allowed) {
      this.vcr.createEmbeddedView(this.tpl);
    } else if (this.elseTpl) {
      this.vcr.createEmbeddedView(this.elseTpl);
    }
    this.shown = target;
  }
}
