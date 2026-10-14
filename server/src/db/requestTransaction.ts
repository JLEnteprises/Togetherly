import { AsyncLocalStorage } from 'node:async_hooks';
import type { PoolClient } from 'pg';

export const requestTransaction = new AsyncLocalStorage<{ client: PoolClient; effects: Array<() => void> }>();
export function afterCommit(effect: () => void) {
  const transaction = requestTransaction.getStore();
  if (transaction) transaction.effects.push(effect);
  else effect();
}
