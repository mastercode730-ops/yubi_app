import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import { MENU_SECTIONS, SUPPORT_WHATSAPP, visibleItems } from '../../auth/menu';
import { Avatar, Button, tap } from '../../ui/kit';
import { Sheet } from '../../ui/Sheet';
import { colors, font, radius, shadow, space, weight } from '../../theme';

const GAP = 10;

export default function Menu() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tileW = Math.floor((Math.min(width, 600) - space.lg * 2 - GAP * 2) / 3);
  const auth = useAuth();
  const { user, displayName, roleLabel, logout } = auth;
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.lg, paddingBottom: space.xxl }}>
        <Text style={styles.title}>Menu</Text>
        <View style={styles.profile}>
          <Avatar name={displayName} size={54} />
          <View style={{ flex: 1, marginLeft: space.md }}>
            <Text style={styles.pName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.pRole}>{roleLabel}</Text>
            {user?.UID ? <Text style={styles.pMeta}>Account #{user.UID}{user?.Mobile && user.Mobile !== displayName ? ` · ${user.Mobile}` : ''}</Text> : null}
          </View>
        </View>

        <View style={styles.quick}>
          <Pressable style={styles.quickBtn} onPress={() => { tap(); router.push('/home'); }}>
            <Ionicons name="home" size={18} color={colors.brand} />
            <Text style={styles.quickText}>Dashboard</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => { tap(); Linking.openURL(SUPPORT_WHATSAPP).catch(() => {}); }}>
            <Ionicons name="logo-whatsapp" size={18} color="#1FAF54" />
            <Text style={styles.quickText}>Support</Text>
          </Pressable>
        </View>

        {MENU_SECTIONS.map((section) => {
          const items = visibleItems(section, auth);
          if (!items.length) return null;
          return (
            <View key={section.title} style={{ marginTop: space.lg }}>
              <Text style={styles.section}>{section.title}</Text>
              <View style={styles.grid}>
                {items.map((it) => (
                  <Pressable
                    key={it.key}
                    onPress={() => { tap(); router.push(it.route); }}
                    style={({ pressed }) => [styles.tile, { width: tileW }, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
                  >
                    <View style={[styles.tileIcon, { backgroundColor: it.tint + '1A' }]}>
                      <Ionicons name={it.icon} size={22} color={it.tint} />
                    </View>
                    <Text style={styles.tileText} numberOfLines={2}>{it.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}

        <Button title="Logout" icon="log-out-outline" variant="dangerSoft" onPress={() => setConfirm(true)} style={{ marginTop: space.xxl }} />
        <Text style={styles.version}>Yubi7 · v{Constants.expoConfig?.version || '1.0.0'}</Text>
      </ScrollView>

      <Sheet
        visible={confirm}
        onClose={() => setConfirm(false)}
        title="Log out?"
        subtitle="You will need your mobile number / staff ID and password to sign in again."
        footer={(
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Stay" variant="outline" onPress={() => setConfirm(false)} style={{ flex: 1 }} />
            <Button title="Logout" variant="danger" loading={busy} onPress={async () => { setBusy(true); await logout(); setBusy(false); setConfirm(false); }} style={{ flex: 1.3 }} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: font.xxl, fontWeight: weight.heavy, color: colors.text, marginBottom: space.md, letterSpacing: -0.5 },
  profile: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, ...shadow },
  pName: { fontSize: font.lg, fontWeight: weight.heavy, color: colors.text },
  pRole: { fontSize: font.sm, color: colors.brandText, fontWeight: weight.bold, marginTop: 2 },
  pMeta: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
  quick: { flexDirection: 'row', gap: 10, marginTop: space.md },
  quickBtn: { flex: 1, height: 46, borderRadius: radius.md, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...shadow },
  quickText: { fontWeight: weight.bold, color: colors.text },
  section: { fontSize: font.xs, fontWeight: weight.heavy, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { backgroundColor: colors.card, borderRadius: radius.lg, paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center', ...shadow },
  tileIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  tileText: { fontSize: font.sm, fontWeight: weight.bold, color: colors.text, textAlign: 'center' },
  version: { textAlign: 'center', color: colors.faint, fontSize: font.xs, marginTop: space.lg },
});
