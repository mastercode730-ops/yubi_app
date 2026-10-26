// Number helpers. Indian digit grouping is done by hand so it is identical on
// every device/engine (Intl support varies between Android builds).

export function groupIN(intStr) {
  const s = String(intStr);
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

// 1234567.5 → "12,34,567.5" ; keeps up to `decimals` fraction digits.
export function fmtNum(n, decimals = 2) {
  const v = parseFloat(n);
  if (!isFinite(v)) return '0';
  const neg = v < 0;
  const abs = Math.abs(v);
  const fixed = decimals > 0 ? String(Math.round(abs * 10 ** decimals) / 10 ** decimals) : String(Math.round(abs));
  const [i, f] = fixed.split('.');
  return `${neg ? '-' : ''}${groupIN(i)}${f ? '.' + f : ''}`;
}

// Truncate like the web's (int) casts / Math.trunc, then group.
export const fmtInt = (n) => fmtNum(Math.trunc(parseFloat(n) || 0), 0);

export const num = (v) => parseFloat(v) || 0;

export const sumBy = (rows, key) => (rows || []).reduce((s, r) => s + (parseFloat(r?.[key]) || 0), 0);

// Strip trailing "12345" mobile suffixes the SPs append to names (getCleanCustName).
export function cleanName(v) {
  const val = String(v || '');
  const cleaned = val.replace(/\s*[([]?\d+[)\]]?$/, '').replace(/\s+\d+$/, '').trim();
  return cleaned || val.trim();
}

export const cleanName5 = (v) => String(v || '').replace(/\s+\d{4,5}$/, '').trim();

export const initials = (name) => {
  const clean = String(name || '').trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

export const isTrue = (v) => v === true || v === 1 || String(v).toLowerCase() === 'true' || String(v) === '1';

export const onlyDigits = (s) => String(s || '').replace(/[^0-9]/g, '');
export const onlyDecimal = (s) => String(s || '').replace(/[^0-9.]/g, '');
export const signedInt = (s) => {
  let v = String(s || '').replace(/[^0-9-]/g, '');
  if (v.indexOf('-') > 0) v = v.replace(/-/g, '');
  return v;
};
