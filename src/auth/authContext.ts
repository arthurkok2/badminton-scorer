import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';

export interface AuthState {
  user: User | null;
  loading: boolean;
  isAnonymous: boolean;
  authUnavailable: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  isAnonymous: false,
  authUnavailable: false,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export { AuthContext };
