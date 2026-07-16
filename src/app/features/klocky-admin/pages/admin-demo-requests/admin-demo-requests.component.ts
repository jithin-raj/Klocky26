import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DemoRequest } from '../../models/demo-request.model';
import { UiSelectComponent } from '../../../../shared/components';
import { LocalizationService } from '../../../../core/services/localization.service';

const MOCK_REQUESTS: DemoRequest[] = [
  { id: '1',  fullName: 'Priya Sharma',      workEmail: 'priya@teksolve.in',      phone: '+91 98700 11222', companyName: 'TekSolve India',       teamSize: '51 – 200',   message: 'Looking for geo-fenced attendance with payroll export.',              submittedAt: '2026-04-27T09:14:00Z', status: 'new'       },
  { id: '2',  fullName: 'James Mitchell',    workEmail: 'j.mitchell@nexgen.io',   phone: '+1 415 555 0182', companyName: 'NexGen Solutions',     teamSize: '201 – 500',  message: '',                                                                    submittedAt: '2026-04-26T16:42:00Z', status: 'contacted' },
  { id: '3',  fullName: 'Ananya Krishnan',   workEmail: 'ananya@brighthr.co',     phone: '+91 99001 34567', companyName: 'BrightHR',             teamSize: '11 – 50',    message: 'We need multi-shift scheduling and leave automation.',                submittedAt: '2026-04-25T11:05:00Z', status: 'scheduled' },
  { id: '4',  fullName: 'Carlos Rivera',     workEmail: 'carlos@omnycorp.com',    phone: '+52 55 1234 5678',companyName: 'OmnyCorp',             teamSize: '1000+',      message: 'Enterprise-wide rollout, need white-label options.',                  submittedAt: '2026-04-24T08:30:00Z', status: 'completed' },
  { id: '5',  fullName: 'Sophie Laurent',    workEmail: 'sophie@atelier.fr',      phone: '+33 6 12 34 56 78',companyName: 'Atelier Creative',    teamSize: '1 – 10',     message: '',                                                                    submittedAt: '2026-04-23T14:20:00Z', status: 'declined'  },
  { id: '6',  fullName: 'Rahul Mehta',       workEmail: 'rahul@infrabuild.com',   phone: '+91 97654 32100', companyName: 'InfraBuild Ltd',       teamSize: '201 – 500',  message: 'Construction industry — need site check-in with GPS.',                submittedAt: '2026-04-22T10:00:00Z', status: 'contacted' },
  { id: '7',  fullName: 'Emily Chen',        workEmail: 'e.chen@stellartech.sg',  phone: '+65 9123 4567',   companyName: 'Stellar Tech',         teamSize: '51 – 200',   message: 'Interested in API integration with our existing HRMS.',              submittedAt: '2026-04-21T13:45:00Z', status: 'scheduled' },
  { id: '8',  fullName: 'David Okonkwo',     workEmail: 'david@rapidlogix.ng',    phone: '+234 803 456 7890',companyName: 'RapidLogix',          teamSize: '11 – 50',    message: '',                                                                    submittedAt: '2026-04-19T09:55:00Z', status: 'new'       },
  { id: '9',  fullName: 'Megha Joshi',       workEmail: 'megha@claritypharma.in', phone: '+91 88001 22334', companyName: 'Clarity Pharmaceuticals', teamSize: '501 – 1000', message: 'Need compliance-ready attendance for pharma shift workers.',        submittedAt: '2026-04-18T07:30:00Z', status: 'completed' },
  { id: '10', fullName: 'Tom Brecker',       workEmail: 'tbrecker@vaultfin.com',  phone: '+1 212 555 0199', companyName: 'Vault Financial',      teamSize: '201 – 500',  message: 'We\'d like to see dashboards and reporting in detail.',              submittedAt: '2026-04-15T11:15:00Z', status: 'new'       },
];

export type DemoStatus = DemoRequest['status'];

const STATUS_ORDER: DemoStatus[] = ['new', 'contacted', 'scheduled', 'completed', 'declined'];

@Component({
  selector: 'klocky-admin-demo-requests',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiSelectComponent],
  templateUrl: './admin-demo-requests.component.html',
  styleUrl: './admin-demo-requests.component.scss',
})
export class AdminDemoRequestsComponent {
  private readonly loc = inject(LocalizationService);

  readonly requests = signal<DemoRequest[]>(MOCK_REQUESTS);

  readonly search       = signal('');
  readonly statusFilter = signal<'all' | DemoStatus>('all');
  readonly selected     = signal<DemoRequest | null>(null);

  readonly statuses = STATUS_ORDER;

  readonly statusFilterOptions = computed(() => [
    { label: 'All statuses', value: 'all' },
    ...this.statuses.map(s => ({ label: this.statusLabel(s), value: s })),
  ]);

  readonly statusOptions = this.statuses.map(s => ({ label: this.statusLabel(s), value: s }));

  // ── Stats ─────────────────────────────────────────────────────
  readonly totalReqs      = computed(() => this.requests().length);
  readonly newReqs        = computed(() => this.requests().filter(r => r.status === 'new').length);
  readonly scheduledReqs  = computed(() => this.requests().filter(r => r.status === 'scheduled').length);
  readonly completedReqs  = computed(() => this.requests().filter(r => r.status === 'completed').length);

  // ── Filtered ──────────────────────────────────────────────────
  readonly filtered = computed(() => {
    const q = this.search().toLowerCase();
    const s = this.statusFilter();
    return this.requests()
      .filter(r => {
        const matchQ = !q || r.fullName.toLowerCase().includes(q)
                          || r.workEmail.toLowerCase().includes(q)
                          || r.companyName.toLowerCase().includes(q);
        const matchS = s === 'all' || r.status === s;
        return matchQ && matchS;
      })
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  });

  // ── Actions ───────────────────────────────────────────────────
  view(req: DemoRequest): void { this.selected.set(req); }
  close(): void                { this.selected.set(null); }

  setStatus(req: DemoRequest, status: DemoStatus): void {
    this.requests.update(list => list.map(r => r.id === req.id ? { ...r, status } : r));
    if (this.selected()?.id === req.id) {
      this.selected.set(this.requests().find(r => r.id === req.id) ?? null);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────
  onSearch(e: Event): void          { this.search.set((e.target as HTMLInputElement).value); }
  onStatusFilter(value: string): void { this.statusFilter.set(value as any); }

  statusLabel(s: DemoStatus): string {
    return { new: 'New', contacted: 'Contacted', scheduled: 'Scheduled', completed: 'Completed', declined: 'Declined' }[s];
  }

  formatDate(iso: string): string {
    return this.loc.formatDate(iso);
  }

  formatTime(iso: string): string {
    return this.loc.formatTime(iso);
  }
}
