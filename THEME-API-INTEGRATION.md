# Theme API Integration Guide

## Problem Solved
When your API returns only a **single color code** for an organization, the system automatically generates a complete theme with all required colors.

## How It Works

### API Response (Single Color)
```json
{
  "organizationId": "acme-corp",
  "brandColor": "#6366f1"
}
```

### Generated Theme (Complete Color Scheme)
```typescript
{
  accent: "#6366f1",          // Your API color
  accentDark: "#4f46e5",      // Auto: 20% darker
  textAccent: "#a5b4fc",      // Auto: 40% lighter for dark backgrounds
  textAccentPale: "#c7d2fe",  // Auto: 60% lighter for headings
  pageBg: "#04040a"           // Auto: dark background with accent tint
}
```

## Usage Examples

### 1. After Login (Apply Org Theme)
```typescript
// auth.service.ts or wherever you handle login
import { OrgThemeService } from './core/services/org-theme.service';

loginResponse.subscribe(data => {
  const brandColor = data.organization.brandColor; // e.g., "#6366f1"
  
  // Generate and apply complete theme from single color
  const theme = this.orgThemeService.generateThemeFromColor(brandColor);
  this.orgThemeService.apply(theme);
});
```

### 2. Save Custom Color (From Settings)
```typescript
// org-profile.component.ts
async saveOrgProfile(): Promise<void> {
  // Only send the accent color to API
  const payload = {
    organizationId: this.orgId,
    brandColor: this.accentColor  // e.g., "#ff5733"
  };
  
  await this.api.post('/organizations/profile', payload);
  
  // Apply theme locally
  const theme = this.orgThemeService.generateThemeFromColor(this.accentColor);
  this.orgThemeService.apply(theme);
}
```

### 3. Preview Before Saving
```typescript
// Already implemented in org-profile.component.ts
// The preview automatically shows how the complete theme will look
// based on just the selected accent color
```

## Auto-Generation Logic

### For Dark Accent Colors (luminance < 0.5)
- ✅ **pageBg**: Very dark with subtle accent tint
- ✅ **accentDark**: 20% darker for gradients
- ✅ **textAccent**: 40% lighter (for text on dark bg)
- ✅ **textAccentPale**: 60% lighter (for headings)

### For Light Accent Colors (luminance > 0.5)
- ✅ **pageBg**: White (#ffffff)
- ✅ **accentDark**: 15% darker
- ✅ **textAccent**: 35% darker (for text on light bg)
- ✅ **textAccentPale**: 15% darker (for secondary elements)

## API Contract

### What You Send (POST/PUT)
```typescript
{
  "brandColor": "#6366f1"  // Single hex color
}
```

### What You Receive (GET)
```typescript
{
  "brandColor": "#6366f1"  // Single hex color
}
```

The frontend handles all color derivations automatically!

## Testing
1. Go to **Settings → Organization Profile → Branding**
2. Select any color from swatches or use custom picker
3. **Preview shows the complete theme** before saving
4. Click **Save** → Only accent color sent to API
5. On reload → Frontend regenerates full theme from stored color

## Benefits
- ✅ **API Simplicity**: Store only 1 color per organization
- ✅ **Automatic Contrast**: Always readable text
- ✅ **Light/Dark Adaptive**: Works with any color choice
- ✅ **Consistent Design**: Colors always harmonize
- ✅ **No Database Changes**: Single `brandColor` field sufficient
