# Team Scoring Controls Design

## Goal

Replace serving-team and receiving-team scoring controls with direct Team A and Team B point assignment. Service, server, receiver, and court position updates remain inferred from badminton rally rules after each point.

## Behavior

- The court display is the primary scoring control.
- Clicking Team A's overlaid score in the left court half awards Team A a point.
- Clicking Team B's overlaid score in the right court half awards Team B a point.
- Dedicated "Point for serving team" and "Point for receiving team" buttons are removed.
- Keyboard and Bluetooth remote gestures dispatch Team A and Team B commands instead of serving-team and receiving-team commands.
- Undo, new match, match mode, first-server setup, announcements, and winner handling keep their current behavior.

## Command Model

The app command layer should use a team-oriented command:

```ts
{ type: 'POINT_TEAM'; teamId: TeamId }
```

The match engine should expose a team-oriented scoring function:

```ts
awardPointToTeam(match, teamId)
```

If the scoring team is the current serving team, the current service-continuation logic applies. If the scoring team is the receiving team, service changes to that team and existing turnover logic applies.

## UI

`CourtView` receives an `onPointTeam` callback and renders each team's overlaid numeric score as a large button centered in that team's court half. The visible overlay contains only score numbers. Score buttons are disabled after a winner is decided. The active server remains highlighted through the player chip on the court; any serving-team score treatment must be non-textual and visually restrained.

`Controls` no longer owns scoring buttons. It keeps utility controls, match mode, first-server setup, and new match controls.

## Remote Input

Single click maps to Team A scoring. Double click maps to Team B scoring. Hold continues to map to undo.

## Testing

Tests should cover:

- `awardPointToTeam` for serving-team continuation and receiving-team turnover.
- `POINT_TEAM` command handling.
- Court score overlay clicks for Team A and Team B.
- Scoring disabled after a winner.
- Gesture, keyboard, and Bluetooth mappings to Team A and Team B commands.
