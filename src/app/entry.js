import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  ERR_CHECK, MODES, buildRows, formatNumberInput, highlightSegments, messagesGrandTotal,
  numMaxLength, pasteIntoNumber, rowsFromMessage, rowsToMessage, rowsTotal,
} from '../lib/entryEngine';
import { chatFmtDate, istDMY, parseMsgDateTime, toMonDate } from '../lib/dates';
import { usePolling } from '../lib/hooks';
import { param } from '../lib/nav';
import { isTrue } from '../lib/format';
import { Badge, Button, Chip, Loading, tap } from '../ui/kit';
import { CalendarSheet, Sheet } from '../ui/Sheet';
import { toast } from '../ui/Toast';
import YantriGridSheet from '../components/YantriGridSheet';
import BulkMoveSheet from '../components/BulkMoveSheet';
import { colors, font, radius, shadow, space, weight } from '../theme';

const NUM_KB = Platform.select({ ios: 'numbers-and-punctuation', default: 'phone-pad' });

export default function Entry() {
  const insets = useSafeAreaInsets();
  const q = useLocalSearchParams();
  const { can } = useAuth();
  const P = useMemo(() => ({
    mobile: param(q.SelectedMobile), gameId: param(q.GameId), gameName: param(q.GameName),
    selUID: param(q.SelectedUID), rates: param(q.Rates, '0/100-0/10-0'),
    dPComm: param(q.D_PComm, '0'), dAmt: param(q.D_Amt, '100'), aPComm: param(q.A_PComm, '0'), aAmt: param(q.A_Amt, '10'),
    pati: param(q.Pati_PComm, '0'), hissaID: param(q.ThirdPartyHissaID, '0'), hissaPer: param(q.ThirdPartyHissaPer, '0'),
    tpCommID: param(q.ThirdPartyCommID, '0'), tpDara: param(q.ThirdPartyDaraComm, '0'), tpAkhar: param(q.ThirdPartyAkharComm, '0'),
    selPage: param(q.SelectedPage, '1'), lastDate: param(q.LastMsgDate),
  }), [q]);

  const [custTitle, setCustTitle] = useState(P.mobile);
  const [isUttar, setIsUttar] = useState(false);
  const [refreshOn, setRefreshOn] = useState(false);
  const [date, setDate] = useState('');
  const [messages, setMessages] = useState(null);
  const [betQuery, setBetQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const [mode, setMode] = useState('typing');
  const [num, setNum] = useState('');
  const [to, setTo] = useState('');
  const [amt, setAmt] = useState('');
  const [palat, setPalat] = useState('');
  const [text, setText] = useState('');
  const [add3, setAdd3] = useState(false);
  const [withoutJode, setWithoutJode] = useState(false);
  const [rows, setRows] = useState([]);
  const [editId, setEditId] = useState('');
  const [sending, setSending] = useState(false);

  const [calOpen, setCalOpen] = useState(false);
  const [ymOpen, setYmOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);

  const listRef = useRef(null);
  const numRef = useRef(null);
  const toRef = useRef(null);
  const amtRef = useRef(null);
  const palatRef = useRef(null);
  const textRef = useRef(null);
  const loadSeq = useRef(0);
  const dateRef = useRef('');

  const fromInbox = P.selPage === '1';
  const modeDef = MODES.find((m) => m.key === mode) || MODES[0];

  /* ───────── data ───────── */

  const getTime = useCallback(async (d = dateRef.current) => {
    if (!d) return;
    const id = ++loadSeq.current;
    const r = await api.get('/api/chat/received', { gameId: P.gameId, date: d, selectedUID: P.selUID, rates: P.rates });
    if (id !== loadSeq.current) return;
    setMessages(r?.success ? r.data || [] : []);
  }, [P.gameId, P.selUID, P.rates]);

  useEffect(() => {
    (async () => {
      // loadCustomerName()
      const rn = await api.get('/api/chat/customer-name', { mobile: P.mobile });
      const last5 = P.mobile.length > 5 ? P.mobile.substring(P.mobile.length - 5) : P.mobile;
      if (rn?.success && rn.data?.CustomerName) {
        setCustTitle(`${rn.data.CustomerName} (${last5})`);
        setIsUttar(rn.data.IsUttar === 'True' || rn.data.IsUttar === true);
      }
      api.get('/api/chat/refresh-status').then((r) => setRefreshOn(r?.IsRefreshStatus === 'True'));
      // initDate(): game date → earliest unread date → LastMsgDate (non-DS games)
      let today = istDMY();
      const r1 = await api.get('/api/chat/date', { gameId: P.gameId });
      if (r1?.date) today = chatFmtDate(r1.date);
      let cur = today;
      const r2 = await api.get('/api/chat/unread-date', { gameId: P.gameId, selectedUID: P.selUID });
      if (r2?.date) {
        const ud = chatFmtDate(r2.date);
        if (ud && ud !== today) cur = ud;
      }
      if (P.lastDate && P.gameName !== 'DS') cur = chatFmtDate(P.lastDate);
      dateRef.current = cur;
      setDate(cur);
      getTime(cur);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // startRefresh(): every 2s while refresh is on and nothing is pending.
  usePolling(() => { if (!ymOpen && !bulkOpen) getTime(); }, 2000, refreshOn && rows.length === 0);

  const changeDate = (d) => {
    if (!d || d === dateRef.current) return;
    dateRef.current = d;
    setDate(d);
    setRows([]);
    setMessages(null);
    getTime(d);
  };

  const grandTotal = useMemo(() => Math.round(messagesGrandTotal(messages)), [messages]);
  const pendingTotal = useMemo(() => rowsTotal(rows), [rows]);

  const matchCount = useMemo(() => {
    if (!betQuery.trim() || !messages) return 0;
    return messages.filter((m) => !(m.IsAccepted === 'Rejected' || m.IsAccepted === 'Cancelled') && String(m.IsTextChat) !== 'False' && highlightSegments(m.Message, betQuery).hasMatch).length;
  }, [betQuery, messages]);

  useEffect(() => {
    if (!messages || !messages.length) return;
    if (betQuery.trim()) {
      const idx = messages.findIndex((m) => highlightSegments(m.Message, betQuery).hasMatch);
      if (idx >= 0) setTimeout(() => listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 }), 120);
    } else {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 80);
    }
  }, [messages, betQuery]);

  /* ───────── modes & inputs ───────── */

  const focusFirst = useCallback((m = mode) => {
    const def = MODES.find((x) => x.key === m);
    setTimeout(() => {
      if (!def) return;
      if (def.fields.includes('text')) textRef.current?.focus();
      else if (def.fields.includes('num')) numRef.current?.focus();
      else if (def.fields.includes('amt')) amtRef.current?.focus();
    }, 60);
  }, [mode]);

  const selectMode = (k) => {
    if (k === 'yantri') { setRows([]); setYmOpen(true); return; }
    setMode(k);
    setNum(''); setAmt(''); setTo(''); setPalat('');
    if (k === 'pahada' || k === 'cross' || k === 'jode') { setAdd3(false); setWithoutJode(false); }
    focusFirst(k);
  };

  // CleartxtNumbersamt(): clear inputs; stay on Pahada (keeping ADD 3), else back to Typing.
  const clearInputs = (stayPahada) => {
    setNum(''); setTo(''); setAmt(''); setPalat(''); setText('');
    if (stayPahada) { setMode('pahada'); focusFirst('pahada'); }
    else { setMode('typing'); setAdd3(false); setWithoutJode(false); focusFirst('typing'); }
  };

  const addRows = () => {
    const res = buildRows({ mode, num, to, amt, palat, add3, withoutJode, isUttar });
    if (res.skipped) return;
    if (res.error) { toast(res.error, 'error'); return; }
    if (res.rows.length) setRows((r) => [...r, ...res.rows]);
    clearInputs(mode === 'pahada');
  };

  const onNumSubmit = () => {
    if (!num) return;
    if (modeDef.fields.includes('to')) toRef.current?.focus();
    else amtRef.current?.focus();
  };

  const onAmtSubmit = () => {
    if (!amt) return;
    if (modeDef.fields.includes('palat')) palatRef.current?.focus();
    else addRows();
  };

  const pasteFromClipboard = async () => {
    const t = await Clipboard.getStringAsync();
    if (!t) { toast('Clipboard is empty', 'info'); return; }
    setNum((n) => pasteIntoNumber(n, t));
    setTimeout(() => amtRef.current?.focus(), 60);
  };

  const removeRow = (i) => setRows((r) => r.filter((_, idx) => idx !== i));

  const clearAll = () => {
    setRows([]); setEditId(''); setNum(''); setTo(''); setAmt(''); setPalat(''); setText('');
    setMode('typing'); setAdd3(false); setWithoutJode(false);
    focusFirst('typing');
  };

  /* ───────── save ───────── */

  const basePayload = () => ({
    gameId: P.gameId, fUserID: P.selUID, date: dateRef.current,
    D_PComm: P.dPComm, D_Amt: P.dAmt, A_PComm: P.aPComm, A_Amt: P.aAmt, Pati_PComm: P.pati,
    fHissaPartyID: P.hissaID, HissaPerc: P.hissaPer,
    ThirdPartyCommID: P.tpCommID, ThirdPartyDaraComm: P.tpDara, ThirdPartyAkharComm: P.tpAkhar,
  });

  const afterSaved = async (message) => {
    if (message) Clipboard.setStringAsync(message).catch(() => {});
    setRows([]); setEditId('');
    clearInputs(false);
    await getTime();
    setTimeout(() => getTime(), 500);
  };

  // sendmessage(): pending rows → one entry (insert, or update when editing).
  const sendRows = async (chatId) => {
    const message = rowsToMessage(rows);
    const total = rowsTotal(rows);
    if (!message || total === 0) { toast(ERR_CHECK, 'error'); return; }
    setSending(true);
    const r = await api.post('/api/chat/save-receiver-message', {
      ...basePayload(), message, totalAmount: total, isYantriStyle: 'True', checkAcceptedStatus: true,
      chatId: chatId || '', btnText: chatId ? 'Update(Insert)' : 'Send(Insert)',
    });
    setSending(false);
    if (r?.success || r?.message === 'SuccessFully') { toast(chatId ? 'Entry updated' : 'Entry saved'); afterSaved(message); }
    else toast(r?.message || 'Error!', 'error');
  };

  const sendPlain = async () => {
    const msg = text.trim();
    if (!msg) { textRef.current?.focus(); return; }
    setSending(true);
    const r = await api.post('/api/chat/save-receiver-message', {
      ...basePayload(), message: msg, totalAmount: 0, isYantriStyle: 'False', checkAcceptedStatus: false, chatId: '', btnText: 'Send(Insert)',
    });
    setSending(false);
    if (r?.success || r?.message === 'SuccessFully') { setText(''); getTime(); textRef.current?.focus(); }
    else toast(r?.message || 'Error!', 'error');
  };

  const onSave = () => {
    if (mode === 'chat') { sendPlain(); return; }
    if (!rows.length) {
      // Convenience: typed values not yet added are added first (same as Enter).
      const res = buildRows({ mode, num, to, amt, palat, add3, withoutJode, isUttar });
      if (!res.skipped && !res.error && res.rows.length) { setRows(res.rows); toast(`${res.rows.length} rows added — tap Save again to send`, 'info'); clearInputs(mode === 'pahada'); return; }
      toast(ERR_CHECK, 'error');
      return;
    }
    sendRows(editId || '');
  };

  const sendYantri = async (payload, err) => {
    if (!payload) { toast(err, 'error'); return; }
    setSending(true);
    const r = await api.post('/api/chat/save-receiver-message', {
      ...basePayload(), message: payload.message, totalAmount: payload.total, isYantriStyle: 'True', checkAcceptedStatus: true, chatId: '', btnText: 'Send(Insert)',
    });
    setSending(false);
    if (r?.success || r?.message === 'SuccessFully') { setYmOpen(false); getTime(); toast('Sent!'); }
    else toast(r?.message || 'Error!', 'error');
  };

  /* ───────── message actions ───────── */

  const accept = async (m) => {
    if (m.IsAccepted === 'Rejected' || m.IsAccepted === 'Cancelled') return;
    const r = await api.post('/api/chat/accept-reject', { chatId: m.ChatID, status: 'Accepted' });
    if (r?.success) getTime(); else toast(r?.message || 'Error', 'error');
  };
  const reject = async (m) => {
    if (m.IsAccepted === 'Rejected' || m.IsAccepted === 'Cancelled') return;
    const r = await api.post('/api/chat/accept-reject', { chatId: m.ChatID, status: 'Rejected' });
    if (r?.success) getTime(); else toast(r?.message || 'Error', 'error');
  };
  const del = async (m) => {
    if (m.IsAccepted === 'Rejected' || m.IsAccepted === 'Cancelled') return;
    const r = await api.del(`/api/chat/${m.ChatID}`);
    if (r && r.success === false && r.message) toast(r.message, 'error');
    getTime();
  };
  const copy = async (m) => {
    if (!m.Message) return;
    await Clipboard.setStringAsync(m.Message);
    toast('Copied!');
  };
  // ReSendChat(): load the saved entry back into pending rows for editing.
  const edit = (m) => {
    setMode('typing');
    setRows(rowsFromMessage(m.Message, isUttar));
    setEditId(String(m.ChatID));
    setNum(''); setAmt('');
  };

  const flagsFor = (m) => {
    const isYantri = isTrue(m.IsYantriStyle);
    const isByAdmin = isTrue(m.IsSendByReceiver);
    const cancelled = m.IsAccepted === 'Rejected' || m.IsAccepted === 'Cancelled';
    return {
      isSent: String(m.Sender) === '0', isYantri, isByAdmin, cancelled,
      canEdit: cancelled || (m.IsAccepted === 'Pending' && String(m.X) === '1') || (isByAdmin && String(m.X) === '0' && m.IsAccepted !== 'Rejected'),
      canAccept: !cancelled && m.IsAccepted === 'Pending' && isYantri,
      canReject: !cancelled && m.IsAccepted !== 'Rejected' && isYantri && !isTrue(m.IsSettled),
      canDelete: String(m.Sender) === '0' && m.IsAccepted === 'Pending',
    };
  };

  /* ───────── render ───────── */

  const renderMessage = ({ item: m }) => {
    const f = flagsFor(m);
    const dt = parseMsgDateTime(m.MessageDateTime);
    const isImg = String(m.IsTextChat) === 'False' || m.IsTextChat === false;
    const hl = betQuery.trim() && !f.cancelled && !isImg ? highlightSegments(m.Message, betQuery) : null;
    let status = null;
    if (m.IsAccepted === 'Accepted') status = <Badge text="Ok" tone="success" icon="checkmark-done" />;
    else if (f.cancelled) status = <Badge text="Cancelled" tone="danger" icon="close-circle" />;
    else if (f.isSent && m.IsAccepted === 'Pending') status = <Badge text="Sent" tone="neutral" icon="checkmark" />;
    return (
      <Pressable
        onLongPress={() => { tap(); setActionMsg(m); }}
        onPress={() => { tap(); setActionMsg(m); }}
        style={[styles.msg, f.isSent ? styles.msgSent : styles.msgRecv, hl?.hasMatch && styles.msgMatch, f.cancelled && { opacity: 0.6 }]}
      >
        {isImg ? (
          <Image source={{ uri: m.Message }} style={styles.msgImg} resizeMode="contain" />
        ) : (
          <Text style={[styles.msgText, f.cancelled && styles.strike]} selectable>
            {hl ? hl.parts.map((p, i) => (
              <Text key={i} style={p.hit === 'num' ? styles.hitNum : p.hit === 'amt' ? styles.hitAmt : null}>{p.t}</Text>
            )) : m.Message}
          </Text>
        )}
        <View style={styles.msgMeta}>
          {f.isYantri && m.TotalAmount ? <Text style={styles.msgTotal}>₹ {m.TotalAmount}</Text> : null}
          {f.isYantri && m.Rate ? <Text style={styles.msgRate}>{m.Rate}</Text> : null}
          {dt ? <Text style={styles.msgTime}>{dt.fullDate}</Text> : null}
        </View>
        <View style={styles.msgFoot}>
          {status}
          {f.isByAdmin ? <Badge text="BY ADMIN" tone="info" /> : null}
          {m.subuserID ? <Badge text={`Staff ${m.subuserID}`} tone="brand" icon="person" /> : null}
          {hl?.hasMatch ? <Badge text={`No. ${betQuery.trim()}`} tone="warning" icon="locate" /> : null}
          <View style={{ flex: 1 }} />
          {f.canAccept ? (
            <Pressable hitSlop={6} onPress={() => { tap(); accept(m); }} style={[styles.actBtn, { backgroundColor: colors.successSoft }]}>
              <Ionicons name="checkmark" size={18} color={colors.success} />
            </Pressable>
          ) : null}
          {f.canReject ? (
            <Pressable hitSlop={6} onPress={() => { tap(); setActionMsg({ ...m, __confirm: 'reject' }); }} style={[styles.actBtn, { backgroundColor: colors.dangerSoft }]}>
              <Ionicons name="close" size={18} color={colors.danger} />
            </Pressable>
          ) : null}
          <Pressable hitSlop={6} onPress={() => { tap(); setActionMsg(m); }} style={styles.actBtn}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSoft} />
          </Pressable>
        </View>
      </Pressable>
    );
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
      <View style={styles.hRow}>
        <Pressable hitSlop={10} onPress={() => router.back()} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Pressable style={{ flex: 1, marginLeft: 8 }} onPress={() => { if (fromInbox) setYmOpen(true); }}>
          <Text style={styles.hTitle} numberOfLines={1}>{custTitle}</Text>
          <Text style={styles.hSub} numberOfLines={1}>{P.gameName}  ·  {P.rates}</Text>
        </Pressable>
        <Pressable hitSlop={6} onPress={() => { tap(); setShowSearch((s) => !s); if (showSearch) setBetQuery(''); }} style={[styles.hBtn, showSearch && { backgroundColor: colors.brandSoft }]}>
          <Ionicons name="search" size={19} color={showSearch ? colors.brand : colors.text} />
        </Pressable>
        {fromInbox && can('Yantri') ? (
          <Pressable hitSlop={6} onPress={() => { tap(); router.push({ pathname: '/yantri', params: { GameID: P.gameId, SelectedUID: P.selUID, Date: toMonDate(dateRef.current || istDMY()), Rates: P.rates, SelectedPage: '1' } }); }} style={styles.hBtn}>
            <Ionicons name="grid-outline" size={19} color={colors.text} />
          </Pressable>
        ) : null}
        {fromInbox ? (
          <Pressable hitSlop={6} onPress={() => { tap(); setBulkOpen(true); }} style={styles.hBtn}>
            <Ionicons name="git-compare-outline" size={19} color={colors.text} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.hRow2}>
        <Pressable onPress={() => { tap(); setCalOpen(true); }} style={styles.datePill}>
          <Ionicons name="calendar" size={15} color={colors.brand} />
          <Text style={styles.dateText}>{date || '—'}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.brand} />
        </Pressable>
        <View style={{ flex: 1 }} />
        {grandTotal ? (
          <View style={styles.grand}>
            <Text style={styles.grandLabel}>Grand Total</Text>
            <Text style={styles.grandVal}>₹ {grandTotal}</Text>
          </View>
        ) : null}
      </View>
      {showSearch ? (
        <View style={styles.betSearch}>
          <Ionicons name="locate-outline" size={17} color={colors.faint} />
          <TextInput value={betQuery} onChangeText={setBetQuery} placeholder="Find bet number…" placeholderTextColor={colors.faint} keyboardType="number-pad" style={styles.betInput} autoFocus />
          {betQuery ? <Text style={[styles.matchBadge, !matchCount && { backgroundColor: colors.dangerSoft, color: colors.danger }]}>{matchCount} bet{matchCount === 1 ? '' : 's'}</Text> : null}
          {betQuery ? <Pressable hitSlop={8} onPress={() => setBetQuery('')}><Ionicons name="close-circle" size={18} color={colors.faint} /></Pressable> : null}
        </View>
      ) : null}
    </View>
  );

  const showField = (f) => modeDef.fields.includes(f);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {header}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {messages === null ? <Loading /> : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m, i) => `${m.ChatID}-${i}`}
            renderItem={renderMessage}
            contentContainerStyle={{ padding: space.md, paddingBottom: space.lg }}
            onScrollToIndexFailed={() => {}}
            ListEmptyComponent={(
              <View style={{ alignItems: 'center', paddingTop: 60 }}>
                <Ionicons name="chatbubble-ellipses-outline" size={40} color={colors.borderStrong} />
                <Text style={{ color: colors.muted, marginTop: 8 }}>No messages for this date</Text>
              </View>
            )}
          />
        )}

        {/* ───── composer ───── */}
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          {editId ? (
            <View style={styles.editBar}>
              <Ionicons name="create" size={16} color={colors.warning} />
              <Text style={styles.editText} numberOfLines={1}>Editing entry #{editId}</Text>
              <Pressable onPress={() => { tap(); sendRows(editId); }} style={[styles.editBtn, { backgroundColor: colors.brand }]}><Text style={styles.editBtnText}>Update</Text></Pressable>
              <Pressable onPress={() => { tap(); setEditId(''); sendRows(''); }} style={[styles.editBtn, { backgroundColor: colors.success }]}><Text style={styles.editBtnText}>Add as new</Text></Pressable>
              <Pressable onPress={() => { tap(); clearAll(); }} hitSlop={8}><Ionicons name="close" size={20} color={colors.muted} /></Pressable>
            </View>
          ) : null}

          {rows.length ? (
            <View style={styles.tray}>
              <View style={styles.trayHead}>
                <Text style={styles.trayTitle}>{rows.length} pending · Total <Text style={{ color: colors.brandText }}>₹ {pendingTotal}</Text></Text>
                <Pressable onPress={() => { tap(); clearAll(); }} hitSlop={8}><Text style={styles.trayClear}>Clear</Text></Pressable>
              </View>
              <ScrollView style={{ maxHeight: 112 }} contentContainerStyle={styles.trayWrap} keyboardShouldPersistTaps="handled">
                {rows.map((r, i) => (
                  <Pressable key={i} onPress={() => { tap(); removeRow(i); }} style={styles.rowChip}>
                    <Text style={styles.rowNum}>{r.num}</Text>
                    <Text style={styles.rowAmt}>{r.amt}</Text>
                    <Ionicons name="close" size={13} color={colors.muted} />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.pills}>
            {MODES.map((m) => <Chip key={m.key} small label={m.label} selected={mode === m.key} onPress={() => selectMode(m.key)} />)}
          </ScrollView>

          {mode === 'cross' || mode === 'pahada' ? (
            <View style={styles.optRow}>
              {mode === 'cross' ? <Chip small icon={withoutJode ? 'checkbox' : 'square-outline'} label="Without Jode" selected={withoutJode} onPress={() => { setWithoutJode((x) => !x); focusFirst(); }} /> : null}
              {mode === 'pahada' ? <Chip small icon={add3 ? 'checkbox' : 'square-outline'} label="ADD 3" selected={add3} onPress={() => { setAdd3((x) => !x); focusFirst(); }} /> : null}
              <Text style={styles.hint} numberOfLines={1}>{modeDef.hint}</Text>
            </View>
          ) : (
            <Text style={[styles.hintLine, { marginHorizontal: space.md, marginBottom: 6 }]} numberOfLines={1}>{modeDef.hint}</Text>
          )}

          <View style={styles.inputs}>
            {showField('text') ? (
              <TextInput
                ref={textRef} value={text} onChangeText={setText} placeholder="Enter text here…" placeholderTextColor={colors.faint}
                style={[styles.inp, { flex: 1 }]} returnKeyType="send" onSubmitEditing={sendPlain} blurOnSubmit={false}
              />
            ) : null}
            {showField('num') ? (
              <View style={[styles.inpWrap, { flex: 2.2 }]}>
                <TextInput
                  ref={numRef} value={num}
                  onChangeText={(t) => setNum(mode === 'pahada' || mode === 'laddi' ? t.replace(/[a-zA-Z]/g, '').slice(0, numMaxLength(mode)) : formatNumberInput(t))}
                  placeholder={mode === 'laddi' ? 'From' : 'Number'} placeholderTextColor={colors.faint}
                  keyboardType={mode === 'pahada' || mode === 'laddi' ? 'number-pad' : NUM_KB}
                  maxLength={numMaxLength(mode)} style={styles.inpInner} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={onNumSubmit}
                />
                {mode === 'typing' ? (
                  <Pressable hitSlop={6} onPress={() => { tap(); pasteFromClipboard(); }} style={styles.pasteBtn}>
                    <Ionicons name="clipboard-outline" size={17} color={colors.brand} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {showField('to') ? (
              <TextInput ref={toRef} value={to} onChangeText={(t) => setTo(t.replace(/[^0-9]/g, ''))} placeholder="To" placeholderTextColor={colors.faint} keyboardType="number-pad" maxLength={3} style={[styles.inp, { flex: 1 }]} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => amtRef.current?.focus()} />
            ) : null}
            {showField('amt') ? (
              <TextInput ref={amtRef} value={amt} onChangeText={(t) => setAmt(t.replace(/[^0-9]/g, ''))} placeholder="Amt" placeholderTextColor={colors.faint} keyboardType="number-pad" style={[styles.inp, { flex: 1.3 }]} returnKeyType={showField('palat') ? 'next' : 'done'} blurOnSubmit={false} onSubmitEditing={onAmtSubmit} />
            ) : null}
            {showField('palat') ? (
              <TextInput ref={palatRef} value={palat} onChangeText={(t) => setPalat(t.replace(/[^0-9]/g, ''))} placeholder="Palat" placeholderTextColor={colors.faint} keyboardType="number-pad" style={[styles.inp, { flex: 1.3 }]} returnKeyType="done" blurOnSubmit={false} onSubmitEditing={addRows} />
            ) : null}
            {mode !== 'chat' ? (
              <Pressable onPress={() => { tap(); addRows(); }} style={styles.addBtn}>
                <Ionicons name="add" size={24} color={colors.brand} />
              </Pressable>
            ) : null}
          </View>
          <Button
            title={mode === 'chat' ? 'Send message' : editId ? `Update entry · ₹ ${pendingTotal}` : rows.length ? `Save entry · ₹ ${pendingTotal}` : 'Save'}
            icon={mode === 'chat' ? 'send' : 'checkmark-circle'}
            onPress={onSave}
            loading={sending}
            style={{ marginHorizontal: space.md, marginTop: 8 }}
          />
        </View>
      </KeyboardAvoidingView>

      <CalendarSheet visible={calOpen} onClose={() => setCalOpen(false)} value={date} onSelect={changeDate} title="Entry date" />
      <YantriGridSheet visible={ymOpen} onClose={() => { setYmOpen(false); focusFirst('typing'); }} onSend={sendYantri} sending={sending} />
      {fromInbox ? (
        <BulkMoveSheet visible={bulkOpen} onClose={() => setBulkOpen(false)} P={P} currentDate={date} customerTitle={custTitle} onDone={() => getTime()} />
      ) : null}
      <MessageActions msg={actionMsg} onClose={() => setActionMsg(null)} flagsFor={flagsFor} onAccept={accept} onReject={reject} onDelete={del} onCopy={copy} onEdit={edit} />
    </View>
  );
}

function MessageActions({ msg, onClose, flagsFor, onAccept, onReject, onDelete, onCopy, onEdit }) {
  const [confirm, setConfirm] = useState(null);
  useEffect(() => { setConfirm(msg?.__confirm || null); }, [msg]);
  if (!msg) return <Sheet visible={false} onClose={onClose} />;
  const f = flagsFor(msg);
  const run = (fn) => { onClose(); fn(msg); };
  const item = (icon, label, color, onPress, sub) => (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => [styles.actRow, pressed && { backgroundColor: colors.cardAlt }]}>
      <View style={[styles.actIcon, { backgroundColor: color + '1A' }]}><Ionicons name={icon} size={19} color={color} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.actLabel}>{label}</Text>
        {sub ? <Text style={styles.actSub}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
  return (
    <Sheet visible={!!msg} onClose={onClose} title={confirm ? (confirm === 'reject' ? 'Cancel this entry?' : 'Delete this entry?') : 'Entry actions'} subtitle={`#${msg.ChatID}${msg.TotalAmount ? ' · ₹ ' + msg.TotalAmount : ''}`}>
      {confirm ? (
        <View>
          <Text style={styles.confirmText} numberOfLines={4}>{msg.Message}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: space.md }}>
            <Button title="Keep" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button title={confirm === 'reject' ? 'Cancel entry' : 'Delete'} variant="danger" onPress={() => run(confirm === 'reject' ? onReject : onDelete)} style={{ flex: 1.3 }} />
          </View>
        </View>
      ) : (
        <View>
          {item('copy-outline', 'Copy message', colors.info, () => run(onCopy))}
          {f.canEdit ? item('create-outline', 'Edit entry', colors.warning, () => run(onEdit), 'Loads it below — then Update or Add as new') : null}
          {f.canAccept ? item('checkmark-circle-outline', 'Accept', colors.success, () => run(onAccept)) : null}
          {f.canReject ? item('close-circle-outline', 'Reject / Cancel', colors.danger, () => setConfirm('reject')) : null}
          {f.canDelete ? item('trash-outline', 'Delete', colors.danger, () => setConfirm('delete')) : null}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.card, paddingHorizontal: space.md, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  hRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hBtn: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  hTitle: { fontSize: font.lg, fontWeight: weight.heavy, color: colors.text },
  hSub: { fontSize: font.xs, color: colors.muted, fontWeight: weight.semi, marginTop: 1 },
  hRow2: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  datePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.brandSoft, paddingHorizontal: 12, height: 34, borderRadius: radius.pill },
  dateText: { color: colors.brandText, fontWeight: weight.heavy, fontSize: font.sm, fontVariant: ['tabular-nums'] },
  grand: { alignItems: 'flex-end' },
  grandLabel: { fontSize: 10, color: colors.muted, fontWeight: weight.bold, textTransform: 'uppercase' },
  grandVal: { fontSize: font.lg, color: colors.text, fontWeight: weight.heavy },
  betSearch: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, height: 42, borderRadius: radius.md, backgroundColor: colors.cardAlt, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border },
  betInput: { flex: 1, fontSize: font.md, color: colors.text, paddingVertical: 0 },
  matchBadge: { fontSize: font.xs, fontWeight: weight.heavy, color: colors.success, backgroundColor: colors.successSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },

  msg: { borderRadius: radius.md, padding: 12, marginBottom: 8, borderWidth: 1, ...shadow },
  msgSent: { backgroundColor: colors.bubbleIn, borderColor: colors.bubbleInBorder },
  msgRecv: { backgroundColor: colors.bubbleOut, borderColor: colors.border },
  msgMatch: { borderColor: colors.warning, borderWidth: 2 },
  msgText: { fontSize: font.md, color: colors.text, lineHeight: 22, fontWeight: weight.medium },
  strike: { textDecorationLine: 'line-through', color: colors.muted },
  hitNum: { backgroundColor: colors.highlight, fontWeight: weight.heavy },
  hitAmt: { backgroundColor: '#FFD9B3', fontWeight: weight.heavy },
  msgImg: { width: '100%', height: 220, borderRadius: radius.sm, backgroundColor: colors.cardAlt },
  msgMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  msgTotal: { fontSize: font.sm, fontWeight: weight.heavy, color: colors.brandText },
  msgRate: { fontSize: font.xs, color: colors.textSoft, fontWeight: weight.semi },
  msgTime: { fontSize: font.xs, color: colors.muted },
  msgFoot: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  actBtn: { width: 34, height: 30, borderRadius: 10, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },

  composer: { backgroundColor: colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 8, ...shadow },
  editBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: space.md, marginBottom: 8, padding: 8, borderRadius: radius.md, backgroundColor: colors.warningSoft },
  editText: { flex: 1, fontWeight: weight.bold, color: colors.warning, fontSize: font.sm },
  editBtn: { paddingHorizontal: 10, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  editBtnText: { color: '#fff', fontWeight: weight.bold, fontSize: font.xs },
  tray: { marginHorizontal: space.md, marginBottom: 8, padding: 8, borderRadius: radius.md, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  trayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  trayTitle: { fontSize: font.sm, fontWeight: weight.heavy, color: colors.text },
  trayClear: { color: colors.danger, fontWeight: weight.bold, fontSize: font.sm },
  trayWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rowChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 8, paddingRight: 6, height: 28, borderRadius: 9, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  rowNum: { fontWeight: weight.heavy, color: colors.text, fontSize: font.sm },
  rowAmt: { fontWeight: weight.bold, color: colors.brandText, fontSize: font.sm },
  pills: { gap: 6, paddingHorizontal: space.md, paddingBottom: 6 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: space.md, marginBottom: 6 },
  hint: { flex: 1, fontSize: font.xs, color: colors.muted },
  hintLine: { fontSize: font.xs, color: colors.muted },
  inputs: { flexDirection: 'row', gap: 6, paddingHorizontal: space.md, alignItems: 'center' },
  inp: { minWidth: 0, height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardAlt, paddingHorizontal: 10, fontSize: font.md, fontWeight: weight.bold, color: colors.text },
  inpWrap: { minWidth: 0, height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardAlt, flexDirection: 'row', alignItems: 'center', paddingLeft: 10 },
  inpInner: { flex: 1, minWidth: 0, fontSize: font.md, fontWeight: weight.bold, color: colors.text, paddingVertical: 0 },
  pasteBtn: { width: 36, height: 46, alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },

  actRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4, borderRadius: radius.sm },
  actIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actLabel: { fontSize: font.md, fontWeight: weight.bold, color: colors.text },
  actSub: { fontSize: font.xs, color: colors.muted, marginTop: 1 },
  confirmText: { fontSize: font.base, color: colors.textSoft, backgroundColor: colors.cardAlt, padding: 12, borderRadius: radius.md },
});
