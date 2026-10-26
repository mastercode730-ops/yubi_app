import React from 'react';
import { Platform } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import { colors, font, weight } from '../../theme';

const icon = (name) => {
  const TabIcon = ({ color, focused }) => <Ionicons name={focused ? name : `${name}-outline`} size={23} color={color} />;
  return TabIcon;
};

export default function TabsLayout() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  if (!user) return <Redirect href="/login" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontSize: font.xs, fontWeight: weight.bold, marginBottom: Platform.OS === 'android' ? 4 : 0 },
        tabBarStyle: {
          height: 66 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 10),
          borderTopColor: colors.border,
          backgroundColor: colors.card,
        },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="inbox" options={{ title: 'Games', tabBarIcon: icon('chatbubbles') }} />
      <Tabs.Screen name="menu" options={{ title: 'Menu', tabBarIcon: icon('apps') }} />
    </Tabs>
  );
}
