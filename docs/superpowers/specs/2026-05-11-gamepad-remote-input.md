# Gamepad API Remote Input Design

Date: 2026-05-11

## Goal

Support Bluetooth remotes that pair to Android as HID keyboards but whose volume keys are intercepted by the OS before reaching the browser. The Gamepad API reads button state from the HID layer directly, bypassing OS interception, and is therefore more reliable on Android Chrome than keyboard event listeners.

## Problem

Bluetooth camera remotes and presentation clickers commonly pair as keyboards and emit Volume Up on button press. Android intercepts volume keys at the OS level; the browser never sees a `keydown` event. The existing keyboard remote adapter therefore cannot score points.

## Behavior

- The gamepad remote runs alongside the keyboard remote. Both are always active.
- Any button on any connected gamepad triggers the same gesture interpreter used by the keyboard remote.
- Single press → `POINT_TEAM teamA`. Double press → `POINT_TEAM teamB`. Hold (≥ 650 ms) → `UNDO`.
- Button state is polled via `requestAnimationFrame`. A transition from unpressed to pressed is a press event; pressed to unpressed is a release event.
- All connected gamepads are polled each frame. All button indices are tracked independently.
- The gesture interpreter is shared across all buttons and gamepads; simultaneous presses on different buttons are treated as a single continuous press.

## Input module (`gamepadRemote.ts`)

- `connectGamepadRemote(options)` — starts the poll loop, returns `{ disconnect() }`.
- `isGamepadSupported(nav)` — returns true when `'getGamepads' in navigator`.
- `onDiagnosticEvent` callback fires for every press and release, carrying: `source: 'gamepad'`, `type`, `gamepadIndex`, `gamepadId`, `buttonIndex`.
- Default `getGamepads` getter guards `'getGamepads' in navigator` and returns `[]` when missing, so no special test setup is needed in jsdom.

## Flush interval

Both gamepad and keyboard remotes run a 100 ms `setInterval` flush that resolves pending single-click gestures once the double-click window has elapsed.

## Double-click window

Increased from 180 ms to 400 ms to make double-pressing a physical remote button reliable.

## Testing

- `isGamepadSupported` returns true/false based on navigator shape.
- Poll dispatches nothing when no gamepads are connected.
- Button press transition dispatches `handlePress` through the gesture interpreter.
- Button release transition dispatches `handleRelease`.
- Each button index is tracked independently; pressing button 1 does not trigger button 0 events.
- Diagnostic events fire for press and release with correct metadata.
- `disconnect()` cancels the RAF loop.
