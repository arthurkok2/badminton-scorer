# Remote Input Diagnostics Log Design

Date: 2026-05-11

## Goal

Provide a unified, on-screen event log showing raw input from both keyboard and gamepad remote sources, so the user can verify whether a Bluetooth remote is being detected and which input path it is using.

## Behavior

- The log panel is collapsed by default. The user taps the "Remote input log" header to expand it.
- The log shows up to 10 events, newest first, from both keyboard and gamepad sources interleaved.
- Each event row is prefixed with its source: `[key]` for keyboard events, `[gamepad]` for gamepad events.
- Keyboard rows show: type (`keydown`/`keyup`), key name, code, keyCode, which, repeat flag.
- Gamepad rows show: type (`press`/`release`), pad index, button index, device ID (truncated to 30 characters).
- When no events have been seen, the panel shows "No events seen yet".

## Implementation

- `RemoteDiagnostics` component in `App.tsx` uses a native `<details>`/`<summary>` element. No JavaScript state is needed for collapse behavior.
- The summary marker is hidden via `list-style: none` and `::-webkit-details-marker: display: none`.
- Diagnostic state is `DiagnosticEvent[]` — a union of `({ source: 'keyboard' } & KeyboardRemoteDiagnosticEvent) | GamepadRemoteDiagnosticEvent`.
- Keyboard events are wrapped with `source: 'keyboard'` when passed to the shared state setter.
- Both keyboard and gamepad remote `onDiagnosticEvent` callbacks append to the same state array, capped at 10.

## Layout

- The panel sits below the Controls section, above nothing — it is the last element on the page.
- This keeps it out of the primary interaction area while still accessible for debugging.

## Testing

- Keyboard events appear in the log with `[key]` prefix.
- Gamepad events appear in the log with `[gamepad]` prefix, pad index, and button index.
- Gamepad remote connects on mount and disconnects on unmount.
