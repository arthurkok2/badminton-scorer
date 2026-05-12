import { describe, it, expect, vi, beforeEach } from 'vitest';

const firebaseMocks = vi.hoisted(() => ({
  initializeApp: vi.fn(() => ({ name: 'app' })),
  getApps: vi.fn(() => []),
  getFirestore: vi.fn(() => ({ kind: 'firestore' })),
  connectFirestoreEmulator: vi.fn(),
  getAuth: vi.fn(() => ({ kind: 'auth' })),
  connectAuthEmulator: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  initializeApp: firebaseMocks.initializeApp,
  getApps: firebaseMocks.getApps,
}));
vi.mock('firebase/firestore', () => ({
  getFirestore: firebaseMocks.getFirestore,
  connectFirestoreEmulator: firebaseMocks.connectFirestoreEmulator,
}));
vi.mock('firebase/auth', () => ({
  getAuth: firebaseMocks.getAuth,
  connectAuthEmulator: firebaseMocks.connectAuthEmulator,
}));

describe('firebase.ts', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    firebaseMocks.getApps.mockReturnValue([]);
  });

  it('getFirebaseAuth returns an auth instance', async () => {
    const { getFirebaseAuth } = await import('./firebase');
    const auth = getFirebaseAuth();
    expect(auth).toEqual({ kind: 'auth' });
    expect(firebaseMocks.getAuth).toHaveBeenCalledTimes(1);
  });

  it('getFirebaseAuth returns the same instance on repeated calls', async () => {
    const { getFirebaseAuth } = await import('./firebase');
    const a = getFirebaseAuth();
    const b = getFirebaseAuth();
    expect(a).toBe(b);
    expect(firebaseMocks.getAuth).toHaveBeenCalledTimes(1);
  });

  it('connects auth emulator when VITE_USE_FIRESTORE_EMULATOR is true', async () => {
    import.meta.env.VITE_USE_FIRESTORE_EMULATOR = 'true';
    const { getFirebaseAuth } = await import('./firebase');
    getFirebaseAuth();
    expect(firebaseMocks.connectAuthEmulator).toHaveBeenCalledWith(
      { kind: 'auth' },
      'http://localhost:9099',
      { disableWarnings: true },
    );
    import.meta.env.VITE_USE_FIRESTORE_EMULATOR = undefined;
  });
});
