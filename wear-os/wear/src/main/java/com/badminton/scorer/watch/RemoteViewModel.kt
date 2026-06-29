package com.badminton.scorer.watch

import android.app.Application
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class RemoteScreenState(
    val isActive: Boolean = false,
    val isMatchOver: Boolean = false,
    val teamAName: String = "",
    val teamAScore: Int = 0,
    val teamBName: String = "",
    val teamBScore: Int = 0,
    val servingTeamId: String? = null,
    val winnerTeamId: String? = null,
    val isDataLayerConnected: Boolean = false
)

class RemoteViewModel(application: Application) : AndroidViewModel(application) {

    private val dataLayerClient = WearDataLayerClient(application)
    private val vibrator: Vibrator

    private val _state = MutableStateFlow(RemoteScreenState())
    val state: StateFlow<RemoteScreenState> = _state.asStateFlow()

    init {
        val vibratorManager = application.getSystemService(Application.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
        vibrator = if (vibratorManager != null) {
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            application.getSystemService(Application.VIBRATOR_SERVICE) as Vibrator
        }

        viewModelScope.launch {
            dataLayerClient.advertiseCapability()
        }

        viewModelScope.launch {
            dataLayerClient.observeConnectionStatus().collect { status ->
                _state.value = _state.value.copy(
                    isActive = status.isActive,
                    isDataLayerConnected = true
                )
                if (!status.isActive) {
                    _state.value = RemoteScreenState() // reset on disconnect
                }
            }
        }

        viewModelScope.launch {
            dataLayerClient.observeMatchState().collect { match ->
                _state.value = _state.value.copy(
                    teamAName = match.teamAName,
                    teamAScore = match.teamAScore,
                    teamBName = match.teamBName,
                    teamBScore = match.teamBScore,
                    servingTeamId = match.servingTeamId,
                    winnerTeamId = match.winnerTeamId,
                    isMatchOver = match.winnerTeamId != null
                )
            }
        }
    }

    fun scoreTeamA() {
        sendCommand(WatchCommand(WatchCommandType.POINT_TEAM, TeamId.teamA))
    }

    fun scoreTeamB() {
        sendCommand(WatchCommand(WatchCommandType.POINT_TEAM, TeamId.teamB))
    }

    fun undo() {
        sendCommand(WatchCommand(WatchCommandType.UNDO))
    }

    private fun sendCommand(command: WatchCommand) {
        viewModelScope.launch {
            try {
                dataLayerClient.sendCommand(command)
                triggerHapticFeedback()
            } catch (_: Exception) {
                // Command failed silently — the user sees the watch screen
            }
        }
    }

    private fun triggerHapticFeedback() {
        try {
            val effect = VibrationEffect.createOneShot(50, VibrationEffect.DEFAULT_AMPLITUDE)
            vibrator.vibrate(effect)
        } catch (_: Exception) {
            // Haptic not available
        }
    }
}
