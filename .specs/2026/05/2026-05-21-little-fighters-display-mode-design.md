---
title: Little Fighters Display Mode
author: arthur.kok
date: 2026-05-21
status: implemented
tags: [ui, display]
domain: ui
---

# Little Fighters Display Mode

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
- The projection should resemble the 3D reference court: a wide shallow trapezoid with a near edge only moderately wider than the far edge, nearly horizontal baselines, and the net fixed at center court.
- The visible court lines mirror a side-on doubles court from regulation dimensions: outer boundary, singles sidelines, net, short service lines 1.98m from the net, doubles long service lines 0.76m from each back boundary, and solid center service lines split across each half.
- All projected court paths should be generated from the same regulation coordinate system as player anchors so visual line spacing and player placement cannot drift apart.
- The regulation markings must be drawn as explicit foreground SVG paths, including doubles sidelines, singles sidelines, center service lines, and a readable solid net line; the boundary polygon and net mesh are not enough by themselves.
- The fighters may overlap the court, so key regulation markings should also have a thin non-interactive overlay above the court surface while keeping sprites, nameplates, and the HUD above the overlay.
- Player anchors should sit at the center of each projected service court, using the singles sideline, center service line, short service line, and doubles long service line as the service-box bounds.
- Bottom-lane fighters may sit slightly below the exact service-court center so the front-row players read as closer to the near baseline in the perspective view.
- Nameplates should remain above court lines and below the HUD; top-row nameplates may sit below their sprites when that avoids HUD collision.
- Fighter nameplates should use horizontal space and stay close to the sprites: Team A labels sit to the left of the sprite and Team B labels sit to the right of the sprite, rather than stacking below the players.
- Each team keeps a large tappable score button in the HUD.
- HUD score numerals and fighter nameplates should be sized for a larger tablet used as the primary display, with especially prominent player names and mobile-specific reductions only where needed to avoid crowding.
- Each team also gets a health bar whose remaining HP is derived from the opposing score.
- The serving team is marked in the HUD with a `Serve` badge and the active score tile highlight.
- The serving player is labeled `Serving` in the arena, and nameplates should stay readable without colliding across rows.

## Point Feedback

When a point is scored in `little-fighters` mode:

- Detect which team’s score increased by comparing the latest score to the previous render.
- Animate the scoring team’s current server with a short lunge.
- Flash and bounce the opposing side briefly so the score feels like an attack landing.

This feedback is intentionally lightweight and local to the display mode, so it does not interfere with the existing meme/video overlay system.

