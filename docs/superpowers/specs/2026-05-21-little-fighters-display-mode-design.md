# Little Fighters Display Mode

**Date:** 2026-05-21

## Problem

The live match screen only has the standard court overlay. We want an alternate presentation that feels like a side-view fighting game while still keeping badminton scoring clear and touch-friendly.

## Solution

Add a persisted `displayMode` preference with two options:

- `court` keeps the existing regulation court layout.
- `little-fighters` swaps in a stylized arena view.

## Little Fighters Layout

- Two fighters render per team in doubles, with the current server visually advanced toward the net on the same projected court plane.
- A visible badminton court remains on the field so each player still reads as occupying a specific doubles quadrant.
- Each team’s two fighters stack vertically on their side of the court to match the top and bottom service boxes.
- All fighters stay on the same plane rather than being rendered on separate depth tiers.
- The arena is drawn as one SVG isometric court projection so the outer boundary, net, service lines, and player anchors all share the same geometry.
- The visible court lines mirror a side-on doubles court: outer boundary, net, short service lines near the net, long doubles service lines toward each back boundary, and center service split across each half.
- Each team keeps a large tappable score button in the HUD.
- Each team also gets a health bar whose remaining HP is derived from the opposing score.
- The serving team is marked in the HUD with a `Serve` badge and the active score tile highlight.
- The serving player is labeled `Serving` in the arena, and nameplates should stay readable without colliding across rows.

## Point Feedback

When a point is scored in `little-fighters` mode:

- Detect which team’s score increased by comparing the latest score to the previous render.
- Animate the scoring team’s current server with a short lunge.
- Flash and bounce the opposing side briefly so the score feels like an attack landing.

This feedback is intentionally lightweight and local to the display mode, so it does not interfere with the existing meme/video overlay system.
