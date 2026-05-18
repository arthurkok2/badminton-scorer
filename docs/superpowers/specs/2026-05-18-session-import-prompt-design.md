# Session Import Prompt — Legacy Mapping Flow

**Date:** 2026-05-18
**Branch:** codex/global-session-history-stats

## Overview

When a signed-in (non-anonymous) user has local session history that has not yet been associated with global player accounts, an import prompt is shown. The prompt lets the user map each legacy player name to a `GlobalPlayer` record — either by searching existing global players or creating a new one.

## Components

### `SessionImportPrompt` (`src/components/SessionImportPrompt.tsx`)

A self-contained mapping UI rendered as a `role="dialog"`.

**Props:**
- `legacyNames: readonly string[]` — distinct player display names found in unimported sessions
- `searchResults: readonly GlobalPlayer[]` — live search results fed from parent
- `onSearchPlayers(text)` — called when the user types in the search box
- `onCreatePlayer(displayName)` — creates and returns a new `GlobalPlayer`
- `onImport(mapping: ReadonlyMap<string, GlobalPlayer>)` — called when all names are mapped and the user confirms
- `onDismiss()` — called when the user clicks "Not now"

**Validation:** the Import button blocks and shows an error message (`/map every player/i`) until every legacy name has a mapping.

## App.tsx integration

### Detection effect (`useEffect` on `[user, isAnonymous]`)

On every sign-in transition (after auth loads):
1. Load `loadSessionArchive()` and `loadActiveSession()`.
2. Collect all sessions whose `players` field exists and are not yet marked imported for `user.uid` via `isSessionImportedForUser`.
3. Accumulate unique `displayName` values.
4. If any exist, set `importLegacyNames` and `showImportPrompt = true`.

### `handleImportSessions`

Marks every session with a `players` field as imported for the current user (`markSessionImportedForUser`). Hides the prompt. Cloud write of the mapping is reserved for a future task.

### `handleDismissImport`

Sets `showImportPrompt = false`. The prompt will not reappear until the next sign-in / page reload because detection runs only when `user` changes.

### Render positions

The `SessionImportPrompt` is rendered in all three App return branches (session setup, session suggestion, and main match/session-playing view) when `showImportPrompt` is true.

## Tests

- `src/components/SessionImportPrompt.test.tsx` — unit tests for the component in isolation
  - Import button blocked when not all names are mapped
  - Dismiss calls `onDismiss` without calling `onImport`
- `src/App.test.tsx` — integration test
  - Mocks `loadSessionArchive` and `isSessionImportedForUser` to simulate an unimported session; asserts heading appears
