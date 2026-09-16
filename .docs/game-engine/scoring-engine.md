---
title: Game Engine — Scoring Engine & Game Types
last-updated: 2026-09-15
---

# Scoring Engine

## Overview

The game engine layer is a framework-independent module containing the core badminton scoring engine, game types, session scheduling, and match logic. It has zero React or browser dependencies and is fully unit-testable.

## Location

`src/domain/`

## Architecture

The domain module exports pure functions that operate on immutable state:

- **Types** (`matchTypes.ts`) — `MatchState`, `MatchSnapshot`, `MatchMode`, `PlayerId`, `TeamId`, `Score`, `CourtSide`, and supporting interfaces. All types use `readonly` modifiers for immutability.
- **Engine** (`matchEngine.ts`) — `createMatch()`, `scorePoint()`, `undoLastPoint()`, `swapServiceBox()` and related functions. The engine validates game rules (rally scoring to 21, deuce, service rotation, doubles positioning).
- **Tests** (`*.test.ts`) — Comprehensive unit tests covering scoring, service rotation, deuce, win conditions, undo, and edge cases.

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Pure functions, no classes | Simple to test, compose, and reason about |
| Immutable snapshots | Enables undo history by storing previous `MatchSnapshot` values |
| Framework-independent | Can be used from React, service workers, or future platforms |

## Scoring Engine

The core engine implements standard badminton rally scoring:
- Games to 21, win by 2, cap at 30
- Doubles service rotation — server and receiver change based on score parity
- Service changes after receiving team wins a rally
- Game-over detection with winner identification

### Multi-Point Undo

`MatchState` uses a `history: MatchSnapshot[]` array (not a single `previous` snapshot). Each awarded point appends a pre-point clone to history before applying scoring updates. `undoLastPoint()` restores the last snapshot from history, supporting repeated consecutive undos. Undo with empty history is a no-op. Initial-server changes before scoring do not append to history.

For backward compat: loading an old saved match with `previous` (no `history`) normalizes it into a one-entry history array.

### Match History & Snapshots

`MatchSnapshot` preserves score, serving team, server, receiver, court positions, and winner state. History snapshots are isolated from caller mutations (clone-on-save). Scoring after undo follows the restored state; undone futures are discarded.

## Session Scheduler

The session scheduler layer sits on top of the scoring engine, managing multi-match sessions for 5–8 players on one court. It has zero React dependencies and is written as pure functions.

### Rotation Algorithm

After each match, 4 players are selected for the next match:
1. Fewest total games played come on first, so court time never drifts by more than one game
2. Whoever is level with the fourth-fewest competes for the remaining slots on variety: the foursome that has shared a court least this session wins, counting partnerships and head-to-heads alike
3. Ties broken by a Fisher-Yates shuffle applied before selection
4. Break counts by player count: 4→0, 5→1, 6→2, 7→3, 8→4

Filling those slots by variety rather than by who sat out last is what keeps an even-sized roster mixing. Rotating strictly on break status sealed 8 players into two foursomes that never met (only 12 of 28 possible pairs ever shared a court) and 6 players into three fixed sit-out duos (3 of 15 possible foursomes). See [Session Matchup Diversity](../../.specs/2026/09/2026-09-15-session-matchup-diversity.md).

### Team Formation

For 4 selected players, all 3 possible 2v2 splits are scored:
- **+2** for each time proposed partners have played together this session
- **+1** for each time proposed opponents have faced each other
- Lowest repeat score wins; ties broken randomly via Fisher-Yates

A running pairing matrix tracks `togetherCount[player][player]` and `againstCount[player][player]` across the session.

### Session State

Tracked per player: total games played. Session state persists to `localStorage` with: player roster, full match history, running pairing matrix. Sessions saved by older versions also carry `consecutiveStreak` and `onBreak` per player; those fields are ignored on load.

### Manual Override

Before each match: Swap button cycles through the other 2 team splits. Change break button swaps one player in/out then re-ranks splits.

## Cloud Stats Engine

Session-signed-in users accumulate global stats in Firestore:

- **Global player Elo** — starts at 1500, updated atomically with match completion
- **Global pair Elo** — per-doubles-pair ratings
- **Matchup records** — head-to-head statistics between pairs
- **Player stats** — global match count, stats version tracking
- **Match ledger** — completed match records with final scores and timestamps

Elo updates and match records are written atomically in a Firestore transaction via `completeCloudSessionMatch`.

## Data Flow

```
User action → AppCommand → applyCommand() → matchEngine.scorePoint() → new MatchState
                                                                       → undoLastPoint() → restored MatchState
Session match end → completeCloudSessionMatch() → Firestore transaction (Elo + stats)
```

## Dependencies

- Scoring engine: none (zero external dependencies)
- Session scheduler: none (zero external dependencies)
- Cloud stats engine: Firebase Firestore (via `src/session/`)

## Related Docs

- [UI Architecture](../ui/ui-architecture.md) — how the engine connects to React components
- [Input Remotes](../input/input-remotes.md) — how user actions become commands