package com.omni.bridge.ui

import android.content.Intent
import android.graphics.Bitmap
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.view.ViewGroup
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.omni.bridge.OmniBridgeApp
import com.omni.bridge.service.OmniConnectionService
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            OmniBridgeTheme {
                OmniAppMaster(
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

// ── Master Navigation Router ──────────────────────────────────────────────────

@Composable
fun OmniAppMaster(
    app: OmniBridgeApp,
    onGrantNotificationAccess: () -> Unit,
    onOpenPairingScreen: () -> Unit,
) {
    val session = app.sessionStore
    var isPaired by remember { mutableStateOf(session.isPaired) }

    if (!isPaired) {
        LoginAndPairScreen(
            app = app,
            onPairedSuccess = { isPaired = true },
            onOpenPairingScreen = onOpenPairingScreen
        )
    } else {
        OmniMobileHub(
            app = app,
            onGrantNotificationAccess = onGrantNotificationAccess,
            onDisconnect = { isPaired = false }
        )
    }
}

// ── 1. Full Mobile Hub Screen with 3D Navigation & Embedded Web Suite ─────────

enum class HubTab(val title: String, val path: String, val iconText: String) {
    INBOX("Inbox", "/inbox", "💬"),
    AUTOMATION("Automation", "/automation", "⚡"),
    PLATFORMS("Platforms", "/platforms", "📱"),
    SHOWCASE_3D("3D Hub", "/", "✨"),
}

@Composable
fun OmniMobileHub(
    app: OmniBridgeApp,
    onGrantNotificationAccess: () -> Unit,
    onDisconnect: () -> Unit,
) {
    val context = LocalContext.current
    val session = app.sessionStore
    var selectedTab by remember { mutableStateOf(HubTab.INBOX) }
    var webViewInstance by remember { mutableStateOf<WebView?>(null) }
    var showBridgeModal by remember { mutableStateOf(false) }
    var isPageLoading by remember { mutableStateOf(false) }

    val rawServerUrl = session.serverUrl ?: "http://192.168.0.100:8000"
    val jwtToken = session.jwtToken ?: ""

    // Calculate web dashboard URL (frontend typically on :5173 if backend is on :8000)
    val webBaseUrl = remember(rawServerUrl) {
        val clean = rawServerUrl.trimEnd('/')
        if (clean.endsWith(":8000")) {
            clean.replace(":8000", ":5173")
        } else {
            clean
        }
    }

    // Handle Android system back press inside WebView
    BackHandler(enabled = webViewInstance?.canGoBack() == true) {
        webViewInstance?.goBack()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF07090E))
    ) {
        Column(modifier = Modifier.fillMaxSize()) {

            // ── Modern Top Navigation Bar ────────────────────────────────────
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF0D1117))
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .background(
                                brush = Brush.linearGradient(listOf(Color(0xFFDC2626), Color(0xFF991B1B))),
                                shape = RoundedCornerShape(8.dp)
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("Ω", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    }
                    Column {
                        Text(
                            text = "Omni Mobile",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                        Text(
                            text = selectedTab.title,
                            color = Color(0xFFDC2626),
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 11.sp
                        )
                    }
                }

                // Status & Management Pill
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(Color(0xFF161B22))
                            .border(1.dp, Color(0xFF30363D), RoundedCornerShape(20.dp))
                            .clickable { showBridgeModal = true }
                            .padding(horizontal = 10.dp, vertical = 5.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(7.dp)
                                    .background(Color(0xFF22C55E), CircleShape)
                            )
                            Text("Bridge Active", color = Color(0xFFE6EDF3), fontSize = 11.sp, fontWeight = FontWeight.Medium)
                        }
                    }

                    // Reload page button
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF161B22))
                            .clickable { webViewInstance?.reload() },
                        contentAlignment = Alignment.Center
                    ) {
                        Text("↻", color = Color(0xFF8B949E), fontSize = 14.sp)
                    }
                }
            }

            // Loading bar
            if (isPageLoading) {
                LinearProgressIndicator(
                    modifier = Modifier.fillMaxWidth().height(2.dp),
                    color = Color(0xFFDC2626),
                    trackColor = Color.Transparent
                )
            }

            // ── Hardware Accelerated WebView Container ───────────────────────
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            ) {
                AndroidView(
                    factory = { ctx ->
                        WebView(ctx).apply {
                            layoutParams = ViewGroup.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT
                            )
                            setLayerType(View.LAYER_TYPE_HARDWARE, null)
                            settings.apply {
                                javaScriptEnabled = true
                                domStorageEnabled = true
                                databaseEnabled = true
                                useWideViewPort = true
                                loadWithOverviewMode = true
                                allowFileAccess = true
                                allowContentAccess = true
                                cacheMode = WebSettings.LOAD_DEFAULT
                            }

                            webViewClient = object : WebViewClient() {
                                override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                                    isPageLoading = true
                                    super.onPageStarted(view, url, favicon)
                                }

                                override fun onPageFinished(view: WebView?, url: String?) {
                                    isPageLoading = false
                                    // Inject auth token and mobile styling class
                                    view?.evaluateJavascript(
                                        """
                                        (function() {
                                            try {
                                                if ('$jwtToken' && '$jwtToken'.length > 5) {
                                                    localStorage.setItem('omni_token', '$jwtToken');
                                                }
                                                document.body.classList.add('in-android-app');
                                            } catch(e) {}
                                        })();
                                        """.trimIndent(),
                                        null
                                    )
                                    super.onPageFinished(view, url)
                                }
                            }

                            val initialUrl = "$webBaseUrl${selectedTab.path}"
                            loadUrl(initialUrl)
                            webViewInstance = this
                        }
                    },
                    modifier = Modifier.fillMaxSize()
                )
            }

            // ── 3D Floating Bottom Navigation Bar ────────────────────────────
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF07090E))
                    .padding(horizontal = 14.dp, vertical = 8.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .shadow(elevation = 12.dp, shape = RoundedCornerShape(24.dp))
                        .background(Color(0xFF111622), RoundedCornerShape(24.dp))
                        .border(1.dp, Color(0xFF263044), RoundedCornerShape(24.dp))
                        .padding(horizontal = 6.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceAround,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    HubTab.entries.forEach { tab ->
                        val isSelected = selectedTab == tab
                        val scale by animateFloatAsState(
                            targetValue = if (isSelected) 1.05f else 0.95f,
                            animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy),
                            label = "tab_scale"
                        )
                        val pillColor by animateColorAsState(
                            targetValue = if (isSelected) Color(0xFFDC2626) else Color.Transparent,
                            label = "tab_color"
                        )

                        Box(
                            modifier = Modifier
                                .scale(scale)
                                .clip(RoundedCornerShape(18.dp))
                                .background(pillColor)
                                .clickable {
                                    selectedTab = tab
                                    val targetUrl = "$webBaseUrl${tab.path}"
                                    webViewInstance?.loadUrl(targetUrl)
                                }
                                .padding(horizontal = 14.dp, vertical = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text(tab.iconText, fontSize = 16.sp)
                                if (isSelected) {
                                    Text(
                                        text = tab.title,
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 12.sp
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // ── Bridge Diagnostics & Settings Sheet ───────────────────────────────
        if (showBridgeModal) {
            AlertDialog(
                onDismissRequest = { showBridgeModal = false },
                confirmButton = {
                    TextButton(onClick = { showBridgeModal = false }) {
                        Text("Close", color = Color(0xFF58A6FF))
                    }
                },
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text("📱", fontSize = 18.sp)
                        Text("Android Bridge Status", fontWeight = FontWeight.Bold, color = Color.White)
                    }
                },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        Text(
                            "The bridge service runs in the background to automatically intercept incoming WhatsApp, Messenger, and Instagram notifications and route replies.",
                            fontSize = 12.sp,
                            color = Color(0xFF8B949E),
                            lineHeight = 16.sp
                        )

                        // Notification access button
                        Button(
                            onClick = {
                                onGrantNotificationAccess()
                                showBridgeModal = false
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF238636)),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Check Notification Access", fontSize = 12.sp)
                        }

                        // Disconnect & Unlink
                        OutlinedButton(
                            onClick = {
                                OmniConnectionService.stop(context)
                                session.clearSession()
                                onDisconnect()
                                showBridgeModal = false
                                Toast.makeText(context, "Device unlinked", Toast.LENGTH_SHORT).show()
                            },
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFF85149)),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Disconnect & Log Out", fontSize = 12.sp)
                        }
                    }
                },
                containerColor = Color(0xFF161B22),
                shape = RoundedCornerShape(16.dp)
            )
        }
    }
}

// ── 2. Sleek Dark 3D Login & Sign Up Screen ───────────────────────────────────

@Composable
fun LoginAndPairScreen(
    app: OmniBridgeApp,
    onPairedSuccess: () -> Unit,
    onOpenPairingScreen: () -> Unit,
) {
    val context = LocalContext.current
    val session = app.sessionStore
    val scope = rememberCoroutineScope()

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
            // App Header
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

            // Auth Card
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
                        text = "Log in with your Omni account to instantly link this phone and unlock the full inbox, autopilot rules, and 3D visual hub.",
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

                    Button(
                        onClick = {
                            if (email.isBlank() || password.isBlank()) {
                                authError = "Please enter both email and password."
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
                                            userEmail = email.trim(),
                                            jwtToken = authResult.token
                                        )
                                        OmniConnectionService.start(context)
                                        Toast.makeText(context, "Phone linked successfully!", Toast.LENGTH_SHORT).show()
                                        onPairedSuccess()
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
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center
                    ) {
                        TextButton(onClick = {
                            isSignUpMode = !isSignUpMode
                            authError = null
                        }) {
                            Text(
                                text = if (isSignUpMode) "Already have an account? Sign In" else "Don't have an account? Sign Up",
                                color = Color(0xFF58A6FF),
                                fontSize = 12.sp
                            )
                        }
                    }

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
        }
    }
}

@Composable
fun OmniBridgeTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            background = Color(0xFF07090E),
            surface = Color(0xFF111622),
            primary = Color(0xFFDC2626),
            onPrimary = Color.White,
        ),
        content = content
    )
}

