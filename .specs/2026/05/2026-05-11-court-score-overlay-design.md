---
title: Court Score Overlay Redesign
author: arthur.kok
date: 2026-05-11
status: implemented
tags: [ui, display]
domain: ui
---

# Court Score Overlay Redesign

## Goal

Redesign the live match screen around one large court display. The court should be the primary visual object in both phone and wide responsive layouts, with both teams' scores joined in one center score box over the net. The overlay should show only the numeric scores; player positions on the court provide the surrounding context.

## Scope

This redesign covers the match-playing screen only. Session setup, match suggestions, controller pages, scoring rules, remote input behavior, speech announcements, and persistence stay unchanged.

The current standalone scoreboard panel is removed from the match-playing layout. Scoring by touch remains available through the overlaid score halves.

## User Experience

The first visual priority is a single regulation-proportioned badminton court. Team A remains on the left half and Team B remains on the right half. Both scores are joined in one compact center box that straddles the net, with Team A's score on the left side of the box and Team B's score on the right side.

The score overlay displays only the score numbers. It does not show team names, serving details, server names, receiver names, or explanatory text. Existing player chips remain on the court in their service lanes, and the active server remains visually highlighted through the player chip. Player chips show only the player name; they do not show server, receiver, or court-side labels.

The joined score box contains two adjacent tap targets. Tapping the left score awards Team A a point, and tapping the right score awards Team B a point. After the game has a winner, both score tap targets are disabled.

The serving team may receive a non-text visual treatment, such as a subtle outline or glow around that team's score backing. This indicator must not add labels or clutter to the score overlay.

## Responsive Layout

The match screen uses the court as a full-width primary display at all viewport widths.

On phone-sized screens, the court fills the available width while preserving the existing regulation court aspect ratio. Controls and status panels remain below the court.

On wide screens, the court expands across the layout width instead of sharing a two-column row with a separate scoreboard. Controls, status, diagnostics, and watch-remote panels stay below the court in the existing page flow.

## Component Design

`CourtView` becomes the scoring display component. It receives the existing `match` prop and a new `onPointTeam(teamId)` callback.

Inside the `.court` container, `CourtView` renders:

- the existing regulation SVG court diagram;
- a centered joined score box with one button for Team A's score and one button for Team B's score;
- the existing player position layer;
- winner-disabled behavior for score buttons.

The visible score buttons contain only the numeric values from `match.score.teamA` and `match.score.teamB`.

The existing `Scoreboard` component is removed from the match-playing screen. If it is no longer referenced by tests or other screens after this change, it can be deleted. If keeping it avoids unrelated churn, it should not appear in the live match layout.

## Accessibility

The UI remains score-only visually, but score buttons need descriptive accessible names.

Each score button should expose an `aria-label` such as:

- `Award point to Team A, score 7`
- `Award point to Team B, score 4`

When a winner exists, both score buttons are disabled so accidental taps cannot change the finished game.

The court section remains labelled as the match court or court positions. The SVG court diagram keeps its existing accessible image label.

## Styling

The score overlay should feel integrated with the court instead of like a separate scoreboard laid on top. Use one centered joined box over the net with oversized numerals on each side and enough contrast to read over court lines. On phone-sized screens, the score numerals should use a smaller responsive clamp so they do not dominate the court or crowd the player chips.

Use a translucent backing or text treatment if needed to keep the score readable. The backing should be compact enough not to obscure the player chips or make the regulation court unreadable.

Player chips remain readable and centered in their service lanes. Name text should be large, especially on wide displays where it may scale up to about `3rem`, while the mobile layout keeps player names around `1rem` and provides enough chip width for default names to fit cleanly. Layering must ensure that score tap targets are usable while player chips still display above the court surface. The implementation can use z-index and pointer-event rules to make only the score halves interactive.

## Testing

Update `CourtView` tests to verify:

- the regulation SVG court still renders with the same viewBox and court lines;
- both numeric scores render in one joined center score box;
- clicking Team A's score area calls `onPointTeam('teamA')`;
- clicking Team B's score area calls `onPointTeam('teamB')`;
- score buttons are disabled when `match.winnerTeamId` is set;
- player lane mirroring remains unchanged;
- player chips show names only, without server, receiver, or court-side text.

Update app-level tests only where they assert the old separate scoreboard layout.

## Out of Scope

This change does not alter scoring rules, player rotation, remote command mappings, speech announcement content, session scheduling, or controller-page display.

