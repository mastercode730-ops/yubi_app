import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import api from '../api/client';
import Guard from '../components/Guard';
import { MONTHS, istDMY, toDMY } from '../lib/dates';
import { param } from '../lib/nav';
import { Button, Card, Field, Header, Loading, Row, Screen, SectionTitle } from '../ui/kit';
import { DateField, SelectField } from '../ui/Sheet';
import DataTable from '../ui/DataTable';
import { toast } from '../ui/Toast';
import { colors, font, weight } from '../theme';

function ResultsScreen() {
  const q = useLocalSearchParams();
  const [games, setGames] = useState([]);
  const [gid, setGid] = useState('');
  const [date, setDate] = useState('');
  const [result, setResult] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [grid, setGrid] = useState(null);
  const [gridMsg, setGridMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const getResult = useCallback(async (g, d) => {
    if (!g || !d) { setResult(''); return; }
    const r = await api.get('/api/game/result', { gid: g, date: d });
    setResult(r?.data?.Result ? String(r.data.Result) : '');
  }, []);

  const bindGrid = useCallback(async (s, e) => {
    if (!s || !e) return;
    const sp = s.split('/'), ep = e.split('/');
    if (sp.length !== 3 || ep.length !== 3) return;
    if (parseInt(sp[1], 10) !== parseInt(ep[1], 10) || sp[2] !== ep[2]) {
      toast('Please Select one Month Result !', 'error');
      setGrid([]); setGridMsg('Please select dates from the same month');
      return;
    }
    setGrid(null);
    const r = await api.get('/api/hisab/show-results', { startDate: s, endDate: e });
    const data = (r?.data || []).slice();
    const key = (v) => { const m = String(v || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? parseInt(m[3] + m[2].padStart(2, '0') + m[1].padStart(2, '0'), 10) : 0; };
    data.sort((a, b) => key(a.Date) - key(b.Date));
    setGridMsg(data.length ? '' : `No results found for ${s}`);
    setGrid(data);
  }, []);

  useEffect(() => {
    (async () => {
      const [rg, rl] = await Promise.all([api.get('/api/game'), api.get('/api/hisab/latest-date')]);
      const list = rg?.data || [];
      setGames(list);
      const v = rl?.dmy || rl?.data || rl?.date;
      const d = rl?.success && v ? toDMY(v) : istDMY();
      setDate(d); setStart(d); setEnd(d);
      const want = param(q.GID || q.gid);
      if (want) { setGid(want); getResult(want, d); }
      bindGrid(d, d);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    const res = result.trim();
    if (!gid) { toast('Select a game', 'error'); return; }
    if (!res || !date || !/^\d+$/.test(res)) { toast('Wrong Inputs! Something Went Wrong!', 'error'); return; }
    setBusy(true);
    const r = await api.post('/api/game/save-result', { result: res, gameID: gid, date });
    setBusy(false);
    if (r?.success) {
      toast('Data Saved Sucessfully!');
      setResult('');
      setStart(date); setEnd(date);
      bindGrid(date, date);
    } else toast(r?.message || 'Wrong Inputs! Something Went Wrong!', 'error');
  };

  const gameOptions = useMemo(() => games.map((g) => ({ value: String(g.GID), label: g.GameName, sub: g.DrawTime })), [games]);
  const columns = useMemo(() => {
    if (!grid || !grid.length) return [];
    return Object.keys(grid[0]).map((c) => ({
      key: c, title: c, width: c === 'Date' ? 104 : 72, align: c === 'Date' ? 'left' : 'center', bold: c === 'Date',
      render: c === 'Date' ? (row) => {
        const m = String(row.Date || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        return m ? `${m[1].padStart(2, '0')}/${MONTHS[parseInt(m[2], 10) - 1]}/${m[3]}` : row.Date;
      } : (row) => (row[c] === null || row[c] === undefined ? '' : row[c]),
    }));
  }, [grid]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Results" subtitle="Declare results & view the month chart" />
      <Screen scroll>
        <Card>
          <SectionTitle title="Declare result" style={{ marginTop: 0 }} />
          <Row gap={10}>
            <DateField label="Date" value={date} onChange={(d) => { setDate(d); getResult(gid, d); }} style={{ flex: 1 }} />
            <SelectField label="Game" value={gid} options={gameOptions} onChange={(g) => { setGid(g); getResult(g, date); }} placeholder="Select Game" style={{ flex: 1.2 }} />
          </Row>
          <Row gap={10} align="flex-end">
            <Field
              label="Result" value={result} onChangeText={(t) => setResult(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={2}
              placeholder="00" containerStyle={{ flex: 1, marginBottom: 0 }} inputStyle={{ fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: 4 }} style={{ height: 56 }}
              onSubmitEditing={submit} selectTextOnFocus
            />
            <Button title="Submit" icon="checkmark" loading={busy} onPress={submit} style={{ height: 56, flex: 1 }} />
          </Row>
        </Card>

        <Card>
          <SectionTitle title="Result chart" hint="Pick dates within one month" style={{ marginTop: 0 }} />
          <Row gap={10}>
            <DateField label="Start Date" value={start} onChange={setStart} style={{ flex: 1 }} />
            <DateField label="End Date" value={end} onChange={setEnd} style={{ flex: 1 }} />
          </Row>
          <Button title="Search" icon="search" variant="secondary" onPress={() => bindGrid(start, end)} />
        </Card>

        {grid === null ? <Loading inline /> : grid.length ? (
          <DataTable scroll dense columns={columns} rows={grid} />
        ) : (
          <Text style={{ textAlign: 'center', color: colors.muted, fontSize: font.sm, fontWeight: weight.semi, padding: 20 }}>{gridMsg || 'No results'}</Text>
        )}
      </Screen>
    </View>
  );
}

export default function Results() {
  return <Guard menuKey="results" title="Results"><ResultsScreen /></Guard>;
}
