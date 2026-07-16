import { Pipe, PipeTransform, inject } from '@angular/core';
import { LocalizationService } from '../../core/services/localization.service';

// ─────────────────────────────────────────────────────────────────────────────
// Localization pipes — thin wrappers over LocalizationService so templates
// don't need to inject the service directly. Impure (not `pure: true`)
// because the output depends on LocalizationService's signals (org settings),
// not just the piped value — a pure pipe would miss updates when an admin
// changes the org's date/time/currency format without the underlying dates
// themselves changing.
//
// Usage: {{ row.createdAt | orgDate }}  {{ row.clockInAt | orgTime }}
//        {{ row.updatedAt | orgDateTime }}  {{ amount | orgCurrency }}
// ─────────────────────────────────────────────────────────────────────────────

@Pipe({ name: 'orgDate', standalone: true, pure: false })
export class OrgDatePipe implements PipeTransform {
  private readonly loc = inject(LocalizationService);
  transform(value: string | Date | null | undefined): string {
    return this.loc.formatDate(value);
  }
}

@Pipe({ name: 'orgDateOnly', standalone: true, pure: false })
export class OrgDateOnlyPipe implements PipeTransform {
  private readonly loc = inject(LocalizationService);
  transform(value: string | Date | null | undefined): string {
    return this.loc.formatDateOnly(value);
  }
}

@Pipe({ name: 'orgTime', standalone: true, pure: false })
export class OrgTimePipe implements PipeTransform {
  private readonly loc = inject(LocalizationService);
  transform(value: string | Date | null | undefined): string {
    return this.loc.formatTime(value);
  }
}

@Pipe({ name: 'orgTimeString', standalone: true, pure: false })
export class OrgTimeStringPipe implements PipeTransform {
  private readonly loc = inject(LocalizationService);
  transform(value: string | null | undefined): string {
    return this.loc.formatTimeString(value);
  }
}

@Pipe({ name: 'orgDateTime', standalone: true, pure: false })
export class OrgDateTimePipe implements PipeTransform {
  private readonly loc = inject(LocalizationService);
  transform(value: string | Date | null | undefined): string {
    return this.loc.formatDateTime(value);
  }
}

@Pipe({ name: 'orgCurrency', standalone: true, pure: false })
export class OrgCurrencyPipe implements PipeTransform {
  private readonly loc = inject(LocalizationService);
  transform(value: number | null | undefined, maximumFractionDigits?: number): string {
    if (value == null) return '—';
    return this.loc.formatCurrency(value, { maximumFractionDigits });
  }
}
