import type { ReactNode } from 'react';
import { useAuth } from '../auth';

export function RequiresAuth({ children }: { children: ReactNode }) {
  const { user, isAnonymous, loading } = useAuth();

  if (loading) return null;

  if (!user || isAnonymous) {
    return <p className="requires-auth-nudge">Sign in to use this feature</p>;
  }

  return <>{children}</>;
}
