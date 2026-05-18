import {
  collection,
  doc,
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
import { buildStatsSummary } from './stats';
import type {
  ActiveSession,
  ArchivedSession,
  GlobalPlayer,
  LegacyMatchRecord,
  MatchRecord,
} from './sessionTypes';

export interface CloudSessionSummary {
  readonly id: string;
  readonly startedAt?: string;
  readonly matchCount: number;
}

export interface CloudPlayerLeaderboardEntry {
  readonly id: string;
  readonly displayName: string;
  readonly elo: number;
  readonly matchesPlayed: number;
  readonly winRate: number;
  readonly recentForm: readonly ('W' | 'L')[];
}

export interface CloudPairLeaderboardEntry {
  readonly id: string;
  readonly displayNames: readonly [string, string];
  readonly elo: number;
  readonly matchesPlayed: number;
  readonly winRate: number;
}

export interface CloudMatchupEntry {
  readonly id: string;
  readonly players: readonly [string, string];
  readonly matchesPlayed: number;
  readonly wins: number;
  readonly losses: number;
}

export interface CloudHistoryStats {
  readonly sessions: readonly CloudSessionSummary[];
  readonly players: readonly CloudPlayerLeaderboardEntry[];
  readonly pairs: readonly CloudPairLeaderboardEntry[];
  readonly matchups: readonly CloudMatchupEntry[];
}

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

export async function saveCloudSession(options: {
  readonly uid: string;
  readonly session: ActiveSession | ArchivedSession;
  readonly status: 'active' | 'completed';
  readonly source?: 'cloud' | 'local-import' | 'local-active-import';
  readonly db?: Firestore;
}): Promise<void> {
  const db = resolveDb(options.db);
  const timestamp = serverTimestamp();
  const sessionRef = doc(collection(db, `users/${options.uid}/sessions`), options.session.id);
  const shouldWriteCreatedAt = options.status === 'active' || options.source?.includes('import');
  const players = options.session.players.map(toSessionPlayerSummary);

  await setDoc(sessionRef, {
    id: options.session.id,
    status: options.status,
    startedAt: options.session.startedAt,
    ...('endedAt' in options.session ? { endedAt: options.session.endedAt } : {}),
    players,
    matchCount: options.session.matches.length,
    source: options.source ?? 'cloud',
    ...(options.source?.includes('import') ? { importedAt: timestamp } : {}),
    ...(shouldWriteCreatedAt ? { createdAt: timestamp } : {}),
    updatedAt: timestamp,
  }, { merge: true });
}

export async function importMappedLegacySessions(options: {
  readonly uid: string;
  readonly sessions: readonly (ActiveSession | ArchivedSession)[];
  readonly mapping: ReadonlyMap<string, GlobalPlayer>;
  readonly db?: Firestore;
}): Promise<void> {
  const db = resolveDb(options.db);

  for (const session of options.sessions) {
    const isCompleted = 'endedAt' in session;
    await saveCloudSession({
      uid: options.uid,
      session,
      status: isCompleted ? 'completed' : 'active',
      source: isCompleted ? 'local-import' : 'local-active-import',
      db,
    });

    for (const [index, match] of session.matches.entries()) {
      const matchRecord = toMappedMatchRecord(session.id, index + 1, match, options.mapping);
      await completeCloudSessionMatch({ uid: options.uid, matchRecord, db });
    }
  }
}

export async function loadCloudHistoryStats(options: {
  readonly uid: string;
  readonly db?: Firestore;
}): Promise<CloudHistoryStats> {
  const db = resolveDb(options.db);
  const [sessionSnapshot, playerSnapshot, pairSnapshot, globalMatchSnapshot] = await Promise.all([
    getDocs(query(collection(db, `users/${options.uid}/sessions`), orderBy('startedAt', 'desc'), limit(50))),
    getDocs(query(collection(db, 'players'), orderBy('globalIndividualElo', 'desc'), limit(50))),
    getDocs(query(collection(db, 'pairs'), orderBy('globalPairElo', 'desc'), limit(50))),
    getDocs(query(collection(db, 'globalMatches'), orderBy('createdAt', 'desc'), limit(200))),
  ]);

  const globalMatches = globalMatchSnapshot.docs.map((document) => document.data() as MatchRecord);
  const playerOutcomeStats = buildPlayerOutcomeStats(globalMatches);
  const pairOutcomeStats = buildPairOutcomeStats(globalMatches);
  const playerNames = new Map<string, string>();
  const players = playerSnapshot.docs.map((document) => {
    const data = document.data() as GlobalPlayer;
    const outcomes = playerOutcomeStats[data.id];
    playerNames.set(data.id, data.displayName);
    return {
      id: data.id,
      displayName: data.displayName,
      elo: data.globalIndividualElo,
      matchesPlayed: data.globalMatchCount,
      winRate: outcomes && outcomes.matchesPlayed > 0 ? outcomes.wins / outcomes.matchesPlayed : 0,
      recentForm: outcomes?.recentForm ?? [],
    };
  });

  const pairs = pairSnapshot.docs.map((document) => {
    const data = document.data() as { id: string; displayNames: readonly [string, string]; globalPairElo: number; globalMatchCount: number };
    const outcomes = pairOutcomeStats[data.id];
    return {
      id: data.id,
      displayNames: data.displayNames,
      elo: data.globalPairElo,
      matchesPlayed: data.globalMatchCount,
      winRate: outcomes && outcomes.matchesPlayed > 0 ? outcomes.wins / outcomes.matchesPlayed : 0,
    };
  });

  return {
    sessions: sessionSnapshot.docs.map((document) => {
      const data = document.data() as { id?: string; startedAt?: string; matchCount?: number };
      return {
        id: data.id ?? document.id,
        startedAt: data.startedAt,
        matchCount: data.matchCount ?? 0,
      };
    }),
    players,
    pairs,
    matchups: buildMatchupEntries(globalMatches, playerNames),
  };
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
    const sessionRef = doc(collection(db, `users/${uid}/sessions`), matchRecord.sessionId);
    const statsRef = doc(collection(db, `users/${uid}/stats`), 'summary');

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

    transaction.set(sessionRef, {
      id: matchRecord.sessionId,
      matchCount: matchRecord.matchNumber,
      updatedAt: timestamp,
    }, { merge: true });

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

    const summary = buildStatsSummary([matchRecord]);
    transaction.set(statsRef, {
      players: summary.players,
      pairs: summary.pairs,
      matchups: summary.matchups,
      ratedMatchCount: matchRecord.matchNumber,
      statsVersion: 1,
      updatedAt: timestamp,
    }, { merge: true });
  });
}

function resolveDb(db?: Firestore): Firestore {
  return db ?? getFirebaseDb();
}

function toMappedMatchRecord(
  sessionId: string,
  matchNumber: number,
  match: MatchRecord | LegacyMatchRecord,
  mapping: ReadonlyMap<string, GlobalPlayer>,
): MatchRecord {
  if ('id' in match) {
    return remapCurrentMatchRecord(match, mapping);
  }

  const teamA = mapTeam(match.teamA, mapping);
  const teamB = mapTeam(match.teamB, mapping);
  return {
    id: `${sessionId}-match-${matchNumber}`,
    sessionId,
    matchNumber,
    teamAPlayerIds: [teamA[0].id, teamA[1].id],
    teamBPlayerIds: [teamB[0].id, teamB[1].id],
    teamADisplayNames: [teamA[0].displayName, teamA[1].displayName],
    teamBDisplayNames: [teamB[0].displayName, teamB[1].displayName],
    teamAPairId: createPairId(teamA[0].id, teamA[1].id),
    teamBPairId: createPairId(teamB[0].id, teamB[1].id),
    winnerTeam: match.winnerTeam,
    ...(match.finalScore !== undefined ? { finalScore: match.finalScore } : {}),
    ...(match.startedAt !== undefined ? { startedAt: match.startedAt } : {}),
    ...(match.endedAt !== undefined ? { endedAt: match.endedAt } : {}),
  };
}

function remapCurrentMatchRecord(
  match: MatchRecord,
  mapping: ReadonlyMap<string, GlobalPlayer>,
): MatchRecord {
  const teamA = mapTeam(match.teamADisplayNames, mapping);
  const teamB = mapTeam(match.teamBDisplayNames, mapping);
  return {
    ...match,
    teamAPlayerIds: [teamA[0].id, teamA[1].id],
    teamBPlayerIds: [teamB[0].id, teamB[1].id],
    teamADisplayNames: [teamA[0].displayName, teamA[1].displayName],
    teamBDisplayNames: [teamB[0].displayName, teamB[1].displayName],
    teamAPairId: createPairId(teamA[0].id, teamA[1].id),
    teamBPairId: createPairId(teamB[0].id, teamB[1].id),
  };
}

function mapTeam(
  names: readonly [string, string],
  mapping: ReadonlyMap<string, GlobalPlayer>,
): readonly [GlobalPlayer, GlobalPlayer] {
  const first = mapping.get(names[0]);
  const second = mapping.get(names[1]);
  if (!first || !second) {
    throw new Error('Every legacy player must be mapped before import.');
  }
  return [first, second];
}

function toSessionPlayerSummary(player: unknown): {
  readonly id: string;
  readonly displayName: string;
  readonly gamesPlayed: number;
  readonly breaksTaken?: number;
} {
  if (!player || typeof player !== 'object') {
    throw new Error('Session player must be an object.');
  }
  const id = 'id' in player && typeof player.id === 'string' ? player.id : undefined;
  const displayName =
    'displayName' in player && typeof player.displayName === 'string'
      ? player.displayName
      : 'name' in player && typeof player.name === 'string'
        ? player.name
        : undefined;
  const gamesPlayed = 'gamesPlayed' in player && typeof player.gamesPlayed === 'number' ? player.gamesPlayed : 0;
  const breaksTaken = 'breaksTaken' in player && typeof player.breaksTaken === 'number' ? player.breaksTaken : undefined;

  if (!displayName) {
    throw new Error('Session player must have a display name.');
  }

  return {
    id: id ?? `legacy-local-player-${normalizePlayerSearchName(displayName)}`,
    displayName,
    gamesPlayed,
    ...(breaksTaken !== undefined ? { breaksTaken } : {}),
  };
}

function buildMatchupEntries(
  matches: readonly MatchRecord[],
  playerNames: ReadonlyMap<string, string>,
): CloudMatchupEntry[] {
  const matchups: Record<string, { matchesPlayed: number; wins: number; losses: number }> = {};
  for (const match of matches) {
    const teamAWon = match.winnerTeam === 'teamA';
    for (const playerA of match.teamAPlayerIds) {
      for (const playerB of match.teamBPlayerIds) {
        incrementMatchup(matchups, `${playerA}__vs__${playerB}`, teamAWon);
        incrementMatchup(matchups, `${playerB}__vs__${playerA}`, !teamAWon);
      }
    }
  }

  return Object.entries(matchups).map(([id, matchup]) => {
    const [first = '', second = ''] = id.split('__vs__');
    return {
      id,
      players: [playerNames.get(first) ?? first, playerNames.get(second) ?? second],
      matchesPlayed: matchup.matchesPlayed,
      wins: matchup.wins,
      losses: matchup.losses,
    };
  });
}

function buildPlayerOutcomeStats(
  matches: readonly MatchRecord[],
): Record<string, { matchesPlayed: number; wins: number; recentForm: ('W' | 'L')[] }> {
  const stats: Record<string, { matchesPlayed: number; wins: number; recentForm: ('W' | 'L')[] }> = {};
  for (const match of matches) {
    const teamAWon = match.winnerTeam === 'teamA';
    for (const playerId of match.teamAPlayerIds) {
      incrementOutcome(stats, playerId, teamAWon);
    }
    for (const playerId of match.teamBPlayerIds) {
      incrementOutcome(stats, playerId, !teamAWon);
    }
  }
  return stats;
}

function buildPairOutcomeStats(
  matches: readonly MatchRecord[],
): Record<string, { matchesPlayed: number; wins: number }> {
  const stats: Record<string, { matchesPlayed: number; wins: number }> = {};
  for (const match of matches) {
    const teamAWon = match.winnerTeam === 'teamA';
    incrementPairOutcome(stats, match.teamAPairId, teamAWon);
    incrementPairOutcome(stats, match.teamBPairId, !teamAWon);
  }
  return stats;
}

function incrementOutcome(
  stats: Record<string, { matchesPlayed: number; wins: number; recentForm: ('W' | 'L')[] }>,
  id: string,
  won: boolean,
): void {
  stats[id] ??= { matchesPlayed: 0, wins: 0, recentForm: [] };
  stats[id].matchesPlayed += 1;
  if (won) {
    stats[id].wins += 1;
  }
  if (stats[id].recentForm.length < 5) {
    stats[id].recentForm.push(won ? 'W' : 'L');
  }
}

function incrementPairOutcome(
  stats: Record<string, { matchesPlayed: number; wins: number }>,
  id: string,
  won: boolean,
): void {
  stats[id] ??= { matchesPlayed: 0, wins: 0 };
  stats[id].matchesPlayed += 1;
  if (won) {
    stats[id].wins += 1;
  }
}

function incrementMatchup(
  matchups: Record<string, { matchesPlayed: number; wins: number; losses: number }>,
  id: string,
  won: boolean,
): void {
  matchups[id] ??= { matchesPlayed: 0, wins: 0, losses: 0 };
  matchups[id].matchesPlayed += 1;
  if (won) {
    matchups[id].wins += 1;
  } else {
    matchups[id].losses += 1;
  }
}
