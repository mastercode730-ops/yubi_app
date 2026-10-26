import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import api, { loadToken, setToken, onUnauthorized } from '../api/client';
import { toast } from '../ui/Toast';

const USER_KEY = 'yubi7_user';
const AuthContext = createContext(null);

const isTrue = (v) => v === true || v === 1 || String(v).toLowerCase() === 'true' || String(v) === '1';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const signingOut = useRef(false);

  const persistUser = useCallback(async (u) => {
    setUser(u);
    try {
      if (u) await AsyncStorage.setItem(USER_KEY, JSON.stringify(u));
      else await AsyncStorage.removeItem(USER_KEY);
    } catch {}
  }, []);

  const clearSession = useCallback(async () => {
    await setToken(null);
    await persistUser(null);
  }, [persistUser]);

  const refreshMe = useCallback(async () => {
    const r = await api.get('/api/auth/me');
    if (r?.success && r.user) {
      await persistUser(r.user);
      return r.user;
    }
    return null;
  }, [persistUser]);

  // Boot: restore token + cached user, then re-validate with /me (same as nav.js initPage).
  useEffect(() => {
    (async () => {
      const t = await loadToken();
      if (t) {
        try {
          const cached = await AsyncStorage.getItem(USER_KEY);
          if (cached) setUser(JSON.parse(cached));
        } catch {}
        refreshMe();
      }
      setReady(true);
    })();
  }, [refreshMe]);

  useEffect(() => {
    onUnauthorized(async (message) => {
      if (signingOut.current) return;
      signingOut.current = true;
      await clearSession();
      toast(message, 'error');
      router.replace('/login');
      setTimeout(() => { signingOut.current = false; }, 1500);
    });
  }, [clearSession]);

  const completeLogin = useCallback(async (r) => {
    if (!r?.success || !r.token) return { ok: false, message: r?.message || 'Invalid credentials' };
    await setToken(r.token);
    await persistUser(r.user || null);
    await refreshMe();
    return { ok: true };
  }, [persistUser, refreshMe]);

  const login = useCallback(async (mobile, password) => {
    const r = await api.post('/api/auth/login', { mobile, password }, { auth: false });
    return completeLogin(r);
  }, [completeLogin]);

  const staffLogin = useCallback(async (subUserID, password) => {
    const r = await api.post('/api/auth/subuser-login', { subUserID, password }, { auth: false });
    return completeLogin(r);
  }, [completeLogin]);

  const logout = useCallback(async () => {
    try { await api.post('/api/auth/logout', {}); } catch {}
    await clearSession();
    router.replace('/login');
  }, [clearSession]);

  const value = useMemo(() => {
    const isStaff = !!user?.SubUID;
    const isSuperAdmin = !isStaff && (user?.SuperAdmin === 'SuperAdmin' || user?.SuperAdminStatus === 'True');
    return {
      user, ready, isStaff, isSuperAdmin,
      login, staffLogin, logout, refreshMe,
      // Access-right flag check — owners have everything (nav.js _applyUserPermissions).
      can: (flag) => !isStaff || isTrue(user?.[flag]),
      displayName: user?.subusername || user?.displayName || user?.Mobile || (user?.UID ? `User #${user.UID}` : 'User'),
      roleLabel: isStaff ? `Staff · ${user?.subusername || user?.SubUID}` : isSuperAdmin ? 'Super Admin' : 'Administrator',
    };
  }, [user, ready, login, staffLogin, logout, refreshMe]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
