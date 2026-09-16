---
title: Session Matchup Diversity
author: quyencaotran
date: 2026-09-15
status: implemented
tags: [scoring, session, scheduler]
domain: scoring
---

# Session Matchup Diversity

## Problem

The session rotation guarantees fair court time but not varied matchups. `selectNextPlayers` ranked everyone who sat out the last match ahead of everyone who played, then filled any remaining slots from the on-court players with the shortest consecutive streak. On an even-sized roster that rule is a closed cycle:

- **8 players.** The break group is always exactly 4, so the next four are forced to be the complement of the last four. The roster splits into two foursomes that alternate forever and never meet.
- **6 players.** The two leftover slots always go to the pair that came back on most recently, so three fixed duos form and rotate. Only 3 of the 15 possible foursomes ever appear.

Measured over 24 matches (500 runs, driving the real scheduler):

| Roster | Distinct foursomes | Pairs that ever shared a court | Court-time spread |
|--------|--------------------|-------------------------------|-------------------|
| 8 players | 2 of 70 | 12 of 28 | 0 |
| 6 players | 3 of 15 | 15 of 15 | 0 |
| 7 players | 19 of 35 | 21 of 21 | up to 4 games |

The 7-player row shows a second defect: because on-court players were ordered by consecutive streak rather than games played, court time drifted by as much as 4 games.

## Goal

Every player should meet as many different partners and opponents as the session length allows, while court time stays as even as it is today.

Success criteria:
- No roster size settles into a fixed subset of foursomes.
- Court-time spread stays within one game for rosters of 4–8.

## Constraints

- Court time comes first. A player owed a game plays, however familiar the resulting foursome.
- Selection stays a pure function of session state, with no React or storage dependencies.
- Sessions saved by older versions must keep loading; `loadActiveSession` casts parsed JSON without validation.
- Equal-scoring options must still resolve randomly, so the rotation is not predictable.

## Non-Goals

- Skill balancing. Elo ratings exist (`src/session/elo.ts`) but remain a stats-screen concern; the scheduler does not read them.
- Carrying pairing history across sessions. The matrix still starts empty for each new session.
- Changing team formation. `rankSplitsForPlayers` keeps its 2:1 partner-to-opponent weighting.

## Acceptance Criteria

- Players with the fewest games played are always selected.
- When more players are level on games played than there are open slots, the foursome with the least shared-court history wins.
- With 8 players over 24 matches, at least 12 distinct foursomes appear and all 28 pairs share a court.
- With 6 players over 24 matches, at least 12 of the 15 possible foursomes appear.
- Court-time spread after 24 matches is at most 1 for rosters of 4, 5, 6, 7 and 8.
- A saved session written before this change still loads and schedules.

## Alternatives Considered

**Sort everyone by games played, break ties at random.** Three lines, and it does break the cycle: 8 players reach 20.6 distinct foursomes and 27.0 of 28 pairs. But at 6 players — the realistic case for one court — it reaches only 12.5 of 15 foursomes, because random tie-breaking re-picks recent groupings as readily as fresh ones. Rejected for leaving diversity on the table at the size that matters most.

**Score foursomes by partner history only, ignoring head-to-heads.** Cheaper to reason about, but it treats "we were opponents four times" as no history at all, which is exactly the repetition players notice. Rejected.

**Seed the pairing matrix from cloud history across sessions.** Would maximise variety over weeks rather than hours, but it makes the scheduler depend on Firestore and gives anonymous users different behavior from signed-in ones. Out of scope.

## Approach

`selectNextPlayers` now takes the session's `PairingMatrix` and picks in two tiers:

1. **Fairness tier.** Sort by `gamesPlayed`. Everyone below the fourth-lowest count is a must-play, which keeps the spread within one game.
2. **Variety tier.** Whoever is level with the fourth-lowest count competes for the remaining slots. Enumerate the combinations that fill those slots, score each resulting foursome by how often its six pairs have already shared a court (`together` + `against`), and take the lowest. A Fisher-Yates shuffle runs first, so equal scores resolve uniformly.

The same pairing matrix that ranks team splits now also chooses the foursome, one level up.

With the previous rule gone, `consecutiveStreak` and `onBreak` have no readers, so they are removed from `GlobalSessionPlayer`. `applyMatchResult` increments `gamesPlayed` for the four who played and leaves everyone else untouched. The `onBreak` list in `MatchSuggestion` is unaffected: it is derived per suggestion, and the UI still renders it.

## What Changes

| File | Change |
|------|--------|
| `src/session/sessionScheduler.ts` | `selectNextPlayers` takes a `PairingMatrix` and selects by fairness tier then variety; adds `combinationsOf` and `sharedCourtCost`; `generateMatchSuggestion` passes `session.pairingMatrix`; `applyMatchResult` only increments `gamesPlayed` |
| `src/session/sessionTypes.ts` | `GlobalSessionPlayer` drops `consecutiveStreak` and `onBreak` |
| `src/session/playerIdentity.ts` | `toSessionPlayer` no longer seeds those fields |
| `src/session/sessionScheduler.test.ts` | Selection tests rewritten for the new rules; adds a `rotation diversity` suite |
| `src/App.test.tsx`, `src/session/cloudSessionService.test.ts`, `src/session/playerIdentity.test.ts`, `src/components/MatchSuggestion.test.tsx` | Session-player fixtures updated |

## What Stays the Same

- Team formation, its 2:1 weighting, and the three ranked splits.
- Manual overrides: Swap teams and Change break behave exactly as before.
- Persistence formats and the cloud session/Elo path. `LegacySessionPlayer` keeps its `consecutiveStreak` and `onBreak` fields because it describes data written by older versions.
- Break-count-by-roster-size behavior: 4→0, 5→1, 6→2, 7→3, 8→4.

## Architecture Impact

`.docs/game-engine/scoring-engine.md` — the Rotation Algorithm section now describes the two-tier selection and why variety replaced break-status ordering; Session State now lists only `gamesPlayed` and notes that older saved sessions carry ignored fields.

## Testing Strategy

Unit tests in `src/session/sessionScheduler.test.ts`:

- Fairness: a player owed a game is selected even when the pairing matrix makes that foursome the most familiar one.
- Variety: with all players level on games played and one player who has shared a court with everyone, the foursome excluding that player is chosen on all 20 repetitions.
- Tie-breaking: with an empty matrix and equal games played, every player sits out at least once across 100 calls.
- Regression, 8 players: 24 simulated matches produce at least 12 distinct foursomes and all 28 pairs. The old rule produced 2 and 12.
- Regression, 6 players: 24 simulated matches produce at least 12 of the 15 possible foursomes. The old rule produced 3.
- Fairness across sizes: court-time spread is at most 1 for rosters of 4–8.

Thresholds sit well below measured minimums (500 runs: 14 distinct foursomes at 8 players, 15 at 6 players) so the suite is not flaky.

## Verification

`npm test`, `npm run lint`, `npm run build` and `node --check public/sw.js` all pass. Separately, the updated scheduler was bundled with esbuild and driven for 24 matches × 500 runs per roster size:

| Roster | Distinct foursomes (min/mean) | Pairs sharing a court | Court-time spread |
|--------|-------------------------------|-----------------------|-------------------|
| 5 players | 5 / 5.0 of 5 | 10 of 10 always | 1 |
| 6 players | 15 / 15.0 of 15 | 15 of 15 always | 0 |
| 7 players | 14 / 20.2 of 35 | 21 of 21 always | 1 |
| 8 players | 14 / 22.1 of 70 | 28 of 28 always | 0 |

At 8 players the first 12 matches were 12 different foursomes in every one of the 500 runs.

## Performance Impact

Selection runs once per match, on human timescales. The combination enumeration is bounded by the number of players level on games played choose the open slots: 15 foursomes at 6 players, 70 at 8, 495 at 12. Each is scored over 6 pair lookups in a plain object. Immeasurable against the previous two sorts.

## Affected Components

- `selectNextPlayers`, `generateMatchSuggestion`, `applyMatchResult` in `src/session/sessionScheduler.ts`
- `GlobalSessionPlayer` consumers: `MatchSuggestion`, `App` session flow, `cloudSessionService`
- No Firestore rules, endpoints or stored document shapes change

## Reviewer Context

This replaces Section 3 (Rotation Logic) of [Session Scheduler Design](../../2026/05/2026-05-11-session-scheduler-design.md); the rest of that spec still stands.

The key judgement is tier ordering. Court time is a hard constraint and variety is the tie-break, never the reverse, so a player returning to a session or joining late still gets caught up immediately. The cost function deliberately counts partnerships and head-to-heads equally: at the foursome stage the teams have not been chosen yet, and `rankSplitsForPlayers` applies the 2:1 partner weighting immediately afterwards.
