import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { Controls } from './Controls';

function renderControls(overrides?: {
  showBackToSessionSuggestion?: boolean;
  onBackToSessionSuggestion?: () => void;
  onEndSession?: () => void;
}) {
  const props = {
    onUndo: vi.fn(),
    onAnnounce: vi.fn(),
    showBackToSessionSuggestion: overrides?.showBackToSessionSuggestion,
    onBackToSessionSuggestion: overrides?.onBackToSessionSuggestion,
    onEndSession: overrides?.onEndSession,
  };

  render(<Controls {...props} />);
  return props;
}

describe('Controls', () => {
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
    expect(screen.queryByRole('switch', { name: /auto announce/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /animations/i })).not.toBeInTheDocument();
  });

  it('calls live match action callbacks', async () => {
    const user = userEvent.setup();
    const props = renderControls();

    await user.click(screen.getByRole('button', { name: /undo last point/i }));
    await user.click(screen.getByRole('button', { name: /announce score/i }));

    expect(props.onUndo).toHaveBeenCalledTimes(1);
    expect(props.onAnnounce).toHaveBeenCalledTimes(1);
  });

  it('calls session match action callbacks when shown', async () => {
    const user = userEvent.setup();
    const onBackToSessionSuggestion = vi.fn();
    const onEndSession = vi.fn();
    renderControls({
      showBackToSessionSuggestion: true,
      onBackToSessionSuggestion,
      onEndSession,
    });

    await user.click(screen.getByRole('button', { name: /back to suggestion/i }));
    await user.click(screen.getByRole('button', { name: /end session/i }));

    expect(onBackToSessionSuggestion).toHaveBeenCalledTimes(1);
    expect(onEndSession).toHaveBeenCalledTimes(1);
  });
});
