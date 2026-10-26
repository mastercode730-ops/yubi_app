import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/client';
import Guard from '../components/Guard';
import { istDMY, toDMY } from '../lib/dates';
import { fmtNum } from '../lib/format';
import { Amount, Button, Card, Header, KeyValue, Loading, Row, Screen, Segmented } from '../ui/kit';
import { DateField, Sheet } from '../ui/Sheet';
import DataTable from '../ui/DataTable';
import { toast } from '../ui/Toast';
import { colors, font, radius, space, weight } from '../theme';

const n = (v) => +v || 0;

function LCScreen() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [delDate, setDelDate] = useState('');
  const [data, setData] = useState(null); // { main, uttar, ref, hissa }
  const [tab, setTab] = useState('main');
  const [filter, setFilter] = useState('');
  const [hist, setHist] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadAll = useCallback(async (f, t) => {
    if (!f || !t) return;
    setData(null);
    const p = { dateFrom: f, dateTo: t };
    const [r1, r2, r3, r4] = await Promise.all([
      api.get('/api/lc/main', p), api.get('/api/lc/uttar', p), api.get('/api/lc/reference', p), api.get('/api/lc/third-party', p),
    ]);
    setData({ main: r1?.data || [], uttar: r2?.data || [], ref: r3?.data || [], hissa: r4?.data || [] });
  }, []);

  useEffect(() => {
    (async () => {
      const dr = await api.get('/api/hisab/latest-date');
      const v = dr?.dmy || dr?.data || dr?.date;
      const d = dr?.success && v ? toDMY(v) : istDMY();
      setFrom(d); setTo(d); setDelDate(d);
      loadAll(d, d);
    })();
  }, [loadAll]);

  const mainShown = useMemo(() => {
    const t = filter.toLowerCase();
    return !t ? data?.main || [] : (data?.main || []).filter((r) => (r.CustomerName || '').toLowerCase().includes(t) || (r.Mobile || '').toLowerCase().includes(t));
  }, [data, filter]);

  const open = (r, nameKey) => setHist({
    title: `${r[nameKey] || r.CustomerName || ''}${r.Mobile ? ` ( ${r.Mobile} )` : ''}`,
    total: r.TotalAmount || 0, comm: r.Commision || 0, win: r.WinAmt || 0, pati: n(r.Pati_Amt) * -1, bal: r.WinAmount || 0,
  });

  const name = (key) => ({ key: 'name', title: 'Customer', flex: 2, lines: 2, render: (r) => (
    <View><Text style={styles.cust} numberOfLines={1}>{r[key] || r.CustomerName || ''}</Text>{r.Mobile ? <Text style={styles.mob}>{r.Mobile}</Text> : null}</View>
  ) });
  const money = (key, title, colored, flex = 1) => ({ key, title, flex, align: 'right', render: (r) => (colored ? <Amount value={r[key]} decimals={2} style={{ fontSize: font.sm }} /> : fmtNum(r[key] || 0)) });
  const std = (nameKey, adjKey) => [
    name(nameKey), money('WinAmount', 'Sale Bal'), money(adjKey, 'Adjust'), money('AdjustWinAmount', 'Net Bal', true, 1.1),
    { key: 'LC', title: 'LC%', width: 46, align: 'right', render: (r) => `${r.LC || 0}%` }, money('LCAmount', 'LC Amt', true),
  ];
  const stdFoot = (rows, adjKey) => ({
    name: 'Total', WinAmount: fmtNum(rows.reduce((s, r) => s + n(r.WinAmount), 0)), [adjKey]: fmtNum(rows.reduce((s, r) => s + n(r[adjKey]), 0)),
    AdjustWinAmount: fmtNum(rows.reduce((s, r) => s + n(r.AdjustWinAmount), 0)), LC: '', LCAmount: fmtNum(rows.reduce((s, r) => s + n(r.LCAmount), 0)),
  });

  const totAdjWin = (data?.main || []).reduce((s, r) => s + n(r.AdjustWinAmount), 0);
  const totLC = (data?.main || []).reduce((s, r) => s + n(r.LCAmount), 0);

  const post = async () => {
    setConfirm(null);
    if (!to) { toast('Select To Date first', 'error'); return; }
    if (!data || (!data.main.length && !data.uttar.length && !data.hissa.length && !data.ref.length)) { toast('No data to post', 'error'); return; }
    setBusy(true);
    const map = (rows) => rows.map((r) => ({ fCusID: r.fCusID || r.UID, LCAmount: r.LCAmount }));
    const r = await api.post('/api/lc/post', { dateTo: to, mainRows: map(data.main), uttarRows: map(data.uttar), hissaRows: map(data.hissa), referenceRows: map(data.ref) });
    setBusy(false);
    if (r?.success) toast('LC Posted Successfully!'); else toast(r?.message || 'LC Already Exists!', 'error');
  };

  const del = async () => {
    setConfirm(null);
    if (!delDate) { toast('Select date first', 'error'); return; }
    setBusy(true);
    const r = await api.del('/api/lc/delete', { date: delDate });
    setBusy(false);
    if (r?.success) toast('Data Deleted Successfully!'); else toast(r?.message || 'Error', 'error');
  };

  const tabs = [
    { key: 'main', label: `Main${data ? ` ${data.main.length}` : ''}` },
    { key: 'uttar', label: `Uttar${data ? ` ${data.uttar.length}` : ''}` },
    { key: 'ref', label: `Ref${data ? ` ${data.ref.length}` : ''}` },
    { key: 'hissa', label: `3rd${data ? ` ${data.hissa.length}` : ''}` },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="LC" subtitle="LC percentage & posting" />
      <Screen scroll>
        <Card>
          <Row gap={10}>
            <DateField label="From Date" value={from} onChange={(d) => { setFrom(d); loadAll(d, to); }} style={{ flex: 1 }} />
            <DateField label="To Date" value={to} onChange={(d) => { setTo(d); loadAll(from, d); }} style={{ flex: 1 }} />
          </Row>
          <Row gap={10}>
            <Button title="Search" icon="search" variant="secondary" onPress={() => loadAll(from, to)} style={{ flex: 1 }} />
            <Button title="Post LC" icon="cloud-upload-outline" loading={busy && confirm === null} onPress={() => setConfirm('post')} style={{ flex: 1 }} />
          </Row>
        </Card>

        {data ? (
          <View style={styles.totals}>
            <View style={{ flex: 1 }}><Text style={styles.tl}>Net Balance</Text><Text style={[styles.tv, { color: totAdjWin < 0 ? colors.danger : colors.success }]}>{fmtNum(totAdjWin)}</Text></View>
            <View style={{ flex: 1 }}><Text style={styles.tl}>LC</Text><Text style={[styles.tv, { color: totLC < 0 ? colors.danger : colors.success }]}>{fmtNum(totLC)}</Text></View>
          </View>
        ) : null}

        <Segmented small options={tabs} value={tab} onChange={setTab} style={{ marginBottom: space.md }} />
        {data === null ? <Loading inline /> : (
          <>
            {tab === 'main' ? (
              <>
                <View style={styles.search}>
                  <Ionicons name="search" size={16} color={colors.faint} />
                  <TextInput value={filter} onChangeText={setFilter} placeholder="Filter name / mobile" placeholderTextColor={colors.faint} style={styles.searchInput} />
                </View>
                <DataTable scroll columns={std('CustomerName', 'AdjustAmount').map(widen)} rows={mainShown} footer={stdFoot(mainShown, 'AdjustAmount')} onRowPress={(r) => open(r, 'CustomerName')} />
              </>
            ) : null}
            {tab === 'uttar' ? <DataTable scroll columns={std('CustomerName', 'AdjustAmount').map(widen)} rows={data.uttar} footer={stdFoot(data.uttar, 'AdjustAmount')} onRowPress={(r) => open(r, 'CustomerName')} /> : null}
            {tab === 'ref' ? <DataTable scroll columns={std('MyReferenceLC', 'MyAdjustAmount').map(widen)} rows={data.ref} footer={stdFoot(data.ref, 'MyAdjustAmount')} onRowPress={(r) => open(r, 'MyReferenceLC')} /> : null}
            {tab === 'hissa' ? (
              <DataTable
                columns={[name('CustomerName'), money('WinAmount', 'Net Balance'), money('LCAmount', 'LC Amt', true)]}
                rows={data.hissa}
                footer={{ name: 'Total', WinAmount: fmtNum(data.hissa.reduce((s, r) => s + n(r.WinAmount), 0)), LCAmount: fmtNum(data.hissa.reduce((s, r) => s + n(r.LCAmount), 0)) }}
              />
            ) : null}
          </>
        )}

        <Card style={{ marginTop: space.lg }}>
          <Text style={styles.delTitle}>Delete commission for a date</Text>
          <Row gap={10} align="flex-end">
            <DateField value={delDate} onChange={setDelDate} style={{ flex: 1, marginBottom: 0 }} />
            <Button title="Delete LC" icon="trash-outline" variant="dangerSoft" onPress={() => setConfirm('delete')} style={{ height: 48 }} />
          </Row>
        </Card>
      </Screen>

      <Sheet visible={!!hist} onClose={() => setHist(null)} title={hist?.title}>
        {hist ? (
          <View>
            <KeyValue label="Total Amount" value={String(hist.total)} />
            <KeyValue label="Commission Amount" value={`- ${hist.comm}`} valueStyle={{ color: colors.danger }} />
            <KeyValue label="Win Amount" value={`- ${hist.win}`} valueStyle={{ color: colors.danger }} />
            <KeyValue label="Hissa Amount" value={String(hist.pati)} valueStyle={{ color: colors.danger }} />
            <KeyValue label="Total Sale Balance" value={String(hist.bal)} valueStyle={{ color: colors.success, fontSize: font.lg }} />
          </View>
        ) : null}
      </Sheet>
      <Sheet
        visible={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm === 'post' ? 'Do you want to Post LC?' : 'Do you want to Delete it?'}
        subtitle={confirm === 'post' ? `Commission entries will be created for ${to}` : `Commission entries of ${delDate} will be removed`}
        footer={<Row gap={10}><Button title="Cancel" variant="outline" onPress={() => setConfirm(null)} style={{ flex: 1 }} /><Button title={confirm === 'post' ? 'Post LC' : 'Delete'} variant={confirm === 'post' ? 'primary' : 'danger'} onPress={confirm === 'post' ? post : del} style={{ flex: 1.3 }} /></Row>}
      />
    </View>
  );
}

// Wide tables scroll horizontally: give flex columns a fixed width.
const widen = (c) => (c.width ? c : { ...c, width: c.key === 'name' ? 140 : 88, flex: undefined });

export default function LC() {
  return <Guard menuKey="lc" title="LC"><LCScreen /></Guard>;
}

const styles = StyleSheet.create({
  cust: { fontSize: font.sm, fontWeight: weight.bold, color: colors.text },
  mob: { fontSize: font.xs, color: colors.muted },
  totals: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.md, padding: space.md, marginBottom: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  tl: { fontSize: font.xs, color: colors.muted, fontWeight: weight.bold },
  tv: { fontSize: font.xl, fontWeight: weight.heavy, marginTop: 2 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: radius.md, height: 42, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, marginBottom: space.sm },
  searchInput: { flex: 1, fontSize: font.base, color: colors.text, paddingVertical: 0 },
  delTitle: { fontWeight: weight.heavy, color: colors.text, marginBottom: space.sm },
});
