import type { ReactNode } from 'react';
import { useAuth } from '../auth';

export function RequiresAuth({ children }: { children: ReactNode }) {
  const { isAnonymous, loading } = useAuth();

  if (loading) return null;

  if (isAnonymous) {
    return <p className="requires-auth-nudge">Sign in to use this feature</p>;
  }

  return <>{children}</>;
}
