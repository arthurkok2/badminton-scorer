# Cloud Session History and Stats Design

**Date:** 2026-05-18

## Goal

Add signed-in session history management with cloud persistence, enforced global player records, player and pair statistics, matchup records, and individual plus doubles-pair Elo ratings. Signed-out users continue to use local one-off match mode, but session mode requires sign-in because every session player must be selected from or created in the global player registry. When a user signs in with legacy local session data, the app asks before importing that data and requires mapping local names to global players.

## Scope

This design covers session mode only. Normal one-off match mode remains local and does not affect history, statistics, or ratings.

The feature is available only to named Firebase users. Signed-out users cannot start new sessions after this change. They can still score one-off matches locally, but they cannot view cloud history, player statistics, pair statistics, matchup statistics, or Elo ratings.

## Current State

Session mode currently stores data in localStorage:

- `badminton-scorer-active-session` for the active session.
- `badminton-scorer-session-archive` for completed local sessions.
- `badminton-scorer-saved-players` for remembered player names.

Firebase Authentication already supports named Google sign-in. Firestore currently stores remote-control room data under `matches/{code}` and security rules restrict remote writes to named users. There is no user-owned Firestore data model for session history yet.

The project Firestore database is `projects/badminton-scorer-91f7d/databases/(default)`, edition `STANDARD`, type `FIRESTORE_NATIVE`.

## Firestore Data Model

Add a global player registry, global pair registry, global match ledger, and a user-owned tree. Global player and pair documents support search and ranking across signed-in users. User-owned documents live under `users/{uid}` and are readable/writable only by the matching named user.

### `players/{playerId}`

Stores a canonical global player record. Session rosters reference these records by id.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Same as document id. |
| `displayName` | string | Human-readable player name. |
| `searchName` | string | Normalized name for search and duplicate warnings. |
| `createdBy` | string | uid of the named user who created the player. |
| `createdAt` | timestamp | Server timestamp. |
| `updatedAt` | timestamp | Server timestamp. |
| `claimStatus` | string | `guest` for v1-created records; future values may include `claimed` and `verified`. |
| `linkedUid` | string? | Future account claim field; absent in v1. |
| `globalIndividualElo` | number | Starts at `1500`. |
| `globalMatchCount` | number | Completed global session matches for this player. |
| `statsVersion` | number | Starts at `1`. |

Global player creation is available only to signed-in users. The UI warns on near-duplicate `searchName` matches, but v1 does not block duplicate human names because multiple real players may share a name.

### `pairs/{pairId}`

Stores a canonical global doubles pair. The id is derived from the two sorted player ids.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Same as document id. |
| `playerIds` | list | Exactly two sorted global player ids. |
| `displayNames` | list | Snapshot names for ranking displays. |
| `createdAt` | timestamp | Server timestamp. |
| `updatedAt` | timestamp | Server timestamp. |
| `globalPairElo` | number | Starts at `1500`. |
| `globalMatchCount` | number | Completed global session matches for this pair. |
| `statsVersion` | number | Starts at `1`. |

### `globalMatches/{matchId}`

Stores the global match ledger used for rankings. Every completed session match creates one global match document because all session players are global players.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Same as document id. |
| `submittedBy` | string | uid of the signed-in scorer. |
| `sessionId` | string | User session id where the match was recorded. |
| `sourcePath` | string | `users/{uid}/sessions/{sessionId}/matches/{matchId}`. |
| `matchNumber` | number | One-based order within the session. |
| `teamAPlayerIds` | list | Exactly two global player ids. |
| `teamBPlayerIds` | list | Exactly two global player ids. |
| `teamAPairId` | string | Sorted pair id for Team A. |
| `teamBPairId` | string | Sorted pair id for Team B. |
| `winnerTeam` | string | `teamA` or `teamB`. |
| `finalScore` | map? | `{ teamA: number, teamB: number }` when available. |
| `startedAt` | string? | ISO timestamp. |
| `endedAt` | string? | ISO timestamp. |
| `globalIndividualElo` | map | Before/after/delta per player. |
| `globalPairElo` | map | Before/after/delta per pair. |
| `status` | string | `submitted` in v1. |
| `createdAt` | timestamp | Server timestamp. |

Global matches are append-only in v1. Later claim or verification systems can add confirmation, disputes, or visibility controls without changing the session model.

Because v1 writes global matches and Elo updates from the web client, global rankings are suitable for a trusted/private player pool, not a tamper-resistant public ranking. A future hardened ranking should move Elo updates behind a trusted server boundary such as Cloud Functions or an equivalent backend.

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
| `players` | list | Session roster with global player ids, display names, games played, and breaks taken where available. |
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
| `teamAPlayerIds` | list | Exactly two global player ids. |
| `teamBPlayerIds` | list | Exactly two global player ids. |
| `teamADisplayNames` | list | Snapshot display names. |
| `teamBDisplayNames` | list | Snapshot display names. |
| `teamAPairId` | string | Sorted pair id for Team A. |
| `teamBPairId` | string | Sorted pair id for Team B. |
| `winnerTeam` | string | `teamA` or `teamB`. |
| `finalScore` | map? | `{ teamA: number, teamB: number }` when available. |
| `startedAt` | string? | ISO timestamp. |
| `endedAt` | string? | ISO timestamp. |
| `globalMatchId` | string | Matching `globalMatches/{matchId}` document id. |
| `globalIndividualElo` | map | Before/after/delta per player. |
| `globalPairElo` | map | Before/after/delta per pair. |
| `createdAt` | timestamp | Server timestamp. |

Each match stores Elo snapshots so old history remains explainable if the rating algorithm changes in a future stats version.

### `users/{uid}/stats/summary`

Stores derived statistics for fast dashboard reads.

| Field | Type | Notes |
|---|---|---|
| `players` | map | Global player id to this user's personal stats for that player. |
| `pairs` | map | Global pair id to this user's personal stats for that pair. |
| `matchups` | map | Matchup id to matchup stats. |
| `savedPlayers` | list | Merged remembered player names. |
| `ratedMatchCount` | number | Completed session matches included in stats. |
| `updatedAt` | timestamp | Server timestamp. |
| `statsVersion` | number | Starts at `1`. |

User stats are personal views over global players and global pairs. They answer "what has this signed-in scorer recorded?" Global leaderboard data comes from `players`, `pairs`, and `globalMatches`.

## Stats Model

User-scoped player stats include:

- Display name.
- Matches played.
- Wins and losses.
- Win rate.
- Current individual Elo.
- Rated match count.
- Recent form from the last five session matches.
- Partner records keyed by pair id.
- Opponent records keyed by opponent player id.

User-scoped pair stats include:

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

User-scoped stats are derived from completed session matches recorded by that user. Global stats are derived from `globalMatches`. Active in-progress matches do not update either stats layer until the user confirms the match result and advances to the next session suggestion.

## Elo Model

Global individual players and global doubles pairs both start at `1500`.

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

The v1 Elo system is global because all session players are global players and every completed session match writes to the global match ledger. User-scoped stats may also store the Elo snapshots for the matches a user recorded, but canonical rankings read from global player, pair, and global match documents.

Elo updates must run in a Firestore transaction that reads the current player and pair ratings, creates the user match document, creates the global match document, and updates the affected player and pair documents together. If the transaction fails, local session completion remains recorded and the app shows a sync retry state.

## Signed-Out Behavior

Signed-out users can score normal one-off matches locally. Session mode requires a named Firebase user because the session setup must select or create global players before a session starts.

When signed out:

- The `Session mode` menu action opens a sign-in nudge.
- Existing legacy local active or archived sessions remain in localStorage until the user signs in and chooses whether to import them.
- The cloud `History & Stats` view is unavailable.

## Sign-In Import Behavior

When a named user signs in, the app checks localStorage for legacy local session data:

- Active session.
- Archived sessions.
- Saved players.
- Local sessions not already marked as imported for this uid.

If importable local data exists, the UI asks: "Import local session history to this account?" with actions:

- `Import`: open a mapping flow before upload.
- `Not now`: dismiss the prompt without uploading. The prompt appears again on a future signed-in app load while importable data remains.

No local session data is uploaded until the user confirms.

The mapping flow lists every distinct local player name from the active session, archived sessions, and saved players. For each name, the user must either:

- Select an existing global player.
- Create a new global guest player.

Import cannot proceed until every local player name is mapped to a global player id.

On import:

- The active local session becomes a Firestore session with status `active` and source `local-active-import`.
- Archived local sessions become Firestore sessions with status `completed` and source `local-import`.
- Archived session matches become user match documents and global match documents using the selected global player ids.
- Saved players merge into `users/{uid}/stats/summary.savedPlayers`.
- User-scoped stats and global Elo are rebuilt or incrementally updated from imported completed matches.
- The app stores a local imported marker keyed by uid and local session id to prevent duplicate imports.

## Signed-In Sync Behavior

After a user is signed in and has either no local import to perform, selected `Not now`, or accepted import:

- Starting a session requires selecting or creating global players for the roster, then creates or updates a Firestore session document.
- Completing a session match creates a user match document, creates a global match document, updates global player Elo, updates global pair Elo, and updates the user's stats summary.
- Ending a session marks the Firestore session `completed`.
- Saved players are mirrored to the user stats summary.

LocalStorage remains a device fallback for the active session after the signed-in session has been created with global player ids. If a Firestore write fails during a signed-in session, session mode continues locally and the UI shows a compact sync warning with a retry path. This design does not attempt multi-device active-session conflict resolution. If the same user edits the same active session from two devices, last successful cloud write wins for metadata and each completed match id prevents duplicate match writes.

## UI Design

Add a signed-in `History & Stats` app menu action.

When signed out:

- The action opens a sign-in nudge inside the existing app modal pattern.
- No cloud history or stats data is shown.
- The `Session mode` action also opens a sign-in nudge.

When signed in:

- The action opens the existing app modal pattern, styled to use most of the phone viewport for tabbed browsing.
- The view uses tabs: `Sessions`, `Players`, `Pairs`, `Matchups`.
- Session setup uses a global player picker with search and create-new-player actions. Typed names do not become session players until they are linked to a global player record.

### Sessions Tab

Shows active and completed sessions newest first. Each row includes:

- Date.
- Status.
- Player count.
- Match count.
- Duration when available.

Selecting a session shows completed matches newest first with teams, winner, final score, and duration.

### Players Tab

Shows global player leaderboard rows with:

- Display name.
- Individual Elo.
- Matches played.
- Win rate.
- Recent form.

Selecting a player shows partner and opponent breakdowns.

### Pairs Tab

Shows global pair leaderboard rows with:

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

Rules add global player, pair, global match, and user-owned paths while preserving existing remote-room rules.

Required rule properties:

- Named Firebase sign-in only; anonymous providers are rejected.
- Signed-in users can read global player, pair, and submitted global match documents for ranking and lookup.
- `request.auth.uid` must match `{uid}` for all reads and writes under `users/{uid}`.
- User document `uid` must match both document id and auth uid.
- Global player creation requires named sign-in and validates display names, search names, allowed fields, Elo bounds, and initial counters.
- Global pair creation and updates require named sign-in and validate exactly two sorted player ids, allowed fields, Elo bounds, and counters.
- Global match creation requires named sign-in, `submittedBy == request.auth.uid`, valid team ids, valid pair ids, allowed fields, Elo snapshots, and status `submitted`.
- Create and update rules validate required fields, allowed fields, enum values, list sizes, and basic numeric bounds.
- Match documents cannot be publicly read.
- Delete is denied for v1.

The rules are a prototype and need review before broad release. Security rules can enforce shape, ownership, auth, and basic bounds, but they cannot fully prove that client-submitted Elo deltas are mathematically correct or socially legitimate.

## Testing

Unit tests cover:

- Player and pair id normalization.
- Global player search-name normalization.
- Individual Elo updates from team-average ratings.
- Pair Elo updates from pair ratings.
- Provisional and established K-factor behavior.
- Stats aggregation for wins, losses, win rate, recent form, partners, opponents, and pair-vs-pair matchups.
- Import deduplication markers.
- Legacy local player-name mapping to global player ids.

React tests cover:

- Signed-out users see the History & Stats gate, not private stats.
- Signed-out users cannot start session mode and see a sign-in nudge.
- Signed-in users see the History & Stats view.
- Session setup requires every roster entry to be a global player.
- Local import prompt appears only when importable local data exists.
- Choosing `Not now` does not upload local data.
- Choosing `Import` requires mapping local names to global players, calls the cloud import service, and marks imported sessions locally.
- Firestore write failure leaves local session flow usable and shows sync warning.

Firestore mapping tests cover:

- Session document serialization.
- Match document serialization with Elo snapshots.
- Stats summary serialization.
- Global player, pair, and global match serialization.
- Legacy local match records without timestamps or final scores.

Rules tests cover:

- Signed-in users can create valid global players and cannot create malformed global players.
- Signed-in users can read global player, pair, and global match documents.
- Signed-in users can create valid global matches and cannot impersonate another submitter.
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
- Player account claiming and verification.
- Global match disputes or confirmations.
- Tamper-resistant public rankings.
- Server-side Elo calculation.
- Multi-device active-session conflict resolution beyond duplicate match id prevention.
- Server-side Cloud Functions; v1 uses the web client and Firestore security rules only.
