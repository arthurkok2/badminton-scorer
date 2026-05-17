# Account And Settings Menu Revamp Design

## Goal

Revamp the top-right account and settings area so account identity remains separate from app tools. Users must be able to open settings and app tools without signing in, while live match actions remain immediately reachable on the scorer.

## Current Context

The app currently renders a global account row through `AccountBar` and `SignInButton`. Anonymous users see only a "Sign in with Google" button. Signed-in users see an avatar dropdown with profile details, a disabled Settings item, and Sign out.

Match setup, announcement preferences, animations, session mode, remote controls, device status, and diagnostics are currently shown in the main scorer layout through `Controls`, `StatusBar`, `WatchRemotePanel`, and `RemoteDiagnostics`.

## Top Bar

The top app bar will render two compact controls on the right:

- Account avatar button.
- Settings gear button.

The account avatar is always present after auth loading completes. Signed-in users see their Google photo or initials. Anonymous users see a neutral fallback avatar. If auth is unavailable, the avatar still opens an account menu that explains sign-in is unavailable offline.

The gear button is available regardless of sign-in state. It opens the app tools menu.

## Account Menu

The avatar opens an account-focused dropdown:

- Signed-in state: profile photo or initials, display name or email, email when available, and Sign out.
- Anonymous state: neutral identity label and Sign in with Google.
- Auth unavailable state: neutral identity label and a muted unavailable/offline message.

The account menu must not contain app settings. It closes on outside pointer interaction, Escape, and after activating Sign in or Sign out.

## App Tools Menu

The gear opens a settings-focused dropdown. Items either open a focused modal or trigger an existing top-level flow:

- Match settings.
- Announcement settings.
- Display settings.
- Remote controls.
- Diagnostics.
- Session mode.
- New match.

Activating an item closes the dropdown first. Session mode switches to the existing full-screen session setup/suggestion flow. New match uses the existing discard confirmation behavior when the current match has started.

Task 2 implementation adds the shared gear menu action contract and modal shell. App-level gear actions open temporary focused modal placeholders or route to the existing Session mode and New match flows until later tasks replace placeholder bodies with real modal components.

## Main Screen Boundary

Controls used during normal match play stay on the main scorer:

- Point scoring on the court.
- Undo.
- Manual announce score.
- Session-playing actions that are part of live flow, including "Back to suggestion" before the first rally and "End session".

Configuration and lower-frequency tools move behind the gear menu:

- Singles/doubles mode.
- Player names.
- First-server setup and reroll.
- Auto announce.
- Full/short announcement mode.
- Animations.
- Bluetooth remote status/connect.
- Watch remote hosting/status/code/end controls.
- Remote diagnostics log.

This keeps active scoring fast while reducing persistent visual weight on the phone-first layout.

## Focused Modals

Only one modal can be open at a time. Modals close on Escape, backdrop click, and explicit close buttons. Modal content must fit narrow phone screens without horizontal overflow.

### Match Settings

Contains pre-match match configuration:

- Singles/doubles selector.
- Player name editor when available.
- First-server reroll and manual first-server controls when available.

Existing confirmation behavior for changing mode after a match has started remains unchanged.

### Announcement Settings

Contains speech announcement configuration only:

- Auto announce toggle.
- Full/short announcement selector.
- Speech support status.

Manual "Announce score" stays on the main screen because it is a during-match action.

### Display Settings

Contains visual display preferences:

- Animations toggle.

### Remote Controls

Contains remote connection and hosting controls:

- Bluetooth remote status.
- Connect Bluetooth remote action.
- Watch remote start/status/code/last-command/error/end controls.
- Auth or offline limitation messaging for watch remote hosting.

### Diagnostics

Contains the remote input log currently exposed by `RemoteDiagnostics`. The log should be expanded inside the modal rather than hidden behind a page-level details panel.

## Component Boundaries

State ownership remains in `App`, where preferences, match state, session state, Bluetooth connection, watch remote hosting, and diagnostics already live.

New or revised presentational components:

- `AccountMenu`: account avatar and account dropdown.
- `AppMenu`: gear button and app tools dropdown.
- `AppModal`: shared modal shell.
- `MatchSettingsModal`.
- `AnnouncementSettingsModal`.
- `DisplaySettingsModal`.
- `RemoteControlsModal`.
- `DiagnosticsModal`.

`Controls` keeps only live match actions. `StatusBar`, `WatchRemotePanel`, and `RemoteDiagnostics` can either be reused inside modal bodies or lightly adapted into smaller presentational pieces if that keeps props clear.

## Behavior

- Auth is not required to open the gear menu or any settings modal.
- Opening a modal closes any open dropdown.
- Opening one modal closes any previous modal.
- Account and gear menus close on outside pointer interaction and Escape.
- Existing confirmation prompts remain the authority for destructive or mode-switching actions.
- Session mode remains a full-screen flow, not a modal.

## Accessibility

Avatar and gear buttons must have descriptive accessible names. Dropdowns use menu semantics when practical. Modal shells use dialog semantics, set an accessible title, and return focus to the launching control on close where feasible.

Keyboard users must be able to open menus, activate menu items, close dropdowns/modals with Escape, and reach every modal control.

## Testing

Add or update tests to cover:

- Anonymous users can open the account menu and see Sign in with Google.
- Signed-in users can open the account menu and sign out.
- Auth-unavailable users still see an account menu state without app settings disappearing.
- Anonymous users can open the gear menu.
- Gear menu items open the correct modal or trigger the correct top-level flow.
- Auto announce, announcement mode, animations, match mode, player names, first-server setup, Bluetooth connect, watch remote hosting, and diagnostics remain wired to existing callbacks/state.
- Undo and manual announce remain visible on the main scorer.
- Former page-level settings and remote panels no longer render persistently on the main scorer when moved into modals.

## Out Of Scope

- New settings persistence keys beyond the existing preferences.
- A dedicated settings route.
- Reworking the session scheduler flow.
- Requiring account sign-in for local settings, local scoring, or local remotes.

## Implementation Notes (code review fixes, 2026-05-17)

- `settingsLocked` in `App.tsx` is `true` only when both `appMode === 'session'` AND `sessionPhase === 'playing'`, preventing spurious lock during setup and suggestion phases.
- `sessionPlayerNames` is computed via `useMemo` (deps: `[appMode, match.teams]`) so the player-list scan runs once per render cycle rather than four times inline.
- `matchSettings` menu item uses `Settings2` icon (not `Users`) so it is visually distinct from the `sessionMode` item.
- The app tools dropdown has `role="menu"` and each item button has `role="menuitem"` per the accessibility spec.

## Implementation Notes (Task 4, 2026-05-17)

- `AnnouncementSettingsModal` renders an auto-announce toggle (`role="switch"`), a full/short mode selector (`role="group"` with two `role="button"` options), and a speech status note. It imports `AnnouncementMode` and `SpeechStatus` from `../speech/announcer`.
- `DisplaySettingsModal` renders a single animations toggle (`role="switch"`).
- Both modals receive all needed state and callbacks as props from `App`; no local state is needed.
- `activeModalDialog` in `App` was updated to replace the placeholder `<p>` with proper modal components for `announcementSettings` and `displaySettings` cases.
- `Controls` required no changes — auto-announce, mode, and animations toggles were never rendered inline there (they had been removed in an earlier cleanup).
- The `StatusBar` also renders "Speech ready" text, so the App test for the announcement settings dialog scopes the assertion to `within(dialog)` to avoid an ambiguous match.

## Implementation Notes (Task 5, 2026-05-17)

- `RemoteControlsModal` receives `bluetoothStatus`, `watchRemote` (status/code/error/lastCommandLabel), `authUnavailable`, and three callbacks: `onConnectBluetooth`, `onStartWatchRemote`, `onStopWatchRemote`. It replicates `StatusBar` Bluetooth UI and `WatchRemotePanel` watch-remote UI inside a `settings-panel` layout.
- `DiagnosticsModal` accepts a `readonly DiagnosticEvent[]` and renders either an empty-state paragraph or an ordered list of keyboard and gamepad events, matching the existing `RemoteDiagnostics` output format.
- `DiagnosticEvent` type is defined and exported from `DiagnosticsModal.tsx`; `App.tsx` imports it from there instead of declaring it locally. The local `RemoteDiagnostics` function and local `DiagnosticEvent` type alias were removed from `App.tsx`.
- `StatusBar` and `WatchRemotePanel` imports were removed from `App.tsx`; the components are no longer rendered in the main scorer layout. Their source files are unchanged.
- `activeModalDialog` in `App` covers all five modal cases: `matchSettings`, `announcementSettings`, `displaySettings`, `remoteControls`, `diagnostics`. No placeholder `<p>` remains.
- App tests for Bluetooth, watch-remote, and diagnostic events were updated to open the corresponding modal via `openRemoteControls` or `openDiagnostics` helpers before querying. Three new "not on main screen" tests assert that Bluetooth connect button, diagnostics log, and active watch-remote code are absent from the main scorer layout.

## Implementation Notes (Task 6, 2026-05-17)

- CSS utility classes added to `styles.css`: `.settings-panel` (grid layout for modal body content), `.settings-section` (bordered, dark-background grouping card with gap), `.settings-section h3` (muted uppercase section label), and `.live-utility-controls` (2-column icon-button layout override for non-session match controls).
- The `.settings-note` rule already existed; it was not duplicated or modified.
- All three integration tests specified for this task were already covered by pre-existing tests in `App.test.tsx` (anonymous match settings open, session mode start, new match with confirmation). No duplicate tests were added.
