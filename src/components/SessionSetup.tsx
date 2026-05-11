import { useState } from 'react';

interface SessionSetupProps {
  readonly savedPlayers: readonly string[];
  readonly onStartSession: (playerNames: readonly string[]) => void;
}

export function SessionSetup({ savedPlayers, onStartSession }: SessionSetupProps) {
  const [players, setPlayers] = useState<string[]>([]);
  const [nameInput, setNameInput] = useState('');

  function addPlayer(name: string) {
    const trimmed = name.trim();
    if (!trimmed || players.includes(trimmed)) return;
    setPlayers(prev => [...prev, trimmed]);
    setNameInput('');
  }

  function removePlayer(name: string) {
    setPlayers(prev => prev.filter(p => p !== name));
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
            {savedPlayers.map(name => (
              <button key={name} className="session-player-chip" onClick={() => addPlayer(name)} aria-label={`Add ${name}`}>
                {name}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="session-section" aria-label="Add player">
        <h3>Add player</h3>
        <div className="session-add-player">
          <label htmlFor="player-name-input">Player name</label>
          <input
            id="player-name-input"
            type="text"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addPlayer(nameInput); }}
            placeholder="Type a name..."
          />
          <button className="session-secondary-button" onClick={() => addPlayer(nameInput)} aria-label="Add">Add</button>
        </div>
      </section>

      <section className="session-section" aria-label="Selected players">
        <div className="session-section-title-row">
          <h3>Selected players</h3>
          <span>{players.length}/4 minimum</span>
        </div>
        {players.length > 0 ? (
          <ol className="session-player-list">
            {players.map(name => (
              <li key={name}>
                <span>{name}</span>
                <button className="session-danger-button" onClick={() => removePlayer(name)} aria-label={`Remove ${name}`}>Remove</button>
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
