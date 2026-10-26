import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import Guard from '../components/Guard';
import { displayDate, isCompleteDMY, istDMY, toDMY, toISO } from '../lib/dates';
import { fmtNum, onlyDigits } from '../lib/format';
import { Badge, Button, Card, Field, Header, HeaderAction, Loading, Row, Screen, SectionTitle, tap } from '../ui/kit';
import { DateField, SelectField, Sheet } from '../ui/Sheet';
import { toast } from '../ui/Toast';
import { colors, font, radius, space, weight } from '../theme';

const TX_TYPES = [
  { value: 'Received', label: 'Receipt / Liye' },
  { value: 'Paid', label: 'Payment / Diye' },
  { value: 'Commission', label: 'Commission' },
  { value: 'Receive Adjustment', label: 'AdjustReceipt (−)' },
  { value: 'Paid Adjustment', label: 'AdjustPayment (+)' },
];

function NetBal({ value }) {
  if (value === null || value === undefined) return null;
  const b = parseFloat(value) || 0;
  return <Badge text={`Net Bal : ${fmtNum(b)}`} tone={b < 0 ? 'danger' : 'success'} icon="wallet-outline" style={{ marginTop: -6, marginBottom: space.md }} />;
}

function AccountsScreen() {
  const { user, isStaff } = useAuth();
  const staffKey = `accounts_last_staff_${user?.UID || 'default'}`;
  const [date, setDate] = useState('');
  const [customers, setCustomers] = useState([]);
  const [cust, setCust] = useState('');
  const [type, setType] = useState('Paid');
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');
  const [subusers, setSubusers] = useState([]);
  const [staff, setStaff] = useState('0');
  const [custBal, setCustBal] = useState(null);
  const [staffBal, setStaffBal] = useState(null);
  const [myStaffBal, setMyStaffBal] = useState(null);
  const [recent, setRecent] = useState(null);
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const amountRef = useRef(null);

  const loadMyStaffBal = useCallback(async () => {
    if (!isStaff) return;
    const r = await api.get('/api/balance/staff-balance');
    if (r?.success && r.balance !== undefined) setMyStaffBal(parseFloat(r.balance) || 0);
  }, [isStaff]);

  const fetchStaffBal = useCallback(async (val, d) => {
    if (!val || val === '0') { setStaffBal(null); return; }
    const r = await api.get('/api/balance/staff-grid', { date: d });
    const row = (r?.data || []).find((s) => String(s.SubUserID) === String(val));
    setStaffBal(row ? parseFloat(row.Balance || 0) : 0);
  }, []);

  const loadRecent = useCallback(async (uid) => {
    setSel(null);
    setRecent(null);
    const r = await api.get('/api/accounts/list', { customerUID: uid, fromDate: '2000-01-01', toDate: '2099-12-31' });
    const data = (r?.data || []).slice();
    data.sort((a, b) => (new Date(b.Date) - new Date(a.Date)) || (Number(b.AID) - Number(a.AID)));
    setRecent(data.slice(0, 10));
  }, []);

  const fetchNetBal = useCallback(async (uid) => {
    if (!uid || uid === 'Self') { setCustBal(null); setRecent(null); setSel(null); return; }
    loadRecent(uid);
    const r = await api.get('/api/accounts/selected-balance', { customerUID: uid });
    setCustBal(r?.success ? parseFloat(r.balance || 0) : null);
  }, [loadRecent]);

  useEffect(() => {
    (async () => {
      const [rc, rd] = await Promise.all([api.get('/api/accounts/customers'), api.get('/api/accounts/latest-date')]);
      const list = (rc?.data || []).slice().sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
      setCustomers(list);
      const v = rd?.dmy || rd?.data || rd?.date;
      const d = rd?.success && v ? toDMY(v) : istDMY();
      setDate(d);
      const savedType = await AsyncStorage.getItem('accounts_last_type').catch(() => null);
      if (savedType && TX_TYPES.some((t) => t.value === savedType)) setType(savedType);
      if (!isStaff) {
        const rs = await api.get('/api/accounts/subusers');
        const subs = (rs?.data || []).filter((s) => s.IsActive === undefined || s.IsActive === true || s.IsActive === 1 || String(s.IsActive).toLowerCase() === 'true' || String(s.IsActive) === '1');
        setSubusers(subs);
        const saved = (await AsyncStorage.getItem(staffKey).catch(() => null)) || (await AsyncStorage.getItem('accounts_last_staff').catch(() => null));
        if (saved && (saved === '0' || subs.some((s) => String(s.SubUserID) === String(saved)))) {
          setStaff(saved);
          fetchStaffBal(saved, d);
        }
      } else {
        loadMyStaffBal();
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const custOptions = useMemo(() => [{ value: 'Self', label: 'Self' }, ...customers.map((c) => ({ value: String(c.UID), label: c.Name }))], [customers]);
  const staffOptions = useMemo(() => [{ value: '0', label: 'Self' }, ...subusers.map((s) => ({ value: String(s.SubUserID), label: s.subusername || String(s.SubUserID) }))], [subusers]);

  const onCustomer = (v) => { setCust(v || ''); fetchNetBal(v); if (v) setTimeout(() => amountRef.current?.focus(), 250); };
  const onType = (v) => { setType(v); AsyncStorage.setItem('accounts_last_type', v).catch(() => {}); };
  const onStaff = (v) => {
    const val = v || '0';
    setStaff(val);
    AsyncStorage.setItem(staffKey, val).catch(() => {});
    AsyncStorage.setItem('accounts_last_staff', val).catch(() => {});
    fetchStaffBal(val, date);
  };
  const onDate = (d) => {
    setDate(d);
    AsyncStorage.setItem('accounts_last_date', d).catch(() => {});
    if (staff && staff !== '0') fetchStaffBal(staff, d);
  };

  const save = async () => {
    if (!cust) { toast('Customer select karo', 'error'); return; }
    if (!amount || parseFloat(amount) <= 0) { toast('Amount daalo', 'error'); amountRef.current?.focus(); return; }
    if (!isCompleteDMY(date)) { toast('Sahi date daalo (dd/mm/yyyy)', 'error'); return; }
    const staffID = isStaff ? String(user.SubUID) : staff || '0';
    setBusy(true);
    const r = await api.post('/api/accounts', {
      customerUID: cust, date, type, amount, narration,
      staffID: type === 'Paid' || type === 'Received' ? staffID : '0',
    });
    setBusy(false);
    AsyncStorage.multiSet([['accounts_last_date', date], ['accounts_last_type', type]]).catch(() => {});
    if (r?.success) {
      AsyncStorage.setItem('accounts_last_entry_date', date).catch(() => {});
      toast('Data Saved Successfully!');
      setAmount(''); setNarration('');
      if (cust !== 'Self') fetchNetBal(cust);
      if (staff !== '0') fetchStaffBal(staff, date);
      loadMyStaffBal();
    } else toast(r?.message || 'Error saving', 'error');
  };

  const reset = () => { setCust(''); setAmount(''); setNarration(''); setCustBal(null); setRecent(null); setSel(null); };

  const delSelected = async () => {
    if (!sel) return;
    setConfirmDel(false);
    const r = await api.del(`/api/accounts/${sel.AID}`);
    if (r?.success) {
      toast('Entry deleted successfully!');
      fetchNetBal(cust);
      if (staff !== '0') fetchStaffBal(staff, date);
      loadMyStaffBal();
    } else toast(r?.message || 'Error deleting entry', 'error');
  };

  const openHistory = async () => {
    const last = (await AsyncStorage.getItem('accounts_last_entry_date').catch(() => null)) || date;
    const iso = toISO(last);
    router.push({ pathname: '/transactions', params: iso ? { from: iso, to: iso } : {} });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Accounts" subtitle="Payment / Receipt" right={<HeaderAction icon="time-outline" label="P/R History" onPress={openHistory} />} />
      <Screen scroll>
        {isStaff && myStaffBal !== null ? (
          <View style={[styles.staffBanner, { backgroundColor: myStaffBal < 0 ? colors.dangerSoft : colors.successSoft }]}>
            <Ionicons name="person-circle-outline" size={20} color={myStaffBal < 0 ? colors.danger : colors.success} />
            <Text style={[styles.staffText, { color: myStaffBal < 0 ? colors.danger : colors.success }]}>
              Sub User ({user?.subusername || user?.SubUID}) Balance : {myStaffBal < 0 ? '-' : ''}₹{fmtNum(Math.abs(myStaffBal))}
            </Text>
          </View>
        ) : null}
        <Card>
          <Row gap={10}>
            <DateField label="Date" value={date} onChange={onDate} style={{ flex: 1 }} />
            <SelectField label="Type" value={type} options={TX_TYPES} onChange={onType} searchable={false} style={{ flex: 1.2 }} />
          </Row>
          <SelectField label="Customer Name" value={cust} options={custOptions} onChange={onCustomer} placeholder="Select Customer" searchable avatars />
          <NetBal value={cust && cust !== 'Self' ? custBal : null} />
          <Row gap={10}>
            <Field ref={amountRef} label="Amount" icon="cash-outline" value={amount} onChangeText={(t) => setAmount(onlyDigits(t))} keyboardType="number-pad" placeholder="Enter Amount" containerStyle={{ flex: 1 }} />
            <Field label="Narration" value={narration} onChangeText={setNarration} placeholder="Add note…" containerStyle={{ flex: 1.2 }} maxLength={50} />
          </Row>
          {!isStaff ? (
            <>
              <SelectField label="Sub User" value={staff} options={staffOptions} onChange={onStaff} searchable={staffOptions.length > 8} />
              <NetBal value={staff !== '0' ? staffBal : null} />
            </>
          ) : null}
          <Row gap={10}>
            <Button title="Cancel" variant="outline" onPress={reset} style={{ flex: 1 }} />
            <Button title="Submit" icon="checkmark" loading={busy} onPress={save} style={{ flex: 1.6 }} />
          </Row>
        </Card>

        <SectionTitle title="Customer recent entries" hint={cust && cust !== 'Self' ? 'Last 10 · tap an entry to delete it' : undefined} right={cust && cust !== 'Self' && custBal !== null ? <Text style={{ fontWeight: weight.heavy, color: custBal < 0 ? colors.danger : colors.success }}>Net Bal : {fmtNum(custBal)}</Text> : null} />
        {!cust || cust === 'Self' ? (
          <Card flat><Text style={styles.placeholder}>Select a customer to view their recent transactions and ledger history</Text></Card>
        ) : recent === null ? <Loading inline /> : recent.length === 0 ? (
          <Card flat><Text style={styles.placeholder}>No previous entries</Text></Card>
        ) : recent.map((d) => {
          const isSel = sel?.AID === d.AID;
          const paid = parseFloat(d.Paid || 0), rec = parseFloat(d.Received || 0);
          return (
            <Pressable key={d.AID} onPress={() => { tap(); setSel(isSel ? null : d); }} style={[styles.entry, isSel && styles.entrySel]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryType}>{d.EntryType || d.Type || ''}</Text>
                <Text style={styles.entryMeta} numberOfLines={1}>{displayDate(d.Date)}{d.Narration ? `  ·  ${d.Narration}` : ''}{!isStaff ? `  ·  ${d.SubUser || (d.fStaff && d.fStaff !== '0' ? d.fStaff : 'Self')}` : ''}</Text>
              </View>
              {paid ? <Text style={[styles.entryAmt, { color: colors.danger }]}>Paid {fmtNum(paid)}</Text> : null}
              {rec ? <Text style={[styles.entryAmt, { color: colors.success }]}>Rcvd {fmtNum(rec)}</Text> : null}
              {isSel ? (
                <Pressable onPress={() => setConfirmDel(true)} style={styles.delBtn}><Ionicons name="trash" size={16} color="#fff" /></Pressable>
              ) : null}
            </Pressable>
          );
        })}
      </Screen>
      <Sheet
        visible={confirmDel}
        onClose={() => setConfirmDel(false)}
        title="Delete this entry?"
        subtitle={sel ? `${sel.EntryType || sel.Type} · ${displayDate(sel.Date)} · ₹${parseFloat(sel.Paid || 0) || parseFloat(sel.Received || 0)}` : ''}
        footer={<Row gap={10}><Button title="Cancel" variant="outline" onPress={() => setConfirmDel(false)} style={{ flex: 1 }} /><Button title="Delete" variant="danger" onPress={delSelected} style={{ flex: 1.3 }} /></Row>}
      />
    </View>
  );
}

export default function Accounts() {
  return <Guard menuKey="accounts" title="Accounts"><AccountsScreen /></Guard>;
}

const styles = StyleSheet.create({
  staffBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.md, marginBottom: space.md },
  staffText: { fontWeight: weight.bold, flex: 1 },
  placeholder: { color: colors.muted, textAlign: 'center' },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: radius.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  entrySel: { borderColor: colors.danger, backgroundColor: '#FFF7F7' },
  entryType: { fontWeight: weight.heavy, color: colors.text, fontSize: font.base },
  entryMeta: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
  entryAmt: { fontWeight: weight.heavy, fontSize: font.sm },
  delBtn: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
});
