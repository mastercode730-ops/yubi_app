import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, font, radius, shadowStrong, weight } from '../theme';

// Every mounted host receives toasts: the root one plus one inside each open
// bottom sheet (native modals would otherwise cover the root host).
const listeners = new Set();

// toast('Saved!') / toast('Wrong input', 'error') — usable outside components.
export function toast(message, type = 'success', duration = 2600) {
  if (!message) return;
  const t = { message: String(message), type, duration, id: Date.now() + Math.random() };
  if (type === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  listeners.forEach((fn) => fn(t));
}

const ICON = { success: 'checkmark-circle', error: 'alert-circle', info: 'information-circle', warning: 'warning' };
const TINT = { success: colors.success, error: colors.danger, info: colors.info, warning: colors.warning };

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState(null);
  const [anim] = useState(() => new Animated.Value(0));
  const timer = useRef(null);

  useEffect(() => {
    const listener = (t) => {
      clearTimeout(timer.current);
      setItem(t);
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8, tension: 80 }).start();
      timer.current = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setItem(null));
      }, t.duration);
    };
    listeners.add(listener);
    return () => { listeners.delete(listener); clearTimeout(timer.current); };
  }, [anim]);

  if (!item) return null;
  const tint = TINT[item.type] || colors.info;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 10 }]}>
      <Animated.View
        style={[styles.toast, {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
        }]}
      >
        <View style={[styles.iconWrap, { backgroundColor: tint }]}>
          <Ionicons name={ICON[item.type] || ICON.info} size={18} color="#fff" />
        </View>
        <Text style={styles.text} numberOfLines={4}>{item.message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 14, right: 14, alignItems: 'center', zIndex: 9999, elevation: 30 },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 520, width: '100%',
    backgroundColor: '#1D2135', paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.md,
    ...shadowStrong,
  },
  iconWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, color: '#fff', fontSize: font.base, fontWeight: weight.medium, lineHeight: 19 },
});
