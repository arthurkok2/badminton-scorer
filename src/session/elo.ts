export interface EloSubject {
  readonly id: string;
  readonly rating: number;
  readonly matchCount: number;
}

export interface EloSnapshot {
  readonly before: number;
  readonly after: number;
  readonly delta: number;
}

export type EloUpdate = Readonly<Record<string, EloSnapshot>>;

export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

export function kFactorForMatches(matchCount: number): number {
  return matchCount < 10 ? 32 : 24;
}

export function calculateIndividualEloUpdate(options: {
  readonly teamA: readonly [EloSubject, EloSubject];
  readonly teamB: readonly [EloSubject, EloSubject];
  readonly winnerTeam: 'teamA' | 'teamB';
}): EloUpdate {
  const teamARating = average(options.teamA[0].rating, options.teamA[1].rating);
  const teamBRating = average(options.teamB[0].rating, options.teamB[1].rating);
  const teamAScore = options.winnerTeam === 'teamA' ? 1 : 0;
  const teamBScore = 1 - teamAScore;
  const teamAK = average(
    kFactorForMatches(options.teamA[0].matchCount),
    kFactorForMatches(options.teamA[1].matchCount),
  );
  const teamBK = average(
    kFactorForMatches(options.teamB[0].matchCount),
    kFactorForMatches(options.teamB[1].matchCount),
  );
  const teamADelta = Math.round(
    teamAK * (teamAScore - expectedScore(teamARating, teamBRating)),
  );
  const teamBDelta = Math.round(
    teamBK * (teamBScore - expectedScore(teamBRating, teamARating)),
  );

  return {
    ...snapshotsForTeam(options.teamA, teamADelta),
    ...snapshotsForTeam(options.teamB, teamBDelta),
  };
}

export function calculatePairEloUpdate(options: {
  readonly teamAPair: EloSubject;
  readonly teamBPair: EloSubject;
  readonly winnerTeam: 'teamA' | 'teamB';
}): EloUpdate {
  const teamAScore = options.winnerTeam === 'teamA' ? 1 : 0;
  const teamBScore = 1 - teamAScore;
  const teamADelta = Math.round(
    kFactorForMatches(options.teamAPair.matchCount) *
      (teamAScore - expectedScore(options.teamAPair.rating, options.teamBPair.rating)),
  );
  const teamBDelta = Math.round(
    kFactorForMatches(options.teamBPair.matchCount) *
      (teamBScore - expectedScore(options.teamBPair.rating, options.teamAPair.rating)),
  );

  return {
    [options.teamAPair.id]: snapshot(options.teamAPair.rating, teamADelta),
    [options.teamBPair.id]: snapshot(options.teamBPair.rating, teamBDelta),
  };
}

function average(a: number, b: number): number {
  return (a + b) / 2;
}

function snapshotsForTeam(team: readonly EloSubject[], delta: number): EloUpdate {
  return Object.fromEntries(team.map((subject) => [subject.id, snapshot(subject.rating, delta)]));
}

function snapshot(before: number, delta: number): EloSnapshot {
  return { before, after: before + delta, delta };
}
