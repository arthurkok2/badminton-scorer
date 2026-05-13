import { useEffect, useMemo, useRef, useState } from 'react';
import { LogOut, Settings } from 'lucide-react';
import { useAuth } from '../auth';

export function SignInButton() {
  const { user, loading, isAnonymous, authUnavailable, signInWithGoogle, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const accountName = user?.displayName ?? user?.email ?? 'Signed in';
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

  if (authUnavailable) {
    return <span className="sign-in-unavailable">Unavailable offline</span>;
  }

  if (isAnonymous || !user) {
    return (
      <button type="button" className="sign-in-button" onClick={() => void signInWithGoogle()}>
        Sign in with Google
      </button>
    );
  }

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        type="button"
        className="account-avatar-button"
        aria-label={`Account menu for ${accountName}`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((current) => !current)}
      >
        {user.photoURL ? (
          <img className="account-avatar-image" src={user.photoURL} alt={accountName} referrerPolicy="no-referrer" />
        ) : (
          <span className="account-avatar-fallback" aria-hidden="true">{initials}</span>
        )}
      </button>

      {isOpen && (
        <div className="account-dropdown" role="menu" aria-label="Account menu">
          <div className="account-dropdown-profile">
            {user.photoURL ? (
              <img className="account-dropdown-avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="account-dropdown-avatar account-dropdown-avatar--fallback" aria-hidden="true">{initials}</span>
            )}
            <div className="account-dropdown-identity">
              <span className="account-dropdown-name">{accountName}</span>
              {user.email && <span className="account-dropdown-email">{user.email}</span>}
            </div>
          </div>
          <button type="button" className="account-menu-item" role="menuitem" disabled>
            <Settings aria-hidden="true" size={16} />
            <span>Settings</span>
          </button>
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
        </div>
      )}
    </div>
  );
}

function getInitials(displayName?: string | null, email?: string | null): string {
  const source = displayName?.trim() || email?.split('@')[0]?.trim() || 'User';
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}
