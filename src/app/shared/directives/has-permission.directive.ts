import {
  Directive, Input, TemplateRef, ViewContainerRef, inject, effect,
} from '@angular/core';
import { PermissionService } from '../../core/services/permission.service';
import { AccessLevel } from '../../core/models/permission.model';

// ─────────────────────────────────────────────────────────────────────────────
// *hasPermission — structural directive, angular-implementation-spec.md §1
//
// Shows the host element only when the current user has at least `minLevel`
// access to a feature key. Re-evaluates reactively when the permission map
// loads/refreshes (PermissionService signals).
//
//   <button *hasPermission="'employees.edit'; minLevel: 2">Edit</button>
//   <a *hasPermission="'employees.delete'; minLevel: 3">Delete permanently</a>
//   <section *hasPermission="'payroll.view'">…</section>   <!-- minLevel defaults to 1 -->
// ─────────────────────────────────────────────────────────────────────────────

@Directive({
  selector: '[hasPermission]',
  standalone: true,
})
export class HasPermissionDirective {
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);
  private readonly permissions = inject(PermissionService);

  private key = '';
  private minLevel: AccessLevel = 1;
  private rendered = false;

  constructor() {
    // Re-evaluate whenever the resolved access map / privilege flags change.
    effect(() => {
      this.permissions.loaded();
      this.permissions.isAdmin();
      this.update();
    });
  }

  @Input() set hasPermission(key: string) {
    this.key = key;
    this.update();
  }

  @Input() set hasPermissionMinLevel(level: AccessLevel) {
    this.minLevel = level;
    this.update();
  }

  private update(): void {
    const allowed = !!this.key && this.permissions.can(this.key, this.minLevel);
    if (allowed && !this.rendered) {
      this.vcr.createEmbeddedView(this.tpl);
      this.rendered = true;
    } else if (!allowed && this.rendered) {
      this.vcr.clear();
      this.rendered = false;
    }
  }
}
