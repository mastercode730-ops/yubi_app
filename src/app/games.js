import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/client';
import Guard from '../components/Guard';
import { isTrue } from '../lib/format';
import { Button, EmptyState, Field, Header, Loading, Row, SwitchRow, tap } from '../ui/kit';
import { Sheet } from '../ui/Sheet';
import { toast } from '../ui/Toast';
import { colors, font, radius, shadow, space, weight } from '../theme';

const TOGGLES = [
  { field: 'IsNextDayResult', label: 'Next Day' },
  { field: 'IsAcceptedStatus', label: 'Auto Accept' },
  { field: 'IsRejectedMsg', label: 'Over Time Reject' },
  { field: 'IsActive', label: 'Active' },
];
const BLANK = { gid: '', name: '', time: '', nextDay: false, active: true, accepted: false, rejected: false };

// One-tap draw times; any other time can still be typed (e.g. 06:45 PM).
const TIME_PRESETS = ['10:00 AM', '12:00 PM', '02:00 PM', '04:00 PM', '06:00 PM', '08:00 PM', '10:00 PM', '11:30 PM'];

function GamesScreen() {
  const insets = useSafeAreaInsets();
  const [games, setGames] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const r = await api.get('/api/game');
    setGames(r?.success ? r.data || [] : []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (g, field, value) => {
    setGames((list) => list.map((x) => (x.GID === g.GID ? { ...x, [field]: value ? 'True' : 'False' } : x)));
    const r = await api.post('/api/game/toggle', { gid: g.GID, field, value });
    if (!r?.success) { toast(r?.message || 'Update failed', 'error'); }
    load();
  };

  const submit = async () => {
    const gameName = form.name.trim(), drawTime = form.time.trim();
    if (!gameName || !drawTime) { toast('Game name and draw time required', 'error'); return; }
    setBusy(true);
    const body = {
      gameName, drawTime, isNextDay: form.nextDay, isNextDayResult: form.nextDay,
      isActive: form.active, isAcceptedStatus: form.accepted, isRejectedMsg: form.rejected,
    };
    const r = form.gid ? await api.put(`/api/game/${form.gid}`, body) : await api.post('/api/game', body);
    setBusy(false);
    if (r?.success) { toast(form.gid ? 'Data Updated Successfully!' : 'Data Saved Successfully!'); setForm(null); load(); }
    else toast(r?.message || 'Error', 'error');
  };

  const del = async (g) => {
    setConfirmDel(null);
    const r = await api.del(`/api/game/${g.GID}`);
    if (r?.success) { toast('Data Deleted Successfully!'); load(); }
    else toast(r?.message || 'Error', 'error');
  };

  const edit = (g) => setForm({
    gid: String(g.GID), name: g.GameName || '', time: g.DrawTime || '',
    nextDay: isTrue(g.IsNextDayResult), active: isTrue(g.IsActive), accepted: isTrue(g.IsAcceptedStatus), rejected: isTrue(g.IsRejectedMsg),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Games" subtitle={games ? `${games.length} games` : 'Add Game'} right={<Button size="sm" icon="add" title="New" onPress={() => setForm({ ...BLANK })} />} />
      {games === null ? <Loading /> : (
        <FlatList
          data={games}
          keyExtractor={(g) => String(g.GID)}
          contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brand} colors={[colors.brand]} />}
          ListEmptyComponent={<EmptyState icon="game-controller-outline" title="No games found" message="Add your first game!" action={<Button title="Add game" icon="add" onPress={() => setForm({ ...BLANK })} />} />}
          renderItem={({ item: g }) => (
            <View style={[styles.card, !isTrue(g.IsActive) && { opacity: 0.7 }]}>
              <Row>
                <View style={styles.icon}><Ionicons name="dice" size={20} color="#fff" /></View>
                <View style={{ flex: 1, marginLeft: space.md }}>
                  <Text style={styles.name}>{g.GameName}</Text>
                  <Text style={styles.time}><Ionicons name="time-outline" size={12} /> Draw {g.DrawTime || '-'}</Text>
                </View>
                <Pressable hitSlop={6} onPress={() => { tap(); edit(g); }} style={styles.iconBtn}><Ionicons name="create-outline" size={18} color={colors.warning} /></Pressable>
                <Pressable hitSlop={6} onPress={() => { tap(); setConfirmDel(g); }} style={styles.iconBtn}><Ionicons name="trash-outline" size={18} color={colors.danger} /></Pressable>
              </Row>
              <View style={styles.toggles}>
                {TOGGLES.map((t) => {
                  const on = isTrue(g[t.field]);
                  return (
                    <Pressable key={t.field} onPress={() => { tap(); toggle(g, t.field, !on); }} style={[styles.tog, on && styles.togOn]}>
                      <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={15} color={on ? colors.success : colors.faint} />
                      <Text style={[styles.togText, on && { color: colors.success }]}>{t.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        />
      )}

      <Sheet
        visible={!!form}
        onClose={() => setForm(null)}
        title={form?.gid ? 'Edit Game' : 'Create Games'}
        footer={<Row gap={10}><Button title="Cancel" variant="outline" onPress={() => setForm(null)} style={{ flex: 1 }} /><Button title={form?.gid ? 'Update' : 'Submit'} icon="checkmark" loading={busy} onPress={submit} style={{ flex: 1.4 }} /></Row>}
      >
        {form ? (
          <>
            <Field label="Game Name" icon="dice-outline" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Enter Game Name" />
            <Field label="Draw Time" icon="time-outline" value={form.time} onChangeText={(v) => setForm((f) => ({ ...f, time: v }))} placeholder="e.g. 06:00 PM" autoCapitalize="characters" />
            <Row gap={6} wrap style={{ marginTop: -4, marginBottom: space.md }}>
              {TIME_PRESETS.map((t) => (
                <Pressable key={t} onPress={() => setForm((f) => ({ ...f, time: t }))} style={[styles.preset, form.time === t && styles.presetOn]}>
                  <Text style={[styles.presetText, form.time === t && { color: '#fff' }]}>{t}</Text>
                </Pressable>
              ))}
            </Row>
            <SwitchRow label="Next Day" description="Result is declared the next day" value={form.nextDay} onValueChange={(v) => setForm((f) => ({ ...f, nextDay: v }))} />
            <SwitchRow label="Active" value={form.active} onValueChange={(v) => setForm((f) => ({ ...f, active: v }))} />
            <SwitchRow label="Auto Accept" description="Incoming entries are accepted automatically" value={form.accepted} onValueChange={(v) => setForm((f) => ({ ...f, accepted: v }))} />
            <SwitchRow label="Over Time Reject" description="Reject customer entries after draw time" value={form.rejected} onValueChange={(v) => setForm((f) => ({ ...f, rejected: v }))} />
          </>
        ) : null}
      </Sheet>

      <Sheet
        visible={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title={`Delete game "${confirmDel?.GameName || ''}"?`}
        subtitle="The game is deactivated and disappears from pickers."
        footer={<Row gap={10}><Button title="Keep" variant="outline" onPress={() => setConfirmDel(null)} style={{ flex: 1 }} /><Button title="Delete" variant="danger" onPress={() => del(confirmDel)} style={{ flex: 1.3 }} /></Row>}
      />
    </View>
  );
}

export default function Games() {
  return <Guard menuKey="game" title="Games"><GamesScreen /></Guard>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.md, marginBottom: 10, ...shadow },
  icon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: font.lg, fontWeight: weight.heavy, color: colors.text },
  time: { fontSize: font.sm, color: colors.muted, marginTop: 2 },
  iconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  toggles: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.md },
  tog: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  togOn: { backgroundColor: colors.successSoft, borderColor: '#BDE9CD' },
  togText: { fontSize: font.xs, fontWeight: weight.bold, color: colors.muted },
  preset: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  presetOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  presetText: { fontSize: font.xs, fontWeight: weight.bold, color: colors.textSoft },
});
