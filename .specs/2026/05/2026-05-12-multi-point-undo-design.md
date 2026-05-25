---
title: Multi-Point Undo Design
author: arthur.kok
date: 2026-05-12
status: implemented
tags: [scoring, engine]
domain: scoring
---

# Multi-Point Undo Design

## Goal

Allow users to undo multiple awarded points in a row during the current match. Undo remains points-only: it does not undo setup actions such as changing or rerolling the initial server before scoring starts.

## Current Behavior

`MatchState` currently stores a single `previous` snapshot. Each awarded point replaces that snapshot with the state before the point, and `undoLastPoint()` restores it. Because the restored state has no prior snapshot, the user can undo only one point.

## Proposed Approach

Replace the single `previous` snapshot with point history stored directly on the match state:

- New matches start with an empty point history.
- Awarding a point appends a cloned snapshot of the pre-point match state to the history before applying scoring, service, court-position, receiver, and winner updates.
- Undo restores the last snapshot and attaches the remaining earlier history to the restored match.
- Undo with an empty history is a no-op.
- Initial-server changes do not append to history.

This keeps undo behavior in the domain engine, so every command source gets multi-undo automatically through the existing `UNDO` command.

## Data Model

`MatchState` should use `history` instead of `previous`.

The history entries should be `MatchSnapshot` values without undo metadata. This avoids nested history, keeps serialized match state compact, and preserves the current clone-and-restore isolation guarantees.

Saved match state should use the new `history` shape after the change. To avoid breaking active saved matches from the existing app version, loading should normalize old saved matches: if a parsed saved match has `previous` and no `history`, convert that `previous` value into a one-entry history.

## Command And UI Behavior

The UI does not need a new control. The existing Undo button, keyboard/gamepad hold gesture, Wear OS remote command, and controller page command continue to dispatch `UNDO`.

The button label may remain "Undo last point" because each click still undoes one point. Repeated clicks undo repeated points.

Scoring after one or more undos should append from the current restored match state, effectively discarding the undone future because history only stores states before the current score path.

## Error Handling

Undo should remain safe and idempotent:

- If no point history exists, return the current match unchanged.
- If storage contains malformed history, fall back to an empty history rather than throwing during app startup.
- Existing storage write failures remain non-critical and should continue to be swallowed.

## Testing

Domain tests should cover:

- Multiple consecutive undos restore score, serving team, server, receiver, court positions, and winner state step by step.
- Undo with no history remains a no-op.
- Stored history snapshots remain independent of later caller mutations.
- Initial-server changes before scoring do not create point history.

Command and app tests should cover:

- Repeated `UNDO` commands walk back multiple awarded points.
- The existing Undo button can be clicked repeatedly to return to earlier scores.
- Scoring after undo follows the restored state and keeps a coherent history.

Persistence tests should cover:

- Loading a new saved match state with `history`.
- Loading an old saved match state with `previous` and normalizing it into one history entry.
- Saving match state writes the new shape without `previous`.

## Out Of Scope

- Redo.
- Visible point log.
- Undoing setup changes.
- Undoing session scheduling actions.

