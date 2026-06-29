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
