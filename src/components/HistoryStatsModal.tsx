import { useState } from 'react';

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
  readonly matchCount: number;
}

interface HistoryStatsModalProps {
  readonly sessions: readonly SessionSummaryEntry[];
  readonly players: readonly PlayerLeaderboardEntry[];
  readonly pairs: readonly PairLeaderboardEntry[];
  readonly matchups: readonly MatchupEntry[];
  readonly onClose: () => void;
}

type TabId = 'sessions' | 'players' | 'pairs' | 'matchups';

const TABS: readonly { id: TabId; label: string }[] = [
  { id: 'sessions', label: 'Sessions' },
  { id: 'players', label: 'Players' },
  { id: 'pairs', label: 'Pairs' },
  { id: 'matchups', label: 'Matchups' },
];

export function HistoryStatsModal({ sessions, players, pairs, matchups, onClose }: HistoryStatsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('sessions');

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
        {activeTab === 'sessions' && (
          <div className="history-stats-panel">
            {sessions.length === 0 ? (
              <p className="history-stats-empty">No sessions recorded yet.</p>
            ) : (
              <ul className="history-stats-list">
                {sessions.map((session) => (
                  <li key={session.id} className="history-stats-item">
                    <span>{session.startedAt ?? 'Unknown date'}</span>
                    <span>{session.matchCount} matches</span>
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
                    <span className="history-stats-player-name">{player.displayName}</span>
                    <span className="history-stats-player-elo">{player.elo}</span>
                    <span>{player.matchesPlayed} played</span>
                    <span>{Math.round(player.winRate * 100)}% win</span>
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
                    <span>{pair.displayNames.join(' & ')}</span>
                    <span>{pair.elo}</span>
                    <span>{pair.matchesPlayed} played</span>
                  </li>
                ))}
              </ul>
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
