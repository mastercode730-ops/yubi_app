import React from 'react';
import { Text, View } from 'react-native';
import { Sheet } from '../ui/Sheet';
import DataTable from '../ui/DataTable';
import { Loading } from '../ui/kit';
import { fmtNum } from '../lib/format';
import { colors, font, weight } from '../theme';

const COLS = [
  { key: 'GameName', title: 'Game', width: 96, bold: true },
  { key: 'Rates', title: 'Rates', width: 112 },
  { key: 'Total_Amount', title: 'T_Sale', width: 74, align: 'right' },
  { key: 'D_Sale', title: 'D_Sale', width: 74, align: 'right' },
  { key: 'A_Sale', title: 'A_Sale', width: 74, align: 'right' },
  { key: 'Commision', title: 'Comm', width: 70, align: 'right' },
  { key: 'O_Dara', title: 'O_Dara', width: 70, align: 'right' },
  { key: 'O_Akhar', title: 'O_Akhar', width: 74, align: 'right' },
  { key: 'WinAmount', title: 'WinAmt', width: 74, align: 'right' },
  { key: 'Pati', title: 'Hissa', width: 70, align: 'right' },
  { key: 'Balance', title: 'Balance', width: 82, align: 'right', bold: true, color: (r) => ((parseFloat(r.Balance) || 0) < 0 ? colors.danger : colors.success) },
];

// The 11-column per-game breakdown (divGameHisabHistory) shown on Hisab,
// Balance and Balance Sheet. `truncate` mirrors pages that cast to int.
export default function GameHistorySheet({ visible, onClose, title, rows, loading, truncate }) {
  const sum = (k) => (rows || []).reduce((s, r) => s + (parseFloat(r[k]) || 0), 0);
  const fmt = (v) => (truncate ? fmtNum(Math.trunc(v), 0) : fmtNum(v, 2));
  const footer = rows && rows.length ? {
    GameName: '–', Rates: 'Total',
    ...Object.fromEntries(COLS.slice(2).map((c) => [c.key, fmt(sum(c.key))])),
  } : null;
  const columns = COLS.map((c) => (c.align === 'right' ? { ...c, render: (r) => fmt(parseFloat(r[c.key]) || 0) } : c));
  return (
    <Sheet visible={visible} onClose={onClose} title={title || 'Game Hisab History'}>
      {loading ? <Loading inline /> : (
        <>
          <DataTable scroll columns={columns} rows={rows || []} footer={footer} dense />
          {rows && rows.length ? (
            <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.muted, fontSize: font.sm }}>{rows.length} game{rows.length === 1 ? '' : 's'}</Text>
              <Text style={{ fontWeight: weight.heavy, color: sum('Balance') < 0 ? colors.danger : colors.success }}>Balance {fmt(sum('Balance'))}</Text>
            </View>
          ) : null}
        </>
      )}
    </Sheet>
  );
}
