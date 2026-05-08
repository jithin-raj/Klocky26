# KlockyApp

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.0.

## Environment Setup

This application supports three environments:

### 🏠 Local Development
- **Command**: `npm start`
- **URL**: `http://localhost:4200`
- **API**: `http://localhost:3000/api/v1`
- **Encryption**: ❌ Disabled (plain JSON in localStorage)
- **Logging**: ✅ Enabled

### 🧪 Dev/Staging Environment
- **Command**: `npm run build:dev`
- **Domain**: `app-dev.klocky.app`
- **API**: `https://api-dev.klocky.app/v1`
- **Encryption**: ❌ Disabled (plain JSON for debugging)
- **Logging**: ✅ Enabled
- **Optimized**: ✅ Production-ready bundle

### 🚀 Production Environment
- **Command**: `npm run build:prod`
- **Domain**: `https://klock.vercel.app`
- **API**: `https://api.klocky.app/v1`
- **Encryption**: ✅ Enabled (AES-256-GCM)
- **Logging**: ❌ Disabled
- **Optimized**: ✅ Fully optimized

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

The project supports multiple build configurations:

### Development Build (Local)
```bash
npm start
# or
ng serve
```

### Dev/Staging Build (app-dev)
```bash
npm run build:dev
# Output: dist/klocky-app/browser
```

### Production Build
```bash
npm run build:prod
# or
ng build --configuration=production
```

### Watch Mode (Auto-rebuild)
```bash
npm run watch
```

All builds compile your project and store artifacts in the `dist/` directory.

## Vercel Deployment

See [VERCEL-DEPLOYMENT.md](./VERCEL-DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deploy Commands
```bash
# Deploy to dev/staging
vercel

# Deploy to production
vercel --prod
```

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
