import { describe, expect, it } from 'vitest';
import { getVisibleSimulationPlayers, isBatchSimulationPlayer } from './player-visibility';

describe('staging player visibility', () => {
  it('hides generated batch players while keeping interactive artificial users', () => {
    const players = [
      { id: 'interactive', metadata: { is_artificial: true } },
      { id: 'batch', metadata: { is_artificial: true, is_batch: true } },
      { id: 'legacy', metadata: null },
    ];

    expect(getVisibleSimulationPlayers(players).map((player) => player.id)).toEqual([
      'interactive',
      'legacy',
    ]);
    expect(isBatchSimulationPlayer(players[1])).toBe(true);
    expect(isBatchSimulationPlayer(players[0])).toBe(false);
  });
});
