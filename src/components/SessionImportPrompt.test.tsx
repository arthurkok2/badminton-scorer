import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { GlobalPlayer } from '../session/sessionTypes';
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

it('calls onImport with the full mapping when all names are mapped', async () => {
  const onImport = vi.fn();
  const alice: GlobalPlayer = { id: 'p1', displayName: 'Alice', searchName: 'alice', createdBy: 'uid-1', claimStatus: 'guest' as const, globalIndividualElo: 1500, globalMatchCount: 0, statsVersion: 1 };
  render(
    <SessionImportPrompt
      legacyNames={['Legacy Alice']}
      searchResults={[alice]}
      onSearchPlayers={vi.fn()}
      onCreatePlayer={vi.fn()}
      onImport={onImport}
      onDismiss={vi.fn()}
    />,
  );

  // Map the legacy name to alice
  await userEvent.click(screen.getByRole('button', { name: /map legacy alice/i }));
  await userEvent.click(screen.getByRole('button', { name: /select alice/i }));

  // Now import
  await userEvent.click(screen.getByRole('button', { name: /import/i }));

  expect(onImport).toHaveBeenCalledOnce();
  const mappingArg = onImport.mock.calls[0][0] as ReadonlyMap<string, GlobalPlayer>;
  expect(mappingArg.get('Legacy Alice')).toEqual(alice);
});
