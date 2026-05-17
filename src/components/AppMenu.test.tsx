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
    expect(screen.queryByRole('menuitem', { name: /remote controls/i })).not.toBeInTheDocument();
  });

  it('hides actions that are not available in the current surface', async () => {
    render(
      <AppMenu
        onAction={() => undefined}
        availableActions={['announcementSettings', 'displaySettings', 'remoteControls', 'diagnostics']}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /settings menu/i }));

    expect(screen.queryByRole('menuitem', { name: /match settings/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /session mode/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /new match/i })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /announcement settings/i })).toBeInTheDocument();
  });
});
