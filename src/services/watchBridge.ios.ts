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

export async function getWatchBridgeStatus(): Promise<WatchBridgeStatus> {
  return await TogetherlyWatchBridge.getStatus();
}
export async function syncWatchContext(payloadJson: string, appGroup: string): Promise<boolean> {
  return await TogetherlyWatchBridge.syncContext(payloadJson, appGroup);
}
export async function clearWatchContext(appGroup: string) {
  await TogetherlyWatchBridge.clearContext(appGroup);
}
export function subscribeWatchActions(listener: (action: WatchAction) => void) {
  const action = TogetherlyWatchBridge.addListener('onWatchAction', listener);
  return () => action.remove();
}
export function subscribeWatchStatus(listener: (status: WatchBridgeStatus) => void) {
  const subscription = TogetherlyWatchBridge.addListener('onWatchStatus', listener);
  return () => subscription.remove();
}
