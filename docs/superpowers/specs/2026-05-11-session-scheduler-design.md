# Session Scheduler Design

**Date:** 2026-05-11
**Status:** Approved

## Overview

A session scheduler layer on top of the existing match scorer. Players present at a session are added once, and the app automatically proposes balanced match pairings and fair break rotation for the duration of the session.

Targets: 1 court, 5–8 players, equal skill assumed.

---

## Section 1: Overall Architecture

The app gains a top-level mode toggle: **Match** (existing behaviour, unchanged) vs **Session**.

Session mode flow:

1. **Session setup** — add the players present
2. **Match suggestion** — app proposes next match (teams + who sits out), with override controls
3. **Play** — existing scorer runs the match as normal (scoring engine, court view, remote input unchanged)
4. **Rotation** — when the match ends, app rotates automatically and shows next suggestion
5. Repeat from step 2 until the session is ended manually

The scheduler is a pure layer on top of the existing scorer. No changes to the scoring engine, court view, speech, or remote input.

---

## Section 2: Session Setup

A setup screen appears when starting a new session:

- **Player list** — add players by name. Previously used names are shown as quick-tap chips (saved roster). New names can be typed and are saved automatically.
- **Minimum 4 players** to start a session.
- **Add/remove mid-session** — an "Edit players" button is available on the match suggestion screen between matches. Players can join or leave at any time; the scheduler adapts automatically. If the active player count drops below 4, the session is paused and the setup screen prompts to add more players before the next match can start.
- No skill levels or seeding.

---

## Section 3: Rotation Logic

After each match ends, the next 4 players are selected:

1. **Players on break come on first** — anyone who sat out the last match is guaranteed a spot.
2. **If more than 4 players are returning from break**, prioritise those with the fewest total games played this session.
3. **Fill remaining spots from on-court players**, prioritising those with the longest consecutive game streak (most consecutive = sits out first).
4. **Ties** broken randomly.

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

The split with the **lowest repeat score** is suggested. Ties broken randomly.

The app maintains a running pairing matrix across all matches in the session: `togetherCount[playerA][playerB]` and `againstCount[playerA][playerB]`.

---

## Section 5: Manual Override

Before each match starts, a **"Next match" screen** shows:

- The two proposed teams and who is on break
- **Swap** button — cycles through the other 2 possible team splits for the current 4 players
- **Change break** button — opens a picker to swap one on-court player with one on-break player (for players needing a longer rest)
- **Start match** button — confirms and launches the scorer

Override is intentionally lightweight: cycle team splits or swap one player in/out. No drag-and-drop or free-form assignment. Fast to use between games.

After a match ends, the scorer returns to the rotation screen and the next suggestion is shown automatically.

---

## Section 6: Data Persistence

All session data is stored in `localStorage`.

### Active session

Persisted throughout the session so a page refresh mid-session resumes on the match suggestion screen:

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

The quick-tap name chips in session setup are shared with Match mode and persist across sessions in the existing preferences store.

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
