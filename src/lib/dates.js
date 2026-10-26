// Date helpers ported from the web portal pages. The backend accepts
// dd/mm/yyyy, dd/MMM/yyyy and yyyy-mm-dd, but individual endpoints expect a
// specific one — each screen uses the same format the web page sends.

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_IDX = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

const pad2 = (n) => String(n).padStart(2, '0');

// "Now" in IST, stored as a UTC-shifted Date: read it with getUTC* methods.
export function istNow() {
  return new Date(Date.now() + 5.5 * 3600000);
}

// Today (IST) as dd/mm/yyyy.
export function istDMY() {
  const d = istNow();
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

// Today (IST) as yyyy-mm-dd.
export function istISO() {
  const d = istNow();
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

// Yesterday (IST) as dd/mm/yyyy — hisab.html getPreviousDate().
export function istPrevDMY() {
  const d = istNow();
  d.setUTCDate(d.getUTCDate() - 1);
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

// Local calendar Date → dd/mm/yyyy.
export function dateToDMY(d) {
  if (!(d instanceof Date) || isNaN(d)) return '';
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Any supported string → local calendar Date (mirrors the pages' parseDmy:
// a dd/mm/yyyy where the middle part is >12 is treated as mm/dd/yyyy).
export function parseDMY(s) {
  if (!s) return new Date();
  if (s instanceof Date) return s;
  const str = String(s).trim();
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) {
    const p1 = parseInt(dmy[1], 10), p2 = parseInt(dmy[2], 10), yr = parseInt(dmy[3], 10);
    if (p2 > 12 && p1 <= 12) return new Date(yr, p1 - 1, p2);
    return new Date(yr, p2 - 1, p1);
  }
  const m8 = str.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (m8) return new Date(parseInt(m8[3], 10), parseInt(m8[2], 10) - 1, parseInt(m8[1], 10));
  const alpha = str.match(/^(\d{1,2})[/\s-]([A-Za-z]{3})[/\s-](\d{4})/);
  if (alpha) {
    const mi = MONTH_IDX[alpha[2].toLowerCase()];
    return new Date(parseInt(alpha[3], 10), mi !== undefined ? mi : 0, parseInt(alpha[1], 10));
  }
  const iso = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (iso) return new Date(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}

// Any value → dd/mm/yyyy (formatToDdMmYyyy). ISO timestamps keep their date
// part as-is (mssql serialises date columns as UTC midnight).
export function toDMY(v) {
  if (!v) return '';
  if (v instanceof Date) return dateToDMY(v);
  const s = String(v).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) return `${pad2(dmy[1])}/${pad2(dmy[2])}/${dmy[3]}`;
  const alpha = s.match(/^(\d{1,2})[/\s-]([A-Za-z]{3})[/\s-](\d{4})/);
  if (alpha) {
    const mi = MONTH_IDX[alpha[2].toLowerCase()];
    return `${pad2(alpha[1])}/${pad2((mi !== undefined ? mi : 0) + 1)}/${alpha[3]}`;
  }
  const iso = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (iso) return `${pad2(iso[3])}/${pad2(iso[2])}/${iso[1]}`;
  return s;
}

// chat.html fmtDate(): like toDMY but Date objects are read in UTC.
export function chatFmtDate(dt) {
  if (dt instanceof Date) {
    return `${pad2(dt.getUTCDate())}/${pad2(dt.getUTCMonth() + 1)}/${dt.getUTCFullYear()}`;
  }
  const s = String(dt || '').trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const m1 = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m1) {
    const p1 = parseInt(m1[1], 10), p2 = parseInt(m1[2], 10);
    if (p2 > 12 && p1 <= 12) return `${pad2(p2)}/${pad2(p1)}/${m1[3]}`;
    return `${pad2(p1)}/${pad2(p2)}/${m1[3]}`;
  }
  const m2 = s.match(/^(\d{1,2})\/([A-Za-z]{3})\/(\d{4})/);
  if (m2) {
    const mi = MONTH_IDX[m2[2].toLowerCase()];
    return `${pad2(m2[1])}/${pad2((mi !== undefined ? mi : 0) + 1)}/${m2[3]}`;
  }
  const d = new Date(s);
  if (!isNaN(d)) return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  return s.split('T')[0];
}

// Any value → yyyy-mm-dd (show-transactions toIsoDate / received fmtDate).
export function toISO(v) {
  if (!v) return '';
  if (v instanceof Date) return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) {
    let day = parseInt(dmy[1], 10), mo = parseInt(dmy[2], 10);
    if (mo > 12 && day <= 12) [day, mo] = [mo, day];
    return `${dmy[3]}-${pad2(mo)}-${pad2(day)}`;
  }
  const alpha = s.match(/^(\d{1,2})[/\s-]([A-Za-z]{3})[/\s-](\d{4})/);
  if (alpha) {
    const mi = MONTH_IDX[alpha[2].toLowerCase()];
    return `${alpha[3]}-${pad2((mi !== undefined ? mi : 0) + 1)}-${pad2(alpha[1])}`;
  }
  return '';
}

// dd/mm/yyyy → dd/MMM/yyyy (what yantri.html expects from chat).
export function toMonDate(v) {
  const dmy = toDMY(v);
  const p = dmy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!p) return dmy;
  return `${p[1]}/${MONTHS[parseInt(p[2], 10) - 1]}/${p[3]}`;
}

// Human display: "25 Oct 2026". Date-only ISO strings use their own parts
// so the result never shifts with the phone's timezone.
export function displayDate(v) {
  if (!v) return '';
  const s = String(v);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]} ${MONTHS[parseInt(iso[2], 10) - 1]} ${iso[1]}`;
  const d = v instanceof Date ? v : parseDMY(s);
  if (isNaN(d)) return s;
  return `${pad2(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// chat.html parseMsgDateTime(): raw numbers, no timezone conversion.
export function parseMsgDateTime(s) {
  if (!s) return null;
  const str = String(s).trim();
  const make = (dd, mm, yy, h24, min) => {
    const h12 = h24 % 12 || 12;
    const ap = h24 >= 12 ? 'PM' : 'AM';
    const yys = String(yy).slice(-2);
    return {
      shortDate: `${pad2(dd)}/${pad2(mm)}/${yys}`,
      fullDate: `${pad2(dd)}/${pad2(mm)}/${yys} ${h12}:${pad2(min)}${ap}`,
      time: `${h12}:${pad2(min)} ${ap}`,
    };
  };
  const m1 = str.match(/^(\d{1,2})\/(\d{2})\/(\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (m1) {
    let h = parseInt(m1[4], 10);
    const ap = m1[6].toUpperCase();
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return make(parseInt(m1[1], 10), parseInt(m1[2], 10), 2000 + parseInt(m1[3], 10), h, parseInt(m1[5], 10));
  }
  const m2 = str.match(/^(\d{1,2})-(\w{3})-(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
  if (m2) {
    let h = parseInt(m2[4], 10);
    const ap = (m2[6] || '').toUpperCase();
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    const mi = MONTH_IDX[m2[2].toLowerCase()];
    if (mi !== undefined) return make(parseInt(m2[1], 10), mi + 1, parseInt(m2[3], 10), h, parseInt(m2[5], 10));
  }
  const m3 = str.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (m3) return make(parseInt(m3[3], 10), parseInt(m3[2], 10), parseInt(m3[1], 10), parseInt(m3[4], 10), parseInt(m3[5], 10));
  return null;
}

// sale-history.html formatUpdateTime().
export function formatUpdateTime(val) {
  if (!val) return '';
  const s = String(val).trim();
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?$/i);
  if (m1) {
    let yy = m1[3];
    if (yy.length === 2) yy = '20' + yy;
    let h = parseInt(m1[4], 10);
    let ap = m1[6] ? m1[6].toUpperCase() : '';
    if (!ap) { ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; }
    return `${pad2(m1[1])}/${pad2(m1[2])}/${yy} ${h}:${pad2(m1[5])} ${ap}`;
  }
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{2})/);
  if (m2) {
    const h24 = parseInt(m2[4], 10);
    return `${m2[3]}/${m2[2]}/${m2[1]} ${h24 % 12 || 12}:${m2[5]} ${h24 >= 12 ? 'PM' : 'AM'}`;
  }
  return s;
}

// Auto-insert slashes while typing a date (the pages' bindAutoSlashDate).
export function autoSlash(text, prev = '') {
  if (text.length < prev.length) return text; // deleting — leave as typed
  const v = text.replace(/\D/g, '').slice(0, 8);
  if (v.length > 4) return `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
  if (v.length > 2) return `${v.slice(0, 2)}/${v.slice(2)}${v.length === 4 ? '/' : ''}`;
  if (v.length === 2) return `${v}/`;
  return v;
}

export const isCompleteDMY = (s) => /^\d{2}\/\d{2}\/\d{4}$/.test(String(s || ''));

// First day of the month of a dd/mm/yyyy (IST today by default).
export function firstOfMonthDMY(dmy = istDMY()) {
  const p = toDMY(dmy).split('/');
  return p.length === 3 ? `01/${p[1]}/${p[2]}` : dmy;
}
