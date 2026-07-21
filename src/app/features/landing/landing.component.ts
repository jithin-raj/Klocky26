import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { OrgThemeService } from '../../core/services/org-theme.service';
import { AppStateService } from '../../core/services/app-state.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent implements OnInit {
  private orgTheme = inject(OrgThemeService);
  private titleSvc = inject(Title);
  private metaSvc = inject(Meta);

  constructor(private router: Router, private appState: AppStateService) {}

  ngOnInit(): void {
    this.orgTheme.reset();
    this.appState.clearState();

    // Reinforce the static index.html tags for search engines/crawlers that
    // read the rendered DOM (Googlebot executes JS) — keeps the title/description
    // targeted at "Klockk HRMS" / "Klockk HCM" style searches.
    this.titleSvc.setTitle('Klockk — HRMS & HCM Software for Small Businesses');
    this.metaSvc.updateTag({
      name: 'description',
      content: 'Klockk is an all-in-one HRMS and HCM platform built for small and growing organisations — real-time clock in/out, geofenced attendance, leave management, employee records, payroll-ready reports and AI-powered HR insights.',
    });
  }

  features = [
    {
      icon: '🕐',
      title: 'Smart Attendance',
      desc: 'GPS-aware clock-in/out, automatic late detection, real-time presence tracking across offices.',
    },
    {
      icon: '🏖️',
      title: 'Leave Management',
      desc: 'Custom leave policies, approval workflows, and balance tracking — all in one place.',
    },
    {
      icon: '👥',
      title: 'Employee Directory',
      desc: 'Org chart, profiles, departments, and role management with fine-grained permissions.',
    },
    {
      icon: '📊',
      title: 'Live Dashboard',
      desc: "Real-time headcount, attendance rings, leave requests, and org-wide activity at a glance.",
    },
    {
      icon: '🌍',
      title: 'Multi-Office Support',
      desc: 'Manage multiple locations with their own timezones, holidays, and attendance policies.',
    },
    {
      icon: '🔔',
      title: 'Smart Notifications',
      desc: 'Instant alerts for approvals, clock-in reminders, anniversaries, and custom events.',
    },
  ];

  stats = [
    { value: '10k+', label: 'Employees managed' },
    { value: '500+', label: 'Organizations' },
    { value: '99.9%', label: 'Uptime SLA' },
    { value: '4.9 ★', label: 'Customer rating' },
  ];

  mobileMenuOpen = signal(false);
  toggleMenu(): void { this.mobileMenuOpen.update(v => !v); }
  closeMenu(): void  { this.mobileMenuOpen.set(false); }

  goLogin()     { this.closeMenu(); this.router.navigate(['/login']); }
  goRegister()  { this.closeMenu(); this.router.navigate(['/register']); }
  goTrial()     { this.closeMenu(); this.router.navigate(['/free-trial']); }
  goDemo()      { this.closeMenu(); this.router.navigate(['/request-demo']); }
  goDashboard() { 
    this.closeMenu(); 
    // Note: This won't work without login - publicGuard will handle redirect
    this.router.navigate(['/login']); 
  }
}
