import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/client';
import Guard from '../components/Guard';
import { istDMY, toDMY } from '../lib/dates';
import { cleanName5, fmtNum } from '../lib/format';
import { param } from '../lib/nav';
import { exportWorkbook } from '../lib/excel';
import { Button, Card, EmptyState, Header, HeaderAction, Loading, Row, Screen, Segmented } from '../ui/kit';
import { DateField, SelectField } from '../ui/Sheet';
import DataTable from '../ui/DataTable';
import { toast } from '../ui/Toast';
import { colors, font, radius, space, weight } from '../theme';

const NUM = ['Total_Amount', 'D_Sale', 'A_Sale', 'Commision', 'O_Dara', 'O_Akhar', 'WinAmount', 'Pati', 'Balance'];
const COLS = [
  { key: 'CustomerName', title: 'Customer', width: 120, short: true },
  { key: 'GameName', title: 'Game', width: 92 },
  { key: 'Rates', title: 'Rates', width: 108, short: true },
  { key: 'Total_Amount', title: 'T_Sale', width: 76, short: true },
  { key: 'D_Sale', title: 'D_Sale', width: 72 },
  { key: 'A_Sale', title: 'A_Sale', width: 72 },
  { key: 'Commision', title: 'Comm', width: 70 },
  { key: 'O_Dara', title: 'O_Dara', width: 70, short: true },
  { key: 'O_Akhar', title: 'O_Akhar', width: 74, short: true },
  { key: 'WinAmount', title: 'Win_Amt', width: 76 },
  { key: 'Pati', title: 'Hissa', width: 70 },
  { key: 'Balance', title: 'Balance', width: 82 },
  { key: 'Result', title: 'Result', width: 64, short: true },
];

function sortRows(rows, col, dir) {
  const data = [...rows];
  data.sort((a, b) => {
    let va = a[col], vb = b[col];
    if (col === 'CustomerName') { va = cleanName5(a.CustomerName || a.Mobile); vb = cleanName5(b.CustomerName || b.Mobile); }
    if (NUM.includes(col)) { const d = (parseFloat(va) || 0) - (parseFloat(vb) || 0); return dir === 'asc' ? d : -d; }
    if (col === 'Result') {
      const na = parseFloat(va), nb = parseFloat(vb);
      const ia = !isNaN(na) && String(va || '').trim() !== '', ib = !isNaN(nb) && String(vb || '').trim() !== '';
      if (ia && ib) return dir === 'asc' ? na - nb : nb - na;
      if (ia !== ib) return (ia ? -1 : 1) * (dir === 'asc' ? 1 : -1);
    }
    const c = String(va || '').trim().localeCompare(String(vb || '').trim(), undefined, { numeric: true, sensitivity: 'base' });
    return dir === 'asc' ? c : -c;
  });
  return data;
}

function HisabSummaryScreen() {
  const q = useLocalSearchParams();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [games, setGames] = useState([]);
  const [gid, setGid] = useState(param(q.GID));
  const [customers, setCustomers] = useState([]);
  const [cid, setCid] = useState('');
  const [rows, setRows] = useState(undefined);
  const [sort, setSort] = useState({ col: null, dir: 'asc' });
  const [short, setShort] = useState(false);
  const [lastQuery, setLastQuery] = useState(null);

  const bind = async (o = {}) => {
    const s = o.from ?? from, e = o.to ?? to, g = o.gid ?? gid, c = o.cid ?? cid;
    setRows(null);
    setSort({ col: null, dir: 'asc' });
    const r = await api.get('/api/hisab/summary', { startDate: s, endDate: e, gid: g, cid: c });
    let data = r?.data || [];
    // Split game IDs fallback (same rule as the web page).
    const gName = (games.find((x) => String(x.GID) === String(g))?.GameName || '').trim();
    if (g && gName && !data.length) {
      const rAll = await api.get('/api/hisab/summary', { startDate: s, endDate: e, gid: '', cid: c });
      if (rAll?.success && Array.isArray(rAll.data)) {
        const target = gName.toLowerCase().replace(/[^a-z0-9]/g, '');
        data = rAll.data.filter((row) => {
          const n = String(row.GameName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          if (n === target) return true;
          if (target.includes('delhi') && (n.includes('delhi') || n.includes('bazar') || n.includes('bazaar'))) return true;
          if (target.includes('ganesh') && n.includes('ganesh')) return true;
          return false;
        });
      }
    }
    setLastQuery({ s, e, g, c, gName, cName: customers.find((x) => String(x.UID) === String(c))?.CustomerName || '' });
    setRows(data);
    setCid('');
  };

  useEffect(() => {
    (async () => {
      const [rg, rc, rl] = await Promise.all([api.get('/api/game'), api.get('/api/hisab/customers'), api.get('/api/hisab/latest-date')]);
      setGames(rg?.data || []);
      setCustomers((rc?.data || []).sort((a, b) => (a.CustomerName || '').localeCompare(b.CustomerName || '')));
      const v = rl?.dmy || rl?.data || rl?.date;
      const d = rl?.success && v ? toDMY(v) : istDMY();
      setFrom(d); setTo(d);
      if (param(q.UID) && param(q.Date)) {
        const dd = toDMY(param(q.Date));
        setFrom(dd); setTo(dd); setCid(param(q.UID));
        bind({ from: dd, to: dd, cid: param(q.UID) });
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = useMemo(() => (rows && sort.col ? sortRows(rows, sort.col, sort.dir) : rows || []), [rows, sort]);
  const total = (k) => Math.round((rows || []).reduce((a, r) => a + (parseFloat(r[k]) || 0), 0));
  const balance = total('Balance');

  const custUID = (row) => {
    if (row.CustUID) return String(row.CustUID);
    if (row.UID) return String(row.UID);
    const raw = String(row.CustomerName || '').trim().toLowerCase();
    const mob = String(row.Mobile || '').trim().toLowerCase();
    const clean = raw.replace(/\s+\d{4,5}$/, '').trim();
    const f = customers.find((c) => {
      const n = String(c.CustomerName || '').trim().toLowerCase();
      const m = String(c.Mobile || '').trim().toLowerCase();
      return (raw && (n === raw || m === raw)) || (mob && (n === mob || m === mob)) || (clean && (n.replace(/\s+\d{4,5}$/, '') === clean || m === clean));
    });
    return f?.UID ? String(f.UID) : '';
  };

  const onSort = (col) => setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }));

  const columns = COLS.filter((c) => !short || c.short).map((c) => ({
    ...c,
    title: (
      <Pressable onPress={() => onSort(c.key)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <Text style={styles.th}>{c.title}</Text>
        <Ionicons name={sort.col === c.key ? (sort.dir === 'asc' ? 'caret-up' : 'caret-down') : 'swap-vertical'} size={11} color={sort.col === c.key ? colors.brand : colors.faint} />
      </Pressable>
    ),
    align: NUM.includes(c.key) ? 'right' : 'left',
    render: c.key === 'CustomerName' ? (r) => cleanName5(r.CustomerName || r.Mobile) : NUM.includes(c.key) ? (r) => fmtNum(r[c.key] || 0) : undefined,
    link: c.key === 'CustomerName',
    bold: c.key === 'Balance' || c.key === 'Result',
    color: c.key === 'Balance' ? (r) => ((parseFloat(r.Balance) || 0) < 0 ? colors.danger : colors.success) : undefined,
  }));
  const footer = { CustomerName: '', GameName: '', Rates: 'Total', Result: 'Result', ...Object.fromEntries(NUM.map((k) => [k, fmtNum(total(k), 0)])) };

  const exportXlsx = () => {
    if (!rows?.length || !lastQuery) { toast('Pehle search karo', 'error'); return; }
    let name = 'AllSummary';
    if (lastQuery.cName && lastQuery.gName) name = lastQuery.gName + lastQuery.cName;
    else if (lastQuery.cName) name = lastQuery.cName;
    else if (lastQuery.gName) name = lastQuery.gName;
    name += lastQuery.s.replace(/\//g, '');
    const aoa = [['Customer', 'Game', 'Rates', 'T_Sale', 'D_Sale', 'A_Sale', 'Comm', 'O_Dara', 'O_Akhar', 'Win_Amt', 'Hissa', 'Balance', 'Result']];
    rows.forEach((r) => aoa.push([r.Mobile ?? r.CustomerName ?? '', r.GameName ?? '', r.Rates ?? '', ...NUM.map((k) => parseFloat(r[k]) || 0), r.Result ?? '']));
    exportWorkbook(name, [{ name: 'Sheet1', rows: aoa }]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Hisab Summary" subtitle={from && to ? `${from} → ${to}` : ' '} right={<HeaderAction icon="download-outline" onPress={exportXlsx} />} />
      <Screen scroll>
        <Card>
          <Row gap={10}>
            <DateField label="From Date" value={from} onChange={setFrom} style={{ flex: 1 }} />
            <DateField label="To Date" value={to} onChange={setTo} style={{ flex: 1 }} />
          </Row>
          <Row gap={10}>
            <SelectField label="Game" value={gid} options={games.map((g) => ({ value: String(g.GID), label: g.GameName }))} onChange={(v) => setGid(v || '')} placeholder="All Game" allowClear clearLabel="All Game" style={{ flex: 1 }} />
            <SelectField label="Customer" value={cid} options={customers.map((c) => ({ value: String(c.UID ?? ''), label: c.CustomerName, sub: c.Mobile }))} onChange={(v) => setCid(v || '')} placeholder="All Customer" allowClear clearLabel="All Customer" searchable avatars style={{ flex: 1 }} />
          </Row>
          <Button title="Search" icon="search" onPress={() => bind()} />
        </Card>

        {rows === undefined ? (
          <EmptyState icon="stats-chart-outline" title="Search to see the summary" message="Pick dates (and optionally a game or customer), then tap Search." />
        ) : rows === null ? <Loading inline /> : rows.length === 0 ? (
          <EmptyState icon="file-tray-outline" title="No Data Found!" />
        ) : (
          <>
            <Row justify="space-between" style={{ marginBottom: space.sm }}>
              <View style={[styles.bal, { backgroundColor: balance < 0 ? colors.dangerSoft : balance > 0 ? colors.successSoft : colors.cardAlt }]}>
                <Text style={styles.balLabel}>Balance</Text>
                <Text style={[styles.balVal, { color: balance < 0 ? colors.danger : balance > 0 ? colors.success : colors.text }]}>{fmtNum(balance, 0)}</Text>
              </View>
              <Segmented small value={short ? 'short' : 'full'} onChange={(k) => setShort(k === 'short')} options={[{ key: 'full', label: 'Full' }, { key: 'short', label: 'Short' }]} style={{ width: 150 }} />
            </Row>
            <DataTable
              scroll
              dense
              columns={columns}
              rows={sorted}
              footer={footer}
              onRowPress={(r) => { const u = custUID(r); if (u) router.push({ pathname: '/balance-sheet', params: { UID: u, SelectUID: '1' } }); }}
            />
            <Text style={styles.hint}>Tap a row to open that customer’s balance sheet · tap a column title to sort</Text>
          </>
        )}
      </Screen>
    </View>
  );
}

export default function HisabSummary() {
  return <Guard menuKey="hisab-summary" title="Hisab Summary"><HisabSummaryScreen /></Guard>;
}

const styles = StyleSheet.create({
  th: { fontSize: font.xs, fontWeight: weight.heavy, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.3 },
  bal: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md },
  balLabel: { fontWeight: weight.bold, color: colors.textSoft },
  balVal: { fontWeight: weight.heavy, fontSize: font.lg },
  hint: { fontSize: font.xs, color: colors.muted, textAlign: 'center', marginTop: space.sm },
});
