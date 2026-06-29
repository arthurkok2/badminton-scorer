package com.badminton.scorer.companion

import org.junit.Assert.*
import org.junit.Test

class FirebaseClientTest {

    @Test
    fun `RemoteCommand sourceKind is always wear`() {
        val cmd = RemoteCommand(
            type = WatchRemoteCommandType.POINT_TEAM,
            teamId = TeamId.teamB
        )
        assertEquals("wear", cmd.sourceKind)
        assertEquals("wear-os-watch", cmd.sourceId)
    }

    @Test
    fun `RemoteCommand for UNDO has no teamId`() {
        val cmd = RemoteCommand(type = WatchRemoteCommandType.UNDO)
        assertNull(cmd.teamId)
    }

    @Test
    fun `MatchStateSnapshot default values are safe`() {
        val state = MatchStateSnapshot()
        assertNull(state.teamA)
        assertNull(state.teamB)
        assertNull(state.servingTeamId)
        assertNull(state.winnerTeamId)
    }

    @Test
    fun `TeamSnapshot default values are zeroed`() {
        val team = TeamSnapshot()
        assertEquals("", team.name)
        assertEquals(0, team.score)
        assertTrue(team.players.isEmpty())
    }

    @Test
    fun `MatchRoomDocument defaults to inactive`() {
        val room = MatchRoomDocument()
        assertFalse(room.active)
        assertEquals("", room.code)
    }
}
