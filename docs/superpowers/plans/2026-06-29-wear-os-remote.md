# Wear OS Remote Control — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Wear OS watch app + Android phone companion that controls the badminton scorer via the existing Firestore remote protocol (room codes, commands subcollection).

**Architecture:** Watch ← Wearable Data Layer → Phone Companion ← Firebase Firestore → Host PWA (unchanged). The companion owns the Firebase connection and bridges state/commands between Firestore and the watch. The watch is a single-screen Jetpack Compose for Wear OS app showing live score + scoring buttons.

**Tech Stack:** Kotlin, Jetpack Compose for Wear OS, Wearable Data Layer API, Firebase Firestore/Auth Android SDKs, Kotlin coroutines, Gradle with Kotlin DSL.

---

### Task 1: Create Android project scaffolding

**Files:**
- Create: `wear-os/build.gradle.kts`
- Create: `wear-os/settings.gradle.kts`
- Create: `wear-os/gradle.properties`
- Create: `wear-os/gradle/wrapper/gradle-wrapper.properties`
- Create: `wear-os/gradlew` (copy from existing Android project or generate)
- Create: `wear-os/companion/build.gradle.kts`
- Create: `wear-os/wear/build.gradle.kts`
- Create: `wear-os/companion/src/main/AndroidManifest.xml`
- Create: `wear-os/wear/src/main/AndroidManifest.xml`

- [ ] **Step 1: Create project-level `build.gradle.kts`**

```kotlin
// wear-os/build.gradle.kts
plugins {
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.1.0" apply false
    id("com.google.gms.google-services") version "4.4.2" apply false
}
```

- [ ] **Step 2: Create `settings.gradle.kts`**

```kotlin
// wear-os/settings.gradle.kts
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "BadmintonScorerWearOS"
include(":companion")
include(":wear")
```

- [ ] **Step 3: Create `gradle.properties`**

```properties
# wear-os/gradle.properties
android.useAndroidX=true
kotlin.code.style=official
android.nonTransitiveRClass=true
org.gradle.jvmargs=-Xmx2048m
```

- [ ] **Step 4: Create `gradle/wrapper/gradle-wrapper.properties`**

```properties
# wear-os/gradle/wrapper/gradle-wrapper.properties
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-8.9-bin.zip
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
```

- [ ] **Step 5: Create companion module `build.gradle.kts`**

```kotlin
// wear-os/companion/build.gradle.kts
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.badminton.scorer.companion"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.badminton.scorer.companion"
        minSdk = 30
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    buildFeatures {
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.15"
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-firestore-ktx")
    implementation("com.google.firebase:firebase-auth-ktx")
    implementation("com.google.android.gms:play-services-wearable:19.0.0")
    implementation("com.google.android.gms:play-services-auth:21.2.0")

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")

    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
    testImplementation("io.mockk:mockk:1.13.13")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
```

- [ ] **Step 6: Create wear module `build.gradle.kts`**

```kotlin
// wear-os/wear/build.gradle.kts
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.badminton.scorer.watch"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.badminton.scorer.watch"
        minSdk = 30
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    buildFeatures {
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.15"
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("com.google.android.gms:play-services-wearable:19.0.0")

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")

    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")

    implementation(platform("androidx.wear.compose:compose-bom:1.5.0"))
    implementation("androidx.wear.compose:compose-material3")
    implementation("androidx.wear.compose:compose-foundation")
    implementation("androidx.wear.compose:compose-navigation")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
    testImplementation("io.mockk:mockk:1.13.13")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
```

- [ ] **Step 7: Create companion `AndroidManifest.xml`**

```xml
<!-- wear-os/companion/src/main/AndroidManifest.xml -->
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:theme="@style/Theme.BadmintonScorer">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:label="@string/app_name">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <service
            android:name=".RemoteForegroundService"
            android:exported="false"
            android:foregroundServiceType="dataSync" />
    </application>
</manifest>
```

- [ ] **Step 8: Create wear `AndroidManifest.xml`**

```xml
<!-- wear-os/wear/src/main/AndroidManifest.xml -->
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-feature android:name="android.hardware.type.watch" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:theme="@android:style/Theme.DeviceDefault">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:label="@string/app_name">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

- [ ] **Step 9: Commit**

```bash
git add wear-os/
git commit -m "chore: add Wear OS project scaffolding"
```

---

### Task 2: Define shared data classes (Kotlin equivalents of firestoreRemoteTypes)

**Files:**
- Create: `wear-os/companion/src/main/java/com/badminton/scorer/companion/RemoteTypes.kt`

- [ ] **Step 1: Create `RemoteTypes.kt`**

```kotlin
// wear-os/companion/src/main/java/com/badminton/scorer/companion/RemoteTypes.kt
package com.badminton.scorer.companion

/**
 * Mirrors the existing Firestore document schema from src/remote/firestoreRemoteTypes.ts.
 * The host PWA writes room documents to Firestore at matches/{code} with these fields,
 * and the companion reads + relays them to the watch via Data Layer.
 */

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

/**
 * Deserialized from Firestore matches/{code} document.
 * The host PWA writes matchState (a JSON object) and matchMode (a string).
 * See src/remote/firestoreRemoteService.ts matchPayload() for the exact shape.
 */
data class MatchRoomDocument(
    val code: String = "",
    val active: Boolean = false,
    val hostId: String = "",
    val matchMode: MatchMode = MatchMode.doubles,
    val matchState: MatchStateSnapshot? = null,
    val winnerTeamId: TeamId? = null,
    val lastAppliedCommandId: String? = null
)

/**
 * The matchState sub-object embedded in the room document.
 * Serialized by the host via JSON.stringify(match).
 * The host's MatchState type (from src/domain/matchTypes.ts) includes:
 *   mode, teamA, teamB, servingTeamId, servingPlayerId, receiverPlayerId,
 *   courtPositions, winnerTeamId, history[]
 */
data class MatchStateSnapshot(
    val teamA: TeamSnapshot? = null,
    val teamB: TeamSnapshot? = null,
    val servingTeamId: TeamId? = null,
    val servingPlayerId: String? = null,
    val receiverPlayerId: String? = null,
    val winnerTeamId: TeamId? = null,
    val matchMode: MatchMode? = null
)

/**
 * Writes to Firestore matches/{code}/commands/{id}.
 * Mirrors the existing WatchRemoteCommandDocument:
 *   { type, teamId?, sourceId, sourceKind: 'wear', createdAt }
 * See src/remote/firestoreControllerService.ts sendControllerCommand().
 */
data class RemoteCommand(
    val type: WatchRemoteCommandType,
    val teamId: TeamId? = null,
    val sourceId: String = "wear-os-watch",
    val sourceKind: String = "wear" // must be "wear" for host validation (see firestoreRemoteService.ts:188)
)
```

- [ ] **Step 2: Commit**

```bash
git add wear-os/companion/src/main/java/com/badminton/scorer/companion/RemoteTypes.kt
git commit -m "feat: add RemoteTypes data classes mirroring Firestore schema"
```

---

### Task 3: Implement FirebaseClient

**Files:**
- Create: `wear-os/companion/src/main/java/com/badminton/scorer/companion/FirebaseClient.kt`

- [ ] **Step 1: Create `FirebaseClient.kt`**

```kotlin
// wear-os/companion/src/main/java/com/badminton/scorer/companion/FirebaseClient.kt
package com.badminton.scorer.companion

import com.google.firebase.Timestamp
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import java.util.UUID

class FirebaseClient(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    companion object {
        private const val ROOM_COLLECTION = "matches"
        private const val COMMAND_COLLECTION = "commands"
    }

    /**
     * Subscribes to the room document at matches/{code}.
     * Emits updated MatchRoomDocument on every change. Completes when room goes inactive or not found.
     * Mirrors subscribeToRoomState() in src/remote/firestoreControllerService.ts.
     */
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

    /**
     * Sends a command to matches/{code}/commands/{uuid}.
     * Mirrors sendControllerCommand() in src/remote/firestoreControllerService.ts.
     * The host PWA reads commands from this subcollection and forwards to dispatch().
     */
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
```

- [ ] **Step 2: Commit**

```bash
git add wear-os/companion/src/main/java/com/badminton/scorer/companion/FirebaseClient.kt
git commit -m "feat: add FirebaseClient for reading room state and sending commands"
```

---

### Task 4: Implement DataLayerProtocol

**Files:**
- Create: `wear-os/companion/src/main/java/com/badminton/scorer/companion/DataLayerProtocol.kt`

- [ ] **Step 1: Create `DataLayerProtocol.kt`**

```kotlin
// wear-os/companion/src/main/java/com/badminton/scorer/companion/DataLayerProtocol.kt
package com.badminton.scorer.companion

/**
 * JSON message protocol for Wearable Data Layer communication between
 * the phone companion and the Wear OS watch.
 *
 * Phone -> Watch paths: /match_state, /connection_status
 * Watch -> Phone paths: /command
 *
 * Messages use DataClient.putDataItem() for guaranteed delivery.
 */

object DataLayerProtocol {
    const val PATH_MATCH_STATE = "/match_state"
    const val PATH_CONNECTION_STATUS = "/connection_status"
    const val PATH_COMMAND = "/command"

    enum class ConnectionStatus { ACTIVE, INACTIVE }

    /**
     * Serializes a MatchStateSnapshot to JSON for Data Layer push to the watch.
     * The watch deserializes this into its own MatchStateSnapshot equivalent.
     */
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

    /**
     * Serializes connection status for watch notification.
     */
    fun connectionStatusToJson(status: ConnectionStatus): String {
        return """{"type":"CONNECTION_STATUS","status":"${status.name}"}"""
    }

    /**
     * Deserializes a command from the watch.
     * Watch sends: {"type":"COMMAND","command":{"commandType":"POINT_TEAM","teamId":"teamA"}}
     */
    fun commandFromJson(json: String): RemoteCommand? {
        return try {
            // Simple regex-based parsing to avoid a JSON library dependency
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
```

- [ ] **Step 2: Commit**

```bash
git add wear-os/companion/src/main/java/com/badminton/scorer/companion/DataLayerProtocol.kt
git commit -m "feat: add DataLayerProtocol for phone<->watch JSON messages"
```

---

### Task 5: Implement RemoteForegroundService

**Files:**
- Create: `wear-os/companion/src/main/java/com/badminton/scorer/companion/RemoteForegroundService.kt`

- [ ] **Step 1: Create `RemoteForegroundService.kt`**

```kotlin
// wear-os/companion/src/main/java/com/badminton/scorer/companion/RemoteForegroundService.kt
package com.badminton.scorer.companion

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.IBinder
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
        roomCode = code

        val notification = buildNotification(code)
        startForeground(NOTIFICATION_ID, notification)

        registerDataLayerListener()

        serviceScope.launch {
            firebaseClient.observeRoom(code)
                .catch { e -> pushConnectionStatus(DataLayerProtocol.ConnectionStatus.INACTIVE) }
                .collect { result ->
                    result.onSuccess { roomDoc ->
                        pushMatchState(roomDoc)
                    }.onFailure {
                        pushConnectionStatus(DataLayerProtocol.ConnectionStatus.INACTIVE)
                    }
                }
        }
    }

    private fun disconnect() {
        roomCode = null
        pushConnectionStatus(DataLayerProtocol.ConnectionStatus.INACTIVE)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun registerDataLayerListener() {
        if (dataListenerRegistered) return
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
        val command = DataLayerProtocol.commandFromJson(json) ?: return
        val code = roomCode ?: return

        serviceScope.launch {
            firebaseClient.sendCommand(code, command)
        }
    }

    private fun pushMatchState(roomDoc: MatchRoomDocument) {
        val json = DataLayerProtocol.matchStateToJson(roomDoc)
        val request = PutDataMapRequest.create(DataLayerProtocol.PATH_MATCH_STATE).apply {
            dataMap.putString("payload", json)
        }
        dataClient.putDataItem(request.asPutDataRequest())
    }

    private fun pushConnectionStatus(status: DataLayerProtocol.ConnectionStatus) {
        val json = DataLayerProtocol.connectionStatusToJson(status)
        val request = PutDataMapRequest.create(DataLayerProtocol.PATH_CONNECTION_STATUS).apply {
            dataMap.putString("payload", json)
        }
        dataClient.putDataItem(request.asPutDataRequest())
    }

    private fun buildNotification(code: String) = NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle("Badminton Remote Active")
        .setContentText("Connected to room $code")
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
```

- [ ] **Step 2: Commit**

```bash
git add wear-os/companion/src/main/java/com/badminton/scorer/companion/RemoteForegroundService.kt
git commit -m "feat: add RemoteForegroundService bridging Firestore <-> Data Layer"
```

---

### Task 6: Implement companion MainActivity

**Files:**
- Create: `wear-os/companion/src/main/java/com/badminton/scorer/companion/MainActivity.kt`
- Create: `wear-os/companion/src/main/res/values/strings.xml`
- Create: `wear-os/companion/src/main/res/values/themes.xml`

- [ ] **Step 1: Create `strings.xml`**

```xml
<!-- wear-os/companion/src/main/res/values/strings.xml -->
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Badminton Remote</string>
    <string name="room_code_hint">Room Code</string>
    <string name="connect">Connect</string>
    <string name="disconnect">Disconnect</string>
    <string name="connected_to">Connected to %1$s</string>
    <string name="watch_connected">Watch connected</string>
    <string name="watch_disconnected">Watch not connected</string>
    <string name="waiting_for_connection">Waiting for connection&#8230;</string>
    <string name="team_a_label">Team A</string>
    <string name="team_b_label">Team B</string>
</resources>
```

- [ ] **Step 2: Create `themes.xml`**

```xml
<!-- wear-os/companion/src/main/res/values/themes.xml -->
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.BadmintonScorer" parent="android:Theme.Material.Light.NoActionBar" />
</resources>
```

- [ ] **Step 3: Create `MainActivity.kt`**

```kotlin
// wear-os/companion/src/main/java/com/badminton/scorer/companion/MainActivity.kt
package com.badminton.scorer.companion

import android.Manifest
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.core.content.edit
import com.google.android.gms.wearable.CapabilityClient
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.tasks.await

class MainActivity : ComponentActivity() {

    private val prefs: SharedPreferences by lazy {
        getSharedPreferences("badminton_remote", MODE_PRIVATE)
    }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            // Permission granted, can now start foreground service
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        // Firebase Auth: silently sign in with Google (same identity provider as the PWA host).
        // The PWA's Firestore security rules require the user to be authenticated.
        signInSilently()

        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    CompanionScreen(
                        lastCode = prefs.getString("last_room_code", ""),
                        onConnect = { code ->
                            prefs.edit { putString("last_room_code", code) }
                            startRemoteService(code)
                        },
                        onDisconnect = {
                            stopRemoteService()
                        }
                    )
                }
            }
        }
    }

    private fun startRemoteService(code: String) {
        val intent = Intent(this, RemoteForegroundService::class.java).apply {
            putExtra(RemoteForegroundService.EXTRA_ROOM_CODE, code)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    private fun stopRemoteService() {
        val intent = Intent(this, RemoteForegroundService::class.java).apply {
            action = RemoteForegroundService.ACTION_DISCONNECT
        }
        startService(intent)
    }

    // Firebase Auth — silently sign in with Google (required by Firestore security rules)
    private val firebaseAuth = com.google.firebase.auth.FirebaseAuth.getInstance()

    private fun signInSilently() {
        if (firebaseAuth.currentUser != null) return // already signed in

        val gso = com.google.android.gms.auth.api.signin.GoogleSignInOptions.Builder(
            com.google.android.gms.auth.api.signin.GoogleSignInOptions.DEFAULT_SIGN_IN
        )
            .requestIdToken(getString(R.string.default_web_client_id))
            .requestEmail()
            .build()

        val googleSignInClient = com.google.android.gms.auth.api.signin.GoogleSignIn.getClient(this, gso)

        googleSignInClient.silentSignIn().addOnCompleteListener { task ->
            if (task.isSuccessful) {
                val account = task.result
                val credential = com.google.firebase.auth.GoogleAuthProvider.getCredential(account.idToken, null)
                firebaseAuth.signInWithCredential(credential).addOnCompleteListener { authTask ->
                    if (!authTask.isSuccessful) {
                        // Silent sign-in failed; fall back to explicit sign-in
                        signInExplicitly(googleSignInClient)
                    }
                }
            } else {
                signInExplicitly(googleSignInClient)
            }
        }
    }

    private fun signInExplicitly(googleSignInClient: com.google.android.gms.auth.api.signin.GoogleSignInClient) {
        val signInLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            val task = com.google.android.gms.auth.api.signin.GoogleSignIn.getSignedInAccountFromIntent(result.data)
            if (task.isSuccessful) {
                val account = task.result
                val credential = com.google.firebase.auth.GoogleAuthProvider.getCredential(account.idToken, null)
                firebaseAuth.signInWithCredential(credential)
            }
        }
        signInLauncher.launch(googleSignInClient.signInIntent)
    }
}

enum class CompanionState { SETUP, CONNECTING, CONNECTED }

@Composable
fun CompanionScreen(
    lastCode: String?,
    onConnect: (String) -> Unit,
    onDisconnect: () -> Unit
) {
    var state by remember { mutableStateOf(CompanionState.SETUP) }
    var roomCode by remember { mutableStateOf(lastCode ?: "") }
    var isWatchConnected by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        // Check if a Wear OS watch is reachable via Data Layer
        try {
            val capabilityInfo = Wearable.getCapabilityClient(
                androidx.compose.ui.platform.LocalContext.current
            ).getCapability("remote_control", CapabilityClient.FILTER_REACHABLE).await()
            isWatchConnected = capabilityInfo.nodes.isNotEmpty()
        } catch (_: Exception) {
            isWatchConnected = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        when (state) {
            CompanionState.SETUP -> SetupContent(
                roomCode = roomCode,
                onRoomCodeChange = { roomCode = it },
                onConnect = {
                    if (roomCode.length == 4) {
                        state = CompanionState.CONNECTING
                        onConnect(roomCode.uppercase())
                    }
                },
                isWatchConnected = isWatchConnected
            )

            CompanionState.CONNECTING -> ConnectingContent()

            CompanionState.CONNECTED -> ConnectedContent(
                roomCode = roomCode,
                onDisconnect = {
                    state = CompanionState.SETUP
                    onDisconnect()
                }
            )
        }
    }
}

@Composable
fun SetupContent(
    roomCode: String,
    onRoomCodeChange: (String) -> Unit,
    onConnect: () -> Unit,
    isWatchConnected: Boolean
) {
    Text(
        text = "Badminton Remote",
        style = MaterialTheme.typography.headlineMedium,
        modifier = Modifier.padding(bottom = 8.dp)
    )

    Text(
        text = "Enter the 4-character room code shown on the scorer.",
        style = MaterialTheme.typography.bodyMedium,
        textAlign = TextAlign.Center,
        modifier = Modifier.padding(bottom = 16.dp)
    )

    BasicTextField(
        value = roomCode,
        onValueChange = { if (it.length <= 4) onRoomCodeChange(it.uppercase()) },
        modifier = Modifier.fillMaxWidth().padding(horizontal = 48.dp),
        textStyle = androidx.compose.ui.text.TextStyle(
            fontSize = 32.sp,
            textAlign = TextAlign.Center,
            letterSpacing = 8.sp
        ),
        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters),
        decorationBox = { innerTextField ->
            Box(
                modifier = Modifier.fillMaxWidth().height(64.dp),
                contentAlignment = Alignment.Center
            ) {
                if (roomCode.isEmpty()) {
                    Text("XXXX", fontSize = 32.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f))
                }
                innerTextField()
            }
        }
    )

    Spacer(modifier = Modifier.height(24.dp))

    Button(
        onClick = onConnect,
        enabled = roomCode.length == 4,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 48.dp)
    ) {
        Text("Connect")
    }

    Spacer(modifier = Modifier.height(16.dp))

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        Text(
            text = if (isWatchConnected) "●" else "○",
            color = if (isWatchConnected)
                androidx.compose.ui.graphics.Color.Green
            else
                androidx.compose.ui.graphics.Color.Gray
        )
        Spacer(modifier = Modifier.size(4.dp))
        Text(
            text = if (isWatchConnected) "Watch connected" else "Watch not connected",
            style = MaterialTheme.typography.bodySmall
        )
    }
}

@Composable
fun ConnectingContent() {
    CircularProgressIndicator()
    Spacer(modifier = Modifier.height(16.dp))
    Text("Connecting...", style = MaterialTheme.typography.bodyLarge)
}

@Composable
fun ConnectedContent(
    roomCode: String,
    onDisconnect: () -> Unit
) {
    Text(
        text = "Connected",
        style = MaterialTheme.typography.headlineSmall,
        color = MaterialTheme.colorScheme.primary
    )
    Spacer(modifier = Modifier.height(8.dp))
    Text(
        text = "Room: $roomCode",
        style = MaterialTheme.typography.bodyLarge
    )
    Spacer(modifier = Modifier.height(24.dp))
    OutlinedButton(onClick = onDisconnect) {
        Text("Disconnect")
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add wear-os/companion/src/main/java/com/badminton/scorer/companion/MainActivity.kt
git add wear-os/companion/src/main/res/
git commit -m "feat: add companion MainActivity with room code entry and status UI"
```

---

### Task 7: Create wear module resources

**Files:**
- Create: `wear-os/wear/src/main/res/values/strings.xml`
- Create: `wear-os/wear/src/main/res/values/colors.xml`

- [ ] **Step 1: Create wear `strings.xml`**

```xml
<!-- wear-os/wear/src/main/res/values/strings.xml -->
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Badminton</string>
    <string name="waiting_for_connection">Waiting for connection</string>
    <string name="connect_from_phone">Connect to a match from\nthe companion app</string>
    <string name="match_over">Match Over</string>
    <string name="score_team_a">Score Team A</string>
    <string name="score_team_b">Score Team B</string>
    <string name="undo">Undo</string>
    <string name="serving_indicator">●</string>
</resources>
```

- [ ] **Step 2: Create wear `colors.xml`**

```xml
<!-- wear-os/wear/src/main/res/values/colors.xml -->
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="team_a_green">#4CAF50</color>
    <color name="team_b_blue">#2196F3</color>
    <color name="connected_green">#4CAF50</color>
    <color name="serving_color">#FFEB3B</color>
    <color name="bg_dark">#1A1A2E</color>
    <color name="surface_dark">#16213E</color>
</resources>
```

- [ ] **Step 3: Commit**

```bash
git add wear-os/wear/src/main/res/
git commit -m "chore: add wear module string and color resources"
```

---

### Task 8: Implement WearDataLayerClient (watch-side)

**Files:**
- Create: `wear-os/wear/src/main/java/com/badminton/scorer/watch/WearDataLayerClient.kt`

- [ ] **Step 1: Create `WearDataLayerClient.kt`**

```kotlin
// wear-os/wear/src/main/java/com/badminton/scorer/watch/WearDataLayerClient.kt
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

/**
 * Wraps the Wearable DataClient API for the watch side.
 * Receives match state and connection status from the phone companion.
 * Sends commands (POINT_TEAM, UNDO, ANNOUNCE) to the phone companion.
 */
class WearDataLayerClient(context: Context) {

    private val dataClient: DataClient = Wearable.getDataClient(context)

    /**
     * Listens for match state updates pushed by the phone companion at /match_state.
     * Each update carries a JSON payload matching the MATCH_STATE protocol.
     */
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

    /**
     * Listens for connection status changes pushed by the phone companion at /connection_status.
     */
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

    /**
     * Sends a command to the phone companion at /command.
     * The phone companion forwards it to Firestore matches/{code}/commands.
     */
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

    /**
     * Registers this watch as reachable for the phone companion's capability check.
     * The phone uses "remote_control" capability to detect connected watches.
     */
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
```

- [ ] **Step 2: Commit**

```bash
git add wear-os/wear/src/main/java/com/badminton/scorer/watch/WearDataLayerClient.kt
git commit -m "feat: add WearDataLayerClient for watch-side Data Layer communication"
```

---

### Task 9: Implement RemoteViewModel (watch-side)

**Files:**
- Create: `wear-os/wear/src/main/java/com/badminton/scorer/watch/RemoteViewModel.kt`

- [ ] **Step 1: Create `RemoteViewModel.kt`**

```kotlin
// wear-os/wear/src/main/java/com/badminton/scorer/watch/RemoteViewModel.kt
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
```

- [ ] **Step 2: Commit**

```bash
git add wear-os/wear/src/main/java/com/badminton/scorer/watch/RemoteViewModel.kt
git commit -m "feat: add RemoteViewModel for watch state management and command dispatch"
```

---

### Task 10: Implement RemoteScreen (watch UI composable)

**Files:**
- Create: `wear-os/wear/src/main/java/com/badminton/scorer/watch/RemoteScreen.kt`

- [ ] **Step 1: Create `RemoteScreen.kt`**

```kotlin
// wear-os/wear/src/main/java/com/badminton/scorer/watch/RemoteScreen.kt
package com.badminton.scorer.watch

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.ExperimentalWearFoundationApi
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.curvedText
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.input.pointer.pointerInput

@OptIn(ExperimentalWearFoundationApi::class)
@Composable
fun RemoteScreen(viewModel: RemoteViewModel) {
    val state by viewModel.state.collectAsState()

    if (!state.isActive) {
        WaitingScreen()
    } else {
        ActiveScreen(state = state, viewModel = viewModel)
    }
}

@Composable
fun WaitingScreen() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "Waiting for\nconnection",
                textAlign = TextAlign.Center,
                style = MaterialTheme.typography.body1,
                color = Color.Gray
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Connect to a match\nfrom the companion app",
                textAlign = TextAlign.Center,
                style = MaterialTheme.typography.caption2,
                color = Color.Gray
            )
        }
    }
}

@OptIn(ExperimentalWearFoundationApi::class)
@Composable
fun ActiveScreen(
    state: RemoteScreenState,
    viewModel: RemoteViewModel
) {
    val scalingListState = rememberScalingLazyListState()

    ScalingLazyColumn(
        modifier = Modifier.fillMaxSize(),
        state = scalingListState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            // Connection indicator
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Text(
                    text = "●",
                    color = Color(0xFF4CAF50),
                    fontSize = 12.sp
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "Connected",
                    fontSize = 12.sp,
                    color = Color(0xFF4CAF50)
                )
            }
        }

        item {
            // Team A name
            Text(
                text = state.teamAName.ifEmpty { "Team A" },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
                textAlign = TextAlign.Center,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                fontSize = 14.sp,
                color = Color(0xFFCCCCCC)
            )
        }

        item {
            // Team A score with serving indicator
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (state.servingTeamId == "teamA") {
                    Text(
                        text = "●",
                        color = Color(0xFFFFEB3B),
                        fontSize = 16.sp
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                }
                Text(
                    text = state.teamAScore.toString(),
                    fontSize = 36.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }
        }

        item {
            // Team B score with serving indicator
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (state.servingTeamId == "teamB") {
                    Text(
                        text = "●",
                        color = Color(0xFFFFEB3B),
                        fontSize = 16.sp
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                }
                Text(
                    text = state.teamBScore.toString(),
                    fontSize = 36.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }
        }

        item {
            // Team B name
            Text(
                text = state.teamBName.ifEmpty { "Team B" },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
                textAlign = TextAlign.Center,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                fontSize = 14.sp,
                color = Color(0xFFCCCCCC)
            )
        }

        if (state.isMatchOver) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Match Over",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFFFF9800),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }

        if (!state.isMatchOver) {
            item {
                Spacer(modifier = Modifier.height(12.dp))

                // Score Team A button
                Button(
                    onClick = { viewModel.scoreTeamA() },
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                    colors = ButtonDefaults.buttonColors(
                        backgroundColor = Color(0xFF2E7D32)
                    )
                ) {
                    Text(
                        text = "Score Team A",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
            }

            item {
                Spacer(modifier = Modifier.height(4.dp))

                // Score Team B button
                Button(
                    onClick = { viewModel.scoreTeamB() },
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                    colors = ButtonDefaults.buttonColors(
                        backgroundColor = Color(0xFF1565C0)
                    )
                ) {
                    Text(
                        text = "Score Team B",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
            }

            item {
                Spacer(modifier = Modifier.height(4.dp))

                // Undo button — long-press activates undo, single tap does nothing
                Button(
                    onClick = { },
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp)
                        .pointerInput(Unit) {
                            detectTapGestures(
                                onLongPress = { viewModel.undo() }
                            )
                        },
                    colors = ButtonDefaults.buttonColors(
                        backgroundColor = Color(0xFF424242)
                    )
                ) {
                    Text(
                        text = "Undo (long press)",
                        fontSize = 12.sp,
                        color = Color(0xFFAAAAAA)
                    )
                }
            }
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add wear-os/wear/src/main/java/com/badminton/scorer/watch/RemoteScreen.kt
git commit -m "feat: add watch RemoteScreen composable with score display and buttons"
```

---

### Task 11: Implement watch MainActivity

**Files:**
- Create: `wear-os/wear/src/main/java/com/badminton/scorer/watch/MainActivity.kt`

- [ ] **Step 1: Create `MainActivity.kt`**

```kotlin
// wear-os/wear/src/main/java/com/badminton/scorer/watch/MainActivity.kt
package com.badminton.scorer.watch

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.wear.compose.material.MaterialTheme

class MainActivity : ComponentActivity() {

    private val viewModel: RemoteViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                RemoteScreen(viewModel = viewModel)
            }
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add wear-os/wear/src/main/java/com/badminton/scorer/watch/MainActivity.kt
git commit -m "feat: add watch MainActivity wiring ViewModel to RemoteScreen"
```

---

### Task 12: Verify build compiles

- [ ] **Step 1: Place `google-services.json` in `wear-os/companion/`**

Copy your Firebase project's `google-services.json` into `wear-os/companion/google-services.json`. This file is generated from the Firebase Console (Project Settings > Your apps > Android app). The existing PWA already uses this Firebase project.

- [ ] **Step 2: Build the project**

```bash
# Ensure gradlew is executable
chmod +x wear-os/gradlew

# Build both modules
./wear-os/gradlew :companion:assembleDebug :wear:assembleDebug
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit `google-services.json` reference (not the file itself)**

Create `wear-os/companion/google-services.json.example` as a placeholder noting that real credentials are required:

```bash
echo '// Place your google-services.json from Firebase Console here.
// This file is git-ignored. Copy it from Firebase > Project Settings > Your apps.' > wear-os/companion/google-services.json.example
```

Add to `.gitignore`:

```bash
echo "google-services.json" >> .gitignore
```

```bash
git add wear-os/companion/google-services.json.example .gitignore
git commit -m "chore: add google-services.json placeholder and gitignore"
```

---

### Task 13: Unit tests — companion (FirebaseClient + DataLayerProtocol)

**Files:**
- Create: `wear-os/companion/src/test/java/com/badminton/scorer/companion/FirebaseClientTest.kt`
- Create: `wear-os/companion/src/test/java/com/badminton/scorer/companion/DataLayerProtocolTest.kt`

- [ ] **Step 1: Create `DataLayerProtocolTest.kt`**

```kotlin
// wear-os/companion/src/test/java/com/badminton/scorer/companion/DataLayerProtocolTest.kt
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
```

- [ ] **Step 2: Create `FirebaseClientTest.kt`**

```kotlin
// wear-os/companion/src/test/java/com/badminton/scorer/companion/FirebaseClientTest.kt
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
```

- [ ] **Step 3: Run companion tests**

```bash
# Run tests with Gradle (from wear-os/ directory)
./gradlew :companion:test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add wear-os/companion/src/test/
git commit -m "test: add companion unit tests for DataLayerProtocol and FirebaseClient types"
```

---

### Task 14: Unit tests — wear (RemoteViewModel)

**Files:**
- Create: `wear-os/wear/src/test/java/com/badminton/scorer/watch/RemoteViewModelTest.kt`

- [ ] **Step 1: Create `RemoteViewModelTest.kt`**

```kotlin
// wear-os/wear/src/test/java/com/badminton/scorer/watch/RemoteViewModelTest.kt
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
```

- [ ] **Step 2: Run wear tests**

```bash
# Run tests with Gradle (from wear-os/ directory)
./gradlew :wear:test
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add wear-os/wear/src/test/
git commit -m "test: add wear unit tests for ViewModel state and command types"
```

---

### Task 15: End-to-end smoke test

- [ ] **Step 1: Start Firebase emulators in the PWA project**

```bash
firebase emulators:start --only firestore,auth
```

- [ ] **Step 2: Start the PWA dev server**

```bash
npm run dev
```

- [ ] **Step 3: Open the PWA in a browser, create a match, start the watch remote**

Tap the "Remote" button in the scorer UI (this calls `useWatchRemoteHost.start()`), note the 4-character room code.

- [ ] **Step 4: On an Android phone with companion app installed, enter the room code**

Tap "Connect". Verify: foreground notification appears, watch displays scores.

- [ ] **Step 5: On the Wear OS watch, tap "Score Team A"**

Verify: haptic feedback on watch, score updates on both watch and PWA host. Firestore emulator UI shows the command document at `matches/{code}/commands/{id}`.

- [ ] **Step 6: Long-press Undo on the watch**

Verify: last point is undone on host, watch scores revert.

- [ ] **Step 7: Disconnect from companion app**

Verify: watch returns to "Waiting for connection" screen. Foreground notification dismissed.

---

### Task 16: Plan complete — review and handoff

All tasks above are self-contained and can be executed in order. The companion module must be built before the wear module since they share no code dependencies but the companion defines the Firestore interface the watch depends on indirectly through the Data Layer protocol.
