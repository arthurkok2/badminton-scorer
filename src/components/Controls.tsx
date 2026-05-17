import { Megaphone, RotateCcw } from 'lucide-react';

interface ControlsProps {
  readonly onUndo: () => void;
  readonly onAnnounce: () => void;
  readonly showBackToSessionSuggestion?: boolean;
  readonly onBackToSessionSuggestion?: () => void;
  readonly onEndSession?: () => void;
}

export function Controls({
  onUndo,
  onAnnounce,
  showBackToSessionSuggestion = false,
  onBackToSessionSuggestion,
  onEndSession,
}: ControlsProps) {
  const showSessionActions =
    (showBackToSessionSuggestion && onBackToSessionSuggestion !== undefined) || onEndSession !== undefined;

  return (
    <section className="controls" aria-label="Match controls">
      <div className="utility-controls live-utility-controls">
        <button className="icon-button" type="button" onClick={onUndo} aria-label="Undo last point">
          <RotateCcw size={22} aria-hidden="true" />
        </button>
        <button className="icon-button" type="button" onClick={onAnnounce} aria-label="Announce score">
          <Megaphone size={22} aria-hidden="true" />
        </button>
      </div>

      {showSessionActions ? (
        <div className="match-action-controls">
          {showBackToSessionSuggestion && onBackToSessionSuggestion !== undefined ? (
            <button className="session-secondary-button" type="button" onClick={onBackToSessionSuggestion}>
              Back to suggestion
            </button>
          ) : null}
          {onEndSession !== undefined ? (
            <button className="session-danger-button" type="button" onClick={onEndSession}>
              End session
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
