import type { MatchRecord } from '../session/sessionTypes';

interface SessionMatchHistoryProps {
  readonly matches: readonly MatchRecord[];
}

export function SessionMatchHistory({ matches }: SessionMatchHistoryProps) {
  if (matches.length === 0) return null;

  const rows = [...matches.map((match, index) => ({ match, matchNumber: index + 1 }))].reverse();

  return (
    <section className="session-match-history" aria-label="Session match history">
      <div className="session-section-title-row">
        <h3>Match history</h3>
        <span>{matches.length} played</span>
      </div>
      <ol className="session-match-history-list">
        {rows.map(({ match, matchNumber }) => (
          <li key={`${matchNumber}-${match.teamA.join('-')}-${match.teamB.join('-')}`}>
            <div>
              <span className="session-match-history-number">Match {matchNumber}</span>
              <strong>{formatTeam(match.teamA)} vs {formatTeam(match.teamB)}</strong>
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

function formatTeam(team: readonly [string, string]): string {
  return `${team[0]} & ${team[1]}`;
}

function formatWinner(match: MatchRecord): string {
  return formatTeam(match[match.winnerTeam]);
}

function formatFinalScore(match: MatchRecord): string {
  return match.finalScore ? `${match.finalScore.teamA}-${match.finalScore.teamB}` : '';
}

function formatDuration(match: MatchRecord): string {
  if (!match.startedAt || !match.endedAt) return 'Duration unavailable';

  const startedAt = Date.parse(match.startedAt);
  const endedAt = Date.parse(match.endedAt);
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt < startedAt) {
    return 'Duration unavailable';
  }

  const minutes = Math.round((endedAt - startedAt) / 60000);
  return minutes < 1 ? '<1 min' : `${minutes} min`;
}
