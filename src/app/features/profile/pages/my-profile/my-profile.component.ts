import { Component, ChangeDetectionStrategy, signal, inject, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppStateService } from '../../../../core/services/app-state.service';
import { UserAuthService } from '../../../../core/services/user-auth.service';

@Component({
  selector: 'app-my-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './my-profile.component.html',
  styleUrl: './my-profile.component.scss',
})
export class MyProfileComponent implements OnInit {
  private readonly appState = inject(AppStateService);
  private readonly userAuth = inject(UserAuthService);

  /** authGuard only checks the token, not that /me has resolved — self-heal rather than crash if this is somehow null. */
  readonly me = computed(() => this.appState.user());
  readonly loadError = signal('');

  readonly initials = computed(() => {
    const fullName = this.me()?.fullName ?? '';
    const [first, last] = fullName.split(' ');
    return ((first?.[0] ?? '') + (last?.[0] ?? '')).toUpperCase() || '?';
  });

  ngOnInit(): void {
    if (!this.me()) {
      this.userAuth.getMe().subscribe({
        error: (err) => this.loadError.set(err?.error?.message ?? 'Could not load your profile. Please try logging in again.'),
      });
    }
  }

  activeTab   = signal<'profile' | 'security' | 'preferences'>('profile');
  editMode    = signal(false);
  saving      = signal(false);
  saved       = signal(false);
  profileError = signal('');

  // GET /api/users/auth/me doesn't echo phone/address back, so these start
  // empty until the employee sets them here — not a bug, the API just
  // doesn't return what it doesn't store as profile-readable fields yet.
  phone   = signal('');
  address = signal('');

  // Preferences — no backend endpoint for any of this; kept as local-only UI.
  theme         = signal<'light' | 'dark' | 'system'>('light');
  language      = signal('en');
  notifyEmail   = signal(true);
  notifyPush    = signal(true);
  notifySms     = signal(false);

  // Security
  currentPw   = signal('');
  newPw       = signal('');
  confirmPw   = signal('');
  pwError     = signal('');
  pwSaving    = signal(false);
  pwSaved     = signal(false);
  showPw      = signal(false);

  saveProfile(): void {
    if (this.saving()) return;
    this.profileError.set('');
    this.saving.set(true);

    this.userAuth.updateMe({
      phone: this.phone() || undefined,
      address: this.address() || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(true);
        this.editMode.set(false);
        setTimeout(() => this.saved.set(false), 2000);
      },
      error: (err) => {
        this.saving.set(false);
        this.profileError.set(err?.error?.message ?? 'Could not save changes. Please try again.');
      },
    });
  }

  savePassword(): void {
    this.pwError.set('');
    if (this.pwSaving()) return;
    if (!this.currentPw()) { this.pwError.set('Current password is required'); return; }
    if (this.newPw().length < 8) { this.pwError.set('New password must be at least 8 characters'); return; }
    if (this.newPw() !== this.confirmPw()) { this.pwError.set('Passwords do not match'); return; }

    this.pwSaving.set(true);
    this.userAuth.changePassword({
      currentPassword: this.currentPw(),
      newPassword: this.newPw(),
    }).subscribe({
      next: () => {
        this.pwSaving.set(false);
        this.pwSaved.set(true);
        this.currentPw.set(''); this.newPw.set(''); this.confirmPw.set('');
        setTimeout(() => this.pwSaved.set(false), 2500);
      },
      error: (err) => {
        this.pwSaving.set(false);
        this.pwError.set(err?.error?.message ?? 'Could not change password. Please check your current password.');
      },
    });
  }

  pwHasUpper()   { return /[A-Z]/.test(this.newPw()); }
  pwHasNumber()  { return /[0-9]/.test(this.newPw()); }
  pwHasSpecial() { return /[^A-Za-z0-9]/.test(this.newPw()); }

  // Static demo content — no activity-feed endpoint exists in the API yet.
  readonly recentActivity = [
    { action: 'Approved leave request',    time: '2 hours ago',  icon: '✅' },
    { action: 'Added employee Sakshi M',   time: '1 day ago',    icon: '👤' },
    { action: 'Sent Q2 performance review',time: '3 days ago',   icon: '📊' },
    { action: 'Updated attendance policy', time: '5 days ago',   icon: '⚙️' },
    { action: 'Generated payroll report',  time: '1 week ago',   icon: '📄' },
  ];
}
