import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/client';
import Guard from '../components/Guard';
import { istDMY, toDMY } from '../lib/dates';
import { Avatar, Button, Card, EmptyState, Header, Loading, Row, Screen } from '../ui/kit';
import { DateField, SelectField } from '../ui/Sheet';
import { toast } from '../ui/Toast';
import { colors, font, radius, space, weight } from '../theme';

// Customers who sent nothing for a game on a date (absent-customers.html).
function AbsentScreen() {
  const [date, setDate] = useState('');
  const [games, setGames] = useState([]);
  const [gid, setGid] = useState('');
  const [rows, setRows] = useState(undefined);

  useEffect(() => {
    (async () => {
      const [rg, rl] = await Promise.all([api.get('/api/game'), api.get('/api/hisab/latest-date')]);
      setGames(rg?.data || []);
      setDate(rl?.success && rl.data ? toDMY(rl.data) : istDMY());
    })();
  }, []);

  const search = async (d = date, g = gid) => {
    if (!d || !g) { toast('Date aur Game dono select karo', 'error'); return; }
    setRows(null);
    const r = await api.get('/api/home/absent-customers', { date: d, gameID: g });
    setRows(r?.success ? r.data || [] : []);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Absent Report" subtitle="Customers with no entry" />
      <Screen scroll>
        <Card>
          <Row gap={10}>
            <DateField label="Date" value={date} onChange={(d) => { setDate(d); if (gid) search(d, gid); }} style={{ flex: 1 }} />
            <SelectField label="Game" value={gid} options={games.map((g) => ({ value: String(g.GID), label: g.GameName }))} onChange={(g) => { setGid(g); search(date, g); }} placeholder="Select Game" style={{ flex: 1.2 }} />
          </Row>
          <Button title="Search" icon="search" onPress={() => search()} />
        </Card>
        {rows === undefined ? (
          <EmptyState icon="person-remove-outline" title="Date aur Game select karke Search karo" />
        ) : rows === null ? <Loading inline /> : rows.length === 0 ? (
          <EmptyState icon="checkmark-done-circle-outline" title="No Data Found!" message="Every customer has an entry for this game and date." />
        ) : (
          <>
            <Text style={styles.count}>{rows.length} absent customer{rows.length === 1 ? '' : 's'}</Text>
            {rows.map((r, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.sr}>{i + 1}</Text>
                <Avatar name={r.CustomerName} size={38} />
                <View style={{ flex: 1, marginLeft: space.md }}>
                  <Text style={styles.name} numberOfLines={1}>{r.CustomerName || ''}</Text>
                  <Text style={styles.mob}>{r.Mobile || ''}</Text>
                </View>
                {r.Mobile ? (
                  <Pressable hitSlop={6} onPress={() => Linking.openURL(`tel:${r.Mobile}`).catch(() => {})} style={styles.call}>
                    <Ionicons name="call" size={16} color={colors.success} />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </>
        )}
      </Screen>
    </View>
  );
}

export default function AbsentReport() {
  return <Guard menuKey="absent-customers" ownerOnly title="Absent Report"><AbsentScreen /></Guard>;
}

const styles = StyleSheet.create({
  count: { color: colors.muted, fontWeight: weight.semi, marginBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, padding: 12, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  sr: { width: 26, color: colors.faint, fontWeight: weight.bold },
  name: { fontSize: font.md, fontWeight: weight.bold, color: colors.text },
  mob: { fontSize: font.sm, color: colors.muted, marginTop: 1 },
  call: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' },
});
