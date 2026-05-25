---
title: Little Fighters Sprite Picker
author: arthur.kok
date: 2026-05-25
status: draft
tags: [ui, firebase, players, little-fighters]
domain: ui
---

# Problem

Little fighters currently assigns badminton sprites through a fixed slot map in `CourtView`. Players cannot change their sprite, session players cannot keep a chosen look across devices, and one-off matches cannot experiment with the roster without editing code.

# Goal

Allow users to tap a little-fighters sprite, open a sprite selection modal for that player, and switch to another badminton roster sprite. In session mode, the choice should persist on the global player record in Firestore. Outside session mode, the change should be temporary for the current local match only.

# Constraints

- The interaction only applies to `displayMode === 'little-fighters'`.
- Team B must continue using horizontal CSS mirroring at render time; the roster should not require duplicate right-facing assets.
- Session-mode persistence must use the global player record in Firestore, not local preferences.
- Any signed-in user may update a global player sprite for now because player claiming is not yet implemented.
- One-off match sprite changes must not persist after the current local match is reset or replaced.
- The implementation should follow the existing app modal pattern instead of inventing a second modal system.

# Non-Goals

- Adding new sprite art beyond the existing badminton roster.
- Implementing player ownership, claim workflows, or per-user permission controls.
- Adding sprite selection to the regular court display mode.
- Building a general avatar/profile editor outside the little-fighters experience.

# Acceptance Criteria

- Tapping or clicking a player sprite in little-fighters mode opens a sprite picker modal for that specific player.
- The modal shows the badminton roster as selectable choices and highlights the current choice.
- Choosing a sprite updates the visible fighter immediately.
- In one-off matches, the selection is temporary and is cleared when a fresh non-session match is created or the app resets out of that match.
- In session mode, the selection updates the player's global Firestore record and is used the next time that global player appears in a session match on any device that loads fresh player data.
- Team B fighters continue to render by horizontally flipping the same source sprite asset.
- If the Firestore update fails in session mode, the modal stays open and the user sees an inline or toast-style error instead of a silent failure.
- Existing little-fighters scoring, serving, attack animation, and positioning behavior remain unchanged.

# Alternatives Considered

## 1. Keep sprite selection local-only, keyed by player id in preferences

This is simpler and avoids backend work, but it conflicts with the requirement that session-mode choices live on the global player record and follow the player across devices.

## 2. Store raw sprite asset paths on players

This avoids introducing a catalog id, but it hard-codes UI asset paths into cloud data and makes future asset renames riskier. Stable sprite ids are a cleaner contract.

## 3. Own the picker modal entirely inside `CourtView`

This keeps the click flow physically close to the sprites, but it mixes presentational rendering with app-level persistence decisions, auth-aware writes, and error handling. `App` already coordinates modal flows and session/cloud state, so it is the better owner.

# Approach

Introduce a shared sprite catalog with stable sprite ids and asset metadata. `CourtView` will stop hard-coding a `PlayerId -> asset path` mapping and instead render resolved sprite metadata passed in from above. Each fighter sprite becomes an interactive target that notifies the parent which player was selected.

`App` will own the sprite picker modal state, the resolved sprite assignment logic, and the persistence path. When a sprite is chosen:

- In one-off matches, `App` updates an in-memory override map keyed by match player id (`A1`, `A2`, `B1`, `B2`).
- In session mode, `App` calls a cloud session/player service function that patches the global player record's sprite id in Firestore, then updates local session/search/player state so the new sprite is reflected immediately.

Sprite resolution order should be:

1. Active one-off override for the current match
2. Session/global player sprite id from the global player record
3. Existing deterministic fallback roster assignment

This preserves backwards compatibility for players that do not yet have a saved sprite id.

# What Changes

- `src/components/CourtView.tsx`
  - Accept resolved sprite metadata per visible player instead of deriving everything from a local constant.
  - Make little-fighters sprites interactive and expose an `onPlayerSpriteClick(playerId)` callback.
- `src/App.tsx`
  - Own picker modal state and selected-player context.
  - Resolve current sprite ids for visible players.
  - Maintain temporary one-off sprite overrides.
  - Orchestrate Firestore-backed updates in session mode.
- New UI component, likely `src/components/SpritePickerModal.tsx`
  - Render the sprite selection grid using the existing `AppModal` shell pattern.
  - Show current selection, available roster options, and error state.
- `src/session/sessionTypes.ts`
  - Add an optional sprite id field to `GlobalPlayer`.
- `src/session/playerIdentity.ts`
  - Seed new global players with no sprite id or an explicit optional field shape, depending on the final DTO choice.
- `src/session/cloudSessionService.ts`
  - Add a targeted update helper for player sprite id writes.
  - Ensure returned `GlobalPlayer` data carries the sprite id field through search/load flows.
- `src/session/cloudSessionTypes.ts`
  - Extend the Firestore DTO for player documents with the sprite id field.
- `firestore.rules`
  - Allow the sprite id field on player documents.
  - Permit signed-in users to update that field while preserving the current immutable-field protections.
- Tests
  - `src/components/CourtView.test.tsx`
  - `src/App.test.tsx`
  - `src/session/cloudSessionService.test.ts`
  - `src/firestoreRules.test.ts`

# What Stays the Same

- The badminton roster assets remain the same files in `public/sprites/`.
- Team B still faces the net by CSS mirroring, not alternate asset files.
- Court scoring, session scheduling, Elo updates, and remote-control behavior do not change.
- Non-little-fighters display mode remains non-interactive.

# Architecture Impact

- Update `.docs/ui/ui-architecture.md`
  - Document clickable sprite editing in little-fighters mode and the modal-driven sprite selection flow.
- Update `.docs/data/firebase-services.md`
  - Document the new player sprite field on `players/{playerId}` and the allowed signed-in update behavior for that field.

# Testing Strategy

- Add a UI test that clicking a little-fighters sprite opens the correct picker modal.
- Add a UI test that selecting a sprite in one-off mode updates only the active match view and clears on reset/new match.
- Add a UI test that selecting a sprite in session mode calls the cloud update path and updates the rendered fighter.
- Add service tests for reading/writing the sprite id field on global player records.
- Extend Firestore rules tests to assert the player path now includes the sprite field contract.

# Verification

- Focused runs during implementation:
  - `npm test -- src/components/CourtView.test.tsx`
  - `npm test -- src/App.test.tsx`
  - `npm test -- src/session/cloudSessionService.test.ts`
  - `npm test -- src/firestoreRules.test.ts`
- Required full-project verification before completion:
  - `npm test`
  - `npm run lint`
  - `npm run build`
  - `node --check public/sw.js`

# Security Considerations

- This change expands write access on `players/{playerId}` to include a new mutable sprite field for any named signed-in user.
- The rules must continue to prevent modification of immutable identity fields such as `displayName`, `createdBy`, and `claimStatus`.
- The sprite field must be validated against a bounded set of known sprite ids rather than arbitrary strings if that can be expressed cleanly in rules; if not, app-side validation plus strict field allowlisting is still required.
- Anonymous users and signed-out users must not be able to update global player sprites.

# Risk Analysis

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Sprite picker logic bloats `App` or `CourtView` | medium | Keep roster metadata and resolution helpers in small dedicated modules/components |
| Session-mode write succeeds in UI but local state renders stale data | medium | Update local player/session state from the selected sprite id immediately after a successful write |
| Firestore rules accidentally allow broader player document mutation | medium | Add explicit rule tests for unchanged immutable fields and sprite-only updates |
| One-off overrides leak into later matches | low | Clear override state on fresh non-session match creation and reset paths |

# Observability

- Session-mode save failures should surface as a visible UI error in the modal or existing toast pattern.
- Successful selection should be immediately visible through the changed sprite on court; no additional analytics or logging are required for v1.

# Affected Components

- `CourtView`
- `App`
- `AppModal`
- New sprite picker modal component
- `cloudSessionService`
- `sessionTypes` / Firestore DTO types
- `firestore.rules`

# Dependencies

- Depends on the existing global player registry and signed-in session-mode flow already in place.
- Depends on the existing badminton sprite roster introduced by `2026-05-24-badminton-roster-sprites`.
- No external service or package additions are expected.

# Reviewer Context

- Global players are already shared Firestore records used by session mode for search, scheduling, Elo, and history.
- Current player rules allow signed-in updates for rating/match-count style fields while freezing identity fields. This design extends that mutable surface to include a sprite id field only.
