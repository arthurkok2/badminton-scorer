package com.badminton.scorer.watch

import org.junit.Assert.*
import org.junit.Test

class RemoteViewModelTest {

    @Test
    fun `MatchStatePayload default values`() {
        val payload = MatchStatePayload()
        assertEquals("", payload.teamAName)
        assertEquals(0, payload.teamAScore)
        assertEquals("", payload.teamBName)
        assertEquals(0, payload.teamBScore)
        assertNull(payload.servingTeamId)
        assertNull(payload.winnerTeamId)
    }

    @Test
    fun `WatchCommand POINT_TEAM carries teamId`() {
        val cmd = WatchCommand(
            commandType = WatchCommandType.POINT_TEAM,
            teamId = TeamId.teamA
        )
        assertEquals(WatchCommandType.POINT_TEAM, cmd.commandType)
        assertEquals(TeamId.teamA, cmd.teamId)
    }

    @Test
    fun `WatchCommand UNDO has no teamId`() {
        val cmd = WatchCommand(commandType = WatchCommandType.UNDO)
        assertNull(cmd.teamId)
    }

    @Test
    fun `RemoteScreenState starts with safe defaults`() {
        val state = RemoteScreenState()
        assertFalse(state.isActive)
        assertFalse(state.isMatchOver)
        assertEquals("", state.teamAName)
        assertEquals(0, state.teamAScore)
        assertEquals("", state.teamBName)
        assertEquals(0, state.teamBScore)
    }

    @Test
    fun `ConnectionStatusPayload reflects active state`() {
        val active = ConnectionStatusPayload(isActive = true)
        assertTrue(active.isActive)

        val inactive = ConnectionStatusPayload(isActive = false)
        assertFalse(inactive.isActive)
    }
}
