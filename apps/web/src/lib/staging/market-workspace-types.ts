import type { SteamUpcomingGame } from '@/lib/steam-bets';
import type { StagingMetric } from './types';

export type StagingWorkspacePlayer = {
  id: string;
  username: string;
  displayName: string;
};

export type StagingWorkspaceMarket = {
  id: string;
  metricType: StagingMetric;
  status: 'open' | 'locked' | 'resolved' | 'void';
  averageValue: number | null;
  predictionCount: number;
  actualValue: number | null;
  forecasts: Array<{ playerId: string; value: number }>;
};

export type StagingWorkspaceGame = {
  steamAppId: number;
  simulationGameId: string;
  locked: boolean;
  completed: boolean;
  markets: StagingWorkspaceMarket[];
};

export type StagingWorkspaceLeaderboardRow = {
  rank: number;
  playerId: string;
  username: string;
  displayName: string;
  points: number;
  resolvedMarkets: number;
};

export type StagingWorkspaceData = {
  simulation: {
    id: string;
    name: string;
    simulationTime: string;
  };
  catalogGames: SteamUpcomingGame[];
  popularAppIds: number[];
  trendingAppIds: number[];
  players: StagingWorkspacePlayer[];
  games: StagingWorkspaceGame[];
  leaderboard: StagingWorkspaceLeaderboardRow[];
};
