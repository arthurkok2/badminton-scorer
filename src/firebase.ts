import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyD-Y-VmelbcTKMyTRrXfZ5fJEjVlRoatP4',
  authDomain: 'badminton-scorer-91f7d.web.app',
  projectId: 'badminton-scorer-91f7d',
  storageBucket: 'badminton-scorer-91f7d.firebasestorage.app',
  messagingSenderId: '441715859789',
  appId: '1:441715859789:web:8d5fc38272d044f5971704',
  measurementId: 'G-KDNY0RS6JK',
};

let firestore: Firestore | undefined;
let auth: Auth | undefined;
let emulatorConnected = false;
let authEmulatorConnected = false;

export function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
}

export function getFirebaseDb(): Firestore {
  if (firestore === undefined) {
    firestore = getFirestore(getFirebaseApp());
    connectEmulatorIfConfigured(firestore);
  }

  return firestore;
}

export function getFirebaseAuth(): Auth {
  if (auth === undefined) {
    auth = getAuth(getFirebaseApp());
    connectAuthEmulatorIfConfigured(auth);
  }

  return auth;
}

function connectEmulatorIfConfigured(db: Firestore): void {
  if (emulatorConnected || import.meta.env.VITE_USE_FIRESTORE_EMULATOR !== 'true') {
    return;
  }

  const host = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST ?? 'localhost';
  const rawPort = import.meta.env.VITE_FIRESTORE_EMULATOR_PORT ?? '8080';
  const port = Number(rawPort);

  if (!isValidEmulatorPort(rawPort, port)) {
    throw new Error(`Invalid VITE_FIRESTORE_EMULATOR_PORT: ${rawPort}`);
  }

  connectFirestoreEmulator(db, host, port);
  emulatorConnected = true;
}

function connectAuthEmulatorIfConfigured(authInstance: Auth): void {
  if (authEmulatorConnected || import.meta.env.VITE_USE_FIRESTORE_EMULATOR !== 'true') {
    return;
  }

  connectAuthEmulator(authInstance, 'http://localhost:9099', { disableWarnings: true });
  authEmulatorConnected = true;
}

function isValidEmulatorPort(rawPort: string, port: number): boolean {
  return /^\d+$/.test(rawPort) && Number.isInteger(port) && port >= 1 && port <= 65535;
}
