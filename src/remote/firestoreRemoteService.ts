import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { getFirebaseDb } from '../firebase';
import type { MatchState, TeamId } from '../domain/matchTypes';
import type { PendingWatchRemoteCommand, WatchRemoteCommandDocument } from './firestoreRemoteTypes';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 4;
const ROOM_COLLECTION = 'matches';
const COMMAND_COLLECTION = 'commands';

export function createRoomCode(): string {
  const randomValues = new Uint32Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues, (v) => ROOM_CODE_ALPHABET[v % ROOM_CODE_ALPHABET.length]).join('');
}

export async function createWatchRemoteRoom(options: {
  match: MatchState;
  hostId: string;
  db?: Firestore;
}): Promise<string> {
  const code = createRoomCode();
  const timestamp = serverTimestamp();

  await setDoc(roomDoc(resolveDb(options.db), code), {
    active: true,
    code,
    createdAt: timestamp,
    hostHeartbeatAt: timestamp,
    hostId: options.hostId,
    updatedAt: timestamp,
    ...matchPayload(options.match),
  });

  return code;
}

export async function publishWatchRemoteState(options: {
  code: string;
  match: MatchState;
  hostId: string;
  db?: Firestore;
}): Promise<void> {
  const timestamp = serverTimestamp();

  await updateDoc(roomDoc(resolveDb(options.db), options.code), {
    active: true,
    hostHeartbeatAt: timestamp,
    hostId: options.hostId,
    updatedAt: timestamp,
    ...matchPayload(options.match),
  });
}

export function subscribeToPendingCommands(options: {
  code: string;
  onCommands: (commands: PendingWatchRemoteCommand[]) => void;
  onError: (error: Error) => void;
  db?: Firestore;
}): () => void {
  const commandsQuery = query(
    collection(roomDoc(resolveDb(options.db), options.code), COMMAND_COLLECTION),
    where('createdAt', '!=', null),
    orderBy('createdAt', 'asc'),
  );

  return onSnapshot(
    commandsQuery,
    (snapshot) => {
      const commands = snapshot.docs
        .map((document) => toPendingCommand(document.id, document.data()))
        .filter((command): command is PendingWatchRemoteCommand => command !== undefined);

      options.onCommands(commands);
    },
    (error) => {
      options.onError(error instanceof Error ? error : new Error(String(error)));
    },
  );
}

export async function markCommandApplied(options: {
  code: string;
  commandId: string;
  match: MatchState;
  db?: Firestore;
}): Promise<void> {
  const db = resolveDb(options.db);
  const timestamp = serverTimestamp();
  const batch = writeBatch(db);

  batch.update(commandDoc(db, options.code, options.commandId), {
    appliedAt: timestamp,
  });

  batch.update(roomDoc(db, options.code), {
    hostHeartbeatAt: timestamp,
    lastAppliedCommandId: options.commandId,
    updatedAt: timestamp,
    ...matchPayload(options.match),
  });

  await batch.commit();
}

export async function markCommandRejected(options: {
  code: string;
  commandId: string;
  reason: string;
  db?: Firestore;
}): Promise<void> {
  await updateDoc(commandDoc(resolveDb(options.db), options.code, options.commandId), {
    rejectedAt: serverTimestamp(),
    rejectionReason: options.reason,
  });
}

export async function updateHostHeartbeat(options: { code: string; db?: Firestore }): Promise<void> {
  const timestamp = serverTimestamp();

  await updateDoc(roomDoc(resolveDb(options.db), options.code), {
    hostHeartbeatAt: timestamp,
    updatedAt: timestamp,
  });
}

export async function endWatchRemoteRoom(options: { code: string; db?: Firestore }): Promise<void> {
  const timestamp = serverTimestamp();

  await updateDoc(roomDoc(resolveDb(options.db), options.code), {
    active: false,
    hostHeartbeatAt: timestamp,
    updatedAt: timestamp,
  });
}

function resolveDb(db?: Firestore): Firestore {
  return db ?? getFirebaseDb();
}

function roomDoc(db: Firestore, code: string) {
  return doc(collection(db, ROOM_COLLECTION), code);
}

function commandDoc(db: Firestore, code: string, commandId: string) {
  return doc(collection(roomDoc(db, code), COMMAND_COLLECTION), commandId);
}

function matchPayload(match: MatchState) {
  return {
    matchMode: match.mode,
    matchState: serializeMatchState(match),
    ...(match.winnerTeamId === undefined ? {} : { winnerTeamId: match.winnerTeamId }),
  };
}

function serializeMatchState(match: MatchState): MatchState {
  return JSON.parse(JSON.stringify(match)) as MatchState;
}

function toPendingCommand(id: string, data: unknown): PendingWatchRemoteCommand | undefined {
  if (!isWatchRemoteCommand(data) || data.appliedAt !== undefined || data.rejectedAt !== undefined) {
    return undefined;
  }

  return { id, command: data };
}

function isWatchRemoteCommand(data: unknown): data is WatchRemoteCommandDocument {
  if (
    !isRecord(data) ||
    typeof data.type !== 'string' ||
    data.createdAt === undefined ||
    data.createdAt === null ||
    typeof data.sourceId !== 'string' ||
    (data.sourceKind !== 'wear' && data.sourceKind !== 'web' && data.sourceKind !== 'garmin')
  ) {
    return false;
  }

  if (data.type === 'UNDO' || data.type === 'ANNOUNCE') {
    return true;
  }

  return data.type === 'POINT_TEAM' && isTeamId(data.teamId);
}

function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null;
}

function isTeamId(value: unknown): value is TeamId {
  return value === 'teamA' || value === 'teamB';
}
