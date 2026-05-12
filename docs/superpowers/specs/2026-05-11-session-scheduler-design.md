# Session Scheduler Design

**Date:** 2026-05-11
**Status:** Implemented

## Overview

A session scheduler layer on top of the existing match scorer. Players present at a session are added once, and the app automatically proposes balanced match pairings and fair break rotation for the duration of the session.

Targets: 1 court, 5–8 players, equal skill assumed.

---

## Section 1: Overall Architecture

The app adds a **Session mode** entry point inside the existing Match controls panel. Match mode remains the default scorer experience; Session mode is launched from the controls alongside other match-level actions.

Session mode flow:

1. **Session setup** — add the players present
2. **Match suggestion** — app proposes next match (teams + who sits out), with override controls
3. **Play** — existing scorer runs the match as normal (scoring engine, court view, remote input unchanged)
4. **Rotation** — when the match ends, app rotates automatically and shows next suggestion
5. Repeat from step 2 until the session is ended manually

The scheduler is a pure layer on top of the existing scorer. No changes to the scoring engine, court view, speech, or remote input.

If an active session exists in localStorage on app load, the app opens in Session mode on the next-match suggestion screen.

Session setup and match suggestion screens use the same visual language as the scorer: dark bordered panels, compact spacing, 8px radii, uppercase section labels, and the existing primary/secondary/danger button hierarchy.

---

## Section 2: Session Setup

A setup screen appears when starting a new session:

- **Player list** — add players by name. Previously used names are shown as quick-tap chips (saved roster). New names can be typed and are saved automatically.
- **Minimum 4 players** to start a session.
- **Edit players between matches** — an "Edit players" button is available on the match suggestion screen. If the current session has completed matches, the app asks for confirmation and then returns to setup; starting again creates a new session and resets the previous match history.
- No skill levels or seeding.

The setup screen is shown as a focused session panel, with a separate "Match mode" button above the panel to return to the standard scorer.

---

## Section 3: Rotation Logic

After each match ends, the next 4 players are selected:

1. **Players on break come on first** — anyone who sat out the last match is guaranteed a spot.
2. **If more than 4 players are returning from break**, prioritise those with the fewest total games played this session.
3. **Fill remaining spots from on-court players**, prioritising those with the longest consecutive game streak (most consecutive = sits out first).
4. **Ties** are broken randomly. When multiple players have equal priority (same games played among break players, or same consecutive streak among on-court players), the order is randomised so the sit-out rotation does not become predictable over time.

The UI enforces a minimum of 4 players before starting. The pure scheduler functions assume they receive at least 4 players.

Player state tracked per session:
- Total games played
- Current consecutive game streak
- On-break status (sat out last match)

Break counts by player count:
- 4 players → 0 sit out (everyone plays every match)
- 5 players → 1 sits out
- 6 players → 2 sit out
- 7 players → 3 sit out
- 8 players → 4 sit out

---

## Section 4: Team Formation

Given the 4 selected players, there are exactly 3 ways to split them into 2 teams of 2. The app scores each split:

- **+2** for each time the proposed partners have played *together* this session
- **+1** for each time the proposed opponents have played *against* each other this session

Partner repeats are weighted more than opponent repeats — playing with the same person repeatedly is more noticeable than facing them again.

The split with the **lowest repeat score** is suggested. When all three splits score equally (which occurs once every pairing in the session is balanced), ties are broken randomly. This prevents the algorithm from cycling back to the same fixed team compositions every N rounds.

The app maintains a running pairing matrix across all matches in the session: `togetherCount[playerA][playerB]` and `againstCount[playerA][playerB]`.

---

## Section 5: Manual Override

Before each match starts, a **"Next match" screen** shows:

- The two proposed teams and who is on break
- **Swap** button — cycles through the other 2 possible team splits for the current 4 players
- **Change break** button — opens a picker to swap one player from the suggested 4 with one on-break player, then re-ranks the 3 team splits for that revised group
- **Start match** button — confirms and launches the scorer

Override is intentionally lightweight: cycle team splits or swap one player in/out. No drag-and-drop or free-form assignment. Fast to use between games.

After a match ends, the scorer returns to the rotation screen and the next suggestion is shown automatically.

---

## Section 5.1: Session Match Controls

When a suggested session match is being played, the scorer reuses the existing court, score, speech, undo, and remote input surfaces, but session mode owns match setup and progression. The live scorer must not expose normal one-off match setup controls that would conflict with the session:

- Player name inputs are hidden on the scorer page. Session player names come from the current match suggestion.
- Singles/doubles switching is hidden. Session matches are always doubles.
- The normal "New match" action is hidden. Session rotation is controlled by the suggestion and match-result flow.
- At 0-0 with no undo history, the user can return to the current match suggestion screen. This lets them adjust the pending session match before any rally has been played.
- At 0-0 with no undo history, the user can also end the session.
- After any rally has been played, the return-to-suggestion action is hidden because the session match has started. Ending the session remains available.
- Ending a session always asks for confirmation. If confirmed, the active session is archived and cleared, the app exits session mode, and the live scorer resets to a fresh 0-0 match using the saved match-mode and player-name preferences.

The standard match mode screen keeps the existing player-name editor, singles/doubles toggle, new-match action, and session-mode entry point.

---

## Section 6: Data Persistence

All session data is stored in `localStorage`.

### Active session

Persisted throughout the session so a page refresh resumes the active session on the match suggestion screen:

- Player roster (names, join order, on-break status, consecutive streak, total games)
- Full match history (teams, winner, order)
- Running pairing matrix (together counts, against counts)

### Session archive

Each completed session is appended to a session history log in `localStorage`:

- Session ID and start/end timestamps
- Player roster with per-player summary (total games played, total breaks taken)
- Full match history (who played with whom, who won, match order)

Sessions are stored as a JSON array. localStorage caps at ~5MB, sufficient for hundreds of archived sessions. The data model is flat and queryable, designed to support future analytics (win rates, partner frequency, games per player across sessions) without schema changes.

There is no analytics UI in this feature — the archive is the foundation for a future analytics feature.

### Saved player roster

The quick-tap name chips in session setup are stored separately in localStorage under the session storage module.

---

## Data Model (TypeScript sketch)

```ts
// Per-session archive record
interface ArchivedSession {
  readonly id: string;              // uuid
  readonly startedAt: string;       // ISO timestamp
  readonly endedAt: string;         // ISO timestamp
  readonly players: readonly ArchivedPlayer[];
  readonly matches: readonly ArchivedMatch[];
}

interface ArchivedPlayer {
  readonly name: string;
  readonly gamesPlayed: number;
  readonly breaksTaken: number;
}

interface ArchivedMatch {
  readonly teamA: readonly [string, string];  // player names
  readonly teamB: readonly [string, string];
  readonly winnerTeam: 'teamA' | 'teamB';
}

// Active session state (also written to localStorage)
interface ActiveSession {
  readonly id: string;
  readonly startedAt: string;
  readonly players: readonly SessionPlayer[];
  readonly matches: readonly ArchivedMatch[];
  readonly pairingMatrix: PairingMatrix;
}

interface SessionPlayer {
  readonly name: string;
  readonly gamesPlayed: number;
  readonly consecutiveStreak: number;
  readonly onBreak: boolean;
}

interface PairingMatrix {
  readonly together: Record<string, Record<string, number>>;  // name → name → count
  readonly against: Record<string, Record<string, number>>;
}
```

---

## Out of Scope

- Analytics UI (future feature reads from archive)
- Skill-based balancing
- Multi-court support
- Pre-generated full-session schedules
- Export / sync of session archive
