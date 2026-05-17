# Session Match History Design

## Context

Session mode currently records completed matches as team assignments plus the winning team. The live scorer can return to the next-match suggestion after a session match ends, but there is no visible session match history and no recorded match duration.

This change adds a compact match history for session mode and records completed match duration. It does not add per-player statistics.

## User Experience

Session mode shows a match history section once at least one session match has been completed.

On the next-match suggestion screen, history is always visible below the suggested match. This is the between-games review point, so the user can see what has already been played before starting the next match.

On the live session scoring screen, history is visible by default and controlled by a Display settings toggle. The toggle label is "Show session match history during live matches". Turning it off hides only the live-screen history; the suggestion-screen history remains visible.

Each history row shows:

- Match number.
- Team A players versus Team B players.
- Winner.
- Final score.
- Duration in minutes.

Rows are ordered newest first so the last completed match is closest to the current context.

## Duration Tracking

When a suggested session match starts, the app records a start timestamp for that in-progress session match. When the user confirms the completed match and advances to the next suggestion, the app records an end timestamp and stores both timestamps on the completed session match record. The same completion step stores the final Team A and Team B scores from the live scorer.

Duration is derived from `endedAt - startedAt` and formatted as whole minutes. Durations under one minute display as "<1 min". If either timestamp is missing or invalid, the row renders with an unavailable duration rather than failing.

Existing active sessions and archived sessions may contain legacy match records without timestamps or final scores. These records remain valid and render with unavailable duration text while omitting the final-score label.

## Data Model

`MatchRecord` gains optional timestamp fields:

```ts
interface MatchRecord {
  readonly teamA: readonly [string, string];
  readonly teamB: readonly [string, string];
  readonly winnerTeam: 'teamA' | 'teamB';
  readonly finalScore?: {
    readonly teamA: number;
    readonly teamB: number;
  };
  readonly startedAt?: string;
  readonly endedAt?: string;
}
```

No localStorage migration is required because the new fields are optional.

## Components

A new reusable `SessionMatchHistory` component renders the completed match list. It accepts the session match records and handles empty, legacy, and timestamped records internally.

`MatchSuggestion` receives the completed session matches and renders history below its secondary actions.

The live scorer render path in `App` renders the same component when:

- `appMode === 'session'`.
- `sessionPhase === 'playing'`.
- At least one completed session match exists.
- The display preference is enabled.

## Preferences

`AppPreferences` gains `showSessionHistoryDuringLiveMatches`, defaulting to `true`.

Preference parsing treats missing or non-boolean values as the default. This preserves existing users and keeps the feature enabled unless they opt out.

The Display settings modal adds a second switch for this preference next to the existing animations switch.

## Testing

Tests cover:

- Applying a session match result stores `startedAt` and `endedAt` when supplied.
- Match history renders teams, winner, match number, final score, and formatted duration.
- Legacy match records without timestamps render without crashing.
- Legacy match records without final scores render without crashing and omit score text.
- The suggestion screen always shows completed session history.
- The live session screen shows history by default.
- The Display settings toggle hides live session history while leaving suggestion-screen history unaffected.

## Non-Goals

- Per-player statistics.
- In-progress live match elapsed time.
- Editing, deleting, filtering, or exporting match history.
