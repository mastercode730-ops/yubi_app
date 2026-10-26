import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import api from '../../api/client';
import Guard from '../../components/Guard';
import { istDMY, toDMY, toMonDate } from '../../lib/dates';
import { param } from '../../lib/nav';
import { AKHAR_AADAR, AKHAR_ANDER, DARA_NUMS } from '../../lib/yantriEngine';
import { Button, Card, EmptyState, Header, Loading, Row, Screen } from '../../ui/kit';
import { DateField, SelectField } from '../../ui/Sheet';
import { colors, font, space, weight } from '../../theme';

const W = Math.min(Dimensions.get('window').width, 560);
const CELL = Math.floor((W - space.lg * 2 - space.md * 2 - 9 * 3) / 10);

// frmOpenYantri: any user's yantri for a game & date (Super Admin).
function OpenYantriScreen() {
  const q = useLocalSearchParams();
  const [users, setUsers] = useState([]);
  const [uid, setUid] = useState(param(q.UID));
  const [games, setGames] = useState([]);
  const [gid, setGid] = useState(param(q.GameID));
  const [date, setDate] = useState(param(q.Date) ? toDMY(param(q.Date)) : istDMY());
  const [data, setData] = useState(undefined);

  const loadGames = async (u) => {
    setGames([]);
    if (!u) return;
    const r = await api.get('/api/admin/all-user-games', { uid: u });
    setGames(r?.data || []);
  };

  const load = async (u = uid, g = gid, d = date) => {
    if (!u || !g) return;
    setData(null);
    const r = await api.get('/api/admin/open-yantri', { uid: u, gameID: g, date: toMonDate(d) });
    const nd = {};
    (r?.data || []).forEach((row) => {
      if (!row.Message) return;
      row.Message.split(',').forEach((part) => {
        const kv = part.split('=');
        if (kv.length === 2) {
          const n = parseInt(kv[0], 10);
          const a = Math.trunc(parseFloat(kv[1]) || 0);
          if (!isNaN(n)) nd[n] = (nd[n] || 0) + a;
        }
      });
    });
    setData({ nd, empty: !(r?.data || []).length });
  };

  useEffect(() => {
    api.get('/api/admin/users').then((r) => setUsers(r?.data || []));
    if (uid) loadGames(uid);
    if (uid && gid) load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const grand = useMemo(() => (data ? Object.values(data.nd).reduce((a, b) => a + b, 0) : 0), [data]);
  const cell = (n) => {
    const v = data?.nd[n] || 0;
    return (
      <View key={n} style={[styles.cell, v ? styles.hot : null]}>
        <Text style={styles.label}>{n < 10 ? '0' + n : n}</Text>
        <Text style={styles.val} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{v || ''}</Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Open Yantri" subtitle="Any user's yantri" />
      <Screen scroll>
        <Card>
          <SelectField label="User" value={uid} options={users.map((u) => ({ value: String(u.UID), label: u.Mobile, sub: `UID ${u.UID}` }))} onChange={(v) => { setUid(v); setGid(''); loadGames(v); }} placeholder="--- Select User ---" searchable />
          <Row gap={10}>
            <SelectField label="Game" value={gid} options={games.map((g) => ({ value: String(g.GID), label: g.GameName }))} onChange={setGid} placeholder="--- Select Game ---" style={{ flex: 1.2 }} disabled={!uid} />
            <DateField label="Date" value={date} onChange={setDate} style={{ flex: 1 }} />
          </Row>
          <Button title="Load Yantri" icon="grid" onPress={() => load()} disabled={!uid || !gid} />
        </Card>
        {data === undefined ? null : data === null ? <Loading inline /> : data.empty ? <EmptyState icon="grid-outline" title="No data found" /> : (
          <Card style={{ padding: space.md }}>
            {Array.from({ length: 10 }, (_, r) => (
              <View key={r} style={styles.row}>{DARA_NUMS.slice(r * 10, r * 10 + 10).map(cell)}</View>
            ))}
            <View style={styles.sep} />
            <View style={styles.row}>{AKHAR_AADAR.map(cell)}</View>
            <View style={styles.row}>{AKHAR_ANDER.map(cell)}</View>
            <Text style={styles.grand}>Grand Total: {grand}</Text>
          </Card>
        )}
      </Screen>
    </View>
  );
}

export default function OpenYantri() {
  return <Guard menuKey="admin" title="Open Yantri"><OpenYantriScreen /></Guard>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 3, marginBottom: 3 },
  cell: { width: CELL, height: CELL + 6, borderRadius: 7, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  hot: { backgroundColor: colors.brandSoft },
  label: { fontSize: 8.5, color: colors.faint, fontWeight: weight.bold },
  val: { fontSize: 11, fontWeight: weight.heavy, color: colors.text },
  sep: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
  grand: { textAlign: 'center', fontSize: font.lg, fontWeight: weight.heavy, color: colors.text, marginTop: space.md },
});
