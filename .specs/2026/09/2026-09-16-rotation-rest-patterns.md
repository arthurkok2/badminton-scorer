---
title: Rotation Rest Patterns
author: quyencaotran
date: 2026-09-16
status: implemented
tags: [scoring, session, scheduler]
domain: scoring
---

# Rotation Rest Patterns

## Problem

[Session Matchup Diversity](2026-09-15-session-matchup-diversity.md) made the scheduler pick the foursome that has shared a court least, subject to games played staying within one. Review of that change pointed out the gap: the variety score has no reason to bring back whoever just sat out.

It bites on a fixed cadence, not at random. With `n` players and 4 slots, after every `n / gcd(n, 4)` matches the games dealt out are an exact multiple of `n`, and a spread of at most one forces everyone level: every 5 matches on 5 players, every 3 on 6, every 7 on 7, every 2 on 8. At those points nothing is owed court time, so variety alone decides and a player can be left out twice running.

On a 5-player roster this produces a rotation that doesn't match the shape of the game. Only one person sits at a time, so players expect a steady four-on, one-off cycle. Instead, measured over 24-match sessions × 1000 runs, 3.4% of waits ran to two matches and stints reached **eight games in a row** — a spread of one only forces a sit-out once every five matches, so sitting at the end of one block and the start of the next allows eight consecutive games.

## Goal

A 5-player roster should rotate the way players expect:

- Nobody sits out two matches running.
- Nobody plays more than four matches in a row.
- Matchup variety and court-time fairness stay exactly where [Session Matchup Diversity](2026-09-15-session-matchup-diversity.md) left them.

## Constraints

- Court time still comes first; a player owed a game plays regardless of rest.
- **6-player rotation must not change.** Court time evens out every 3 matches there, so an occasional two-match wait is acceptable, and forcing the return costs matchup variety — the thing the previous spec was written to protect.
- 8-player behavior must not regress. There the players who sat out are exactly the four open slots, so requiring their return is the old rule that sealed the roster into two groups.
- Selection stays a pure function of session state, with no React or storage dependencies.
- No new per-player state. The previous change deleted `consecutiveStreak` and `onBreak`, and saved sessions must keep loading.

## Non-Goals

- Changing rotation on 6, 7 or 8 players. Sessions run 5 or 6 in practice, and 6 is deliberately left alone.
- A rigid, pre-computed sit-out order. Each 5-match block still varies; the guarantee is about consecutive matches, not a fixed sequence.
- Skill balancing or cross-session pairing history, both still out of scope.

## Acceptance Criteria

- On 5 players, no player sits out two matches in a row and no player is picked for more than four in a row.
- On 6, 7 and 8 players, waits, stints and foursome variety are unchanged.
- Court-time spread stays at most 1 for rosters of 4 to 8.
- Pair coverage stays complete on every roster size.

## Alternatives Considered

**Apply the no-back-to-back-sit-out rule on every roster.** Tried and measured first. It removes two-match waits on 6 and 7 as well, and on 7 it even improves variety, but on 6 the worst run of 500 dropped from 15 of 15 possible foursomes to 14. Two players sit at a time there, so requiring both back restricts the next foursome to the 6 of 15 that contain them. Rejected: on a 6-player roster court time already evens out every 3 matches, so the wait needs no fixing, and variety is what that roster is optimised for.

**Return to break-priority (everyone who sat out plays next).** Guarantees the rest property everywhere, and is exactly the rule the previous spec removed. On 8 players the break group is the whole selection, so the two sealed foursomes come straight back. Rejected.

**Add a penalty term to the variety cost rather than filtering.** Shared-court costs differ by small integers, so any penalty heavy enough to matter dominates the variety score, and a lighter one does nothing. Rejected as a tuning exercise with no stable setting.

**Restore `consecutiveStreak` on the player record.** Straightforward, but reintroduces persisted state that has to be migrated and kept correct, when `session.matches` already holds the history. Rejected.

## Approach

`selectNextPlayers` takes the player ids from the recent matches, most recent first, and applies two filters to the candidate foursomes after the fairness tier and before scoring variety:

1. **No back-to-back sit-outs, on single-sitter rosters only.** Where `players.length - 4 === 1`, drop candidates that leave out a contender who did not play the previous match. With one sitter the foursome is decided entirely by who sits, so every foursome occurs equally often whatever order they are picked in: the filter constrains the order and nothing else. With two or more sitters it would narrow which foursomes can follow, so it is not applied.
2. **No more than `MAX_CONSECUTIVE_MATCHES` (4) in a row, on any roster.** Drop candidates containing a contender who has played the last four matches. Falls back to the unfiltered set if nothing survives, so the filter can never block a selection. Measured as a no-op on 6, 7 and 8, which reach four in a row rarely or never.

Variety then picks from what remains, exactly as before. `generateMatchSuggestion` derives the recent-match ids from the last four `MatchRecord`s of the session, so no new state is stored and older saved sessions simply start with an empty history.

## What Changes

| File | Change |
|------|--------|
| `src/session/sessionScheduler.ts` | `selectNextPlayers` accepts `recentMatchPlayerIds` and applies the two rest filters; `generateMatchSuggestion` derives them from `session.matches`; adds the `MAX_CONSECUTIVE_MATCHES` constant |
| `src/session/sessionScheduler.test.ts` | Adds a `selectNextPlayers rest handling` suite and a 5-player rotation test |

## What Stays the Same

- The fairness tier, the variety score, and the three ranked splits.
- Rotation on 6, 7 and 8 players, verified by measurement rather than by assumption.
- `GlobalSessionPlayer`, all persistence formats, and the cloud session path. The new parameter defaults to empty, so existing callers and saved sessions behave as before on the first match.

## Architecture Impact

`.docs/game-engine/scoring-engine.md` — the Rotation Algorithm section gains the two rest filters as a step between fairness and variety, records that the sit-out filter applies only where a single player sits out and why 6 players are deliberately left alone, and notes that rest state is read from recent match records rather than stored.

## Testing Strategy

- `turns a 5-player roster into a four-on, one-off cycle` — 24 simulated matches, asserting the longest wait is 1 and the longest stint at most 4.
- `brings back whoever sat out the last match when everyone is level on games` — 5 level players, one held out of the previous match, selected on all 20 repetitions.
- `rests a player who has already played four matches in a row` — 6 level players where one appears in all four recent matches; that player is benched on all 20 repetitions.
- `leaves who comes back on a 6-player roster to the variety score` — across 100 draws every player turns up on the bench, proving the sit-out filter is not applied there.
- The existing diversity, fairness and tie-breaking tests guard against regression.

## Verification

`npm test`, `npm run lint`, `npm run build` and `node --check public/sw.js` all pass. The scheduler was also bundled with esbuild and driven for 24 matches × 1000 runs per roster size:

| Roster | Waits of 2+ | Longest stint | Distinct foursomes (mean) | Court-time spread |
|--------|-------------|---------------|---------------------------|-------------------|
| 5 players | **0%** (was 3.4%) | **4** (was 8) | 5.0 of 5, unchanged | 1 |
| 6 players | 11.7%, unchanged | 4, unchanged | 15.0 of 15, unchanged | 0 |
| 7 players | 25.8%, unchanged | 4, unchanged | 20.2 of 24, unchanged | 1 |
| 8 players | 29.8%, unchanged | 2, unchanged | 22.0 of 24, unchanged | 0 |

Pair coverage remains complete on every roster size, and the 6-player worst case is back to 15 of 15 possible foursomes in all 500 runs.

## Performance Impact

Selection still runs once per match. The filters are two passes over the candidate list (at most 70 entries on 8 players) with a set membership test each, against at most four recent match records.

## Affected Components

- `selectNextPlayers` and `generateMatchSuggestion` in `src/session/sessionScheduler.ts`
- No type, storage, Firestore or UI changes

## Reviewer Context

The `players.length - 4 === 1` condition is the load-bearing line, and it is a deliberate scope limit rather than a special case for one roster size. The rest guarantee is free only when a single player sits out; every larger roster pays for it in variety, and 8 players would pay the whole thing by rebuilding the two sealed foursomes from the previous spec.

`MAX_CONSECUTIVE_MATCHES` is 4 because that is the natural stint on 5 players, where one of five sits each match. It is left unscoped because it measures as a no-op elsewhere, while still giving the session a stated ceiling.
