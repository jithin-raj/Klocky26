import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { IconKlockyLogoComponent } from '../../icons/icon-klocky-logo.component';

export type BrandSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

@Component({
  selector: 'app-brand',
  standalone: true,
  imports: [NgIf, IconKlockyLogoComponent, CommonModule],
  template: `
    <!-- ── Joint-venture mode ── -->
    <div *ngIf="orgName || orgLogoUrl; else klockyOnly"
         class="brand jv"
         [ngClass]="size"
         [class.clickable]="clickable"
         (click)="onBrandClick()"
         [attr.role]="clickable ? 'button' : null"
         [attr.tabindex]="clickable ? '0' : null"
         [attr.title]="clickable ? 'Go to Dashboard' : null">

      <!-- ── Org Side ── -->
      <div class="jv-org">
        <ng-container *ngIf="orgLogoUrl && !_logoFailed(); else orgFallback">
          <img [src]="_activeSrc()"
               [alt]="orgName"
               class="jv-org-img"
               referrerpolicy="no-referrer"
               (error)="onImgError()"/>
        </ng-container>

        <ng-template #orgFallback>
          <div class="jv-org-avatar" [style.background]="avatarGradient">
            {{ orgName.charAt(0).toUpperCase() }}
          </div>
          <span class="jv-org-name">{{ orgName }}</span>
        </ng-template>
      </div>

      <!-- ── Divider ── -->
      <span *ngIf="showAppBranding" class="jv-divider"></span>

      <!-- ── App Branding ── -->
      <div *ngIf="showAppBranding" class="jv-klocky">
        <icon-klocky-logo [size]="klockyJvIconSize"></icon-klocky-logo>
        <span class="jv-klocky-label">
          {{ appName }}
        </span>
      </div>
    </div>

    <!-- ── Klocky-only mode ── -->
    <ng-template #klockyOnly>
      <div class="brand"
           [ngClass]="size"
           [class.clickable]="clickable"
           (click)="onBrandClick()"
           [attr.role]="clickable ? 'button' : null"
           [attr.tabindex]="clickable ? '0' : null"
           [attr.title]="clickable ? 'Go to Dashboard' : null">
        <icon-klocky-logo [size]="iconSize"></icon-klocky-logo>
        <span *ngIf="showText" class="brand-name">
          {{ appName }}
        </span>
      </div>
    </ng-template>
  `,
  styles: [`
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      user-select: none;
      white-space: nowrap;
    }

    /* Clickable brand */
    .brand.clickable {
      cursor: pointer;
      transition: transform 0.15s ease, opacity 0.15s ease;
    }

    .brand.clickable:hover {
      transform: translateY(-1px);
      opacity: 0.85;
    }

    .brand.clickable:active {
      transform: translateY(0);
      opacity: 1;
    }

    /* ── Size variants ── */
    .xs { gap: 6px; }
    .sm { gap: 8px; }
    .md { gap: 10px; }
    .lg { gap: 12px; }
    .xl { gap: 16px; }

    /* ── App Name ── */
    .brand-name {
      font-weight: 800;
      letter-spacing: -0.4px;
      background: linear-gradient(135deg, #2e9840 0%, #5dc862 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .xs .brand-name { font-size: 13px; }
    .sm .brand-name { font-size: 15px; }
    .md .brand-name { font-size: 18px; }
    .lg .brand-name { font-size: 22px; }
    .xl .brand-name { font-size: 28px; }

    /* ── JV Layout ── */
    .jv-org {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .jv-org-img {
      height: 40px;
      width: auto;
      max-width: 100px;
      object-fit: contain;
      border-radius: 4px;
    }

    .xs .jv-org-img { height: 24px; max-width: 60px; }
    .sm .jv-org-img { height: 32px; max-width: 80px; }
    .md .jv-org-img { height: 40px; max-width: 100px; }
    .lg .jv-org-img { height: 48px; max-width: 120px; }
    .xl .jv-org-img { height: 56px; max-width: 140px; }

    /* ── Org Avatar Fallback ── */
    .jv-org-avatar {
      height: 40px;
      width: 40px;
      border-radius: 6px;
      background: linear-gradient(135deg, #2e9840, #5dc862);
      color: white;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    }

    .xs .jv-org-avatar { height: 24px; width: 24px; font-size: 11px; }
    .sm .jv-org-avatar { height: 32px; width: 32px; font-size: 14px; }
    .md .jv-org-avatar { height: 40px; width: 40px; font-size: 16px; }
    .lg .jv-org-avatar { height: 48px; width: 48px; font-size: 19px; }
    .xl .jv-org-avatar { height: 56px; width: 56px; font-size: 22px; }

    .jv-org-name {
      font-size: 14px;
      font-weight: 700;
      color: #111827;
      letter-spacing: -0.2px;
    }

    .xs .jv-org-name { font-size: 11px; }
    .sm .jv-org-name { font-size: 13px; }
    .md .jv-org-name { font-size: 14px; }
    .lg .jv-org-name { font-size: 16px; }
    .xl .jv-org-name { font-size: 19px; }

    /* ── Divider ── */
    .jv-divider {
      width: 1px;
      height: 22px;
      background: linear-gradient(to bottom, transparent, #d1d5db, transparent);
      flex-shrink: 0;
    }

    .xs .jv-divider { height: 16px; }
    .sm .jv-divider { height: 20px; }
    .md .jv-divider { height: 22px; }
    .lg .jv-divider { height: 26px; }
    .xl .jv-divider { height: 30px; }

    /* ── Klocky Section ── */
    .jv-klocky {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .jv-klocky-label {
      font-size: 11px;
      font-weight: 600;
      color: #6b7280;
      letter-spacing: 0.2px;
    }

    .xs .jv-klocky-label { font-size: 9px; }
    .sm .jv-klocky-label { font-size: 10px; }
    .md .jv-klocky-label { font-size: 11px; }
    .lg .jv-klocky-label { font-size: 12px; }
    .xl .jv-klocky-label { font-size: 13px; }

    @media (max-width: 640px) {
      .jv-klocky-label { display: none; }
      .jv-divider { display: none; }
      .jv-klocky { display: none; }
      /* Keep .jv-org-name visible so org name shows when logo fails on mobile */
      .jv-org-name { font-size: 13px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    }
  `],
})
export class AppBrandComponent {
  /** Size */
  @Input() size: BrandSize = 'xl';

  /** Show text */
  @Input() showText = true;

  /** App Name (NEW) */
  @Input() appName = 'Klockk';

  /** Show the app branding (divider + Klockk logo/text) */
  @Input() showAppBranding = true;

  /** Org Name */
  @Input() orgName = '';

  /** Org Logo — resets the broken-image flag whenever the URL changes. */
  readonly _logoFailed = signal(false);
  readonly _activeSrc  = signal('');
  private _retried = false;
  private _orgLogoUrl = '';
  private _orgLogoFallbackUrl = '';

  get orgLogoUrl(): string { return this._orgLogoUrl; }
  @Input() set orgLogoUrl(url: string) {
    this._orgLogoUrl = url;
    this._retried = false;
    this._logoFailed.set(false);
    this._activeSrc.set(url);
  }

  /** Fallback URL tried if orgLogoUrl fails to load (e.g. the public /org/logo/:slug endpoint). */
  @Input() set orgLogoFallbackUrl(url: string) {
    this._orgLogoFallbackUrl = url;
  }

  onImgError(): void {
    if (!this._retried && this._orgLogoFallbackUrl && this._orgLogoFallbackUrl !== this._orgLogoUrl) {
      this._retried = true;
      this._activeSrc.set(this._orgLogoFallbackUrl);
    } else {
      this._logoFailed.set(true);
    }
  }

  /** Org Accent Color */
  @Input() orgAccentColor = '';

  /** Make brand clickable */
  @Input() clickable = false;

  /** Emitted when brand is clicked (if clickable is true) */
  @Output() brandClick = new EventEmitter<void>();

  /** Get gradient for avatar based on accent color */
  get avatarGradient(): string {
    if (this.orgAccentColor) {
      return `linear-gradient(135deg, ${this.orgAccentColor}, ${this.lightenColor(this.orgAccentColor, 20)})`;
    }
    return 'linear-gradient(135deg, #2e9840, #5dc862)';
  }

  /** Lighten a hex color by a percentage */
  private lightenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, ((num >> 16) & 0xff) + amt);
    const G = Math.min(255, ((num >> 8) & 0xff) + amt);
    const B = Math.min(255, (num & 0xff) + amt);
    return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
  }

  onBrandClick() {
    if (this.clickable) {
      this.brandClick.emit();
    }
  }

  /** Size map */
  private static iconMap: Record<BrandSize, number> = {
    xs: 22,
    sm: 30,
    md: 38,
    lg: 46,
    xl: 58,
  };

  get iconSize(): number {
    return AppBrandComponent.iconMap[this.size];
  }

  get klockyJvIconSize(): number {
    return AppBrandComponent.iconMap[this.size] - 8;
  }
}
