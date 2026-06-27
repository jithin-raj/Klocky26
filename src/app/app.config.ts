import {
  ApplicationConfig,
  APP_INITIALIZER,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors }      from '@angular/common/http';

import { routes }              from './app.routes';
import { AppStateService }     from './core/services/app-state.service';
import { apiUrlInterceptor }   from './core/interceptors/api-url.interceptor';
import { authInterceptor }     from './core/interceptors/auth.interceptor';
import { mobileHeaderInterceptor } from './core/interceptors/mobile-header.interceptor';
import { errorInterceptor }    from './core/interceptors/error.interceptor';
import { loadingInterceptor }  from './core/interceptors/loading.interceptor';

// ─────────────────────────────────────────────────────────────────────────────
// APP_INITIALIZER — runs before the app renders
// AppStateService.init() decrypts stored state from localStorage so guards
// and interceptors have the correct auth context from the very first route.
// ─────────────────────────────────────────────────────────────────────────────
function initAppState(appState: AppStateService): () => Promise<void> {
  return () => appState.init();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),

    // Router — bind route params to component @Inputs automatically
    provideRouter(routes, withComponentInputBinding()),

    // HTTP client with interceptors applied in execution order:
    //  1. loadingInterceptor      — starts/stops global loading indicator
    //  2. apiUrlInterceptor       — prepends base URL to relative paths
    //  3. authInterceptor         — attaches Bearer token + X-Org-Slug header
    //  4. mobileHeaderInterceptor — adds `isMobile: true` in the RN WebView shell
    //  5. errorInterceptor        — handles 401 refresh, 403 redirect, 5xx messages
    provideHttpClient(
      withInterceptors([
        loadingInterceptor,
        apiUrlInterceptor,
        authInterceptor,
        mobileHeaderInterceptor,
        errorInterceptor,
      ]),
    ),

    // Decrypt + hydrate AppStateService before first route activates
    {
      provide:    APP_INITIALIZER,
      useFactory: initAppState,
      deps:       [AppStateService],
      multi:      true,
    },
  ],
};

