package com.badminton.scorer.companion

object DataLayerProtocol {
    const val PATH_MATCH_STATE = "/match_state"
    const val PATH_CONNECTION_STATUS = "/connection_status"
    const val PATH_COMMAND = "/command"

    enum class ConnectionStatus { ACTIVE, INACTIVE }

    fun matchStateToJson(matchRoom: MatchRoomDocument): String {
        val state = matchRoom.matchState ?: return "{}"
        val sb = StringBuilder()
        sb.append("{")
        sb.append("\"type\":\"MATCH_STATE\",")
        sb.append("\"match\":{")
        sb.append("\"teamA\":${teamToJson(state.teamA)},")
        sb.append("\"teamB\":${teamToJson(state.teamB)},")
        sb.append("\"servingTeamId\":\"${state.servingTeamId?.name ?: ""}\",")
        sb.append("\"servingPlayerId\":\"${state.servingPlayerId ?: ""}\",")
        sb.append("\"receiverPlayerId\":\"${state.receiverPlayerId ?: ""}\",")
        sb.append("\"winnerTeamId\":${state.winnerTeamId?.name?.let { "\"$it\"" } ?: "null"},")
        sb.append("\"matchMode\":\"${matchRoom.matchMode.name}\"")
        sb.append("}}")
        return sb.toString()
    }

    fun connectionStatusToJson(status: ConnectionStatus): String {
        return """{"type":"CONNECTION_STATUS","status":"${status.name}"}"""
    }

    fun commandFromJson(json: String): RemoteCommand? {
        return try {
            val commandTypeStr = extractJsonString(json, "commandType") ?: return null
            val commandType = when (commandTypeStr) {
                "POINT_TEAM" -> WatchRemoteCommandType.POINT_TEAM
                "UNDO" -> WatchRemoteCommandType.UNDO
                "ANNOUNCE" -> WatchRemoteCommandType.ANNOUNCE
                else -> return null
            }
            val teamIdStr = extractJsonString(json, "teamId")
            val teamId = when (teamIdStr) {
                "teamA" -> TeamId.teamA
                "teamB" -> TeamId.teamB
                else -> null
            }
            RemoteCommand(type = commandType, teamId = teamId)
        } catch (e: Exception) {
            null
        }
    }

    private fun teamToJson(team: TeamSnapshot?): String {
        if (team == null) return "null"
        val sb = StringBuilder()
        sb.append("{")
        sb.append("\"name\":\"${escapeJson(team.name)}\",")
        sb.append("\"score\":${team.score}")
        sb.append("}")
        return sb.toString()
    }

    private fun escapeJson(s: String): String {
        return s.replace("\\", "\\\\").replace("\"", "\\\"")
    }

    private fun extractJsonString(json: String, key: String): String? {
        val regex = Regex("\"$key\"\\s*:\\s*\"([^\"]*)\"")
        return regex.find(json)?.groupValues?.get(1)
    }
}
