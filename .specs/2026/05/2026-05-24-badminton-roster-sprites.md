---
title: Badminton Roster Sprites for Little Fighters
author: arthur.kok
date: 2026-05-24
status: draft
tags: [ui, art, display]
domain: ui
---

# Badminton Roster Sprites for Little Fighters

## Problem

The current `little-fighters` display uses two reused fighting-game sprites, one per team. They read as generic brawlers rather than badminton players, and both sides feel visually duplicated because each team shares a single character image.

## Goal

Replace the current fighter theme with a badminton-themed roster that still fits the existing display mode, while making the four on-court players feel like a mixed cast instead of mirrored clones.

## Constraints

- Keep the current pixel-art anime look close enough that the sprites still fit the existing scale, stance readability, and animation treatment.
- Preserve the current `little-fighters` layout, score controls, court projection, attack animation, and touch behavior.
- Avoid adding theme selection, sprite customization UI, or player profile management in this pass.
- Keep sprite wiring deterministic so tests and screenshots remain stable.
- First pass roster size is 8 total sprites: 4 male variants and 4 female variants.

## Non-Goals

- No runtime sprite randomization.
- No user-facing setting to swap roster packs.
- No change to scoring logic, match persistence, or remote control behavior.
- No per-player avatar editor or photo upload flow.

## Acceptance Criteria

- The current team-based fighter art is replaced by badminton-themed sprites in `little-fighters` mode.
- The project includes 8 total roster sprites with unique badminton poses and outfit silhouettes.
- The roster includes 4 male-presenting and 4 female-presenting variants.
- Each visible player slot in doubles renders a deterministic roster sprite rather than sharing one team-level image.
- The existing attack/lunge animation still reads cleanly with the new badminton sprites.
- Existing `little-fighters` tests are updated to reflect the new roster-based rendering model.
- The UI architecture documentation explains that `little-fighters` now uses a roster mapping instead of one sprite per team.

## Alternatives Considered

### Keep two team sprites and only redraw them

This is the smallest art swap, but it does not solve the duplication problem. Both players on a team would still look identical, which weakens the roster feel the user asked for.

### Assign sprites by hashing player names or ids

This would create more variation across matches, but it would also make screenshots and test output less predictable. Deterministic slot mapping is simpler and more stable for the current UI.

### Add a theme-pack or avatar-selection system

This would be more flexible long term, but it adds product surface area and implementation complexity that is outside the current request.

## Approach

Create a shared badminton roster of 8 pixel-art anime sprites and update the `little-fighters` renderer to select from that roster per displayed player instead of per team.

The roster will be designed to stay within the current sprite framing envelope:

- full-body character sprites with transparent backgrounds
- readable racket silhouettes
- clear badminton-ready, serve, defense, and attack-inspired poses
- distinct outfit palettes and hair silhouettes so players do not read as palette swaps

Rendering will stay deterministic. Each visible court slot will map to a specific roster sprite, with the same slot always producing the same image. This keeps the display varied while preserving stable tests and predictable visuals.

## What Changes

- Add 8 badminton roster sprite assets under `public/sprites/`.
- Replace the current `FIGHTER_SPRITES` team map in [src/components/CourtView.tsx](/C:/Users/arthu/Projects/badminton-scorer/src/components/CourtView.tsx:29) with a roster mapping that resolves sprite choice per displayed player.
- Update the `little-fighters` player render path in [src/components/CourtView.tsx](/C:/Users/arthu/Projects/badminton-scorer/src/components/CourtView.tsx:502) so each player uses a roster sprite instead of a single team sprite.
- Adjust tests in [src/components/CourtView.test.tsx](/C:/Users/arthu/Projects/badminton-scorer/src/components/CourtView.test.tsx) if they currently assume one shared sprite per team.
- Update [.docs/ui/ui-architecture.md](/C:/Users/arthu/Projects/badminton-scorer/.docs/ui/ui-architecture.md) to describe the roster-based art model for `little-fighters`.

## What Stays the Same

- `little-fighters` remains a display-mode-only presentation layered on top of the existing match state.
- Court geometry, HUD layout, fullscreen behavior, point scoring controls, and attack feedback remain unchanged.
- CSS sizing should remain close to the current values unless the new art reveals a small fit issue during implementation.

## Architecture Impact

- Update [.docs/ui/ui-architecture.md](/C:/Users/arthu/Projects/badminton-scorer/.docs/ui/ui-architecture.md) to document that `little-fighters` uses a fixed badminton roster and deterministic per-player sprite assignment.
- No updates are expected in scoring, input, data, media, or platform docs because the change is isolated to presentation assets and UI rendering.

## Testing Strategy

- Update or add component tests around `CourtView` so the `little-fighters` mode still renders stable player markers with the roster-based sprite selection.
- Verify that attack state changes still apply the attacking and under-attack classes as before.
- Keep tests focused on rendering behavior and DOM structure rather than pixel comparisons.

## Verification

- Run `source ~/.nvm/nvm.sh && nvm use 22 && npm test`
- Run `source ~/.nvm/nvm.sh && nvm use 22 && npm run lint`
- Run `source ~/.nvm/nvm.sh && nvm use 22 && npm run build`
- Run `node --check public/sw.js`
- Manually inspect `little-fighters` mode in the app to confirm the new sprites fit the court, nameplates, and lunge animation cleanly.

## Performance Impact

The change increases the number of sprite assets shipped for `little-fighters`, but the files are small pixel-art PNGs and only a few are rendered at once. No meaningful runtime CPU impact is expected beyond existing image decode/display costs.

## Risk Analysis

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| New sprites may not fit the existing framing cleanly | medium | Keep sprite proportions close to the current art and verify in the live view before finishing |
| Deterministic slot mapping may feel too static over time | low | Keep the mapping simple now and treat dynamic assignment as a later follow-up if desired |
| Tests may over-assume the old team-sprite model | medium | Update assertions to validate stable player rendering rather than team-level asset duplication |

## Observability

- Visual check in `little-fighters` mode should immediately show mixed badminton athletes instead of duplicated fighter art.
- Any broken sprite mapping will surface as missing images or repeated characters during manual UI verification.

## Affected Components

- `public/sprites/`
- `src/components/CourtView.tsx`
- `src/components/CourtView.test.tsx`
- `src/styles.css` only if small sprite-fit corrections are needed
- `.docs/ui/ui-architecture.md`

## Dependencies

- This work depends only on producing the final roster sprite assets before wiring them into the UI.

## Reviewer Context

- The main product decision is not whether badminton art should replace the fighter theme; that is already requested. The key implementation choice to review is the deterministic per-player roster mapping, chosen to keep variety without introducing randomness or new settings.
