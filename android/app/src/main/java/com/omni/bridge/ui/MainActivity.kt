package com.omni.bridge.ui

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.omni.bridge.OmniBridgeApp
import com.omni.bridge.service.OmniConnectionService
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            OmniBridgeTheme {
                MainScreen(
                    app = OmniBridgeApp.get(this),
                    onGrantNotificationAccess = ::openNotificationListenerSettings,
                    onOpenPairingScreen = { startActivity(Intent(this, PairingActivity::class.java)) },
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
    onOpenPairingScreen: () -> Unit,
) {
    val context = LocalContext.current
    val session = app.sessionStore
    val scope = rememberCoroutineScope()

    var isPaired by remember { mutableStateOf(session.isPaired) }
    var isConnected by remember { mutableStateOf(app.webSocketClient.isConnected()) }

    // Direct Login / Sign Up Form State
    var serverUrl by remember { mutableStateOf(session.serverUrl ?: "http://192.168.0.100:8000") }
    var email by remember { mutableStateOf(session.userEmail ?: "") }
    var password by remember { mutableStateOf("") }
    var fullName by remember { mutableStateOf("") }
    var isSignUpMode by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var authError by remember { mutableStateOf<String?>(null) }

    val background = Brush.verticalGradient(
        listOf(Color(0xFF07090E), Color(0xFF0F141F), Color(0xFF161C2A))
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(brush = background)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 32.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            // ── App Header ─────────────────────────────────────────────────
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .background(
                                brush = Brush.linearGradient(listOf(Color(0xFFDC2626), Color(0xFF991B1B))),
                                shape = RoundedCornerShape(10.dp)
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("Ω", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                    }
                    Column {
                        Text("Omni Bridge", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        Text("Native Android Message Relay", fontSize = 12.sp, color = Color(0xFF8B949E))
                    }
                }
            }

            HorizontalDivider(color = Color(0xFF21262D))

            if (!isPaired) {
                // ── Direct Login & Link Form ────────────────────────────────
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF0F141E)),
                    shape = RoundedCornerShape(16.dp),
                    border = CardDefaults.outlinedCardBorder().copy(brush = Brush.linearGradient(listOf(Color(0xFFDC2626).copy(alpha = 0.4f), Color(0xFF30363D))))
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Text(
                            text = if (isSignUpMode) "Create Omni Account" else "Sign In to Omni",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = "Log in with your Omni account to instantly link this phone. No QR codes or manual tokens needed.",
                            fontSize = 12.sp,
                            color = Color(0xFF8B949E),
                            lineHeight = 16.sp
                        )

                        authError?.let { err ->
                            Card(
                                colors = CardDefaults.cardColors(containerColor = Color(0xFF3B1219)),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = err,
                                    color = Color(0xFFFCA5A5),
                                    fontSize = 12.sp,
                                    modifier = Modifier.padding(10.dp)
                                )
                            }
                        }

                        // Server URL
                        OutlinedTextField(
                            value = serverUrl,
                            onValueChange = { serverUrl = it },
                            label = { Text("Omni Server URL", fontSize = 12.sp) },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color(0xFFDC2626),
                                unfocusedBorderColor = Color(0xFF30363D),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedLabelColor = Color(0xFFDC2626),
                                unfocusedLabelColor = Color(0xFF8B949E)
                            )
                        )

                        if (isSignUpMode) {
                            // Full Name
                            OutlinedTextField(
                                value = fullName,
                                onValueChange = { fullName = it },
                                label = { Text("Full Name", fontSize = 12.sp) },
                                modifier = Modifier.fillMaxWidth(),
                                singleLine = true,
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = Color(0xFFDC2626),
                                    unfocusedBorderColor = Color(0xFF30363D),
                                    focusedTextColor = Color.White,
                                    unfocusedTextColor = Color.White,
                                    focusedLabelColor = Color(0xFFDC2626),
                                    unfocusedLabelColor = Color(0xFF8B949E)
                                )
                            )
                        }

                        // Email
                        OutlinedTextField(
                            value = email,
                            onValueChange = { email = it },
                            label = { Text("Email", fontSize = 12.sp) },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color(0xFFDC2626),
                                unfocusedBorderColor = Color(0xFF30363D),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedLabelColor = Color(0xFFDC2626),
                                unfocusedLabelColor = Color(0xFF8B949E)
                            )
                        )

                        // Password
                        OutlinedTextField(
                            value = password,
                            onValueChange = { password = it },
                            label = { Text("Password", fontSize = 12.sp) },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            visualTransformation = PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color(0xFFDC2626),
                                unfocusedBorderColor = Color(0xFF30363D),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedLabelColor = Color(0xFFDC2626),
                                unfocusedLabelColor = Color(0xFF8B949E)
                            )
                        )

                        // Action Button
                        Button(
                            onClick = {
                                if (email.isBlank() || password.isBlank()) {
                                    authError = "Please enter both email and password"
                                    return@Button
                                }
                                isLoading = true
                                authError = null

                                scope.launch {
                                    val authResult = if (isSignUpMode) {
                                        app.apiClient.signup(serverUrl.trimEnd('/'), fullName.ifBlank { "User" }, email.trim(), password)
                                    } else {
                                        app.apiClient.login(serverUrl.trimEnd('/'), email.trim(), password)
                                    }

                                    if (authResult.token != null) {
                                        val deviceName = "${Build.MANUFACTURER} ${Build.MODEL} Bridge"
                                        val reg = app.apiClient.registerDevice(serverUrl.trimEnd('/'), authResult.token, deviceName)
                                        if (reg != null) {
                                            session.saveSession(
                                                serverUrl = serverUrl.trimEnd('/'),
                                                deviceId = reg.device_id,
                                                deviceSecret = reg.device_secret,
                                                userEmail = email.trim()
                                            )
                                            OmniConnectionService.start(context)
                                            isPaired = true
                                            isConnected = true
                                            Toast.makeText(context, "Phone linked successfully!", Toast.LENGTH_SHORT).show()
                                        } else {
                                            authError = "Authenticated, but failed to register device. Check server."
                                        }
                                    } else {
                                        authError = authResult.errorMessage ?: if (isSignUpMode) "Signup failed." else "Login failed."
                                    }
                                    isLoading = false
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.fillMaxWidth(),
                            enabled = !isLoading
                        ) {
                            Text(
                                text = if (isLoading) "Connecting…" else if (isSignUpMode) "Sign Up & Link Phone" else "Sign In & Link Phone",
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }

                        // Toggle Mode
                        TextButton(
                            onClick = { isSignUpMode = !isSignUpMode; authError = null },
                            modifier = Modifier.align(Alignment.CenterHorizontally)
                        ) {
                            Text(
                                text = if (isSignUpMode) "Already have an account? Sign In" else "Don't have an account? Sign Up",
                                fontSize = 12.sp,
                                color = Color(0xFFF87171)
                            )
                        }

                        HorizontalDivider(color = Color(0xFF21262D))

                        OutlinedButton(
                            onClick = onOpenPairingScreen,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFF8B949E))
                        ) {
                            Text("Or Pair with QR Code / Link", fontSize = 12.sp)
                        }
                    }
                }
            } else {
                // ── Device Connected Dashboard ──────────────────────────────
                StatusCard(
                    isPaired = true,
                    isConnected = isConnected,
                    userEmail = session.userEmail,
                    serverUrl = session.serverUrl,
                )

                // ── Notification Access Card ────────────────────────────────
                SectionCard(
                    title = "Notification Interception",
                    subtitle = "Required to capture WhatsApp, Messenger, and Instagram messages and enable direct native reply.",
                ) {
                    Button(
                        onClick = onGrantNotificationAccess,
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF238636)),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Grant Notification Permission", fontWeight = FontWeight.SemiBold)
                    }
                }

                // ── Unpair / Disconnect ─────────────────────────────────────
                SectionCard(
                    title = "Device Management",
                    subtitle = "Linked to ${session.serverUrl}",
                ) {
                    OutlinedButton(
                        onClick = {
                            OmniConnectionService.stop(context)
                            session.clearSession()
                            isPaired = false
                            isConnected = false
                            Toast.makeText(context, "Device unlinked", Toast.LENGTH_SHORT).show()
                        },
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFF85149)),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Disconnect & Log Out")
                    }
                }
            }

            // ── Monitored Platforms ────────────────────────────────────────
            SectionCard(title = "Monitored Platforms", subtitle = "Automated background message routing") {
                val platforms = listOf(
                    "WhatsApp & WhatsApp Business" to Color(0xFF25D366),
                    "Facebook Messenger" to Color(0xFF0084FF),
                    "Instagram Direct" to Color(0xFFE1306C),
                    "SMS (Android Messages)" to Color(0xFF38BDF8),
                )
                platforms.forEach { (platform, color) ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(vertical = 4.dp),
                    ) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .background(color, RoundedCornerShape(50))
                        )
                        Spacer(Modifier.width(10.dp))
                        Text(platform, fontSize = 13.sp, color = Color.White)
                    }
                }
            }
        }
    }
}

// ── Status card ───────────────────────────────────────────────────────────────

@Composable
fun StatusCard(
    isPaired: Boolean,
    isConnected: Boolean,
    userEmail: String?,
    serverUrl: String?,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF161B22)),
        shape = RoundedCornerShape(14.dp),
        border = CardDefaults.outlinedCardBorder(),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Connection Status", fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Color.White)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .background(
                                color = if (isConnected) Color(0xFF3FB950) else Color(0xFFD29922),
                                shape = RoundedCornerShape(50),
                            ),
                    )
                    Text(
                        text = if (isConnected) "Active (Online)" else "Connecting…",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        color = if (isConnected) Color(0xFF3FB950) else Color(0xFFD29922),
                    )
                }
            }

            userEmail?.let { email ->
                Row(
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("User Account", fontSize = 12.sp, color = Color(0xFF8B949E))
                    Text(email, fontSize = 12.sp, color = Color.White)
                }
            }

            serverUrl?.let { url ->
                Row(
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Server Endpoint", fontSize = 12.sp, color = Color(0xFF8B949E))
                    Text(url, fontSize = 12.sp, color = Color(0xFF58A6FF))
                }
            }
        }
    }
}

// ── Reusable section card ─────────────────────────────────────────────────────

@Composable
fun SectionCard(
    title: String,
    subtitle: String?,
    content: @Composable ColumnScope.() -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF161B22)),
        shape = RoundedCornerShape(14.dp),
        border = CardDefaults.outlinedCardBorder(),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Color.White)
            subtitle?.let {
                Text(it, fontSize = 12.sp, color = Color(0xFF8B949E))
            }
            Spacer(Modifier.height(4.dp))
            content()
        }
    }
}

// ── Theme ─────────────────────────────────────────────────────────────────────

@Composable
fun OmniBridgeTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Color(0xFFDC2626),
            secondary = Color(0xFF58A6FF),
            background = Color(0xFF07090E),
            surface = Color(0xFF161B22),
            onPrimary = Color.White,
            onSecondary = Color.White,
            onBackground = Color.White,
            onSurface = Color.White,
        ),
        content = content,
    )
}
