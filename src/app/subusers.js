import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/client';
import Guard from '../components/Guard';
import { isTrue, onlyDigits } from '../lib/format';
import { Avatar, Badge, Button, CheckRow, EmptyState, Field, Header, Loading, Row, SwitchRow, tap } from '../ui/kit';
import { Sheet } from '../ui/Sheet';
import { toast } from '../ui/Toast';
import { colors, font, radius, shadow, space, weight } from '../theme';

// AccessRight columns ↔ request keys (subusers.html saveAccessRights).
const RIGHTS = [
  ['ADDContacts', 'addContacts', 'Contacts'], ['ADDGames', 'addGames', 'Games'], ['Result', 'result', 'Result'],
  ['FindChat', 'findChat', 'Find Chat'], ['Hisab', 'hisab', 'Hisab'], ['HisabSummary', 'hisabSummary', 'Hisab Summary'],
  ['DateWiseHisab', 'dateWiseHisab', 'Date Wise Hisab'], ['Accounts', 'accounts', 'Accounts'], ['ShowAllAccounts', 'showAllAccounts', 'Show All Accounts'],
  ['SubUsers', 'subUsers', 'Sub User'], ['Balance', 'balance', 'Balance'], ['LC', 'lc', 'LC'],
  ['PLYantri', 'plYantri', 'P&L Yantri'], ['Yantri', 'yantri', 'Yantri'], ['AbsentReport', 'absentReport', 'Absent Report'],
  ['ChangePassword', 'changePassword', 'Change Password'],
];

const BLANK = { id: '', name: '', mobile: '', password: '', active: true };

function SubUsersScreen() {
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState(null);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [access, setAccess] = useState(null); // { user, rights }
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const r = await api.get('/api/admin/subusers');
    setUsers(r?.success ? r.data || [] : []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const name = form.name.trim(), mobile = form.mobile.trim(), password = form.password.trim();
    const e = {};
    if (!name) e.name = 'Name is required!';
    else if (!mobile) e.mobile = 'Mobile number is required!';
    else if (!password) e.password = 'Password is required!';
    setErrors(e);
    if (Object.keys(e).length) { toast(Object.values(e)[0], 'error'); return; }
    setBusy(true);
    const body = { name, mobile, password, isActive: form.active };
    const r = form.id ? await api.put(`/api/admin/subusers/${form.id}`, body) : await api.post('/api/admin/subusers', body);
    setBusy(false);
    if (r?.success) { toast(form.id ? 'Data Updated Successfully!' : 'Data Saved Successfully!'); setForm(null); load(); }
    else toast(r?.message || 'Something Went Wrong!', 'error');
  };

  const openAccess = async (u) => {
    setAccess({ user: u, rights: null });
    let r = await api.get(`/api/admin/access-rights/${u.SubUserID}`);
    if (!r?.success || !r.data) r = await api.get('/api/admin/access-rights', { subUID: u.SubUserID });
    const ar = r?.data ? (Array.isArray(r.data) ? r.data[0] : r.data) : null;
    const rights = {};
    RIGHTS.forEach(([col]) => { rights[col] = ar ? isTrue(ar[col]) : false; });
    setAccess({ user: u, rights });
  };

  const saveAccess = async () => {
    setBusy(true);
    const body = { subUserID: access.user.SubUserID };
    RIGHTS.forEach(([col, key]) => { body[key] = !!access.rights[col]; });
    const r = await api.post('/api/admin/access-rights', body);
    setBusy(false);
    if (r?.success) { toast('Access rights saved!'); setAccess(null); }
    else toast(r?.message || 'Error saving access rights', 'error');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Sub Users" subtitle={users ? `${users.length} staff` : ' '} right={<Button size="sm" icon="add" title="New" onPress={() => { setErrors({}); setForm({ ...BLANK }); }} />} />
      {users === null ? <Loading /> : (
        <FlatList
          data={users}
          keyExtractor={(u) => String(u.SubUserID)}
          contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brand} colors={[colors.brand]} />}
          ListHeaderComponent={(
            <Pressable onPress={() => { tap(); router.push('/assign-clients'); }} style={styles.assign}>
              <Ionicons name="people-circle-outline" size={24} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.assignTitle}>Assign Customers</Text>
                <Text style={styles.assignSub}>Choose which customers each staff member can see</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState icon="person-add-outline" title="No Sub Users Found" action={<Button title="Add sub user" icon="add" onPress={() => setForm({ ...BLANK })} />} />}
          renderItem={({ item: u }) => {
            const active = isTrue(u.IsActive);
            return (
              <View style={styles.card}>
                <Row>
                  <Avatar name={u.subusername || String(u.SubUserID)} size={44} />
                  <View style={{ flex: 1, marginLeft: space.md }}>
                    <Text style={styles.name}>{u.subusername || '—'}</Text>
                    <Text style={styles.sub}>ID {u.SubUserID}  ·  {u.Mobile || ''}</Text>
                    <Text style={styles.pwd}>Password: {u.Password || ''}</Text>
                  </View>
                  <Badge text={active ? 'Active' : 'Inactive'} tone={active ? 'success' : 'danger'} />
                </Row>
                <Row gap={8} style={{ marginTop: space.md }}>
                  <Button size="sm" variant="outline" icon="create-outline" title="Edit" style={{ flex: 1 }} onPress={() => { setErrors({}); setForm({ id: String(u.SubUserID), name: u.subusername || '', mobile: u.Mobile || '', password: u.Password || '', active }); }} />
                  <Button size="sm" variant="secondary" icon="shield-checkmark-outline" title="Access rights" style={{ flex: 1.4 }} onPress={() => openAccess(u)} />
                </Row>
              </View>
            );
          }}
        />
      )}

      <Sheet
        visible={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Edit Sub User' : 'Create Sub User'}
        footer={<Row gap={10}><Button title="Cancel" variant="outline" onPress={() => setForm(null)} style={{ flex: 1 }} /><Button title={form?.id ? 'Update' : 'Save'} icon="checkmark" loading={busy} onPress={save} style={{ flex: 1.4 }} /></Row>}
      >
        {form ? (
          <>
            <Field label="Name" icon="person-outline" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Enter Name" error={errors.name} />
            <Field label="Mobile" icon="call-outline" value={form.mobile} onChangeText={(v) => setForm((f) => ({ ...f, mobile: onlyDigits(v) }))} keyboardType="number-pad" maxLength={10} placeholder="Enter Mobile No" error={errors.mobile} />
            <Field label="Password" icon="key-outline" value={form.password} onChangeText={(v) => setForm((f) => ({ ...f, password: v }))} placeholder="Enter Password" autoCapitalize="none" error={errors.password} />
            <SwitchRow label="Active" description="Inactive staff cannot log in" value={form.active} onValueChange={(v) => setForm((f) => ({ ...f, active: v }))} />
          </>
        ) : null}
      </Sheet>

      <Sheet
        visible={!!access}
        onClose={() => setAccess(null)}
        title="Access Right"
        subtitle={access ? `${access.user.subusername || ''} (${access.user.Mobile || access.user.SubUserID})` : ''}
        headerRight={access?.rights ? (
          <Pressable onPress={() => { const all = RIGHTS.every(([c]) => access.rights[c]); const next = {}; RIGHTS.forEach(([c]) => { next[c] = !all; }); setAccess((a) => ({ ...a, rights: next })); }} style={styles.allBtn}>
            <Text style={styles.allText}>{RIGHTS.every(([c]) => access.rights[c]) ? 'None' : 'All'}</Text>
          </Pressable>
        ) : null}
        footer={<Button title="Save Access Rights" icon="shield-checkmark" loading={busy} onPress={saveAccess} full disabled={!access?.rights} />}
      >
        {!access?.rights ? <Loading inline /> : (
          <View style={styles.rights}>
            {RIGHTS.map(([col, , label]) => (
              <CheckRow key={col} label={label} checked={!!access.rights[col]} onPress={() => setAccess((a) => ({ ...a, rights: { ...a.rights, [col]: !a.rights[col] } }))} style={{ width: '50%' }} />
            ))}
          </View>
        )}
      </Sheet>
    </View>
  );
}

export default function SubUsers() {
  return <Guard menuKey="subusers" ownerOnly title="Sub Users"><SubUsersScreen /></Guard>;
}

const styles = StyleSheet.create({
  assign: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.brandSoft, borderRadius: radius.lg, padding: space.md, marginBottom: space.md },
  assignTitle: { fontWeight: weight.heavy, color: colors.brandText, fontSize: font.md },
  assignSub: { color: colors.textSoft, fontSize: font.xs, marginTop: 1 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.md, marginBottom: 10, ...shadow },
  name: { fontSize: font.md, fontWeight: weight.heavy, color: colors.text },
  sub: { fontSize: font.sm, color: colors.muted, marginTop: 2 },
  pwd: { fontSize: font.xs, color: colors.faint, marginTop: 2 },
  rights: { flexDirection: 'row', flexWrap: 'wrap' },
  allBtn: { paddingHorizontal: 12, height: 34, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  allText: { color: colors.brandText, fontWeight: weight.bold },
});
