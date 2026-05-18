import { useState } from 'react';
import type { GlobalPlayer } from '../session/sessionTypes';

interface SessionSetupProps {
  readonly savedPlayers: readonly GlobalPlayer[];
  readonly searchResults: readonly GlobalPlayer[];
  readonly onSearchPlayers: (searchText: string) => void;
  readonly onCreatePlayer: (displayName: string) => Promise<GlobalPlayer | undefined>;
  readonly onStartSession: (players: readonly GlobalPlayer[]) => void;
}

export function SessionSetup({
  savedPlayers,
  searchResults,
  onSearchPlayers,
  onCreatePlayer,
  onStartSession,
}: SessionSetupProps) {
  const [players, setPlayers] = useState<GlobalPlayer[]>([]);
  const [nameInput, setNameInput] = useState('');

  function addPlayer(player: GlobalPlayer) {
    if (players.some(p => p.id === player.id)) return;
    setPlayers(prev => [...prev, player]);
  }

  function removePlayer(id: string) {
    setPlayers(prev => prev.filter(p => p.id !== id));
  }

  function handleSearchChange(value: string) {
    setNameInput(value);
    onSearchPlayers(value);
  }

  async function handleCreatePlayer() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    const created = await onCreatePlayer(trimmed);
    if (created) {
      addPlayer(created);
      setNameInput('');
      onSearchPlayers('');
    }
  }

  return (
    <section className="session-setup" aria-label="Session setup">
      <div className="session-panel-header">
        <span>Session mode</span>
        <h2>Session setup</h2>
      </div>

      {savedPlayers.length > 0 && (
        <section className="session-section" aria-label="Saved players">
          <h3>Saved players</h3>
          <div className="session-player-chips">
            {savedPlayers.map(player => (
              <button
                key={player.id}
                className="session-player-chip"
                onClick={() => addPlayer(player)}
                aria-label={`Add ${player.displayName}`}
              >
                {player.displayName}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="session-section" aria-label="Player search">
        <h3>Add player</h3>
        <div className="session-add-player">
          <label htmlFor="player-search-input">Player search</label>
          <input
            id="player-search-input"
            type="text"
            aria-label="Player search"
            value={nameInput}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search players..."
          />
          {nameInput.trim() && (
            <button
              className="session-secondary-button"
              aria-label="Create player"
              onClick={() => { void handleCreatePlayer(); }}
            >
              Create player
            </button>
          )}
        </div>
        {searchResults.length > 0 && (
          <div className="session-player-chips">
            {searchResults.map(player => (
              <button
                key={player.id}
                className="session-player-chip"
                onClick={() => addPlayer(player)}
                aria-label={`Add ${player.displayName}`}
              >
                {player.displayName}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="session-section" aria-label="Selected players">
        <div className="session-section-title-row">
          <h3>Selected players</h3>
          <span>{players.length}/4 minimum</span>
        </div>
        {players.length > 0 ? (
          <ol className="session-player-list">
            {players.map(player => (
              <li key={player.id}>
                <span>{player.displayName}</span>
                <button
                  className="session-danger-button"
                  onClick={() => removePlayer(player.id)}
                  aria-label={`Remove ${player.displayName}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="session-empty">No players selected</p>
        )}
      </section>

      <p className="session-player-count">
        {players.length} player{players.length !== 1 ? 's' : ''} selected
      </p>

      <button
        className="session-primary-button session-start-button"
        disabled={players.length < 4}
        onClick={() => onStartSession(players)}
      >
        Start session
      </button>
    </section>
  );
}
