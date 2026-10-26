import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated, Dimensions, FlatList, KeyboardAvoidingView, Modal, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, space, weight } from '../theme';
import { Avatar, tap } from './kit';
import { ToastHost } from './Toast';
import { MONTHS, autoSlash, dateToDMY, isCompleteDMY, parseDMY, istNow } from '../lib/dates';

const SCREEN_H = Dimensions.get('window').height;

// Bottom sheet. `scroll` wraps children in a ScrollView.
export function Sheet({ visible, onClose, title, subtitle, children, footer, scroll = true, height, headerRight }) {
  const insets = useSafeAreaInsets();
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (visible) Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 9, tension: 70 }).start();
    else anim.setValue(0);
  }, [visible, anim]);
  return (
    <Modal visible={!!visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View
          style={[styles.sheet, {
            maxHeight: SCREEN_H * 0.92,
            height,
            paddingBottom: Math.max(insets.bottom, space.md),
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_H * 0.4, 0] }) }],
          }]}
        >
          <View style={styles.handle} />
          {title ? (
            <View style={styles.sheetHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle} numberOfLines={2}>{title}</Text>
                {subtitle ? <Text style={styles.sheetSub} numberOfLines={2}>{subtitle}</Text> : null}
              </View>
              {headerRight}
              <Pressable hitSlop={10} onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.textSoft} />
              </Pressable>
            </View>
          ) : null}
          {scroll ? (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.md }} style={{ flexGrow: 0 }}>
              {children}
            </ScrollView>
          ) : (
            <View style={{ flexShrink: 1, flexGrow: height ? 1 : 0 }}>{children}</View>
          )}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
      <ToastHost />
    </Modal>
  );
}

// Searchable list sheet. options: [{ value, label, sub }]
export function SelectSheet({ visible, onClose, title, options, value, onSelect, searchable = true, placeholder = 'Search…', avatars, emptyText = 'No match found', allowClear, clearLabel = 'None' }) {
  const [q, setQ] = useState('');
  useEffect(() => { if (visible) setQ(''); }, [visible]);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return options || [];
    return (options || []).filter((o) => String(o.label || '').toLowerCase().includes(t) || String(o.sub || '').toLowerCase().includes(t) || String(o.value || '').toLowerCase() === t);
  }, [q, options]);
  const data = allowClear ? [{ value: '', label: clearLabel, __clear: true }, ...filtered] : filtered;
  return (
    <Sheet visible={visible} onClose={onClose} title={title} scroll={false} height={searchable ? SCREEN_H * 0.8 : undefined}>
      {searchable ? (
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={17} color={colors.faint} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={placeholder}
            placeholderTextColor={colors.faint}
            style={styles.searchInput}
            autoCorrect={false}
            autoFocus={false}
          />
          {q ? <Pressable onPress={() => setQ('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.faint} /></Pressable> : null}
        </View>
      ) : null}
      {searchable ? <Text style={styles.count}>{filtered.length} {filtered.length === 1 ? 'item' : 'items'}</Text> : null}
      <FlatList
        data={data}
        keyExtractor={(o, i) => `${o.value}-${i}`}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={30}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space.lg }}
        ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
        renderItem={({ item }) => {
          const sel = String(item.value) === String(value ?? '');
          return (
            <Pressable
              onPress={() => { tap(); onSelect(item.__clear ? null : item); onClose(); }}
              style={({ pressed }) => [styles.option, sel && styles.optionSel, pressed && { backgroundColor: colors.cardAlt }]}
            >
              {avatars && !item.__clear ? <Avatar name={item.label} size={36} /> : null}
              <View style={{ flex: 1, marginLeft: avatars && !item.__clear ? 12 : 0 }}>
                <Text style={[styles.optionText, item.__clear && { color: colors.muted }]} numberOfLines={1}>{item.label}</Text>
                {item.sub ? <Text style={styles.optionSub} numberOfLines={1}>{item.sub}</Text> : null}
              </View>
              {sel ? <Ionicons name="checkmark-circle" size={20} color={colors.brand} /> : null}
            </Pressable>
          );
        }}
      />
    </Sheet>
  );
}

// Pressable field that opens a SelectSheet.
export function SelectField({ label, value, options, onChange, placeholder = 'Select…', title, searchable, avatars, style, compact, allowClear, clearLabel, disabled, icon }) {
  const [open, setOpen] = useState(false);
  const selected = (options || []).find((o) => String(o.value) === String(value ?? ''));
  return (
    <View style={[{ marginBottom: compact ? 0 : space.md }, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        disabled={disabled}
        onPress={() => { tap(); setOpen(true); }}
        style={({ pressed }) => [styles.selectBox, compact && { height: 42 }, pressed && { borderColor: colors.brand }, disabled && { opacity: 0.5 }]}
      >
        {icon ? <Ionicons name={icon} size={17} color={colors.faint} style={{ marginRight: 8 }} /> : null}
        <Text style={[styles.selectText, !selected && { color: colors.faint }]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={17} color={colors.faint} />
      </Pressable>
      <SelectSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={title || label || placeholder}
        options={options}
        value={value}
        searchable={searchable ?? (options || []).length > 8}
        avatars={avatars}
        allowClear={allowClear}
        clearLabel={clearLabel}
        onSelect={(o) => onChange(o ? o.value : '', o)}
      />
    </View>
  );
}

/* ───────────── Dates ───────────── */

const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function CalendarSheet({ visible, onClose, value, onSelect, title = 'Select date' }) {
  const initial = value && isCompleteDMY(value) ? parseDMY(value) : (() => { const n = istNow(); return new Date(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()); })();
  const [cursor, setCursor] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [typed, setTyped] = useState(value || '');
  useEffect(() => {
    if (visible) {
      const d = value && isCompleteDMY(value) ? parseDMY(value) : initial;
      setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
      setTyped(value || '');
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const lead = first.getDay();
    const count = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= count; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [cursor]);

  const selDMY = value && isCompleteDMY(value) ? value : '';
  const todayDMY = (() => { const n = istNow(); return dateToDMY(new Date(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())); })();
  const pick = (d) => { onSelect(dateToDMY(d)); onClose(); };
  const shift = (m) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + m, 1));

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.typedRow}>
        <Ionicons name="create-outline" size={17} color={colors.faint} />
        <TextInput
          value={typed}
          onChangeText={(t) => {
            const f = autoSlash(t, typed);
            setTyped(f);
            if (isCompleteDMY(f)) {
              const d = parseDMY(f);
              setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
            }
          }}
          placeholder="dd/mm/yyyy"
          placeholderTextColor={colors.faint}
          keyboardType="number-pad"
          maxLength={10}
          style={styles.typedInput}
          onSubmitEditing={() => { if (isCompleteDMY(typed)) { onSelect(typed); onClose(); } }}
        />
        <Pressable
          disabled={!isCompleteDMY(typed)}
          onPress={() => { onSelect(typed); onClose(); }}
          style={[styles.typedGo, !isCompleteDMY(typed) && { opacity: 0.35 }]}
        >
          <Text style={{ color: '#fff', fontWeight: weight.bold }}>Set</Text>
        </Pressable>
      </View>
      <View style={styles.calHead}>
        <Pressable onPress={() => shift(-12)} hitSlop={8} style={styles.calNav}><Ionicons name="play-back" size={14} color={colors.textSoft} /></Pressable>
        <Pressable onPress={() => shift(-1)} hitSlop={8} style={styles.calNav}><Ionicons name="chevron-back" size={18} color={colors.textSoft} /></Pressable>
        <Text style={styles.calTitle}>{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</Text>
        <Pressable onPress={() => shift(1)} hitSlop={8} style={styles.calNav}><Ionicons name="chevron-forward" size={18} color={colors.textSoft} /></Pressable>
        <Pressable onPress={() => shift(12)} hitSlop={8} style={styles.calNav}><Ionicons name="play-forward" size={14} color={colors.textSoft} /></Pressable>
      </View>
      <View style={styles.week}>{WEEK.map((w, i) => <Text key={i} style={styles.weekText}>{w}</Text>)}</View>
      <View style={styles.grid}>
        {days.map((d, i) => {
          if (!d) return <View key={i} style={styles.day} />;
          const dmy = dateToDMY(d);
          const sel = dmy === selDMY;
          const today = dmy === todayDMY;
          return (
            <Pressable key={i} onPress={() => { tap(); pick(d); }} style={styles.day}>
              <View style={[styles.dayInner, today && styles.dayToday, sel && styles.daySel]}>
                <Text style={[styles.dayText, today && { color: colors.brandText }, sel && { color: '#fff' }]}>{d.getDate()}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.quickRow}>
        {[['Today', 0], ['Yesterday', -1]].map(([l, off]) => (
          <Pressable key={l} style={styles.quick} onPress={() => { const n = istNow(); pick(new Date(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + off)); }}>
            <Text style={styles.quickText}>{l}</Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

// Compact date button used in filters/headers. value/onChange are dd/mm/yyyy.
export function DateField({ label, value, onChange, style, compact, title, light }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[{ marginBottom: compact ? 0 : space.md }, style]}>
      {label ? <Text style={[styles.label, light && { color: 'rgba(255,255,255,0.85)' }]}>{label}</Text> : null}
      <Pressable
        onPress={() => { tap(); setOpen(true); }}
        style={({ pressed }) => [styles.selectBox, compact && { height: 42 }, light && styles.lightBox, pressed && { borderColor: colors.brand }]}
      >
        <Ionicons name="calendar-outline" size={17} color={light ? '#fff' : colors.brand} style={{ marginRight: 8 }} />
        <Text style={[styles.selectText, light && { color: '#fff' }, !value && { color: colors.faint }]} numberOfLines={1}>{value || 'dd/mm/yyyy'}</Text>
      </Pressable>
      <CalendarSheet visible={open} onClose={() => setOpen(false)} value={value} onSelect={onChange} title={title || label || 'Select date'} />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingTop: 8 },
  handle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, marginBottom: 6 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingBottom: space.md, gap: 8 },
  sheetTitle: { fontSize: font.lg, fontWeight: weight.heavy, color: colors.text },
  sheetSub: { fontSize: font.sm, color: colors.muted, marginTop: 2 },
  closeBtn: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: space.lg, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },

  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: space.lg, height: 44, borderRadius: radius.md, backgroundColor: colors.cardAlt, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text, paddingVertical: 0 },
  count: { fontSize: font.xs, color: colors.muted, marginHorizontal: space.lg, marginTop: 8, marginBottom: 2 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, borderRadius: radius.sm },
  optionSel: { backgroundColor: colors.brandSoft },
  optionText: { fontSize: font.md, color: colors.text, fontWeight: weight.semi },
  optionSub: { fontSize: font.sm, color: colors.muted, marginTop: 1 },
  empty: { textAlign: 'center', color: colors.muted, padding: 24 },

  label: { fontSize: font.sm, fontWeight: weight.semi, color: colors.textSoft, marginBottom: 6 },
  selectBox: { height: 48, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 },
  lightBox: { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.25)' },
  selectText: { flex: 1, fontSize: font.md, color: colors.text, fontWeight: weight.medium },

  typedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingLeft: 12, paddingRight: 4, marginBottom: space.md },
  typedInput: { flex: 1, fontSize: font.md, color: colors.text, fontVariant: ['tabular-nums'] },
  typedGo: { backgroundColor: colors.brand, height: 36, paddingHorizontal: 16, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  calNav: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  calTitle: { flex: 1, textAlign: 'center', fontSize: font.lg, fontWeight: weight.heavy, color: colors.text },
  week: { flexDirection: 'row' },
  weekText: { flex: 1, textAlign: 'center', fontSize: font.xs, color: colors.muted, fontWeight: weight.bold, paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  day: { width: `${100 / 7}%`, aspectRatio: 1, padding: 3 },
  dayInner: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dayToday: { backgroundColor: colors.brandSoft },
  daySel: { backgroundColor: colors.brand },
  dayText: { fontSize: font.md, color: colors.text, fontWeight: weight.semi },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: space.sm },
  quick: { flex: 1, height: 40, borderRadius: radius.md, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  quickText: { fontWeight: weight.bold, color: colors.textSoft },
});
