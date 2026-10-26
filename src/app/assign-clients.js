import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/client';
import Guard from '../components/Guard';
import { isTrue } from '../lib/format';
import { Button, CheckRow, EmptyState, Header, Loading, Row } from '../ui/kit';
import { SelectField } from '../ui/Sheet';
import { toast } from '../ui/Toast';
import { colors, font, radius, space, weight } from '../theme';

function AssignScreen() {
  const insets = useSafeAreaInsets();
  const [subusers, setSubusers] = useState([]);
  const [staff, setStaff] = useState('');
  const [clients, setClients] = useState(null);
  const [checked, setChecked] = useState({});
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/api/admin/subusers').then((r) => setSubusers(r?.data || []));
  }, []);

  const loadClients = async (id) => {
    setClients(null);
    if (!id) { setClients([]); return; }
    const r = await api.get('/api/admin/assigned-clients', { staffID: id });
    const list = r?.success ? r.data || [] : [];
    const c = {};
    list.forEach((x) => { if (isTrue(x.IsAssigned)) c[x.CID] = true; });
    setChecked(c);
    setClients(list);
  };

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (clients || []).filter((c) => !t || String(c.CustomerName || c.CID || '').toLowerCase().includes(t));
  }, [clients, q]);
  const allVisibleChecked = shown.length > 0 && shown.every((c) => checked[c.CID]);
  const count = Object.values(checked).filter(Boolean).length;

  const toggleAll = () => setChecked((c) => {
    const next = { ...c };
    shown.forEach((x) => { next[x.CID] = !allVisibleChecked; });
    return next;
  });

  const save = async () => {
    if (!staff) { toast('Select Sub user first!', 'error'); return; }
    setBusy(true);
    const customerIDs = Object.keys(checked).filter((k) => checked[k]).map((k) => String(k).trim()).filter(Boolean);
    const r = await api.post('/api/admin/assign-clients', { staffID: staff, customerIDs });
    setBusy(false);
    if (r?.success) { toast('Data Update Successfully!'); loadClients(staff); }
    else toast(r?.message || 'Something Wrong', 'error');
  };

  const staffOptions = subusers.map((u) => {
    const name = (u.subusername || u.Name || '').trim();
    const id = String(u.SubUserID || '').trim();
    return { value: id, label: name ? `${name} - ${id}` : id, sub: u.Mobile };
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Assign Customers" subtitle={staff ? `${count} assigned` : 'Select a sub user'} />
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
        <SelectField label="Sub user" value={staff} options={staffOptions} onChange={(v) => { setStaff(v || ''); loadClients(v); }} placeholder="Select Sub user" searchable avatars />
        {staff ? (
          <>
            <View style={styles.search}>
              <Ionicons name="search" size={16} color={colors.faint} />
              <TextInput value={q} onChangeText={setQ} placeholder="Search customer by name…" placeholderTextColor={colors.faint} style={styles.searchInput} />
              {q ? <Pressable onPress={() => setQ('')}><Ionicons name="close-circle" size={17} color={colors.faint} /></Pressable> : null}
            </View>
            <CheckRow label={`Select all${q ? ' (filtered)' : ''}`} sub={`${shown.length} customers shown`} checked={allVisibleChecked} onPress={toggleAll} style={styles.allRow} />
          </>
        ) : null}
      </View>
      {!staff ? (
        <EmptyState icon="people-outline" title="Select a sub user to load clients" />
      ) : clients === null ? <Loading /> : (
        <FlatList
          data={shown}
          keyExtractor={(c) => String(c.CID)}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 100 }}
          initialNumToRender={25}
          ListEmptyComponent={<EmptyState icon="search-outline" title={clients.length ? 'No matching customer found' : 'No clients found'} />}
          renderItem={({ item: c, index }) => (
            <CheckRow label={`${index + 1}.  ${c.CustomerName || c.CID}`} checked={!!checked[c.CID]} onPress={() => setChecked((x) => ({ ...x, [c.CID]: !x[c.CID] }))} style={styles.row} />
          )}
        />
      )}
      {staff ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
          <Row justify="space-between">
            <Text style={styles.count}>{count} selected</Text>
            <Button title="Save" icon="checkmark" loading={busy} onPress={save} style={{ minWidth: 140 }} />
          </Row>
        </View>
      ) : null}
    </View>
  );
}

export default function AssignClients() {
  return <Guard menuKey="subusers" ownerOnly title="Assign Customers"><AssignScreen /></Guard>;
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: radius.md, height: 42, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, fontSize: font.base, color: colors.text, paddingVertical: 0 },
  allRow: { marginTop: space.sm, backgroundColor: colors.brandSoft, paddingHorizontal: 12 },
  row: { backgroundColor: colors.card, paddingHorizontal: 12, marginBottom: 6, borderRadius: radius.md },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  count: { fontWeight: weight.heavy, color: colors.text },
});
