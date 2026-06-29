package com.badminton.scorer.companion

import org.junit.Assert.*
import org.junit.Test

class DataLayerProtocolTest {

    @Test
    fun `matchStateToJson serializes a full match state`() {
        val room = MatchRoomDocument(
            code = "ABCD",
            active = true,
            matchMode = MatchMode.doubles,
            matchState = MatchStateSnapshot(
                teamA = TeamSnapshot(name = "Team Alpha", score = 11),
                teamB = TeamSnapshot(name = "Team Beta", score = 8),
                servingTeamId = TeamId.teamA,
                servingPlayerId = "A1",
                receiverPlayerId = "B1",
                winnerTeamId = null
            )
        )

        val json = DataLayerProtocol.matchStateToJson(room)

        assertTrue(json.contains("\"type\":\"MATCH_STATE\""))
        assertTrue(json.contains("\"name\":\"Team Alpha\""))
        assertTrue(json.contains("\"score\":11"))
        assertTrue(json.contains("\"servingTeamId\":\"teamA\""))
    }

    @Test
    fun `matchStateToJson handles null matchState`() {
        val room = MatchRoomDocument(code = "ABCD")
        val json = DataLayerProtocol.matchStateToJson(room)
        assertEquals("{}", json)
    }

    @Test
    fun `matchStateToJson handles null winner`() {
        val room = MatchRoomDocument(
            matchState = MatchStateSnapshot(winnerTeamId = null)
        )
        val json = DataLayerProtocol.matchStateToJson(room)
        assertTrue(json.contains("\"winnerTeamId\":null"))
    }

    @Test
    fun `connectionStatusToJson produces valid status`() {
        val activeJson = DataLayerProtocol.connectionStatusToJson(DataLayerProtocol.ConnectionStatus.ACTIVE)
        assertTrue(activeJson.contains("\"status\":\"ACTIVE\""))

        val inactiveJson = DataLayerProtocol.connectionStatusToJson(DataLayerProtocol.ConnectionStatus.INACTIVE)
        assertTrue(inactiveJson.contains("\"status\":\"INACTIVE\""))
    }

    @Test
    fun `commandFromJson parses POINT_TEAM with teamId`() {
        val json = """{"type":"COMMAND","command":{"commandType":"POINT_TEAM","teamId":"teamA"}}"""
        val cmd = DataLayerProtocol.commandFromJson(json)
        assertNotNull(cmd)
        assertEquals(WatchRemoteCommandType.POINT_TEAM, cmd!!.type)
        assertEquals(TeamId.teamA, cmd.teamId)
    }

    @Test
    fun `commandFromJson parses UNDO`() {
        val json = """{"type":"COMMAND","command":{"commandType":"UNDO"}}"""
        val cmd = DataLayerProtocol.commandFromJson(json)
        assertNotNull(cmd)
        assertEquals(WatchRemoteCommandType.UNDO, cmd!!.type)
        assertNull(cmd.teamId)
    }

    @Test
    fun `commandFromJson parses ANNOUNCE`() {
        val json = """{"type":"COMMAND","command":{"commandType":"ANNOUNCE"}}"""
        val cmd = DataLayerProtocol.commandFromJson(json)
        assertNotNull(cmd)
        assertEquals(WatchRemoteCommandType.ANNOUNCE, cmd!!.type)
    }

    @Test
    fun `commandFromJson returns null for invalid JSON`() {
        assertNull(DataLayerProtocol.commandFromJson("not json"))
        assertNull(DataLayerProtocol.commandFromJson("""{"type":"COMMAND","command":{}}"""))
        assertNull(DataLayerProtocol.commandFromJson("""{"type":"COMMAND","command":{"commandType":"INVALID"}}"""))
    }
}
