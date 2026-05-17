interface DisplaySettingsModalProps {
  readonly animationsEnabled: boolean;
  readonly showSessionHistoryDuringLiveMatches: boolean;
  readonly onAnimationsEnabledChange: (enabled: boolean) => void;
  readonly onShowSessionHistoryDuringLiveMatchesChange: (enabled: boolean) => void;
}

export function DisplaySettingsModal({
  animationsEnabled,
  showSessionHistoryDuringLiveMatches,
  onAnimationsEnabledChange,
  onShowSessionHistoryDuringLiveMatchesChange,
}: DisplaySettingsModalProps) {
  return (
    <div className="settings-panel">
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
