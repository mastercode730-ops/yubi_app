import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import GameHistorySheet from '../components/GameHistorySheet';
import { MONTHS, displayDate, firstOfMonthDMY, istDMY } from '../lib/dates';
import { fmtNum } from '../lib/format';
import { param } from '../lib/nav';
import { Button, Card, EmptyState, Header, Loading, Row, Screen, Segmented, StatTile, tap } from '../ui/kit';
import { DateField, SelectField } from '../ui/Sheet';
import { colors, font, radius, space, weight } from '../theme';

const SALE = ['sale', 'self hissa', 'self comm'];

// dd/MMM/yyyy for /api/hisab/game-hisab-history (all-balance-sheet toDdMmmYyyy).
function monDate(v) {
  const s = String(v || '');
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${MONTHS[parseInt(iso[2], 10) - 1]}/${iso[1]}`;
  const d = new Date(s);
  return isNaN(d) ? s : `${String(d.getDate()).padStart(2, '0')}/${MONTHS[d.getMonth()]}/${d.getFullYear()}`;
}

export default function BalanceSheet() {
  const q = useLocalSearchParams();
  const { isStaff } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [cust, setCust] = useState(param(q.UID));
  const [from, setFrom] = useState(firstOfMonthDMY());
  const [to, setTo] = useState(istDMY());
  const [type, setType] = useState('all');
  const [rows, setRows] = useState(undefined);
  const [hist, setHist] = useState(null);

  const load = async (c = cust, f = from, t = to) => {
    if (!c) return;
    setRows(null);
    const r = await api.get('/api/balance/game-balance-history', { customerUID: c, fromDate: f, toDate: t });
    setRows(r?.data || []);
  };

  useEffect(() => {
    (async () => {
      let list = [];
      if (isStaff) {
        const hr = await api.get('/api/hisab/customers');
        list = hr?.data?.length ? hr.data : (await api.get('/api/home/receiver-list'))?.data || [];
      } else {
        list = (await api.get('/api/home/receiver-list'))?.data || [];
      }
      setCustomers(list.slice().sort((a, b) => (a.CustomerName || '').localeCompare(b.CustomerName || '')));
      if (param(q.UID)) load(param(q.UID));
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const display = useMemo(() => {
    if (!rows) return [];
    let f = rows;
    if (type === 'sale') f = rows.filter((d) => { const t = (d.Type || '').toLowerCase(); return SALE.includes(t) || t.includes('adjust'); });
    else if (type === 'accounts') f = rows.filter((d) => { const t = (d.Type || '').toLowerCase(); return ![...SALE, 'opening'].includes(t) && !t.includes('adjust'); });
    let running = 0;
    return f.map((d) => {
      const win = d.WinAmount !== undefined && d.WinAmount !== null ? parseFloat(d.WinAmount) : (parseFloat(d.Lene) || 0) - (parseFloat(d.Dene) || 0);
      running += win;
      return {
        ...d, run: running,
        lene: d.Lene !== undefined && d.Lene !== null && d.Lene !== '' ? parseFloat(d.Lene) : win > 0 ? win : 0,
        dene: d.Dene !== undefined && d.Dene !== null && d.Dene !== '' ? parseFloat(d.Dene) : win < 0 ? Math.abs(win) : 0,
      };
    });
  }, [rows, type]);

  const totLene = display.reduce((s, d) => s + (d.lene || 0), 0);
  const totDene = display.reduce((s, d) => s + (d.dene || 0), 0);
  const name = customers.find((c) => String(c.UID) === String(cust))?.CustomerName || '';
  const custOptions = useMemo(() => customers.map((c) => ({ value: String(c.UID ?? ''), label: c.CustomerName || c.Mobile, sub: c.Mobile })), [customers]);

  const openHist = async (d) => {
    const t = (d.Type || '').toLowerCase();
    if (!d.MessageDateTime || t === 'received' || t === 'paid') return;
    const ds = monDate(d.MessageDateTime);
    setHist({ title: `${name} — Game History (${ds})`, rows: null });
    const r = await api.get('/api/hisab/game-hisab-history', { date: ds, uid: cust });
    setHist({ title: `${name} — Game History (${ds})`, rows: r?.success ? r.data || [] : [] });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Balance Sheet" subtitle={name || 'Customer ledger'} />
      <Screen scroll>
        <Card>
          <SelectField label="Customer" value={cust} options={custOptions} onChange={(v) => { setCust(v); load(v); }} placeholder="Select Customer" searchable avatars />
          <Row gap={10}>
            <DateField label="From Date" value={from} onChange={setFrom} style={{ flex: 1 }} />
            <DateField label="To Date" value={to} onChange={setTo} style={{ flex: 1 }} />
          </Row>
          <Button title="Load" icon="refresh" onPress={() => load()} loading={rows === null} disabled={!cust} />
        </Card>
        <Segmented value={type} onChange={setType} options={[{ key: 'all', label: 'All' }, { key: 'sale', label: 'Sale' }, { key: 'accounts', label: 'Account' }]} style={{ marginBottom: space.md }} />
        {rows === undefined ? (
          <EmptyState icon="document-text-outline" title="Select a customer and tap Load" />
        ) : rows === null ? <Loading inline /> : display.length === 0 ? (
          <EmptyState icon="file-tray-outline" title={rows.length ? `No records found for ${type.toUpperCase()}` : 'No records found'} />
        ) : (
          <>
            <Row gap={8} style={{ marginBottom: space.md }}>
              <StatTile label="Debit (Lene)" value={fmtNum(totLene)} tone="success" />
              <StatTile label="Credit (Dene)" value={fmtNum(totDene)} tone="danger" />
              <StatTile label={`Net (${display.length})`} value={fmtNum(totLene - totDene)} tone={totLene - totDene < 0 ? 'danger' : 'brand'} />
            </Row>
            <View style={styles.table}>
              <View style={[styles.tr, styles.th]}>
                <Text style={[styles.thText, { flex: 1.3 }]}>Date</Text>
                <Text style={[styles.thText, styles.r]}>Lene</Text>
                <Text style={[styles.thText, styles.r]}>Dene</Text>
                <Text style={[styles.thText, styles.r, { flex: 1.2 }]}>Balance</Text>
              </View>
              {display.map((d, i) => {
                const t = (d.Type || '').toLowerCase();
                const tappable = d.MessageDateTime && t !== 'received' && t !== 'paid';
                return (
                  <Pressable key={i} disabled={!tappable} onPress={() => { tap(); openHist(d); }} style={({ pressed }) => [styles.tr, i % 2 === 1 && { backgroundColor: '#FBFBFE' }, pressed && { backgroundColor: colors.brandSoft }]}>
                    <View style={{ flex: 1.3 }}>
                      <Text style={styles.td}>{displayDate(d.MessageDateTime)}</Text>
                      <Text style={[styles.type, tappable && { color: colors.brandText }]}>{d.Type || ''}</Text>
                    </View>
                    <Text style={[styles.td, styles.r, { color: colors.success }]}>{d.lene > 0 ? fmtNum(d.lene) : ''}</Text>
                    <Text style={[styles.td, styles.r, { color: colors.danger }]}>{d.dene > 0 ? fmtNum(d.dene) : ''}</Text>
                    <Text style={[styles.td, styles.r, { flex: 1.2, fontWeight: weight.heavy, color: d.run < 0 ? colors.danger : colors.success }]}>{fmtNum(d.run)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.hint}>Tap a sale row to see that day’s game-wise breakdown</Text>
          </>
        )}
      </Screen>
      <GameHistorySheet visible={!!hist} onClose={() => setHist(null)} title={hist?.title} rows={hist?.rows} loading={hist && hist.rows === null} />
    </View>
  );
}

const styles = StyleSheet.create({
  table: { backgroundColor: colors.card, borderRadius: radius.md, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  th: { backgroundColor: '#F1F2F8' },
  thText: { flex: 1, fontSize: font.xs, fontWeight: weight.heavy, color: colors.muted, textTransform: 'uppercase' },
  r: { textAlign: 'right' },
  td: { flex: 1, fontSize: font.sm, color: colors.text, fontVariant: ['tabular-nums'], fontWeight: weight.semi },
  type: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
  hint: { fontSize: font.xs, color: colors.muted, textAlign: 'center', marginTop: space.sm },
});
