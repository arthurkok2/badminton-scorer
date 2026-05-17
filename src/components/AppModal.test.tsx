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

  it('calls onClose when the backdrop is clicked', async () => {
    const onClose = vi.fn();
    render(
      <AppModal title="Display settings" onClose={onClose}>
        <p>Display body</p>
      </AppModal>,
    );

    await userEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
