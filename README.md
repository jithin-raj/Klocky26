# KlockyApp

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.0.

## Environment Setup

This application supports two environments:

### 🏠 Local Development
- **Command**: `npm start`
- **URL**: `http://localhost:4200`
- **API**: `http://localhost:3000/api/v1`
- **Encryption**: ❌ Disabled (plain JSON in localStorage for easier debugging)
- **Logging**: ✅ Enabled

### 🚀 Production Environment
- **Command**: `npm run build` or `vercel --prod`
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

The project supports two build configurations:

### Local Development
```bash
npm start
# Runs development server at http://localhost:4200
```

### Production Build
```bash
npm run build
# Output: dist/klocky-app/browser
# Ready for deployment to Vercel
```

### Watch Mode (Auto-rebuild)
```bash
npm run watch
# Automatically rebuilds on file changes
```

## Vercel Deployment

Deploy to production with a single command:

```bash
# Deploy to https://klock.vercel.app
vercel --prod
```

The build will automatically:
- Use production environment (`environment.prod.ts`)
- Enable localStorage encryption
- Optimize the bundle
- Deploy to your Vercel production URL

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
