import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import Guard from '../../components/Guard';
import { dateToDMY, displayDate, toDMY, toISO } from '../../lib/dates';
import { isTrue, onlyDigits } from '../../lib/format';
import { Badge, Button, Card, Field, Header, Loading, Row, Screen, Segmented, SectionTitle, tap } from '../../ui/kit';
import { DateField, Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/Toast';
import { colors, font, radius, space, weight } from '../../theme';

const nextYear = () => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return dateToDMY(d); };
const BLANK = () => ({ uid: '', mobile: '', password: '', validity: nextYear(), active: 'True' });

function UsersScreen() {
  const [users, setUsers] = useState(null);
  const [form, setForm] = useState(BLANK());
  const [q, setQ] = useState('');
  const [blockMobile, setBlockMobile] = useState('');
  const [bulkValidity, setBulkValidity] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api.get('/api/admin/users');
    if (r?.success) setUsers(r.data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const t = q.toLowerCase();
    return (users || []).filter((u) => String(u.UID ?? '').toLowerCase().includes(t) || String(u.Mobile ?? '').toLowerCase().includes(t));
  }, [users, q]);

  const save = async () => {
    const mobile = form.mobile.trim();
    if (!mobile || !form.validity) { toast('Mobile and validity required', 'error'); return; }
    setBusy(true);
    const validityDate = toISO(form.validity);
    const r = form.uid
      ? await api.put(`/api/admin/users/${form.uid}`, { isActive: form.active, validityDate, password: form.password.trim() })
      : await api.post('/api/admin/users', { mobile, validityDate });
    setBusy(false);
    if (r?.success) { toast(form.uid ? 'User updated!' : 'User created!'); setForm(BLANK()); load(); }
    else toast(r?.message || 'Error', 'error');
  };

  const edit = (u) => setForm({
    uid: String(u.UID), mobile: u.Mobile || '', password: u.Password || '',
    validity: u.Validity || u.ValidityDate ? toDMY(String(u.Validity || u.ValidityDate)) : '',
    active: isTrue(u.IsActive) ? 'True' : 'False',
  });

  const run = async (kind) => {
    setConfirm(null);
    const mobile = blockMobile.trim();
    const validityDate = toISO(bulkValidity);
    let r;
    if (kind === 'blockAll') r = await api.post('/api/admin/block-all', {});
    if (kind === 'unblockAll') r = await api.post('/api/admin/unblock-all', { validityDate });
    if (kind === 'block') r = await api.post('/api/admin/block-user', { mobile });
    if (kind === 'unblock') r = await api.post('/api/admin/unblock-user', { mobile, validityDate });
    const ok = { blockAll: 'All users blocked', unblockAll: 'All users unblocked', block: 'User blocked', unblock: 'User unblocked' };
    if (r?.success) { toast(ok[kind]); load(); } else toast(r?.message || 'Error', 'error');
  };

  const ask = (kind) => {
    if ((kind === 'unblockAll' || kind === 'unblock') && !bulkValidity) { toast('Select validity date first', 'error'); return; }
    if ((kind === 'block' || kind === 'unblock') && !blockMobile.trim()) { toast('Enter mobile', 'error'); return; }
    setConfirm(kind);
  };
  const confirmText = {
    blockAll: 'Block ALL users? They will not be able to login.',
    unblockAll: 'Unblock ALL users?',
    block: `Block user: ${blockMobile}?`,
    unblock: `Unblock user: ${blockMobile}?`,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Users" subtitle={users ? `${users.length} accounts` : ' '} />
      <Screen scroll>
        <Card>
          <SectionTitle title={form.uid ? `Edit user #${form.uid}` : 'Add user'} style={{ marginTop: 0 }} right={form.uid ? <Button size="sm" variant="ghost" title="Reset" onPress={() => setForm(BLANK())} /> : null} />
          <Field label="Mobile (Username)" value={form.mobile} onChangeText={(v) => setForm((f) => ({ ...f, mobile: onlyDigits(v) }))} keyboardType="number-pad" editable={!form.uid} placeholder="Mobile number" />
          {form.uid ? <Field label="Password" value={form.password} onChangeText={(v) => setForm((f) => ({ ...f, password: v }))} placeholder="Password" autoCapitalize="none" /> : null}
          <DateField label="Validity Date" value={form.validity} onChange={(v) => setForm((f) => ({ ...f, validity: v }))} />
          {form.uid ? <Segmented value={form.active} onChange={(v) => setForm((f) => ({ ...f, active: v }))} options={[{ key: 'True', label: 'Active' }, { key: 'False', label: 'Inactive' }]} style={{ marginBottom: space.md }} /> : null}
          <Button title={form.uid ? 'Update User' : 'Save'} icon="checkmark" loading={busy} onPress={save} />
          {!form.uid ? <Text style={styles.note}>New users get their mobile number as the initial password.</Text> : null}
        </Card>

        <Card>
          <SectionTitle title="Block / Unblock" style={{ marginTop: 0 }} />
          <Row gap={10}>
            <Field label="Mobile" value={blockMobile} onChangeText={(v) => setBlockMobile(onlyDigits(v))} keyboardType="number-pad" placeholder="Mobile number" containerStyle={{ flex: 1 }} />
            <DateField label="Validity for unblock" value={bulkValidity} onChange={setBulkValidity} style={{ flex: 1 }} />
          </Row>
          <Row gap={8}>
            <Button size="sm" title="Block" icon="lock-closed" variant="dangerSoft" onPress={() => ask('block')} style={{ flex: 1 }} />
            <Button size="sm" title="Unblock" icon="lock-open" variant="successSoft" onPress={() => ask('unblock')} style={{ flex: 1 }} />
          </Row>
          <Row gap={8} style={{ marginTop: 8 }}>
            <Button size="sm" title="Block All" icon="ban" variant="danger" onPress={() => ask('blockAll')} style={{ flex: 1 }} />
            <Button size="sm" title="Unblock All" icon="checkmark-done" variant="success" onPress={() => ask('unblockAll')} style={{ flex: 1 }} />
          </Row>
        </Card>

        <SectionTitle title="All users" />
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={colors.faint} />
          <TextInput value={q} onChangeText={setQ} placeholder="Filter by mobile / UID…" placeholderTextColor={colors.faint} style={styles.searchInput} />
        </View>
        {users === null ? <Loading inline /> : shown.map((u, i) => {
          const active = isTrue(u.IsActive);
          return (
            <Pressable key={u.UID ?? i} onPress={() => { tap(); edit(u); }} style={styles.user}>
              <View style={{ flex: 1 }}>
                <Text style={styles.mobile}>{u.Mobile}  <Text style={styles.uid}>#{u.UID}</Text></Text>
                <Text style={styles.meta}>Password {u.Password || '-'}  ·  Valid {u.Validity || u.ValidityDate ? displayDate(u.Validity || u.ValidityDate) : '-'}</Text>
                <Text style={styles.meta}>Registered {u.RegisteredOn ? displayDate(u.RegisteredOn) : '-'}</Text>
              </View>
              <Badge text={active ? 'Active' : 'Inactive'} tone={active ? 'success' : 'danger'} />
              <Ionicons name="create-outline" size={18} color={colors.warning} style={{ marginLeft: 8 }} />
            </Pressable>
          );
        })}
      </Screen>
      <Sheet
        visible={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm ? confirmText[confirm] : ''}
        footer={<Row gap={10}><Button title="Cancel" variant="outline" onPress={() => setConfirm(null)} style={{ flex: 1 }} /><Button title="Confirm" variant={confirm && confirm.startsWith('block') ? 'danger' : 'success'} onPress={() => run(confirm)} style={{ flex: 1.3 }} /></Row>}
      />
    </View>
  );
}

export default function AdminUsers() {
  return <Guard menuKey="admin" title="Users"><UsersScreen /></Guard>;
}

const styles = StyleSheet.create({
  note: { fontSize: font.xs, color: colors.muted, marginTop: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: radius.md, height: 42, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, marginBottom: space.sm },
  searchInput: { flex: 1, fontSize: font.base, color: colors.text, paddingVertical: 0 },
  user: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, padding: 12, marginBottom: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  mobile: { fontSize: font.md, fontWeight: weight.heavy, color: colors.text },
  uid: { fontSize: font.xs, color: colors.faint },
  meta: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
});
