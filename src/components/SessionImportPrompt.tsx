import { useState } from 'react';
import type { GlobalPlayer } from '../session/sessionTypes';

interface SessionImportPromptProps {
  readonly legacyNames: readonly string[];
  readonly searchResults: readonly GlobalPlayer[];
  readonly onSearchPlayers: (searchText: string) => void;
  readonly onCreatePlayer: (displayName: string) => Promise<GlobalPlayer | undefined>;
  readonly onImport: (mapping: ReadonlyMap<string, GlobalPlayer>) => void;
  readonly onDismiss: () => void;
}

export function SessionImportPrompt({
  legacyNames,
  searchResults,
  onSearchPlayers,
  onCreatePlayer,
  onImport,
  onDismiss,
}: SessionImportPromptProps) {
  const [mapping, setMapping] = useState<Map<string, GlobalPlayer>>(new Map());
  const [searchingFor, setSearchingFor] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [validationError, setValidationError] = useState('');

  function handleMapPlayer(legacyName: string, player: GlobalPlayer) {
    setMapping(prev => new Map(prev).set(legacyName, player));
    setSearchingFor('');
    setSearchText('');
    onSearchPlayers('');
  }

  function handleSearchChange(value: string) {
    setSearchText(value);
    onSearchPlayers(value);
  }

  async function handleCreateAndMap(legacyName: string) {
    const trimmed = searchText.trim();
    if (!trimmed) return;
    const created = await onCreatePlayer(trimmed);
    if (created) {
      handleMapPlayer(legacyName, created);
    }
  }

  function handleImport() {
    if (mapping.size < legacyNames.length) {
      setValidationError('Please map every player before importing.');
      return;
    }
    setValidationError('');
    onImport(mapping);
  }

  return (
    <div className="session-import-prompt" role="dialog" aria-label="Import sessions">
      <h2>Import your session history</h2>
      <p>Match your local player names to global player accounts.</p>

      <ul>
        {legacyNames.map(name => (
          <li key={name}>
            <span>{name}</span>
            {mapping.has(name) ? (
              <span className="mapped-player">→ {mapping.get(name)!.displayName}</span>
            ) : (
              <button
                onClick={() => { setSearchingFor(name); setSearchText(''); }}
                aria-label={`Map ${name}`}
              >
                Map player
              </button>
            )}
          </li>
        ))}
      </ul>

      {searchingFor && (
        <div className="player-search-panel">
          <p>Mapping: <strong>{searchingFor}</strong></p>
          <label htmlFor="import-search-input">Search for player</label>
          <input
            id="import-search-input"
            type="text"
            value={searchText}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search players..."
            aria-label="Search for player"
          />
          {searchResults.map(player => (
            <button
              key={player.id}
              onClick={() => handleMapPlayer(searchingFor, player)}
              aria-label={`Select ${player.displayName}`}
            >
              {player.displayName}
            </button>
          ))}
          {searchText.trim() && (
            <button
              onClick={() => { void handleCreateAndMap(searchingFor); }}
              aria-label="Create and map player"
            >
              Create "{searchText.trim()}"
            </button>
          )}
        </div>
      )}

      {validationError && <p className="validation-error">{validationError}</p>}

      <div className="session-import-actions">
        <button onClick={handleImport} aria-label="Import sessions">Import</button>
        <button onClick={onDismiss} aria-label="Not now">Not now</button>
      </div>
    </div>
  );
}
