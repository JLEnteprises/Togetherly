import { createDraftStore } from '@/services/draftStore';
import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const store = createDraftStore(AsyncStorage);

// Key includes user and couple. Saves are ordered and survive component unmount.
export function useDurableDraft<T>(key: string | null, value: T, restore: (value: T) => void, hasContent: boolean) {
  const [attempt, setAttempt] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'saved' | 'saving' | 'error'>('loading');
  const restoreRef = useRef(restore); restoreRef.current = restore;
  const suppressed = useRef<string | null>(null);
  const serialized = JSON.stringify(value);
  useEffect(() => {
    let alive = true;
    setLoadedKey(null); setStatus('loading');
    if (!key) return;
    void (async () => {
      try {
        const raw = await store.read(key);
        if (!alive) return;
        if (raw) { const parsed = JSON.parse(raw); if (parsed.version === 1) restoreRef.current(parsed.value); }
        setLoadedKey(key); setStatus('saved');
      } catch { if (alive) setStatus('error'); }
    })();
    return () => { alive = false; };
  }, [key, attempt]);
  useEffect(() => {
    if (suppressed.current !== null && suppressed.current !== serialized) suppressed.current = null;
    if (!key || loadedKey !== key || suppressed.current === serialized) return;
    let alive = true;
    setStatus('saving');
    void (hasContent ? store.write(key, `{"version":1,"value":${serialized}}`) : store.remove(key))
      .then(() => { if (alive) setStatus('saved'); }).catch(() => { if (alive) setStatus('error'); });
    return () => { alive = false; };
  }, [key, loadedKey, serialized, hasContent]);
  async function clear() {
    if (!key) return;
    suppressed.current = serialized;
    await store.remove(key);
    setStatus('saved');
  }
  return { ready: Boolean(key && loadedKey === key), status, clear, retry: () => { if (key && loadedKey === key) { setStatus('saving'); void store.write(key, `{"version":1,"value":${serialized}}`).then(() => setStatus('saved')).catch(() => setStatus('error')); } else setAttempt((n) => n+1); } };
}
