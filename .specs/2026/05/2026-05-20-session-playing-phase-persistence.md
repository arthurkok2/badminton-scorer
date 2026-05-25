---
title: Session Playing Phase Persistence
author: arthur.kok
date: 2026-05-20
status: implemented
tags: [data, persistence]
domain: data
---

# Session Playing Phase Persistence

## Problem

When a user was in session mode and had started a match (`sessionPhase === 'playing'`), refreshing the page would drop them back to the suggestion screen instead of resuming the in-progress match.

**Root cause:** `sessionPhase` and `currentPlayedSplit` / `currentSessionMatchStartedAt` were purely in-memory state. On init, App.tsx only checked whether an `ActiveSession` existed in localStorage to determine phase — defaulting to `'suggestion'` even if the user was mid-match.

## Solution

Persist a minimal "in-progress match state" blob to localStorage whenever a session match starts, and clear it when the match ends, is abandoned, or the session exits.

### New localStorage key

`badminton-scorer-in-progress-match` — stores `{ split: TeamSplit, startedAt: string }`.

### sessionStorage.ts additions

- `InProgressMatchState` interface
- `loadInProgressMatchState()` — returns `InProgressMatchState | undefined`
- `saveInProgressMatchState(state)` — writes to localStorage
- `clearInProgressMatchState()` — removes the key

### App.tsx changes

**Initialization:**
- `sessionPhase` now initialises to `'playing'` if both `loadActiveSession()` and `loadInProgressMatchState()` return data; otherwise falls back to `'suggestion'` / `'setup'` as before.
- `currentPlayedSplit` initialises from `loadInProgressMatchState()?.split`.
- `currentSessionMatchStartedAt` initialises from `loadInProgressMatchState()?.startedAt`.

**Save:** `handleStartMatch` calls `saveInProgressMatchState({ split, startedAt })` before setting React state.

**Clear** (all exit paths from `'playing'`):
- `handleMatchEnded` — match completed normally
- `handleEndSession` — user ends session mid-match
- `handleSwitchToMatch` — user exits session mode
- `handleBackToSessionSuggestion` — user goes back before any points scored

## Behaviour after refresh

| State before refresh | Phase after refresh |
|---|---|
| Session not started | `setup` |
| Session started, between matches | `suggestion` |
| Session started, match in progress | `playing` (match score restored from existing `matchState` persistence) |

