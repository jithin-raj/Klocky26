import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PayrollService } from '../../../../core/services/payroll.service';
import { OrgNavigationService } from '../../../../core/services/org-navigation.service';
import { PayslipDto, PayslipLineType } from '../../../../core/models/payroll.model';

@Component({
  selector: 'app-my-payslips',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './my-payslips.component.html',
  styleUrl: './my-payslips.component.scss',
})
export class MyPayslipsComponent implements OnInit {
  private readonly payrollSvc = inject(PayrollService);
  private readonly orgNav = inject(OrgNavigationService);

  payslips = signal<PayslipDto[]>([]);
  loading = signal(true);
  selected = signal<PayslipDto | null>(null);

  readonly monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  readonly earningLines = computed(() => this.linesOf('earning'));
  readonly deductionLines = computed(() => this.linesOf('deduction'));
  readonly employerLines = computed(() => this.linesOf('employer'));

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

  open(p: PayslipDto): void {
    this.selected.set(p);
  }

  closeDetail(): void {
    this.selected.set(null);
  }

  monthLabel(p: PayslipDto): string {
    return `${this.monthNames[p.month - 1]} ${p.year}`;
  }

  private linesOf(type: PayslipLineType) {
    const p = this.selected();
    if (!p) return [];
    return p.lines.filter(l => l.type === type).sort((a, b) => a.sortOrder - b.sortOrder);
  }
}
