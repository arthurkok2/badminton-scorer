---
title: 15-Point Scoring Format
author: arthur.kok
date: 2026-11-09
status: implemented
tags: [scoring, preferences, match-settings]
domain: scoring
---

# 15-Point Scoring Format

## Problem

The scoring engine is hard-coded to the standard 21-point rally format (win by 2, cap 30). Players who want the BWF 3×15 format — first to 15, win by 2, cap 21 — have no way to select it, so the scorer cannot follow those matches.

## Goal

Add a persisted **Scoring format** setting with two options:

- **21-point** (default) — target 21, win by 2, cap 30.
- **15-point** — target 15, win by 2, cap 21.

The selected format drives win detection, deuce/match-point animations, and the Little Fighters health bar, and survives reloads and undo.

## Constraints

- Singles/doubles behaviour, service rotation, court-side swapping, and undo semantics are unchanged.
- Existing saved matches without a format load as 21-point.
- 21-point remains the default so current users see no change.
- The format is part of match state, not only the preference, so replaying history uses the rules it was played under.

## Non-Goals

- Best-of-three game tracking. The app still scores a single game; only the target changes.
- Traditional side-out scoring (serving team only scores).
- Per-game or match statistics changes.

## Acceptance Criteria

- A 15-point match ends at 15 when the winner leads by 2, and at 21 at the latest.
- 14-14 is deuce; 14-13 is match point.
- Switching format after scoring starts asks for confirmation and resets the match.
- The preference persists and the settings toggle marks the active format.
- Legacy prefs and saved matches default to 21-point.
- Little Fighters health uses the active target.
- Existing 21-point tests remain green.

## Alternatives Considered

- **Replace 21-point entirely** — rejected: breaks existing users and saved-match expectations.
- **Preference-only format (not stored in match state)** — rejected: changing the preference mid-match or reloading would reinterpret stored scores under different rules.
- **Full 3×15 with games** — deferred: requires game-level state, UI, and stats changes beyond this request.

## Approach

- Add `ScoringFormat = '21-point' | '15-point'` and store `scoringFormat` on `MatchSnapshot`/`MatchState`. `CreateMatchOptions.scoringFormat` is optional and defaults to `'21-point'`.
- Centralise target/cap in `SCORING_RULES`; `getWinner` reads the rule for the match format. `scoringRulesFor(format)` exposes the same rules to animation detection and the health bar.
- `detectAnimationEvent` derives deuce at `target - 1` and match point from target/cap.
- Add `scoringFormat` to `AppPreferences` with tolerant parsing; changing it mirrors the match-mode flow (confirm, clear saved match, reset).
- Normalise missing `scoringFormat` to 21-point when loading saved matches and history snapshots.

## What Changes

- `src/domain/matchTypes.ts` — `ScoringFormat`, snapshot/option fields.
- `src/domain/matchEngine.ts` — scoring rules, format-aware winner, exported `scoringRulesFor`.
- `src/preferences.ts` — preference field, parsing, legacy match normalisation.
- `src/components/MatchSettingsModal.tsx` — scoring format segmented control.
- `src/App.tsx` — format change handler, format threaded through resets/session start/load validation.
- `src/components/CourtView.tsx` — health bar uses the active target.
- `src/animations/detectAnimationEvent.ts` — format-aware deuce and match point.
- Tests for each layer; `.docs/game-engine/scoring-engine.md` and `.docs/ui/ui-architecture.md` updated.

## What Stays the Same

Service rotation, court positioning, undo history shape, session scheduling, remote sync payloads (the whole match state is serialised), and all 21-point behaviour.

## Architecture Impact

- `.docs/game-engine/scoring-engine.md` — documents the two scoring formats.
- `.docs/ui/ui-architecture.md` — documents the new preference.

## Testing Strategy

- Engine unit tests for 15-point win-by-two, 15-point win at target, and 21 cap.
- Animation tests for 14-14 deuce, 14-13 match point, 15-13 and 21-20 match wins.
- Preference tests for default/valid/invalid format and legacy saved match normalisation.
- Component test for the toggle; app test that a 15-point match ends at 15; CourtView health test.

## Verification

`npm test`, `npm run lint`, `npm run build`, and `node --check public/sw.js`.

## Affected Components

Scoring engine, match persistence, match settings modal, animation detection, Little Fighters health display, session match start.
