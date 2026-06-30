// ─────────────────────────────────────────────────────────────────────────────
// leaflet-loader — lazy-load Leaflet from CDN at runtime
//
// Avoids an npm dependency / angular.json asset wiring for an optional map lib.
// Injects the CSS + JS once and resolves the global `L`. Returns the same
// promise on subsequent calls.
// ─────────────────────────────────────────────────────────────────────────────

const LEAFLET_VERSION = '1.9.4';
const CSS_URL = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
const JS_URL = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;

let _promise: Promise<any> | null = null;

/** Resolves the global Leaflet (`L`), loading it from CDN on first use. */
export function loadLeaflet(): Promise<any> {
  const w = window as any;
  if (w.L) return Promise.resolve(w.L);
  if (_promise) return _promise;

  _promise = new Promise<any>((resolve, reject) => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = CSS_URL;
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = JS_URL;
    script.async = true;
    script.onload = () => {
      const L = (window as any).L;
      L ? resolve(L) : reject(new Error('Leaflet loaded but global L is missing'));
    };
    script.onerror = () => { _promise = null; reject(new Error('Failed to load Leaflet from CDN')); };
    document.body.appendChild(script);
  });
  return _promise;
}
