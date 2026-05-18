import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { getFirebaseDb } from '../firebase';
import { createGlobalPlayer, createPairId, normalizePlayerSearchName } from './playerIdentity';
import { calculateIndividualEloUpdate, calculatePairEloUpdate, INITIAL_ELO, type EloSubject } from './elo';
import type { GlobalPlayer, MatchRecord } from './sessionTypes';

export async function createGlobalPlayerDocument(options: {
  readonly displayName: string;
  readonly uid: string;
  readonly db?: Firestore;
}): Promise<GlobalPlayer> {
  const db = resolveDb(options.db);
  const playerRef = doc(collection(db, 'players'));
  const player = createGlobalPlayer({ id: playerRef.id, displayName: options.displayName, createdBy: options.uid });
  const timestamp = serverTimestamp();

  await setDoc(playerRef, {
    ...player,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return player;
}

export async function searchGlobalPlayers(options: {
  readonly searchText: string;
  readonly db?: Firestore;
}): Promise<GlobalPlayer[]> {
  const searchName = normalizePlayerSearchName(options.searchText);
  if (!searchName) return [];

  const snapshot = await getDocs(query(
    collection(resolveDb(options.db), 'players'),
    where('searchName', '>=', searchName),
    where('searchName', '<=', `${searchName}`),
    orderBy('searchName', 'asc'),
    limit(10),
  ));

  return snapshot.docs.map((document) => document.data() as GlobalPlayer);
}

export async function completeCloudSessionMatch(options: {
  readonly uid: string;
  readonly matchRecord: MatchRecord;
  readonly db?: Firestore;
}): Promise<void> {
  const db = resolveDb(options.db);
  const { uid, matchRecord } = options;

  await runTransaction(db, async (transaction) => {
    // Read all four player documents
    const [aRef, bRef, cRef, dRef] = [
      matchRecord.teamAPlayerIds[0],
      matchRecord.teamAPlayerIds[1],
      matchRecord.teamBPlayerIds[0],
      matchRecord.teamBPlayerIds[1],
    ].map((playerId) => doc(collection(db, 'players'), playerId));

    const [aSnap, bSnap, cSnap, dSnap] = await Promise.all([
      transaction.get(aRef),
      transaction.get(bRef),
      transaction.get(cRef),
      transaction.get(dRef),
    ]);

    const getPlayerData = (snap: { exists: () => boolean; data: () => unknown }, id: string): GlobalPlayer => {
      if (!snap.exists()) throw new Error(`Player document not found: ${id}`);
      return snap.data() as GlobalPlayer;
    };

    const playerA = getPlayerData(aSnap, matchRecord.teamAPlayerIds[0]);
    const playerB = getPlayerData(bSnap, matchRecord.teamAPlayerIds[1]);
    const playerC = getPlayerData(cSnap, matchRecord.teamBPlayerIds[0]);
    const playerD = getPlayerData(dSnap, matchRecord.teamBPlayerIds[1]);

    const toEloSubject = (player: GlobalPlayer): EloSubject => ({
      id: player.id,
      rating: player.globalIndividualElo,
      matchCount: player.globalMatchCount,
    });

    const individualEloUpdate = calculateIndividualEloUpdate({
      teamA: [toEloSubject(playerA), toEloSubject(playerB)],
      teamB: [toEloSubject(playerC), toEloSubject(playerD)],
      winnerTeam: matchRecord.winnerTeam,
    });

    // Read pair documents
    const teamAPairRef = doc(collection(db, 'pairs'), matchRecord.teamAPairId);
    const teamBPairRef = doc(collection(db, 'pairs'), matchRecord.teamBPairId);

    const [teamAPairSnap, teamBPairSnap] = await Promise.all([
      transaction.get(teamAPairRef),
      transaction.get(teamBPairRef),
    ]);

    const teamAPairData = teamAPairSnap.exists()
      ? (teamAPairSnap.data() as { globalPairElo: number; globalMatchCount: number })
      : { globalPairElo: INITIAL_ELO, globalMatchCount: 0 };

    const teamBPairData = teamBPairSnap.exists()
      ? (teamBPairSnap.data() as { globalPairElo: number; globalMatchCount: number })
      : { globalPairElo: INITIAL_ELO, globalMatchCount: 0 };

    const pairEloUpdate = calculatePairEloUpdate({
      teamAPair: { id: matchRecord.teamAPairId, rating: teamAPairData.globalPairElo, matchCount: teamAPairData.globalMatchCount },
      teamBPair: { id: matchRecord.teamBPairId, rating: teamBPairData.globalPairElo, matchCount: teamBPairData.globalMatchCount },
      winnerTeam: matchRecord.winnerTeam,
    });

    const timestamp = serverTimestamp();
    const sourcePath = `users/${uid}/sessions/${matchRecord.sessionId}/matches/${matchRecord.id}`;

    // Write local session match document
    const sessionMatchRef = doc(
      collection(db, `users/${uid}/sessions/${matchRecord.sessionId}/matches`),
      matchRecord.id,
    );
    transaction.set(sessionMatchRef, {
      ...matchRecord,
      submittedBy: uid,
      createdAt: timestamp,
    });

    // Write global match document
    const globalMatchRef = doc(collection(db, 'globalMatches'), matchRecord.id);
    transaction.set(globalMatchRef, {
      id: matchRecord.id,
      submittedBy: uid,
      sessionId: matchRecord.sessionId,
      sourcePath,
      matchNumber: matchRecord.matchNumber,
      teamAPlayerIds: matchRecord.teamAPlayerIds,
      teamBPlayerIds: matchRecord.teamBPlayerIds,
      teamAPairId: matchRecord.teamAPairId,
      teamBPairId: matchRecord.teamBPairId,
      winnerTeam: matchRecord.winnerTeam,
      ...(matchRecord.finalScore !== undefined && { finalScore: matchRecord.finalScore }),
      ...(matchRecord.startedAt !== undefined && { startedAt: matchRecord.startedAt }),
      ...(matchRecord.endedAt !== undefined && { endedAt: matchRecord.endedAt }),
      globalIndividualElo: individualEloUpdate,
      globalPairElo: pairEloUpdate,
      status: 'submitted' as const,
      createdAt: timestamp,
    });

    // Update player Elo ratings
    for (const playerRef of [aRef, bRef, cRef, dRef]) {
      const snap = [aSnap, bSnap, cSnap, dSnap][[aRef, bRef, cRef, dRef].indexOf(playerRef)];
      const player = snap.data() as GlobalPlayer;
      const eloSnap = individualEloUpdate[player.id];
      if (eloSnap) {
        transaction.update(playerRef, {
          globalIndividualElo: eloSnap.after,
          globalMatchCount: player.globalMatchCount + 1,
          updatedAt: timestamp,
        });
      }
    }

    // Upsert pair documents
    const pairTimestamp = timestamp;
    const teamAPairEloSnap = pairEloUpdate[matchRecord.teamAPairId];
    const teamBPairEloSnap = pairEloUpdate[matchRecord.teamBPairId];

    if (!teamAPairSnap.exists()) {
      transaction.set(teamAPairRef, {
        id: matchRecord.teamAPairId,
        playerIds: matchRecord.teamAPlayerIds,
        displayNames: matchRecord.teamADisplayNames,
        createdAt: pairTimestamp,
        updatedAt: pairTimestamp,
        globalPairElo: teamAPairEloSnap ? teamAPairEloSnap.after : INITIAL_ELO,
        globalMatchCount: 1,
        statsVersion: 1,
      });
    } else {
      transaction.update(teamAPairRef, {
        globalPairElo: teamAPairEloSnap ? teamAPairEloSnap.after : teamAPairData.globalPairElo,
        globalMatchCount: teamAPairData.globalMatchCount + 1,
        updatedAt: pairTimestamp,
      });
    }

    if (!teamBPairSnap.exists()) {
      transaction.set(teamBPairRef, {
        id: matchRecord.teamBPairId,
        playerIds: matchRecord.teamBPlayerIds,
        displayNames: matchRecord.teamBDisplayNames,
        createdAt: pairTimestamp,
        updatedAt: pairTimestamp,
        globalPairElo: teamBPairEloSnap ? teamBPairEloSnap.after : INITIAL_ELO,
        globalMatchCount: 1,
        statsVersion: 1,
      });
    } else {
      transaction.update(teamBPairRef, {
        globalPairElo: teamBPairEloSnap ? teamBPairEloSnap.after : teamBPairData.globalPairElo,
        globalMatchCount: teamBPairData.globalMatchCount + 1,
        updatedAt: pairTimestamp,
      });
    }
  });
}

function resolveDb(db?: Firestore): Firestore {
  return db ?? getFirebaseDb();
}
