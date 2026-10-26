import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import Guard from '../components/Guard';
import { Button, Card, Field, Header, Screen } from '../ui/kit';
import { toast } from '../ui/Toast';
import { colors, font, radius, space, weight } from '../theme';

// The web page posts to /api/admin/change-password, which the live server
// does not have. The login page's verified reset endpoints do the same job
// (check current password, set the new one) for owners and staff alike.
function ChangePasswordScreen() {
  const { user, isStaff } = useAuth();
  const [cur, setCur] = useState('');
  const [np, setNp] = useState('');
  const [cp, setCp] = useState('');
  const [busy, setBusy] = useState(false);
  const r2 = useRef(null), r3 = useRef(null);

  const submit = async () => {
    if (!cur || !np || !cp) { toast('All fields required', 'error'); return; }
    if (np !== cp) { toast('New passwords do not match', 'error'); return; }
    if (np.length < 4) { toast('Password too short', 'error'); return; }
    setBusy(true);
    const r = isStaff
      ? await api.post('/api/auth/reset-subuser-password', { subUserID: user.SubUID, currentPassword: cur, newPassword: np }, { auth: false })
      : await api.post('/api/auth/reset-password', { mobile: user.Mobile, currentPassword: cur, newPassword: np }, { auth: false });
    setBusy(false);
    if (r?.success) { toast('Password changed!'); setCur(''); setNp(''); setCp(''); }
    else toast(r?.message || 'Error', 'error');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Change Password" subtitle={isStaff ? `Staff ID ${user?.SubUID}` : user?.Mobile} />
      <Screen scroll>
        <View style={styles.hero}>
          <Ionicons name="shield-checkmark" size={36} color={colors.brand} />
          <Text style={styles.heroText}>Use at least 4 characters. You’ll use the new password next time you log in.</Text>
        </View>
        <Card>
          <Field label="Current Password" icon="lock-closed-outline" value={cur} onChangeText={setCur} secure placeholder="Enter current password" returnKeyType="next" onSubmitEditing={() => r2.current?.focus()} />
          <Field ref={r2} label="New Password" icon="key-outline" value={np} onChangeText={setNp} secure placeholder="Enter new password" returnKeyType="next" onSubmitEditing={() => r3.current?.focus()} />
          <Field ref={r3} label="Confirm Password" icon="key-outline" value={cp} onChangeText={setCp} secure placeholder="Confirm new password" returnKeyType="done" onSubmitEditing={submit} />
          <Button title="Submit" icon="checkmark" loading={busy} onPress={submit} />
        </Card>
      </Screen>
    </View>
  );
}

export default function ChangePassword() {
  return <Guard menuKey="change-password" title="Change Password"><ChangePasswordScreen /></Guard>;
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', backgroundColor: colors.brandSoft, borderRadius: radius.lg, padding: space.xl, marginBottom: space.md, gap: 8 },
  heroText: { textAlign: 'center', color: colors.textSoft, fontSize: font.sm, fontWeight: weight.semi, lineHeight: 19 },
});
