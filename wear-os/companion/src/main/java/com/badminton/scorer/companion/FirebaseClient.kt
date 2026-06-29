package com.badminton.scorer.companion

import com.google.firebase.Timestamp
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.util.UUID

class FirebaseClient(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    companion object {
        private const val ROOM_COLLECTION = "matches"
        private const val COMMAND_COLLECTION = "commands"
    }

    fun observeRoom(code: String): Flow<Result<MatchRoomDocument>> = callbackFlow {
        val docRef = firestore.collection(ROOM_COLLECTION).document(code)
        val listener = docRef.addSnapshotListener { snapshot, error ->
            if (error != null) {
                trySend(Result.failure(error))
                return@addSnapshotListener
            }
            if (snapshot == null || !snapshot.exists()) {
                trySend(Result.failure(Exception("Room not found")))
                return@addSnapshotListener
            }

            val data = snapshot.data ?: emptyMap()
            val active = data["active"] as? Boolean ?: false
            if (!active) {
                trySend(Result.failure(Exception("Room is no longer active")))
                return@addSnapshotListener
            }

            trySend(Result.success(parseRoomDocument(snapshot.id, data)))
        }
        awaitClose { listener.remove() }
    }

    suspend fun sendCommand(code: String, command: RemoteCommand): Result<Unit> {
        return try {
            val roomRef = firestore.collection(ROOM_COLLECTION).document(code)
            val commandRef = roomRef.collection(COMMAND_COLLECTION).document(UUID.randomUUID().toString())

            val data = mutableMapOf<String, Any>(
                "type" to command.type.name,
                "sourceId" to command.sourceId,
                "sourceKind" to command.sourceKind,
                "createdAt" to FieldValue.serverTimestamp()
            )
            if (command.type == WatchRemoteCommandType.POINT_TEAM && command.teamId != null) {
                data["teamId"] = command.teamId.name
            }

            commandRef.set(data).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun parseRoomDocument(code: String, data: Map<String, Any>): MatchRoomDocument {
        return MatchRoomDocument(
            code = code,
            active = data["active"] as? Boolean ?: false,
            hostId = data["hostId"] as? String ?: "",
            matchMode = parseMatchMode(data["matchMode"] as? String),
            matchState = parseMatchState(data["matchState"] as? Map<String, Any>),
            winnerTeamId = parseTeamId(data["winnerTeamId"] as? String),
            lastAppliedCommandId = data["lastAppliedCommandId"] as? String
        )
    }

    private fun parseMatchState(data: Map<String, Any>?): MatchStateSnapshot? {
        if (data == null) return null
        return MatchStateSnapshot(
            teamA = parseTeam(data["teamA"] as? Map<String, Any>),
            teamB = parseTeam(data["teamB"] as? Map<String, Any>),
            servingTeamId = parseTeamId(data["servingTeamId"] as? String),
            servingPlayerId = data["servingPlayerId"] as? String,
            receiverPlayerId = data["receiverPlayerId"] as? String,
            winnerTeamId = parseTeamId(data["winnerTeamId"] as? String),
            matchMode = parseMatchMode(data["matchMode"] as? String)
        )
    }

    private fun parseTeam(data: Map<String, Any>?): TeamSnapshot? {
        if (data == null) return null
        val score = (data["score"] as? Long)?.toInt() ?: 0
        val players = parsePlayers(data["players"] as? List<Map<String, Any>>)
        return TeamSnapshot(
            name = data["name"] as? String ?: "",
            score = score,
            players = players
        )
    }

    @Suppress("UNCHECKED_CAST")
    private fun parsePlayers(list: List<Map<String, Any>>?): List<PlayerSnapshot> {
        if (list == null) return emptyList()
        return list.map { player ->
            PlayerSnapshot(
                id = player["id"] as? String ?: "",
                name = player["name"] as? String ?: ""
            )
        }
    }

    private fun parseMatchMode(value: String?): MatchMode {
        return when (value) {
            "singles" -> MatchMode.singles
            else -> MatchMode.doubles
        }
    }

    private fun parseTeamId(value: String?): TeamId? {
        return when (value) {
            "teamA" -> TeamId.teamA
            "teamB" -> TeamId.teamB
            else -> null
        }
    }
}
