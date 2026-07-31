type SimulationPlayerMetadata = {
  metadata?: Record<string, unknown> | null;
};

export function isBatchSimulationPlayer(player: SimulationPlayerMetadata | null | undefined) {
  return player?.metadata?.is_batch === true;
}

export function getVisibleSimulationPlayers<T extends SimulationPlayerMetadata>(players: T[]) {
  return players.filter((player) => !isBatchSimulationPlayer(player));
}
