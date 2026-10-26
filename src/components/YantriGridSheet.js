import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from '../ui/Sheet';
import { Button, Row, tap } from '../ui/kit';
import { YM_AADAR, YM_ANDER, YM_ROWS, ymLabel, ymNext, yantriGridMessage } from '../lib/entryEngine';
import { colors, font, space, weight } from '../theme';

const W = Dimensions.get('window').width;
const CELL = Math.floor((Math.min(W, 520) - space.lg * 2 - 9 * 4) / 10);

// Yantri entry modal from chat.html (buildYantriGrid / ymCalc / ymSend).
export default function YantriGridSheet({ visible, onClose, onSend, sending }) {
  const [vals, setVals] = useState({});
  const [upToDown, setUpToDown] = useState(true);
  const refs = useRef({});

  useEffect(() => {
    if (visible) {
      setVals({});
      setTimeout(() => refs.current[1]?.focus(), 350);
    }
  }, [visible]);

  const totals = useMemo(() => {
    const get = (n) => parseInt(vals[n] || 0, 10) || 0;
    const rows = YM_ROWS.map((r) => r.reduce((s, n) => s + get(n), 0));
    const cols = Array.from({ length: 10 }, (_, c) => YM_ROWS.reduce((s, r) => s + get(r[c]), 0));
    const aa = YM_AADAR.reduce((s, n) => s + get(n), 0);
    const an = YM_ANDER.reduce((s, n) => s + get(n), 0);
    return { rows, cols, aa, an, grand: rows.reduce((a, b) => a + b, 0) + aa + an };
  }, [vals]);

  const setVal = (n, t) => setVals((v) => ({ ...v, [n]: t.replace(/[^0-9]/g, '') }));
  const focusNext = (n) => { const nx = ymNext(n, upToDown); if (nx) refs.current[nx]?.focus(); };

  const cell = (n) => (
    <View key={n} style={styles.cell}>
      <Text style={styles.cellLabel}>{ymLabel(n)}</Text>
      <TextInput
        ref={(r) => { refs.current[n] = r; }}
        value={vals[n] || ''}
        onChangeText={(t) => setVal(n, t)}
        keyboardType="number-pad"
        maxLength={6}
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => focusNext(n)}
        selectTextOnFocus
        style={[styles.input, vals[n] ? styles.inputFilled : null]}
      />
    </View>
  );

  const send = () => {
    const { message, total } = yantriGridMessage(vals);
    if (!totals.grand) { onSend(null, 'Please fill some values'); return; }
    if (!message) { onSend(null, 'No data'); return; }
    onSend({ message, total });
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Yantri entry"
      subtitle="Enter amounts against numbers, then send as one entry"
      headerRight={(
        <Pressable onPress={() => { tap(); setVals({}); refs.current[1]?.focus(); }} style={styles.clearBtn}>
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
      )}
      footer={(
        <Row justify="space-between" gap={10}>
          <Pressable onPress={() => { tap(); setUpToDown((x) => !x); }} style={styles.udToggle}>
            <Ionicons name={upToDown ? 'checkbox' : 'square-outline'} size={20} color={colors.brand} />
            <Text style={styles.udText}>Up-To-Down</Text>
          </Pressable>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.totLabel}>Total Amount</Text>
            <Text style={styles.totVal}>{totals.grand}</Text>
          </View>
          <Button title="Send" icon="send" loading={sending} onPress={send} style={{ minWidth: 110 }} />
        </Row>
      )}
    >
      {YM_ROWS.map((row, ri) => (
        <View key={ri} style={{ marginBottom: 4 }}>
          <View style={styles.row}>{row.map(cell)}</View>
          {totals.rows[ri] ? <Text style={styles.rowTot}>Row {ri + 1}: {totals.rows[ri]}</Text> : null}
        </View>
      ))}
      <View style={[styles.row, { marginTop: 4 }]}>
        {totals.cols.map((t, i) => (
          <View key={i} style={styles.colTot}><Text style={styles.colTotText} numberOfLines={1} adjustsFontSizeToFit>{t}</Text></View>
        ))}
      </View>
      <Text style={styles.group}>Aadar (Bahar) · total {totals.aa}</Text>
      <View style={styles.row}>{YM_AADAR.map(cell)}</View>
      <Text style={styles.group}>Ander · total {totals.an}</Text>
      <View style={styles.row}>{YM_ANDER.map(cell)}</View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  cell: { width: CELL, alignItems: 'center' },
  cellLabel: { fontSize: 10, fontWeight: weight.heavy, color: colors.muted, marginBottom: 2 },
  input: { width: CELL, height: 34, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardAlt, textAlign: 'center', fontSize: 12.5, fontWeight: weight.bold, color: colors.text, paddingHorizontal: 0, paddingVertical: 0 },
  inputFilled: { borderColor: colors.brand, backgroundColor: colors.brandSoft, color: colors.brandText },
  rowTot: { alignSelf: 'flex-end', fontSize: 10.5, color: colors.success, fontWeight: weight.bold, marginTop: 1 },
  colTot: { width: CELL, height: 24, borderRadius: 6, backgroundColor: '#EEF0F8', alignItems: 'center', justifyContent: 'center' },
  colTotText: { fontSize: 11, fontWeight: weight.heavy, color: colors.textSoft },
  group: { fontSize: font.sm, fontWeight: weight.heavy, color: colors.textSoft, marginTop: space.md, marginBottom: 4 },
  clearBtn: { paddingHorizontal: 12, height: 34, borderRadius: 12, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  clearText: { color: colors.danger, fontWeight: weight.bold },
  udToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  udText: { fontWeight: weight.semi, color: colors.textSoft, fontSize: font.sm },
  totLabel: { fontSize: font.xs, color: colors.muted },
  totVal: { fontSize: font.xl, fontWeight: weight.heavy, color: colors.text },
});
