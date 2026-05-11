# Team Scoring Controls Design

## Goal

Replace serving-team and receiving-team scoring controls with direct Team A and Team B point assignment. Service, server, receiver, and court position updates remain inferred from badminton rally rules after each point.

## Behavior

- The scoreboard is the primary scoring control.
- Clicking Team A's score awards Team A a point.
- Clicking Team B's score awards Team B a point.
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

`Scoreboard` receives an `onPointTeam` callback and renders each team score as a button. The button is disabled after a winner is decided. The visual serving highlight stays on the team currently serving.

`Controls` no longer owns scoring buttons. It keeps utility controls, match mode, first-server setup, and new match controls.

## Remote Input

Single click maps to Team A scoring. Double click maps to Team B scoring. Hold continues to map to undo.

## Testing

Tests should cover:

- `awardPointToTeam` for serving-team continuation and receiving-team turnover.
- `POINT_TEAM` command handling.
- Scoreboard clicks for Team A and Team B.
- Scoring disabled after a winner.
- Gesture, keyboard, and Bluetooth mappings to Team A and Team B commands.
