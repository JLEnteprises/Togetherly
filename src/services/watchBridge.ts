import type { MoodValue, NeedValue } from '@/types/database';

export type WatchBridgeStatus = {
  supported: boolean;
  paired: boolean;
  watchAppInstalled: boolean;
  reachable: boolean;
  activationState?: number;
};

export type WatchAction = {
  type?: string;
  kind?: string;
  mood?: MoodValue | string;
  need?: NeedValue | string;
  moodId?: string;
};

const unsupported: WatchBridgeStatus = {
  supported: false,
  paired: false,
  watchAppInstalled: false,
  reachable: false,
};

// Metro resolves watchBridge.ios.ts / .android.ts / .web.ts at runtime. This
// base module provides a platform-neutral contract for TypeScript.
export async function getWatchBridgeStatus(): Promise<WatchBridgeStatus> { return unsupported; }
export async function syncWatchContext(_payloadJson: string, _appGroup: string): Promise<boolean> { return false; }
export async function clearWatchContext(_appGroup: string): Promise<void> { return; }
export function subscribeWatchActions(_listener: (action: WatchAction) => void): () => void { return () => undefined; }
export function subscribeWatchStatus(_listener: (status: WatchBridgeStatus) => void): () => void { return () => undefined; }
