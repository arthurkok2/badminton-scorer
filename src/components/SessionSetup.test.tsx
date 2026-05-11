import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { SessionSetup } from './SessionSetup';

describe('SessionSetup', () => {
  it('shows a disabled start button with fewer than 4 players', () => {
    render(<SessionSetup savedPlayers={[]} onStartSession={vi.fn()} />);

    expect(screen.getByRole('button', { name: /start session/i })).toBeDisabled();
  });

  it('shows saved player chips for quick-add', () => {
    render(<SessionSetup savedPlayers={['Alice', 'Bob']} onStartSession={vi.fn()} />);

    expect(screen.getByRole('button', { name: /add alice/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add bob/i })).toBeInTheDocument();
  });

  it('adds a player from a chip and enables start after 4 players', async () => {
    render(<SessionSetup savedPlayers={['Alice', 'Bob', 'Carol', 'Dave']} onStartSession={vi.fn()} />);

    for (const name of ['Alice', 'Bob', 'Carol', 'Dave']) {
      await userEvent.click(screen.getByRole('button', { name: new RegExp(`add ${name}`, 'i') }));
    }

    expect(screen.getByRole('button', { name: /start session/i })).not.toBeDisabled();
  });

  it('adds a player by typing and clicking Add', async () => {
    render(<SessionSetup savedPlayers={[]} onStartSession={vi.fn()} />);

    await userEvent.type(screen.getByRole('textbox', { name: /player name/i }), 'Zara');
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));

    expect(screen.getByText('Zara')).toBeInTheDocument();
  });

  it('removes a player when their remove button is clicked', async () => {
    render(<SessionSetup savedPlayers={['Alice']} onStartSession={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /add alice/i }));
    await userEvent.click(screen.getByRole('button', { name: /remove alice/i }));

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('calls onStartSession with the current player list', async () => {
    const onStartSession = vi.fn();
    render(<SessionSetup savedPlayers={['Alice', 'Bob', 'Carol', 'Dave']} onStartSession={onStartSession} />);

    for (const name of ['Alice', 'Bob', 'Carol', 'Dave']) {
      await userEvent.click(screen.getByRole('button', { name: new RegExp(`add ${name}`, 'i') }));
    }
    await userEvent.click(screen.getByRole('button', { name: /start session/i }));

    expect(onStartSession).toHaveBeenCalledWith(['Alice', 'Bob', 'Carol', 'Dave']);
  });

  it('does not add a duplicate name', async () => {
    render(<SessionSetup savedPlayers={['Alice']} onStartSession={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /add alice/i }));
    await userEvent.click(screen.getByRole('button', { name: /add alice/i }));

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
});
