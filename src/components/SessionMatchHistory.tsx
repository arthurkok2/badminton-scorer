import type { LegacyMatchRecord, MatchRecord } from '../session/sessionTypes';

type SessionHistoryRecord = MatchRecord | LegacyMatchRecord;

interface SessionMatchHistoryProps {
  readonly matches: readonly SessionHistoryRecord[];
}

export function SessionMatchHistory({ matches }: SessionMatchHistoryProps) {
  if (matches.length === 0) return null;

  const rows = [
    ...matches.map((match, index) => ({
      match,
      matchNumber: isLegacyMatchRecord(match) ? index + 1 : match.matchNumber,
    })),
  ].reverse();

  return (
    <section className="session-match-history" aria-label="Session match history">
      <div className="session-section-title-row">
        <h3>Match history</h3>
        <span>{matches.length} played</span>
      </div>
      <ol className="session-match-history-list">
        {rows.map(({ match, matchNumber }) => (
          <li key={matchKey(match, matchNumber)}>
            <div>
              <span className="session-match-history-number">Match {matchNumber}</span>
              <strong>{formatTeam(teamDisplayNames(match, 'teamA'))} vs {formatTeam(teamDisplayNames(match, 'teamB'))}</strong>
              <span>{formatWinner(match)} won</span>
              {match.finalScore ? <span>{formatFinalScore(match)}</span> : null}
            </div>
            <span className="session-match-history-duration">{formatDuration(match)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function isLegacyMatchRecord(match: SessionHistoryRecord): match is LegacyMatchRecord {
  return 'teamA' in match;
}

function teamDisplayNames(match: SessionHistoryRecord, team: 'teamA' | 'teamB'): readonly [string, string] {
  if (isLegacyMatchRecord(match)) return match[team];
  return team === 'teamA' ? match.teamADisplayNames : match.teamBDisplayNames;
}

function matchKey(match: SessionHistoryRecord, matchNumber: number): string {
  if (!isLegacyMatchRecord(match)) return match.id;
  return `${matchNumber}-${match.teamA.join('-')}-${match.teamB.join('-')}`;
}

function formatTeam(team: readonly [string, string]): string {
  return `${team[0]} & ${team[1]}`;
}

function formatWinner(match: SessionHistoryRecord): string {
  return formatTeam(teamDisplayNames(match, match.winnerTeam));
}

function formatFinalScore(match: SessionHistoryRecord): string {
  return match.finalScore ? `${match.finalScore.teamA}-${match.finalScore.teamB}` : '';
}

function formatDuration(match: SessionHistoryRecord): string {
  if (!match.startedAt || !match.endedAt) return 'Duration unavailable';

  const startedAt = Date.parse(match.startedAt);
  const endedAt = Date.parse(match.endedAt);
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt < startedAt) {
    return 'Duration unavailable';
  }

  const minutes = Math.round((endedAt - startedAt) / 60000);
  return minutes < 1 ? '<1 min' : `${minutes} min`;
}
