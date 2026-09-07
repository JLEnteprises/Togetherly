import { apiRequest } from './api';
import type { BingoWinCondition, GameSession, GameType } from '@/types/database';

export async function getGames() {
  return (await apiRequest<{ games: GameSession[] }>('/games')).games;
}

export async function getGame(id: string) {
  return (await apiRequest<{ game: GameSession }>(`/games/${id}`)).game;
}

export async function createGame(input: {
  gameType: GameType;
  reward?: string;
  title?: string;
  winCondition?: BingoWinCondition;
  secretWord?: string;
  roundCount?: number;
}) {
  return (await apiRequest<{ game: GameSession }>('/games', { method: 'POST', body: input })).game;
}

export async function gameAction(id: string, input: Record<string, unknown>) {
  return (await apiRequest<{ game: GameSession }>(`/games/${id}/actions`, { method: 'POST', body: input })).game;
}

export async function abandonGame(id: string) {
  return (await apiRequest<{ game: GameSession }>(`/games/${id}/abandon`, { method: 'POST' })).game;
}
