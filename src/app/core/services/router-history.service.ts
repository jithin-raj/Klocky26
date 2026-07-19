import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/**
 * Tracks the URL the user was on immediately before the current one, so pages
 * that can be reached from many places (e.g. attendance regularisation) can
 * navigate back to wherever the user actually came from without every caller
 * having to pass an explicit returnUrl.
 */
@Injectable({ providedIn: 'root' })
export class RouterHistoryService {
  private readonly router = inject(Router);

  private previousUrl: string | null = null;
  private currentUrl: string = this.router.url;

  constructor() {
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    ).subscribe((e) => {
      this.previousUrl = this.currentUrl;
      this.currentUrl = e.urlAfterRedirects;
    });
  }

  getPreviousUrl(): string | null {
    return this.previousUrl;
  }
}
