// ─────────────────────────────────────────────────────────────────────────────
// Development environment configuration (app-dev)
// Used for staging/dev deployments on Vercel
// ─────────────────────────────────────────────────────────────────────────────
export const environment = {
  production: false,

  /** Development API base URL (update with your dev API endpoint) */
  apiBaseUrl: 'https://api-dev.klocky.app/v1',

  /** Enable API request/response logging in dev */
  enableApiLogging: true,

  /** Disable encryption in dev environment for easier debugging */
  disableEncryption: true,

  tokenKey: 'klocky_access_token',
  refreshTokenKey: 'klocky_refresh_token',
};
