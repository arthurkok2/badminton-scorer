# Cloud Session History and Stats Design

**Date:** 2026-05-18

## Goal

Add signed-in session history management with cloud persistence, player and pair statistics, matchup records, and individual plus doubles-pair Elo ratings. Signed-out users continue to use local session mode. When a user signs in, the app asks before importing local session data into that account.

## Scope

This design covers session mode only. Normal one-off match mode remains local and does not affect history, statistics, or ratings.

The feature is available only to named Firebase users. Signed-out users can still start and complete local sessions, but they cannot view cloud history, player statistics, pair statistics, matchup statistics, or Elo ratings.

## Current State

Session mode currently stores data in localStorage:

- `badminton-scorer-active-session` for the active session.
- `badminton-scorer-session-archive` for completed local sessions.
- `badminton-scorer-saved-players` for remembered player names.

Firebase Authentication already supports named Google sign-in. Firestore currently stores remote-control room data under `matches/{code}` and security rules restrict remote writes to named users. There is no user-owned Firestore data model for session history yet.

The project Firestore database is `projects/badminton-scorer-91f7d/databases/(default)`, edition `STANDARD`, type `FIRESTORE_NATIVE`.

## Firestore Data Model

Add a user-owned tree. All documents live under `users/{uid}` and are readable/writable only by the matching named user.

### `users/{uid}`

Stores lightweight profile metadata for the session-history feature.

| Field | Type | Notes |
|---|---|---|
| `uid` | string | Must match document id and `request.auth.uid`. |
| `createdAt` | timestamp | Server timestamp on first create. |
| `updatedAt` | timestamp | Server timestamp on writes. |
| `statsVersion` | number | Starts at `1`; used for future recalculation migrations. |

### `users/{uid}/sessions/{sessionId}`

Stores active and completed session metadata.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Same as document id. |
| `status` | string | `active` or `completed`. |
| `startedAt` | string | ISO timestamp from the session engine. |
| `endedAt` | string? | Present when completed. |
| `players` | list | Session roster with names, games played, and breaks taken where available. |
| `matchCount` | number | Number of completed matches in this session. |
| `source` | string | `cloud`, `local-import`, or `local-active-import`. |
| `importedAt` | timestamp? | Server timestamp for imported local sessions. |
| `createdAt` | timestamp | Server timestamp. |
| `updatedAt` | timestamp | Server timestamp. |

The session document is enough to list sessions without reading every match.

### `users/{uid}/sessions/{sessionId}/matches/{matchId}`

Stores completed session matches. A match document is immutable after creation except for future administrative repair paths, which are out of scope for this feature.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable client-generated id. |
| `sessionId` | string | Parent session id. |
| `matchNumber` | number | One-based order within the session. |
| `teamA` | list | Two player names. |
| `teamB` | list | Two player names. |
| `winnerTeam` | string | `teamA` or `teamB`. |
| `finalScore` | map? | `{ teamA: number, teamB: number }` when available. |
| `startedAt` | string? | ISO timestamp. |
| `endedAt` | string? | ISO timestamp. |
| `individualElo` | map | Before/after/delta per player. |
| `pairElo` | map | Before/after/delta per pair. |
| `createdAt` | timestamp | Server timestamp. |

Each match stores Elo snapshots so old history remains explainable if the rating algorithm changes in a future stats version.

### `users/{uid}/stats/summary`

Stores derived statistics for fast dashboard reads.

| Field | Type | Notes |
|---|---|---|
| `players` | map | Player id to player stats. |
| `pairs` | map | Pair id to pair stats. |
| `matchups` | map | Matchup id to matchup stats. |
| `savedPlayers` | list | Merged remembered player names. |
| `ratedMatchCount` | number | Completed session matches included in stats. |
| `updatedAt` | timestamp | Server timestamp. |
| `statsVersion` | number | Starts at `1`. |

Player ids are normalized from names with trimming and case folding. Pair ids sort the two normalized player ids so `A+B` and `B+A` are the same pair.

## Stats Model

Player stats include:

- Display name.
- Matches played.
- Wins and losses.
- Win rate.
- Current individual Elo.
- Rated match count.
- Recent form from the last five session matches.
- Partner records keyed by pair id.
- Opponent records keyed by opponent player id.

Pair stats include:

- Two display names.
- Matches played together.
- Wins and losses.
- Win rate.
- Current pair Elo.
- Rated match count.

Matchup stats include:

- Player-vs-player opponent counts and win/loss totals.
- Pair-vs-pair counts and win/loss totals.
- Partner history for each pair.

Stats are derived from completed session matches. Active in-progress matches do not update stats until the user confirms the match result and advances to the next session suggestion.

## Elo Model

Individual players and doubles pairs both start at `1500`.

K-factor:

- `32` while a player or pair has fewer than 10 rated matches.
- `24` after 10 or more rated matches.

Individual Elo:

- Compute each team's rating from the average individual Elo of its two players.
- Compute expected score using the standard Elo expected-score formula.
- Apply the same rating delta to both players on the same team.
- Winning players gain points; losing players lose points.

Pair Elo:

- Compute expected score from the current Elo of the two pairs.
- Apply one pair delta to the winning pair and the inverse delta to the losing pair.

When a team has mixed provisional and established players, use the average of the two players' K-factors for that team's individual update. Pair Elo uses the pair's own K-factor.

## Signed-Out Behavior

Signed-out session mode continues to work with localStorage only. Users can:

- Start sessions.
- Complete session matches.
- End sessions.
- See current-session match history that is already available locally.

Signed-out users cannot access the new cloud History & Stats view. The app menu shows a gated entry point or sign-in nudge instead of the full view.

## Sign-In Import Behavior

When a named user signs in, the app checks localStorage for local session data:

- Active session.
- Archived sessions.
- Saved players.
- Local sessions not already marked as imported for this uid.

If importable local data exists, the UI asks: "Import local session history to this account?" with actions:

- `Import`: upload local sessions and saved players to the signed-in user's Firestore tree.
- `Not now`: dismiss the prompt without uploading. The prompt appears again on a future signed-in app load while importable data remains.

No local session data is uploaded until the user confirms.

On import:

- The active local session becomes a Firestore session with status `active` and source `local-active-import`.
- Archived local sessions become Firestore sessions with status `completed` and source `local-import`.
- Archived session matches become match documents.
- Saved players merge into `users/{uid}/stats/summary.savedPlayers`.
- Stats and Elo are rebuilt from imported completed matches.
- The app stores a local imported marker keyed by uid and local session id to prevent duplicate imports.

## Signed-In Sync Behavior

After a user is signed in and has either no local import to perform or has accepted import:

- Starting a session creates or updates a Firestore session document.
- Completing a session match creates a match document and updates the stats summary.
- Ending a session marks the Firestore session `completed`.
- Saved players are mirrored to the user stats summary.

LocalStorage remains a device fallback for the active session and local archive. If a Firestore write fails, session mode continues locally and the UI shows a compact sync warning with a retry path. This design does not attempt multi-device active-session conflict resolution. If the same user edits the same active session from two devices, last successful cloud write wins for metadata and each completed match id prevents duplicate match writes.

## UI Design

Add a signed-in `History & Stats` app menu action.

When signed out:

- The action opens a sign-in nudge inside the existing app modal pattern.
- No cloud history or stats data is shown.

When signed in:

- The action opens the existing app modal pattern, styled to use most of the phone viewport for tabbed browsing.
- The view uses tabs: `Sessions`, `Players`, `Pairs`, `Matchups`.

### Sessions Tab

Shows active and completed sessions newest first. Each row includes:

- Date.
- Status.
- Player count.
- Match count.
- Duration when available.

Selecting a session shows completed matches newest first with teams, winner, final score, and duration.

### Players Tab

Shows player leaderboard rows with:

- Display name.
- Individual Elo.
- Matches played.
- Win rate.
- Recent form.

Selecting a player shows partner and opponent breakdowns.

### Pairs Tab

Shows pair leaderboard rows with:

- Pair names.
- Pair Elo.
- Matches played.
- Win rate.

### Matchups Tab

Shows head-to-head summaries for:

- Player opponent records.
- Pair-vs-pair records.
- Partner records.

Empty states explain that stats appear after completed session matches.

## Security Rules

Rules add user-owned paths under `users/{uid}` while preserving existing remote-room rules.

Required rule properties:

- Named Firebase sign-in only; anonymous providers are rejected.
- `request.auth.uid` must match `{uid}` for all reads and writes.
- User document `uid` must match both document id and auth uid.
- Create and update rules validate required fields, allowed fields, enum values, list sizes, and basic numeric bounds.
- Match documents cannot be publicly read.
- Delete is denied for v1.

The rules are a prototype and need review before broad release.

## Testing

Unit tests cover:

- Player and pair id normalization.
- Individual Elo updates from team-average ratings.
- Pair Elo updates from pair ratings.
- Provisional and established K-factor behavior.
- Stats aggregation for wins, losses, win rate, recent form, partners, opponents, and pair-vs-pair matchups.
- Import deduplication markers.

React tests cover:

- Signed-out users see the History & Stats gate, not private stats.
- Signed-in users see the History & Stats view.
- Local import prompt appears only when importable local data exists.
- Choosing `Not now` does not upload local data.
- Choosing `Import` calls the cloud import service and marks imported sessions locally.
- Firestore write failure leaves local session flow usable and shows sync warning.

Firestore mapping tests cover:

- Session document serialization.
- Match document serialization with Elo snapshots.
- Stats summary serialization.
- Legacy local match records without timestamps or final scores.

Rules tests cover:

- Users can read and write only their own `users/{uid}` tree.
- Anonymous Firebase users are rejected.
- Other signed-in users cannot read or write another user's sessions, matches, or stats.
- Public reads are denied for user-owned history and stats.

## Non-Goals

- Normal match mode history.
- Point-by-point cloud event logs.
- Editing or deleting cloud history.
- Exporting history.
- Sharing history with other users.
- Multi-user shared clubs or groups.
- Multi-device active-session conflict resolution beyond duplicate match id prevention.
- Server-side Cloud Functions; v1 uses the web client and Firestore security rules only.
