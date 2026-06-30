package com.badminton.scorer.companion

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.tasks.Task
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch

class RemoteForegroundService : Service() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private lateinit var firebaseClient: FirebaseClient
    private lateinit var dataClient: DataClient
    private var roomCode: String? = null
    private var dataListenerRegistered = false

    companion object {
        private const val TAG = "RemoteService"
        const val CHANNEL_ID = "badminton_remote"
        const val NOTIFICATION_ID = 1
        const val EXTRA_ROOM_CODE = "room_code"
        const val ACTION_DISCONNECT = "com.badminton.scorer.companion.DISCONNECT"
        const val ACTION_STOP = "com.badminton.scorer.companion.STOP"
    }

    override fun onCreate() {
        super.onCreate()
        firebaseClient = FirebaseClient()
        dataClient = Wearable.getDataClient(this)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "onStartCommand: action=${intent?.action}")
        when (intent?.action) {
            ACTION_DISCONNECT -> disconnect()
            ACTION_STOP -> stopSelf()
            else -> {
                val code = intent?.getStringExtra(EXTRA_ROOM_CODE)
                if (code != null) {
                    connect(code)
                }
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        disconnect()
        serviceScope.cancel()
        super.onDestroy()
    }

    private fun connect(code: String) {
        Log.d(TAG, "connect: roomCode=$code")
        roomCode = code

        val notification = buildNotification("Connecting to room $code...")
        startForeground(NOTIFICATION_ID, notification)

        registerDataLayerListener()

        serviceScope.launch {
            Log.d(TAG, "Starting Firebase observation for $code")
            firebaseClient.observeRoom(code)
                .catch { e ->
                    Log.e(TAG, "Error observing room $code", e)
                    pushConnectionStatus(DataLayerProtocol.ConnectionStatus.INACTIVE)
                }
                .collect { result ->
                    result.onSuccess { roomDoc ->
                        Log.d(TAG, "Received match state for $code: active=${roomDoc.active}")
                        updateNotification("Connected to room $code")
                        pushMatchState(roomDoc)
                        pushConnectionStatus(DataLayerProtocol.ConnectionStatus.ACTIVE)
                    }.onFailure { e ->
                        Log.w(TAG, "Failed to observe room $code: ${e.message}")
                        pushConnectionStatus(DataLayerProtocol.ConnectionStatus.INACTIVE)
                    }
                }
        }
    }

    private fun disconnect() {
        Log.d(TAG, "disconnect")
        roomCode = null
        pushConnectionStatus(DataLayerProtocol.ConnectionStatus.INACTIVE)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun registerDataLayerListener() {
        if (dataListenerRegistered) return
        Log.d(TAG, "Registering Data Layer listener")
        dataListenerRegistered = true
        dataClient.addListener { events ->
            for (event in events) {
                if (event.type == com.google.android.gms.wearable.DataEvent.TYPE_CHANGED &&
                    event.dataItem.uri.path == DataLayerProtocol.PATH_COMMAND
                ) {
                    handleCommandFromWatch(event.dataItem)
                }
            }
        }
    }

    private fun handleCommandFromWatch(dataItem: com.google.android.gms.wearable.DataItem) {
        val mapItem = DataMapItem.fromDataItem(dataItem)
        val json = mapItem.dataMap.getString("payload") ?: return
        Log.d(TAG, "Received command from watch: $json")
        val command = DataLayerProtocol.commandFromJson(json) ?: return
        val code = roomCode ?: return

        serviceScope.launch {
            firebaseClient.sendCommand(code, command)
        }
    }

    private fun pushMatchState(roomDoc: MatchRoomDocument) {
        Log.d(TAG, "Pushing match state to watch")
        val json = DataLayerProtocol.matchStateToJson(roomDoc)
        val request = PutDataMapRequest.create(DataLayerProtocol.PATH_MATCH_STATE).apply {
            dataMap.putString("payload", json)
            dataMap.putLong("timestamp", System.currentTimeMillis())
        }
        dataClient.putDataItem(request.asPutDataRequest())
    }

    private fun pushConnectionStatus(status: DataLayerProtocol.ConnectionStatus) {
        Log.d(TAG, "Pushing connection status to watch: $status")
        val json = DataLayerProtocol.connectionStatusToJson(status)
        val request = PutDataMapRequest.create(DataLayerProtocol.PATH_CONNECTION_STATUS).apply {
            dataMap.putString("payload", json)
            dataMap.putLong("timestamp", System.currentTimeMillis())
        }
        dataClient.putDataItem(request.asPutDataRequest())
    }

    private fun updateNotification(text: String) {
        val notification = buildNotification(text)
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, notification)
    }

    private fun buildNotification(text: String) = NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle("Badminton Remote Active")
        .setContentText(text)
        .setSmallIcon(android.R.drawable.ic_dialog_info)
        .setOngoing(true)
        .addAction(
            android.R.drawable.ic_menu_close_clear_cancel,
            "Disconnect",
            PendingIntent.getService(
                this, 0,
                Intent(this, RemoteForegroundService::class.java).apply { action = ACTION_DISCONNECT },
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
        )
        .build()

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Badminton Remote",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Shown while connected to a badminton scoring match"
        }
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)
    }
}
