---
title: Session Auth Gate and Global Player Picker
author: arthur.kok
date: 2026-05-18
status: implemented
tags: [ui, display]
domain: ui
---

# Session Auth Gate and Global Player Picker

## Overview

Session mode now requires a signed-in (non-anonymous) Google account and uses `GlobalPlayer` objects (not plain strings) throughout the session setup flow.

## Changes

### Auth Gate

- `handleSwitchToSession` in `App.tsx` checks `user && !isAnonymous` before entering session mode.
- If not signed in, opens a `sessionSignIn` modal prompting the user to sign in with Google.
- The modal title is "Sign in required" and shows a "Sign in with Google" button.

### SessionSetup Component (rewritten)

**New props interface:**
```ts
interface SessionSetupProps {
  readonly savedPlayers: readonly GlobalPlayer[];
  readonly searchResults: readonly GlobalPlayer[];
  readonly onSearchPlayers: (searchText: string) => void;
  readonly onCreatePlayer: (displayName: string) => Promise<GlobalPlayer | undefined>;
  readonly onStartSession: (players: readonly GlobalPlayer[]) => void;
}
```

**UI changes:**
- Text input is now a "Player search" input (aria-label and label both set).
- On each keystroke, calls `onSearchPlayers(value)` (no debounce in component).
- `searchResults` shown as chips with "Add [name]" buttons.
- `savedPlayers` shown as chips with "Add [name]" buttons.
- Duplicate prevention is by `player.id` (not display name).
- "Create player" button appears only when `nameInput.trim()` is non-empty; calls `onCreatePlayer(searchText)`.
- `onStartSession` receives `GlobalPlayer[]`.

### App.tsx wiring

- `handleStartSession` now accepts `readonly GlobalPlayer[]` and calls `createSession(players)`.
- `handleSearchPlayers` calls `searchGlobalPlayers({ searchText })` and updates `playerSearchResults` state.
- `handleCreatePlayer` calls `createGlobalPlayerDocument({ displayName, uid: user.uid })`.
- `savedPlayers` (legacy string array) removed; `SessionSetup` receives `savedPlayers={[]}` for now.
- `AppModal` union type extended with `'sessionSignIn'`.

## Deferred

- Loading saved global players from previous sessions (planned for a later task).
- Debouncing the player search (can be added in App.tsx callback in a later task).

