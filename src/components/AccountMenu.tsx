import { useEffect, useMemo, useRef, useState } from 'react';
import { LogIn, LogOut, User, WifiOff } from 'lucide-react';
import { useAuth } from '../auth';

export function AccountMenu() {
  const { user, loading, isAnonymous, authUnavailable, signInWithGoogle, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isSignedIn = Boolean(user && !isAnonymous && !authUnavailable);
  const accountName = isSignedIn ? (user?.displayName ?? user?.email ?? 'Signed in') : 'Account menu';
  const initials = useMemo(() => getInitials(user?.displayName, user?.email), [user?.displayName, user?.email]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (loading) return null;

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        type="button"
        className="account-avatar-button"
        aria-label={getAccountButtonLabel({ isSignedIn, authUnavailable, accountName })}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((current) => !current)}
      >
        {isSignedIn && user?.photoURL ? (
          <img className="account-avatar-image" src={user.photoURL} alt={accountName} referrerPolicy="no-referrer" />
        ) : (
          <span className="account-avatar-fallback" aria-hidden="true">
            {isSignedIn ? initials : <User aria-hidden="true" size={20} />}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="account-dropdown" role="menu" aria-label="Account menu">
          {isSignedIn ? (
            <>
              <ProfileSummary
                displayName={accountName}
                email={user?.email}
                photoURL={user?.photoURL}
                initials={initials}
              />
              <button
                type="button"
                className="account-menu-item"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  void signOut();
                }}
              >
                <LogOut aria-hidden="true" size={16} />
                <span>Sign out</span>
              </button>
            </>
          ) : (
            <>
              <NeutralSummary />
              {authUnavailable ? (
                <div className="account-menu-message">
                  <WifiOff aria-hidden="true" size={16} />
                  <span>Sign-in is unavailable offline.</span>
                </div>
              ) : (
                <button
                  type="button"
                  className="account-menu-item"
                  role="menuitem"
                  onClick={() => {
                    setIsOpen(false);
                    void signInWithGoogle();
                  }}
                >
                  <LogIn aria-hidden="true" size={16} />
                  <span>Sign in with Google</span>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface ProfileSummaryProps {
  displayName: string;
  email?: string | null;
  photoURL?: string | null;
  initials: string;
}

function ProfileSummary({ displayName, email, photoURL, initials }: ProfileSummaryProps) {
  return (
    <div className="account-dropdown-profile">
      {photoURL ? (
        <img className="account-dropdown-avatar" src={photoURL} alt="" referrerPolicy="no-referrer" />
      ) : (
        <span className="account-dropdown-avatar account-dropdown-avatar--fallback" aria-hidden="true">
          {initials}
        </span>
      )}
      <div className="account-dropdown-identity">
        <span className="account-dropdown-name">{displayName}</span>
        {email && <span className="account-dropdown-email">{email}</span>}
      </div>
    </div>
  );
}

function NeutralSummary() {
  return (
    <div className="account-dropdown-profile">
      <span className="account-dropdown-avatar account-dropdown-avatar--fallback" aria-hidden="true">
        <User aria-hidden="true" size={18} />
      </span>
      <div className="account-dropdown-identity">
        <span className="account-dropdown-name">Not signed in</span>
        <span className="account-dropdown-email">Local scoring is available</span>
      </div>
    </div>
  );
}

function getAccountButtonLabel({
  isSignedIn,
  authUnavailable,
  accountName,
}: {
  isSignedIn: boolean;
  authUnavailable: boolean;
  accountName: string;
}): string {
  if (isSignedIn) return `Account menu for ${accountName}`;
  if (authUnavailable) return 'Account menu';
  return 'Account menu, sign in with Google';
}

function getInitials(displayName?: string | null, email?: string | null): string {
  const source = displayName?.trim() || email?.split('@')[0]?.trim() || 'User';
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}
