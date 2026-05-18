import { describe, expect, it } from 'vitest';
import {
  createGlobalPlayer,
  createPairId,
  normalizePlayerSearchName,
  toSessionPlayer,
} from './playerIdentity';

describe('player identity helpers', () => {
  it('normalizes player names for search', () => {
    expect(normalizePlayerSearchName('  Alice   Van  Pelt ')).toBe('alice van pelt');
  });

  it('creates stable pair ids regardless of player order', () => {
    expect(createPairId('player_bob', 'player_alice')).toBe('player_alice__player_bob');
    expect(createPairId('player_alice', 'player_bob')).toBe('player_alice__player_bob');
  });

  it('creates a global player with default Elo fields', () => {
    expect(createGlobalPlayer({ id: 'player_alice', displayName: 'Alice', createdBy: 'uid-1' })).toEqual({
      id: 'player_alice',
      displayName: 'Alice',
      searchName: 'alice',
      createdBy: 'uid-1',
      claimStatus: 'guest',
      globalIndividualElo: 1500,
      globalMatchCount: 0,
      statsVersion: 1,
    });
  });

  it('creates session players from global players', () => {
    const player = createGlobalPlayer({ id: 'player_alice', displayName: 'Alice', createdBy: 'uid-1' });

    expect(toSessionPlayer(player)).toEqual({
      id: 'player_alice',
      displayName: 'Alice',
      gamesPlayed: 0,
      consecutiveStreak: 0,
      onBreak: true,
    });
  });
});
