package com.badminton.scorer.watch

import android.content.Context
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class WearDataLayerClient(context: Context) {

    private val dataClient: DataClient = Wearable.getDataClient(context)

    fun observeMatchState(): Flow<MatchStatePayload> = callbackFlow {
        val listener = DataClient.OnDataChangedListener { events ->
            for (event in events) {
                if (event.type == com.google.android.gms.wearable.DataEvent.TYPE_CHANGED &&
                    event.dataItem.uri.path == "/match_state"
                ) {
                    val mapItem = DataMapItem.fromDataItem(event.dataItem)
                    val json = mapItem.dataMap.getString("payload") ?: continue
                    val payload = parseMatchStateJson(json) ?: continue
                    trySend(payload)
                }
            }
        }
        dataClient.addListener(listener)
        awaitClose { dataClient.removeListener(listener) }
    }

    fun observeConnectionStatus(): Flow<ConnectionStatusPayload> = callbackFlow {
        val listener = DataClient.OnDataChangedListener { events ->
            for (event in events) {
                if (event.type == com.google.android.gms.wearable.DataEvent.TYPE_CHANGED &&
                    event.dataItem.uri.path == "/connection_status"
                ) {
                    val mapItem = DataMapItem.fromDataItem(event.dataItem)
                    val json = mapItem.dataMap.getString("payload") ?: continue
                    val payload = parseConnectionStatusJson(json) ?: continue
                    trySend(payload)
                }
            }
        }
        dataClient.addListener(listener)
        awaitClose { dataClient.removeListener(listener) }
    }

    suspend fun sendCommand(command: WatchCommand) {
        val json = commandToJson(command)
        val request = PutDataMapRequest.create("/command").apply {
            dataMap.putString("payload", json)
        }
        dataClient.putDataItem(request.asPutDataRequest()).await()
    }

    private fun parseMatchStateJson(json: String): MatchStatePayload? {
        return try {
            val type = extractString(json, "type")
            if (type != "MATCH_STATE") return null
            val matchStart = json.indexOf("\"match\":{")
            if (matchStart == -1) return null
            MatchStatePayload(
                teamAName = extractString(json, "\"name\":\"", offset = matchStart) ?: "",
                teamAScore = extractInt(json, "\"score\":", 0, matchStart),
                teamBName = extractString(json, "\"name\":\"", offset = json.indexOf("teamB", matchStart)) ?: "",
                teamBScore = extractInt(json, "\"score\":", 0, json.indexOf("teamB", matchStart)),
                servingTeamId = extractString(json, "\"servingTeamId\":\"", offset = matchStart),
                servingPlayerId = extractString(json, "\"servingPlayerId\":\"", offset = matchStart),
                winnerTeamId = extractNullableString(json, "\"winnerTeamId\":", matchStart),
                matchMode = extractString(json, "\"matchMode\":\"", offset = matchStart)
            )
        } catch (e: Exception) {
            null
        }
    }

    private fun parseConnectionStatusJson(json: String): ConnectionStatusPayload? {
        return try {
            val type = extractString(json, "type")
            if (type != "CONNECTION_STATUS") return null
            val status = extractString(json, "status")
            val isActive = status == "ACTIVE"
            ConnectionStatusPayload(isActive = isActive)
        } catch (e: Exception) {
            null
        }
    }

    private fun commandToJson(command: WatchCommand): String {
        val sb = StringBuilder()
        sb.append("{\"type\":\"COMMAND\",\"command\":{")
        sb.append("\"commandType\":\"${command.commandType.name}\"")
        if (command.commandType == WatchCommandType.POINT_TEAM && command.teamId != null) {
            sb.append(",\"teamId\":\"${command.teamId.name}\"")
        }
        sb.append("}}")
        return sb.toString()
    }

    private fun extractString(json: String, key: String, offset: Int = 0): String? {
        val fullKey = "\"$key\":\""
        val start = json.indexOf(fullKey, offset)
        if (start == -1) return null
        val valueStart = start + fullKey.length
        val end = json.indexOf('"', valueStart)
        if (end == -1) return null
        return json.substring(valueStart, end)
    }

    private fun extractNullableString(json: String, key: String, offset: Int = 0): String? {
        val fullKey = "\"$key\":"
        val start = json.indexOf(fullKey, offset)
        if (start == -1) return null
        val valueStart = start + fullKey.length
        val remaining = json.substring(valueStart).trimStart()
        return if (remaining.startsWith("null")) null
        else if (remaining.startsWith("\"")) {
            val end = remaining.indexOf('"', 1)
            if (end == -1) null else remaining.substring(1, end)
        } else null
    }

    private fun extractInt(json: String, key: String, default: Int, offset: Int = 0): Int {
        val start = json.indexOf(key, offset)
        if (start == -1) return default
        var valueStart = start + key.length
        val numStr = StringBuilder()
        while (valueStart < json.length && (json[valueStart].isDigit() || json[valueStart] == '-')) {
            numStr.append(json[valueStart])
            valueStart++
        }
        return numStr.toString().toIntOrNull() ?: default
    }

    suspend fun advertiseCapability() {
        val request = PutDataMapRequest.create("/capability").apply {
            dataMap.putBoolean("remote_control", true)
        }
        dataClient.putDataItem(request.asPutDataRequest()).await()
    }
}

// Payload types consumed by the watch ViewModel

enum class WatchCommandType { POINT_TEAM, UNDO, ANNOUNCE }

data class WatchCommand(
    val commandType: WatchCommandType,
    val teamId: TeamId? = null
)

data class MatchStatePayload(
    val teamAName: String = "",
    val teamAScore: Int = 0,
    val teamBName: String = "",
    val teamBScore: Int = 0,
    val servingTeamId: String? = null,
    val servingPlayerId: String? = null,
    val winnerTeamId: String? = null,
    val matchMode: String? = null
)

data class ConnectionStatusPayload(
    val isActive: Boolean
)

// Re-use TeamId from companion types (duplicated for watch module independence)
enum class TeamId { teamA, teamB }
