# Court Score Overlay Redesign

Date: 2026-05-11

## Goal

Redesign the live match screen around one large court display. The court should be the primary visual object in both phone and wide responsive layouts, with each team's score overlaid in the center of that team's court half. The overlay should show only the numeric scores; player positions on the court provide the surrounding context.

## Scope

This redesign covers the match-playing screen only. Session setup, match suggestions, controller pages, scoring rules, remote input behavior, speech announcements, and persistence stay unchanged.

The current standalone scoreboard panel is removed from the match-playing layout. Scoring by touch remains available through the overlaid score halves.

## User Experience

The first visual priority is a single regulation-proportioned badminton court. Team A remains on the left half and Team B remains on the right half. Each score is centered within its team's half of the court.

The score overlay displays only the score numbers. It does not show team names, serving details, server names, receiver names, or explanatory text. Existing player chips remain on the court in their service lanes, and the active server remains visually highlighted through the player chip.

Each team score area is a large tap target. Tapping the score area for a team awards a point to that team. After the game has a winner, the score tap targets are disabled.

The serving team may receive a non-text visual treatment, such as a subtle outline or glow around that team's score backing. This indicator must not add labels or clutter to the score overlay.

## Responsive Layout

The match screen uses the court as a full-width primary display at all viewport widths.

On phone-sized screens, the court fills the available width while preserving the existing regulation court aspect ratio. Controls and status panels remain below the court.

On wide screens, the court expands across the layout width instead of sharing a two-column row with a separate scoreboard. Controls, status, diagnostics, and watch-remote panels stay below the court in the existing page flow.

## Component Design

`CourtView` becomes the scoring display component. It receives the existing `match` prop and a new `onPointTeam(teamId)` callback.

Inside the `.court` container, `CourtView` renders:

- the existing regulation SVG court diagram;
- a score overlay with one button for Team A's half and one button for Team B's half;
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

The score overlay should feel integrated with the court instead of like a separate scoreboard laid on top. Use centered, oversized numerals in each half, with enough contrast to read over court lines.

Use a translucent backing or text treatment if needed to keep the score readable. The backing should not obscure the player chips or make the regulation court unreadable.

Player chips remain readable and centered in their service lanes. Layering must ensure that score tap targets are usable while player chips still display above the court surface. The implementation can use z-index and pointer-event rules to make only the score halves interactive.

## Testing

Update `CourtView` tests to verify:

- the regulation SVG court still renders with the same viewBox and court lines;
- both numeric scores render in the court overlay;
- clicking Team A's score area calls `onPointTeam('teamA')`;
- clicking Team B's score area calls `onPointTeam('teamB')`;
- score buttons are disabled when `match.winnerTeamId` is set;
- player lane mirroring remains unchanged.

Update app-level tests only where they assert the old separate scoreboard layout.

## Out of Scope

This change does not alter scoring rules, player rotation, remote command mappings, speech announcement content, session scheduling, or controller-page display.
