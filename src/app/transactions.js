import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { displayDate, istISO, toDMY, toISO } from '../lib/dates';
import { cleanName5, fmtNum, onlyDecimal } from '../lib/format';
import { param } from '../lib/nav';
import { Badge, Button, Card, EmptyState, Field, Header, Loading, Row, Screen, StatTile, tap } from '../ui/kit';
import { DateField, SelectField, Sheet } from '../ui/Sheet';
import { toast } from '../ui/Toast';
import { colors, font, radius, space, weight } from '../theme';

const EDIT_TYPES = [
  { value: 'Paid', label: 'Payment / Diye (Paid)' },
  { value: 'Received', label: 'Receipt / Liye (Received)' },
  { value: 'Paid Adjustment', label: 'AdjustPayment (+)' },
  { value: 'Receive Adjustment', label: 'AdjustReceipt (−)' },
];

export default function Transactions() {
  const q = useLocalSearchParams();
  const { isStaff } = useAuth();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [customers, setCustomers] = useState([]);
  const [subusers, setSubusers] = useState([]);
  const [cust, setCust] = useState(param(q.customerUID));
  const [staff, setStaff] = useState(param(q.SUID));
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (o = {}) => {
    const f = toISO(o.from ?? from), t = toISO(o.to ?? to), c = o.cust ?? cust, s = o.staff ?? staff;
    setList(null);
    const r = await api.get('/api/accounts/list', { fromDate: f, toDate: t, custUID: c, customerUID: c, staffUID: s, staffID: s });
    setList(r?.data || []);
  }, [from, to, cust, staff]);

  useEffect(() => {
    (async () => {
      const [rc, rs, rd] = await Promise.all([
        api.get('/api/accounts/customers'),
        isStaff ? Promise.resolve(null) : api.get('/api/accounts/subusers'),
        api.get('/api/accounts/latest-date'),
      ]);
      setCustomers(rc?.data || []);
      setSubusers(rs?.data || []);
      const last = (await AsyncStorage.getItem('accounts_last_entry_date').catch(() => null)) || (await AsyncStorage.getItem('accounts_last_date').catch(() => null));
      const def = toISO(last) || toISO(rd?.date) || istISO();
      const f = toDMY(toISO(param(q.from)) || def);
      const t = toDMY(toISO(param(q.to)) || def);
      setFrom(f); setTo(t);
      load({ from: f, to: t });
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const custName = (c) => cleanName5(c.Name || c.CustomerName || '');
  const custFilter = useMemo(() => [
    { value: '', label: 'All Customers' },
    ...(isStaff ? [] : [{ value: '0', label: 'Self' }]),
    ...customers.map((c) => ({ value: String(c.UID || c.CID), label: custName(c) })),
  ], [customers, isStaff]);
  const staffFilter = useMemo(() => [
    { value: '', label: 'All Staff' }, { value: '0', label: 'Self' },
    ...subusers.map((s) => ({ value: String(s.SubUserID), label: s.subusername || String(s.SubUserID) })),
  ], [subusers]);
  const custEdit = useMemo(() => [{ value: '0', label: 'Self' }, ...customers.map((c) => ({ value: String(c.UID || c.CID), label: custName(c) }))], [customers]);
  const staffEdit = useMemo(() => [{ value: '0', label: 'Self' }, ...subusers.map((s) => ({ value: String(s.SubUserID), label: s.subusername }))], [subusers]);

  const paid = (list || []).reduce((s, d) => s + (parseFloat(d.Paid || 0) || 0), 0);
  const recv = (list || []).reduce((s, d) => s + (parseFloat(d.Received || 0) || 0), 0);

  const openEdit = (d) => setEdit({
    aid: d.AID,
    date: d.Date ? toDMY(String(d.Date)) : '',
    cust: d.fCustID != null && String(d.fCustID) !== '0' ? String(d.fCustID) : '0',
    type: d.EntryType || d.Type || 'Paid',
    amount: String(parseFloat(d.Paid || 0) > 0 ? d.Paid : d.Received || ''),
    staff: !isStaff && d.fStaff != null && String(d.fStaff) !== '0' ? String(d.fStaff) : '0',
    narration: d.Narration || '',
  });

  const saveEdit = async () => {
    const date = toISO(edit.date);
    if (!edit.amount || parseFloat(edit.amount) <= 0) { toast('Please enter a valid amount', 'error'); return; }
    if (!date) { toast('Please enter a valid date', 'error'); return; }
    setBusy(true);
    const r = await api.put(`/api/accounts/${edit.aid}`, {
      date, customerUID: edit.cust, type: edit.type, amount: edit.amount,
      staffID: isStaff ? '0' : edit.staff || '0', narration: edit.narration.trim(),
    });
    setBusy(false);
    if (r?.success) { toast('Transaction updated successfully!'); setEdit(null); load(); }
    else toast(r?.message || 'Failed to update transaction', 'error');
  };

  const doDelete = async () => {
    const d = del;
    setDel(null);
    const r = await api.del(`/api/accounts/${d.AID}`);
    if (r?.success) { toast('Transaction deleted successfully!'); load(); }
    else toast(r?.message || 'Failed to delete transaction', 'error');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="P / R History" subtitle="All transactions" />
      <Screen scroll>
        <Card>
          <Row gap={10}>
            <DateField label="From Date" value={from} onChange={setFrom} style={{ flex: 1 }} />
            <DateField label="To Date" value={to} onChange={(d) => { setTo(d); load({ to: d }); }} style={{ flex: 1 }} />
          </Row>
          <Row gap={10}>
            <SelectField label="Customer" value={cust} options={custFilter} onChange={(v) => setCust(v ?? '')} searchable avatars style={{ flex: 1 }} />
            {!isStaff ? <SelectField label="Sub User" value={staff} options={staffFilter} onChange={(v) => setStaff(v ?? '')} style={{ flex: 1 }} /> : null}
          </Row>
          <Button title="Search" icon="search" onPress={() => load()} loading={list === null} />
        </Card>

        {list === null ? <Loading inline /> : (
          <>
            <Row gap={8} style={{ marginBottom: space.md }}>
              <StatTile label={`Paid (${list.length})`} value={`₹${fmtNum(paid, 0)}`} tone="danger" />
              <StatTile label="Received" value={`₹${fmtNum(recv, 0)}`} tone="success" />
              <StatTile label="Net" value={`₹${fmtNum(paid - recv, 0)}`} tone="brand" />
            </Row>
            {list.length === 0 ? <EmptyState icon="receipt-outline" title="No transactions" /> : list.map((d, i) => {
              const p = parseFloat(d.Paid || 0), rc = parseFloat(d.Received || 0);
              return (
                <View key={d.AID || i} style={styles.item}>
                  <Row align="flex-start">
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name} numberOfLines={1}>{cleanName5(d.CustomerName1 || d.CustomerName || 'Self')}</Text>
                      <Text style={styles.meta}>{displayDate(d.Date)}  ·  {d.EntryType || d.Type || ''}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      {p ? <Text style={[styles.amt, { color: colors.danger }]}>− ₹{fmtNum(p)}</Text> : null}
                      {rc ? <Text style={[styles.amt, { color: colors.success }]}>+ ₹{fmtNum(rc)}</Text> : null}
                    </View>
                  </Row>
                  {d.Narration ? <Text style={styles.narr} numberOfLines={2}>{d.Narration}</Text> : null}
                  <Row gap={8} style={{ marginTop: 8 }}>
                    {!isStaff && (d.SubUser || d.StaffName) ? <Badge text={d.SubUser || d.StaffName} tone="brand" icon="person" /> : null}
                    <View style={{ flex: 1 }} />
                    <Pressable onPress={() => { tap(); openEdit(d); }} style={styles.act}><Ionicons name="create-outline" size={16} color={colors.warning} /><Text style={[styles.actText, { color: colors.warning }]}>Edit</Text></Pressable>
                    <Pressable onPress={() => { tap(); setDel(d); }} style={styles.act}><Ionicons name="trash-outline" size={16} color={colors.danger} /><Text style={[styles.actText, { color: colors.danger }]}>Delete</Text></Pressable>
                  </Row>
                </View>
              );
            })}
          </>
        )}
      </Screen>

      <Sheet
        visible={!!edit}
        onClose={() => setEdit(null)}
        title="Edit Transaction"
        footer={<Row gap={10}><Button title="Cancel" variant="outline" onPress={() => setEdit(null)} style={{ flex: 1 }} /><Button title="Save Changes" icon="checkmark" loading={busy} onPress={saveEdit} style={{ flex: 1.4 }} /></Row>}
      >
        {edit ? (
          <>
            <DateField label="Date" value={edit.date} onChange={(v) => setEdit((e) => ({ ...e, date: v }))} />
            <SelectField label="Customer" value={edit.cust} options={custEdit} onChange={(v) => setEdit((e) => ({ ...e, cust: v || '0' }))} searchable avatars />
            <SelectField label="Type" value={edit.type} options={EDIT_TYPES} onChange={(v) => setEdit((e) => ({ ...e, type: v }))} searchable={false} />
            <Field label="Amount" value={edit.amount} onChangeText={(t) => setEdit((e) => ({ ...e, amount: onlyDecimal(t) }))} keyboardType="decimal-pad" placeholder="Enter Amount" />
            {!isStaff ? <SelectField label="Sub User / Staff" value={edit.staff} options={staffEdit} onChange={(v) => setEdit((e) => ({ ...e, staff: v || '0' }))} /> : null}
            <Field label="Narration" value={edit.narration} onChangeText={(t) => setEdit((e) => ({ ...e, narration: t }))} placeholder="Optional Narration" maxLength={50} />
          </>
        ) : null}
      </Sheet>

      <Sheet
        visible={!!del}
        onClose={() => setDel(null)}
        title="Delete this transaction?"
        subtitle={del ? `${cleanName5(del.CustomerName1 || del.CustomerName || 'Self')} · ₹${parseFloat(del.Paid || 0) > 0 ? del.Paid : del.Received} · ${del.EntryType || del.Type}` : ''}
        footer={<Row gap={10}><Button title="Cancel" variant="outline" onPress={() => setDel(null)} style={{ flex: 1 }} /><Button title="Delete" variant="danger" onPress={doDelete} style={{ flex: 1.3 }} /></Row>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  item: { backgroundColor: colors.card, borderRadius: radius.md, padding: space.md, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  name: { fontSize: font.md, fontWeight: weight.heavy, color: colors.text },
  meta: { fontSize: font.sm, color: colors.muted, marginTop: 2 },
  amt: { fontSize: font.md, fontWeight: weight.heavy },
  narr: { fontSize: font.sm, color: colors.textSoft, marginTop: 6, fontStyle: 'italic' },
  act: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.cardAlt },
  actText: { fontSize: font.xs, fontWeight: weight.bold },
});
