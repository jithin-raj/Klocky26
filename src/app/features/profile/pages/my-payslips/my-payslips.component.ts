import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PayrollService } from '../../../../core/services/payroll.service';
import { OrgNavigationService } from '../../../../core/services/org-navigation.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { UiSelectComponent } from '../../../../shared/components/ui-select/ui-select.component';
import { triggerBlobDownload } from '../../../../core/utils/file-download.util';
import { PayslipDto, PayslipLineType, AnnualSummaryDto } from '../../../../core/models/payroll.model';

type View = 'payslips' | 'pay-to-date' | 'annual-summary';

@Component({
  selector: 'app-my-payslips',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiSelectComponent],
  templateUrl: './my-payslips.component.html',
  styleUrl: './my-payslips.component.scss',
})
export class MyPayslipsComponent implements OnInit {
  private readonly payrollSvc = inject(PayrollService);
  private readonly orgNav = inject(OrgNavigationService);
  private readonly toast = inject(ToastService);

  view = signal<View>('payslips');

  payslips = signal<PayslipDto[]>([]);
  loading = signal(true);
  selected = signal<PayslipDto | null>(null);

  readonly monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  readonly earningLines = computed(() => this.linesOf('earning', this.selected()));
  readonly deductionLines = computed(() => this.linesOf('deduction', this.selected()));
  readonly employerLines = computed(() => this.linesOf('employer', this.selected()));

  ngOnInit(): void {
    this.payrollSvc.getMyPayslips().subscribe({
      next: (p) => {
        this.payslips.set([...p].sort((a, b) => b.year - a.year || b.month - a.month));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  back(): void {
    this.orgNav.navigate(['app', 'profile']);
  }

  selectView(v: View): void {
    this.view.set(v);
    if (v === 'pay-to-date' && !this.preview() && !this.previewError()) this.loadPreview();
    if (v === 'annual-summary' && !this.summary()) this.loadSummary();
  }

  open(p: PayslipDto): void {
    this.selected.set(p);
  }

  closeDetail(): void {
    this.selected.set(null);
  }

  monthLabel(p: PayslipDto): string {
    return `${this.monthNames[p.month - 1]} ${p.year}`;
  }

  periodLabel(p: PayslipDto): string {
    if (p.payFrequency === 'weekly' && p.weekStart && p.weekEnd) {
      return `${this.formatShort(p.weekStart)} – ${this.formatShort(p.weekEnd)}`;
    }
    return this.monthLabel(p);
  }

  private formatShort(iso: string): string {
    const d = new Date(iso);
    return `${d.getDate()} ${this.monthNames[d.getMonth()].slice(0, 3)}`;
  }

  private linesOf(type: PayslipLineType, source: PayslipDto | null) {
    if (!source) return [];
    return source.lines.filter(l => l.type === type).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  downloadPayslipPdf(p: PayslipDto): void {
    this.payrollSvc.downloadMyPayslipPdf(p.id).subscribe({
      next: (blob) => triggerBlobDownload(blob, `payslip-${this.periodLabel(p).replace(/\s+/g, '-')}.pdf`),
      error: (err) => {
        if (err?.status === 404) this.toast.error('Not available yet', "This payslip isn't available yet — it may not be published.");
        else this.toast.error('Could not download', 'Please try again.');
      },
    });
  }

  // ── Pay-to-Date (current, still-in-progress period) ─────────────────────
  preview = signal<PayslipDto | null>(null);
  previewLoading = signal(false);
  previewError = signal<string | null>(null);

  readonly previewEarningLines = computed(() => this.linesOf('earning', this.preview()));
  readonly previewDeductionLines = computed(() => this.linesOf('deduction', this.preview()));
  readonly previewEmployerLines = computed(() => this.linesOf('employer', this.preview()));

  loadPreview(): void {
    this.previewLoading.set(true);
    this.previewError.set(null);
    this.payrollSvc.getMyPreview().subscribe({
      next: (p) => { this.preview.set(p); this.previewLoading.set(false); },
      error: (err) => {
        this.previewLoading.set(false);
        this.previewError.set(err?.status === 409
          ? (err?.error?.error ?? 'No salary structure set yet — a preview isn\'t available until one is.')
          : 'Could not load the current-period preview. Please try again.');
      },
    });
  }

  // ── Annual Summary ────────────────────────────────────────────────────────
  summaryYear = signal(new Date().getFullYear());
  summary = signal<AnnualSummaryDto | null>(null);
  summaryLoading = signal(false);
  downloadingSummary = signal(false);

  readonly yearOptions = computed(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => current - i);
  });
  readonly yearSelectOptions = computed(() => this.yearOptions().map(y => ({ label: String(y), value: y })));

  setSummaryYear(y: number): void {
    this.summaryYear.set(y);
    this.loadSummary();
  }

  loadSummary(): void {
    this.summaryLoading.set(true);
    this.payrollSvc.getMyAnnualSummary(this.summaryYear()).subscribe({
      next: (s) => { this.summary.set(s); this.summaryLoading.set(false); },
      error: () => { this.summary.set(null); this.summaryLoading.set(false); },
    });
  }

  downloadSummaryPdf(): void {
    if (this.downloadingSummary()) return;
    this.downloadingSummary.set(true);
    this.payrollSvc.downloadMyAnnualSummaryPdf(this.summaryYear()).subscribe({
      next: (blob) => { this.downloadingSummary.set(false); triggerBlobDownload(blob, `annual-summary-${this.summaryYear()}.pdf`); },
      error: () => { this.downloadingSummary.set(false); this.toast.error('Could not download', 'Please try again.'); },
    });
  }
}
