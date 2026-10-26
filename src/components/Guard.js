import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../auth/AuthContext';
import { canOpen } from '../auth/menu';
import { Button, EmptyState, Header } from '../ui/kit';
import { colors } from '../theme';

// Blocks a page the signed-in staff member has no access right for
// (nav.js redirects such direct visits back to the dashboard).
export default function Guard({ menuKey, ownerOnly, title, children }) {
  const auth = useAuth();
  const blocked = (ownerOnly && auth.isStaff) || (menuKey && !canOpen(menuKey, auth));
  if (!blocked) return children;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={title || 'Not available'} />
      <EmptyState
        icon="lock-closed-outline"
        title="You don't have access"
        message="Ask the account owner to enable this option in your access rights."
        action={<Button title="Go to dashboard" icon="home-outline" onPress={() => router.replace('/home')} />}
      />
    </View>
  );
}
