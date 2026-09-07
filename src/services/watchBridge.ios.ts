import TogetherlyWatchBridge from '../../modules/togetherly-watch-bridge';

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
  mood?: string;
  need?: string;
  moodId?: string;
};

const unavailableStatus: WatchBridgeStatus = {
  supported: false,
  paired: false,
  watchAppInstalled: false,
  reachable: false,
};

function bridgeAvailable(): boolean {
  return TogetherlyWatchBridge != null;
}

export async function getWatchBridgeStatus(): Promise<WatchBridgeStatus> {
  if (!bridgeAvailable()) return unavailableStatus;
  try {
    return await TogetherlyWatchBridge.getStatus();
  } catch {
    return unavailableStatus;
  }
}

export async function syncWatchContext(payloadJson: string, appGroup: string): Promise<boolean> {
  if (!bridgeAvailable()) return false;
  try {
    return await TogetherlyWatchBridge.syncContext(payloadJson, appGroup);
  } catch {
    return false;
  }
}

export async function clearWatchContext(appGroup: string): Promise<void> {
  if (!bridgeAvailable()) return;
  try {
    await TogetherlyWatchBridge.clearContext(appGroup);
  } catch {
    // Watch cleanup is best-effort and must never break the phone app.
  }
}

export function subscribeWatchActions(listener: (action: WatchAction) => void): () => void {
  if (!bridgeAvailable()) return () => undefined;
  try {
    const subscription = TogetherlyWatchBridge.addListener('onWatchAction', listener);
    return () => {
      try { subscription?.remove?.(); } catch { /* best-effort cleanup */ }
    };
  } catch {
    return () => undefined;
  }
}

export function subscribeWatchStatus(listener: (status: WatchBridgeStatus) => void): () => void {
  if (!bridgeAvailable()) return () => undefined;
  try {
    const subscription = TogetherlyWatchBridge.addListener('onWatchStatus', listener);
    return () => {
      try { subscription?.remove?.(); } catch { /* best-effort cleanup */ }
    };
  } catch {
    return () => undefined;
  }
}
