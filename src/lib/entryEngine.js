// Entry (chat) parsing rules, ported 1:1 from frontend/pages/chat.html
// (SaveBulkMessage, parseTypingInput, parsePasteMessage, parseABInput, addRow).
// Everything here is pure: callers keep the pending-rows list in state.

export const JODE_NUMS = ['11', '22', '33', '44', '55', '66', '77', '88', '99', '100'];
export const SET57 = ['21', '23', '24', '26', '27', '28', '29', '31', '32', '34', '36', '37', '38', '39', '41', '42', '43', '46', '47', '48', '49', '51', '52', '53', '54', '56', '57', '58', '59', '61', '62', '63', '64', '67', '68', '69', '71', '72', '73', '74', '76', '78', '79', '81', '82', '83', '84', '86', '87', '89', '91', '92', '93', '94', '96', '97', '98'];
export const SET43 = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '22', '25', '30', '33', '35', '40', '44', '45', '50', '55', '60', '65', '66', '70', '75', '77', '80', '85', '88', '90', '95', '99', '100'];

// Entry modes = the web's nav pills. `fields` drives which inputs show.
export const MODES = [
  { key: 'typing', label: 'Typing', fields: ['num', 'amt'], hint: 'Type numbers (pairs) + amount' },
  { key: 'laddi', label: 'Laddi', fields: ['num', 'to', 'amt'], hint: 'From → To range, same amount' },
  { key: 'jode', label: 'Jode', fields: ['amt'], hint: '11, 22 … 99, 00 with one amount' },
  { key: 'cross', label: 'Cross', fields: ['num', 'amt'], hint: 'Every pair of the digits typed' },
  { key: 'pahada', label: 'Pahada', fields: ['num', 'amt'], hint: 'Table of the number up to 100' },
  { key: 'ander', label: 'Ander', fields: ['num', 'amt'], hint: 'Digits → 1111, 2222 …' },
  { key: 'bahar', label: 'Bahar', fields: ['num', 'amt'], hint: 'Digits → 111, 222 …' },
  { key: 'yantri', label: 'Yantri', fields: [], hint: 'Grid entry for all numbers' },
  { key: '57', label: '57', fields: ['amt'], hint: 'The 57-number set' },
  { key: '43', label: '43', fields: ['amt'], hint: 'The 43-number set' },
  { key: 'palat', label: 'Palat', fields: ['num', 'amt', 'palat'], hint: 'Number + its reverse' },
  { key: 'chat', label: 'Chat', fields: ['text'], hint: 'Send a plain text message' },
];

// Max length of the Number field per mode (web sets maxLength on switch).
export const numMaxLength = (mode) => (mode === 'pahada' || mode === 'laddi' ? 2 : 50000);

export const ERR_WRONG = 'Wrong Inputs! Something Went Wrong!';
export const ERR_CHECK = 'Sorry Please Check Value !';

export function allSame(s) {
  return s.split('').every((c) => c === s[0]);
}

const digitsOnly = (s) => String(s || '').replace(/[^0-9]/g, '');
const pad = (i) => (i >= 1 && i <= 9 ? '0' + i : String(i));

export function parseTypingInput(raw) {
  if (!raw) return [];
  const v = parseInt(raw, 10);
  if (raw.length === 1) return [v >= 1 && v <= 9 ? '0' + v : v === 0 ? '100' : String(v)];
  if (raw.length === 3 && allSame(raw)) return [raw === '000' ? '1000' : raw];
  if (raw.length === 4 && allSame(raw)) return [raw === '0000' ? '10000' : raw];
  if (raw.length % 2 === 0) {
    const r = [];
    for (let i = 0; i < raw.length; i += 2) {
      let c = raw.substr(i, 2);
      if (c === '00') c = '100';
      r.push(c);
    }
    return r;
  }
  if (v >= 1 && v <= 9) return ['0' + v];
  return [String(v)];
}

// addRow(): validates the number, applies the Uttar sign, returns a row or null.
export function makeRow(num, amount, isUttar) {
  if (!num || !amount) return null;
  const s1 = String(num);
  const n = parseInt(s1, 10);
  const valid = (n <= 100 && n > 0) || (s1.length >= 3 && allSame(s1)) || s1 === '1000' || s1 === '10000';
  if (!valid) return null;
  const amt = parseFloat(amount) || 0;
  if (amt === 0) return null;
  const finalAmt = isUttar ? -Math.abs(amt) : Math.abs(amt);
  if (isNaN(finalAmt) || finalAmt === 0) return null;
  return { num: s1, amt: String(finalAmt) };
}

function parsePasteMessage(s1, push) {
  const str = s1.replace(/ /g, '');
  const parts = str.split(/[\n),+$#@\\_]/);
  let pending = '';
  parts.forEach((part) => {
    const segs = part.split(/[=(]/);
    const num = (segs[0] || '').replace(/[^0-9]/g, '');
    const amt = segs[1];
    if (!amt) { pending += num; return; }
    const fn = num + pending;
    pending = '';
    parseTypingInput(fn).forEach((n) => { if (n && amt) push(n, amt); });
  });
}

function parseABInput(s1, s2, push) {
  if (s1.includes('ab') || s1.includes('AB')) {
    const str = s1.replace(/[aAbB]/g, '');
    str.split('').forEach((d) => { let n = d + d + d + d; if (n === '0000') n = '10000'; push(n, s2); });
    str.split('').forEach((d) => { let n = d + d + d; if (n === '000') n = '1000'; push(n, s2); });
  } else if (s1.includes('a') || s1.includes('A')) {
    digitsOnly(s1).split('').forEach((d) => { let n = d + d + d + d; if (n === '0000') n = '10000'; push(n, s2); });
  } else if (s1.includes('b') || s1.includes('B')) {
    digitsOnly(s1).split('').forEach((d) => { let n = d + d + d; if (n === '000') n = '1000'; push(n, s2); });
  }
}

/**
 * SaveBulkMessage(): turns the current inputs into pending rows.
 * Returns { rows, error, skipped }. `skipped` = nothing to do (web returns early).
 */
export function buildRows({ mode, num = '', to = '', amt = '', palat = '', add3 = false, withoutJode = false, isUttar = false }) {
  const s1 = num, s2 = amt;
  const rows = [];
  const push = (n, a) => { const r = makeRow(n, a, isUttar); if (r) rows.push(r); };
  const isJode = mode === 'jode', is57 = mode === '57', is43 = mode === '43';

  if (!((s1 !== '') || (isJode && s2 !== '' && s2 !== '0') || (is57 && s2 !== '' && s2 !== '0') || (is43 && s2 !== '' && s2 !== '0'))) {
    return { rows, skipped: true };
  }
  if (isJode) { JODE_NUMS.forEach((n) => push(n, s2)); return { rows }; }
  if (mode === 'palat') {
    const raw = digitsOnly(s1);
    if (raw.length === 1) { push('0' + raw, s2); push(raw + '0', palat); return { rows }; }
    if (raw.length % 2 === 0) {
      for (let i = 0; i < raw.length; i += 2) {
        let c = raw.substr(i, 2);
        if (c === '00') c = '100';
        push(c, s2);
        const rev = parseInt(c.split('').reverse().join(''), 10);
        push(rev < 10 ? '0' + rev : String(rev), palat);
      }
      return { rows };
    }
    return { rows, error: ERR_WRONG };
  }
  if (is57) { SET57.forEach((n) => push(n, s2)); return { rows }; }
  if (is43) { SET43.forEach((n) => push(n, s2)); return { rows }; }
  if (mode === 'pahada') {
    let start = parseInt(digitsOnly(s1), 10);
    if (isNaN(start) || start <= 0) start = 1;
    const step = add3 ? 3 : start;
    for (let i = start; i <= 100; i += step) push(pad(i), s2);
    return { rows };
  }
  if (mode === 'ander') {
    digitsOnly(s1).split('').forEach((d) => { let n = d + d + d + d; if (n === '0000') n = '10000'; push(n, s2); });
    return { rows };
  }
  if (mode === 'bahar') {
    digitsOnly(s1).split('').forEach((d) => { let n = d + d + d; if (n === '000') n = '1000'; push(n, s2); });
    return { rows };
  }
  if (mode === 'laddi') {
    const from = parseInt(digitsOnly(s1), 10);
    const toN = parseInt(to, 10);
    const a = parseInt(s2, 10);
    if (!isNaN(from) && !isNaN(toN) && a > 0 && from >= 1 && from < toN && toN <= 100) {
      for (let i = from; i <= toN; i++) push(i <= 9 ? '0' + i : String(i), s2);
      return { rows };
    }
    return { rows, error: ERR_WRONG };
  }
  if (mode === 'cross') {
    const d = digitsOnly(s1).split('');
    for (let i = 0; i < d.length; i++) {
      for (let j = 0; j < d.length; j++) {
        if (withoutJode && i === j) continue;
        let pair = d[i] + d[j];
        if (pair === '00' || pair === '0') pair = '100';
        push(pair, s2);
      }
    }
    return { rows };
  }
  if (s2 !== '' && s2 !== '0' && /[aAbB]/.test(s1)) { parseABInput(s1, s2, push); return { rows }; }
  if (s2 !== '' && s2 !== '0' && s1 !== '0') {
    parseTypingInput(digitsOnly(s1)).forEach((n) => { if (n) push(n, s2); });
    return { rows };
  }
  if (s2 !== '' && s2 === '0' && s1 !== '0') { parsePasteMessage(s1, push); return { rows }; }
  return { rows, error: ERR_WRONG };
}

// Re-open a saved message for editing. The web re-parses it with the paste
// parser; stored messages are canonical "num=amt" lists, so read them as
// such (identical result, except "1000=x" no longer splits into 10 & 100).
export function rowsFromMessage(message, isUttar) {
  const rows = [];
  String(message || '').replace(/\r/g, '').split(/[,\n]/).forEach((part) => {
    const [n, a] = part.split('=');
    const num = (n || '').trim();
    const amt = (a || '').trim();
    if (!num || !amt) return;
    const r = makeRow(num, amt, isUttar);
    if (r) rows.push(r);
  });
  return rows;
}

// processSpl(): strip letters, then show long digit runs as comma-separated pairs.
export function formatNumberInput(text) {
  const clean = String(text || '').replace(/[a-zA-Z]/g, '');
  const raw = clean.replace(/,/g, '');
  if (/^\d+$/.test(raw) && raw.length > 2) return raw.match(/\d{1,2}/g).join(',');
  return clean;
}

// PasteMsg(): newlines become commas, then appended and re-formatted.
export function pasteIntoNumber(current, pasted) {
  const t = String(pasted || '').replace(/(\r\n|\n|\r)/gm, ',');
  return formatNumberInput(String(current || '') + t);
}

export const rowsToMessage = (rows) => rows.map((r) => `${r.num}=${r.amt}`).join(',');
export const rowsTotal = (rows) => rows.reduce((s, r) => s + (parseFloat(r.amt) || 0), 0);

// Grand total for the day — Message sum, TotalAmount as fallback (getTime()).
export function messagesGrandTotal(msgs) {
  return (msgs || [])
    .filter((m) => m.IsAccepted === 'Accepted' || m.IsAccepted === 'Pending')
    .reduce((s, m) => {
      let sum = 0;
      (m.Message || '').split(',').forEach((e) => {
        const p = e.split('=');
        if (p.length === 2) sum += parseFloat(p[1]) || 0;
      });
      return s + (sum > 0 ? sum : parseFloat(m.TotalAmount) || 0);
    }, 0);
}

// Bet-number search (highlightBetText / getEquivalentNumbers).
export function equivalentNumbers(q) {
  const s = String(q || '').trim();
  if (!s) return [];
  const set = new Set([s]);
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    if (n >= 0 && n <= 9) { set.add(String(n)); set.add('0' + n); }
    if (n === 0 || s === '00' || s === '100') { set.add('0'); set.add('00'); set.add('100'); }
  }
  return Array.from(set);
}

// Splits a message into segments flagged as number/amount matches.
export function highlightSegments(text, query) {
  const targets = equivalentNumbers(query);
  if (!targets.length) return { parts: [{ t: text || '' }], hasMatch: false };
  let hasMatch = false;
  const parts = [];
  String(text || '').split(/([,\n\r\t]+)/).forEach((part) => {
    if (/^[,\n\r\t]+$/.test(part)) { parts.push({ t: part }); return; }
    const trimmed = part.trim();
    if (!trimmed) { parts.push({ t: part }); return; }
    const eq = trimmed.indexOf('=');
    if (eq !== -1) {
      const n = trimmed.substring(0, eq).trim();
      const a = trimmed.substring(eq + 1).trim();
      if (targets.includes(n)) { hasMatch = true; parts.push({ t: part, hit: 'num' }); return; }
      if (targets.includes(a)) { hasMatch = true; parts.push({ t: trimmed.substring(0, eq + 1) }); parts.push({ t: a, hit: 'amt' }); return; }
      parts.push({ t: part });
      return;
    }
    if (targets.includes(trimmed)) { hasMatch = true; parts.push({ t: part, hit: 'num' }); return; }
    parts.push({ t: part });
  });
  return { parts, hasMatch };
}

// Yantri grid (entry modal) layout.
export const YM_ROWS = Array.from({ length: 10 }, (_, r) => Array.from({ length: 10 }, (__, c) => r * 10 + c + 1));
export const YM_AADAR = [111, 222, 333, 444, 555, 666, 777, 888, 999, 1000];
export const YM_ANDER = [1111, 2222, 3333, 4444, 5555, 6666, 7777, 8888, 9999, 10000];
export const ymLabel = (n) => (n === 100 ? '100' : n === 1000 ? '000' : n === 10000 ? '0000' : n < 10 ? '0' + n : String(n));

// ymSend(): build the message from the grid values map { [n]: '123' }.
export function yantriGridMessage(values) {
  const parts = [];
  let total = 0;
  const get = (n) => parseInt(values[n] || 0, 10) || 0;
  YM_ROWS.flat().forEach((n) => { const v = get(n); if (v) { parts.push((n < 10 ? '0' + n : String(n)) + '=' + v); total += v; } });
  YM_AADAR.forEach((n) => { const v = get(n); if (v) { parts.push(n + '=' + v); total += v; } });
  YM_ANDER.forEach((n) => { const v = get(n); if (v) { parts.push(n + '=' + v); total += v; } });
  return { message: parts.join(','), total };
}

// Focus order for Enter in the yantri grid (ymKD / ymKDAk), returns next n.
export function ymNext(n, upToDown) {
  const ai = YM_AADAR.indexOf(n);
  if (ai >= 0) return ai < 9 ? YM_AADAR[ai + 1] : YM_ANDER[0];
  const ni = YM_ANDER.indexOf(n);
  if (ni >= 0) return ni < 9 ? YM_ANDER[ni + 1] : null;
  if (upToDown) {
    const row = Math.floor((n - 1) / 10), col = (n - 1) % 10;
    if (row < 9) return YM_ROWS[row + 1][col];
    return col < 9 ? YM_ROWS[0][col + 1] : YM_AADAR[0];
  }
  return n < 100 ? n + 1 : YM_AADAR[0];
}
