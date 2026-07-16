import {
  Component, ChangeDetectionStrategy, signal, inject, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { RecruitmentService } from '../../../../core/services/recruitment.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { LocalizationService } from '../../../../core/services/localization.service';
import { Referral } from '../../../../core/models/recruitment.model';

@Component({
  selector: 'app-referrals',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule],
  templateUrl: './referrals.component.html',
  styleUrl: './referrals.component.scss',
})
export class ReferralsComponent implements OnInit {

  private readonly svc   = inject(RecruitmentService);
  private readonly toast = inject(ToastService);
  private readonly loc   = inject(LocalizationService);

  referrals = signal<Referral[]>([]);
  loading   = signal(true);

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.getMyReferrals().subscribe({
      next: (list) => { this.referrals.set(list); this.loading.set(false); },
      error: ()     => { this.loading.set(false); this.toast.error('Failed to load referrals'); },
    });
  }

  formatDate(iso?: string): string {
    if (!iso) return '—';
    return this.loc.formatDateOnly(iso);
  }

  statusClass(s?: string): string {
    switch (s?.toLowerCase()) {
      case 'hired':    return 'status-hired';
      case 'rejected': return 'status-rejected';
      case 'pending':  return 'status-pending';
      default:         return 'status-default';
    }
  }
}
