# Vercel Deployment Guide for Klocky Web App

## Quick Start

Deploy to production with one command:

```bash
vercel --prod
```

Your app will be deployed to your Vercel production URL.

**Current Production URL**: `https://klock-jithinrajpv123-6097s-projects.vercel.app`

> **💡 Tip**: To get a shorter URL like `klock.vercel.app`, rename your project in Vercel Dashboard → Settings → General → Project Name. If that name is taken, consider adding a custom domain instead.

## Environment Setup

### Production Deployment
- **URL**: `https://klock.vercel.app`
- **Branch**: `main` (or any branch you choose)
- **Build Command**: `npm run build` (automatically runs production build)
- **Output Directory**: `dist/klocky-app/browser`
- **Framework**: Angular
- **Node Version**: 18.x or later

### Local Development
- **URL**: `http://localhost:4200`
- **API**: `http://localhost:3000/api/v1`
- **Command**: `npm start`

## Vercel Configuration

The project includes a `vercel.json` file that automatically configures:
- SPA routing (all routes redirect to `/index.html`)
- Organization slug header handling
- Correct output directory

### 1. Install Vercel CLI
```bash
npm i -g vercel
```

### 2. Link Project to Vercel (First Time Only)
```bash
vercel link
```

Follow the prompts to connect your project.

### 3. Deploy to Production
```bash
vercel --prod
```

## Environment Features

### Local Development (`npm start`)
- **Frontend**: `http://localhost:4200`
- **API**: `http://localhost:3000/api/v1`
- **Encryption**: ❌ Disabled (plain JSON in localStorage for easier debugging)
- **API Logging**: ✅ Enabled
- **Source Maps**: ✅ Enabled
- **Hot Reload**: ✅ Enabled

### Production (`https://klock.vercel.app`)
- **Frontend**: `https://klock.vercel.app`
- **API**: `https://api.klocky.app/v1`
- **Encryption**: ✅ Enabled (AES-256-GCM for localStorage)
- **API Logging**: ❌ Disabled
- **Optimization**: ✅ Fully optimized bundle
- **Source Maps**: ❌ Disabled

## Automatic Deployments

### GitHub Integration
Connect your GitHub repository to Vercel for automatic deployments:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Import your GitHub repository
3. Vercel will automatically deploy on every push to `main`

**Automatic behavior:**
- **Push to `main`** → Deploys to production (`https://klock.vercel.app`)
- **Pull Requests** → Creates preview deployments
- **Other branches** → Creates preview deployments

### Custom Domain (Optional)
If you want a custom domain instead of `https://klock.vercel.app`:
1. Go to [Vercel Dashboard](https://vercel.com/dashboard) → Your Project → Settings → Domains
2. Add your custom domain (e.g., `app.klocky.com`)
3. Follow DNS configuration instructions
4. Vercel will automatically provision an SSL certificate

## Local Testing

### Test Local Environment
```bash
npm start
# Opens http://localhost:4200
# Check DevTools → Application → Local Storage
# Values should be plain JSON (no encryption)
```

### Test Production Build Locally
```bash
npm run build
npx http-server dist/klocky-app/browser -p 8080
# Opens http://localhost:8080
# Check DevTools → Application → Local Storage
# Values should be encrypted (e.g., "CqKvZ8J9aXY=.A3xKmPQr9vT2...")
```

## Debugging localStorage

### Local/Dev (No Encryption)
Open DevTools → Application → Local Storage:
```json
{
  "klocky_s": "{\"user\":{\"id\":\"123\",\"email\":\"user@example.com\"},\"accessToken\":\"eyJ...\"}"
}
```

### Production (Encrypted)
Open DevTools → Application → Local Storage:
```json
{
  "klocky_s": "CqKvZ8J9aXY=.A3xKmPQr9vT2jN8..."
}
```

## Troubleshooting

### Build Fails
```bash
# Clear cache and reinstall
rm -rf node_modules dist .angular
npm install
npm run build:d on Vercel
1. Check build logs in Vercel Dashboard
2. Ensure Node.js version is 18.x or later
3. Verify `package.json` dependencies are correct

### Build Fails Locally
```bash
# Clear cache and reinstall
rm -rf node_modules dist .angular
npm install
npm run build
```

### Wrong Environment Loaded
Verify that production build uses `environment.prod.ts`:
```bash
# After build, check the output
cat dist/klocky-app/browser/main-*.js | grep "disableEncryption"
# Should show: disableEncryption:!1 or disableEncryption:false (production)
```

### localStorage Not Encrypted in Production
1. Make sure you built with `npm run build` (not `npm start`)
2. Check that `environment.prod.ts` has `disableEncryption: false`
3. Clear browser cache and localStorage
4. Reload the page

## Summary

**Simple Deployment:**
```bash
# One command to deploy
vercel --prod
```

**That's it!** Your app will be live at `https://klock.vercel.app` 🚀