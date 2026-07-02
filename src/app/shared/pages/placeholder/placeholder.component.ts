import { Component, input } from '@angular/core';

/**
 * Generic "coming soon" page shell.
 * Used by stub routes while a real feature is being built.
 *
 * The router is configured with withComponentInputBinding(), so a route can set
 * the heading/subtitle simply via `data: { title, subtitle }` and they bind to
 * the inputs below — no ActivatedRoute wiring needed at the call site.
 */
@Component({
  standalone: true,
  selector: 'app-placeholder-page',
  template: `
    <div class="placeholder-page">
      <div class="ph-card">
        <div class="ph-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </div>
        <h2 class="ph-title">{{ title() }}</h2>
        <p class="ph-sub">{{ subtitle() }}</p>
        <span class="ph-badge">Coming Soon</span>
      </div>
    </div>
  `,
  styles: [`
    .placeholder-page {
      min-height: calc(100vh - 128px);
      display: flex; align-items: center; justify-content: center;
      padding: 40px 20px;
    }
    .ph-card {
      display: flex; flex-direction: column; align-items: center;
      gap: 12px; max-width: 360px; text-align: center;
    }
    .ph-icon {
      width: 72px; height: 72px; border-radius: 20px;
      background: linear-gradient(135deg, #eef2ff, #e8edf3);
      display: flex; align-items: center; justify-content: center;
      color: #6366f1;
    }
    .ph-title {
      font-size: 22px; font-weight: 700; color: #1e293b; margin: 0;
    }
    .ph-sub {
      font-size: 14px; color: #64748b; margin: 0; line-height: 1.6;
    }
    .ph-badge {
      display: inline-block;
      font-size: 11px; font-weight: 700; letter-spacing: 0.06em;
      text-transform: uppercase; color: #6366f1;
      background: rgba(99,102,241,.08);
      border: 1px solid rgba(99,102,241,.18);
      padding: 4px 12px; border-radius: 20px;
      margin-top: 4px;
    }
  `],
})
export class PlaceholderPageComponent {
  title = input('Coming Soon');
  subtitle = input('This section is being built. Check back soon.');
}
