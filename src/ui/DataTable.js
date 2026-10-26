import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space, weight } from '../theme';

/**
 * columns: [{ key, title, width?, flex?, align?, render?(row,i), color?(row), bold? }]
 * Fixed-width columns + `scroll` → horizontally scrollable wide table.
 * Flex columns → fits the screen width.
 * footer: { [key]: value } rendered as a totals row.
 */
export default function DataTable({ columns, rows, footer, onRowPress, selectedIndex, emptyText = 'No Data Found!', scroll, dense, style, rowKey }) {
  const cellStyle = (c) => [
    styles.cell,
    dense && { paddingVertical: 7 },
    c.width ? { width: c.width } : { flex: c.flex || 1 },
    { alignItems: c.align === 'right' ? 'flex-end' : c.align === 'center' ? 'center' : 'flex-start' },
  ];
  const textAlign = (c) => ({ textAlign: c.align || 'left' });

  const table = (
    <View style={scroll ? null : { flex: 1 }}>
      <View style={[styles.row, styles.head]}>
        {columns.map((c) => (
          <View key={c.key} style={cellStyle(c)}>
            {React.isValidElement(c.title) ? c.title : <Text style={[styles.headText, textAlign(c)]} numberOfLines={1}>{c.title}</Text>}
          </View>
        ))}
      </View>
      {(!rows || rows.length === 0) ? (
        <View style={styles.empty}><Text style={styles.emptyText}>{emptyText}</Text></View>
      ) : rows.map((r, i) => {
        const sel = selectedIndex === i;
        const base = [styles.row, i % 2 === 1 && styles.zebra, sel && styles.sel];
        const cells = columns.map((c) => {
              const content = c.render ? c.render(r, i) : r[c.key];
              return (
                <View key={c.key} style={cellStyle(c)}>
                  {React.isValidElement(content) ? content : (
                    <Text
                      style={[styles.cellText, textAlign(c), c.bold && { fontWeight: weight.bold }, c.color && { color: c.color(r) }, onRowPress && c.link && styles.link]}
                      numberOfLines={c.lines || 2}
                    >
                      {content === null || content === undefined || content === '' ? (c.blank ?? '') : String(content)}
                    </Text>
                  )}
                </View>
              );
            });
        const key = rowKey ? rowKey(r, i) : i;
        if (!onRowPress) return <View key={key} style={base}>{cells}</View>;
        return (
          <Pressable key={key} onPress={() => onRowPress(r, i)} style={({ pressed }) => [...base, pressed && { backgroundColor: colors.brandSoft }]}>
            {cells}
          </Pressable>
        );
      })}
      {footer && rows && rows.length ? (
        <View style={[styles.row, styles.foot]}>
          {columns.map((c) => {
            const f = footer[c.key];
            return (
              <View key={c.key} style={cellStyle(c)}>
                {React.isValidElement(f) ? f : <Text style={[styles.footText, textAlign(c)]} numberOfLines={1}>{f === undefined || f === null ? '' : String(f)}</Text>}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.wrap, style]}>
      {scroll ? <ScrollView horizontal showsHorizontalScrollIndicator bounces={false}>{table}</ScrollView> : table}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  head: { backgroundColor: '#F1F2F8' },
  zebra: { backgroundColor: '#FBFBFE' },
  sel: { backgroundColor: colors.brandSoft },
  foot: { backgroundColor: '#EEF0F8', borderBottomWidth: 0 },
  cell: { paddingHorizontal: 10, paddingVertical: 10, justifyContent: 'center' },
  headText: { fontSize: font.xs, fontWeight: weight.heavy, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.3 },
  cellText: { fontSize: font.sm, color: colors.text, fontVariant: ['tabular-nums'] },
  footText: { fontSize: font.sm, fontWeight: weight.heavy, color: colors.text, fontVariant: ['tabular-nums'] },
  link: { color: colors.brandText, fontWeight: weight.bold },
  empty: { padding: space.xl, alignItems: 'center' },
  emptyText: { color: colors.muted, fontSize: font.sm },
});
