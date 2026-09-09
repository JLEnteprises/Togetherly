import type { DrawingData, SharedItem } from '@/types/database';
import { apiRequest } from './api';

export type ScratchpadMode = 'text' | 'draw';

export async function getSharedScratchpad(_coupleId?: string): Promise<SharedItem | null> {
  const result = await apiRequest<{ item: SharedItem | null }>('/shared-items/scratchpad');
  return result.item;
}

export async function saveSharedScratchpad(input: {
  coupleId?: string;
  body: string;
  mode: ScratchpadMode;
  drawing?: DrawingData | null;
  existingId?: string;
  updatedAt?: string | null;
}): Promise<SharedItem> {
  const result = await apiRequest<{ item: SharedItem }>('/shared-items/scratchpad', {
    method: 'PUT',
    body: {
      body: input.body,
      mode: input.mode,
      drawing: input.drawing ?? null,
      updatedAt: input.updatedAt ?? null,
    },
  });
  return result.item;
}
