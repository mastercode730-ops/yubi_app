import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import Guard from '../components/Guard';
import { istDMY, toDMY, toISO } from '../lib/dates';
import { cleanName, fmtInt, onlyDigits, sumBy } from '../lib/format';
import { exportWorkbook } from '../lib/excel';
import { Amount, Button, Card, Field, Header, HeaderAction, Loading, Row, Screen, Segmented, SectionTitle, tap } from '../ui/kit';
import { DateField, Sheet } from '../ui/Sheet';
import DataTable from '../ui/DataTable';
import { toast } from '../ui/Toast';
import { colors, font, radius, space, weight } from '../theme';

const nameOf = (r) => cleanName(r.CustomerName || r.CMobile || r.UID || '');
const sortRows = (rows) => [...rows].sort((a, b) => nameOf(a).localeCompare(nameOf(b)) || String(a.CMobile || '').localeCompare(String(b.CMobile || '')));
const match = (t) => (r) => (r.CMobile || '').toLowerCase().includes(t) || (r.CustomerName || '').toLowerCase().includes(t) || nameOf(r).toLowerCase().includes(t);

function FilterBox({ value, onChange }) {
  return (
    <View style={styles.search}>
      <Ionicons name="search" size={16} color={colors.faint} />
      <TextInput value={value} onChangeText={onChange} placeholder="Filter name / mobile" placeholderTextColor={colors.faint} style={styles.searchInput} />
      {value ? <Pressable onPress={() => onChange('')}><Ionicons name="close-circle" size={17} color={colors.faint} /></Pressable> : null}
    </View>
  );
}

function BalanceScreen() {
  const { user, isStaff } = useAuth();
  const [date, setDate] = useState('');
  const [game, setGame] = useState(null);
  const [uttar, setUttar] = useState(null);
  const [staffRows, setStaffRows] = useState(null);
  const [staffTotal, setStaffTotal] = useState(0);
  const [mine, setMine] = useState(null);
  const [f1, setF1] = useState(''); const [f2, setF2] = useState(''); const [f3, setF3] = useState('');
  const [staffBal, setStaffBal] = useState(null);
  const [tab, setTab] = useState('game');
  const [txn, setTxn] = useState(null);

  const bind = useCallback(async (d) => {
    if (!d) return;
    setF1(''); setF2(''); setF3('');
    setGame(null); setUttar(null); setMine(null); setStaffRows(null);
    const [r1, r2, r3, r4] = await Promise.all([
      api.get('/api/balance/my-balance', { date: d, filter: '' }),
      api.get('/api/balance/game-balance', { date: d, filter: '' }),
      api.get('/api/balance/uttar-balance', { date: d, filter: '' }),
      isStaff ? Promise.resolve(null) : api.get('/api/balance/staff-grid', { date: d }),
    ]);
    setMine(r1?.success ? r1.data || [] : []);
    setGame(r2?.success ? r2.data || [] : []);
    setUttar(r3?.success ? r3.data || [] : []);
    if (!isStaff) {
      setStaffRows(r4?.success && r4.data?.length ? r4.data : []);
      setStaffTotal(r4?.success && r4.data?.length ? parseFloat(r4.totalBalance) || 0 : 0);
    }
  }, [isStaff]);

  useEffect(() => {
    (async () => {
      const dr = await api.get('/api/balance/latest-date');
      const v = dr?.dmy || dr?.data || dr?.date;
      const d = dr?.success && v ? toDMY(v) : istDMY();
      setDate(d);
      if (isStaff) {
        const sr = await api.get('/api/balance/staff-balance');
        if (sr?.success) setStaffBal(sr.balance);
      }
      bind(d);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const gameShown = useMemo(() => sortRows((game || []).filter(match(f1.toLowerCase()))), [game, f1]);
  const uttarShown = useMemo(() => sortRows((uttar || []).filter(match(f2.toLowerCase()))), [uttar, f2]);
  const mineShown = useMemo(() => sortRows((mine || []).filter(match(f3.toLowerCase()))), [mine, f3]);
  const staffShown = useMemo(() => [...(staffRows || [])].sort((a, b) => (a.subusername || '').localeCompare(b.subusername || '')), [staffRows]);
  // CalculateTotalNetBalance(): staff + game balance + uttar balance (My Balance excluded).
  const netTotal = Math.trunc((parseFloat(staffTotal) || 0) + sumBy(gameShown, 'WinAmount') + sumBy(uttarShown, 'WinAmount'));

  const openSheet = (uid, selectUID) => router.push({ pathname: '/balance-sheet', params: { UID: String(uid), SelectUID: String(selectUID) } });

  const balCols = (selectUID, withAdd) => [
    { key: 'sr', title: '#', width: 30, render: (r, i) => i + 1 },
    { key: 'name', title: selectUID === 2 ? 'Name' : 'Customer', flex: 2, render: (r) => nameOf(r), link: true, lines: 1 },
    { key: 'Opening', title: 'Opening', flex: 1.1, align: 'right', render: (r) => fmtInt(r.Opening) },
    { key: 'Today', title: 'Today', flex: 1, align: 'right', render: (r) => fmtInt(r.Today) },
    { key: 'WinAmount', title: 'Balance', flex: 1.2, align: 'right', render: (r) => <Amount value={r.WinAmount} style={{ fontSize: font.sm }} /> },
    ...(withAdd ? [{ key: 'add', title: 'Add', width: 46, align: 'center', render: (r) => (
      <Pressable hitSlop={6} onPress={() => { tap(); setTxn({ cid: r.CID, name: nameOf(r), amount: '', type: 'Paid' }); }} style={styles.addBtn}>
        <Ionicons name="add" size={16} color={colors.brand} />
      </Pressable>
    ) }] : []),
  ];
  const balFooter = (rows) => ({ sr: '', name: 'Total', Opening: fmtInt(sumBy(rows, 'Opening')), Today: fmtInt(sumBy(rows, 'Today')), WinAmount: fmtInt(sumBy(rows, 'WinAmount')), add: '' });

  const exportXlsx = () => {
    const bal = (rows, label) => {
      const s = sortRows(rows || []);
      const aoa = [['SRNo', label, 'Opening', 'Today', 'Balance']];
      s.forEach((r, i) => aoa.push([i + 1, nameOf(r), parseFloat(r.Opening) || 0, parseFloat(r.Today) || 0, parseFloat(r.WinAmount) || 0]));
      aoa.push(['', 'Total', sumBy(s, 'Opening'), sumBy(s, 'Today'), sumBy(s, 'WinAmount')]);
      return aoa;
    };
    const staffAoa = [['SRNo', 'Sub User', 'Balance']];
    staffShown.forEach((r, i) => staffAoa.push([i + 1, r.subusername || r.SubUserID, parseFloat(r.Balance) || 0]));
    staffAoa.push(['', 'Total', sumBy(staffShown, 'Balance')]);
    exportWorkbook(`Balance_${(date || '').replace(/\//g, '-')}`, [
      { name: 'My Game Balance', rows: bal(game, 'Customer') },
      { name: 'Uttar Balance', rows: bal(uttar, 'Customer') },
      { name: 'Sub User Balance', rows: staffAoa },
      { name: 'My Balance', rows: bal(mine, 'Name') },
    ]);
  };

  const addTxn = async () => {
    if (!txn?.cid || !txn.amount) { toast('Amount bharo!', 'error'); return; }
    const r = await api.post('/api/balance/add-transaction', { customerCID: txn.cid, date, type: txn.type, amount: txn.amount });
    if (r?.success) { toast('Data Saved Successfully!'); setTxn(null); router.push('/accounts'); }
    else toast(r?.message || 'Error!', 'error');
  };

  const tabs = [
    { key: 'game', label: 'Game' }, { key: 'uttar', label: 'Uttar' },
    ...(!isStaff ? [{ key: 'staff', label: 'Sub User' }] : []), { key: 'mine', label: 'My Bal' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Balance" subtitle={date || ' '} right={<><HeaderAction icon="download-outline" onPress={exportXlsx} /><HeaderAction icon="receipt-outline" onPress={() => router.push('/accounts')} /></>} />
      <Screen scroll>
        <Row gap={10} align="flex-end">
          <DateField label="Date" value={date} onChange={(d) => { setDate(d); bind(d); }} style={{ flex: 1, marginBottom: 0 }} />
          <Button title="Find" icon="refresh" variant="secondary" onPress={() => bind(date)} style={{ height: 48 }} />
        </Row>
        {isStaff && staffBal !== null ? (
          <Card flat style={{ marginTop: space.md, marginBottom: 0 }}>
            <Text style={styles.staffBal}>Net Bal of SubUser {user?.SubUID} : <Text style={{ color: (parseFloat(staffBal) || 0) < 0 ? colors.danger : colors.success }}>{staffBal}</Text></Text>
          </Card>
        ) : null}
        {!isStaff ? (
          <View style={[styles.net, { backgroundColor: netTotal < 0 ? colors.danger : colors.brand }]}>
            <Text style={styles.netLabel}>Total Net Balance</Text>
            <Text style={styles.netVal}>{fmtInt(netTotal)}</Text>
            <Text style={styles.netSub}>Sub users + My Game Balance + Uttar Balance</Text>
          </View>
        ) : <View style={{ height: space.md }} />}

        <Segmented options={tabs} value={tab} onChange={setTab} style={{ marginBottom: space.md }} />

        {tab === 'game' ? (
          <>
            <SectionTitle title="My Game Balance" hint="Tap a customer to open the balance sheet" style={{ marginTop: 0 }} />
            <FilterBox value={f1} onChange={setF1} />
            {game === null ? <Loading inline /> : <DataTable columns={balCols(1, isStaff)} rows={gameShown} footer={balFooter(gameShown)} onRowPress={(r) => openSheet(r.UID, 1)} />}
          </>
        ) : null}
        {tab === 'uttar' ? (
          <>
            <SectionTitle title="Uttar Balance" style={{ marginTop: 0 }} />
            <FilterBox value={f2} onChange={setF2} />
            {uttar === null ? <Loading inline /> : <DataTable columns={balCols(1, isStaff)} rows={uttarShown} footer={balFooter(uttarShown)} onRowPress={(r) => openSheet(r.UID, 1)} />}
          </>
        ) : null}
        {tab === 'staff' && !isStaff ? (
          <>
            <SectionTitle title="Sub User Balance" hint="Tap a sub user to see their transactions" style={{ marginTop: 0 }} />
            {staffRows === null ? <Loading inline /> : (
              <DataTable
                columns={[
                  { key: 'sr', title: '#', width: 34, render: (r, i) => i + 1 },
                  { key: 'subusername', title: 'Sub User', flex: 2, render: (r) => r.subusername || r.SubUserID, link: true },
                  { key: 'Balance', title: 'Balance', flex: 1.2, align: 'right', render: (r) => <Amount value={r.Balance} style={{ fontSize: font.sm }} /> },
                ]}
                rows={staffShown}
                footer={{ sr: '', subusername: 'Total', Balance: fmtInt(staffTotal) }}
                onRowPress={(r) => { const iso = toISO(date || istDMY()); router.push({ pathname: '/transactions', params: { SUID: String(r.SubUserID), ...(iso ? { from: iso, to: iso } : {}) } }); }}
              />
            )}
          </>
        ) : null}
        {tab === 'mine' ? (
          <>
            <SectionTitle title="My Balance" style={{ marginTop: 0 }} />
            <FilterBox value={f3} onChange={setF3} />
            {mine === null ? <Loading inline /> : <DataTable columns={balCols(2, false)} rows={mineShown} footer={balFooter(mineShown)} onRowPress={(r) => openSheet(r.UID, 2)} />}
          </>
        ) : null}
      </Screen>

      <Sheet
        visible={!!txn}
        onClose={() => setTxn(null)}
        title="Transaction"
        subtitle={txn?.name}
        footer={<Button title="ADD" icon="add" onPress={addTxn} full />}
      >
        {txn ? (
          <>
            <Field label="Amount" value={txn.amount} onChangeText={(t) => setTxn((x) => ({ ...x, amount: onlyDigits(t) }))} keyboardType="number-pad" placeholder="Enter Amount" autoFocus />
            <Segmented value={txn.type} onChange={(t) => setTxn((x) => ({ ...x, type: t }))} options={[{ key: 'Paid', label: 'Paid' }, { key: 'Received', label: 'Received' }]} />
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

export default function Balance() {
  return <Guard menuKey="balance" title="Balance"><BalanceScreen /></Guard>;
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: radius.md, height: 42, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, marginBottom: space.sm },
  searchInput: { flex: 1, fontSize: font.base, color: colors.text, paddingVertical: 0 },
  net: { borderRadius: radius.lg, padding: space.lg, marginVertical: space.md },
  netLabel: { color: 'rgba(255,255,255,0.8)', fontWeight: weight.bold, fontSize: font.sm },
  netVal: { color: '#fff', fontWeight: weight.heavy, fontSize: 30, marginTop: 2, fontVariant: ['tabular-nums'] },
  netSub: { color: 'rgba(255,255,255,0.7)', fontSize: font.xs, marginTop: 2 },
  staffBal: { fontWeight: weight.heavy, color: colors.text },
  addBtn: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
});
