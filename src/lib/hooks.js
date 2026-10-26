import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

// Runs `fn` every `ms` while the screen is focused and the app is in the
// foreground (the web pages skip polling when document.hidden).
export function usePolling(fn, ms, enabled = true) {
  const saved = useRef(fn);
  useEffect(() => { saved.current = fn; }, [fn]);
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;
      let appState = AppState.currentState;
      const sub = AppState.addEventListener('change', (s) => {
        const wasBg = appState !== 'active';
        appState = s;
        if (s === 'active' && wasBg) saved.current();
      });
      const id = setInterval(() => { if (appState === 'active') saved.current(); }, ms);
      return () => { clearInterval(id); sub.remove(); };
    }, [ms, enabled]),
  );
}

export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// Ignores responses from superseded requests (yantri.html currentLoadDataReqId).
export function useLatest() {
  const seq = useRef(0);
  return useCallback(() => {
    const id = ++seq.current;
    return () => id === seq.current;
  }, []);
}

// Re-run a loader every time the screen regains focus (web's pageshow refresh).
// Only real focus changes trigger it — not a new `fn` identity.
export function useFocusRefresh(fn) {
  const saved = useRef(fn);
  const first = useRef(true);
  useEffect(() => { saved.current = fn; }, [fn]);
  useFocusEffect(
    useCallback(() => {
      if (first.current) { first.current = false; return; }
      saved.current();
    }, []),
  );
}
