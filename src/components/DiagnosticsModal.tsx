import type { GamepadRemoteDiagnosticEvent } from '../input/gamepadRemote';
import type { KeyboardRemoteDiagnosticEvent } from '../input/keyboardRemote';

export type DiagnosticEvent = ({ source: 'keyboard' } & KeyboardRemoteDiagnosticEvent) | GamepadRemoteDiagnosticEvent;

interface DiagnosticsModalProps {
  readonly events: readonly DiagnosticEvent[];
}

export function DiagnosticsModal({ events }: DiagnosticsModalProps) {
  if (events.length === 0) {
    return <p className="remote-diagnostics-empty">No events seen yet</p>;
  }

  return (
    <ol className="remote-diagnostics-list">
      {events.map((event, index) =>
        event.source === 'gamepad' ? (
          <li key={`gamepad-${event.type}-${event.gamepadIndex}-${event.buttonIndex}-${index}`}>
            <strong>[gamepad] {event.type}</strong>
            <span>Pad {event.gamepadIndex}</span>
            <span>Btn {event.buttonIndex}</span>
            <span title={event.gamepadId}>{event.gamepadId.slice(0, 30)}</span>
          </li>
        ) : (
          <li key={`keyboard-${event.type}-${event.key}-${event.code}-${event.keyCode}-${index}`}>
            <strong>[key] {event.type}</strong>
            <span>Key {event.key || 'Unidentified'}</span>
            <span>Code {event.code || 'none'}</span>
            <span>KeyCode {event.keyCode}</span>
            <span>Which {event.which}</span>
            <span>Repeat {event.repeat ? 'yes' : 'no'}</span>
          </li>
        ),
      )}
    </ol>
  );
}
