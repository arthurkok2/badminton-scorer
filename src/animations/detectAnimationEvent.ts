import type { MatchState, TeamId } from '../domain/matchTypes';
import type { AnimationEvent, AnimationEventType } from './types';

export function detectAnimationEvent(prev: MatchState, next: MatchState): AnimationEvent | null {
  const prevTotal = prev.score.teamA + prev.score.teamB;
  const nextTotal = next.score.teamA + next.score.teamB;
  if (nextTotal !== prevTotal + 1) return null;
  if (prev.winnerTeamId) return null;

  const scorer: TeamId = next.score.teamA > prev.score.teamA ? 'teamA' : 'teamB';
  const opponent: TeamId = scorer === 'teamA' ? 'teamB' : 'teamA';

  // Priority 1 & 2: match_won / shutout
  if (next.winnerTeamId) {
    const type: AnimationEventType = next.score[opponent] === 0 ? 'shutout' : 'match_won';
    return { type, teamId: scorer };
  }

  // Priority 3: bagel
  if (next.score[scorer] === 11 && next.score[opponent] === 0) {
    return { type: 'bagel', teamId: scorer };
  }

  // Priority 4: match_point
  if (isMatchPoint(next.score, scorer, opponent)) {
    return { type: 'match_point', teamId: scorer };
  }

  // Priority 5: deuce
  if (next.score.teamA === 20 && next.score.teamB === 20) {
    return { type: 'deuce', teamId: scorer };
  }

  // Streak detection (priorities 6, 7, 9)
  const streak = getConsecutiveStreak(next);
  if (streak === 9) return { type: 'streak_9', teamId: scorer };
  if (streak === 6) return { type: 'streak_6', teamId: scorer };

  // Priority 8: comeback (only when just tied, not ahead)
  const nowTied = next.score[scorer] === next.score[opponent];
  if (nowTied && wasEverDownByFive(next, scorer, opponent)) {
    return { type: 'comeback', teamId: scorer };
  }

  // Priority 9: streak_3
  if (streak === 3) return { type: 'streak_3', teamId: scorer };

  // Priority 10: first_to_11
  if (next.score[scorer] === 11 && next.score[opponent] > 0) {
    return { type: 'first_to_11', teamId: scorer };
  }

  return null;
}

function wasEverDownByFive(match: MatchState, scorer: TeamId, opponent: TeamId): boolean {
  const allStates = [...match.history, match];
  for (const state of allStates) {
    if (state.score[opponent] - state.score[scorer] >= 5) return true;
  }
  return false;
}

function isMatchPoint(score: { teamA: number; teamB: number }, teamId: TeamId, opponent: TeamId): boolean {
  const next = score[teamId] + 1;
  if (next === 30) return true;
  return next >= 21 && next - score[opponent] >= 2;
}

function getConsecutiveStreak(match: MatchState): number {
  if (match.history.length === 0) return 0;

  const allStates = [...match.history, match];
  const lastIdx = allStates.length - 1;
  const lastScorer: TeamId =
    allStates[lastIdx].score.teamA > allStates[lastIdx - 1].score.teamA ? 'teamA' : 'teamB';

  let count = 1;
  for (let i = lastIdx - 1; i >= 1; i--) {
    const scorer: TeamId =
      allStates[i].score.teamA > allStates[i - 1].score.teamA ? 'teamA' : 'teamB';
    if (scorer === lastScorer) count++;
    else break;
  }
  return count;
}
