import { useState } from 'react';
import type { StatsSummary } from '../session/stats';

interface PlayerLeaderboardEntry {
  readonly id: string;
  readonly displayName: string;
  readonly elo: number;
  readonly matchesPlayed: number;
  readonly winRate: number;
  readonly recentForm: readonly ('W' | 'L')[];
}

interface PairLeaderboardEntry {
  readonly id: string;
  readonly displayNames: readonly [string, string];
  readonly elo: number;
  readonly matchesPlayed: number;
  readonly winRate: number;
}

interface MatchupEntry {
  readonly id: string;
  readonly players: readonly [string, string];
  readonly matchesPlayed: number;
  readonly wins: number;
  readonly losses: number;
}

interface SessionSummaryEntry {
  readonly id: string;
  readonly startedAt?: string;
  readonly endedAt?: string;
  readonly status?: 'active' | 'completed';
  readonly matchCount: number;
  readonly players?: readonly {
    readonly id: string;
    readonly displayName: string;
    readonly gamesPlayed: number;
    readonly breaksTaken?: number;
  }[];
}

interface GlobalMatchEntry {
  readonly id: string;
  readonly startedAt?: string;
  readonly endedAt?: string;
  readonly teamA: readonly [string, string];
  readonly teamB: readonly [string, string];
  readonly winnerTeam: 'teamA' | 'teamB';
  readonly finalScore?: {
    readonly teamA: number;
    readonly teamB: number;
  };
  readonly submittedBy?: string;
}

interface HistoryStatsModalProps {
  readonly sessions: readonly SessionSummaryEntry[];
  readonly players: readonly PlayerLeaderboardEntry[];
  readonly pairs: readonly PairLeaderboardEntry[];
  readonly matchups: readonly MatchupEntry[];
  readonly globalMatches: readonly GlobalMatchEntry[];
  readonly personalStats?: StatsSummary;
  readonly onClose: () => void;
}

type TabId = 'overview' | 'players' | 'pairs' | 'globalMatches' | 'sessions' | 'personalStats' | 'matchups';

const TABS: readonly { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'players', label: 'Global Players' },
  { id: 'pairs', label: 'Global Pairs' },
  { id: 'globalMatches', label: 'Global Matches' },
  { id: 'sessions', label: 'My Sessions' },
  { id: 'personalStats', label: 'My Stats' },
  { id: 'matchups', label: 'Matchups' },
];

export function HistoryStatsModal({
  sessions,
  players,
  pairs,
  matchups,
  globalMatches,
  personalStats,
  onClose,
}: HistoryStatsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const topPlayer = players[0];
  const topPair = pairs[0];

  return (
    <div role="dialog" aria-label="History & Stats" className="history-stats-modal">
      <div className="history-stats-header">
        <h2 className="history-stats-title">History &amp; Stats</h2>
        <button type="button" aria-label="Close" className="history-stats-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div role="tablist" className="history-stats-tabs">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={`history-stats-tab${activeTab === id ? ' history-stats-tab--active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="history-stats-content">
        {activeTab === 'overview' && (
          <div className="history-stats-panel">
            <div className="history-stats-kpis">
              <MetricCard label="My sessions" value={sessions.length} />
              <MetricCard label="Global players" value={players.length} />
              <MetricCard label="Global pairs" value={pairs.length} />
              <MetricCard label="Global matches" value={globalMatches.length} />
            </div>
            <div className="history-stats-split">
              <section className="history-stats-section" aria-label="Top player">
                <h3>Top player</h3>
                {topPlayer ? (
                  <p>{topPlayer.displayName} · {topPlayer.elo} Elo · {topPlayer.matchesPlayed} matches</p>
                ) : (
                  <p className="history-stats-empty">No global player data yet.</p>
                )}
              </section>
              <section className="history-stats-section" aria-label="Top pair">
                <h3>Top pair</h3>
                {topPair ? (
                  <p>{topPair.displayNames.join(' & ')} · {topPair.elo} Elo · {topPair.matchesPlayed} matches</p>
                ) : (
                  <p className="history-stats-empty">No global pair data yet.</p>
                )}
              </section>
            </div>
          </div>
        )}

        {activeTab === 'sessions' && (
          <div className="history-stats-panel">
            {sessions.length === 0 ? (
              <p className="history-stats-empty">No sessions recorded yet.</p>
            ) : (
              <ul className="history-stats-list">
                {sessions.map((session) => (
                  <li key={session.id} className="history-stats-item">
                    <span>{formatDate(session.startedAt)}</span>
                    <span>{session.status ?? 'saved'}</span>
                    <span>{session.matchCount} matches</span>
                    <span>{session.players?.map(player => player.displayName).join(', ')}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'players' && (
          <div className="history-stats-panel">
            {players.length === 0 ? (
              <p className="history-stats-empty">No player data yet.</p>
            ) : (
              <ul className="history-stats-list">
                {players.map((player) => (
                  <li key={player.id} className="history-stats-item">
                    <span>#{players.indexOf(player) + 1}</span>
                    <span className="history-stats-player-name">{player.displayName}</span>
                    <span className="history-stats-player-elo">{player.elo}</span>
                    <span>{player.matchesPlayed} played</span>
                    <span>{Math.round(player.winRate * 100)}% win</span>
                    <span>{player.recentForm.join(' ')}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'pairs' && (
          <div className="history-stats-panel">
            {pairs.length === 0 ? (
              <p className="history-stats-empty">No pair data yet.</p>
            ) : (
              <ul className="history-stats-list">
                {pairs.map((pair) => (
                  <li key={pair.id} className="history-stats-item">
                    <span>#{pairs.indexOf(pair) + 1}</span>
                    <span>{pair.displayNames.join(' & ')}</span>
                    <span>{pair.elo}</span>
                    <span>{pair.matchesPlayed} played</span>
                    <span>{Math.round(pair.winRate * 100)}% win</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'globalMatches' && (
          <div className="history-stats-panel">
            {globalMatches.length === 0 ? (
              <p className="history-stats-empty">No global matches recorded yet.</p>
            ) : (
              <ul className="history-stats-list">
                {globalMatches.map((match) => (
                  <li key={match.id} className="history-stats-item">
                    <span>{formatDate(match.endedAt ?? match.startedAt)}</span>
                    <strong>{match.teamA.join(' & ')}</strong>
                    <span>vs</span>
                    <strong>{match.teamB.join(' & ')}</strong>
                    <span>{match.finalScore ? `${match.finalScore.teamA}-${match.finalScore.teamB}` : 'No score'}</span>
                    <span>{match.winnerTeam === 'teamA' ? 'Team A won' : 'Team B won'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'personalStats' && (
          <div className="history-stats-panel">
            {!personalStats ? (
              <p className="history-stats-empty">No personal stats summary yet.</p>
            ) : (
              <>
                <div className="history-stats-kpis">
                  <MetricCard label="Rated matches" value={personalStats.ratedMatchCount} />
                  <MetricCard label="Players recorded" value={Object.keys(personalStats.players).length} />
                  <MetricCard label="Pairs recorded" value={Object.keys(personalStats.pairs).length} />
                  <MetricCard label="Matchups recorded" value={Object.keys(personalStats.matchups).length} />
                </div>
                <ul className="history-stats-list">
                  {Object.entries(personalStats.players).map(([id, player]) => (
                    <li key={id} className="history-stats-item">
                      <span>{player.displayName}</span>
                      <span>{player.matchesPlayed} played</span>
                      <span>{player.wins}W / {player.losses}L</span>
                      <span>{Math.round(player.winRate * 100)}% win</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {activeTab === 'matchups' && (
          <div className="history-stats-panel">
            {matchups.length === 0 ? (
              <p className="history-stats-empty">No matchup data yet.</p>
            ) : (
              <ul className="history-stats-list">
                {matchups.map((matchup) => (
                  <li key={matchup.id} className="history-stats-item">
                    <span>{matchup.players.join(' vs ')}</span>
                    <span>{matchup.matchesPlayed} played</span>
                    <span>{matchup.wins}W / {matchup.losses}L</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="history-stats-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatDate(value?: string): string {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
