import { describe, it, expect } from 'vitest';
import { createMatch, awardPointToTeam } from '../domain/matchEngine';
import type { MatchState } from '../domain/matchTypes';
import { detectAnimationEvent } from './detectAnimationEvent';

function scorePoints(match: MatchState, teamId: 'teamA' | 'teamB', count: number): MatchState {
  let m = match;
  for (let i = 0; i < count; i++) m = awardPointToTeam(m, teamId);
  return m;
}

const base = createMatch({
  mode: 'doubles',
  initialServingTeamId: 'teamA',
  initialServingPlayerId: 'A1',
});

describe('detectAnimationEvent', () => {
  it('returns null when scores are unchanged (no point scored)', () => {
    expect(detectAnimationEvent(base, base)).toBeNull();
  });

  it('returns null for undo (score decreases)', () => {
    const prev = scorePoints(base, 'teamA', 3);
    const next = scorePoints(base, 'teamA', 2);
    expect(detectAnimationEvent(prev, next)).toBeNull();
  });

  it('returns match_won when winner is set', () => {
    const prev = scorePoints(base, 'teamA', 20);
    const next = awardPointToTeam(prev, 'teamA'); // 21-0, teamA wins
    const event = detectAnimationEvent(prev, next);
    // Could be shutout since teamB is at 0, but match_won with 21-0 = shutout
    expect(event?.type).toBe('shutout');
    expect(event?.teamId).toBe('teamA');
  });

  it('returns match_won (not shutout) when loser has points', () => {
    const withPoints = scorePoints(base, 'teamB', 5);
    const prev = scorePoints(withPoints, 'teamA', 20);
    const next = awardPointToTeam(prev, 'teamA'); // 21-5, teamA wins
    const event = detectAnimationEvent(prev, next);
    expect(event?.type).toBe('match_won');
    expect(event?.teamId).toBe('teamA');
  });

  it('returns shutout when match won and opponent at 0', () => {
    const prev = scorePoints(base, 'teamA', 20);
    const next = awardPointToTeam(prev, 'teamA'); // 21-0
    expect(detectAnimationEvent(prev, next)?.type).toBe('shutout');
  });

  it('returns bagel when scorer reaches 11 and opponent is at 0', () => {
    const prev = scorePoints(base, 'teamA', 10);
    const next = awardPointToTeam(prev, 'teamA'); // 11-0
    expect(detectAnimationEvent(prev, next)?.type).toBe('bagel');
    expect(detectAnimationEvent(prev, next)?.teamId).toBe('teamA');
  });

  it('returns first_to_11 (not bagel) when scorer reaches 11 and opponent has points', () => {
    const withOpp = scorePoints(base, 'teamB', 3);
    const prev = scorePoints(withOpp, 'teamA', 10);
    const next = awardPointToTeam(prev, 'teamA'); // 11-3
    expect(detectAnimationEvent(prev, next)?.type).toBe('first_to_11');
  });

  it('returns match_point when scorer reaches 20 and opponent is at 19', () => {
    const withOpp = scorePoints(base, 'teamB', 19);
    const prev = scorePoints(withOpp, 'teamA', 19);
    const next = awardPointToTeam(prev, 'teamA'); // 20-19
    expect(detectAnimationEvent(prev, next)?.type).toBe('match_point');
    expect(detectAnimationEvent(prev, next)?.teamId).toBe('teamA');
  });

  it('returns match_point when at 21-20 (after deuce broken)', () => {
    const atDeuce = scorePoints(scorePoints(base, 'teamA', 20), 'teamB', 20); // 20-20
    const prevState = atDeuce; // 20-20
    const nextState = awardPointToTeam(prevState, 'teamA'); // 21-20
    expect(detectAnimationEvent(prevState, nextState)?.type).toBe('match_point');
  });

  it('returns deuce when score becomes 20-20', () => {
    const prev = scorePoints(scorePoints(base, 'teamA', 20), 'teamB', 19); // 20-19
    const next = awardPointToTeam(prev, 'teamB'); // 20-20
    expect(detectAnimationEvent(prev, next)?.type).toBe('deuce');
  });

  it('returns streak_3 after 3 consecutive points', () => {
    const prev = scorePoints(base, 'teamA', 2);
    const next = awardPointToTeam(prev, 'teamA'); // 3 in a row
    expect(detectAnimationEvent(prev, next)?.type).toBe('streak_3');
    expect(detectAnimationEvent(prev, next)?.teamId).toBe('teamA');
  });

  it('returns streak_6 after 6 consecutive points (not streak_3)', () => {
    const prev = scorePoints(base, 'teamA', 5);
    const next = awardPointToTeam(prev, 'teamA');
    expect(detectAnimationEvent(prev, next)?.type).toBe('streak_6');
  });

  it('returns streak_9 after 9 consecutive points (not streak_6)', () => {
    const prev = scorePoints(base, 'teamA', 8);
    const next = awardPointToTeam(prev, 'teamA');
    expect(detectAnimationEvent(prev, next)?.type).toBe('streak_9');
  });

  it('returns null at 4 consecutive (not a threshold)', () => {
    const prev = scorePoints(base, 'teamA', 3);
    const next = awardPointToTeam(prev, 'teamA'); // 4 in a row
    expect(detectAnimationEvent(prev, next)).toBeNull();
  });

  it('returns null at 12 consecutive (beyond tracked thresholds)', () => {
    const prev = scorePoints(base, 'teamA', 11);
    const next = awardPointToTeam(prev, 'teamA');
    expect(detectAnimationEvent(prev, next)).toBeNull();
  });

  it('returns comeback when team was down by 5 and is now tied', () => {
    const buildUp = scorePoints(scorePoints(base, 'teamB', 5), 'teamA', 4); // 4-5
    const next = awardPointToTeam(buildUp, 'teamA'); // 5-5
    expect(detectAnimationEvent(buildUp, next)?.type).toBe('comeback');
    expect(detectAnimationEvent(buildUp, next)?.teamId).toBe('teamA');
  });

  it('returns null when not trailing by 5', () => {
    const buildUp = scorePoints(scorePoints(base, 'teamB', 4), 'teamA', 3); // 3-4
    const next = awardPointToTeam(buildUp, 'teamA'); // 4-4
    expect(detectAnimationEvent(buildUp, next)).toBeNull();
  });

  it('returns first_to_11 when scorer reaches 11 (opponent > 0)', () => {
    const withOpp = scorePoints(base, 'teamB', 7);
    const prev = scorePoints(withOpp, 'teamA', 10);
    const next = awardPointToTeam(prev, 'teamA'); // 11-7
    expect(detectAnimationEvent(prev, next)?.type).toBe('first_to_11');
  });

  it('returns null for a regular point with no special condition', () => {
    const prev = scorePoints(base, 'teamA', 1);
    const next = awardPointToTeam(prev, 'teamA'); // 2-0
    expect(detectAnimationEvent(prev, next)).toBeNull();
  });
});
