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
