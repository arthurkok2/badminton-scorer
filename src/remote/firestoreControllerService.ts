import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import { getFirebaseDb } from '../firebase';
import type { TeamId } from '../domain/matchTypes';
import type { WatchRemoteCommandType, WatchRemoteMatchDocument } from './firestoreRemoteTypes';

const ROOM_COLLECTION = 'matches';
const COMMAND_COLLECTION = 'commands';

export function subscribeToRoomState(options: {
  code: string;
  onState: (roomDoc: WatchRemoteMatchDocument) => void;
  onError: (error: Error) => void;
  db?: Firestore;
}): () => void {
  const db = options.db ?? getFirebaseDb();
  const roomRef = doc(collection(db, ROOM_COLLECTION), options.code);

  return onSnapshot(
    roomRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        options.onError(new Error('Room not found'));
        return;
      }
      const data = snapshot.data() as WatchRemoteMatchDocument;
      if (!data.active) {
        options.onError(new Error('Room is no longer active'));
        return;
      }
      options.onState(data);
    },
    (error) => {
      options.onError(error instanceof Error ? error : new Error(String(error)));
    },
  );
}

export async function sendControllerCommand(options: {
  code: string;
  type: WatchRemoteCommandType;
  teamId?: TeamId;
  sourceId: string;
  db?: Firestore;
}): Promise<void> {
  const db = options.db ?? getFirebaseDb();
  const roomRef = doc(collection(db, ROOM_COLLECTION), options.code);
  const commandRef = doc(collection(roomRef, COMMAND_COLLECTION), crypto.randomUUID());

  await setDoc(commandRef, {
    type: options.type,
    ...(options.type === 'POINT_TEAM' && options.teamId !== undefined
      ? { teamId: options.teamId }
      : {}),
    sourceId: options.sourceId,
    sourceKind: 'web',
    createdAt: serverTimestamp(),
  });
}
