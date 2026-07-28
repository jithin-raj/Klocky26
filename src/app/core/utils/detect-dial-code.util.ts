// ─────────────────────────────────────────────────────────────────────────────
// detectDefaultDialCode — best-effort guess at the user's country calling code
// from the browser/OS locale, used only to pre-fill a phone field's country
// code as a starting point. Never enforced — the value is always editable.
// ─────────────────────────────────────────────────────────────────────────────

const REGION_DIAL_CODES: Record<string, string> = {
  IN: '91', US: '1', CA: '1', GB: '44', AE: '971', SA: '966', QA: '974',
  KW: '965', BH: '973', OM: '968', SG: '65', MY: '60', ID: '62', PH: '63',
  TH: '66', VN: '84', CN: '86', JP: '81', KR: '82', AU: '61', NZ: '64',
  DE: '49', FR: '33', IT: '39', ES: '34', NL: '31', BE: '32', CH: '41',
  AT: '43', SE: '46', NO: '47', DK: '45', FI: '358', PL: '48', PT: '351',
  IE: '353', GR: '30', TR: '90', RU: '7', ZA: '27', NG: '234', KE: '254',
  EG: '20', IL: '972', PK: '92', BD: '880', LK: '94', NP: '977', BR: '55',
  MX: '52', AR: '54', CL: '56', CO: '57', PE: '51',
};

/** Default country calling code, no leading '+'. Falls back to India ('91') — the product's primary market. */
export function detectDefaultDialCode(): string {
  try {
    const tag = navigator.language || 'en-IN';
    const region = new Intl.Locale(tag).maximize().region;
    return (region && REGION_DIAL_CODES[region]) || '91';
  } catch {
    return '91';
  }
}
