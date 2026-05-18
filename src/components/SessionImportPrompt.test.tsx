import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { SessionImportPrompt } from './SessionImportPrompt';

it('does not import until every legacy name is mapped', async () => {
  const onImport = vi.fn();
  render(
    <SessionImportPrompt
      legacyNames={['Alice']}
      searchResults={[]}
      onSearchPlayers={vi.fn()}
      onCreatePlayer={vi.fn()}
      onImport={onImport}
      onDismiss={vi.fn()}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: /import/i }));

  expect(onImport).not.toHaveBeenCalled();
  expect(screen.getByText(/map every player/i)).toBeInTheDocument();
});

it('dismisses without importing', async () => {
  const onDismiss = vi.fn();
  render(
    <SessionImportPrompt
      legacyNames={['Alice']}
      searchResults={[]}
      onSearchPlayers={vi.fn()}
      onCreatePlayer={vi.fn()}
      onImport={vi.fn()}
      onDismiss={onDismiss}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: /not now/i }));

  expect(onDismiss).toHaveBeenCalled();
});
