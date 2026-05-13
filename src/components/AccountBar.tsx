import { SignInButton } from './SignInButton';

export function AccountBar() {
  return (
    <header className="app-account-bar" role="banner" aria-label="App account">
      <SignInButton />
    </header>
  );
}
