// Yantri report logic, ported 1:1 from frontend/pages/yantri.html.
// numData is a plain object { [number]: value } holding FLOAT values;
// values are truncated only for display/sums, exactly like the web page.

export const DARA_NUMS = Array.from({ length: 100 }, (_, i) => i + 1);
export const AKHAR_AADAR = [111, 222, 333, 444, 555, 666, 777, 888, 999, 1000];
export const AKHAR_ANDER = [1111, 2222, 3333, 4444, 5555, 6666, 7777, 8888, 9999, 10000];
export const ALL_NUMS = [...DARA_NUMS, ...AKHAR_AADAR, ...AKHAR_ANDER];
const AKHAR_ALL = [...AKHAR_AADAR, ...AKHAR_ANDER];

export const emptyNumData = () => {
  const d = {};
  ALL_NUMS.forEach((n) => { d[n] = 0; });
  return d;
};

// C# Math.Round(decimal) default = round-half-to-even.
export function bankersRound(x) {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return Math.abs(floor % 2) === 0 ? floor : floor + 1;
}

const ANDER_MAP = {
  1111: [11, 12, 13, 14, 15, 16, 17, 18, 19, 10],
  2222: [21, 22, 23, 24, 25, 26, 27, 28, 29, 20],
  3333: [31, 32, 33, 34, 35, 36, 37, 38, 39, 30],
  4444: [41, 42, 43, 44, 45, 46, 47, 48, 49, 40],
  5555: [51, 52, 53, 54, 55, 56, 57, 58, 59, 50],
  6666: [61, 62, 63, 64, 65, 66, 67, 68, 69, 60],
  7777: [71, 72, 73, 74, 75, 76, 77, 78, 79, 70],
  8888: [81, 82, 83, 84, 85, 86, 87, 88, 89, 80],
  9999: [91, 92, 93, 94, 95, 96, 97, 98, 99, 90],
  10000: [1, 2, 3, 4, 5, 6, 7, 8, 9, 100],
};
const AADAR_MAP = {
  111: [1, 11, 21, 31, 41, 51, 61, 71, 81, 91],
  222: [2, 12, 22, 32, 42, 52, 62, 72, 82, 92],
  333: [3, 13, 23, 33, 43, 53, 63, 73, 83, 93],
  444: [4, 14, 24, 34, 44, 54, 64, 74, 84, 94],
  555: [5, 15, 25, 35, 45, 55, 65, 75, 85, 95],
  666: [6, 16, 26, 36, 46, 56, 66, 76, 86, 96],
  777: [7, 17, 27, 37, 47, 57, 67, 77, 87, 97],
  888: [8, 18, 28, 38, 48, 58, 68, 78, 88, 98],
  999: [9, 19, 29, 39, 49, 59, 69, 79, 89, 99],
  1000: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
};

export function applyShiftAtoD(data) {
  AKHAR_ANDER.forEach((n) => {
    if (!data[n]) return;
    const adj = bankersRound(Math.trunc(data[n]) / 10);
    ANDER_MAP[n].forEach((d) => { data[d] = (data[d] || 0) + adj; });
    data[n] = 0;
  });
  AKHAR_AADAR.forEach((n) => {
    if (!data[n]) return;
    const adj = bankersRound(Math.trunc(data[n]) / 10);
    AADAR_MAP[n].forEach((d) => { data[d] = (data[d] || 0) + adj; });
    data[n] = 0;
  });
  return data;
}

// loadData(): rows from /api/yantri/data → numData.
export function computeNumData(rows, mode, shiftAtoD) {
  const data = emptyNumData();
  (rows || []).forEach((row) => {
    (row.Message || '').split(',').forEach((entry) => {
      const parts = entry.split('=');
      if (parts.length < 2) return;
      let numStr = parts[0].trim();
      let val = parseFloat(parts[1]) || 0;
      if (numStr === '000') numStr = '1000';
      if (numStr === '0000') numStr = '10000';
      const num = parseInt(numStr, 10);
      if (!num || isNaN(num)) return;
      if (mode === 'actual') {
        const dAmt = parseFloat(row.D_Amt) || 100;
        const aAmt = parseFloat(row.A_Amt) || 10;
        const dComm = 100 - dAmt;
        const aComm = 100 - aAmt * 10;
        const pati = parseFloat(row.Pati_PComm) || 0;
        const hissa = parseFloat(row.HissaPerc) || 0;
        if (String(num).length <= 2 || num === 100) val = val * ((100 - dComm) / 100);
        else val = val * ((100 - aComm) / 100);
        val = val * ((100 - pati) / 100);
        val = val * ((100 - hissa) / 100);
      }
      data[num] = (data[num] || 0) + val;
    });
  });
  if (shiftAtoD) applyShiftAtoD(data);
  return data;
}

// calcSubtotals(): truncated sums.
export function summarize(data) {
  const rowTotals = [];
  let dSale = 0;
  for (let r = 0; r < 10; r++) {
    let t = 0;
    for (let i = r * 10 + 1; i <= r * 10 + 10; i++) t += Math.trunc(data[i] || 0);
    rowTotals.push(t);
    dSale += t;
  }
  const aadar = AKHAR_AADAR.reduce((s, n) => s + Math.trunc(data[n] || 0), 0);
  const ander = AKHAR_ANDER.reduce((s, n) => s + Math.trunc(data[n] || 0), 0);
  const aSale = aadar + ander;
  return { rowTotals, aadar, ander, dSale, aSale, total: dSale + aSale };
}

function doRoundoff(v, r) {
  if (!r) return Math.trunc(v);
  return Math.round(Math.trunc(v) / r) * r;
}

// saveCuttingHistory(): what is being cut away, recorded before applying.
export function cuttingHistoryEntry(data, dCut, aCut, isPct) {
  const parts = [];
  if (aCut) {
    AKHAR_ALL.forEach((n) => {
      if (!data[n]) return;
      let before = isPct ? data[n] * aCut / 100 : Math.min(aCut, data[n]);
      before = Math.max(0, Math.trunc(before));
      if (before) parts.push(`${n}=${before}`);
    });
  }
  if (dCut) {
    DARA_NUMS.forEach((n) => {
      if (!data[n]) return;
      let before = isPct ? data[n] * dCut / 100 : Math.min(dCut, data[n]);
      before = Math.max(0, Math.trunc(before));
      if (before) parts.push(`${n}=${before}`);
    });
  }
  return parts.length ? parts.join(',') : null;
}

// applyCutting(): returns a new numData.
export function applyCutting(data, dCut, aCut, isPct, roundoff) {
  const next = { ...data };
  if (dCut) {
    DARA_NUMS.forEach((n) => {
      if (!next[n]) return;
      let v = isPct ? next[n] * (100 - dCut) / 100 : next[n] - dCut;
      v = Math.max(0, doRoundoff(v, roundoff));
      next[n] = Math.trunc(v);
    });
  }
  if (aCut) {
    AKHAR_ALL.forEach((n) => {
      if (!next[n]) return;
      let v = isPct ? next[n] * (100 - aCut) / 100 : next[n] - aCut;
      v = Math.max(0, doRoundoff(v, roundoff));
      next[n] = Math.trunc(v);
    });
  }
  return next;
}

// showHistory(): a saved history entry rendered as the whole grid.
export function dataFromHistory(values) {
  const d = emptyNumData();
  String(values || '').split(',').forEach((e) => {
    const [ns, vs] = e.split('=');
    if (ns && vs) { const n = parseInt(ns, 10); d[n] = (d[n] || 0) + Math.trunc(parseFloat(vs) || 0); }
  });
  return d;
}

// addNumber(): returns { data, n } or { error }.
export function addNumber(data, numInput, amtInput) {
  let num = String(numInput || '').trim();
  const amt = parseFloat(amtInput) || 0;
  if (!num) return { skipped: true };
  if (num.length === 1 && parseInt(num, 10) < 10) num = '0' + num;
  if (num === '00') num = '100';
  if (num === '000') num = '1000';
  if (num === '0000') num = '10000';
  const n = parseInt(num, 10);
  if (!n || isNaN(n)) return { error: 'Invalid number' };
  const next = { ...data };
  next[n] = Math.trunc((next[n] || 0) + amt);
  if (next[n] < 0) next[n] = 0;
  return { data: next, n, value: next[n] };
}

export const ADJUST_MODES = [
  { key: 'limit', label: 'Limit' },
  { key: 'remaining', label: 'Remaining' },
  { key: 'multiply', label: 'Multiply' },
  { key: 'increase', label: 'Incr %' },
  { key: 'decrease', label: 'Decr %' },
];

function computeAdj(old, adj, type) {
  if (type === 'limit') return Math.min(old, adj);
  if (type === 'multiply') return old * adj;
  if (type === 'remaining') return Math.max(0, adj - old);
  if (type === 'increase') return old + (old * adj / 100);
  if (type === 'decrease') return (old * (100 - adj)) / 100;
  return old;
}

export function applyAdjust(data, value, type) {
  const adj = parseFloat(value) || 0;
  const next = { ...data };
  ALL_NUMS.forEach((n) => {
    if (!next[n]) return;
    next[n] = Math.trunc(Math.max(0, computeAdj(next[n], adj, type)));
  });
  return next;
}

// startParts(): randomly split each number across N parts (last part gets the rest).
export function splitParts(data, totalParts, maxAmt) {
  const snap = {};
  ALL_NUMS.forEach((n) => { snap[n] = data[n] || 0; });
  const parts = [];
  for (let j = 0; j < totalParts; j++) {
    const part = {};
    ALL_NUMS.forEach((n) => {
      if (!snap[n]) { part[n] = 0; return; }
      let r1;
      if (j === totalParts - 1) {
        r1 = snap[n];
      } else {
        let max = Math.floor(snap[n] * 120 / 100 / totalParts);
        let min = Math.floor(snap[n] * 80 / 100 / (totalParts - j));
        if (maxAmt && max > maxAmt) max = maxAmt;
        if (min > max) [min, max] = [max, min];
        if (min < 0) min = 0;
        r1 = Math.floor(Math.random() * (max - min + 1)) + min;
        r1 = Math.min(r1, snap[n]);
        snap[n] -= r1;
      }
      part[n] = r1;
    });
    parts.push(part);
  }
  return parts;
}

const v = (data, n) => Math.trunc(data[n] || 0);

export function msgEquals(data) {
  const parts = [];
  DARA_NUMS.forEach((n) => { const x = v(data, n); if (x) parts.push(`${String(n).padStart(2, '0')}=${x}`); });
  AKHAR_ALL.forEach((n) => { const x = v(data, n); if (x) parts.push(`${n}=${x}`); });
  return parts.join(',');
}

export function msgBrackets(data) {
  const parts = [];
  DARA_NUMS.forEach((n) => { const x = v(data, n); if (x) parts.push(`${String(n).padStart(2, '0')}(${x})`); });
  AKHAR_ALL.forEach((n) => { const x = v(data, n); if (x) parts.push(`${n}(${x})`); });
  return parts.join(' ');
}

export function msgNumbers(data) {
  const parts = [];
  DARA_NUMS.forEach((n) => { if (v(data, n)) parts.push(n === 100 ? '00' : String(n).padStart(2, '0')); });
  AKHAR_AADAR.forEach((n) => { if (v(data, n)) parts.push(n === 1000 ? '000' : String(n)); });
  AKHAR_ANDER.forEach((n) => { if (v(data, n)) parts.push(n === 10000 ? '0000' : String(n)); });
  return parts.join(',');
}

// doForward() / doNegSale() payload message.
export function forwardMessage(data, negative) {
  const parts = [];
  let total = 0;
  DARA_NUMS.forEach((n) => {
    const x = v(data, n);
    if (x) { const val = negative ? -x : x; parts.push(`${String(n).padStart(2, '0')}=${val}`); total += val; }
  });
  AKHAR_ALL.forEach((n) => {
    const x = v(data, n);
    if (x) { const val = negative ? -x : x; parts.push(`${n}=${val}`); total += val; }
  });
  return { message: parts.join(','), total };
}
