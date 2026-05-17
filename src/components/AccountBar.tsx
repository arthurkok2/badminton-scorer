import { AccountMenu } from './AccountMenu';
import { AppMenu, type AppMenuAction } from './AppMenu';

interface AccountBarProps {
  readonly onAppMenuAction: (action: AppMenuAction) => void;
  readonly availableAppMenuActions?: readonly AppMenuAction[];
}

export function AccountBar({ onAppMenuAction, availableAppMenuActions }: AccountBarProps) {
  return (
    <header className="app-account-bar" role="banner" aria-label="App account">
      <AccountMenu />
      <AppMenu onAction={onAppMenuAction} availableActions={availableAppMenuActions} />
    </header>
  );
}
