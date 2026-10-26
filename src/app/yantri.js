import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/client';
import Guard from '../components/Guard';
import { isCompleteDMY, istNow, dateToDMY, toDMY } from '../lib/dates';
import {
  ADJUST_MODES, AKHAR_AADAR, AKHAR_ANDER, addNumber, applyAdjust, applyCutting, computeNumData,
  cuttingHistoryEntry, dataFromHistory, emptyNumData, forwardMessage, msgBrackets, msgEquals, msgNumbers,
  splitParts, summarize,
} from '../lib/yantriEngine';
import { param } from '../lib/nav';
import { onlyDecimal, signedInt } from '../lib/format';
import { Button, CheckRow, Chip, Field, Header, Row, Segmented, tap } from '../ui/kit';
import { DateField, SelectField, Sheet } from '../ui/Sheet';
import { toast } from '../ui/Toast';
import { colors, font, radius, shadow, space, weight } from '../theme';

const W = Math.min(Dimensions.get('window').width, 560);
const CELL = Math.floor((W - space.lg * 2 - 10 * 3) / 11);
const MODES = [
  { key: 'actual', label: 'Actual' }, { key: 'daily', label: 'Daily' },
  { key: 'agent', label: 'Agent' }, { key: 'special', label: 'Special' },
];
const TOOLS = [
  { key: 'cutting', label: 'Cutting', icon: 'cut-outline' }, { key: 'add', label: 'Add', icon: 'add-circle-outline' },
  { key: 'adjust', label: 'Adjust', icon: 'flash-outline' }, { key: 'parts', label: 'Parts', icon: 'layers-outline' },
  { key: 'forward', label: 'Forward', icon: 'arrow-up-circle-outline' }, { key: 'negsale', label: 'Neg Sale', icon: 'arrow-down-circle-outline' },
];

const pad2 = (n) => String(n).padStart(2, '0');

function YantriScreen() {
  const q = useLocalSearchParams();
  const GAME_PARAM = param(q.GameID);
  const SEL_UID = param(q.SelectedUID);
  const RATES = param(q.Rates);
  const DATE_PARAM = param(q.Date);
  const startAgent = (GAME_PARAM && SEL_UID) || param(q.mode) === 'agent';

  const [games, setGames] = useState([]);
  const [gid, setGid] = useState('');
  const [date, setDate] = useState('');
  const [mode, setMode] = useState(startAgent ? 'agent' : 'actual');
  const [agents, setAgents] = useState([]);
  const [agent, setAgent] = useState('');
  const [negSale, setNegSale] = useState(false);
  const [shift, setShift] = useState(true);
  const [data, setData] = useState(emptyNumData());
  const [loading, setLoading] = useState(false);
  const [tool, setTool] = useState('cutting');
  const [cells, setCells] = useState(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [clients, setClients] = useState([]);
  const ready = useRef(false);
  const seq = useRef(0);

  const loadData = useCallback(async (o = {}) => {
    const g = o.gid ?? gid, d = o.date ?? date, m = o.mode ?? mode, a = o.agent ?? agent;
    const ns = o.negSale ?? negSale, sh = o.shift ?? shift;
    if (!g || !d) return;
    const id = ++seq.current;
    setLoading(true);
    const r = await api.get('/api/yantri/data', { gid: g, date: d, mode: m, negSale: ns, agentUID: a || '', rates: RATES });
    if (id !== seq.current) return;
    setLoading(false);
    setData(r?.success && r.data?.length ? computeNumData(r.data, m, sh) : emptyNumData());
  }, [gid, date, mode, agent, negSale, shift, RATES]);

  const loadAgents = useCallback(async (g, d) => {
    const r = await api.get('/api/yantri/agents', { gid: g, date: d });
    const list = (r?.data || []).map((a) => ({ value: String(a.fSenderID || a.UID || ''), label: a.CustomerName || a.Name || '', sub: a.Mobile || '' }));
    setAgents(list);
    return list;
  }, []);

  const loadClients = useCallback(async () => {
    const r = await api.get('/api/yantri/uttar-clients');
    setClients((r?.data || []).map((c) => ({ value: String(c.CID), label: c.CustomerName || c.Name || c.Mobile || 'Unknown', sub: c.Mobile, uid: c.UID || '' })));
  }, []);

  useEffect(() => {
    (async () => {
      const r = await api.get('/api/yantri/games');
      const list = r?.data || [];
      setGames(list);
      const g = (GAME_PARAM && list.find((x) => String(x.GID) === GAME_PARAM)) ? GAME_PARAM : list[0] ? String(list[0].GID) : GAME_PARAM;
      setGid(g);
      loadClients();
      let d = DATE_PARAM ? toDMY(DATE_PARAM) : '';
      if (!d) {
        const lr = await api.get('/api/hisab/latest-date');
        const v = lr?.dmy || lr?.data || lr?.date;
        if (lr?.success && v) d = toDMY(v);
        else { const n = istNow(); d = dateToDMY(new Date(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())); }
      }
      setDate(d);
      let a = '';
      const ag = await loadAgents(g, d);
      if (startAgent && SEL_UID) {
        const m = ag.find((x) => x.value === SEL_UID);
        a = m ? m.value : SEL_UID;
        setAgent(a);
      }
      ready.current = true;
      loadData({ gid: g, date: d, agent: a, mode: startAgent ? 'agent' : 'actual' });
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onGame = async (g) => { setGid(g); setCells(null); if (mode === 'agent') await loadAgents(g, date); loadData({ gid: g }); };
  const onDate = async (d) => { if (!isCompleteDMY(d)) return; setDate(d); setCells(null); if (mode === 'agent') await loadAgents(gid, d); loadData({ date: d }); };
  const onMode = async (m) => { setMode(m); setCells(null); if (m === 'agent') await loadAgents(gid, date); loadData({ mode: m }); };
  const onAgent = (a) => { setAgent(a || ''); loadData({ agent: a || '' }); };

  const sum = useMemo(() => summarize(data), [data]);
  const gameName = games.find((g) => String(g.GID) === String(gid))?.GameName || '';
  const gameOptions = useMemo(() => games.map((g) => ({ value: String(g.GID), label: g.GameName })), [games]);

  const showCell = (n) => {
    const v = Math.trunc(data[n] || 0);
    tap();
    setCells({ n, v });
  };

  const cell = (n, label) => {
    const v = Math.trunc(data[n] || 0);
    const hot = v !== 0;
    return (
      <Pressable key={n} onPress={() => showCell(n)} style={[styles.cell, hot && styles.cellHot, cells?.n === n && styles.cellSel]}>
        <Text style={[styles.cellLabel, hot && { color: colors.brandText }]}>{label}</Text>
        <Text style={[styles.cellVal, !hot && { color: 'transparent' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{hot ? v : '0'}</Text>
      </Pressable>
    );
  };
  const totCell = (key, v) => (
    <View key={key} style={[styles.cell, styles.totCell]}>
      <Text style={styles.cellLabel}>TOT</Text>
      <Text style={[styles.cellVal, { color: colors.success }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{v || ''}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header
        title="Yantri"
        subtitle={`${gameName}${date ? ' · ' + date : ''}${RATES ? ' · ' + RATES : ''}`}
        right={loading ? <ActivityIndicator color={colors.brand} /> : null}
      />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
        <Row gap={10}>
          <DateField value={date} onChange={onDate} compact style={{ flex: 1 }} title="Yantri date" />
          <SelectField value={gid} options={gameOptions} onChange={onGame} compact style={{ flex: 1.2 }} placeholder="Game" title="Select game" />
        </Row>
        <Segmented options={MODES} value={mode} onChange={onMode} style={{ marginTop: space.md }} />
        {mode === 'agent' ? (
          <SelectField value={agent} options={agents} onChange={onAgent} placeholder="-- Choose Agent --" title="Choose agent" searchable avatars allowClear clearLabel="-- Choose Agent --" style={{ marginTop: space.md, marginBottom: 0 }} />
        ) : null}
        <Row gap={8} style={{ marginTop: space.md }} wrap>
          <Chip small icon={negSale ? 'checkbox' : 'square-outline'} label="Negative Sale" selected={negSale} onPress={() => { const v = !negSale; setNegSale(v); loadData({ negSale: v }); }} />
          <Chip small icon={shift ? 'checkbox' : 'square-outline'} label="A → D" selected={shift} onPress={() => { const v = !shift; setShift(v); loadData({ shift: v }); }} />
          {mode === 'special' ? <Chip small icon="people-outline" label="Manage" onPress={() => setManageOpen(true)} /> : null}
        </Row>

        <View style={styles.summary}>
          <View style={styles.sumItem}><Text style={styles.sumLabel}>Dara Sale</Text><Text style={styles.sumVal}>{sum.dSale}</Text></View>
          <View style={styles.sumItem}><Text style={styles.sumLabel}>Akhar Sale</Text><Text style={styles.sumVal}>{sum.aSale}</Text></View>
          <View style={[styles.sumItem, { backgroundColor: colors.brand }]}><Text style={[styles.sumLabel, { color: 'rgba(255,255,255,0.8)' }]}>Grand Total</Text><Text style={[styles.sumVal, { color: '#fff' }]}>{sum.total}</Text></View>
        </View>

        <View style={styles.gridCard}>
          {Array.from({ length: 10 }, (_, r) => (
            <View key={r} style={styles.gridRow}>
              {Array.from({ length: 10 }, (__, c) => { const n = r * 10 + c + 1; return cell(n, pad2(n)); })}
              {totCell(`t${r}`, sum.rowTotals[r])}
            </View>
          ))}
          <View style={styles.sep} />
          <View style={styles.gridRow}>{AKHAR_AADAR.map((n) => cell(n, String(n)))}{totCell('aa', sum.aadar)}</View>
          <View style={styles.gridRow}>{AKHAR_ANDER.map((n) => cell(n, String(n)))}{totCell('an', sum.ander)}</View>
          {cells ? (
            <View style={styles.peek}>
              <Text style={styles.peekText}>Number <Text style={{ fontWeight: weight.heavy }}>{cells.n <= 100 ? pad2(cells.n) : cells.n}</Text> → <Text style={{ fontWeight: weight.heavy, color: colors.brandText }}>{cells.v}</Text></Text>
              <Pressable hitSlop={8} onPress={() => setCells(null)}><Ionicons name="close" size={16} color={colors.muted} /></Pressable>
            </View>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: space.md }}>
          {TOOLS.map((t) => <Chip key={t.key} icon={t.icon} label={t.label} selected={tool === t.key} onPress={() => setTool(t.key)} tone="dark" />)}
        </ScrollView>

        <View style={styles.toolCard}>
          {tool === 'cutting' ? <CuttingTool data={data} setData={setData} total={sum.total} reload={() => loadData()} /> : null}
          {tool === 'add' ? <AddTool data={data} setData={setData} /> : null}
          {tool === 'adjust' ? <AdjustTool data={data} setData={setData} /> : null}
          {tool === 'parts' ? <PartsTool data={data} setData={setData} reload={() => loadData()} /> : null}
          {tool === 'forward' ? <ForwardTool data={data} clients={clients} gameName={gameName} onManage={() => setManageOpen(true)} /> : null}
          {tool === 'negsale' ? <NegSaleTool data={data} clients={clients} gid={gid} date={date} onManage={() => setManageOpen(true)} /> : null}
        </View>
      </ScrollView>

      <ManageClientsSheet
        visible={manageOpen}
        onClose={() => setManageOpen(false)}
        onSaved={() => { setManageOpen(false); loadData(); loadClients(); }}
      />
    </View>
  );
}

function CuttingTool({ data, setData, total, reload }) {
  const [pct, setPct] = useState(false);
  const [round, setRound] = useState('0');
  const [dCut, setDCut] = useState('');
  const [aCut, setACut] = useState('');
  const [history, setHistory] = useState([]);
  const [hist, setHist] = useState('');
  const aRef = useRef(null);
  const cut = () => {
    const d = parseFloat(dCut) || 0, a = parseFloat(aCut) || 0;
    if (d || a) {
      const h = cuttingHistoryEntry(data, d, a, pct);
      if (h) setHistory((x) => [...x, { label: String(x.length + 1), values: h }]);
    }
    setData(applyCutting(data, d, a, pct, parseFloat(round) || 0));
    setDCut(''); setACut('');
  };
  const copy = async (kind) => {
    let text = '';
    if (kind === 'equals') text = `${msgEquals(data)} Grand Total: ${total}`;
    if (kind === 'brackets') text = `${msgBrackets(data)}\n\nGrand Total: ${total}`;
    if (kind === 'numbers') text = msgNumbers(data);
    await Clipboard.setStringAsync(text);
    toast('Copied!');
  };
  const share = async () => {
    try { await Share.share({ message: `${msgBrackets(data)}\n\nGrand Total: ${total}` }); } catch {}
  };
  return (
    <View>
      <Segmented small options={[{ key: 'amount', label: 'Amount' }, { key: 'percent', label: '%Age' }]} value={pct ? 'percent' : 'amount'} onChange={(k) => setPct(k === 'percent')} />
      <Text style={styles.toolLabel}>Round off</Text>
      <Row gap={8}>{['0', '5', '10', '50'].map((r) => <Chip key={r} small label={r} selected={round === r} onPress={() => setRound(r)} />)}</Row>
      <Row gap={10} style={{ marginTop: space.md }} align="flex-end">
        <Field compact label="D Cutting" value={dCut} onChangeText={(t) => setDCut(onlyDecimal(t))} keyboardType="decimal-pad" placeholder="0" containerStyle={{ flex: 1 }} returnKeyType="next" onSubmitEditing={() => aRef.current?.focus()} />
        <Field compact ref={aRef} label="A Cutting" value={aCut} onChangeText={(t) => setACut(onlyDecimal(t))} keyboardType="decimal-pad" placeholder="0" containerStyle={{ flex: 1 }} onSubmitEditing={cut} />
        <Button title="Cut" icon="cut" onPress={cut} style={{ height: 42 }} />
      </Row>
      {history.length ? (
        <SelectField
          label="History"
          value={hist}
          options={history.map((h, i) => ({ value: String(i), label: `Cut #${h.label}` }))}
          onChange={(v) => { setHist(v || ''); if (v === '' || v === null) reload(); else setData(dataFromHistory(history[parseInt(v, 10)].values)); }}
          allowClear clearLabel="-- Current data --" style={{ marginTop: space.md, marginBottom: 0 }}
        />
      ) : null}
      <Row gap={8} wrap style={{ marginTop: space.md }}>
        <Button size="sm" variant="secondary" title="= Copy" onPress={() => copy('equals')} />
        <Button size="sm" variant="secondary" title=") Copy" onPress={() => copy('brackets')} />
        <Button size="sm" variant="outline" title="Nums Only" onPress={() => copy('numbers')} />
        <Button size="sm" variant="success" icon="share-social" title="Share" onPress={share} />
      </Row>
    </View>
  );
}

function AddTool({ data, setData }) {
  const [n, setN] = useState('');
  const [a, setA] = useState('');
  const aRef = useRef(null);
  const add = () => {
    const r = addNumber(data, n, a);
    if (r.skipped) return;
    if (r.error) { toast(r.error, 'error'); return; }
    setData(r.data);
    setN(''); setA('');
    toast(`${r.n} → ${r.value}`);
  };
  return (
    <Row gap={10} align="flex-end">
      <Field compact label="Number" value={n} onChangeText={(t) => setN(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={5} containerStyle={{ flex: 1 }} returnKeyType="next" onSubmitEditing={() => aRef.current?.focus()} />
      <Field compact ref={aRef} label="Amount (− allowed)" value={a} onChangeText={(t) => setA(signedInt(t))} keyboardType="numbers-and-punctuation" containerStyle={{ flex: 1.3 }} onSubmitEditing={add} />
      <Button title="Add" icon="add" onPress={add} style={{ height: 42 }} />
    </Row>
  );
}

function AdjustTool({ data, setData }) {
  const [type, setType] = useState('limit');
  const [v, setV] = useState('');
  return (
    <View>
      <Row gap={8} wrap>{ADJUST_MODES.map((m) => <Chip key={m.key} small label={m.label} selected={type === m.key} onPress={() => setType(m.key)} />)}</Row>
      <Row gap={10} align="flex-end" style={{ marginTop: space.md }}>
        <Field compact label="Value" value={v} onChangeText={(t) => setV(onlyDecimal(t))} keyboardType="decimal-pad" containerStyle={{ flex: 1 }} onSubmitEditing={() => setData(applyAdjust(data, v, type))} />
        <Button title="Apply" icon="flash" onPress={() => setData(applyAdjust(data, v, type))} style={{ height: 42 }} />
      </Row>
    </View>
  );
}

function PartsTool({ data, setData, reload }) {
  const [max, setMax] = useState('');
  const [ghar, setGhar] = useState('');
  const [count, setCount] = useState('2');
  const [parts, setParts] = useState(null);
  const [shown, setShown] = useState(0);
  const start = () => {
    const p = splitParts(data, parseInt(count, 10) || 2, parseInt(max, 10) || 0);
    setParts(p);
    setShown(p.length - 1);
    setData({ ...p[p.length - 1] });
  };
  const reset = () => { setParts(null); reload(); };
  return (
    <View>
      <Row gap={10}>
        <Field compact label="Max Amount" value={max} onChangeText={(t) => setMax(onlyDecimal(t))} keyboardType="number-pad" containerStyle={{ flex: 1 }} />
        <Field compact label="Max Ghar" value={ghar} onChangeText={(t) => setGhar(onlyDecimal(t))} keyboardType="number-pad" containerStyle={{ flex: 1 }} />
      </Row>
      <Text style={styles.toolLabel}>Parts</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {['2', '3', '4', '5', '6', '7', '8', '9', '10'].map((c) => <Chip key={c} small label={c} selected={count === c} onPress={() => !parts && setCount(c)} />)}
      </ScrollView>
      {parts ? (
        <>
          <Text style={styles.toolLabel}>Show part</Text>
          <Row gap={6} wrap>{parts.map((_, i) => <Chip key={i} small label={`Part ${i + 1}`} selected={shown === i} onPress={() => { setShown(i); setData({ ...parts[i] }); }} />)}</Row>
          <Button title="Reset" variant="dangerSoft" icon="refresh" onPress={reset} style={{ marginTop: space.md }} />
        </>
      ) : (
        <Button title="Start" icon="play" onPress={start} style={{ marginTop: space.md }} />
      )}
    </View>
  );
}

// yantri/forward & negative-sale respond { success: affected > 0 }; the SP
// returns no row count, so a 200 without an error message means it was saved.
const savedOk = (r) => r?.success || (r?.status === 200 && !r?.message);

function useClientRates() {
  const [rates, setRates] = useState([]);
  const [games, setGames] = useState([]);
  const load = async (cid) => {
    setRates([]); setGames([]);
    if (!cid) return { games: [] };
    const r = await api.get('/api/yantri/uttar-rates', { cid });
    setRates((r?.data || []).map((d) => ({ value: String(d.RateID), label: d.Rate, d })));
    const g = (r?.games || []).map((x) => ({ value: String(x.GID), label: x.GameName }));
    setGames(g);
    return { games: g };
  };
  return { rates, games, load };
}

function ForwardTool({ data, clients, gameName, onManage }) {
  const [client, setClient] = useState('');
  const [rate, setRate] = useState('');
  const [game, setGame] = useState('');
  const [busy, setBusy] = useState(false);
  const { rates, games, load } = useClientRates();
  const onClient = async (cid) => {
    setClient(cid || ''); setRate(''); setGame('');
    const { games: g } = await load(cid);
    const same = g.find((x) => x.label === gameName);
    if (same) setGame(same.value);
  };
  const go = async () => {
    const opt = rates.find((x) => x.value === rate);
    if (!opt || !game) { toast('Select client, rate & game', 'error'); return; }
    const { message, total } = forwardMessage(data, false);
    if (!message || total <= 0) { toast('No data to forward', 'error'); return; }
    const d = opt.d;
    setBusy(true);
    const r = await api.post('/api/yantri/forward', {
      message, totalAmount: total, gameID: game, rateID: rate, fReceiverUID: d.fUID,
      D_PComm: d.D_PComm, D_Amt: d.D_Amt, A_PComm: d.A_PComm, A_Amt: d.A_Amt, Patti: d.Patti,
      ThirdPartyHissaID: d.ThirdPartyHissaID || 0, ThirdPartyHissaPer: d.ThirdPartyHissaPer || 0,
      ThirdPartyCommID: d.ThirdPartyCommID || 0, ThirdPartyDaraComm: d.ThirdPartyDaraComm || 0, ThirdPartyAkharComm: d.ThirdPartyAkharComm || 0,
    });
    setBusy(false);
    if (savedOk(r)) { toast('Forwarded!'); setGame(''); }
    else toast(r?.message || 'Error', 'error');
  };
  return (
    <View>
      <Button size="sm" variant="secondary" icon="settings-outline" title="Manage Clients" onPress={onManage} style={{ alignSelf: 'flex-start', marginBottom: space.md }} />
      <SelectField label="Client" value={client} options={clients} onChange={onClient} placeholder="Select Client" avatars />
      <SelectField label="Rate" value={rate} options={rates} onChange={setRate} placeholder="Select Rate" disabled={!client} />
      <SelectField label="Game" value={game} options={games} onChange={setGame} placeholder="Select Game" disabled={!client} />
      <Button title="Forward" iconRight="arrow-forward" loading={busy} onPress={go} />
    </View>
  );
}

function NegSaleTool({ data, clients, gid, date, onManage }) {
  const [client, setClient] = useState('');
  const [rate, setRate] = useState('');
  const [busy, setBusy] = useState(false);
  const { rates, load } = useClientRates();
  const go = async () => {
    const opt = rates.find((x) => x.value === rate);
    if (!opt) { toast('Select client & rate', 'error'); return; }
    const d = opt.d;
    const c = clients.find((x) => x.value === client);
    const senderUID = c?.uid || d.fUID || '';
    const { message, total } = forwardMessage(data, true);
    if (!message) { toast('No data', 'error'); return; }
    setBusy(true);
    const r = await api.post('/api/yantri/negative-sale', {
      message, totalAmount: total, gameID: gid, date, senderUID,
      D_PComm: d.D_PComm, D_Amt: d.D_Amt, A_PComm: d.A_PComm, A_Amt: d.A_Amt, Patti: d.Patti,
      ThirdPartyHissaID: d.ThirdPartyHissaID || 0, ThirdPartyHissaPer: d.ThirdPartyHissaPer || 0,
      ThirdPartyCommID: d.ThirdPartyCommID || 0, ThirdPartyDaraComm: d.ThirdPartyDaraComm || 0, ThirdPartyAkharComm: d.ThirdPartyAkharComm || 0,
    });
    setBusy(false);
    if (savedOk(r)) { toast('Negative Sale Saved!'); setRate(''); }
    else toast(r?.message || 'Error', 'error');
  };
  return (
    <View>
      <Button size="sm" variant="secondary" icon="settings-outline" title="Manage Clients" onPress={onManage} style={{ alignSelf: 'flex-start', marginBottom: space.md }} />
      <SelectField label="Client" value={client} options={clients} onChange={(v) => { setClient(v || ''); setRate(''); load(v); }} placeholder="Select Client" avatars />
      <SelectField label="Rate" value={rate} options={rates} onChange={setRate} placeholder="Select Rate" disabled={!client} />
      <Button title="Save Negative Sale" variant="danger" icon="arrow-down-circle" loading={busy} onPress={go} />
    </View>
  );
}

function ManageClientsSheet({ visible, onClose, onSaved }) {
  const [all, setAll] = useState([]);
  const [checked, setChecked] = useState({});
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setFilter('');
    (async () => {
      const r = await api.get('/api/yantri/all-clients');
      const list = r?.data || [];
      setAll(list);
      const c = {};
      list.forEach((x) => { if (x.IsYantriTo === true || x.IsYantriTo === 'True' || x.IsYantriTo === 1) c[x.CID] = true; });
      setChecked(c);
    })();
  }, [visible]);
  const shown = all.filter((c) => (c.CustomerName || '').toLowerCase().includes(filter.toLowerCase()));
  const save = async () => {
    setBusy(true);
    const ids = Object.keys(checked).filter((k) => checked[k]).join(',');
    const r = await api.post('/api/yantri/save-clients', { customerIDs: ids });
    setBusy(false);
    if (r?.success) { toast('Saved!'); onSaved(); } else toast(r?.message || 'Error', 'error');
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Manage Special Clients"
      subtitle={`${Object.values(checked).filter(Boolean).length} selected`}
      footer={<Button title="Save" icon="checkmark" loading={busy} onPress={save} full />}
    >
      <Field icon="search" placeholder="Filter by name…" value={filter} onChangeText={setFilter} compact containerStyle={{ marginBottom: space.sm }} />
      {shown.map((c) => (
        <CheckRow key={c.CID} label={c.CustomerName || ''} sub={c.Mobile} checked={!!checked[c.CID]} onPress={() => setChecked((x) => ({ ...x, [c.CID]: !x[c.CID] }))} />
      ))}
    </Sheet>
  );
}

export default function Yantri() {
  const q = useLocalSearchParams();
  const key = param(q.mode) === 'agent' && !param(q.SelectedUID) ? 'pl-yantri' : 'yantri';
  return <Guard menuKey={key} title="Yantri"><YantriScreen /></Guard>;
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', gap: 8, marginTop: space.md },
  sumItem: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: 10, ...shadow },
  sumLabel: { fontSize: font.xs, color: colors.muted, fontWeight: weight.bold },
  sumVal: { fontSize: font.lg, fontWeight: weight.heavy, color: colors.text, marginTop: 2, fontVariant: ['tabular-nums'] },
  gridCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 6, marginTop: space.md, ...shadow },
  gridRow: { flexDirection: 'row', gap: 3, marginBottom: 3, justifyContent: 'center' },
  cell: { width: CELL, height: CELL + 8, borderRadius: 7, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 1 },
  cellHot: { backgroundColor: colors.brandSoft },
  cellSel: { borderWidth: 1.5, borderColor: colors.brand },
  totCell: { backgroundColor: colors.successSoft },
  cellLabel: { fontSize: 8.5, fontWeight: weight.bold, color: colors.faint },
  cellVal: { fontSize: 11, fontWeight: weight.heavy, color: colors.text, fontVariant: ['tabular-nums'] },
  sep: { height: 1, backgroundColor: colors.border, marginVertical: 5 },
  peek: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.brandSoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 4 },
  peekText: { color: colors.textSoft, fontSize: font.sm },
  toolCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, ...shadow },
  toolLabel: { fontSize: font.sm, fontWeight: weight.semi, color: colors.textSoft, marginTop: space.md, marginBottom: 6 },
});
