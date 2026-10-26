import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/client';
import Guard from '../components/Guard';
import { formatUpdateTime, istDMY, toDMY } from '../lib/dates';
import { openEntry, param } from '../lib/nav';
import { fmtNum } from '../lib/format';
import { Badge, Button, Card, EmptyState, Field, Header, Loading, Row, Screen, SectionTitle, tap } from '../ui/kit';
import { DateField } from '../ui/Sheet';
import { toast } from '../ui/Toast';
import { colors, font, radius, space, weight } from '../theme';

const allSame = (s) => s.split('').every((c) => c === s[0]);

// sale-history.html addRow(): number must be 1–100 or a repeated-digit akhar; amount > 0.
function makeRow(s1, s2) {
  const valid = (s1 !== '' && parseInt(s1, 10) <= 100 && parseInt(s1, 10) > 0) || (s1.length >= 3 && allSame(s1)) || s1 === '1000' || s1 === '10000';
  if (!valid || !(parseFloat(s2) > 0)) return null;
  return { num: s1, amt: s2 };
}

// sale-history.html saveBulkMessage() — returns { rows } or { error }.
function composerRows(num, amt) {
  const rows = [];
  const push = (a, b) => { const r = makeRow(a, b); if (r) rows.push(r); };
  let s1 = num;
  const s2 = amt;
  if (s2 !== '' && s2 !== '0' && s1 !== '0' && s1 !== '') {
    s1 = s1.replace(/[^0-9]/g, '');
    if (s1.length === 1) push('0' + s1, s2);
    else if (s1.length === 3 && allSame(s1)) push(s1 === '000' ? '1000' : s1, s2);
    else if (s1.length === 4 && allSame(s1)) push(s1 === '0000' ? '10000' : s1, s2);
    else if (s1.length % 2 === 0) {
      for (let i = 0; i < s1.length; i += 2) { const c = s1.substr(i, 2); push(c === '00' ? '100' : c, s2); }
    } else return { error: 'Invalid Values Entered' };
    return { rows };
  }
  if (s2 !== '' && s2 === '0' && s1 !== '0') {
    s1.split(/[)*\-.+,$#@\\_]/).forEach((part) => {
      const mn = part.split(/[(=]/);
      if (mn[0] && mn[1] && (mn[0].length === 3 || mn[0].length === 4) && allSame(mn[0])) push(mn[0], mn[1]);
      else if (mn[0] && mn[1]) push(mn[0].length === 1 ? '0' + mn[0] : mn[0], mn[1]);
    });
    return { rows };
  }
  return { rows };
}

function FindChatScreen() {
  const q = useLocalSearchParams();
  const [num, setNum] = useState('');
  const [amt, setAmt] = useState('');
  const [rows, setRows] = useState([]);
  const [date, setDate] = useState('');
  const [message, setMessage] = useState('');
  const [results, setResults] = useState(undefined);
  const [opening, setOpening] = useState(null);
  const amtRef = useRef(null);
  const numRef = useRef(null);

  const search = async (d = date, m = message) => {
    const filter = (m || '').trim();
    if (!filter) { setResults([]); toast('Enter a message to search', 'info'); return; }
    setResults(null);
    const r = await api.get('/api/hisab/sale-history', { date: d, filter });
    setResults(r?.data || []);
  };

  useEffect(() => {
    (async () => {
      let d = param(q.Date) ? toDMY(param(q.Date)) : '';
      if (!d) {
        const lr = await api.get('/api/hisab/latest-date');
        const v = lr?.dmy || lr?.data || lr?.date;
        if (lr?.success && v) d = toDMY(v);
      }
      if (!d) d = istDMY();
      setDate(d);
      const m = param(q.Msg);
      if (m) { setMessage(m); search(d, m); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const add = () => {
    if (!num) return;
    const a = amt === '' ? '0' : amt;
    const res = composerRows(num, a);
    if (res.error) { toast(res.error, 'error'); numRef.current?.focus(); return; }
    setRows((r) => [...r, ...res.rows]);
    setNum(''); setAmt('');
    numRef.current?.focus();
  };

  const copyToSearch = () => {
    const final = rows.map((r) => `${r.num}=${r.amt}`).join(',');
    setMessage(final);
  };

  const open = async (d, i) => {
    setOpening(i);
    const mob = d.Mobile || d.MobileNo || '';
    const u = mob ? await api.get(`/api/home/user-by-mobile/${mob}`) : null;
    setOpening(null);
    const realUID = u?.data?.[0]?.UID || d.fSenderID || d.fUID || '';
    openEntry({
      mobile: mob, gameId: d.fGameID || d.GID || '', gameName: d.GameName || '', selUID: realUID,
      rates: d.Rate || d.Rates || '0/100-0/10-0', dPComm: d.D_PComm || '0', dAmt: d.D_Amt || '100',
      aPComm: d.A_PComm || '0', aAmt: d.A_Amt || '10', pati: d.Pati_PComm || d.Patti || '0',
      hissaID: d.ThirdPartyHissaID || '0', hissaPer: d.HissaPerc || d.ThirdPartyHissaPer || '0',
      tpCommID: d.ThirdPartyCommID || '0', tpDara: d.ThirdPartyDaraComm || '0', tpAkhar: d.ThirdPartyAkharComm || '0',
      lastDate: d.MsgDate || '', selPage: '3',
    });
  };

  const total = (results || []).reduce((s, d) => s + (parseFloat(d.TotalAmount) || 0), 0);
  const composerTotal = rows.reduce((s, r) => s + (parseFloat(r.amt) || 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Find Chat" subtitle="Search entries by number & amount" />
      <Screen scroll>
        <Card>
          <SectionTitle title="Build a search message" hint="Number + amount, then Copy into the search box" style={{ marginTop: 0 }} />
          <Row gap={8} align="flex-end">
            <Field compact ref={numRef} label="Number" value={num} onChangeText={(t) => setNum(t.replace(/[a-zA-Z]/g, ''))} keyboardType="numbers-and-punctuation" containerStyle={{ flex: 1.3 }} returnKeyType="next" onSubmitEditing={() => amtRef.current?.focus()} blurOnSubmit={false} />
            <Field compact ref={amtRef} label="Amount" value={amt} onChangeText={(t) => setAmt(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" containerStyle={{ flex: 1 }} returnKeyType="done" onSubmitEditing={add} blurOnSubmit={false} />
            <Pressable onPress={() => { tap(); add(); }} style={styles.addBtn}><Ionicons name="add" size={22} color={colors.brand} /></Pressable>
          </Row>
          {rows.length ? (
            <View style={styles.tray}>
              {rows.map((r, i) => (
                <Pressable key={i} onPress={() => setRows((x) => x.filter((_, j) => j !== i))} style={styles.chip}>
                  <Text style={styles.chipNum}>{r.num}</Text><Text style={styles.chipAmt}>{r.amt}</Text>
                  <Ionicons name="close" size={12} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          ) : null}
          {rows.length ? <Text style={styles.total}>Total Amount: {composerTotal.toFixed(0)}</Text> : null}
          <Button title="Copy to search" icon="arrow-down" variant="secondary" size="sm" onPress={copyToSearch} disabled={!rows.length} style={{ marginTop: space.sm, alignSelf: 'flex-start' }} />
        </Card>

        <Card>
          <DateField label="Date" value={date} onChange={setDate} />
          <Field label="Message" icon="chatbox-ellipses-outline" value={message} onChangeText={setMessage} placeholder="e.g. 12=100,34=50" autoCapitalize="none" onSubmitEditing={() => search()} returnKeyType="search" />
          <Button title="Search" icon="search" onPress={() => search()} />
        </Card>

        {results === undefined ? null : results === null ? <Loading inline /> : results.length === 0 ? (
          <EmptyState icon="search-outline" title="No Data Found!" message="No entries match this message on the selected date." />
        ) : (
          <>
            <Row justify="space-between" style={{ marginBottom: space.sm }}>
              <Text style={styles.count}>{results.length} result{results.length === 1 ? '' : 's'}</Text>
              <Text style={styles.sum}>Total ₹ {fmtNum(total, 0)}</Text>
            </Row>
            {results.map((d, i) => (
              <Card key={i} onPress={() => open(d, i)} padded={false} style={{ padding: space.md }}>
                <Row>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cust} numberOfLines={1}>{d.CMobile || d.CustomerName || d.Mobile || ''}</Text>
                    <Text style={styles.meta}>{d.GameName || ''}{d.Rate ? `  ·  ${d.Rate}` : ''}</Text>
                  </View>
                  <Text style={styles.amt}>₹ {d.TotalAmount || 0}</Text>
                  {opening === i ? <Loading inline text="" style={{ paddingVertical: 0, marginLeft: 8 }} /> : <Ionicons name="chevron-forward" size={18} color={colors.faint} style={{ marginLeft: 6 }} />}
                </Row>
                <Text style={styles.msg} numberOfLines={4}>{d.Message || ''}</Text>
                <Row gap={6} style={{ marginTop: 8 }}>
                  {d.subuserID ? <Badge text={`Staff ${d.subuserID}`} tone="brand" icon="person" /> : null}
                  <Text style={styles.time}>{formatUpdateTime(d.MessageDateTime)}</Text>
                </Row>
              </Card>
            ))}
          </>
        )}
      </Screen>
    </View>
  );
}

export default function FindChat() {
  return <Guard menuKey="sale-history" title="Find Chat"><FindChatScreen /></Guard>;
}

const styles = StyleSheet.create({
  addBtn: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  tray: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.md },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, height: 28, borderRadius: 9, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  chipNum: { fontWeight: weight.heavy, color: colors.text, fontSize: font.sm },
  chipAmt: { fontWeight: weight.bold, color: colors.brandText, fontSize: font.sm },
  total: { marginTop: 8, fontWeight: weight.heavy, color: colors.text },
  count: { color: colors.muted, fontWeight: weight.semi },
  sum: { fontWeight: weight.heavy, color: colors.text, fontSize: font.md },
  cust: { fontSize: font.md, fontWeight: weight.heavy, color: colors.brandText },
  meta: { fontSize: font.sm, color: colors.muted, marginTop: 2 },
  amt: { fontSize: font.md, fontWeight: weight.heavy, color: colors.text },
  msg: { fontSize: font.base, color: colors.text, marginTop: 8, backgroundColor: colors.cardAlt, padding: 10, borderRadius: radius.sm, lineHeight: 20 },
  time: { fontSize: font.xs, color: colors.muted },
});
