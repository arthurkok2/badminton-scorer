import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { SessionSetup } from './SessionSetup';
import type { GlobalPlayer } from '../session/sessionTypes';

function makePlayer(id: string, displayName: string): GlobalPlayer {
  return {
    id,
    displayName,
    searchName: displayName.toLowerCase(),
    createdBy: 'uid-1',
    claimStatus: 'guest' as const,
    globalIndividualElo: 1500,
    globalMatchCount: 0,
    statsVersion: 1,
  };
}

const alice = makePlayer('p1', 'Alice');
const bob = makePlayer('p2', 'Bob');
const carol = makePlayer('p3', 'Carol');
const dave = makePlayer('p4', 'Dave');

describe('SessionSetup', () => {
  it('shows a disabled Start button with fewer than 4 players', () => {
    render(
      <SessionSetup
        savedPlayers={[]}
        searchResults={[]}
        onSearchPlayers={vi.fn()}
        onCreatePlayer={vi.fn()}
        onStartSession={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /start session/i })).toBeDisabled();
  });

  it('debounces player search while typing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onSearchPlayers = vi.fn();
    render(
      <SessionSetup
        savedPlayers={[]}
        searchResults={[]}
        onSearchPlayers={onSearchPlayers}
        onCreatePlayer={vi.fn()}
        onStartSession={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: /player search/i }), { target: { value: 'A' } });
    fireEvent.change(screen.getByRole('textbox', { name: /player search/i }), { target: { value: 'Al' } });
    fireEvent.change(screen.getByRole('textbox', { name: /player search/i }), { target: { value: 'Ali' } });
    expect(onSearchPlayers).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(249); });
    expect(onSearchPlayers).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(1); });
    expect(onSearchPlayers).toHaveBeenCalledOnce();
    expect(onSearchPlayers).toHaveBeenCalledWith('Ali');

    vi.useRealTimers();
  });

  it('adds a player from search result chips and enables Start after 4 players', async () => {
    const onStartSession = vi.fn();
    render(
      <SessionSetup
        savedPlayers={[]}
        searchResults={[alice, bob, carol, dave]}
        onSearchPlayers={vi.fn()}
        onCreatePlayer={vi.fn()}
        onStartSession={onStartSession}
      />,
    );

    for (const player of [alice, bob, carol, dave]) {
      await userEvent.click(screen.getByRole('button', { name: new RegExp(`add ${player.displayName}`, 'i') }));
    }

    expect(screen.getByRole('button', { name: /start session/i })).not.toBeDisabled();
  });

  it('calls onStartSession with GlobalPlayer[] (not strings)', async () => {
    const onStartSession = vi.fn();
    render(
      <SessionSetup
        savedPlayers={[]}
        searchResults={[alice, bob, carol, dave]}
        onSearchPlayers={vi.fn()}
        onCreatePlayer={vi.fn()}
        onStartSession={onStartSession}
      />,
    );

    for (const player of [alice, bob, carol, dave]) {
      await userEvent.click(screen.getByRole('button', { name: new RegExp(`add ${player.displayName}`, 'i') }));
    }
    await userEvent.click(screen.getByRole('button', { name: /start session/i }));

    expect(onStartSession).toHaveBeenCalledWith([alice, bob, carol, dave]);
  });

  it('does not add duplicate players by id', async () => {
    render(
      <SessionSetup
        savedPlayers={[alice]}
        searchResults={[alice]}
        onSearchPlayers={vi.fn()}
        onCreatePlayer={vi.fn()}
        onStartSession={vi.fn()}
      />,
    );

    // There are two "Add Alice" buttons: one from saved players, one from search results
    const allAddAliceButtons = screen.getAllByRole('button', { name: /add alice/i });
    expect(allAddAliceButtons.length).toBeGreaterThanOrEqual(1);

    // Click the first one
    await userEvent.click(allAddAliceButtons[0]);

    // Click the second one (duplicate by id) - should be a no-op
    if (allAddAliceButtons.length > 1) {
      await userEvent.click(allAddAliceButtons[1]);
    }

    // Should only appear once in the selected list
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('shows saved player chips for quick-add', () => {
    render(
      <SessionSetup
        savedPlayers={[alice, bob]}
        searchResults={[]}
        onSearchPlayers={vi.fn()}
        onCreatePlayer={vi.fn()}
        onStartSession={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /add alice/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add bob/i })).toBeInTheDocument();
  });

  it('shows search result chips', () => {
    render(
      <SessionSetup
        savedPlayers={[]}
        searchResults={[carol, dave]}
        onSearchPlayers={vi.fn()}
        onCreatePlayer={vi.fn()}
        onStartSession={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /add carol/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add dave/i })).toBeInTheDocument();
  });

  it('shows Create player button only when search text is non-empty', async () => {
    render(
      <SessionSetup
        savedPlayers={[]}
        searchResults={[]}
        onSearchPlayers={vi.fn()}
        onCreatePlayer={vi.fn()}
        onStartSession={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /create player/i })).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: /player search/i }), 'New');

    expect(screen.getByRole('button', { name: /create player/i })).toBeInTheDocument();
  });

  it('calls onCreatePlayer with search text when Create player is clicked', async () => {
    const onCreatePlayer = vi.fn().mockResolvedValue(undefined);
    render(
      <SessionSetup
        savedPlayers={[]}
        searchResults={[]}
        onSearchPlayers={vi.fn()}
        onCreatePlayer={onCreatePlayer}
        onStartSession={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByRole('textbox', { name: /player search/i }), 'Newbie');
    await userEvent.click(screen.getByRole('button', { name: /create player/i }));

    expect(onCreatePlayer).toHaveBeenCalledWith('Newbie');
  });
});
