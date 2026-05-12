import { useAuth } from '../auth';

export function SignInButton() {
  const { user, loading, isAnonymous, authUnavailable, signInWithGoogle, signOut } = useAuth();

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
    <span className="sign-in-user">
      <span>{user.displayName}</span>
      <button type="button" className="sign-out-button" onClick={() => void signOut()}>
        Sign out
      </button>
    </span>
  );
}
