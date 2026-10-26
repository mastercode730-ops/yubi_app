import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/client';
import Guard from '../components/Guard';
import GameHistorySheet from '../components/GameHistorySheet';
import { istPrevDMY, toDMY } from '../lib/dates';
import { cleanName, fmtNum, sumBy } from '../lib/format';
import { exportWorkbook } from '../lib/excel';
import { Amount, HeaderAction, Header, Loading, Row, Screen, SectionTitle, StatTile } from '../ui/kit';
import { DateField } from '../ui/Sheet';
import DataTable from '../ui/DataTable';
import { colors, font, radius, space } from '../theme';

const custSort = (a, b) => cleanName(a.CustomerName || a.CMobile || a.Mobile || a.UID).localeCompare(cleanName(b.CustomerName || b.CMobile || b.Mobile || b.UID)) || String(a.CMobile || '').localeCompare(String(b.CMobile || ''));
const nameOf = (r) => cleanName(r.CustomerName || r.CMobile || r.Mobile || r.UID || '');

function HisabScreen() {
  const [date, setDate] = useState('');
  const [gameHisab, setGameHisab] = useState(null);
  const [myHisab, setMyHisab] = useState(null);
  const [filter, setFilter] = useState('');
  const [hist, setHist] = useState(null);

  const bind = useCallback(async (d) => {
    if (!d) return;
    setGameHisab(null); setMyHisab(null); setFilter('');
    const [r1, r2] = await Promise.all([
      api.get('/api/hisab/game-hisab', { date: d, filter: '' }),
      api.get('/api/hisab/win-amount', { date: d, filter: '' }),
    ]);
    setGameHisab(r1?.success ? r1.data || [] : []);
    setMyHisab(r2?.success ? r2.data || [] : []);
  }, []);

  useEffect(() => {
    (async () => {
      const r = await api.get('/api/hisab/latest-date');
      const v = r?.dmy || r?.data || r?.date;
      const d = r?.success && v ? toDMY(v) : istPrevDMY();
      setDate(d);
      bind(d);
    })();
  }, [bind]);

  const filtered = useMemo(() => {
    const t = filter.toLowerCase();
    const list = !t ? gameHisab || [] : (gameHisab || []).filter((r) => (r.CMobile || '').toLowerCase().includes(t) || nameOf(r).toLowerCase().includes(t));
    return [...list].sort(custSort);
  }, [gameHisab, filter]);

  const showHistory = async (uid, mode) => {
    setHist({ title: mode === 'game' ? `${date} Hisab History` : 'My Hisab History', rows: null });
    const r = await api.get(mode === 'game' ? '/api/hisab/game-hisab-history' : '/api/hisab/win-amount-history', { date, uid });
    const rows = r?.success ? r.data || [] : [];
    setHist({
      title: mode === 'game' && rows[0]?.CustomerName ? `${cleanName(rows[0].CustomerName)} · ${date} · All Game History` : mode === 'game' ? `${date} Hisab History` : 'My Hisab History',
      rows,
    });
  };

  const exportXlsx = () => {
    const sheets = [];
    if (gameHisab?.length) {
      const sorted = [...gameHisab].sort(custSort);
      const rows = [['SRNo', 'Customer', 'Sale', 'Balance']];
      sorted.forEach((r, i) => rows.push([i + 1, nameOf(r), parseFloat(r.TotalAmount) || 0, parseFloat(r.Balance) || 0]));
      rows.push(['', 'Total', sumBy(sorted, 'TotalAmount'), sumBy(sorted, 'Balance')]);
      sheets.push({ name: 'My Game Hisab', rows });
    }
    if (myHisab?.length) {
      const rows = [['Mobile', 'Sale', 'Amount']];
      myHisab.forEach((r) => rows.push([cleanName(r.Mobile || r.UID), parseFloat(r.TotalAmount) || 0, parseFloat(r.Balance) || 0]));
      rows.push(['Total', sumBy(myHisab, 'TotalAmount'), sumBy(myHisab, 'Balance')]);
      sheets.push({ name: 'My Hisab', rows });
    }
    exportWorkbook(`Hisab_${(date || '').replace(/\//g, '-')}`, sheets);
  };

  const gameCols = [
    { key: 'sr', title: '#', width: 34, render: (r, i) => i + 1 },
    { key: 'name', title: 'Customer', flex: 2.2, render: (r) => nameOf(r), link: true, lines: 1 },
    { key: 'TotalAmount', title: 'Sale', flex: 1, align: 'right', render: (r) => fmtNum(r.TotalAmount || 0) },
    { key: 'Balance', title: 'Balance', flex: 1.2, align: 'right', render: (r) => <Amount value={r.Balance} decimals={2} style={{ fontSize: font.sm }} /> },
  ];
  const myCols = [
    { key: 'name', title: 'Mobile', flex: 2.2, render: (r) => cleanName(r.Mobile || r.UID), link: true, lines: 1 },
    { key: 'TotalAmount', title: 'Sale', flex: 1, align: 'right', render: (r) => fmtNum(r.TotalAmount || 0) },
    { key: 'Balance', title: 'Amount', flex: 1.2, align: 'right', render: (r) => <Amount value={r.Balance} decimals={2} style={{ fontSize: font.sm }} /> },
  ];
  const totSale = sumBy(gameHisab, 'TotalAmount'), totBal = sumBy(gameHisab, 'Balance');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Hisab" subtitle={date || ' '} right={<HeaderAction icon="download-outline" onPress={exportXlsx} />} />
      <Screen scroll>
        <DateField label="Date" value={date} onChange={(d) => { setDate(d); bind(d); }} />
        <Row gap={10} style={{ marginBottom: space.md }}>
          <StatTile label="Total Sale" value={fmtNum(totSale)} icon="trending-up" />
          <StatTile label="Balance" value={fmtNum(totBal)} tone={totBal < 0 ? 'danger' : 'success'} icon="wallet" />
        </Row>

        <SectionTitle title="My Game Hisab" hint="Tap a customer for game-wise history" />
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={colors.faint} />
          <TextInput value={filter} onChangeText={setFilter} placeholder="Filter name / mobile" placeholderTextColor={colors.faint} style={styles.searchInput} />
          {filter ? <Pressable onPress={() => setFilter('')}><Ionicons name="close-circle" size={17} color={colors.faint} /></Pressable> : null}
        </View>
        {gameHisab === null ? <Loading inline /> : (
          <DataTable
            columns={gameCols}
            rows={filtered}
            onRowPress={(r) => showHistory(r.UID, 'game')}
            footer={{ sr: '', name: 'Total', TotalAmount: fmtNum(sumBy(filtered, 'TotalAmount')), Balance: fmtNum(sumBy(filtered, 'Balance')) }}
          />
        )}

        <SectionTitle title="My Hisab" style={{ marginTop: space.lg }} hint="Tap a row for history" />
        {myHisab === null ? <Loading inline /> : (
          <DataTable
            columns={myCols}
            rows={myHisab}
            onRowPress={(r) => showHistory(r.UID, 'myhisab')}
            footer={{ name: 'Total', TotalAmount: fmtNum(sumBy(myHisab, 'TotalAmount')), Balance: fmtNum(sumBy(myHisab, 'Balance')) }}
          />
        )}
      </Screen>
      <GameHistorySheet visible={!!hist} onClose={() => setHist(null)} title={hist?.title} rows={hist?.rows} loading={hist && hist.rows === null} />
    </View>
  );
}

export default function Hisab() {
  return <Guard menuKey="hisab" title="Hisab"><HisabScreen /></Guard>;
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: radius.md, height: 42, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, marginBottom: space.sm },
  searchInput: { flex: 1, fontSize: font.base, color: colors.text, paddingVertical: 0 },
});
