interface DisplaySettingsModalProps {
  readonly displayMode: 'court' | 'little-fighters';
  readonly animationsEnabled: boolean;
  readonly showSessionHistoryDuringLiveMatches: boolean;
  readonly onDisplayModeChange: (displayMode: 'court' | 'little-fighters') => void;
  readonly onAnimationsEnabledChange: (enabled: boolean) => void;
  readonly onShowSessionHistoryDuringLiveMatchesChange: (enabled: boolean) => void;
}

export function DisplaySettingsModal({
  displayMode,
  animationsEnabled,
  showSessionHistoryDuringLiveMatches,
  onDisplayModeChange,
  onAnimationsEnabledChange,
  onShowSessionHistoryDuringLiveMatchesChange,
}: DisplaySettingsModalProps) {
  return (
    <div className="settings-panel">
      <fieldset className="settings-group">
        <legend>Display mode</legend>
        <div className="mode-toggle" role="radiogroup" aria-label="Display mode">
          <button
            type="button"
            className={displayMode === 'court' ? 'mode-button is-active' : 'mode-button'}
            role="radio"
            aria-checked={displayMode === 'court'}
            aria-label="Court display"
            onClick={() => onDisplayModeChange('court')}
          >
            Court
          </button>
          <button
            type="button"
            className={displayMode === 'little-fighters' ? 'mode-button is-active' : 'mode-button'}
            role="radio"
            aria-checked={displayMode === 'little-fighters'}
            aria-label="Little fighters display"
            onClick={() => onDisplayModeChange('little-fighters')}
          >
            Little fighters
          </button>
        </div>
      </fieldset>
      <button
        type="button"
        className={animationsEnabled ? 'toggle-button is-on' : 'toggle-button'}
        role="switch"
        aria-checked={animationsEnabled}
        aria-label="Animations"
        onClick={() => onAnimationsEnabledChange(!animationsEnabled)}
      >
        Animations
      </button>
      <button
        type="button"
        className={showSessionHistoryDuringLiveMatches ? 'toggle-button is-on' : 'toggle-button'}
        role="switch"
        aria-checked={showSessionHistoryDuringLiveMatches}
        aria-label="Show session match history during live matches"
        onClick={() => onShowSessionHistoryDuringLiveMatchesChange(!showSessionHistoryDuringLiveMatches)}
      >
        Show session match history during live matches
      </button>
    </div>
  );
}
