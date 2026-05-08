// ─────────────────────────────────────────────────────────────────────────────
// Development environment configuration
//
// To set a custom base URL locally, create a .env file at the project root:
//   KLOCKY_API_URL=http://localhost:3000/api/v1
//
// Angular CLI does not read .env natively, so the value is set here directly.
// For CI/CD pipelines, swap environment.ts via `fileReplacements` in angular.json.
// ─────────────────────────────────────────────────────────────────────────────
export const environment = {
  production: false,

  /** Base URL for all API calls. No trailing slash. */
  apiBaseUrl: 'http://localhost:3000/api/v1',

  /** If true, HTTP requests/responses are logged to the console */
  enableApiLogging: true,

  /** Disable encryption in local development for easier debugging */
  disableEncryption: true,

  /** Access token key in localStorage */
  tokenKey: 'klocky_access_token',

  /** Refresh token key in localStorage */
  refreshTokenKey: 'klocky_refresh_token',
};
