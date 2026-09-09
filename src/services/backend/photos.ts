import { apiRequest } from './api';
import type { CouplePhoto, PhotoAlbum } from '@/types/database';

// H1_STANDALONE_PHOTOS_DATA_MODEL: client API for first-class photos and photo-based albums.
export async function getPhotos() {
  return (await apiRequest<{ photos: CouplePhoto[] }>('/photos')).photos;
}

export async function getPhoto(id: string) {
  return (await apiRequest<{ photo: CouplePhoto }>(`/photos/${id}`)).photo;
}

export async function createPhoto(input: {
  mediaUrl: string;
  caption?: string;
  takenAt?: string | null;
  linkedMemoryId?: string | null;
}) {
  return (await apiRequest<{ photo: CouplePhoto }>('/photos', { method: 'POST', body: input })).photo;
}

export async function updatePhoto(id: string, input: Partial<{
  mediaUrl: string;
  caption: string;
  takenAt: string | null;
  linkedMemoryId: string | null;
}>) {
  return (await apiRequest<{ photo: CouplePhoto }>(`/photos/${id}`, { method: 'PATCH', body: input })).photo;
}

export function deletePhoto(id: string) {
  return apiRequest<void>(`/photos/${id}`, { method: 'DELETE' });
}

export async function getPhotoAlbums() {
  return (await apiRequest<{ albums: PhotoAlbum[] }>('/photo-albums')).albums;
}

export async function createPhotoAlbum(input: { title: string; description?: string }) {
  return (await apiRequest<{ album: PhotoAlbum }>('/photo-albums', { method: 'POST', body: input })).album;
}

export async function updatePhotoAlbum(id: string, input: Partial<{ title: string; description: string }>) {
  return (await apiRequest<{ album: PhotoAlbum }>(`/photo-albums/${id}`, { method: 'PATCH', body: input })).album;
}

export function getPhotoAlbum(id: string) {
  return apiRequest<{ album: PhotoAlbum; photos: CouplePhoto[] }>(`/photo-albums/${id}`);
}

export function addPhotoToAlbum(albumId: string, photoId: string) {
  return apiRequest<{ ok: true }>(`/photo-albums/${albumId}/photos`, {
    method: 'POST',
    body: { photoId },
  });
}

export function removePhotoFromAlbum(albumId: string, photoId: string) {
  return apiRequest<void>(`/photo-albums/${albumId}/photos/${photoId}`, { method: 'DELETE' });
}

export function deletePhotoAlbum(id: string) {
  return apiRequest<void>(`/photo-albums/${id}`, { method: 'DELETE' });
}
