import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import Guard from '../../components/Guard';
import { displayDate } from '../../lib/dates';
import { fmtNum, isTrue } from '../../lib/format';
import { Badge, Header, HeaderAction, Loading, Row, Screen, SectionTitle, StatTile, tap } from '../../ui/kit';
import { colors, font, radius, shadow, space, weight } from '../../theme';

const LINKS = [
  { route: '/admin/users', label: 'Users', icon: 'people', tint: '#5B4CF5' },
  { route: '/admin/sales', label: 'Sale', icon: 'cash', tint: '#12A150' },
  { route: '/admin/open-yantri', label: 'Yantri', icon: 'grid', tint: '#D98A00' },
];

function AdminDashboard() {
  const [dash, setDash] = useState(null);
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setDash(null); setUsers(null);
    const [d, u] = await Promise.all([api.get('/api/admin/dashboard'), api.get('/api/admin/users')]);
    setDash(d?.success ? d.data || {} : {});
    setUsers(u?.success ? u.data || [] : []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const t = q.toLowerCase();
    return (users || []).filter((u) => String(u.UID ?? '').toLowerCase().includes(t) || String(u.Mobile ?? '').toLowerCase().includes(t));
  }, [users, q]);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Admin" subtitle={today} right={<HeaderAction icon="refresh" onPress={load} />} />
      <Screen scroll>
        <Row gap={10}>
          <StatTile label="Total Users" icon="people" value={dash ? String(dash.TotalUsers || '0') : '–'} tone="brand" onPress={() => router.push('/admin/users')} />
          <StatTile label="Today's Sale" icon="cash" value={dash ? fmtNum(dash.TotalAmount || 0, 0) : '–'} tone="success" onPress={() => router.push('/admin/sales')} />
        </Row>
        <Row gap={10} style={{ marginTop: 10 }}>
          <StatTile label="New Users (Month)" icon="sparkles" value={dash ? String(dash.NewUsers || '0') : '–'} tone="warning" />
          <StatTile label="Back to app" icon="arrow-back" value="Home" onPress={() => router.replace('/home')} />
        </Row>

        <View style={styles.links}>
          {LINKS.map((l) => (
            <Pressable key={l.route} onPress={() => { tap(); router.push(l.route); }} style={styles.link}>
              <View style={[styles.linkIcon, { backgroundColor: l.tint + '1A' }]}><Ionicons name={l.icon} size={20} color={l.tint} /></View>
              <Text style={styles.linkText}>{l.label}</Text>
            </Pressable>
          ))}
        </View>

        <SectionTitle title="User accounts" hint={users ? `${shown.length} users` : undefined} />
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={colors.faint} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search by UID or mobile…" placeholderTextColor={colors.faint} style={styles.searchInput} />
        </View>
        {users === null ? <Loading inline /> : shown.map((u, i) => {
          const active = isTrue(u.IsActive);
          return (
            <View key={u.UID ?? i} style={styles.user}>
              <Text style={styles.idx}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.mobile}>{u.Mobile}</Text>
                <Text style={styles.meta}>UID {u.UID}  ·  Valid {u.Validity || u.ValidityDate ? displayDate(u.Validity || u.ValidityDate) : '-'}  ·  Reg {u.RegisteredOn ? displayDate(u.RegisteredOn) : '-'}</Text>
              </View>
              <Badge text={active ? 'Active' : 'Inactive'} tone={active ? 'success' : 'danger'} />
            </View>
          );
        })}
      </Screen>
    </View>
  );
}

export default function Admin() {
  return <Guard menuKey="admin" title="Admin"><AdminDashboard /></Guard>;
}

const styles = StyleSheet.create({
  links: { flexDirection: 'row', gap: 10, marginTop: space.md },
  link: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center', ...shadow },
  linkIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  linkText: { fontWeight: weight.bold, color: colors.text },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: radius.md, height: 42, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, marginBottom: space.sm },
  searchInput: { flex: 1, fontSize: font.base, color: colors.text, paddingVertical: 0 },
  user: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: radius.md, padding: 12, marginBottom: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  idx: { width: 24, color: colors.faint, fontWeight: weight.bold },
  mobile: { fontSize: font.md, fontWeight: weight.heavy, color: colors.text },
  meta: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
});
