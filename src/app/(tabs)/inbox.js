import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { chatFmtDate, istDMY, toDMY, toISO } from '../../lib/dates';
import { useFocusRefresh } from '../../lib/hooks';
import { openEntry, param } from '../../lib/nav';
import { Avatar, Button, Chip, CountBadge, EmptyState, Field, Header, Loading, Segmented, SwitchRow, tap } from '../../ui/kit';
import { DateField, SelectSheet, Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/Toast';
import { colors, font, radius, shadow, space, weight } from '../../theme';

const LAST_GID = 'last_received_gid';

export default function Inbox() {
  const qs = useLocalSearchParams();
  const { user, can } = useAuth();
  const [games, setGames] = useState([]);
  const [gid, setGid] = useState('');
  const [gameName, setGameName] = useState('');
  const [gameDate, setGameDate] = useState(''); // yyyy-mm-dd
  const [viewAll, setViewAll] = useState(false);
  const [contacts, setContacts] = useState(null);
  const [pool, setPool] = useState([]);
  const [search, setSearch] = useState('');
  const [autoAccept, setAutoAccept] = useState(false);
  const [receivers, setReceivers] = useState([]);
  const [custOpen, setCustOpen] = useState(false);
  const [rateSheet, setRateSheet] = useState(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);

  const fetchGameDate = useCallback(async (g) => {
    const j = await api.get('/api/chat/date', { gameId: g });
    return j?.date ? toISO(String(j.date)) || String(j.date).substring(0, 10) : toISO(istDMY());
  }, []);

  const loadContacts = useCallback(async (g, all, date) => {
    if (!g) return;
    const id = ++seq.current;
    setContacts(null);
    setSearch('');
    const r = await api.get('/api/received/contacts', { gid: g, viewAll: all, date: date || toISO(istDMY()) });
    if (id !== seq.current) return;
    const data = r?.success ? r.data || [] : [];
    if (data[0]?.GameName) setGameName(data[0].GameName);
    setContacts(data);
    if (all) setPool(data);
  }, []);

  const loadPool = useCallback(async (g) => {
    const r = await api.get('/api/received/contacts', { gid: g, viewAll: true });
    if (r?.success && r.data?.length) setPool(r.data);
  }, []);

  const loadAuto = useCallback(async (g) => {
    const r = await api.get('/api/game/auto-accept-status', { gid: g });
    if (r?.success) {
      const v = r.data?.IsAcceptedStatus;
      setAutoAccept(v === true || v === 'True' || v === 'true' || v === 1);
    }
  }, []);

  const selectGame = useCallback(async (g, name) => {
    setGid(String(g));
    setGameName(name || '');
    setViewAll(false);
    AsyncStorage.setItem(LAST_GID, String(g)).catch(() => {});
    const d = await fetchGameDate(g);
    setGameDate(d);
    loadAuto(g);
    loadContacts(g, false, d);
    loadPool(g);
  }, [fetchGameDate, loadAuto, loadContacts, loadPool]);

  // init: games, then GID from params / last used / first game.
  useEffect(() => {
    (async () => {
      const [r, rl] = await Promise.all([api.get('/api/received/games'), api.get('/api/received/receiver-list')]);
      if (rl?.success) setReceivers(rl.data || []);
      const list = r?.success ? r.data || [] : [];
      setGames(list);
      if (!list.length) { setContacts([]); return; }
      const want = param(qs.GID);
      const saved = await AsyncStorage.getItem(LAST_GID).catch(() => null);
      const found = list.find((x) => String(x.GID) === want) || list.find((x) => String(x.GID) === String(saved)) || list[0];
      selectGame(found.GID, found.GameName);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Arriving from the Home game strip with a different game.
  useEffect(() => {
    const want = param(qs.GID);
    if (want && games.length && want !== gid) {
      const f = games.find((x) => String(x.GID) === want);
      if (f) selectGame(f.GID, f.GameName);
    }
  }, [qs.GID]); // eslint-disable-line react-hooks/exhaustive-deps

  // Coming back from the entry screen → refresh "Today" (web pageshow handler).
  useFocusRefresh(useCallback(() => {
    if (gid) { setViewAll(false); loadContacts(gid, false, gameDate); }
  }, [gid, gameDate, loadContacts]));

  const toggleAuto = async (v) => {
    setAutoAccept(v);
    await api.post('/api/received/accept-status', { gid, status: v });
  };

  const shown = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return contacts || [];
    const src = pool.length ? pool : contacts || [];
    return src.filter((c) => (c.CustomerName || '').toLowerCase().includes(q) || (c.Mobile || '').toLowerCase().includes(q));
  }, [search, contacts, pool]);

  const openFromCard = (c) => {
    if (c.CustomerName === 'ADD Contact') { router.push({ pathname: '/customers', params: { Mobile: c.Mobile } }); return; }
    const lastDate = c.LastMsgDate ? toISO(String(c.LastMsgDate)) || String(c.LastMsgDate) : istDMY();
    openEntry({
      mobile: c.Mobile, gameId: c.GID || gid, gameName: c.GameName || gameName, selUID: c.fSenderID, lastDate,
      rates: c.Rate, dPComm: c.D_PComm, dAmt: c.D_Amt, aPComm: c.A_PComm, aAmt: c.A_Amt, pati: c.Pati_PComm,
      hissaID: c.ThirdPartyHissaID, hissaPer: c.ThirdPartyHissaPer,
      tpCommID: c.ThirdPartyCommID, tpDara: c.ThirdPartyDaraComm, tpAkhar: c.ThirdPartyAkharComm, selPage: '1',
    });
  };

  // Customer search → rates → entry (handleCustomerSelect).
  const onCustomer = async (opt) => {
    const customer = receivers.find((c) => String(c.CID) === String(opt.value));
    if (!customer) return;
    const viaRate = (d) => openEntry({
      mobile: d.MobileNo || customer.Mobile, gameId: gid, gameName, selUID: customer.UID || d.fUID, lastDate: istDMY(),
      rates: d.Rate, dPComm: d.D_PComm, dAmt: d.D_Amt, aPComm: d.A_PComm, aAmt: d.A_Amt, pati: d.Patti || d.Pati_PComm || '0',
      hissaID: d.ThirdPartyHissaID, hissaPer: d.ThirdPartyHissaPer,
      tpCommID: d.ThirdPartyCommID, tpDara: d.ThirdPartyDaraComm, tpAkhar: d.ThirdPartyAkharComm, selPage: '1',
    });
    const fallback = () => openEntry({
      mobile: customer.Mobile, gameId: gid, gameName, selUID: customer.UID || customer.fUID || user?.UID, lastDate: istDMY(),
      rates: customer.Rate || '0/100-0/10-0', dPComm: customer.D_PComm || '0', dAmt: customer.D_Amt || '100',
      aPComm: customer.A_PComm || '0', aAmt: customer.A_Amt || '10', pati: customer.Patti || '0',
      hissaID: customer.ThirdPartyHissaID || '0', hissaPer: customer.ThirdPartyHissaPer || '0',
      tpCommID: customer.ThirdPartyCommID || '0', tpDara: customer.ThirdPartyDaraComm || '0', tpAkhar: customer.ThirdPartyAkharComm || '0', selPage: '1',
    });
    const r = await api.get('/api/received/customer-rates', { cid: customer.CID });
    const dt = r?.success && r.data?.length ? r.data : null;
    if (r?.network) { toast(r.message, 'error'); return; }
    if (!dt) fallback();
    else if (dt.length === 1) viaRate(dt[0]);
    else setRateSheet({ customer, rates: dt, go: viaRate });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadContacts(gid, viewAll, gameDate);
    if (!viewAll) loadPool(gid);
    setRefreshing(false);
  };

  const receiverOptions = useMemo(() => receivers.map((c) => ({ value: c.CID, label: c.CustomerName, sub: c.Mobile })), [receivers]);

  const top = (
    <View>
      <View style={styles.gamesRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: space.lg }}>
          {games.map((g) => (
            <Chip key={g.GID} label={g.GameName} selected={String(g.GID) === gid} onPress={() => selectGame(g.GID, g.GameName)} />
          ))}
        </ScrollView>
      </View>

      {gid ? (
        <View style={{ paddingHorizontal: space.lg }}>
          <View style={styles.toolCard}>
            <View style={styles.toolRow}>
              {can('Yantri') ? (
                <Pressable style={styles.tool} onPress={() => { tap(); router.push({ pathname: '/yantri', params: { GameID: gid } }); }}>
                  <Ionicons name="grid" size={18} color={colors.brand} />
                  <Text style={styles.toolText}>Yantri</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.tool} onPress={() => { tap(); setResultOpen(true); }}>
                <Ionicons name="trophy" size={18} color={colors.warning} />
                <Text style={styles.toolText}>Result</Text>
              </Pressable>
              <Pressable style={[styles.tool, { flex: 1.4 }]} onPress={() => { tap(); setCustOpen(true); }}>
                <Ionicons name="person-add" size={18} color={colors.success} />
                <Text style={styles.toolText}>New entry</Text>
              </Pressable>
            </View>
            <SwitchRow label="Auto Accept" description="Accept incoming entries for this game automatically" value={autoAccept} onValueChange={toggleAuto} style={{ paddingBottom: 0 }} />
          </View>

          <Segmented
            value={viewAll ? 'all' : 'today'}
            onChange={(k) => { const all = k === 'all'; setViewAll(all); loadContacts(gid, all, gameDate); }}
            options={[{ key: 'today', label: 'Today', icon: 'today-outline' }, { key: 'all', label: 'View All', icon: 'albums-outline' }]}
            style={{ marginBottom: space.md }}
          />
          <View style={styles.search}>
            <Ionicons name="search" size={17} color={colors.faint} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Search name / mobile…" placeholderTextColor={colors.faint} style={styles.searchInput} autoCorrect={false} />
            {search ? <Pressable hitSlop={8} onPress={() => setSearch('')}><Ionicons name="close-circle" size={18} color={colors.faint} /></Pressable> : null}
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header
        title={gameName || 'Games'}
        subtitle={gid ? (viewAll ? 'All customers' : `Today${gameDate ? ' · ' + toDMY(gameDate) : ''}`) : 'Received entries'}
        back={false}
      />
      {!games.length && contacts !== null ? (
        <EmptyState icon="game-controller-outline" title="No Games Found" message="Create a game from Menu → Add Game." />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(c, i) => `${c.fSenderID}-${c.Rate}-${i}`}
          ListHeaderComponent={top}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} />}
          ListEmptyComponent={contacts === null ? <Loading inline /> : <EmptyState icon="chatbubbles-outline" title="No Data Found!" message={viewAll ? 'No customer has sent entries for this game.' : 'No entries today. Tap “New entry” to start one.'} />}
          contentContainerStyle={{ paddingBottom: space.xxl }}
          renderItem={({ item: c }) => {
            const ur = parseInt(c.UnReadTotal, 10) || 0;
            return (
              <Pressable onPress={() => { tap(); openFromCard(c); }} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
                <Avatar name={c.CustomerName || c.Mobile} size={46} />
                <View style={{ flex: 1, marginLeft: space.md }}>
                  {c.CustomerName ? <Text style={styles.cName} numberOfLines={1}>{c.CustomerName}</Text> : null}
                  <Text style={styles.cMob} numberOfLines={1}>{c.Mobile}{c.LastMsgDateAmount !== undefined && c.LastMsgDateAmount !== '' ? `  ·  ₹ ${c.LastMsgDateAmount}` : ''}</Text>
                  {c.Rate ? (
                    <View style={styles.metaRow}>
                      <Text style={styles.rateTag}>{c.Rate}</Text>
                      {c.LT ? <Text style={styles.lt} numberOfLines={1}>Last update {c.LT}</Text> : null}
                    </View>
                  ) : null}
                </View>
                {ur > 0 ? <CountBadge count={ur} /> : <Ionicons name="chevron-forward" size={18} color={colors.faint} />}
              </Pressable>
            );
          }}
        />
      )}

      <SelectSheet
        visible={custOpen}
        onClose={() => setCustOpen(false)}
        title={`New entry · ${gameName}`}
        placeholder="Search customer name / mobile…"
        options={receiverOptions}
        avatars
        onSelect={(o) => o && onCustomer(o)}
      />

      <Sheet visible={!!rateSheet} onClose={() => setRateSheet(null)} title="Select Rate" subtitle={rateSheet ? `${rateSheet.customer.CustomerName} (${rateSheet.customer.Mobile})` : ''}>
        {(rateSheet?.rates || []).map((d, i) => (
          <Pressable key={d.RateID || i} onPress={() => { const go = rateSheet.go; setRateSheet(null); go(d); }} style={({ pressed }) => [styles.rate, pressed && { backgroundColor: colors.brandSoft }]}>
            <Text style={styles.rateVal}>{d.Rate}</Text>
            <Ionicons name="arrow-forward-circle" size={24} color={colors.brand} />
          </Pressable>
        ))}
      </Sheet>

      <ResultSheet visible={resultOpen} onClose={() => setResultOpen(false)} gid={gid} gameName={gameName} defaultDate={gameDate} />
    </View>
  );
}

// Result modal (divAddResult): date + 2-digit result → save-result.
function ResultSheet({ visible, onClose, gid, gameName, defaultDate }) {
  const [date, setDate] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (d) => {
    if (!gid || !d) return;
    const r = await api.get('/api/game/result', { gid, date: toISO(d) });
    setResult(r?.success && r.data?.Result != null ? String(r.data.Result) : '');
  }, [gid]);
  useEffect(() => {
    if (visible) {
      const d = defaultDate ? chatFmtDate(defaultDate) : istDMY();
      setDate(d);
      load(d);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async () => {
    const res = result.trim();
    if (!res || !gid || !date) { toast('Please Check Values !', 'error'); return; }
    setBusy(true);
    const r = await api.post('/api/game/save-result', { result: res, gameID: gid, date: toISO(date) });
    setBusy(false);
    if (r?.success) { toast('Data Saved Sucessfully!'); onClose(); }
    else toast(r?.message || 'Error', 'error');
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Result"
      subtitle={gameName}
      footer={<View style={{ flexDirection: 'row', gap: 10 }}><Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} /><Button title="Submit" icon="checkmark" loading={busy} onPress={submit} style={{ flex: 1.4 }} /></View>}
    >
      <DateField label="Date" value={date} onChange={(d) => { setDate(d); load(d); }} />
      <Field
        label="Result"
        value={result}
        onChangeText={(t) => setResult(t.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        maxLength={2}
        placeholder="Enter Result"
        inputStyle={{ fontSize: 28, fontWeight: '800', letterSpacing: 4, textAlign: 'center' }}
        style={{ height: 64 }}
        onSubmitEditing={submit}
        selectTextOnFocus
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  gamesRow: { paddingVertical: space.md },
  toolCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.md, marginBottom: space.md, ...shadow },
  toolRow: { flexDirection: 'row', gap: 8 },
  tool: { flex: 1, height: 44, borderRadius: radius.md, backgroundColor: colors.cardAlt, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  toolText: { fontWeight: weight.bold, color: colors.text, fontSize: font.sm },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: radius.md, height: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, marginBottom: space.md },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text, paddingVertical: 0 },
  card: { flexDirection: 'row', alignItems: 'center', marginHorizontal: space.lg, marginBottom: 10, backgroundColor: colors.card, borderRadius: radius.lg, padding: 12, ...shadow },
  cName: { fontSize: font.md, fontWeight: weight.heavy, color: colors.text },
  cMob: { fontSize: font.sm, color: colors.textSoft, marginTop: 2, fontWeight: weight.semi },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  rateTag: { fontSize: font.xs, fontWeight: weight.bold, color: colors.brandText, backgroundColor: colors.brandSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  lt: { flex: 1, fontSize: font.xs, color: colors.muted },
  rate: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  rateVal: { fontSize: font.lg, fontWeight: weight.heavy, color: colors.text },
});
