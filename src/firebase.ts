import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyD-Y-VmelbcTKMyTRrXfZ5fJEjVlRoatP4',
  authDomain: 'badminton-scorer-91f7d.firebaseapp.com',
  projectId: 'badminton-scorer-91f7d',
  storageBucket: 'badminton-scorer-91f7d.firebasestorage.app',
  messagingSenderId: '441715859789',
  appId: '1:441715859789:web:8d5fc38272d044f5971704',
  measurementId: 'G-KDNY0RS6JK',
};

let firestore: Firestore | undefined;
let emulatorConnected = false;

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

function isValidEmulatorPort(rawPort: string, port: number): boolean {
  return /^\d+$/.test(rawPort) && Number.isInteger(port) && port >= 1 && port <= 65535;
}
