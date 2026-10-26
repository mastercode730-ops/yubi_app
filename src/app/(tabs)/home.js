import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { usePolling } from '../../lib/hooks';
import { openEntry } from '../../lib/nav';
import { Avatar, CountBadge, EmptyState, Loading, tap } from '../../ui/kit';
import { Sheet } from '../../ui/Sheet';
import { colors, font, gradients, radius, shadow, space, weight } from '../../theme';

const DEFAULT_RATE = { Rate: '0/100-0/10-0', D_PComm: '0', D_Amt: '100', A_PComm: '0', A_Amt: '10', Patti: '0', ThirdPartyHissaID: '0', ThirdPartyHissaPer: '0' };

export default function Home() {
  const insets = useSafeAreaInsets();
  const { displayName, roleLabel, can } = useAuth();
  const [games, setGames] = useState(null);
  const [contacts, setContacts] = useState(null);
  const [label, setLabel] = useState('Contacts');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [picker, setPicker] = useState(null); // { contact, step: 'games'|'rates', games, rates, game, realUID }
  const searchTimer = useRef(null);
  const reqSeq = useRef(0);

  const loadGames = useCallback(async () => {
    const r = await api.get('/api/home/games');
    if (r?.success) setGames(r.data || []);
    else if (!r?.network) setGames((g) => g || []);
  }, []);

  const loadContacts = useCallback(async (filter = '') => {
    const id = ++reqSeq.current;
    const r = filter
      ? await api.get('/api/home/receivers', { filter })
      : await api.get('/api/home/messages', { filter: '' });
    if (id !== reqSeq.current) return;
    setLabel(filter ? 'Search results' : 'Contacts');
    setContacts(r?.success ? r.data || [] : []);
  }, []);

  useEffect(() => { loadContacts(''); }, [loadContacts]);
  usePolling(loadGames, 5000);
  // Fires on first focus too, so this also does the initial games load.
  useFocusEffect(useCallback(() => { loadGames(); }, [loadGames]));

  const onSearch = (t) => {
    setSearch(t);
    clearTimeout(searchTimer.current);
    const v = t.trim();
    if (!v) { loadContacts(''); return; }
    searchTimer.current = setTimeout(() => loadContacts(v), 350);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadGames(), loadContacts(search.trim())]);
    setRefreshing(false);
  };

  // pickContact → games for that contact.
  const pickContact = async (c) => {
    const name = c.CustomerName || c.Mobile || 'Unknown';
    const contact = { uid: String(c.fUID || c.UID || ''), cid: String(c.CID || '0'), name, mob: c.Mobile || c.MobileNo || '' };
    setPicker({ contact, step: 'games', games: null });
    const r = await api.get(`/api/home/user-games/${contact.uid}`);
    setPicker((p) => (p && p.contact === contact ? { ...p, games: r?.success ? r.data || [] : [] } : p));
  };

  // pickGame → rates; open directly when 0 or 1 rate.
  const pickGame = async (g) => {
    const { contact } = picker;
    setPicker((p) => ({ ...p, loadingGame: g.GID }));
    const [r, u] = await Promise.all([
      api.get(`/api/home/customer-rates/${contact.cid}`),
      api.get(`/api/home/user-by-mobile/${contact.mob}`),
    ]);
    setPicker((p) => (p ? { ...p, loadingGame: null } : p));
    if (!r?.success) return;
    const realUID = (u?.success && Array.isArray(u.data) && u.data.length > 0) ? u.data[0].UID : contact.uid;
    const rates = r.data || [];
    const go = (d) => {
      setPicker(null);
      openEntry({
        mobile: contact.mob, gameId: g.GID, gameName: g.GameName, selUID: realUID,
        rates: d.Rate, dPComm: d.D_PComm, dAmt: d.D_Amt, aPComm: d.A_PComm, aAmt: d.A_Amt, pati: d.Patti,
        hissaID: d.ThirdPartyHissaID, hissaPer: d.ThirdPartyHissaPer, selPage: '2',
      });
    };
    if (rates.length === 0 || contact.cid === '0') go(DEFAULT_RATE);
    else if (rates.length === 1) go(rates[0]);
    else setPicker((p) => ({ ...p, step: 'rates', rates, game: g, go }));
  };

  const totalUnread = useMemo(() => (games || []).reduce((s, g) => s + (parseInt(g.UnReadTotal, 10) || 0), 0), [games]);

  const header = (
    <View>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Welcome back</Text>
            <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.role}>{roleLabel}</Text>
          </View>
          {can('FindChat') ? (
            <Pressable style={styles.heroBtn} onPress={() => { tap(); router.push('/find-chat'); }}>
              <Ionicons name="search" size={20} color="#fff" />
            </Pressable>
          ) : null}
          <Pressable style={styles.heroBtn} onPress={() => { tap(); router.push('/inbox'); }}>
            <Ionicons name="notifications-outline" size={20} color="#fff" />
            {totalUnread ? <View style={styles.heroDot}><Text style={styles.heroDotText}>{totalUnread > 99 ? '99+' : totalUnread}</Text></View> : null}
          </Pressable>
        </View>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.faint} />
          <TextInput
            value={search}
            onChangeText={onSearch}
            placeholder="Search name / mobile…"
            placeholderTextColor={colors.faint}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => { clearTimeout(searchTimer.current); loadContacts(search.trim()); }}
            autoCorrect={false}
          />
          {search ? <Pressable hitSlop={8} onPress={() => onSearch('')}><Ionicons name="close-circle" size={18} color={colors.faint} /></Pressable> : null}
        </View>
      </LinearGradient>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>My Games</Text>
        <Pressable onPress={() => router.push('/inbox')} hitSlop={8}><Text style={styles.sectionLink}>Open inbox</Text></Pressable>
      </View>
      {games === null ? <Loading inline text="" /> : games.length === 0 ? (
        <Text style={styles.noGames}>No games</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg, gap: 10, paddingBottom: 4 }}>
          {games.map((g) => {
            const ur = parseInt(g.UnReadTotal, 10) || 0;
            return (
              <Pressable
                key={g.GID}
                onPress={() => { tap(); router.push({ pathname: '/inbox', params: { GID: String(g.GID), Game: g.GameName } }); }}
                style={({ pressed }) => [styles.game, ur > 0 && styles.gameHot, pressed && { opacity: 0.85 }]}
              >
                <View style={[styles.gameIcon, ur > 0 && { backgroundColor: colors.danger }]}>
                  <Ionicons name="dice-outline" size={16} color="#fff" />
                </View>
                <Text style={styles.gameName} numberOfLines={1}>{g.GameName}</Text>
                <Text style={styles.gameTime}>{g.DrawTime || '—'}</Text>
                {ur > 0 ? <CountBadge count={ur} style={styles.gameBadge} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{label}{contacts ? ` (${contacts.length})` : ''}</Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <FlatList
        data={contacts || []}
        keyExtractor={(c, i) => `${c.CID || c.Mobile || i}-${i}`}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} />}
        ListEmptyComponent={contacts === null ? <Loading inline /> : (
          <EmptyState icon="people-outline" title={search ? 'No customer found' : 'No contacts found'} message={search ? 'Try another name or mobile number.' : 'Add customers from Menu → Add Contact.'} />
        )}
        contentContainerStyle={{ paddingBottom: space.xxl }}
        renderItem={({ item: c }) => {
          const name = c.CustomerName || c.Mobile || 'Unknown';
          const ur = parseInt(c.UnReadTotal, 10) || 0;
          return (
            <Pressable onPress={() => { tap(); pickContact(c); }} style={({ pressed }) => [styles.contact, pressed && { backgroundColor: colors.cardAlt }]}>
              <Avatar name={name} size={46} />
              <View style={{ flex: 1, marginLeft: space.md }}>
                <Text style={styles.cName} numberOfLines={1}>{name}</Text>
                <Text style={styles.cMob} numberOfLines={1}>{c.Mobile || c.MobileNo || ''}{c.Rate ? `  ·  ${c.Rate}` : ''}</Text>
              </View>
              {ur > 0 ? <CountBadge count={ur} /> : <Ionicons name="chevron-forward" size={18} color={colors.faint} />}
            </Pressable>
          );
        }}
      />

      <Sheet
        visible={!!picker}
        onClose={() => setPicker(null)}
        title={picker?.step === 'rates' ? 'Select Rate' : picker?.contact?.name}
        subtitle={picker?.step === 'rates' ? `${picker.contact.name} — ${picker.contact.mob} · Game: ${picker.game?.GameName}` : `${picker?.contact?.mob || ''} · choose a game`}
      >
        {picker?.step === 'games' ? (
          picker.games === null ? <Loading inline /> : picker.games.length === 0 ? (
            <EmptyState icon="game-controller-outline" title="No games found" />
          ) : (
            <View style={styles.gameGrid}>
              {picker.games.map((g) => (
                <Pressable key={g.GID} onPress={() => { tap(); pickGame(g); }} style={({ pressed }) => [styles.gCard, pressed && { borderColor: colors.brand }]}>
                  {picker.loadingGame === g.GID
                    ? <Ionicons name="hourglass-outline" size={20} color={colors.brand} />
                    : <Ionicons name="dice" size={20} color={colors.brand} />}
                  <Text style={styles.gCardName} numberOfLines={1}>{g.GameName}</Text>
                  <Text style={styles.gCardTime}>{g.DrawTime || ''}</Text>
                </Pressable>
              ))}
            </View>
          )
        ) : null}
        {picker?.step === 'rates' ? (
          <View>
            {picker.rates.map((d, i) => (
              <Pressable key={d.RateID || i} onPress={() => { tap(); picker.go(d); }} style={({ pressed }) => [styles.rate, pressed && { backgroundColor: colors.brandSoft }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rateVal}>{d.Rate}</Text>
                  <Text style={styles.rateSub}>D: {d.D_PComm}/{d.D_Amt}  ·  A: {d.A_PComm}/{d.A_Amt}  ·  Patti: {d.Patti}</Text>
                </View>
                <Ionicons name="arrow-forward-circle" size={24} color={colors.brand} />
              </Pressable>
            ))}
            <Pressable onPress={() => setPicker((p) => ({ ...p, step: 'games' }))} style={{ padding: 12, alignItems: 'center' }}>
              <Text style={{ color: colors.brandText, fontWeight: weight.bold }}>← Back to games</Text>
            </Pressable>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: space.lg, paddingBottom: space.lg, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: space.lg },
  hello: { color: 'rgba(255,255,255,0.75)', fontSize: font.sm, fontWeight: weight.semi },
  name: { color: '#fff', fontSize: font.xxl, fontWeight: weight.heavy, letterSpacing: -0.5 },
  role: { color: 'rgba(255,255,255,0.8)', fontSize: font.xs, fontWeight: weight.semi, marginTop: 2 },
  heroBtn: { width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  heroDot: { position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.danger, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#6A46EE' },
  heroDotText: { color: '#fff', fontSize: 10, fontWeight: weight.heavy },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: radius.md, height: 48, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text, paddingVertical: 0 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, marginTop: space.lg, marginBottom: space.sm },
  sectionTitle: { fontSize: font.md, fontWeight: weight.heavy, color: colors.text },
  sectionLink: { fontSize: font.sm, fontWeight: weight.bold, color: colors.brandText },
  noGames: { color: colors.muted, paddingHorizontal: space.lg },
  game: { width: 128, backgroundColor: colors.card, borderRadius: radius.lg, padding: 12, ...shadow, borderWidth: 1, borderColor: 'transparent' },
  gameHot: { borderColor: '#FBC9CB' },
  gameIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  gameName: { fontSize: font.base, fontWeight: weight.heavy, color: colors.text },
  gameTime: { fontSize: font.xs, color: colors.muted, marginTop: 2, fontWeight: weight.semi },
  gameBadge: { position: 'absolute', top: 10, right: 10 },
  contact: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: space.lg, backgroundColor: colors.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  cName: { fontSize: font.md, fontWeight: weight.bold, color: colors.text },
  cMob: { fontSize: font.sm, color: colors.muted, marginTop: 2 },
  gameGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gCard: { width: '31%', flexGrow: 1, minWidth: 96, paddingVertical: 16, alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardAlt, gap: 4 },
  gCardName: { fontSize: font.base, fontWeight: weight.heavy, color: colors.text, paddingHorizontal: 6 },
  gCardTime: { fontSize: font.xs, color: colors.muted },
  rate: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  rateVal: { fontSize: font.lg, fontWeight: weight.heavy, color: colors.text },
  rateSub: { fontSize: font.sm, color: colors.muted, marginTop: 2 },
});
