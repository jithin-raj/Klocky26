# Vercel Deployment Guide for Klocky Web App

## Environment Setup

### Production Deployment
- **Domain**: `https://klock.vercel.app` (Vercel production URL)
- **Branch**: `main`
- **Build Command**: `npm run build:prod`
- **Environment Variables**:
  - None required (uses `environment.prod.ts`)

### Development/Staging Deployment  
- **Domain**: `https://klock-dev.vercel.app` (or your dev deployment URL)
- **Branch**: `dev` (or staging branch)
- **Build Command**: `npm run build:dev`
- **Environment Variables**:
  - None required (uses `environment.dev.ts`)

## Vercel Configuration

### 1. Install Vercel CLI (Optional)
```bash
npm i -g vercel
```

### 2. Link Project to Vercel
```bash
vercel link
```

### 3. Deploy to Production
```bash
# Deploy from main branch
vercel --prod
```

### 4. Deploy to Dev/Staging
```bash
# Deploy from dev branch
vercel
```

## Environment-Specific Features

### Local Development (`npm start`)
- **Frontend**: `http://localhost:4200`
- **API**: `http://localhost:3000/api/v1`
- **No encryption** for localStorage (easier debugging)
- API logging enabled
- Source maps enabled

### Dev/Staging (`https://klock-dev.vercel.app`)
- **Frontend**: Vercel preview URL or custom dev domain
- **API**: `https://api-dev.klocky.app/v1`
- **No encryption** for localStorage (easier debugging)
- API logging enabled
- Optimized build

### Production (`https://klock.vercel.app`)
- **Frontend**: `https://klock.vercel.app`
- **API**: `https://api.klocky.app/v1`
- **Encryption enabled** for localStorage
- API logging disabled
- Fully optimized build

## Automatic Deployments

### GitHub Integration
Vercel automatically deploys when you push to connected branches:

- **Push to `main`** → Production deployment (`https://klock.vercel.app`)
- **Push to `dev`** → Dev deployment (preview URL)
- **Pull Requests** → Preview deployments

### Branch Configuration in Vercel Dashboard
1. Go to Project Settings → Git
2. Set Production Branch: `main`
3. Add Preview Branch: `dev` (optional for staging deployments)

### Custom Domain (Optional)
If you want a custom domain instead of `https://klock.vercel.app`:
1. Go to Project Settings → Domains in Vercel Dashboard
2. Add your custom domain (e.g., `app.klocky.com`)
3. Follow DNS configuration instructions
4. Vercel will automatically provision SSL certificate

## Local Testing

### Test Local Environment
```bash
npm start
# Opens http://localhost:4200
# Check localStorage - values should be plain JSON
```

### Test Dev Build Locally
```bash
npm run build:dev
npx http-server dist/klocky-app/browser -p 8080
# Opens http://localhost:8080
```

### Test Production Build Locally
```bash
npm run build:prod
npx http-server dist/klocky-app/browser -p 8080
# Opens http://localhost:8080
# Check localStorage - values should be encrypted
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
npm run build:dev
```

### Wrong Environment Loaded
Check your build command uses the correct configuration:
- Dev: `npm run build:dev` 
- Prod: `npm run build:prod`

### Environment Not Detected
Verify `environment.ts` is being replaced:
```bash
# After build, check the output
cat dist/klocky-app/browser/main-*.js | grep "disableEncryption"
# Should show: disableEncryption: false (prod) or true (dev)
```
