import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import Guard from '../components/Guard';
import { param } from '../lib/nav';
import { isTrue, onlyDecimal, onlyDigits } from '../lib/format';
import { Avatar, Badge, Button, CheckRow, EmptyState, Field, Header, Loading, Row, Segmented, tap } from '../ui/kit';
import { SelectField, Sheet } from '../ui/Sheet';
import { toast } from '../ui/Toast';
import { colors, font, radius, shadow, space, weight } from '../theme';

const BLANK = {
  cid: '', rateID: '', name: '', city: '', mobile: '',
  d_PComm: '0', d_Amt: '100', a_PComm: '0', a_Amt: '10', patti: '0', lc: '0',
  hissaID: '0', hissaPer: '0', commID: '0', daraComm: '0', akharComm: '0', lcID: '0', lcPer: '0',
  selfComm: false, yantriTo: false, isLimit: false, isUttar: false,
};

function CustomersScreen() {
  const insets = useSafeAreaInsets();
  const q = useLocalSearchParams();
  const { isSuperAdmin } = useAuth();
  const [all, setAll] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [statusMap, setStatusMap] = useState({});
  const [form, setForm] = useState(null);
  const [ratesFor, setRatesFor] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!isSuperAdmin) return;
    const r = await api.get('/api/customer/active-status');
    const m = {};
    (r?.data || []).forEach((row) => { m[row.Mobile] = { UID: row.UID, IsActive: row.IsActive }; });
    setStatusMap(m);
  }, [isSuperAdmin]);

  const load = useCallback(async () => {
    const r = await api.get('/api/customer/list');
    setAll(r?.success ? r.data || [] : []);
  }, []);

  useEffect(() => {
    load(); loadStatus();
    const m = param(q.Mobile);
    if (m) setForm({ ...BLANK, mobile: m });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    const t = search.toLowerCase();
    let list = (all || []).filter((c) => !t || (c.CustomerName || '').toLowerCase().includes(t) || (c.Mobile || c.MobileNo || '').toLowerCase().includes(t));
    if (isSuperAdmin && statusFilter !== 'all') {
      list = list.filter((c) => {
        const s = statusMap[c.Mobile || c.MobileNo];
        const active = s && (s.IsActive === 'True' || s.IsActive === true);
        return statusFilter === 'active' ? active : !active;
      });
    }
    return list;
  }, [all, search, statusFilter, statusMap, isSuperAdmin]);

  const toggleFlag = async (c, field) => {
    const cur = c[field];
    const newVal = (cur === 'True' || cur === 1 || cur === true) ? 'False' : 'True';
    const r = await api.post('/api/customer/toggle', { cid: c.CID, field, value: newVal });
    if (r?.success) load(); else toast(r?.message || 'Error updating', 'error');
  };

  const toggleActive = async (mobile, isActive) => {
    const r = await api.post('/api/customer/toggle-active', { mobile, isActive: !isActive });
    if (r?.success) setStatusMap((m) => ({ ...m, [mobile]: { ...m[mobile], IsActive: !isActive } }));
    else toast(r?.message || 'Error updating status', 'error');
  };

  const openEdit = (c) => {
    setForm({
      ...BLANK,
      cid: String(c.CID), name: c.CustomerName || '', city: c.City || '', mobile: c.Mobile || c.MobileNo || '',
      d_PComm: String(c.D_PComm || '0'), d_Amt: String(c.D_Amt || '100'), a_PComm: String(c.A_PComm || '0'), a_Amt: String(c.A_Amt || '10'),
      patti: String(c.Patti || '0'), lc: String(c.LC || '0'),
      hissaID: c.ThirdPartyHissaID && String(c.ThirdPartyHissaID) !== '0' ? String(c.ThirdPartyHissaID) : '0',
      hissaPer: String(c.ThirdPartyHissaPer || '0'),
      commID: c.ThirdPartyCommID && String(c.ThirdPartyCommID) !== '0' ? String(c.ThirdPartyCommID) : '0',
      daraComm: String(c.ThirdPartyDaraComm || '0'), akharComm: String(c.ThirdPartyAkharComm || '0'),
      lcID: c.ThirdPartyLCID && String(c.ThirdPartyLCID) !== '0' ? String(c.ThirdPartyLCID) : '0',
      lcPer: String(c.ThirdPartyLCPer || '0'),
      selfComm: isTrue(c.IsSelfComm), yantriTo: isTrue(c.IsYantriTo), isLimit: isTrue(c.IsLimit), isUttar: isTrue(c.IsUttar),
    });
  };

  const onRefresh = async () => { setRefreshing(true); await Promise.all([load(), loadStatus()]); setRefreshing(false); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header
        title="Contacts"
        subtitle={all ? `${shown.length} of ${all.length} contacts` : 'Add Contact'}
        right={<Button size="sm" icon="add" title="New" onPress={() => setForm({ ...BLANK })} />}
      >
        <View style={styles.search}>
          <Ionicons name="search" size={17} color={colors.faint} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search name / mobile…" placeholderTextColor={colors.faint} style={styles.searchInput} autoCorrect={false} />
          {search ? <Pressable hitSlop={8} onPress={() => setSearch('')}><Ionicons name="close-circle" size={18} color={colors.faint} /></Pressable> : null}
        </View>
        {isSuperAdmin ? (
          <Segmented small value={statusFilter} onChange={setStatusFilter} style={{ marginTop: 10 }} options={[{ key: 'all', label: 'All' }, { key: 'active', label: 'Active' }, { key: 'inactive', label: 'Deactivated' }]} />
        ) : null}
      </Header>
      {all === null ? <Loading /> : (
        <FlatList
          data={shown}
          keyExtractor={(c) => String(c.CID)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} />}
          contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + 40 }}
          initialNumToRender={15}
          ListEmptyComponent={<EmptyState icon="people-outline" title="No contacts found" action={<Button title="Add contact" icon="add" onPress={() => setForm({ ...BLANK })} />} />}
          renderItem={({ item: c }) => {
            const mob = c.Mobile || c.MobileNo || '';
            const st = statusMap[mob];
            const active = st && (st.IsActive === 'True' || st.IsActive === true);
            return (
              <Pressable onPress={() => { tap(); openEdit(c); }} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
                <Row align="flex-start">
                  <Avatar name={c.CustomerName} size={44} />
                  <View style={{ flex: 1, marginLeft: space.md }}>
                    <Row gap={6}>
                      <Text style={styles.name} numberOfLines={1}>{c.CustomerName}</Text>
                      <Text style={styles.pno}>#{c.CID}</Text>
                    </Row>
                    <Text style={styles.sub} numberOfLines={1}>{mob}{c.City ? `  ·  ${c.City}` : ''}</Text>
                    <Text style={styles.rate} numberOfLines={1}>D {c.D_PComm ?? 0}%/{c.D_Amt ?? 0}  ·  A {c.A_PComm ?? 0}%/{c.A_Amt ?? 0}  ·  Patti {c.Patti ?? 0}%  ·  LC {c.LC ?? 0}</Text>
                  </View>
                </Row>
                <Row gap={6} wrap style={{ marginTop: 10 }}>
                  <FlagPill label="Self Comm" on={isTrue(c.IsSelfComm)} onPress={() => toggleFlag(c, 'IsSelfComm')} />
                  <FlagPill label="Yantri To" on={isTrue(c.IsYantriTo)} onPress={() => toggleFlag(c, 'IsYantriTo')} />
                  {isTrue(c.IsUttar) ? <Badge text="Uttar" tone="warning" /> : null}
                  {isTrue(c.IsLimit) ? <Badge text="Limit" tone="info" /> : null}
                  {isSuperAdmin ? (
                    st ? (
                      <Pressable onPress={() => { tap(); toggleActive(mob, active); }}>
                        <Badge text={active ? 'Login active' : 'Login deactivated'} tone={active ? 'success' : 'danger'} icon={active ? 'checkmark-circle' : 'close-circle'} />
                      </Pressable>
                    ) : <Badge text="No login" tone="neutral" />
                  ) : null}
                  <View style={{ flex: 1 }} />
                  <Pressable onPress={() => { tap(); setRatesFor({ cid: String(c.CID), name: c.CustomerName }); }} style={styles.rateBtn}>
                    <Ionicons name="pricetags-outline" size={14} color={colors.brandText} />
                    <Text style={styles.rateBtnText}>Rates</Text>
                  </Pressable>
                </Row>
              </Pressable>
            );
          }}
        />
      )}
      <CustomerForm form={form} setForm={setForm} customers={all || []} onSaved={load} />
      <RatesSheet target={ratesFor} onClose={() => setRatesFor(null)} />
    </View>
  );
}

function FlagPill({ label, on, onPress }) {
  return (
    <Pressable onPress={() => { tap(); onPress(); }}>
      <Badge text={`${label}: ${on ? 'Yes' : 'No'}`} tone={on ? 'success' : 'neutral'} icon={on ? 'checkmark' : 'remove'} />
    </Pressable>
  );
}

function CustomerForm({ form, setForm, customers, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const editing = !!form?.cid;
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  // checkRatesReadonly(): the latest saved rate overrides the master rate fields.
  useEffect(() => {
    if (!form?.cid || form.__ratesChecked) return;
    (async () => {
      const r = await api.get(`/api/customer/${form.cid}/rates`);
      const rate = r?.success && r.data?.length ? r.data[0] : null;
      setForm((f) => (f && f.cid === form.cid ? {
        ...f, __ratesChecked: true,
        ...(rate ? { d_PComm: String(rate.D_PComm), d_Amt: String(rate.D_Amt), a_PComm: String(rate.A_PComm), a_Amt: String(rate.A_Amt), patti: String(rate.Patti), rateID: String(rate.RateID || '') } : { rateID: '' }),
      } : f));
    })();
  }, [form?.cid]); // eslint-disable-line react-hooks/exhaustive-deps

  const partyOptions = useMemo(() => customers.map((c) => ({ value: String(c.CID), label: c.CustomerName, sub: c.Mobile || c.MobileNo })), [customers]);

  if (!form) return <Sheet visible={false} onClose={() => {}} />;

  const save = async () => {
    const name = form.name.trim(), mob = form.mobile.trim();
    if (!name || !mob) { toast('Name and Mobile required', 'error'); return; }
    setBusy(true);
    const body = {
      customerName: name, mobileNo: mob, city: form.city.trim(),
      d_PComm: form.d_PComm, d_Amt: form.d_Amt, a_PComm: form.a_PComm, a_Amt: form.a_Amt, patti: form.patti, lc: form.lc,
      isSelfComm: form.selfComm, isYantriTo: form.yantriTo, isLimit: form.isLimit, isUttar: form.isUttar,
      thirdPartyHissaID: form.hissaID !== '0' ? form.hissaID : 0,
      thirdPartyHissaPer: form.hissaID !== '0' ? form.hissaPer : 0,
      thirdPartyCommID: form.commID !== '0' ? form.commID : 0,
      thirdPartyDaraComm: form.commID !== '0' ? form.daraComm : 0,
      thirdPartyAkharComm: form.commID !== '0' ? form.akharComm : 0,
      thirdPartyLCID: form.lcID !== '0' ? form.lcID : 0,
      thirdPartyLCPer: form.lcID !== '0' ? form.lcPer : 0,
      cid: form.cid || '', rateID: form.rateID || '',
    };
    const r = editing ? await api.post('/api/customer/update', body) : await api.post('/api/customer', body);
    setBusy(false);
    if (r?.success) { toast(editing ? 'Contact updated!' : 'Contact saved!'); setForm(null); onSaved(); }
    else toast(r?.message || 'Error saving contact', 'error');
  };

  const del = async () => {
    setBusy(true);
    const r = await api.post('/api/customer/delete', { cid: form.cid });
    setBusy(false);
    setConfirmDel(false);
    if (r?.success) { toast('Contact deleted'); setForm(null); onSaved(); }
    else toast(r?.message || 'Error deleting', 'error');
  };

  const numField = (label, k, decimal = true) => (
    <Field compact label={label} value={form[k]} onChangeText={(t) => set(k)(decimal ? onlyDecimal(t) : onlyDigits(t))} keyboardType="decimal-pad" containerStyle={{ flex: 1 }} selectTextOnFocus />
  );

  return (
    <Sheet
      visible={!!form}
      onClose={() => setForm(null)}
      title={editing ? 'Edit Contact' : 'New Party'}
      subtitle={editing ? `#${form.cid} · ${form.mobile}` : 'Add a customer and their default rate'}
      footer={confirmDel ? (
        <View>
          <Text style={styles.delWarn}>Delete this contact? All pending chats will be rejected.</Text>
          <Row gap={10}><Button title="Keep" variant="outline" onPress={() => setConfirmDel(false)} style={{ flex: 1 }} /><Button title="Delete" variant="danger" loading={busy} onPress={del} style={{ flex: 1.3 }} /></Row>
        </View>
      ) : (
        <Row gap={10}>
          {editing ? <Button icon="trash-outline" variant="dangerSoft" onPress={() => setConfirmDel(true)} style={{ width: 52 }} /> : null}
          <Button title="Reset" variant="outline" onPress={() => setForm({ ...BLANK })} style={{ flex: 1 }} />
          <Button title={editing ? 'Update' : 'Save'} icon="checkmark" loading={busy} onPress={save} style={{ flex: 1.5 }} />
        </Row>
      )}
    >
      <Field label="Party Name" icon="person-outline" value={form.name} onChangeText={set('name')} placeholder="Enter Customer Name" />
      <Row gap={10}>
        <Field label="City" value={form.city} onChangeText={set('city')} placeholder="Enter City" containerStyle={{ flex: 1 }} />
        <Field label="Phone" value={form.mobile} onChangeText={(t) => set('mobile')(onlyDigits(t))} placeholder="Mobile No" keyboardType="number-pad" maxLength={10} containerStyle={{ flex: 1.2 }} />
      </Row>
      <Text style={styles.group}>Rate</Text>
      <Row gap={8}>{numField('D_PComm', 'd_PComm')}{numField('D_Amt', 'd_Amt')}{numField('A_PComm', 'a_PComm')}{numField('A_Amt', 'a_Amt')}</Row>
      <Row gap={8} style={{ marginTop: space.md }}>{numField('Patti', 'patti')}{numField('LC', 'lc')}<View style={{ flex: 2 }} /></Row>

      <Text style={styles.group}>3rd party</Text>
      <Row gap={8} align="flex-end">
        <SelectField compact label="3rd Hissa Party" value={form.hissaID} options={partyOptions} onChange={(v) => set('hissaID')(v || '0')} allowClear clearLabel="-- None --" placeholder="Select Customer" style={{ flex: 2 }} searchable avatars />
        {numField('Hissa (%)', 'hissaPer')}
      </Row>
      <Row gap={8} align="flex-end" style={{ marginTop: space.md }}>
        <SelectField compact label="3rd Comm Party" value={form.commID} options={partyOptions} onChange={(v) => set('commID')(v || '0')} allowClear clearLabel="-- None --" placeholder="Select Customer" style={{ flex: 1.6 }} searchable avatars />
        {numField('Dara (%)', 'daraComm')}
        {numField('Akhar (%)', 'akharComm')}
      </Row>
      <Row gap={8} align="flex-end" style={{ marginTop: space.md }}>
        <SelectField compact label="3rd LC Party" value={form.lcID} options={partyOptions} onChange={(v) => set('lcID')(v || '0')} allowClear clearLabel="-- None --" placeholder="Select Customer" style={{ flex: 2 }} searchable avatars />
        {numField('LC (%)', 'lcPer')}
      </Row>

      <Text style={styles.group}>Options</Text>
      <View style={styles.checks}>
        <CheckRow label="Self Commission" checked={form.selfComm} onPress={() => set('selfComm')(!form.selfComm)} style={{ width: '50%' }} />
        <CheckRow label="Yantri To" checked={form.yantriTo} onPress={() => set('yantriTo')(!form.yantriTo)} style={{ width: '50%' }} />
        <CheckRow label="Limit" checked={form.isLimit} onPress={() => set('isLimit')(!form.isLimit)} style={{ width: '50%' }} />
        <CheckRow label="Uttar" checked={form.isUttar} onPress={() => set('isUttar')(!form.isUttar)} style={{ width: '50%' }} />
      </View>
    </Sheet>
  );
}

const RATE_BLANK = { rateID: '', d: '0', da: '100', a: '0', aa: '10', p: '0' };

function RatesSheet({ target, onClose }) {
  const [rates, setRates] = useState(null);
  const [f, setF] = useState(RATE_BLANK);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const load = useCallback(async (cid) => {
    setRates(null);
    const r = await api.get(`/api/customer/${cid}/rates`);
    setRates(r?.success ? r.data || [] : []);
  }, []);
  useEffect(() => { if (target) { setF(RATE_BLANK); setConfirmDel(null); load(target.cid); } }, [target, load]);
  const editing = !!f.rateID;
  const save = async () => {
    const dpc = parseFloat(f.d), da = parseFloat(f.da), apc = parseFloat(f.a), aa = parseFloat(f.aa), pt = parseFloat(f.p);
    if ([dpc, da, apc, aa, pt].some(isNaN) || dpc < 0 || dpc > 100 || apc < 0 || apc > 100 || pt < 0 || pt > 100 || da <= 0 || da > 100 || aa <= 0 || aa > 10) {
      toast('Invalid values! D Amt: 1-100, A Amt: 1-10, % fields: 0-100', 'error');
      return;
    }
    setBusy(true);
    const r = await api.post('/api/customer/rates', { cid: target.cid, rateID: f.rateID || 0, d_PComm: dpc, d_Amt: da, a_PComm: apc, a_Amt: aa, patti: pt, type: editing ? 1 : 0 });
    setBusy(false);
    if (r?.success) { toast(editing ? 'Rate updated!' : 'Rate added!'); setF(RATE_BLANK); load(target.cid); }
    else toast(r?.message || 'Error saving rate', 'error');
  };
  const del = async (rateID) => {
    setBusy(true);
    const r = await api.post('/api/customer/rates', { cid: target.cid, rateID, type: 2 });
    setBusy(false);
    setConfirmDel(null);
    if (r?.success) { toast('Rate deleted'); setF(RATE_BLANK); load(target.cid); }
    else toast(r?.message || 'Error deleting rate', 'error');
  };
  const nf = (label, k) => <Field compact label={label} value={f[k]} onChangeText={(t) => setF((x) => ({ ...x, [k]: onlyDecimal(t) }))} keyboardType="decimal-pad" containerStyle={{ flex: 1 }} selectTextOnFocus />;
  return (
    <Sheet
      visible={!!target}
      onClose={onClose}
      title={`Rates — ${target?.name || ''}`}
      subtitle="Each rate becomes a separate chat on Home / Games"
      footer={(
        <Row gap={10}>
          {editing ? <Button title="Cancel edit" variant="outline" onPress={() => setF(RATE_BLANK)} style={{ flex: 1 }} /> : null}
          <Button title={editing ? 'Save rate' : 'Add rate'} icon={editing ? 'checkmark' : 'add'} loading={busy} onPress={save} style={{ flex: 1.4 }} />
        </Row>
      )}
    >
      <Row gap={8}>{nf('D %', 'd')}{nf('D Amt', 'da')}{nf('A %', 'a')}{nf('A Amt', 'aa')}{nf('Patti %', 'p')}</Row>
      <Text style={styles.group}>Saved rates</Text>
      {rates === null ? <Loading inline /> : rates.length === 0 ? (
        <Text style={{ color: colors.muted, paddingVertical: 12 }}>No rates added yet. Add the first rate above.</Text>
      ) : rates.map((d, i) => (
        <View key={d.RateID || i} style={[styles.rateRow, String(d.RateID) === f.rateID && { borderColor: colors.brand, backgroundColor: colors.brandSoft }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rateText}>{d.D_PComm}/{d.D_Amt}-{d.A_PComm}/{d.A_Amt}-{d.Patti}</Text>
            <Text style={styles.rateSub}>#{i + 1} · D {d.D_PComm}% / {d.D_Amt} · A {d.A_PComm}% / {d.A_Amt} · Patti {d.Patti}%</Text>
          </View>
          {confirmDel === d.RateID ? (
            <Row gap={6}>
              <Button size="sm" title="No" variant="outline" onPress={() => setConfirmDel(null)} />
              <Button size="sm" title="Delete" variant="danger" onPress={() => del(d.RateID)} />
            </Row>
          ) : (
            <Row gap={6}>
              <Pressable hitSlop={6} onPress={() => { tap(); setF({ rateID: String(d.RateID), d: String(d.D_PComm), da: String(d.D_Amt), a: String(d.A_PComm), aa: String(d.A_Amt), p: String(d.Patti) }); }} style={styles.iconBtn}>
                <Ionicons name="create-outline" size={18} color={colors.warning} />
              </Pressable>
              <Pressable hitSlop={6} onPress={() => { tap(); setConfirmDel(d.RateID); }} style={styles.iconBtn}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </Row>
          )}
        </View>
      ))}
    </Sheet>
  );
}

export default function Customers() {
  return <Guard menuKey="customer" title="Contacts"><CustomersScreen /></Guard>;
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.cardAlt, borderRadius: radius.md, height: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, marginTop: 10 },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text, paddingVertical: 0 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.md, marginBottom: 10, ...shadow },
  name: { fontSize: font.md, fontWeight: weight.heavy, color: colors.text, flexShrink: 1 },
  pno: { fontSize: font.xs, color: colors.faint, fontWeight: weight.bold },
  sub: { fontSize: font.sm, color: colors.muted, marginTop: 2 },
  rate: { fontSize: font.xs, color: colors.textSoft, marginTop: 4, fontWeight: weight.semi },
  rateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.brandSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  rateBtnText: { color: colors.brandText, fontWeight: weight.bold, fontSize: font.xs },
  group: { fontSize: font.xs, fontWeight: weight.heavy, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: space.lg, marginBottom: space.sm },
  checks: { flexDirection: 'row', flexWrap: 'wrap' },
  delWarn: { color: colors.danger, fontWeight: weight.semi, marginBottom: 10, textAlign: 'center' },
  rateRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  rateText: { fontSize: font.md, fontWeight: weight.heavy, color: colors.text },
  rateSub: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
  iconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
});
