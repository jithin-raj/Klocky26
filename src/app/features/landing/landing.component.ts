import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { OrgThemeService } from '../../core/services/org-theme.service';
import { AppStateService } from '../../core/services/app-state.service';
import { UiIconComponent, UiIconName } from '../../shared/components';
import { ScrollHeroComponent } from './components/scroll-hero/scroll-hero.component';
import {
  LandingContentService,
  LandingCustomer,
  LandingTestimonial,
  LandingAnnouncement,
} from './landing-content.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiIconComponent, ScrollHeroComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  private orgTheme = inject(OrgThemeService);
  private titleSvc = inject(Title);
  private metaSvc = inject(Meta);
  private host = inject(ElementRef<HTMLElement>);
  private content = inject(LandingContentService);

  constructor(private router: Router, private appState: AppStateService) {}

  // ─── Server-driven content (shown only when real data exists) ────
  // Default announcement communicates the current beta; a server value overrides it.
  announcement = signal<LandingAnnouncement | null>({
    enabled: true,
    text: 'Klockk is in public beta — free while we shape it with early teams.',
    ctaLabel: 'Get early access',
    ctaUrl: '/free-trial',
  });
  customers = signal<LandingCustomer[]>([]);
  serverTestimonials = signal<LandingTestimonial[]>([]);

  ngOnInit(): void {
    this.orgTheme.reset();
    this.appState.clearState();
    this.loadContent();

    // Reinforce the static index.html tags for search engines/crawlers that
    // read the rendered DOM (Googlebot executes JS) — keeps the title/description
    // targeted at "Klockk HRMS" / "Klockk HCM" style searches.
    this.titleSvc.setTitle('Klockk — HRMS & HCM Software for Small Businesses');
    this.metaSvc.updateTag({
      name: 'description',
      content:
        'Klockk is an all-in-one HRMS and HCM platform built for small and growing organisations — real-time clock in/out, geofenced attendance, leave management, employee records, payroll-ready reports and AI-powered HR insights.',
    });

    // Start the live clock used in the hero product preview.
    this.tick();
    this.clockTimer = setInterval(() => this.tick(), 1000);
  }

  // ─── Live clock (hero preview) ───────────────────────────────
  private clockTimer: any = null;
  private now = signal(new Date());
  private tick() { this.now.set(new Date()); }

  clockTime = computed(() => {
    const d = this.now();
    const h = d.getHours() % 12 || 12;
    const m = d.getMinutes().toString().padStart(2, '0');
    const s = d.getSeconds().toString().padStart(2, '0');
    return `${h.toString().padStart(2, '0')}:${m}:${s}`;
  });

  clockMeridiem = computed(() => (this.now().getHours() < 12 ? 'AM' : 'PM'));

  clockDate = computed(() =>
    this.now().toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })
  );

  // ─── Content ─────────────────────────────────────────────────
  features: { key: string; title: string; desc: string; accent: string; tags: string[]; icon: UiIconName }[] = [
    {
      key: 'attendance',
      title: 'Smart Attendance',
      desc: 'GPS-aware clock-in/out, automatic late detection, real-time presence tracking across offices.',
      accent: '#0d9488',
      tags: ['GPS check-in', 'Auto late'],
      icon: 'scan',
    },
    {
      key: 'leave',
      title: 'Leave Management',
      desc: 'Custom leave policies, approval workflows, and balance tracking — all in one place.',
      accent: '#059669',
      tags: ['Policies', 'Approvals'],
      icon: 'tree',
    },
    {
      key: 'directory',
      title: 'Employee Directory',
      desc: 'Org chart, profiles, departments, and role management with fine-grained permissions.',
      accent: '#0891b2',
      tags: ['Org chart', 'Roles'],
      icon: 'users',
    },
    {
      key: 'dashboard',
      title: 'Live Dashboard',
      desc: 'Real-time headcount, attendance rings, leave requests, and org-wide activity at a glance.',
      accent: '#16a34a',
      tags: ['Live', 'Insights'],
      icon: 'bar-chart',
    },
    {
      key: 'offices',
      title: 'Multi-Office Support',
      desc: 'Manage multiple locations with their own timezones, holidays, and attendance policies.',
      accent: '#0f766e',
      tags: ['Timezones', 'Holidays'],
      icon: 'building',
    },
    {
      key: 'notifications',
      title: 'Smart Notifications',
      desc: 'Instant alerts for approvals, clock-in reminders, anniversaries, and custom events.',
      accent: '#0284c7',
      tags: ['Realtime', 'Custom'],
      icon: 'bell',
    },
  ];

  // KPI tiles in the hero dashboard preview.
  kpis = [
    { label: 'Present', value: '92%', trend: '+4%', tone: 'teal', up: true },
    { label: 'On leave', value: '3', trend: 'today', tone: 'amber', up: true },
    { label: 'Late', value: '2', trend: '-1', tone: 'rose', up: false },
  ];

  private loadContent(): void {
    this.content.getContent().subscribe((c) => {
      // Filter out entries missing their required fields — a technically
      // non-empty array of blank/incomplete records would otherwise win the
      // `.length` check and render as empty "real" content instead of
      // falling back to the honest, always-populated fallback copy.
      this.customers.set((c.customers ?? []).filter(cu => !!cu.name));
      this.serverTestimonials.set((c.testimonials ?? []).filter(t => !!t.quote && !!t.author));
      // Only override the default beta banner if the server explicitly sends one.
      if (c.announcement) this.announcement.set(c.announcement);
    });
  }

  steps = [
    {
      num: '01',
      key: 'workspace',
      title: 'Create your workspace',
      desc: 'Set up your organisation, offices and departments in minutes — no IT team required.',
    },
    {
      num: '02',
      key: 'invite',
      title: 'Invite your team',
      desc: 'Add employees, assign roles and let them clock in from web or mobile on day one.',
    },
    {
      num: '03',
      key: 'autopilot',
      title: 'Run HR on autopilot',
      desc: 'Attendance, leave and insights flow into one live dashboard — you just approve and grow.',
    },
  ];

  // Presence rows shown inside the hero product preview.
  presence = [
    { initials: 'AK', name: 'Aarav K.', role: 'Design', status: 'in', time: '9:02' },
    { initials: 'MP', name: 'Meera P.', role: 'Engineering', status: 'in', time: '8:47' },
    { initials: 'RS', name: 'Rohan S.', role: 'Sales', status: 'leave', time: '—' },
  ];

  // Mini weekly attendance chart inside the hero preview.
  weekBars = [
    { d: 'M', h: 62 }, { d: 'T', h: 84 }, { d: 'W', h: 74 },
    { d: 'T', h: 92 }, { d: 'F', h: 68 }, { d: 'S', h: 40 },
  ];

  // Klockk AI showcase.
  aiPoints = [
    'Natural-language questions on your live data',
    'Weekly insight reports, generated for you',
    'Private & permission-aware by design',
  ];
  aiSuggests = ['Who was late today?', 'Leave balance for Meera', 'Headcount by department'];

  /** Honest "built for" use-cases — shown instead of a customer logo cloud
   *  until real, consented customer logos come from the server. */
  industries = ['Startups', 'Agencies', 'Retail & F&B', 'Clinics', 'Multi-office', 'Remote teams'];

  /** Honest product-benefit cards — shown instead of testimonials until real,
   *  attributable customer quotes come from the server. No fake people. */
  whyChoose = [
    { key: 'admin', title: 'Less admin, more people work', desc: 'Automations handle the repetitive HR chores so your team can focus on people.' },
    { key: 'accurate', title: 'Accurate by default', desc: 'Geofenced check-ins and automatic late detection keep attendance honest.' },
    { key: 'insight', title: 'Insights you can trust', desc: 'Every AI answer is grounded on your live data — never invented.' },
  ];

  /** Convenience helpers for the template's initials + star rendering. */
  initialsOf(name: string): string {
    return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  }
  starsFor(rating?: number): string {
    const n = Math.max(1, Math.min(5, Math.round(rating ?? 5)));
    return '★★★★★'.slice(0, n);
  }

  // ─── Feature card tilt-on-hover (subtle 3D, desktop pointer only) ────
  onCardTilt(e: MouseEvent): void {
    const card = e.currentTarget as HTMLElement;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    card.style.setProperty('--tiltX', `${(-py * 6).toFixed(2)}deg`);
    card.style.setProperty('--tiltY', `${(px * 6).toFixed(2)}deg`);
  }
  onCardTiltReset(e: MouseEvent): void {
    const card = e.currentTarget as HTMLElement;
    card.style.setProperty('--tiltX', '0deg');
    card.style.setProperty('--tiltY', '0deg');
  }

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
  goAnnounce() {
    const url = this.announcement()?.ctaUrl;
    if (!url) return;
    if (/^https?:\/\//.test(url)) { window.open(url, '_blank'); return; }
    this.closeMenu();
    this.router.navigate([url]);
  }

  // ─── Scroll-reveal (no animation library needed) ─────────────
  private io?: IntersectionObserver;
  private revealFallbackTimer?: ReturnType<typeof setTimeout>;

  ngAfterViewInit(): void {
    const root: HTMLElement = this.host.nativeElement;

    // Reflect scroll position on the nav (adds a shadow past the hero fold).
    this.onScroll();
    window.addEventListener('scroll', this.onScroll, { passive: true });

    const prefersReduced =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const targets = Array.from(
      root.querySelectorAll<HTMLElement>('[data-reveal]')
    );

    if (prefersReduced || !('IntersectionObserver' in window)) {
      targets.forEach(el => el.classList.add('is-visible'));
      return;
    }

    this.io = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            this.io?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );

    targets.forEach(el => this.io!.observe(el));

    // Safety net — this is trust-building content (stats, testimonials,
    // feature cards), not decoration, so it must never end up permanently
    // invisible over an observer edge case. Anything still unrevealed after
    // a few seconds is forced visible.
    this.revealFallbackTimer = setTimeout(() => {
      targets.forEach(el => el.classList.add('is-visible'));
      this.io?.disconnect();
    }, 3000);
  }

  // Thin gradient bar in the nav that fills with scroll depth.
  scrollProgress = signal(0);

  private onScroll = (): void => {
    const scrolled = window.scrollY > 12;
    const el: HTMLElement = this.host.nativeElement;
    el.classList.toggle('is-scrolled', scrolled);

    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    this.scrollProgress.set(max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0);
  };

  ngOnDestroy(): void {
    this.io?.disconnect();
    window.removeEventListener('scroll', this.onScroll);
    if (this.clockTimer) clearInterval(this.clockTimer);
    if (this.revealFallbackTimer) clearTimeout(this.revealFallbackTimer);
  }
}
