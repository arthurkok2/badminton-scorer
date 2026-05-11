# Badminton Scorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a phone-first badminton score PWA with standard scoring, doubles-priority court state, a regulation-proportioned court diagram, speech announcements, touch controls, and remote input adapters for Web Bluetooth remotes and keyboard-style camera remotes.

**Architecture:** Keep match rules in a framework-independent domain engine under `src/domain`. React renders the live match screen and sends typed commands through one command dispatcher. Speech, preferences, gesture interpretation, Bluetooth, and keyboard remote handling are separate adapters so hardware and browser APIs do not leak into scoring logic.

**Tech Stack:** Vite, React, TypeScript, Vitest, React Testing Library, Web Speech API, Web Bluetooth API, localStorage, CSS modules through plain CSS files.

---

## File Structure

- `package.json`: scripts and dependencies.
- `index.html`: Vite entry document and PWA metadata links.
- `vite.config.ts`: React and Vitest configuration.
- `tsconfig.json`, `tsconfig.node.json`: TypeScript configuration.
- `public/manifest.webmanifest`: installable PWA manifest.
- `public/sw.js`: simple app-shell service worker.
- `src/main.tsx`: React bootstrapping and service worker registration.
- `src/App.tsx`: app composition, command dispatcher, preference persistence.
- `src/styles.css`: phone-first visual system and component layout.
- `src/domain/matchTypes.ts`: match, team, player, court, and command types.
- `src/domain/matchEngine.ts`: deterministic scoring and undo engine.
- `src/domain/matchEngine.test.ts`: domain test coverage for scoring rules.
- `src/speech/announcer.ts`: announcement text and speech synthesis adapter.
- `src/speech/announcer.test.ts`: announcement unit tests.
- `src/input/commands.ts`: command types and command reducer.
- `src/input/gestureInterpreter.ts`: click, double-click, and hold gesture mapping.
- `src/input/gestureInterpreter.test.ts`: simulated remote gesture tests.
- `src/input/bluetoothRemote.ts`: Web Bluetooth adapter and status model.
- `src/input/bluetoothRemote.test.ts`: Bluetooth unsupported and event translation tests.
- `src/input/keyboardRemote.ts`: keyboard-style Bluetooth camera remote adapter for volume-up HID events.
- `src/input/keyboardRemote.test.ts`: keyboard remote key translation, gesture routing, and cleanup tests.
- `src/components/Scoreboard.tsx`: score and server summary.
- `src/components/CourtView.tsx`: regulation-proportioned court layout and player positioning.
- `src/components/CourtView.test.tsx`: court line rendering and mirrored right-side lane tests.
- `src/components/Controls.tsx`: touch controls and toggles.
- `src/components/StatusBar.tsx`: Bluetooth and speech status.
- `src/App.test.tsx`: integration tests for scoring UI and fallback states.
- `src/test/setup.ts`: test environment setup.

---

### Task 1: Scaffold The Vite React App

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Create project configuration files**

Create `package.json`:

```json
{
  "name": "badminton-scorer",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc && vite build",
    "preview": "vite preview --host 0.0.0.0",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "vite": "^7.0.0",
    "typescript": "^5.8.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "lucide-react": "^0.468.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.0",
    "jsdom": "^25.0.0",
    "vitest": "^3.0.0"
  }
}
```

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0f766e" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <title>Badminton Scorer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
});
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and npm exits with code 0.

- [ ] **Step 3: Create the initial React shell**

Create `src/main.tsx`:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
```

Create `src/App.tsx`:

```tsx
export default function App() {
  return (
    <main className="app-shell">
      <section className="scoreboard-panel" aria-label="Badminton scoreboard">
        <p className="eyebrow">Badminton Scorer</p>
        <h1>0 - 0</h1>
        <p>Match setup is ready for implementation.</p>
      </section>
    </main>
  );
}
```

Create `src/styles.css`:

```css
:root {
  color-scheme: dark;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  background: #101820;
  color: #f5f7fa;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background: #101820;
}

button,
input,
select {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  padding: 16px;
}

.scoreboard-panel {
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  padding: 16px;
  background: #16232e;
}

.eyebrow {
  margin: 0 0 8px;
  color: #83c5be;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: 4rem;
  line-height: 1;
}
```

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Verify scaffold**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build successfully and `dist/` is created.

- [ ] **Step 5: Commit scaffold**

Run:

```bash
git add package.json package-lock.json index.html vite.config.ts tsconfig.json tsconfig.node.json src/main.tsx src/App.tsx src/styles.css src/test/setup.ts
git commit -m "chore: scaffold badminton score app"
```

Expected: commit succeeds.

---

### Task 2: Build The Scoring Engine With Tests

**Files:**
- Create: `src/domain/matchTypes.ts`
- Create: `src/domain/matchEngine.ts`
- Create: `src/domain/matchEngine.test.ts`

- [ ] **Step 1: Write failing engine tests**

Create `src/domain/matchEngine.test.ts`:

```ts
import {
  awardPointToReceivingTeam,
  awardPointToServingTeam,
  createMatch,
  setInitialServer,
  undoLastPoint,
} from './matchEngine';

describe('match engine', () => {
  it('creates a doubles match with placeholder teams and players', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });

    expect(match.score).toEqual({ teamA: 0, teamB: 0 });
    expect(match.teams.teamA.name).toBe('Team A');
    expect(match.teams.teamB.players.map((player) => player.name)).toEqual(['Player 3', 'Player 4']);
    expect(match.servingTeamId).toBe('teamA');
    expect(match.serverId).toBe('A1');
    expect(match.receiverId).toBe('B1');
    expect(match.courtPositions.A1).toBe('right');
  });

  it('keeps service with the serving team and swaps that team sides after winning a rally', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const next = awardPointToServingTeam(match);

    expect(next.score).toEqual({ teamA: 1, teamB: 0 });
    expect(next.servingTeamId).toBe('teamA');
    expect(next.serverId).toBe('A1');
    expect(next.receiverId).toBe('B2');
    expect(next.courtPositions.A1).toBe('left');
    expect(next.courtPositions.A2).toBe('right');
  });

  it('changes service to the receiving team without moving players after receiver wins a rally', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const next = awardPointToReceivingTeam(match);

    expect(next.score).toEqual({ teamA: 0, teamB: 1 });
    expect(next.servingTeamId).toBe('teamB');
    expect(next.serverId).toBe('B1');
    expect(next.receiverId).toBe('A2');
    expect(next.courtPositions.B1).toBe('left');
    expect(next.courtPositions.B2).toBe('right');
  });

  it('detects win by two after 20-all and caps at 30', () => {
    let match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    match = { ...match, score: { teamA: 20, teamB: 20 }, servingTeamId: 'teamA', serverId: 'A1', receiverId: 'B1' };

    const twentyOne = awardPointToServingTeam(match);
    expect(twentyOne.winnerTeamId).toBeUndefined();

    const twentyTwo = awardPointToServingTeam(twentyOne);
    expect(twentyTwo.score.teamA).toBe(22);
    expect(twentyTwo.winnerTeamId).toBe('teamA');

    const capped = awardPointToServingTeam({
      ...match,
      score: { teamA: 29, teamB: 29 },
      winnerTeamId: undefined,
    });
    expect(capped.score.teamA).toBe(30);
    expect(capped.winnerTeamId).toBe('teamA');
  });

  it('restores the previous state with last-action undo', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const next = awardPointToServingTeam(match);
    const undone = undoLastPoint(next);

    expect(undone.score).toEqual(match.score);
    expect(undone.serverId).toBe(match.serverId);
    expect(undone.previous).toBeUndefined();
  });

  it('allows changing the initial server before scoring starts', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const changed = setInitialServer(match, 'teamB', 'B2');

    expect(changed.servingTeamId).toBe('teamB');
    expect(changed.serverId).toBe('B2');
    expect(changed.receiverId).toBe('A1');
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test -- src/domain/matchEngine.test.ts
```

Expected: FAIL because `src/domain/matchEngine.ts` does not exist.

- [ ] **Step 3: Implement types and scoring engine**

Create `src/domain/matchTypes.ts`:

```ts
export type MatchMode = 'singles' | 'doubles';
export type TeamId = 'teamA' | 'teamB';
export type PlayerId = 'A1' | 'A2' | 'B1' | 'B2';
export type CourtSide = 'left' | 'right';

export interface Player {
  id: PlayerId;
  name: string;
  teamId: TeamId;
}

export interface Team {
  id: TeamId;
  name: string;
  players: Player[];
}

export interface Score {
  teamA: number;
  teamB: number;
}

export interface MatchState {
  mode: MatchMode;
  teams: Record<TeamId, Team>;
  score: Score;
  servingTeamId: TeamId;
  serverId: PlayerId;
  receiverId: PlayerId;
  courtPositions: Record<PlayerId, CourtSide>;
  winnerTeamId?: TeamId;
  previous?: MatchState;
}

export interface CreateMatchOptions {
  mode: MatchMode;
  initialServingTeamId: TeamId;
  initialServingPlayerId: PlayerId;
}
```

Create `src/domain/matchEngine.ts`:

```ts
import type { CourtSide, CreateMatchOptions, MatchState, PlayerId, Score, TeamId } from './matchTypes';

const TEAM_PLAYERS: Record<TeamId, PlayerId[]> = {
  teamA: ['A1', 'A2'],
  teamB: ['B1', 'B2'],
};

const OPPONENT: Record<TeamId, TeamId> = {
  teamA: 'teamB',
  teamB: 'teamA',
};

export function createMatch(options: CreateMatchOptions): MatchState {
  const base: MatchState = {
    mode: options.mode,
    teams: {
      teamA: {
        id: 'teamA',
        name: 'Team A',
        players: [
          { id: 'A1', name: 'Player 1', teamId: 'teamA' },
          { id: 'A2', name: 'Player 2', teamId: 'teamA' },
        ],
      },
      teamB: {
        id: 'teamB',
        name: 'Team B',
        players: [
          { id: 'B1', name: 'Player 3', teamId: 'teamB' },
          { id: 'B2', name: 'Player 4', teamId: 'teamB' },
        ],
      },
    },
    score: { teamA: 0, teamB: 0 },
    servingTeamId: options.initialServingTeamId,
    serverId: options.initialServingPlayerId,
    receiverId: 'B1',
    courtPositions: {
      A1: 'right',
      A2: 'left',
      B1: 'right',
      B2: 'left',
    },
  };

  return deriveServerAndReceiver(base);
}

export function setInitialServer(match: MatchState, teamId: TeamId, playerId: PlayerId): MatchState {
  if (match.score.teamA !== 0 || match.score.teamB !== 0) {
    return match;
  }

  return deriveServerAndReceiver({
    ...withoutPrevious(match),
    servingTeamId: teamId,
    serverId: playerId,
  });
}

export function awardPointToServingTeam(match: MatchState): MatchState {
  if (match.winnerTeamId) {
    return match;
  }

  const score = addPoint(match.score, match.servingTeamId);
  const servingSide = servingSideForScore(score[match.servingTeamId]);
  const courtPositions = swapTeamToPutPlayerOnSide(match.courtPositions, match.servingTeamId, match.serverId, servingSide);
  const next = deriveServerAndReceiver({
    ...withoutPrevious(match),
    previous: withoutPrevious(match),
    score,
    courtPositions,
  });

  return { ...next, winnerTeamId: getWinner(score) };
}

export function awardPointToReceivingTeam(match: MatchState): MatchState {
  if (match.winnerTeamId) {
    return match;
  }

  const newServingTeamId = OPPONENT[match.servingTeamId];
  const score = addPoint(match.score, newServingTeamId);
  const next = deriveServerAndReceiver({
    ...withoutPrevious(match),
    previous: withoutPrevious(match),
    score,
    servingTeamId: newServingTeamId,
  });

  return { ...next, winnerTeamId: getWinner(score) };
}

export function undoLastPoint(match: MatchState): MatchState {
  return match.previous ? withoutPrevious(match.previous) : match;
}

function deriveServerAndReceiver(match: MatchState): MatchState {
  const serverSide = servingSideForScore(match.score[match.servingTeamId]);
  const serverId = playerOnSide(match.courtPositions, match.servingTeamId, serverSide) ?? match.serverId;
  const receivingTeamId = OPPONENT[match.servingTeamId];
  const receiverId = playerOnSide(match.courtPositions, receivingTeamId, serverSide) ?? TEAM_PLAYERS[receivingTeamId][0];

  return { ...match, serverId, receiverId };
}

function addPoint(score: Score, teamId: TeamId): Score {
  return { ...score, [teamId]: score[teamId] + 1 };
}

function servingSideForScore(score: number): CourtSide {
  return score % 2 === 0 ? 'right' : 'left';
}

function playerOnSide(positions: Record<PlayerId, CourtSide>, teamId: TeamId, side: CourtSide): PlayerId | undefined {
  return TEAM_PLAYERS[teamId].find((playerId) => positions[playerId] === side);
}

function swapTeamToPutPlayerOnSide(
  positions: Record<PlayerId, CourtSide>,
  teamId: TeamId,
  playerId: PlayerId,
  side: CourtSide,
): Record<PlayerId, CourtSide> {
  const [first, second] = TEAM_PLAYERS[teamId];
  const other = playerId === first ? second : first;

  return {
    ...positions,
    [playerId]: side,
    [other]: side === 'right' ? 'left' : 'right',
  };
}

function getWinner(score: Score): TeamId | undefined {
  if (score.teamA === 30) {
    return 'teamA';
  }

  if (score.teamB === 30) {
    return 'teamB';
  }

  if (score.teamA >= 21 && score.teamA - score.teamB >= 2) {
    return 'teamA';
  }

  if (score.teamB >= 21 && score.teamB - score.teamA >= 2) {
    return 'teamB';
  }

  return undefined;
}

function withoutPrevious(match: MatchState): MatchState {
  const { previous, ...rest } = match;
  return rest;
}
```

- [ ] **Step 4: Run engine tests**

Run:

```bash
npm test -- src/domain/matchEngine.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit scoring engine**

Run:

```bash
git add src/domain/matchTypes.ts src/domain/matchEngine.ts src/domain/matchEngine.test.ts
git commit -m "feat: add badminton scoring engine"
```

Expected: commit succeeds.

---

### Task 3: Add Announcements And Preferences

**Files:**
- Create: `src/speech/announcer.ts`
- Create: `src/speech/announcer.test.ts`
- Create: `src/preferences.ts`

- [ ] **Step 1: Write failing announcement tests**

Create `src/speech/announcer.test.ts`:

```ts
import { buildAnnouncement } from './announcer';
import { awardPointToServingTeam, createMatch } from '../domain/matchEngine';

describe('announcer', () => {
  it('announces serving team, serving player, and server score first', () => {
    const match = awardPointToServingTeam(
      createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' }),
    );

    expect(buildAnnouncement(match)).toBe('Team A serving, Player 1, 1-0.');
  });

  it('announces game point after a winner exists', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const winner = {
      ...match,
      score: { teamA: 21, teamB: 10 },
      winnerTeamId: 'teamA' as const,
    };

    expect(buildAnnouncement(winner)).toBe('Game. Team A wins, 21-10.');
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test -- src/speech/announcer.test.ts
```

Expected: FAIL because `src/speech/announcer.ts` does not exist.

- [ ] **Step 3: Implement announcer and preferences**

Create `src/speech/announcer.ts`:

```ts
import type { MatchState, TeamId } from '../domain/matchTypes';

export type SpeechStatus = 'available' | 'unsupported';

export function getSpeechStatus(): SpeechStatus {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? 'available' : 'unsupported';
}

export function buildAnnouncement(match: MatchState): string {
  if (match.winnerTeamId) {
    const winner = match.teams[match.winnerTeamId].name;
    return `Game. ${winner} wins, ${scoreForTeam(match, match.winnerTeamId)}-${scoreForTeam(match, otherTeam(match.winnerTeamId))}.`;
  }

  const server = findPlayerName(match, match.serverId);
  const servingTeam = match.teams[match.servingTeamId].name;
  const receivingTeamId = otherTeam(match.servingTeamId);

  return `${servingTeam} serving, ${server}, ${scoreForTeam(match, match.servingTeamId)}-${scoreForTeam(match, receivingTeamId)}.`;
}

export function speakAnnouncement(match: MatchState): boolean {
  if (getSpeechStatus() === 'unsupported') {
    return false;
  }

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(buildAnnouncement(match)));
  return true;
}

function findPlayerName(match: MatchState, playerId: string): string {
  return [...match.teams.teamA.players, ...match.teams.teamB.players].find((player) => player.id === playerId)?.name ?? playerId;
}

function scoreForTeam(match: MatchState, teamId: TeamId): number {
  return match.score[teamId];
}

function otherTeam(teamId: TeamId): TeamId {
  return teamId === 'teamA' ? 'teamB' : 'teamA';
}
```

Create `src/preferences.ts`:

```ts
export interface AppPreferences {
  autoAnnounce: boolean;
  matchMode: 'singles' | 'doubles';
  remoteMapping: 'server-receiver-default';
}

const STORAGE_KEY = 'badminton-scorer-preferences';

export const DEFAULT_PREFERENCES: AppPreferences = {
  autoAnnounce: false,
  matchMode: 'doubles',
  remoteMapping: 'server-receiver-default',
};

export function loadPreferences(): AppPreferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(preferences: AppPreferences): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}
```

- [ ] **Step 4: Run announcement tests**

Run:

```bash
npm test -- src/speech/announcer.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit speech and preferences**

Run:

```bash
git add src/speech/announcer.ts src/speech/announcer.test.ts src/preferences.ts
git commit -m "feat: add score announcements and preferences"
```

Expected: commit succeeds.

---

### Task 4: Add Command Dispatch And Remote Gesture Mapping

**Files:**
- Create: `src/input/commands.ts`
- Create: `src/input/gestureInterpreter.ts`
- Create: `src/input/gestureInterpreter.test.ts`

- [ ] **Step 1: Write failing gesture tests**

Create `src/input/gestureInterpreter.test.ts`:

```ts
import { createGestureInterpreter } from './gestureInterpreter';

describe('gesture interpreter', () => {
  it('maps one click to point for serving team', () => {
    const commands: string[] = [];
    const interpreter = createGestureInterpreter((command) => commands.push(command.type));

    interpreter.handlePress(0);
    interpreter.handleRelease(80);
    interpreter.flush(260);

    expect(commands).toEqual(['POINT_SERVING']);
  });

  it('maps double click to point for receiving team', () => {
    const commands: string[] = [];
    const interpreter = createGestureInterpreter((command) => commands.push(command.type));

    interpreter.handlePress(0);
    interpreter.handleRelease(70);
    interpreter.handlePress(140);
    interpreter.handleRelease(210);
    interpreter.flush(420);

    expect(commands).toEqual(['POINT_RECEIVING']);
  });

  it('maps hold to undo', () => {
    const commands: string[] = [];
    const interpreter = createGestureInterpreter((command) => commands.push(command.type));

    interpreter.handlePress(0);
    interpreter.handleRelease(850);
    interpreter.flush(900);

    expect(commands).toEqual(['UNDO']);
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test -- src/input/gestureInterpreter.test.ts
```

Expected: FAIL because input files do not exist.

- [ ] **Step 3: Implement command reducer and gesture interpreter**

Create `src/input/commands.ts`:

```ts
import {
  awardPointToReceivingTeam,
  awardPointToServingTeam,
  createMatch,
  setInitialServer,
  undoLastPoint,
} from '../domain/matchEngine';
import type { MatchMode, MatchState, PlayerId, TeamId } from '../domain/matchTypes';

export type AppCommand =
  | { type: 'POINT_SERVING' }
  | { type: 'POINT_RECEIVING' }
  | { type: 'UNDO' }
  | { type: 'RESET'; mode: MatchMode }
  | { type: 'SET_INITIAL_SERVER'; teamId: TeamId; playerId: PlayerId };

export function applyCommand(match: MatchState, command: AppCommand): MatchState {
  switch (command.type) {
    case 'POINT_SERVING':
      return awardPointToServingTeam(match);
    case 'POINT_RECEIVING':
      return awardPointToReceivingTeam(match);
    case 'UNDO':
      return undoLastPoint(match);
    case 'RESET':
      return createMatch({ mode: command.mode, initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    case 'SET_INITIAL_SERVER':
      return setInitialServer(match, command.teamId, command.playerId);
  }
}
```

Create `src/input/gestureInterpreter.ts`:

```ts
import type { AppCommand } from './commands';

const DOUBLE_CLICK_MS = 300;
const HOLD_MS = 650;

export interface GestureInterpreter {
  handlePress(timestamp: number): void;
  handleRelease(timestamp: number): void;
  flush(timestamp: number): void;
}

export function createGestureInterpreter(dispatch: (command: AppCommand) => void): GestureInterpreter {
  let pressStartedAt: number | undefined;
  let clickCount = 0;
  let lastReleaseAt: number | undefined;

  return {
    handlePress(timestamp) {
      pressStartedAt = timestamp;
    },
    handleRelease(timestamp) {
      if (pressStartedAt === undefined) {
        return;
      }

      const duration = timestamp - pressStartedAt;
      pressStartedAt = undefined;

      if (duration >= HOLD_MS) {
        clickCount = 0;
        lastReleaseAt = undefined;
        dispatch({ type: 'UNDO' });
        return;
      }

      clickCount += 1;
      lastReleaseAt = timestamp;

      if (clickCount === 2) {
        clickCount = 0;
        lastReleaseAt = undefined;
        dispatch({ type: 'POINT_RECEIVING' });
      }
    },
    flush(timestamp) {
      if (clickCount === 1 && lastReleaseAt !== undefined && timestamp - lastReleaseAt >= DOUBLE_CLICK_MS) {
        clickCount = 0;
        lastReleaseAt = undefined;
        dispatch({ type: 'POINT_SERVING' });
      }
    },
  };
}
```

- [ ] **Step 4: Run gesture tests**

Run:

```bash
npm test -- src/input/gestureInterpreter.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit command and gesture layer**

Run:

```bash
git add src/input/commands.ts src/input/gestureInterpreter.ts src/input/gestureInterpreter.test.ts
git commit -m "feat: add scoring command input layer"
```

Expected: commit succeeds.

---

### Task 5: Add Bluetooth Remote Adapter

**Files:**
- Create: `src/input/bluetoothRemote.ts`
- Create: `src/input/bluetoothRemote.test.ts`
- Create: `src/types/web-bluetooth.d.ts`

- [ ] **Step 1: Write failing Bluetooth adapter tests**

Create `src/input/bluetoothRemote.test.ts`:

```ts
import { getBluetoothSupportStatus, translateRemoteValue } from './bluetoothRemote';

describe('bluetooth remote adapter', () => {
  it('reports unsupported when navigator.bluetooth is missing', () => {
    expect(getBluetoothSupportStatus({} as Navigator)).toBe('unsupported');
  });

  it('translates simple generic button values to press and release events', () => {
    expect(translateRemoteValue(new Uint8Array([1]))).toBe('press');
    expect(translateRemoteValue(new Uint8Array([0]))).toBe('release');
    expect(translateRemoteValue(new Uint8Array([9]))).toBe('unknown');
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test -- src/input/bluetoothRemote.test.ts
```

Expected: FAIL because `bluetoothRemote.ts` does not exist.

- [ ] **Step 3: Implement Bluetooth status and adapter surface**

Create `src/input/bluetoothRemote.ts`:

```ts
import { createGestureInterpreter } from './gestureInterpreter';
import type { AppCommand } from './commands';

export type BluetoothStatus = 'unsupported' | 'disconnected' | 'connecting' | 'connected';
export type RemoteButtonEvent = 'press' | 'release' | 'unknown';

interface BluetoothRemoteOptions {
  dispatch: (command: AppCommand) => void;
  onStatusChange: (status: BluetoothStatus) => void;
  now?: () => number;
}

export function getBluetoothSupportStatus(navigatorLike: Navigator = navigator): BluetoothStatus {
  return 'bluetooth' in navigatorLike ? 'disconnected' : 'unsupported';
}

export function translateRemoteValue(value: Uint8Array): RemoteButtonEvent {
  if (value[0] === 1) {
    return 'press';
  }

  if (value[0] === 0) {
    return 'release';
  }

  return 'unknown';
}

export async function connectBluetoothRemote(options: BluetoothRemoteOptions): Promise<void> {
  if (!('bluetooth' in navigator)) {
    options.onStatusChange('unsupported');
    return;
  }

  options.onStatusChange('connecting');
  const bluetooth = navigator.bluetooth;
  const now = options.now ?? (() => performance.now());
  const interpreter = createGestureInterpreter(options.dispatch);

  try {
    const device = await bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['battery_service', 'device_information'],
    });

    device.addEventListener('gattserverdisconnected', () => {
      options.onStatusChange('disconnected');
    });

    options.onStatusChange('connected');

    window.setInterval(() => {
      interpreter.flush(now());
    }, 100);
  } catch {
    options.onStatusChange('disconnected');
  }
}
```

Create `src/types/web-bluetooth.d.ts`:

```ts
interface BluetoothDevice extends EventTarget {
  readonly id: string;
  readonly name?: string;
}

interface BluetoothRequestDeviceOptions {
  acceptAllDevices?: boolean;
  optionalServices?: BluetoothServiceUUID[];
}

interface Bluetooth {
  requestDevice(options: BluetoothRequestDeviceOptions): Promise<BluetoothDevice>;
}

interface Navigator {
  readonly bluetooth: Bluetooth;
}
```

- [ ] **Step 4: Run Bluetooth tests and typecheck**

Run:

```bash
npm test -- src/input/bluetoothRemote.test.ts
npm run lint
```

Expected: tests pass and TypeScript exits with code 0.

- [ ] **Step 5: Commit Bluetooth adapter**

Run:

```bash
git add src/input/bluetoothRemote.ts src/input/bluetoothRemote.test.ts src/types/web-bluetooth.d.ts
git commit -m "feat: add bluetooth remote adapter"
```

Expected: commit succeeds.

---

### Task 6: Build The Live Match UI

**Files:**
- Create: `src/components/Scoreboard.tsx`
- Create: `src/components/CourtView.tsx`
- Create: `src/components/Controls.tsx`
- Create: `src/components/StatusBar.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Create: `src/App.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Create `src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App', () => {
  it('awards a point to the serving team from touch controls', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /serving team point/i }));

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText(/Player 1 serving/i)).toBeInTheDocument();
  });

  it('awards a point to the receiving team and changes server', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /receiving team point/i }));

    expect(screen.getByText(/Player 3 serving/i)).toBeInTheDocument();
  });

  it('undoes the last point', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /serving team point/i }));
    await user.click(screen.getByRole('button', { name: /undo/i }));

    expect(screen.getAllByText('0')).toHaveLength(2);
  });

  it('shows bluetooth unsupported fallback text when unavailable', () => {
    render(<App />);

    expect(screen.getByText(/Android Chrome required/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: FAIL because the current app shell has no controls.

- [ ] **Step 3: Create UI components**

Create `src/components/Scoreboard.tsx`:

```tsx
import type { MatchState, TeamId } from '../domain/matchTypes';

interface ScoreboardProps {
  match: MatchState;
}

export function Scoreboard({ match }: ScoreboardProps) {
  const receivingTeamId: TeamId = match.servingTeamId === 'teamA' ? 'teamB' : 'teamA';
  const server = [...match.teams.teamA.players, ...match.teams.teamB.players].find((player) => player.id === match.serverId);

  return (
    <section className="score-grid" aria-label="Score">
      <TeamScore name={match.teams.teamA.name} score={match.score.teamA} active={match.servingTeamId === 'teamA'} />
      <TeamScore name={match.teams.teamB.name} score={match.score.teamB} active={match.servingTeamId === 'teamB'} />
      <p className="server-line">
        {server?.name} serving for {match.teams[match.servingTeamId].name} to {match.teams[receivingTeamId].name}
      </p>
      {match.winnerTeamId ? <p className="winner-line">{match.teams[match.winnerTeamId].name} wins</p> : null}
    </section>
  );
}

function TeamScore({ name, score, active }: { name: string; score: number; active: boolean }) {
  return (
    <article className={active ? 'team-score active' : 'team-score'}>
      <p>{name}</p>
      <strong>{score}</strong>
    </article>
  );
}
```

Create `src/components/CourtView.tsx`:

```tsx
import type { MatchState, PlayerId } from '../domain/matchTypes';

interface CourtViewProps {
  match: MatchState;
}

export function CourtView({ match }: CourtViewProps) {
  const players = [...match.teams.teamA.players, ...match.teams.teamB.players];

  return (
    <section className="court" aria-label="Court positions">
      {players.map((player) => (
        <div
          key={player.id}
          className={courtClass(player.id, match)}
        >
          <span>{player.name}</span>
          <small>{match.courtPositions[player.id]}</small>
        </div>
      ))}
    </section>
  );
}

function courtClass(playerId: PlayerId, match: MatchState): string {
  const side = match.courtPositions[playerId];
  const teamClass = playerId.startsWith('A') ? 'team-a' : 'team-b';
  const serverClass = playerId === match.serverId ? ' server' : '';
  return `court-player ${teamClass} ${side}${serverClass}`;
}
```

Create `src/components/Controls.tsx`:

```tsx
import { RotateCcw, Volume2 } from 'lucide-react';
import type { AppCommand } from '../input/commands';

interface ControlsProps {
  autoAnnounce: boolean;
  canUndo: boolean;
  onCommand: (command: AppCommand) => void;
  onAnnounce: () => void;
  onToggleAutoAnnounce: () => void;
}

export function Controls({ autoAnnounce, canUndo, onCommand, onAnnounce, onToggleAutoAnnounce }: ControlsProps) {
  return (
    <section className="controls" aria-label="Match controls">
      <button className="primary-action" onClick={() => onCommand({ type: 'POINT_SERVING' })}>
        Serving team point
      </button>
      <button className="primary-action secondary" onClick={() => onCommand({ type: 'POINT_RECEIVING' })}>
        Receiving team point
      </button>
      <div className="utility-row">
        <button onClick={() => onCommand({ type: 'UNDO' })} disabled={!canUndo}>
          <RotateCcw size={18} aria-hidden="true" /> Undo
        </button>
        <button onClick={onAnnounce}>
          <Volume2 size={18} aria-hidden="true" /> Announce
        </button>
        <label className="toggle">
          <input type="checkbox" checked={autoAnnounce} onChange={onToggleAutoAnnounce} />
          Auto
        </label>
      </div>
    </section>
  );
}
```

Create `src/components/StatusBar.tsx`:

```tsx
import type { BluetoothStatus } from '../input/bluetoothRemote';
import type { SpeechStatus } from '../speech/announcer';

interface StatusBarProps {
  bluetoothStatus: BluetoothStatus;
  speechStatus: SpeechStatus;
  onConnectBluetooth: () => void;
}

export function StatusBar({ bluetoothStatus, speechStatus, onConnectBluetooth }: StatusBarProps) {
  return (
    <section className="status-bar" aria-label="Device status">
      <div>
        <strong>Remote</strong>
        <span>{bluetoothStatus === 'unsupported' ? 'Android Chrome required' : bluetoothStatus}</span>
      </div>
      <div>
        <strong>Speech</strong>
        <span>{speechStatus}</span>
      </div>
      <button onClick={onConnectBluetooth} disabled={bluetoothStatus === 'unsupported'}>
        Connect
      </button>
    </section>
  );
}
```

- [ ] **Step 4: Wire the app**

Replace `src/App.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { CourtView } from './components/CourtView';
import { Controls } from './components/Controls';
import { Scoreboard } from './components/Scoreboard';
import { StatusBar } from './components/StatusBar';
import { createMatch } from './domain/matchEngine';
import type { MatchState } from './domain/matchTypes';
import { connectBluetoothRemote, getBluetoothSupportStatus, type BluetoothStatus } from './input/bluetoothRemote';
import { applyCommand, type AppCommand } from './input/commands';
import { DEFAULT_PREFERENCES, loadPreferences, savePreferences } from './preferences';
import { getSpeechStatus, speakAnnouncement, type SpeechStatus } from './speech/announcer';

export default function App() {
  const [preferences, setPreferences] = useState(() => {
    try {
      return loadPreferences();
    } catch {
      return DEFAULT_PREFERENCES;
    }
  });
  const [match, setMatch] = useState<MatchState>(() =>
    createMatch({ mode: preferences.matchMode, initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' }),
  );
  const [bluetoothStatus, setBluetoothStatus] = useState<BluetoothStatus>(() => getBluetoothSupportStatus());
  const speechStatus: SpeechStatus = useMemo(() => getSpeechStatus(), []);

  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  function dispatch(command: AppCommand) {
    setMatch((current) => {
      const next = applyCommand(current, command);
      if (preferences.autoAnnounce && next !== current) {
        window.setTimeout(() => speakAnnouncement(next), 0);
      }
      return next;
    });
  }

  function toggleAutoAnnounce() {
    setPreferences((current) => ({ ...current, autoAnnounce: !current.autoAnnounce }));
  }

  return (
    <main className="app-shell">
      <StatusBar
        bluetoothStatus={bluetoothStatus}
        speechStatus={speechStatus}
        onConnectBluetooth={() => connectBluetoothRemote({ dispatch, onStatusChange: setBluetoothStatus })}
      />
      <Scoreboard match={match} />
      <CourtView match={match} />
      <Controls
        autoAnnounce={preferences.autoAnnounce}
        canUndo={Boolean(match.previous)}
        onCommand={dispatch}
        onAnnounce={() => speakAnnouncement(match)}
        onToggleAutoAnnounce={toggleAutoAnnounce}
      />
    </main>
  );
}
```

Replace `src/styles.css` with a complete phone-first stylesheet:

```css
:root {
  color-scheme: dark;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  background: #101820;
  color: #f5f7fa;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background: #101820;
}

button,
input {
  font: inherit;
}

button {
  border: 0;
  border-radius: 8px;
  min-height: 48px;
  padding: 12px 14px;
  color: #f5f7fa;
  background: #284657;
  font-weight: 800;
}

button:disabled {
  opacity: 0.45;
}

.app-shell {
  display: grid;
  gap: 12px;
  min-height: 100vh;
  padding: 12px;
}

.status-bar,
.score-grid,
.court,
.controls {
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  background: #16232e;
}

.status-bar {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 10px;
  font-size: 0.78rem;
}

.status-bar div {
  display: grid;
  gap: 2px;
}

.status-bar span {
  color: #a7c4cf;
}

.score-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 12px;
}

.team-score {
  display: grid;
  gap: 4px;
  border-radius: 8px;
  padding: 12px;
  background: #22313c;
}

.team-score.active {
  outline: 3px solid #ffd166;
}

.team-score p {
  margin: 0;
  color: #a7c4cf;
  font-weight: 800;
}

.team-score strong {
  font-size: 4.4rem;
  line-height: 0.95;
}

.server-line,
.winner-line {
  grid-column: 1 / -1;
  margin: 0;
  font-weight: 800;
}

.winner-line {
  color: #ffd166;
}

.court {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: repeat(2, minmax(78px, 1fr));
  gap: 8px;
  padding: 10px;
}

.court-player {
  display: grid;
  align-content: center;
  gap: 4px;
  min-height: 78px;
  border-radius: 8px;
  padding: 10px;
  background: #203541;
}

.court-player.server {
  outline: 3px solid #ffd166;
}

.court-player.team-a {
  border-left: 5px solid #2dd4bf;
}

.court-player.team-b {
  border-left: 5px solid #f97316;
}

.court-player span {
  font-weight: 900;
}

.court-player small {
  color: #a7c4cf;
  text-transform: uppercase;
}

.controls {
  display: grid;
  gap: 10px;
  padding: 12px;
}

.primary-action {
  min-height: 64px;
  background: #0f766e;
  font-size: 1.05rem;
}

.primary-action.secondary {
  background: #b45309;
}

.utility-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 8px;
  align-items: center;
}

.utility-row button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 48px;
  border-radius: 8px;
  padding: 0 12px;
  background: #284657;
  font-weight: 800;
}

@media (min-width: 720px) {
  .app-shell {
    max-width: 760px;
    margin: 0 auto;
  }
}
```

- [ ] **Step 5: Run UI tests and build**

Run:

```bash
npm test -- src/App.test.tsx
npm run build
```

Expected: UI tests pass and production build succeeds.

- [ ] **Step 6: Commit live match UI**

Run:

```bash
git add src/App.tsx src/App.test.tsx src/components/Scoreboard.tsx src/components/CourtView.tsx src/components/Controls.tsx src/components/StatusBar.tsx src/styles.css
git commit -m "feat: build live match scoreboard UI"
```

Expected: commit succeeds.

---

### Task 7: Add PWA Manifest, Service Worker, And Final Verification

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `public/sw.js`

- [ ] **Step 1: Add PWA assets**

Create `public/manifest.webmanifest`:

```json
{
  "name": "Badminton Scorer",
  "short_name": "Score",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#101820",
  "theme_color": "#0f766e",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

Create `public/sw.js`:

```js
const CACHE_NAME = 'badminton-scorer-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then((response) => response ?? caches.match('/'))));
});
```

- [ ] **Step 2: Add simple generated icons**

Create `public/icon-192.png` and `public/icon-512.png` with a square teal background and white shuttle/score mark. Use a small local script or image editor, then verify both files exist:

```bash
ls -l public/icon-192.png public/icon-512.png
```

Expected: both files exist and have non-zero file sizes.

- [ ] **Step 3: Run complete verification**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all tests pass, TypeScript exits with code 0, and Vite build succeeds.

- [ ] **Step 4: Run the app locally**

Run:

```bash
npm run dev
```

Expected: Vite prints a local URL such as `http://localhost:5173/`.

- [ ] **Step 5: Browser verification**

Open the local URL in the Codex in-app browser or Chrome. Verify:

- The first screen is the live scoreboard, not a landing page.
- The scores are readable on a phone-width viewport.
- Serving team point updates score and server display.
- Receiving team point changes service.
- Undo restores the previous score.
- Announce button does not break the app when speech is unavailable.
- Remote status shows Android Chrome required when Web Bluetooth is unsupported.

- [ ] **Step 6: Commit PWA and verification assets**

Run:

```bash
git add public/manifest.webmanifest public/sw.js public/icon-192.png public/icon-512.png
git commit -m "feat: add badminton score pwa support"
```

Expected: commit succeeds.

---

## Plan Self-Review

- Spec coverage: the plan covers phone-first PWA setup, standard doubles scoring, singles-compatible match mode typing, fast placeholder setup, current server/receiver/court display, last-action undo, speech announcements, touch controls, local preferences, Bluetooth status, gesture mapping, unsupported Bluetooth fallback, engine tests, UI tests, and simulated remote tests.
- Scope check: the plan keeps v1 focused. User accounts, online sync, visible match log, statistics, iPhone Bluetooth support, native packaging, and active-match reload recovery are not included.
- Type consistency: command names are `POINT_SERVING`, `POINT_RECEIVING`, `UNDO`, `RESET`, and `SET_INITIAL_SERVER`; engine functions and UI imports use those exact names throughout.
