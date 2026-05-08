import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

// ─────────────────────────────────────────────────────────────────────────────
// CryptoService — AES-256-GCM encryption/decryption via the native Web Crypto API
//
// Why this approach?
//  • No external dependencies — uses browser-native `crypto.subtle`
//  • AES-256-GCM provides authenticated encryption (tamper-evident)
//  • Key is derived via PBKDF2 (100k iterations) — brute-force resistant
//  • A fresh random IV is generated per encryption — no IV reuse
//  • The derived key is cached after first use (lazy singleton)
//  • Encryption can be disabled in dev/local environments for easier debugging
//
// ⚠  NOTE: Client-side encryption CANNOT protect against a motivated attacker
//    who inspects the source bundle. The purpose is to prevent casual reading
//    of stored state (e.g. in DevTools → Application → LocalStorage) and to
//    make bulk credential harvesting harder. Tokens should always be validated
//    server-side.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Passphrase used as PBKDF2 input.
 * In a stricter setup this could be derived from a server-issued nonce,
 * but for a SPA a static passphrase still defeats plaintext storage.
 */
const _PASS = 'kl0cky-state-key-v1-secure';

/**
 * Fixed salt — must stay stable across releases so stored data remains
 * decryptable. Change this only during a planned "wipe all sessions" migration.
 */
const _SALT = new Uint8Array([
  0x4b, 0x6c, 0x6f, 0x63, 0x6b, 0x79, 0x53, 0x61,
  0x6c, 0x74, 0x32, 0x30, 0x32, 0x36, 0x21, 0x40,
]);

@Injectable({ providedIn: 'root' })
export class CryptoService {

  /** Cached derived key — computed once per app session */
  private _keyPromise: Promise<CryptoKey> | null = null;

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Encrypts any serialisable value to a compact base64 string.
   * Format of output:  `<iv_base64>.<ciphertext_base64>`
   * 
   * In dev/local environments (when disableEncryption is true), 
   * returns plaintext JSON for easier debugging.
   *
   * @example
   *   const encrypted = await crypto.encrypt({ user: { id: '1' }, token: 'abc' });
   */
  async encrypt(value: unknown): Promise<string> {
    // Skip encryption in dev/local environments for easier debugging
    if (environment.disableEncryption) {
      return JSON.stringify(value);
    }

    const key  = await this._getKey();
    const iv   = crypto.getRandomValues(new Uint8Array(12));          // 96-bit random IV
    const data = new TextEncoder().encode(JSON.stringify(value));

    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);

    return `${this._toB64(iv)}.${this._toB64(new Uint8Array(cipherBuf))}`;
  }

  /**
   * Decrypts a string produced by `encrypt()` and returns the original value.
   * Returns `null` if decryption fails (tampered data, wrong key, corrupt input).
   * 
   * In dev/local environments (when disableEncryption is true),
   * parses plaintext JSON directly.
   *
   * @example
   *   const state = await crypto.decrypt<AppState>(encrypted);
   */
  async decrypt<T = unknown>(ciphertext: string): Promise<T | null> {
    // In dev/local, stored data is plaintext JSON
    if (environment.disableEncryption) {
      try {
        return JSON.parse(ciphertext) as T;
      } catch {
        return null;
      }
    }

    try {
      const [ivB64, dataB64] = ciphertext.split('.');
      if (!ivB64 || !dataB64) return null;

      const iv     = this._fromB64(ivB64);
      const data   = this._fromB64(dataB64);
      const key    = await this._getKey();

      const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
      return JSON.parse(new TextDecoder().decode(plainBuf)) as T;
    } catch {
      // Decryption failure = tampered data or wrong key — treat as empty
      return null;
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  /**
   * Derives (or returns cached) AES-GCM-256 CryptoKey via PBKDF2.
   * Runs only once per browser session — result is cached in memory.
   */
  private _getKey(): Promise<CryptoKey> {
    if (this._keyPromise) return this._keyPromise;

    this._keyPromise = (async () => {
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(_PASS),
        { name: 'PBKDF2' },
        false,
        ['deriveKey'],
      );
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: _SALT, iterations: 100_000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );
    })();

    return this._keyPromise;
  }

  private _toB64(buf: Uint8Array): string {
    return btoa(String.fromCharCode(...buf));
  }

  private _fromB64(b64: string): Uint8Array {
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  }
}
