package com.badminton.scorer.companion

enum class TeamId { teamA, teamB }

enum class MatchMode { singles, doubles }

data class TeamSnapshot(
    val name: String = "",
    val score: Int = 0,
    val players: List<PlayerSnapshot> = emptyList()
)

data class PlayerSnapshot(
    val id: String = "",
    val name: String = ""
)

enum class WatchRemoteCommandType { POINT_TEAM, UNDO, ANNOUNCE }

data class MatchRoomDocument(
    val code: String = "",
    val active: Boolean = false,
    val hostId: String = "",
    val matchMode: MatchMode = MatchMode.doubles,
    val matchState: MatchStateSnapshot? = null,
    val winnerTeamId: TeamId? = null,
    val lastAppliedCommandId: String? = null
)

data class MatchStateSnapshot(
    val teamA: TeamSnapshot? = null,
    val teamB: TeamSnapshot? = null,
    val servingTeamId: TeamId? = null,
    val servingPlayerId: String? = null,
    val receiverPlayerId: String? = null,
    val winnerTeamId: TeamId? = null,
    val matchMode: MatchMode? = null
)

data class RemoteCommand(
    val type: WatchRemoteCommandType,
    val teamId: TeamId? = null,
    val sourceId: String = "wear-os-watch",
    val sourceKind: String = "wear"
)
