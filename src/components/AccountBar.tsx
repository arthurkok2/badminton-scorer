import { AccountMenu } from './AccountMenu';

export function AccountBar() {
  return (
    <header className="app-account-bar" role="banner" aria-label="App account">
      <AccountMenu />
    </header>
  );
}
