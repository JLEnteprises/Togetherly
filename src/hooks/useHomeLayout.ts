import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type HomeCardKey = 'today' | 'scratchpad' | 'distance' | 'quickActions';
export type HomeLayoutItem = { key: HomeCardKey; hidden: boolean; pinned: boolean };

export const defaultHomeLayout: HomeLayoutItem[] = [
  { key: 'today', hidden: false, pinned: true },
  { key: 'scratchpad', hidden: false, pinned: false },
  { key: 'distance', hidden: false, pinned: false },
  { key: 'quickActions', hidden: false, pinned: false },
];

function keyFor(userId: string | null | undefined) { return `togetherly:home-layout:v3:${userId ?? 'guest'}`; }
function normalize(value: unknown): HomeLayoutItem[] {
  if (!Array.isArray(value)) return defaultHomeLayout;
  const allowed = new Set<HomeCardKey>(['today', 'scratchpad', 'distance', 'quickActions']);
  const parsed = value.filter((item): item is HomeLayoutItem => !!item && typeof item === 'object' && allowed.has((item as HomeLayoutItem).key));
  const map = new Map(parsed.map((item) => [item.key, item]));
  return defaultHomeLayout.map((item) => ({ ...item, ...(map.get(item.key) ?? {}) })).sort((a, b) => {
    const ai = parsed.findIndex((item) => item.key === a.key); const bi = parsed.findIndex((item) => item.key === b.key);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });
}

export function useHomeLayout(userId: string | null | undefined) {
  const [layout, setLayout] = useState<HomeLayoutItem[]>(defaultHomeLayout);
  const [loaded, setLoaded] = useState(false);
  useFocusEffect(useCallback(() => { let active = true; AsyncStorage.getItem(keyFor(userId)).then((raw) => { if (!active) return; try { setLayout(normalize(raw ? JSON.parse(raw) : null)); } catch { setLayout(defaultHomeLayout); } setLoaded(true); }).catch(() => setLoaded(true)); return () => { active = false; }; }, [userId]));
  const save = useCallback(async (next: HomeLayoutItem[]) => { setLayout(next); await AsyncStorage.setItem(keyFor(userId), JSON.stringify(next)); }, [userId]);
  const orderedVisible = useMemo(() => layout.filter((item) => !item.hidden).sort((a, b) => Number(b.pinned) - Number(a.pinned) || layout.indexOf(a) - layout.indexOf(b)), [layout]);
  const update = useCallback((key: HomeCardKey, patch: Partial<HomeLayoutItem>) => save(layout.map((item) => item.key === key ? { ...item, ...patch } : item)), [layout, save]);
  const move = useCallback((key: HomeCardKey, direction: -1 | 1) => { const index = layout.findIndex((item) => item.key === key); const nextIndex = index + direction; if (index < 0 || nextIndex < 0 || nextIndex >= layout.length) return Promise.resolve(); const next = [...layout]; const currentItem = next[index]; const targetItem = next[nextIndex]; if (!currentItem || !targetItem) return Promise.resolve(); next[index] = targetItem; next[nextIndex] = currentItem; return save(next); }, [layout, save]);
  const reset = useCallback(() => save(defaultHomeLayout), [save]);
  return { layout, orderedVisible, loaded, update, move, reset };
}
