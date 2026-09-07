import type { MoodValue, NeedValue } from '@/types/database';
export type WatchBridgeStatus = { supported: boolean; paired: boolean; watchAppInstalled: boolean; reachable: boolean; activationState?: number };
export type WatchAction = { type?: string; kind?: string; mood?: MoodValue | string; need?: NeedValue | string; moodId?: string };
const no: WatchBridgeStatus = { supported: false, paired: false, watchAppInstalled: false, reachable: false };
export async function getWatchBridgeStatus() { return no; }
export async function syncWatchContext(_payloadJson: string, _appGroup: string) { return false; }
export async function clearWatchContext(_appGroup: string) { return; }
export function subscribeWatchActions(_listener: (action: WatchAction) => void) { return () => undefined; }
export function subscribeWatchStatus(_listener: (status: WatchBridgeStatus) => void) { return () => undefined; }
