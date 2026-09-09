import { useSyncExternalStore } from 'react';

const stalePaths = new Set<string>();
const listeners = new Set<() => void>();
let summary = '';
export function reportFreshness(path: string, fresh: boolean) {
  if (fresh) stalePaths.delete(path); else stalePaths.add(path);
  const next = [...stalePaths].sort().join(',');
  if (summary !== next) { summary = next; listeners.forEach((listener) => listener()); }
}
export function clearFreshness() {
  stalePaths.clear(); summary = ''; listeners.forEach((listener) => listener());
}
export function useStaleData() {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => summary,
    () => '',
  );
}
