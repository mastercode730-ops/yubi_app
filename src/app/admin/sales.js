import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import api from '../../api/client';
import Guard from '../../components/Guard';
import { istDMY, toMonDate } from '../../lib/dates';
import { fmtNum } from '../../lib/format';
import { EmptyState, Header, Loading, Screen, SectionTitle, StatTile, Row } from '../../ui/kit';
import { DateField } from '../../ui/Sheet';
import DataTable from '../../ui/DataTable';
import { colors, font } from '../../theme';

// frmUsersSales: every user's sale for a date, tap for game-wise detail.
function SalesScreen() {
  const [date, setDate] = useState(istDMY());
  const [rows, setRows] = useState(null);
  const [sel, setSel] = useState(null);
  const [games, setGames] = useState(null);

  const load = async (d) => {
    setRows(null); setSel(null); setGames(null);
    const r = await api.get('/api/admin/user-sales-list', { date: toMonDate(d) });
    setRows(r?.data || []);
  };
  useEffect(() => { load(date); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openUser = async (u, i) => {
    setSel({ i, label: u.Mobile || u.UID });
    setGames(null);
    const r = await api.get('/api/admin/user-sales-gamewise', { uid: u.UID, date: toMonDate(date) });
    setGames(r?.data || []);
  };

  const total = (rows || []).reduce((s, d) => s + (parseFloat(d.TotalAmount) || 0), 0);
  const gTotal = (games || []).reduce((s, d) => s + (parseFloat(d.TotalAmount) || 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="User Sales" subtitle={date} />
      <Screen scroll>
        <DateField label="Date" value={date} onChange={(d) => { setDate(d); load(d); }} />
        {rows === null ? <Loading inline /> : rows.length === 0 ? <EmptyState icon="cash-outline" title="No sales found" /> : (
          <>
            <Row gap={10} style={{ marginBottom: 12 }}>
              <StatTile label="Users with sale" value={String(rows.length)} tone="brand" />
              <StatTile label="Total sale" value={fmtNum(total, 0)} tone="success" />
            </Row>
            <DataTable
              columns={[
                { key: 'user', title: 'User', flex: 2, render: (d) => d.Mobile || d.UID, link: true },
                { key: 'TotalAmount', title: 'Total Sale', flex: 1.2, align: 'right', bold: true, render: (d) => fmtNum(d.TotalAmount || 0) },
              ]}
              rows={rows}
              selectedIndex={sel?.i}
              onRowPress={openUser}
              footer={{ user: `Total (${rows.length})`, TotalAmount: fmtNum(total, 0) }}
            />
          </>
        )}
        {sel ? (
          <>
            <SectionTitle title={`Game-wise · ${sel.label}`} style={{ marginTop: 16 }} />
            {games === null ? <Loading inline /> : games.length === 0 ? <Text style={{ color: colors.muted, fontSize: font.sm }}>No game data</Text> : (
              <DataTable
                columns={[
                  { key: 'GameName', title: 'Game', flex: 1.3 },
                  { key: 'CustomerName', title: 'Customer', flex: 1.6 },
                  { key: 'TotalAmount', title: 'Amount', flex: 1, align: 'right', bold: true, render: (d) => fmtNum(d.TotalAmount || 0) },
                ]}
                rows={games}
                footer={{ GameName: 'Total', CustomerName: '', TotalAmount: fmtNum(gTotal, 0) }}
              />
            )}
          </>
        ) : rows && rows.length ? <Text style={{ color: colors.muted, fontSize: font.xs, textAlign: 'center', marginTop: 10 }}>Tap a user for the game-wise breakdown</Text> : null}
      </Screen>
    </View>
  );
}

export default function AdminSales() {
  return <Guard menuKey="admin" title="User Sales"><SalesScreen /></Guard>;
}
