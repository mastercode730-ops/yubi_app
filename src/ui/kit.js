import React, { forwardRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Pressable, RefreshControl, ScrollView,
  StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { avatarColor, colors, font, gradients, radius, shadow, space, weight } from '../theme';
import { fmtNum, initials } from '../lib/format';

export const tap = () => Haptics.selectionAsync().catch(() => {});

/* ───────────── Layout ───────────── */

export function Screen({ children, scroll, refreshing, onRefresh, style, contentStyle, keyboard = true, padded = true, bottomInset = true }) {
  const insets = useSafeAreaInsets();
  const pad = padded ? space.lg : 0;
  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[{ padding: pad, paddingBottom: (bottomInset ? insets.bottom : 0) + space.xxl }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
  );
  const inner = <View style={[styles.screen, style]}>{body}</View>;
  if (!keyboard) return inner;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior="padding" keyboardVerticalOffset={0}>
      {inner}
    </KeyboardAvoidingView>
  );
}

export function Header({ title, subtitle, back = true, onBack, right, variant = 'plain', children, compact }) {
  const insets = useSafeAreaInsets();
  const goBack = onBack || (() => (router.canGoBack() ? router.back() : router.replace('/home')));
  const brand = variant === 'brand';
  const content = (
    <View style={{ paddingTop: insets.top + (compact ? 4 : 8), paddingHorizontal: space.md, paddingBottom: children ? space.md : space.sm }}>
      <View style={styles.headerRow}>
        {back ? (
          <Pressable hitSlop={10} onPress={goBack} style={[styles.headerBtn, brand && styles.headerBtnBrand]}>
            <Ionicons name="chevron-back" size={22} color={brand ? '#fff' : colors.text} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1, marginLeft: back ? space.sm : space.xs }}>
          <Text style={[styles.headerTitle, brand && { color: '#fff' }]} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={[styles.headerSub, brand && { color: 'rgba(255,255,255,0.8)' }]} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.headerRight}>{right}</View> : null}
      </View>
      {children}
    </View>
  );
  if (brand) return <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>{content}</LinearGradient>;
  return <View style={styles.headerPlain}>{content}</View>;
}

export function HeaderAction({ icon, onPress, brand, label, badge }) {
  return (
    <Pressable hitSlop={8} onPress={() => { tap(); onPress && onPress(); }} style={[styles.headerBtn, brand && styles.headerBtnBrand, label && { paddingHorizontal: 10, width: 'auto' }]}>
      <Ionicons name={icon} size={20} color={brand ? '#fff' : colors.text} />
      {label ? <Text numberOfLines={1} style={{ marginLeft: 4, fontWeight: weight.semi, color: brand ? '#fff' : colors.text, fontSize: font.sm }}>{label}</Text> : null}
      {badge ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

export function Card({ children, style, onPress, padded = true, flat }) {
  const s = [styles.card, padded && { padding: space.lg }, flat && styles.cardFlat, style];
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [...s, pressed && { opacity: 0.85, transform: [{ scale: 0.995 }] }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={s}>{children}</View>;
}

export function SectionTitle({ title, right, style, hint }) {
  return (
    <View style={[styles.sectionTitle, style]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionText}>{title}</Text>
        {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export const Divider = ({ style }) => <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }, style]} />;

export const Gap = ({ h = space.md, w }) => <View style={{ height: h, width: w }} />;

export function Row({ children, style, gap = space.sm, wrap, align = 'center', justify }) {
  return <View style={[{ flexDirection: 'row', alignItems: align, gap, flexWrap: wrap ? 'wrap' : 'nowrap', justifyContent: justify }, style]}>{children}</View>;
}

/* ───────────── Controls ───────────── */

const BTN = {
  primary: { bg: colors.brand, fg: '#fff' },
  secondary: { bg: colors.brandSoft, fg: colors.brandText },
  outline: { bg: colors.card, fg: colors.text, border: colors.borderStrong },
  ghost: { bg: 'transparent', fg: colors.brandText },
  danger: { bg: colors.danger, fg: '#fff' },
  dangerSoft: { bg: colors.dangerSoft, fg: colors.danger },
  success: { bg: colors.success, fg: '#fff' },
  successSoft: { bg: colors.successSoft, fg: colors.success },
  dark: { bg: '#1D2135', fg: '#fff' },
};

export function Button({ title, onPress, variant = 'primary', size = 'md', icon, iconRight, loading, disabled, style, full, textStyle }) {
  const v = BTN[variant] || BTN.primary;
  const h = size === 'sm' ? 36 : size === 'lg' ? 54 : 46;
  const fs = size === 'sm' ? font.sm : size === 'lg' ? font.md : font.base;
  return (
    <Pressable
      onPress={() => { if (loading || disabled) return; tap(); onPress && onPress(); }}
      style={({ pressed }) => [
        styles.btn,
        { height: h, backgroundColor: v.bg, borderColor: v.border || v.bg, paddingHorizontal: size === 'sm' ? 12 : 18 },
        v.border && { borderWidth: 1 },
        full && { alignSelf: 'stretch' },
        (disabled) && { opacity: 0.45 },
        pressed && !disabled && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={v.fg} size="small" /> : (
        <>
          {icon ? <Ionicons name={icon} size={fs + 4} color={v.fg} /> : null}
          {title ? <Text style={[{ color: v.fg, fontSize: fs, fontWeight: weight.bold }, textStyle]} numberOfLines={1}>{title}</Text> : null}
          {iconRight ? <Ionicons name={iconRight} size={fs + 4} color={v.fg} /> : null}
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, onPress, color = colors.text, bg = colors.cardAlt, size = 38, iconSize = 19, style, disabled }) {
  return (
    <Pressable
      hitSlop={6}
      disabled={disabled}
      onPress={() => { tap(); onPress && onPress(); }}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2.6, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }, style]}
    >
      <Ionicons name={icon} size={iconSize} color={color} />
    </Pressable>
  );
}

export const Field = forwardRef(function Field(
  { label, icon, right, error, secure, style, inputStyle, compact, hint, containerStyle, editable = true, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  return (
    <View style={[{ marginBottom: compact ? 0 : space.md }, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.field, compact && { height: 42 }, focused && styles.fieldFocused, error && { borderColor: colors.danger }, !editable && { backgroundColor: colors.cardAlt }, style, props.multiline && { height: undefined, minHeight: 90, alignItems: 'flex-start', paddingVertical: 10 }]}>
        {icon ? <Ionicons name={icon} size={18} color={focused ? colors.brand : colors.faint} style={{ marginRight: 8 }} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.faint}
          style={[styles.input, inputStyle]}
          secureTextEntry={secure && hidden}
          editable={editable}
          onFocus={(e) => { setFocused(true); props.onFocus && props.onFocus(e); }}
          onBlur={(e) => { setFocused(false); props.onBlur && props.onBlur(e); }}
          autoCorrect={false}
          {...props}
        />
        {secure ? (
          <Pressable hitSlop={10} onPress={() => setHidden((h) => !h)}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={19} color={colors.faint} />
          </Pressable>
        ) : null}
        {right}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
});

export function Chip({ label, selected, onPress, icon, count, small, tone = 'brand', style }) {
  const sel = selected;
  const bg = sel ? (tone === 'dark' ? '#1D2135' : colors.brand) : colors.card;
  return (
    <Pressable
      onPress={() => { tap(); onPress && onPress(); }}
      style={({ pressed }) => [styles.chip, small && { height: 30, paddingHorizontal: 10 }, { backgroundColor: bg, borderColor: sel ? bg : colors.border }, pressed && { opacity: 0.8 }, style]}
    >
      {icon ? <Ionicons name={icon} size={small ? 13 : 15} color={sel ? '#fff' : colors.textSoft} /> : null}
      <Text style={[styles.chipText, small && { fontSize: font.xs }, { color: sel ? '#fff' : colors.textSoft }]} numberOfLines={1}>{label}</Text>
      {count ? (
        <View style={[styles.chipCount, { backgroundColor: sel ? 'rgba(255,255,255,0.25)' : colors.danger }]}>
          <Text style={styles.chipCountText}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Segmented({ options, value, onChange, style, small }) {
  return (
    <View style={[styles.segment, style]}>
      {options.map((o) => {
        const sel = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => { if (!sel) { tap(); onChange(o.key); } }} style={[styles.segmentItem, small && { paddingVertical: 6 }, sel && styles.segmentItemSel]}>
            {o.icon ? <Ionicons name={o.icon} size={14} color={sel ? colors.brandText : colors.muted} style={{ marginRight: 4 }} /> : null}
            <Text style={[styles.segmentText, small && { fontSize: font.xs }, sel && { color: colors.brandText }]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SwitchRow({ label, value, onValueChange, description, style, disabled }) {
  return (
    <View style={[styles.switchRow, style]}>
      <View style={{ flex: 1, paddingRight: space.md }}>
        <Text style={styles.switchLabel}>{label}</Text>
        {description ? <Text style={styles.hint}>{description}</Text> : null}
      </View>
      <Switch
        value={!!value}
        disabled={disabled}
        onValueChange={(v) => { tap(); onValueChange(v); }}
        trackColor={{ true: colors.brand, false: colors.borderStrong }}
        thumbColor="#fff"
        ios_backgroundColor={colors.borderStrong}
      />
    </View>
  );
}

export function CheckRow({ label, checked, onPress, sub, style }) {
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => [styles.checkRow, pressed && { backgroundColor: colors.cardAlt }, style]}>
      <View style={[styles.checkbox, checked && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
        {checked ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.checkLabel} numberOfLines={1}>{label}</Text>
        {sub ? <Text style={styles.hint} numberOfLines={1}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

/* ───────────── Display ───────────── */

const TONES = {
  brand: [colors.brandSoft, colors.brandText],
  success: [colors.successSoft, colors.success],
  danger: [colors.dangerSoft, colors.danger],
  warning: [colors.warningSoft, colors.warning],
  info: [colors.infoSoft, colors.info],
  neutral: [colors.cardAlt, colors.muted],
  solid: [colors.danger, '#fff'],
};

export function Badge({ text, tone = 'brand', icon, style }) {
  const [bg, fg] = TONES[tone] || TONES.brand;
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      {icon ? <Ionicons name={icon} size={12} color={fg} style={{ marginRight: 3 }} /> : null}
      <Text style={[styles.badgeText, { color: fg }]} numberOfLines={1}>{text}</Text>
    </View>
  );
}

export function CountBadge({ count, style }) {
  if (!count) return null;
  return (
    <View style={[styles.countBadge, style]}>
      <Text style={styles.countText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

export function Avatar({ name, size = 44, seed }) {
  const c = avatarColor(seed || name);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2.4, backgroundColor: c + '1F', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: c, fontWeight: weight.heavy, fontSize: size * 0.36 }}>{initials(name)}</Text>
    </View>
  );
}

export function ListRow({ title, subtitle, meta, left, right, onPress, onLongPress, chevron = true, style, titleStyle }) {
  return (
    <Pressable
      onPress={onPress ? () => { tap(); onPress(); } : undefined}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.listRow, pressed && onPress && { backgroundColor: colors.cardAlt }, style]}
    >
      {left}
      <View style={{ flex: 1, marginLeft: left ? space.md : 0 }}>
        <Text style={[styles.rowTitle, titleStyle]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub} numberOfLines={1}>{subtitle}</Text> : null}
        {meta ? <Text style={styles.rowMeta} numberOfLines={1}>{meta}</Text> : null}
      </View>
      {right}
      {onPress && chevron ? <Ionicons name="chevron-forward" size={18} color={colors.faint} style={{ marginLeft: 6 }} /> : null}
    </Pressable>
  );
}

export function EmptyState({ icon = 'file-tray-outline', title = 'Nothing here', message, action, style }) {
  return (
    <View style={[styles.empty, style]}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={30} color={colors.brand} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMsg}>{message}</Text> : null}
      {action ? <View style={{ marginTop: space.md }}>{action}</View> : null}
    </View>
  );
}

export function Loading({ text = 'Loading…', style, inline }) {
  return (
    <View style={[inline ? { paddingVertical: space.xl, alignItems: 'center' } : styles.loading, style]}>
      <ActivityIndicator color={colors.brand} size={inline ? 'small' : 'large'} />
      {text ? <Text style={{ marginTop: space.sm, color: colors.muted, fontSize: font.sm }}>{text}</Text> : null}
    </View>
  );
}

export function StatTile({ label, value, tone = 'neutral', icon, style, onPress, sub }) {
  const [bg, fg] = tone === 'neutral' ? [colors.card, colors.text] : TONES[tone] || TONES.brand;
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap onPress={onPress} style={[styles.stat, { backgroundColor: bg }, tone === 'neutral' && styles.statBorder, style]}>
      <Row gap={6}>
        {icon ? <Ionicons name={icon} size={14} color={tone === 'neutral' ? colors.muted : fg} /> : null}
        <Text style={[styles.statLabel, tone !== 'neutral' && { color: fg, opacity: 0.85 }]} numberOfLines={1}>{label}</Text>
      </Row>
      <Text style={[styles.statValue, { color: fg }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {sub ? <Text style={[styles.statLabel, { marginTop: 2 }]} numberOfLines={1}>{sub}</Text> : null}
    </Wrap>
  );
}

// Signed amount: green for positive, red for negative (matches web pos/neg cells).
export function Amount({ value, decimals = 0, style, plain, prefix = '' }) {
  const v = parseFloat(value) || 0;
  const color = plain ? colors.text : v < 0 ? colors.danger : v > 0 ? colors.success : colors.muted;
  return <Text style={[{ color, fontWeight: weight.bold, fontVariant: ['tabular-nums'] }, style]}>{prefix}{fmtNum(decimals ? v : Math.trunc(v), decimals)}</Text>;
}

export function KeyValue({ label, value, valueStyle, style }) {
  return (
    <View style={[styles.kv, style]}>
      <Text style={styles.kvLabel}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number'
        ? <Text style={[styles.kvValue, valueStyle]}>{value}</Text>
        : value}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  headerPlain: { backgroundColor: colors.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  headerRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  headerBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardAlt, flexDirection: 'row' },
  headerBtnBrand: { backgroundColor: 'rgba(255,255,255,0.16)' },
  headerTitle: { fontSize: font.xl, fontWeight: weight.heavy, color: colors.text, letterSpacing: -0.3 },
  headerSub: { fontSize: font.sm, color: colors.muted, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 },
  dot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },

  card: { backgroundColor: colors.card, borderRadius: radius.lg, ...shadow, marginBottom: space.md },
  cardFlat: { shadowOpacity: 0, elevation: 0, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm, marginBottom: space.sm },
  sectionText: { fontSize: font.md, fontWeight: weight.heavy, color: colors.text, letterSpacing: -0.2 },
  sectionHint: { fontSize: font.xs, color: colors.muted, marginTop: 1 },

  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md },

  label: { fontSize: font.sm, fontWeight: weight.semi, color: colors.textSoft, marginBottom: 6 },
  field: { height: 48, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 },
  fieldFocused: { borderColor: colors.brand, backgroundColor: '#FCFCFF' },
  input: { flex: 1, fontSize: font.md, color: colors.text, paddingVertical: 0 },
  error: { color: colors.danger, fontSize: font.xs, marginTop: 4 },
  hint: { color: colors.muted, fontSize: font.xs, marginTop: 3 },

  chip: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipText: { fontSize: font.sm, fontWeight: weight.semi },
  chipCount: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  chipCountText: { color: '#fff', fontSize: 10, fontWeight: weight.bold },

  segment: { flexDirection: 'row', backgroundColor: '#E9EBF3', borderRadius: radius.md, padding: 3 },
  segmentItem: { flex: 1, flexDirection: 'row', paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  segmentItemSel: { backgroundColor: colors.card, ...shadow },
  segmentText: { fontSize: font.sm, fontWeight: weight.semi, color: colors.muted },

  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  switchLabel: { fontSize: font.base, fontWeight: weight.semi, color: colors.text },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 4, borderRadius: radius.sm },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  checkLabel: { fontSize: font.base, color: colors.text, fontWeight: weight.medium },

  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { fontSize: font.xs, fontWeight: weight.bold },
  countBadge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#fff', fontSize: 11, fontWeight: weight.heavy },

  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: space.lg, backgroundColor: colors.card },
  rowTitle: { fontSize: font.md, fontWeight: weight.bold, color: colors.text },
  rowSub: { fontSize: font.sm, color: colors.muted, marginTop: 2 },
  rowMeta: { fontSize: font.xs, color: colors.faint, marginTop: 2 },

  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: font.md, fontWeight: weight.bold, color: colors.text },
  emptyMsg: { fontSize: font.sm, color: colors.muted, textAlign: 'center', marginTop: 4, lineHeight: 18 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },

  stat: { flex: 1, borderRadius: radius.md, padding: 12, minHeight: 72, justifyContent: 'space-between' },
  statBorder: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  statLabel: { fontSize: font.xs, color: colors.muted, fontWeight: weight.semi },
  statValue: { fontSize: font.xl, fontWeight: weight.heavy, marginTop: 4, fontVariant: ['tabular-nums'] },

  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9 },
  kvLabel: { fontSize: font.base, color: colors.muted },
  kvValue: { fontSize: font.base, color: colors.text, fontWeight: weight.bold },
});

export { styles as kitStyles };
