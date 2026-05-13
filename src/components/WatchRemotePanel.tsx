import type { WatchRemoteHostStatus } from '../remote/firestoreRemoteTypes';

interface WatchRemotePanelProps {
  readonly status: WatchRemoteHostStatus;
  readonly code?: string;
  readonly error?: string;
  readonly lastCommandLabel?: string;
  readonly authUnavailable?: boolean;
  readonly onStart: () => void;
  readonly onStop: () => void;
}

export function WatchRemotePanel({
  status,
  code,
  error,
  lastCommandLabel,
  authUnavailable = false,
  onStart,
  onStop,
}: WatchRemotePanelProps) {
  return (
    <div className="watch-remote-panel" aria-label="Watch remote">
      {status === 'inactive' && (
        <div className="watch-remote-actions">
          <button type="button" onClick={onStart} disabled={authUnavailable}>
            Start watch remote
          </button>
        </div>
      )}

      {status === 'starting' && (
        <div className="watch-remote-status">
          <span>Starting…</span>
        </div>
      )}

      {status === 'active' && (
        <>
          {code && <div className="watch-remote-code">{code}</div>}
          {lastCommandLabel && (
            <div className="watch-remote-status">Last: {lastCommandLabel}</div>
          )}
          <div className="watch-remote-actions">
            <button type="button" onClick={onStop}>
              End remote
            </button>
          </div>
        </>
      )}

      {status === 'stopping' && (
        <div className="watch-remote-status">
          <button type="button" disabled>
            Stopping…
          </button>
        </div>
      )}

      {status === 'error' && (
        <>
          {error && <div className="watch-remote-status" role="alert">{error}</div>}
          <div className="watch-remote-actions">
            <button type="button" onClick={onStart} disabled={authUnavailable}>
              Start watch remote
            </button>
          </div>
        </>
      )}
    </div>
  );
}
