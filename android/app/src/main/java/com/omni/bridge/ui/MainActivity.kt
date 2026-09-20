package com.omni.bridge.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.omni.bridge.OmniBridgeApp
import com.omni.bridge.service.OmniConnectionService
import com.omni.bridge.service.OmniNotificationService

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            OmniBridgeTheme {
                MainScreen(
                    app = OmniBridgeApp.get(this),
                    onGrantNotificationAccess = ::openNotificationListenerSettings,
                    onPair = { startActivity(Intent(this, PairingActivity::class.java)) },
                    onUnpair = {
                        OmniConnectionService.stop(this)
                        OmniBridgeApp.get(this).sessionStore.clearSession()
                    },
                )
            }
        }
        // Auto-start connection service if already paired
        if (OmniBridgeApp.get(this).sessionStore.isPaired) {
            OmniConnectionService.start(this)
        }
    }

    private fun openNotificationListenerSettings() {
        startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
    }
}

@Composable
fun MainScreen(
    app: OmniBridgeApp,
    onGrantNotificationAccess: () -> Unit,
    onPair: () -> Unit,
    onUnpair: () -> Unit,
) {
    val session = app.sessionStore
    var isConnected by remember { mutableStateOf(app.webSocketClient.isConnected()) }
    val isPaired = session.isPaired
    val hasNotificationAccess = remember { mutableStateOf(false) }

    val background = Brush.verticalGradient(
        listOf(Color(0xFF0D1117), Color(0xFF161B22))
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(brush = background)
            .padding(24.dp),
    ) {
        Column(
            modifier = Modifier.align(Alignment.TopStart),
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            Spacer(Modifier.height(32.dp))

            // ── Header ─────────────────────────────────────────────────────
            Text(
                text = "Omni Bridge",
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
            )
            Text(
                text = "Routes your messages through Omni AI",
                fontSize = 14.sp,
                color = Color(0xFF8B949E),
            )

            HorizontalDivider(color = Color(0xFF30363D))

            // ── Status card ────────────────────────────────────────────────
            StatusCard(
                isPaired = isPaired,
                isConnected = isConnected,
                userEmail = session.userEmail,
                serverUrl = session.serverUrl,
            )

            // ── Notification access ────────────────────────────────────────
            SectionCard(
                title = "Notification Access",
                subtitle = "Required to intercept WhatsApp, Instagram, and Messenger messages",
            ) {
                Button(
                    onClick = onGrantNotificationAccess,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF238636)),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Open Notification Settings")
                }
            }

            // ── Pairing ────────────────────────────────────────────────────
            SectionCard(
                title = if (isPaired) "Device Paired" else "Pair This Device",
                subtitle = if (isPaired)
                    "Connected to ${session.serverUrl ?: "your Omni server"}"
                else
                    "Link this phone to your Omni account",
            ) {
                if (isPaired) {
                    OutlinedButton(
                        onClick = onUnpair,
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFF85149)),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Unpair Device")
                    }
                } else {
                    Button(
                        onClick = onPair,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Pair with Omni Account")
                    }
                }
            }

            // ── Supported platforms ────────────────────────────────────────
            SectionCard(title = "Monitored Apps", subtitle = null) {
                val platforms = listOf(
                    "WhatsApp & WhatsApp Business",
                    "Facebook Messenger",
                    "Instagram Direct",
                    "SMS (Google Messages, Samsung)",
                )
                platforms.forEach { platform ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(vertical = 4.dp),
                    ) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .background(Color(0xFF3FB950), RoundedCornerShape(50)),
                        )
                        Spacer(Modifier.width(12.dp))
                        Text(platform, color = Color(0xFFE6EDF3), fontSize = 14.sp)
                    }
                }
            }
        }
    }
}

@Composable
fun StatusCard(
    isPaired: Boolean,
    isConnected: Boolean,
    userEmail: String?,
    serverUrl: String?,
) {
    val statusColor = when {
        !isPaired -> Color(0xFFF85149)
        isConnected -> Color(0xFF3FB950)
        else -> Color(0xFFD29922)
    }
    val statusText = when {
        !isPaired -> "Not paired"
        isConnected -> "Connected"
        else -> "Reconnecting…"
    }

    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF21262D)),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(12.dp)
                    .background(statusColor, RoundedCornerShape(50))
            )
            Spacer(Modifier.width(12.dp))
            Column {
                Text(statusText, color = Color.White, fontWeight = FontWeight.SemiBold)
                if (userEmail != null) {
                    Text(userEmail, color = Color(0xFF8B949E), fontSize = 12.sp)
                }
                if (serverUrl != null) {
                    Text(serverUrl, color = Color(0xFF8B949E), fontSize = 11.sp)
                }
            }
        }
    }
}

@Composable
fun SectionCard(title: String, subtitle: String?, content: @Composable ColumnScope.() -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF21262D)),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(title, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            if (subtitle != null) {
                Text(subtitle, color = Color(0xFF8B949E), fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp, bottom = 12.dp))
            } else {
                Spacer(Modifier.height(12.dp))
            }
            content()
        }
    }
}

@Composable
fun OmniBridgeTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(),
        content = content,
    )
}
