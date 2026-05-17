# Account Settings Menu Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the top-right UI into an always-available account avatar menu and a settings gear menu that opens focused modals for non-live-match controls.

**Architecture:** Keep all state and callbacks in `App`, where preferences, match state, remotes, session mode, and diagnostics already live. Add focused presentational components for the account menu, gear menu, modal shell, and modal bodies, while shrinking `Controls` to live match actions only. Reuse existing callback contracts and persistence paths.

**Tech Stack:** React 19, TypeScript 5.8, Vite 7, Vitest 3, Testing Library, lucide-react, plain CSS in `src/styles.css`.

---

## File Structure

- Create `src/components/AccountMenu.tsx`: always-present account avatar and account dropdown.
- Create `src/components/AppMenu.tsx`: settings gear button and app tools dropdown.
- Create `src/components/AppModal.tsx`: shared modal shell for focused settings dialogs.
- Create `src/components/MatchSettingsModal.tsx`: match mode, player names, and first-server controls.
- Create `src/components/AnnouncementSettingsModal.tsx`: auto announce, announcement mode, and speech support state.
- Create `src/components/DisplaySettingsModal.tsx`: animations toggle.
- Create `src/components/RemoteControlsModal.tsx`: Bluetooth and watch remote controls.
- Create `src/components/DiagnosticsModal.tsx`: remote input log.
- Modify `src/components/AccountBar.tsx`: render `AccountMenu` and `AppMenu` instead of `SignInButton`.
- Modify `src/components/Controls.tsx`: keep undo, manual announce, and session-live controls only.
- Modify `src/App.tsx`: own active modal state, pass callbacks to menus/modals, and remove persistent status/watch/diagnostics panels from the main scorer.
- Modify `src/styles.css`: add top-bar two-button layout, dropdown, modal, and moved control styles.
- Modify tests in `src/components/*.test.tsx` and `src/App.test.tsx`.
- Preserve the approved spec at `docs/superpowers/specs/2026-05-17-account-settings-menu-revamp-design.md`.

Before every `npm` or Vite command in this project, run:

```bash
source ~/.nvm/nvm.sh && nvm use 22
```

---

### Task 1: Add Always-Available Account Menu

**Files:**
- Create: `src/components/AccountMenu.tsx`
- Modify: `src/components/AccountBar.tsx`
- Modify: `src/components/SignInButton.test.tsx` or replace with `src/components/AccountMenu.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing account menu tests**

Replace the existing `SignInButton` component test with tests for `AccountMenu`. Keep the auth mock. Use this structure:

```tsx
// src/components/AccountMenu.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

const authMock = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../auth', () => ({ useAuth: authMock.useAuth }));

function makeAuthState(overrides = {}) {
  return {
    user: null,
    loading: false,
    isAnonymous: false,
    authUnavailable: false,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  };
}

describe('AccountMenu', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders nothing while auth is loading', async () => {
    (authMock.useAuth as Mock).mockReturnValue(makeAuthState({ loading: true }));
    const { AccountMenu } = await import('./AccountMenu');
    const { container } = render(<AccountMenu />);
    expect(container).toBeEmptyDOMElement();
  });

  it('opens an anonymous account menu with sign in', async () => {
    const signInWithGoogle = vi.fn().mockResolvedValue(undefined);
    (authMock.useAuth as Mock).mockReturnValue(
      makeAuthState({ isAnonymous: true, user: { uid: 'anon', isAnonymous: true }, signInWithGoogle }),
    );
    const { AccountMenu } = await import('./AccountMenu');
    render(<AccountMenu />);

    await userEvent.click(screen.getByRole('button', { name: /account menu/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /sign in with google/i }));

    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens a signed-in account menu with profile details and sign out', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    (authMock.useAuth as Mock).mockReturnValue(
      makeAuthState({
        isAnonymous: false,
        signOut,
        user: { uid: 'g-uid', isAnonymous: false, displayName: 'Arthur Dent', email: 'arthur@example.com', photoURL: null },
      }),
    );
    const { AccountMenu } = await import('./AccountMenu');
    render(<AccountMenu />);

    await userEvent.click(screen.getByRole('button', { name: /account menu for arthur dent/i }));
    expect(screen.getByText('Arthur Dent')).toBeInTheDocument();
    expect(screen.getByText('arthur@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /settings/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('menuitem', { name: /sign out/i }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('shows auth unavailable inside the account menu', async () => {
    (authMock.useAuth as Mock).mockReturnValue(makeAuthState({ authUnavailable: true }));
    const { AccountMenu } = await import('./AccountMenu');
    render(<AccountMenu />);

    await userEvent.click(screen.getByRole('button', { name: /account menu/i }));
    expect(screen.getByText(/unavailable offline/i)).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /sign in/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the account menu test and verify it fails**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/AccountMenu.test.tsx
```

Expected: fails because `AccountMenu.tsx` does not exist.

- [ ] **Step 3: Implement `AccountMenu`**

Create `src/components/AccountMenu.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { LogIn, LogOut, UserCircle } from 'lucide-react';
import { useAuth } from '../auth';

export function AccountMenu() {
  const { user, loading, isAnonymous, authUnavailable, signInWithGoogle, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const accountName = user?.displayName ?? user?.email ?? 'Guest';
  const initials = useMemo(() => getInitials(user?.displayName, user?.email), [user?.displayName, user?.email]);
  const isSignedIn = Boolean(user && !isAnonymous && !authUnavailable);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (loading) return null;

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        type="button"
        className="account-avatar-button"
        aria-label={isSignedIn ? `Account menu for ${accountName}` : 'Account menu'}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((current) => !current)}
      >
        {user?.photoURL && isSignedIn ? (
          <img className="account-avatar-image" src={user.photoURL} alt={accountName} referrerPolicy="no-referrer" />
        ) : isSignedIn ? (
          <span className="account-avatar-fallback" aria-hidden="true">{initials}</span>
        ) : (
          <UserCircle size={30} aria-hidden="true" />
        )}
      </button>

      {isOpen && (
        <div className="account-dropdown" role="menu" aria-label="Account menu">
          <div className="account-dropdown-profile">
            {user?.photoURL && isSignedIn ? (
              <img className="account-dropdown-avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" />
            ) : isSignedIn ? (
              <span className="account-dropdown-avatar account-dropdown-avatar--fallback" aria-hidden="true">{initials}</span>
            ) : (
              <span className="account-dropdown-avatar account-dropdown-avatar--fallback" aria-hidden="true">
                <UserCircle size={22} />
              </span>
            )}
            <div className="account-dropdown-identity">
              <span className="account-dropdown-name">{isSignedIn ? accountName : 'Guest'}</span>
              {isSignedIn && user?.email ? <span className="account-dropdown-email">{user.email}</span> : null}
              {authUnavailable ? <span className="account-dropdown-email">Unavailable offline</span> : null}
            </div>
          </div>

          {!authUnavailable && !isSignedIn ? (
            <button
              type="button"
              className="account-menu-item"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                void signInWithGoogle();
              }}
            >
              <LogIn aria-hidden="true" size={16} />
              <span>Sign in with Google</span>
            </button>
          ) : null}

          {isSignedIn ? (
            <button
              type="button"
              className="account-menu-item"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                void signOut();
              }}
            >
              <LogOut aria-hidden="true" size={16} />
              <span>Sign out</span>
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function getInitials(displayName?: string | null, email?: string | null): string {
  const source = displayName?.trim() || email?.split('@')[0]?.trim() || 'User';
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}
```

Update `src/components/AccountBar.tsx`:

```tsx
import { AccountMenu } from './AccountMenu';

export function AccountBar() {
  return (
    <header className="app-account-bar" role="banner" aria-label="App account">
      <AccountMenu />
    </header>
  );
}
```

- [ ] **Step 4: Run the account menu test and verify it passes**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/AccountMenu.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Remove or retire the old `SignInButton` component**

If no imports remain, delete `src/components/SignInButton.tsx` and the old `src/components/SignInButton.test.tsx`. Verify with:

```bash
rg -n "SignInButton" src
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/components/AccountMenu.tsx src/components/AccountBar.tsx src/components/AccountMenu.test.tsx src/components/SignInButton.tsx src/components/SignInButton.test.tsx src/styles.css
git commit -m "feat: add always-available account menu"
```

---

### Task 2: Add Gear App Menu And Modal Shell

**Files:**
- Create: `src/components/AppMenu.tsx`
- Create: `src/components/AppModal.tsx`
- Create: `src/components/AppMenu.test.tsx`
- Create: `src/components/AppModal.test.tsx`
- Modify: `src/components/AccountBar.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing tests for `AppMenu`**

Create `src/components/AppMenu.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppMenu, type AppMenuAction } from './AppMenu';

function renderMenu(overrides: Partial<Record<AppMenuAction, () => void>> = {}) {
  const handlers: Record<AppMenuAction, () => void> = {
    matchSettings: vi.fn(),
    announcementSettings: vi.fn(),
    displaySettings: vi.fn(),
    remoteControls: vi.fn(),
    diagnostics: vi.fn(),
    sessionMode: vi.fn(),
    newMatch: vi.fn(),
    ...overrides,
  };
  render(<AppMenu onAction={(action) => handlers[action]()} />);
  return handlers;
}

describe('AppMenu', () => {
  it('opens the settings menu from the gear button', async () => {
    renderMenu();

    await userEvent.click(screen.getByRole('button', { name: /settings menu/i }));

    expect(screen.getByRole('menu', { name: /settings menu/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /match settings/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /announcement settings/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /display settings/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /remote controls/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /diagnostics/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /session mode/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /new match/i })).toBeInTheDocument();
  });

  it('calls the chosen action and closes the menu', async () => {
    const handlers = renderMenu();

    await userEvent.click(screen.getByRole('button', { name: /settings menu/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /remote controls/i }));

    expect(handlers.remoteControls).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu', { name: /settings menu/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Write failing tests for `AppModal`**

Create `src/components/AppModal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppModal } from './AppModal';

describe('AppModal', () => {
  it('renders a titled dialog and calls onClose from the close button', async () => {
    const onClose = vi.fn();
    render(
      <AppModal title="Match settings" onClose={onClose}>
        <p>Dialog body</p>
      </AppModal>,
    );

    expect(screen.getByRole('dialog', { name: /match settings/i })).toBeInTheDocument();
    expect(screen.getByText('Dialog body')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /close match settings/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    render(
      <AppModal title="Diagnostics" onClose={onClose}>
        <p>Log</p>
      </AppModal>,
    );

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/AppMenu.test.tsx src/components/AppModal.test.tsx
```

Expected: fails because the components do not exist.

- [ ] **Step 4: Implement `AppMenu`**

Create `src/components/AppMenu.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Bell, Bluetooth, ClipboardList, MonitorPlay, RotateCcw, Settings, Users } from 'lucide-react';

export type AppMenuAction =
  | 'matchSettings'
  | 'announcementSettings'
  | 'displaySettings'
  | 'remoteControls'
  | 'diagnostics'
  | 'sessionMode'
  | 'newMatch';

interface AppMenuProps {
  readonly onAction: (action: AppMenuAction) => void;
}

const items: ReadonlyArray<{ action: AppMenuAction; label: string; icon: typeof Settings }> = [
  { action: 'matchSettings', label: 'Match settings', icon: Users },
  { action: 'announcementSettings', label: 'Announcement settings', icon: Bell },
  { action: 'displaySettings', label: 'Display settings', icon: MonitorPlay },
  { action: 'remoteControls', label: 'Remote controls', icon: Bluetooth },
  { action: 'diagnostics', label: 'Diagnostics', icon: ClipboardList },
  { action: 'sessionMode', label: 'Session mode', icon: Users },
  { action: 'newMatch', label: 'New match', icon: RotateCcw },
];

export function AppMenu({ onAction }: AppMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="app-menu" ref={menuRef}>
      <button
        type="button"
        className="app-menu-button"
        aria-label="Settings menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((current) => !current)}
      >
        <Settings size={22} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="account-dropdown app-menu-dropdown" role="menu" aria-label="Settings menu">
          {items.map(({ action, label, icon: Icon }) => (
            <button
              key={action}
              type="button"
              className="account-menu-item"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onAction(action);
              }}
            >
              <Icon aria-hidden="true" size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Implement `AppModal`**

Create `src/components/AppModal.tsx`:

```tsx
import { type ReactNode, useEffect, useId } from 'react';
import { X } from 'lucide-react';

interface AppModalProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly onClose: () => void;
}

export function AppModal({ title, children, onClose }: AppModalProps) {
  const titleId = useId();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="app-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="app-modal-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-button app-modal-close" aria-label={`Close ${title}`} onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="app-modal-body">{children}</div>
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Render both menus in `AccountBar`**

Modify `src/components/AccountBar.tsx`:

```tsx
import { AccountMenu } from './AccountMenu';
import { AppMenu, type AppMenuAction } from './AppMenu';

interface AccountBarProps {
  readonly onAppMenuAction: (action: AppMenuAction) => void;
}

export function AccountBar({ onAppMenuAction }: AccountBarProps) {
  return (
    <header className="app-account-bar" role="banner" aria-label="App account">
      <AccountMenu />
      <AppMenu onAction={onAppMenuAction} />
    </header>
  );
}
```

Temporarily update each `<AccountBar />` in `src/App.tsx` and `src/pages/ControllerPage.tsx` to pass a no-op handler:

```tsx
<AccountBar onAppMenuAction={() => undefined} />
```

- [ ] **Step 7: Add CSS for top bar, gear button, and modal shell**

Add to `src/styles.css` near the existing account styles:

```css
.app-account-bar {
  gap: 10px;
  align-items: center;
}

.app-menu {
  position: relative;
}

.app-menu-button {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 2px solid rgba(255, 255, 255, 0.16);
  border-radius: 50%;
  background: #26343c;
  color: #f5f7fa;
  cursor: pointer;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
}

.app-menu-button:focus-visible,
.app-modal-close:focus-visible {
  outline: 2px solid #68d391;
  outline-offset: 3px;
}

.app-menu-dropdown {
  width: min(280px, calc(100vw - 24px));
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 14px;
  background: rgba(0, 0, 0, 0.62);
}

.app-modal {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: min(100%, 520px);
  max-height: min(86vh, 720px);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  background: #172026;
  box-shadow: 0 22px 60px rgba(0, 0, 0, 0.52);
}

.app-modal-header {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.app-modal-header h2 {
  margin: 0;
  color: #f5f7fa;
  font-size: 1.05rem;
  font-weight: 900;
}

.app-modal-close {
  width: 40px;
  min-height: 40px;
}

.app-modal-body {
  display: grid;
  gap: 12px;
  min-width: 0;
  overflow: auto;
  padding: 12px;
}
```

- [ ] **Step 8: Run menu and modal tests**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/AppMenu.test.tsx src/components/AppModal.test.tsx src/components/AccountMenu.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/AppMenu.tsx src/components/AppModal.tsx src/components/AppMenu.test.tsx src/components/AppModal.test.tsx src/components/AccountBar.tsx src/App.tsx src/pages/ControllerPage.tsx src/styles.css
git commit -m "feat: add settings gear menu and modal shell"
```

---

### Task 3: Extract Match Settings Modal And Shrink Match Controls

**Files:**
- Create: `src/components/MatchSettingsModal.tsx`
- Create: `src/components/MatchSettingsModal.test.tsx`
- Modify: `src/components/Controls.tsx`
- Modify: `src/components/Controls.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing tests for match settings modal**

Create `src/components/MatchSettingsModal.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createMatch } from '../domain/matchEngine';
import { DEFAULT_PLAYER_NAMES } from '../preferences';
import { MatchSettingsModal } from './MatchSettingsModal';

function renderModal(overrides = {}) {
  const props = {
    match: createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' }),
    matchMode: 'doubles' as const,
    playerNames: { ...DEFAULT_PLAYER_NAMES },
    onMatchModeChange: vi.fn(),
    onSetInitialServer: vi.fn(),
    onRerollFirstServer: vi.fn(),
    onPlayerNameChange: vi.fn(),
    ...overrides,
  };
  render(<MatchSettingsModal {...props} />);
  return props;
}

describe('MatchSettingsModal', () => {
  it('renders match mode, player names, and first-server controls before the match starts', () => {
    renderModal();

    expect(screen.getByRole('group', { name: /match mode/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /team a player 1 name/i })).toHaveValue('Player 1');
    expect(screen.getByRole('button', { name: /team b player 3 serves/i })).toBeInTheDocument();
  });

  it('calls match settings callbacks', async () => {
    const user = userEvent.setup();
    const props = renderModal();

    await user.click(screen.getByRole('button', { name: /singles/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /team a player 1 name/i }), { target: { value: 'Alice' } });
    await user.click(screen.getByRole('button', { name: /reroll first server/i }));
    await user.click(screen.getByRole('button', { name: /team b player 3 serves/i }));

    expect(props.onMatchModeChange).toHaveBeenCalledWith('singles');
    expect(props.onPlayerNameChange).toHaveBeenCalledWith('A1', 'Alice');
    expect(props.onRerollFirstServer).toHaveBeenCalledTimes(1);
    expect(props.onSetInitialServer).toHaveBeenCalledWith('teamB', 'B1');
  });
});
```

- [ ] **Step 2: Update failing Controls tests for the new live-only boundary**

In `src/components/Controls.test.tsx`, remove tests that expect player names, match mode, announcement mode, animation toggle, new match, and session mode inside `Controls`. Add this test:

```tsx
it('renders only live match actions and session-playing actions', () => {
  renderControls({
    showBackToSessionSuggestion: true,
    onBackToSessionSuggestion: vi.fn(),
    onEndSession: vi.fn(),
  });

  expect(screen.getByRole('button', { name: /undo last point/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /announce score/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /back to suggestion/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /end session/i })).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('group', { name: /match mode/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /new match/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /session mode/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Run targeted tests and verify failure**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/MatchSettingsModal.test.tsx src/components/Controls.test.tsx
```

Expected: fails because `MatchSettingsModal` does not exist and `Controls` still renders moved controls.

- [ ] **Step 4: Implement `MatchSettingsModal`**

Create `src/components/MatchSettingsModal.tsx` by moving the existing match setup JSX from `Controls`:

```tsx
import type { MatchMode, MatchState, PlayerId, TeamId } from '../domain/matchTypes';

interface MatchSettingsModalProps {
  readonly match: MatchState;
  readonly matchMode: MatchMode;
  readonly playerNames: Record<PlayerId, string>;
  readonly onMatchModeChange: (mode: MatchMode) => void;
  readonly onSetInitialServer: (teamId: TeamId, playerId: PlayerId) => void;
  readonly onRerollFirstServer: () => void;
  readonly onPlayerNameChange: (playerId: PlayerId, name: string) => void;
}

export function MatchSettingsModal({
  match,
  matchMode,
  playerNames,
  onMatchModeChange,
  onSetInitialServer,
  onRerollFirstServer,
  onPlayerNameChange,
}: MatchSettingsModalProps) {
  const canSetInitialServer = match.score.teamA === 0 && match.score.teamB === 0 && match.history.length === 0;

  return (
    <div className="settings-panel">
      <div className="mode-toggle" role="group" aria-label="Match mode">
        <button
          type="button"
          className={matchMode === 'doubles' ? 'mode-option is-selected' : 'mode-option'}
          aria-pressed={matchMode === 'doubles'}
          disabled={matchMode === 'doubles'}
          onClick={() => onMatchModeChange('doubles')}
        >
          Doubles
        </button>
        <button
          type="button"
          className={matchMode === 'singles' ? 'mode-option is-selected' : 'mode-option'}
          aria-pressed={matchMode === 'singles'}
          disabled={matchMode === 'singles'}
          onClick={() => onMatchModeChange('singles')}
        >
          Singles
        </button>
      </div>

      {canSetInitialServer ? (
        <div className="setup-controls" role="group" aria-label="First server setup">
          <div className="player-names-editor">
            <PlayerNameTeam teamLabel="Team A" fields={matchMode === 'doubles' ? ['A1', 'A2'] : ['A1']} playerNames={playerNames} onPlayerNameChange={onPlayerNameChange} />
            <PlayerNameTeam teamLabel="Team B" fields={matchMode === 'doubles' ? ['B1', 'B2'] : ['B1']} playerNames={playerNames} onPlayerNameChange={onPlayerNameChange} />
          </div>
          <button type="button" onClick={onRerollFirstServer}>Reroll first server</button>
          <button type="button" onClick={() => onSetInitialServer('teamA', 'A1')}>Team A {playerNames.A1} serves</button>
          <button type="button" onClick={() => onSetInitialServer('teamB', 'B1')}>Team B {playerNames.B1} serves</button>
        </div>
      ) : (
        <p className="settings-note">Match setup is locked after the first rally.</p>
      )}
    </div>
  );
}

function PlayerNameTeam({
  teamLabel,
  fields,
  playerNames,
  onPlayerNameChange,
}: {
  readonly teamLabel: string;
  readonly fields: readonly PlayerId[];
  readonly playerNames: Record<PlayerId, string>;
  readonly onPlayerNameChange: (playerId: PlayerId, name: string) => void;
}) {
  return (
    <div className="player-names-team">
      <span className="player-names-label">{teamLabel}</span>
      {fields.map((playerId, index) => (
        <label key={playerId} className="player-name-field">
          <span>P{index + 1}</span>
          <input
            type="text"
            value={playerNames[playerId]}
            maxLength={20}
            aria-label={`${teamLabel} player ${index + 1} name`}
            onChange={(event) => onPlayerNameChange(playerId, event.target.value)}
          />
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Shrink `Controls`**

Modify `src/components/Controls.tsx` so props only include:

```ts
interface ControlsProps {
  readonly onUndo: () => void;
  readonly onAnnounce: () => void;
  readonly showBackToSessionSuggestion?: boolean;
  readonly onBackToSessionSuggestion?: () => void;
  readonly onEndSession?: () => void;
}
```

Render:

```tsx
<section className="controls" aria-label="Match controls">
  <div className="utility-controls live-utility-controls">
    <button className="icon-button" type="button" onClick={onUndo} aria-label="Undo last point">
      <RotateCcw size={22} aria-hidden="true" />
    </button>
    <button className="icon-button" type="button" onClick={onAnnounce} aria-label="Announce score">
      <Megaphone size={22} aria-hidden="true" />
    </button>
  </div>
  {/* Keep existing Back to suggestion and End session action rendering here. */}
</section>
```

Do not render match mode, player names, auto announce, announcement mode, animations, new match, or session mode in `Controls`.

- [ ] **Step 6: Wire match settings modal in `App`**

Add active modal state in `src/App.tsx`:

```ts
import { AppModal } from './components/AppModal';
import { MatchSettingsModal } from './components/MatchSettingsModal';
import type { AppMenuAction } from './components/AppMenu';

type ActiveModal = 'matchSettings' | 'announcementSettings' | 'displaySettings' | 'remoteControls' | 'diagnostics';
const [activeModal, setActiveModal] = useState<ActiveModal | undefined>(undefined);

const handleAppMenuAction = useCallback((action: AppMenuAction) => {
  if (action === 'sessionMode') {
    handleSwitchToSession();
    return;
  }
  if (action === 'newMatch') {
    handleNewMatch();
    return;
  }
  setActiveModal(action);
}, [handleNewMatch, handleSwitchToSession]);
```

Pass `onAppMenuAction={handleAppMenuAction}` to all `AccountBar` instances in `App`.

Render the modal near the end of the main return:

```tsx
{activeModal === 'matchSettings' ? (
  <AppModal title="Match settings" onClose={() => setActiveModal(undefined)}>
    <MatchSettingsModal
      match={match}
      matchMode={preferences.matchMode}
      playerNames={sessionPlayerNames ?? preferences.playerNames}
      onMatchModeChange={handleMatchModeChange}
      onSetInitialServer={handleSetInitialServer}
      onRerollFirstServer={handleRerollFirstServer}
      onPlayerNameChange={appMode === 'session' ? () => undefined : handlePlayerNameChange}
    />
  </AppModal>
) : null}
```

- [ ] **Step 7: Update App tests for moved match controls**

Update affected tests in `src/App.test.tsx` to open the gear menu and Match settings before querying moved controls:

```tsx
async function openSettingsMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /settings menu/i }));
}

async function openMatchSettings(user: ReturnType<typeof userEvent.setup>) {
  await openSettingsMenu(user);
  await user.click(screen.getByRole('menuitem', { name: /match settings/i }));
}
```

For example:

```tsx
it('marks the selected match mode for assistive technology', async () => {
  const user = userEvent.setup();
  render(<App />);

  await openMatchSettings(user);

  expect(screen.getByRole('button', { name: /doubles/i })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: /doubles/i })).toBeDisabled();
  expect(screen.getByRole('button', { name: /singles/i })).toHaveAttribute('aria-pressed', 'false');
});
```

Add a new assertion that the main scorer no longer renders moved setup controls before the modal opens:

```tsx
expect(screen.queryByRole('textbox', { name: /team a player 1 name/i })).not.toBeInTheDocument();
expect(screen.queryByRole('group', { name: /match mode/i })).not.toBeInTheDocument();
```

- [ ] **Step 8: Run targeted tests**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/MatchSettingsModal.test.tsx src/components/Controls.test.tsx src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/MatchSettingsModal.tsx src/components/MatchSettingsModal.test.tsx src/components/Controls.tsx src/components/Controls.test.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: move match setup into settings modal"
```

---

### Task 4: Add Announcement And Display Settings Modals

**Files:**
- Create: `src/components/AnnouncementSettingsModal.tsx`
- Create: `src/components/DisplaySettingsModal.tsx`
- Create: `src/components/AnnouncementSettingsModal.test.tsx`
- Create: `src/components/DisplaySettingsModal.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing modal tests**

Create `src/components/AnnouncementSettingsModal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AnnouncementSettingsModal } from './AnnouncementSettingsModal';

describe('AnnouncementSettingsModal', () => {
  it('updates auto announce and announcement mode', async () => {
    const user = userEvent.setup();
    const onAutoAnnounceChange = vi.fn();
    const onAnnouncementModeChange = vi.fn();
    render(
      <AnnouncementSettingsModal
        autoAnnounce={false}
        announcementMode="full"
        speechStatus="available"
        onAutoAnnounceChange={onAutoAnnounceChange}
        onAnnouncementModeChange={onAnnouncementModeChange}
      />,
    );

    await user.click(screen.getByRole('switch', { name: /auto announce/i }));
    await user.click(screen.getByRole('button', { name: /short announcement/i }));

    expect(onAutoAnnounceChange).toHaveBeenCalledWith(true);
    expect(onAnnouncementModeChange).toHaveBeenCalledWith('short');
    expect(screen.getByText(/speech ready/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /announce score/i })).not.toBeInTheDocument();
  });
});
```

Create `src/components/DisplaySettingsModal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DisplaySettingsModal } from './DisplaySettingsModal';

describe('DisplaySettingsModal', () => {
  it('updates the animations preference', async () => {
    const onAnimationsEnabledChange = vi.fn();
    render(<DisplaySettingsModal animationsEnabled={true} onAnimationsEnabledChange={onAnimationsEnabledChange} />);

    await userEvent.click(screen.getByRole('switch', { name: /animations/i }));

    expect(onAnimationsEnabledChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/AnnouncementSettingsModal.test.tsx src/components/DisplaySettingsModal.test.tsx
```

Expected: fails because the components do not exist.

- [ ] **Step 3: Implement `AnnouncementSettingsModal`**

Create `src/components/AnnouncementSettingsModal.tsx`:

```tsx
import { Volume2, VolumeX } from 'lucide-react';
import type { AnnouncementMode, SpeechStatus } from '../speech/announcer';

interface AnnouncementSettingsModalProps {
  readonly autoAnnounce: boolean;
  readonly announcementMode: AnnouncementMode;
  readonly speechStatus: SpeechStatus;
  readonly onAutoAnnounceChange: (enabled: boolean) => void;
  readonly onAnnouncementModeChange: (mode: AnnouncementMode) => void;
}

export function AnnouncementSettingsModal({
  autoAnnounce,
  announcementMode,
  speechStatus,
  onAutoAnnounceChange,
  onAnnouncementModeChange,
}: AnnouncementSettingsModalProps) {
  return (
    <div className="settings-panel">
      <button
        className={autoAnnounce ? 'toggle-button is-on' : 'toggle-button'}
        type="button"
        role="switch"
        aria-checked={autoAnnounce}
        aria-label="Auto announce"
        onClick={() => onAutoAnnounceChange(!autoAnnounce)}
      >
        {autoAnnounce ? <Volume2 size={20} aria-hidden="true" /> : <VolumeX size={20} aria-hidden="true" />}
        Auto announce
      </button>

      <div className="mode-toggle" role="group" aria-label="Announcement mode">
        <button
          type="button"
          className={announcementMode === 'full' ? 'mode-option is-selected' : 'mode-option'}
          aria-pressed={announcementMode === 'full'}
          disabled={announcementMode === 'full'}
          onClick={() => onAnnouncementModeChange('full')}
        >
          Full announcement
        </button>
        <button
          type="button"
          className={announcementMode === 'short' ? 'mode-option is-selected' : 'mode-option'}
          aria-pressed={announcementMode === 'short'}
          disabled={announcementMode === 'short'}
          onClick={() => onAnnouncementModeChange('short')}
        >
          Short announcement
        </button>
      </div>

      <p className="settings-note">Speech {speechStatus === 'available' ? 'ready' : 'unsupported'}</p>
    </div>
  );
}
```

- [ ] **Step 4: Implement `DisplaySettingsModal`**

Create `src/components/DisplaySettingsModal.tsx`:

```tsx
interface DisplaySettingsModalProps {
  readonly animationsEnabled: boolean;
  readonly onAnimationsEnabledChange: (enabled: boolean) => void;
}

export function DisplaySettingsModal({ animationsEnabled, onAnimationsEnabledChange }: DisplaySettingsModalProps) {
  return (
    <div className="settings-panel">
      <button
        type="button"
        className={animationsEnabled ? 'toggle-button is-on' : 'toggle-button'}
        role="switch"
        aria-checked={animationsEnabled}
        aria-label="Animations"
        onClick={() => onAnimationsEnabledChange(!animationsEnabled)}
      >
        🎬
        Animations
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Wire modals in `App`**

Import and render:

```tsx
import { AnnouncementSettingsModal } from './components/AnnouncementSettingsModal';
import { DisplaySettingsModal } from './components/DisplaySettingsModal';
```

```tsx
{activeModal === 'announcementSettings' ? (
  <AppModal title="Announcement settings" onClose={() => setActiveModal(undefined)}>
    <AnnouncementSettingsModal
      autoAnnounce={preferences.autoAnnounce}
      announcementMode={preferences.announcementMode}
      speechStatus={getSpeechStatus()}
      onAutoAnnounceChange={(autoAnnounce) => updatePreferences((current) => ({ ...current, autoAnnounce }))}
      onAnnouncementModeChange={(announcementMode) => updatePreferences((current) => ({ ...current, announcementMode }))}
    />
  </AppModal>
) : null}

{activeModal === 'displaySettings' ? (
  <AppModal title="Display settings" onClose={() => setActiveModal(undefined)}>
    <DisplaySettingsModal
      animationsEnabled={preferences.animationsEnabled}
      onAnimationsEnabledChange={(animationsEnabled) => updatePreferences((current) => ({ ...current, animationsEnabled }))}
    />
  </AppModal>
) : null}
```

- [ ] **Step 6: Update App tests for moved announcement/display controls**

Add helpers:

```tsx
async function openAnnouncementSettings(user: ReturnType<typeof userEvent.setup>) {
  await openSettingsMenu(user);
  await user.click(screen.getByRole('menuitem', { name: /announcement settings/i }));
}

async function openDisplaySettings(user: ReturnType<typeof userEvent.setup>) {
  await openSettingsMenu(user);
  await user.click(screen.getByRole('menuitem', { name: /display settings/i }));
}
```

Update auto announce and short announcement tests to open Announcement settings before toggling. Keep manual announce on the main screen:

```tsx
await openAnnouncementSettings(user);
await user.click(screen.getByRole('switch', { name: /auto announce/i }));
await user.click(screen.getByRole('button', { name: /close announcement settings/i }));
await user.click(screen.getByRole('button', { name: /announce score/i }));
```

Add assertion:

```tsx
expect(screen.getByRole('button', { name: /announce score/i })).toBeInTheDocument();
expect(screen.queryByRole('switch', { name: /auto announce/i })).not.toBeInTheDocument();
```

- [ ] **Step 7: Run targeted tests**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/AnnouncementSettingsModal.test.tsx src/components/DisplaySettingsModal.test.tsx src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/AnnouncementSettingsModal.tsx src/components/DisplaySettingsModal.tsx src/components/AnnouncementSettingsModal.test.tsx src/components/DisplaySettingsModal.test.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: move announcement and display settings into modals"
```

---

### Task 5: Add Remote Controls And Diagnostics Modals

**Files:**
- Create: `src/components/RemoteControlsModal.tsx`
- Create: `src/components/DiagnosticsModal.tsx`
- Create: `src/components/RemoteControlsModal.test.tsx`
- Create: `src/components/DiagnosticsModal.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing remote modal tests**

Create `src/components/RemoteControlsModal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RemoteControlsModal } from './RemoteControlsModal';

describe('RemoteControlsModal', () => {
  it('shows Bluetooth and inactive watch remote controls', async () => {
    const onConnectBluetooth = vi.fn();
    const onStartWatchRemote = vi.fn();
    render(
      <RemoteControlsModal
        bluetoothStatus="disconnected"
        watchRemote={{ status: 'inactive', code: undefined, error: undefined, lastCommandLabel: undefined }}
        authUnavailable={false}
        onConnectBluetooth={onConnectBluetooth}
        onStartWatchRemote={onStartWatchRemote}
        onStopWatchRemote={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /connect bluetooth remote/i }));
    await userEvent.click(screen.getByRole('button', { name: /start watch remote/i }));

    expect(onConnectBluetooth).toHaveBeenCalledTimes(1);
    expect(onStartWatchRemote).toHaveBeenCalledTimes(1);
  });

  it('shows active watch remote code and stop action', async () => {
    const onStopWatchRemote = vi.fn();
    render(
      <RemoteControlsModal
        bluetoothStatus="unsupported"
        watchRemote={{ status: 'active', code: 'ABC123', error: undefined, lastCommandLabel: 'Team A point' }}
        authUnavailable={false}
        onConnectBluetooth={vi.fn()}
        onStartWatchRemote={vi.fn()}
        onStopWatchRemote={onStopWatchRemote}
      />,
    );

    expect(screen.getByText('ABC123')).toBeInTheDocument();
    expect(screen.getByText(/last: team a point/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /end remote/i }));
    expect(onStopWatchRemote).toHaveBeenCalledTimes(1);
  });
});
```

Create `src/components/DiagnosticsModal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DiagnosticsModal, type DiagnosticEvent } from './DiagnosticsModal';

describe('DiagnosticsModal', () => {
  it('shows empty diagnostic state', () => {
    render(<DiagnosticsModal events={[]} />);
    expect(screen.getByText(/no events seen yet/i)).toBeInTheDocument();
  });

  it('shows keyboard and gamepad diagnostic rows', () => {
    const events: DiagnosticEvent[] = [
      { source: 'keyboard', type: 'keydown', key: 'VolumeUp', code: 'VolumeUp', keyCode: 175, which: 175, repeat: false },
      { source: 'gamepad', type: 'press', gamepadIndex: 0, gamepadId: 'Generic Controller', buttonIndex: 2 },
    ];

    render(<DiagnosticsModal events={events} />);

    expect(screen.getByText(/\[key\] keydown/i)).toBeInTheDocument();
    expect(screen.getByText(/\[gamepad\] press/i)).toBeInTheDocument();
    expect(screen.getByText(/btn 2/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/RemoteControlsModal.test.tsx src/components/DiagnosticsModal.test.tsx
```

Expected: fails because the components do not exist.

- [ ] **Step 3: Implement `RemoteControlsModal`**

Create `src/components/RemoteControlsModal.tsx`:

```tsx
import { Bluetooth, Radio } from 'lucide-react';
import type { BluetoothStatus } from '../input/bluetoothRemote';
import type { WatchRemoteHostStatus } from '../remote/firestoreRemoteTypes';

interface RemoteControlsModalProps {
  readonly bluetoothStatus: BluetoothStatus;
  readonly watchRemote: {
    readonly status: WatchRemoteHostStatus;
    readonly code?: string;
    readonly error?: string;
    readonly lastCommandLabel?: string;
  };
  readonly authUnavailable: boolean;
  readonly onConnectBluetooth: () => void;
  readonly onStartWatchRemote: () => void;
  readonly onStopWatchRemote: () => void;
}

export function RemoteControlsModal({
  bluetoothStatus,
  watchRemote,
  authUnavailable,
  onConnectBluetooth,
  onStartWatchRemote,
  onStopWatchRemote,
}: RemoteControlsModalProps) {
  const bluetoothUnsupported = bluetoothStatus === 'unsupported';

  return (
    <div className="settings-panel">
      <section className="settings-section" aria-label="Bluetooth remote">
        <h3>Bluetooth remote</h3>
        <div className="status-item">
          <Bluetooth size={18} aria-hidden="true" />
          <span>{bluetoothLabel(bluetoothStatus)}</span>
        </div>
        <button
          className="connect-button"
          type="button"
          onClick={onConnectBluetooth}
          disabled={bluetoothUnsupported || bluetoothStatus === 'connecting'}
          aria-label="Connect Bluetooth remote"
        >
          {bluetoothStatus === 'connecting' ? 'Connecting' : 'Connect'}
        </button>
      </section>

      <section className="settings-section" aria-label="Watch remote">
        <h3>Watch remote</h3>
        <div className="status-item">
          <Radio size={18} aria-hidden="true" />
          <span>Watch remote {watchRemote.status}</span>
        </div>
        {watchRemote.status === 'inactive' || watchRemote.status === 'error' ? (
          <button type="button" onClick={onStartWatchRemote} disabled={authUnavailable}>
            Start watch remote
          </button>
        ) : null}
        {watchRemote.status === 'starting' ? <span className="watch-remote-status">Starting...</span> : null}
        {watchRemote.status === 'active' ? (
          <>
            {watchRemote.code ? <div className="watch-remote-code">{watchRemote.code}</div> : null}
            {watchRemote.lastCommandLabel ? <div className="watch-remote-status">Last: {watchRemote.lastCommandLabel}</div> : null}
            <button type="button" onClick={onStopWatchRemote}>End remote</button>
          </>
        ) : null}
        {watchRemote.status === 'stopping' ? <button type="button" disabled>Stopping...</button> : null}
        {watchRemote.error ? <div className="watch-remote-status" role="alert">{watchRemote.error}</div> : null}
        {authUnavailable ? <p className="settings-note">Watch remote unavailable offline.</p> : null}
      </section>
    </div>
  );
}

function bluetoothLabel(status: BluetoothStatus): string {
  if (status === 'unsupported') return 'Bluetooth unsupported: Android Chrome required';
  if (status === 'connected') return 'Bluetooth connected';
  if (status === 'connecting') return 'Bluetooth connecting';
  return 'Bluetooth disconnected';
}
```

- [ ] **Step 4: Implement `DiagnosticsModal`**

Create `src/components/DiagnosticsModal.tsx`:

```tsx
import type { GamepadRemoteDiagnosticEvent } from '../input/gamepadRemote';
import type { KeyboardRemoteDiagnosticEvent } from '../input/keyboardRemote';

export type DiagnosticEvent = ({ source: 'keyboard' } & KeyboardRemoteDiagnosticEvent) | GamepadRemoteDiagnosticEvent;

interface DiagnosticsModalProps {
  readonly events: readonly DiagnosticEvent[];
}

export function DiagnosticsModal({ events }: DiagnosticsModalProps) {
  if (events.length === 0) {
    return <p className="remote-diagnostics-empty">No events seen yet</p>;
  }

  return (
    <ol className="remote-diagnostics-list">
      {events.map((event, index) =>
        event.source === 'gamepad' ? (
          <li key={`gamepad-${event.type}-${event.gamepadIndex}-${event.buttonIndex}-${index}`}>
            <strong>[gamepad] {event.type}</strong>
            <span>Pad {event.gamepadIndex}</span>
            <span>Btn {event.buttonIndex}</span>
            <span title={event.gamepadId}>{event.gamepadId.slice(0, 30)}</span>
          </li>
        ) : (
          <li key={`keyboard-${event.type}-${event.key}-${event.code}-${event.keyCode}-${index}`}>
            <strong>[key] {event.type}</strong>
            <span>Key {event.key || 'Unidentified'}</span>
            <span>Code {event.code || 'none'}</span>
            <span>KeyCode {event.keyCode}</span>
            <span>Which {event.which}</span>
            <span>Repeat {event.repeat ? 'yes' : 'no'}</span>
          </li>
        ),
      )}
    </ol>
  );
}
```

- [ ] **Step 5: Wire modals in `App` and remove page-level panels**

Import:

```tsx
import { RemoteControlsModal } from './components/RemoteControlsModal';
import { DiagnosticsModal, type DiagnosticEvent } from './components/DiagnosticsModal';
```

Remove `StatusBar`, `WatchRemotePanel`, and local `RemoteDiagnostics` rendering from the main scorer layout. Keep the connection hooks and diagnostics state.

Render:

```tsx
{activeModal === 'remoteControls' ? (
  <AppModal title="Remote controls" onClose={() => setActiveModal(undefined)}>
    <RemoteControlsModal
      bluetoothStatus={bluetoothStatus}
      watchRemote={{
        status: watchRemote.status,
        code: watchRemote.code,
        error: watchRemote.error,
        lastCommandLabel: watchRemote.lastCommandLabel,
      }}
      authUnavailable={authUnavailable}
      onConnectBluetooth={handleConnectBluetooth}
      onStartWatchRemote={() => { void watchRemote.start(); }}
      onStopWatchRemote={() => { void watchRemote.stop(); }}
    />
  </AppModal>
) : null}

{activeModal === 'diagnostics' ? (
  <AppModal title="Diagnostics" onClose={() => setActiveModal(undefined)}>
    <DiagnosticsModal events={diagnostics} />
  </AppModal>
) : null}
```

Move the `DiagnosticEvent` type from `App.tsx` to the `DiagnosticsModal` import.

- [ ] **Step 6: Update App tests for moved remote/diagnostic surfaces**

Add helpers:

```tsx
async function openRemoteControls(user: ReturnType<typeof userEvent.setup>) {
  await openSettingsMenu(user);
  await user.click(screen.getByRole('menuitem', { name: /remote controls/i }));
}

async function openDiagnostics(user: ReturnType<typeof userEvent.setup>) {
  await openSettingsMenu(user);
  await user.click(screen.getByRole('menuitem', { name: /diagnostics/i }));
}
```

Update tests that query Bluetooth, watch remote, or diagnostics to open the corresponding modal first:

```tsx
await openRemoteControls(user);
expect(screen.getByText(/android chrome required/i)).toBeInTheDocument();
```

```tsx
await openDiagnostics(user);
expect(screen.getByText(/\[key\] keydown/i)).toBeInTheDocument();
```

Add an assertion that these panels do not render persistently:

```tsx
expect(screen.queryByRole('region', { name: /device status/i })).not.toBeInTheDocument();
expect(screen.queryByLabelText(/watch remote/i)).not.toBeInTheDocument();
expect(screen.queryByLabelText(/remote input log/i)).not.toBeInTheDocument();
```

- [ ] **Step 7: Run targeted tests**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/RemoteControlsModal.test.tsx src/components/DiagnosticsModal.test.tsx src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/RemoteControlsModal.tsx src/components/DiagnosticsModal.tsx src/components/RemoteControlsModal.test.tsx src/components/DiagnosticsModal.test.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: move remote tools into settings modals"
```

---

### Task 6: Final Integration, Styling, And Verification

**Files:**
- Modify: `src/styles.css`
- Modify: `src/App.test.tsx`
- Modify any component tests affected by final accessible labels or layout classes.

- [ ] **Step 1: Add final integration tests for gear actions**

Add tests in `src/App.test.tsx`:

```tsx
it('lets anonymous users open the settings menu and match settings modal', async () => {
  const user = userEvent.setup();
  render(<App />);

  await openMatchSettings(user);

  expect(screen.getByRole('dialog', { name: /match settings/i })).toBeInTheDocument();
});

it('starts session mode from the settings menu', async () => {
  const user = userEvent.setup();
  render(<App />);

  await openSettingsMenu(user);
  await user.click(screen.getByRole('menuitem', { name: /session mode/i }));

  expect(screen.getByRole('region', { name: /session setup/i })).toBeInTheDocument();
});

it('starts a new match from the settings menu with existing confirmation', async () => {
  const user = userEvent.setup();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<App />);

  await user.click(screen.getByRole('button', { name: /award point to team a, score \d+/i }));
  await openSettingsMenu(user);
  await user.click(screen.getByRole('menuitem', { name: /new match/i }));

  expect(confirm).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('score-teamA')).toHaveTextContent('0');
});
```

- [ ] **Step 2: Run full app test file**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Finish CSS polish**

In `src/styles.css`, ensure:

```css
.settings-panel {
  display: grid;
  gap: 12px;
}

.settings-section {
  display: grid;
  gap: 10px;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: #101820;
}

.settings-section h3 {
  margin: 0;
  color: #aabcc4;
  font-size: 0.78rem;
  font-weight: 900;
  text-transform: uppercase;
}

.settings-note {
  margin: 0;
  color: #aabcc4;
  font-size: 0.84rem;
  font-weight: 700;
}

.live-utility-controls {
  grid-template-columns: 54px 54px;
}
```

Check that no modal content overflows at 320px width by reviewing CSS constraints. No browser screenshot is required unless the implementation changes visual layout beyond these standard components, but use the Browser plugin if the UI looks suspect during execution.

- [ ] **Step 4: Run project verification commands**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test
source ~/.nvm/nvm.sh && nvm use 22 && npm run lint
source ~/.nvm/nvm.sh && nvm use 22 && npm run build
node --check public/sw.js
```

Expected: all commands pass.

- [ ] **Step 5: Inspect git diff**

Run:

```bash
git status --short
git diff --stat
git diff -- src/App.tsx src/components src/styles.css src/App.test.tsx
```

Expected: only account/settings-menu revamp files and tests changed.

- [ ] **Step 6: Commit final cleanup**

```bash
git add src docs/superpowers/specs/2026-05-17-account-settings-menu-revamp-design.md
git commit -m "feat: revamp account and settings menus"
```

If previous task commits already contain all changes and this task only verifies, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Account avatar is always present and account-focused: Task 1.
- Gear menu available without sign-in: Task 2 and Task 6 integration tests.
- Focused modals for related settings: Tasks 3, 4, and 5.
- Session mode remains full-screen: Task 2 action contract and Task 6 integration test.
- During-match actions stay on the main screen: Task 3 `Controls` changes and Task 4 App tests.
- Remote/watch/diagnostics move into modals: Task 5.
- Existing confirmations remain: Task 3 and Task 6 App tests.
- Required spec already exists: `docs/superpowers/specs/2026-05-17-account-settings-menu-revamp-design.md`.

Placeholder scan: no placeholder markers or deferred implementation steps.

Type consistency: `AppMenuAction`, `ActiveModal`, modal prop names, and diagnostics event type are defined before use and reused consistently.
