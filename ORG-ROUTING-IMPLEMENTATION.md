# Organization-Scoped Routing Implementation

## Overview

This document describes the implementation of organization-scoped routing in Klocky Web Application.

## URL Structure

**Before:** `https://klock.vercel.app/app/dashboard`  
**After:** `https://klock.vercel.app/claysis/app/dashboard`

Where `claysis` is the organization slug/code entered during login.

## Why Path-Based Routing?

We chose path-based routing (`/orgSlug/app/*`) over subdomain-based (`orgSlug.klock.vercel.app`) for these reasons:

✅ **Simpler Implementation** - No DNS/wildcard configuration needed  
✅ **Single SSL Certificate** - No wildcard SSL required  
✅ **Easier Local Development** - Works seamlessly on localhost  
✅ **Better Testing** - Easy to test multiple orgs  
✅ **Single Domain Cookies** - Simplified authentication  
✅ **Vercel-Friendly** - Simple deployment configuration  

## Implementation Details

### 1. Routes Configuration (`app.routes.ts`)

Updated the main routes to include `:orgSlug` parameter:

```typescript
{
  path: ':orgSlug',
  children: [
    {
      path: 'app',
      canActivate: [authGuard],
      loadComponent: () => import('./layout/shell/shell.component'),
      children: [
        { path: 'dashboard', ... },
        { path: 'employees', ... },
        // ... all app routes
      ]
    }
  ]
}
```

### 2. Guards Updated

**auth.guard.ts**
- Validates user is authenticated
- Checks URL orgSlug matches stored orgSlug
- Redirects to correct org if mismatch
- Redirects to `/login` if not authenticated

**public.guard.ts**
- Redirects authenticated users to `/:orgSlug/app/dashboard`
- Allows unauthenticated access to public pages

### 3. Navigation Service

Created `OrgNavigationService` to simplify org-aware navigation:

```typescript
// Inject the service
private orgNav = inject(OrgNavigationService);

// Use it to navigate
this.orgNav.navigate(['app', 'employees']);
// Navigates to /claysis/app/employees

// Get org-scoped URL
const url = this.orgNav.getOrgUrl(['app', 'dashboard']);
// Returns: /claysis/app/dashboard
```

### 4. Component Updates

Updated all navigation calls across components:

**TypeScript Navigation:**
- `error.interceptor.ts` - 403 error redirect
- `login.component.ts` - Post-login redirect
- `register.component.ts` - Post-registration redirect
- `employee-*.component.ts` - All employee module navigation
- `landing.component.ts` - Dashboard button (redirects to login)

**HTML Template Navigation:**
- `sidebar.component.html` - Settings link
- `employee-dashboard.component.html` - Quick action cards

### 5. Vercel Configuration

Updated `vercel.json` to support org-scoped routes:

```json
{
  "outputDirectory": "dist/klocky-app/browser",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/:orgSlug/app/(.*)",
      "headers": [{ "key": "X-Org-Slug", "value": ":orgSlug" }]
    }
  ]
}
```

## How It Works

### Login Flow

1. User enters org code (e.g., "claysis") on login page
2. `AuthStateService.orgIdentifier` stores the org code
3. After successful authentication:
   - `AppStateService` stores `orgSlug` in encrypted state
   - User redirected to `/:orgSlug/app/dashboard`
4. `authGuard` validates orgSlug on every protected route

### Navigation Flow

1. User clicks a link or navigation occurs
2. `authGuard` checks authentication and org slug
3. If authenticated but wrong org slug → redirects to correct org
4. If not authenticated → redirects to `/login`
5. Angular router handles the rest

### URL Example Flow

```
Login with org: "claysis"
  ↓
Store orgSlug: "claysis" in AppStateService
  ↓
Navigate to: /claysis/app/dashboard
  ↓
Auth guard validates: URL orgSlug === stored orgSlug ✓
  ↓
Load dashboard component
```

## Usage Examples

### In Components (TypeScript)

```typescript
import { OrgNavigationService } from '@core/services/org-navigation.service';

export class MyComponent {
  private orgNav = inject(OrgNavigationService);

  goToEmployees() {
    // Navigate to org-scoped route
    this.orgNav.navigate(['app', 'employees']);
  }

  goToEmployeeDetail(id: string) {
    // Navigate with parameters
    this.orgNav.navigate(['app', 'employees', id]);
  }

  getProfileUrl() {
    // Get URL as string
    return this.orgNav.getOrgUrl(['app', 'profile']);
  }
}
```

### In Templates (HTML)

```html
<!-- Use property binding with computed orgPrefix -->
<a [routerLink]="[orgPrefix(), 'app', 'employees']">Employees</a>

<!-- Component needs to inject AppStateService and create computed -->
export class MyComponent {
  private appState = inject(AppStateService);
  orgPrefix = computed(() => `/${this.appState.orgSlug() || 'default'}`);
}
```

### Direct Router Navigation

```typescript
import { Router } from '@angular/router';
import { AppStateService } from '@core/services/app-state.service';

export class MyComponent {
  private router = inject(Router);
  private appState = inject(AppStateService);

  navigate() {
    const orgSlug = this.appState.orgSlug() || 'default';
    this.router.navigate([`/${orgSlug}/app/dashboard`]);
  }
}
```

## State Management

The organization slug is stored in multiple places:

1. **During Login (AuthStateService):**
   - `orgIdentifier` signal - user input from login form
   - Temporary, only during login flow

2. **After Login (AppStateService):**
   - `orgSlug` signal - persisted in encrypted localStorage
   - Available throughout the app via `appState.orgSlug()`
   - Survives page refreshes

3. **In URL:**
   - `:orgSlug` route parameter
   - Validated by auth guard

## Testing

### Test Scenarios

1. **Login with org code "claysis"**
   - Should navigate to `/claysis/app/dashboard`
   - All navigation should include `/claysis/` prefix

2. **Direct URL access**
   - Access `/demo/app/employees` (if logged into "demo" org)
   - Should load successfully

3. **Wrong org slug**
   - Logged into "claysis" org
   - Try accessing `/demo/app/dashboard`
   - Should redirect to `/claysis/app/dashboard`

4. **Not authenticated**
   - Try accessing `/claysis/app/dashboard`
   - Should redirect to `/login?returnUrl=/claysis/app/dashboard`

5. **Already authenticated**
   - Visit `/login` while logged in
   - Should redirect to `/:orgSlug/app/dashboard`

## Files Modified

### Core Files
- `src/app/app.routes.ts` - Added :orgSlug wrapper
- `src/app/core/guards/auth.guard.ts` - Added org validation
- `src/app/core/guards/public.guard.ts` - Org-aware redirect
- `src/app/core/services/org-navigation.service.ts` - **NEW** navigation helper
- `src/app/core/interceptors/error.interceptor.ts` - 403 redirect

### Feature Components
- `src/app/features/auth/pages/login/login.component.ts`
- `src/app/features/auth/pages/register/register.component.ts`
- `src/app/features/landing/landing.component.ts`
- `src/app/features/employees/pages/org-tree/org-tree.component.ts`
- `src/app/features/employees/pages/employee-list/employee-list.component.ts`
- `src/app/features/employees/pages/employee-detail/employee-detail.component.ts`
- `src/app/features/employees/pages/employee-add/employee-add.component.ts`
- `src/app/features/dashboard/pages/employee-dashboard/employee-dashboard.component.ts`

### Layout Components
- `src/app/layout/sidebar/sidebar.component.ts`
- `src/app/layout/sidebar/sidebar.component.html`

### Templates
- `src/app/features/dashboard/pages/employee-dashboard/employee-dashboard.component.html`

### Configuration
- `vercel.json` - Added org-scoped headers

## Future Enhancements

1. **API Integration**
   - Currently using demo org slug
   - Connect to real API for org validation
   - Store org metadata (name, theme, settings)

2. **Org Switcher**
   - Allow users to switch between orgs (if they have access to multiple)
   - Dropdown in header/sidebar

3. **Custom Domains**
   - Allow orgs to map custom domains
   - Example: `claysis.com` → `/claysis/app/*`

4. **Org-Specific Themes**
   - Already partially implemented with `OrgThemeService`
   - Expand to include org logos, colors, etc.

5. **Analytics**
   - Track usage per organization
   - Organization-specific dashboards

## Notes

- All new navigation should use `OrgNavigationService` for consistency
- Template links should use property binding with `orgPrefix()`
- The org slug is case-insensitive (normalized to lowercase)
- Default org slug is 'default' if none is found (fallback)

## Support

For questions or issues, contact the development team.

---

**Implementation Date:** May 8, 2026  
**Version:** 1.0.0
