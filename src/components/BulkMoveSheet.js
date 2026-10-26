import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/client';
import { Sheet, DateField, SelectField } from '../ui/Sheet';
import { Button, Row } from '../ui/kit';
import { toISO } from '../lib/dates';
import { colors, font, radius, space, weight } from '../theme';

// Bulk Move / Copy (chat.html openBulkModal / doBulkMove / doBulkCopy).
export default function BulkMoveSheet({ visible, onClose, P, currentDate, customerTitle, onDone }) {
  const [date, setDate] = useState(currentDate);
  const [games, setGames] = useState([]);
  const [game, setGame] = useState('');
  const [customers, setCustomers] = useState([]);
  const [cust, setCust] = useState('');
  const [rates, setRates] = useState([]);
  const [rateID, setRateID] = useState('');
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const rateSeq = useRef(0);

  const loadRates = async (custVal) => {
    setRates([]); setRateID('');
    if (!custVal) return;
    const cid = custVal.split('|')[0];
    if (!cid) return;
    const id = ++rateSeq.current;
    const r = await api.get(`/api/customer/${cid}/rates`);
    if (id !== rateSeq.current) return;
    const seen = new Set();
    const list = [];
    (r?.data || []).forEach((rt) => {
      const pati = rt.Patti || rt.Pati_PComm || 0;
      const text = `${rt.D_PComm || 0}/${rt.D_Amt || 100}-${rt.A_PComm || 0}/${rt.A_Amt || 10}-${pati}`;
      const key = rt.RateID || text;
      if (seen.has(key)) return;
      seen.add(key);
      list.push({
        value: String(rt.RateID || rt.rateID || ''),
        label: rt.Rate || text,
        D_PComm: rt.D_PComm || 0, D_Amt: rt.D_Amt || 100, A_PComm: rt.A_PComm || 0, A_Amt: rt.A_Amt || 10, Pati: pati,
        targetUID: Array.isArray(rt.fUserUID) ? '' : rt.fUserUID || rt.UID || '', mobile: rt.MobileNo || '',
        hissaID: rt.ThirdPartyHissaID ?? '0', hissaPer: rt.ThirdPartyHissaPer ?? '0',
        tpCommID: rt.ThirdPartyCommID ?? '0', tpDara: rt.ThirdPartyDaraComm ?? '0', tpAkhar: rt.ThirdPartyAkharComm ?? '0',
        text,
      });
    });
    setRates(list);
    // bulkPreSelectRate(): match the chat's current rate.
    const pre = list.find((o) => o.text === P.rates || o.label.trim() === P.rates)
      || list.find((o) => String(o.D_Amt) === P.dAmt && String(o.A_Amt) === P.aAmt && String(o.D_PComm) === P.dPComm && String(o.A_PComm) === P.aPComm);
    if (pre && pre.value) setRateID(pre.value);
  };

  useEffect(() => {
    if (!visible) return;
    setMsg(null); setBusy(null);
    setDate(currentDate);
    (async () => {
      const [g, c] = await Promise.all([api.get('/api/home/games'), api.get('/api/customer/list')]);
      const gl = g?.data || [];
      setGames(gl);
      setGame(gl.some((x) => String(x.GID) === String(P.gameId)) ? String(P.gameId) : '');
      const cl = c?.data || [];
      setCustomers(cl);
      const me = cl.find((x) => String(x.UID || '') === String(P.selUID) || (x.Mobile || '') === P.mobile);
      const val = me ? `${me.CID || ''}|${me.Mobile || ''}|${me.UID || ''}` : '';
      setCust(val);
      loadRates(val);
    })();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const custOptions = useMemo(() => customers.map((c) => ({
    value: `${c.CID || ''}|${c.Mobile || ''}|${c.UID || ''}`, label: c.CustomerName || c.Mobile, sub: c.Mobile,
  })), [customers]);
  const gameOptions = useMemo(() => games.map((g) => ({ value: String(g.GID), label: g.GameName, sub: g.DrawTime })), [games]);
  const rate = rates.find((o) => o.value === rateID && o.value);

  const validate = () => {
    if (!game) return setMsg({ t: 'Please select Game' }), null;
    if (!cust) return setMsg({ t: 'Please select Customer' }), null;
    if (!date) return setMsg({ t: 'Please enter Date' }), null;
    if (!rate) return setMsg({ t: 'Please select Rate' }), null;
    return true;
  };

  const srcRate = { src_D_PComm: P.dPComm, src_D_Amt: P.dAmt, src_A_PComm: P.aPComm, src_A_Amt: P.aAmt, src_Pati_PComm: P.pati };
  const destRate = () => ({
    D_PComm: rate.D_PComm, D_Amt: rate.D_Amt, A_PComm: rate.A_PComm, A_Amt: rate.A_Amt, Pati_PComm: rate.Pati,
    fHissaPartyID: rate.hissaID || 0, hissaPerc: rate.hissaPer || 0,
    ThirdPartyCommID: rate.tpCommID || 0, ThirdPartyDaraComm: rate.tpDara || 0, ThirdPartyAkharComm: rate.tpAkhar || 0,
  });

  const finish = (r, okText, failText) => {
    setBusy(null);
    if (r?.success) {
      setMsg({ t: r.message || okText, ok: true });
      setTimeout(() => { onClose(); onDone && onDone(); }, 1200);
    } else setMsg({ t: r?.message || failText });
  };

  const doMove = async () => {
    if (!validate()) return;
    const parts = cust.split('|');
    const targetUID = parts[2] || rate.targetUID || '';
    const mobile = parts[1] || rate.mobile || '';
    if (!mobile && !targetUID) return setMsg({ t: 'Target customer select karo' });
    setBusy('move'); setMsg({ t: 'Moving…', ok: true });
    const r = await api.post('/api/chat/move-message', {
      gameID: P.gameId, selectedUID: P.selUID, targetUID, mobile,
      msgDate: currentDate, currentMsgDate: toISO(date), currentGameID: game,
      ...srcRate, ...destRate(),
    });
    finish(r, 'Moved!', 'Messages Not Move');
  };

  const doCopy = async () => {
    if (!validate()) return;
    const parts = cust.split('|');
    let targetUID = parts[2] || rate.targetUID || '';
    const mobile = parts[1] || rate.mobile || '';
    if (!targetUID || targetUID === '0') {
      if (mobile) {
        const ur = await api.get(`/api/home/user-by-mobile/${mobile}`);
        const found = ur?.data?.UID || ur?.data?.[0]?.UID;
        if (found) targetUID = String(found);
      }
    }
    if ((!targetUID || targetUID === '0') && mobile === P.mobile && P.selUID) targetUID = String(P.selUID);
    if (!mobile && !targetUID) return setMsg({ t: 'Target customer select karo' });
    setBusy('copy'); setMsg({ t: 'Copying…', ok: true });
    const r = await api.post('/api/chat/copy-message', {
      selectedUID: P.selUID, gameID: P.gameId, msgDate: currentDate,
      currentGameID: game, currentMsgDate: toISO(date), targetUID, mobile,
      ...srcRate, ...destRate(),
    });
    finish(r, 'Copied!', 'Messages Not Copy');
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Move / Copy messages"
      subtitle="Share this chat's entries to another date, game or customer"
      footer={(
        <Row gap={10}>
          <Button title="Move" icon="git-compare-outline" variant="secondary" loading={busy === 'move'} onPress={doMove} style={{ flex: 1 }} />
          <Button title="Copy" icon="copy-outline" loading={busy === 'copy'} onPress={doCopy} style={{ flex: 1 }} />
        </Row>
      )}
    >
      <View style={styles.from}>
        <Text style={styles.fromLabel}>FROM (current)</Text>
        <Text style={styles.fromText}>Game: {P.gameName}  ·  Date: {currentDate}</Text>
        <Text style={styles.fromText}>Customer: {customerTitle}  ·  Rate: {P.rates}</Text>
      </View>
      <DateField label="Target date (TO)" value={date} onChange={setDate} />
      <SelectField label="Target game (TO)" value={game} options={gameOptions} onChange={setGame} placeholder="-- Select Game --" />
      <SelectField label="Target customer (TO)" value={cust} options={custOptions} searchable avatars onChange={(v) => { setCust(v); loadRates(v); }} placeholder="-- Select Customer --" />
      <SelectField label="Target rate (TO)" value={rateID} options={rates} onChange={setRateID} placeholder={cust ? '-- Select Rate --' : 'Select a customer first'} disabled={!cust} />
      {msg ? (
        <View style={[styles.msg, { backgroundColor: msg.ok ? colors.successSoft : colors.dangerSoft }]}>
          <Ionicons name={msg.ok ? 'information-circle' : 'alert-circle'} size={18} color={msg.ok ? colors.success : colors.danger} />
          <Text style={{ flex: 1, color: msg.ok ? colors.success : colors.danger, fontWeight: weight.semi }}>{msg.t}</Text>
        </View>
      ) : null}
      <Text style={styles.help}>Move = entries leave this date and go to the target. Copy = entries go to the target and also stay here.</Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  from: { backgroundColor: colors.brandSoft, borderRadius: radius.md, padding: 12, marginBottom: space.md },
  fromLabel: { fontSize: font.xs, fontWeight: weight.heavy, color: colors.brandText, marginBottom: 4 },
  fromText: { fontSize: font.sm, color: colors.textSoft, fontWeight: weight.semi },
  msg: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.md, marginBottom: space.sm },
  help: { fontSize: font.xs, color: colors.muted, lineHeight: 17 },
});
