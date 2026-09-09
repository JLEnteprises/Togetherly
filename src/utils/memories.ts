import type { CoupleMemory } from '@/types/database';

export function memoryPhotoUrls(memory: CoupleMemory | null | undefined) {
  if (!memory) return [];
  const photos = (memory.photos ?? []).map((photo) => photo.media_url).filter(Boolean);
  if (photos.length) return photos;
  return memory.photo_url ? [memory.photo_url] : [];
}

export function memoryCoverUrl(memory: CoupleMemory | null | undefined) {
  return memoryPhotoUrls(memory)[0] ?? null;
}

export function memoryPhotoCount(memory: CoupleMemory | null | undefined) {
  return memoryPhotoUrls(memory).length;
}

export function formatMemoryDate(value: string, options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' }) {
  try {
    return new Intl.DateTimeFormat(undefined, options).format(new Date(`${value.slice(0, 10)}T12:00:00`));
  } catch {
    return value;
  }
}
