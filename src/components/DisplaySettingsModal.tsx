interface DisplaySettingsModalProps {
  readonly animationsEnabled: boolean;
  readonly onAnimationsEnabledChange: (enabled: boolean) => void;
}

export function DisplaySettingsModal({ animationsEnabled, onAnimationsEnabledChange }: DisplaySettingsModalProps) {
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
    </div>
  );
}
