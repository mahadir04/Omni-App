package com.omni.bridge.ui

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
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
import com.omni.bridge.data.OmniApiClient
import com.omni.bridge.service.OmniConnectionService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Checks whether this app has been granted Notification Listener permission by the user.
 */
fun isNotificationListenerEnabled(context: Context): Boolean {
    val pkgName = context.packageName
    val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
    return !flat.isNullOrBlank() && flat.contains(pkgName)
}

/**
 * Opens system application details settings (needed on Xiaomi/MIUI to unlock "Restricted Settings" & Autostart).
 */
fun openAppDetailsSettings(context: Context) {
    runCatching {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.fromParts("package", context.packageName, null)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        context.startActivity(intent)
    }.onFailure {
        Toast.makeText(context, "Could not open settings", Toast.LENGTH_SHORT).show()
    }
}

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
            onDisconnect = { isPaired = false },
            onOpenPairingScreen = onOpenPairingScreen
        )
    }
}

// ── 1. Full Mobile Hub Screen with 3D Navigation & Embedded Web Suite ─────────

enum class HubTab(val title: String, val path: String, val iconText: String) {
    INBOX("Inbox", "/inbox", "💬"),
    AUTOMATION("Automation", "/automation", "⚡"),
    PLATFORMS("Platforms", "/platforms", "📱"),
    DEVICE_BRIDGE("Bridge", "bridge_native", "📲"),
    SHOWCASE_3D("3D Hub", "/", "✨"),
}

@Composable
fun OmniMobileHub(
    app: OmniBridgeApp,
    onGrantNotificationAccess: () -> Unit,
    onDisconnect: () -> Unit,
    onOpenPairingScreen: () -> Unit,
) {
    val context = LocalContext.current
    val session = app.sessionStore
    var selectedTab by remember { mutableStateOf(HubTab.INBOX) }
    var webViewInstance by remember { mutableStateOf<WebView?>(null) }
    var isPageLoading by remember { mutableStateOf(false) }

    // Re-check notification permission dynamically
    var hasNotificationAccess by remember { mutableStateOf(isNotificationListenerEnabled(context)) }

    val rawServerUrl = session.serverUrl ?: "http://192.168.0.100:8000"
    val jwtToken = session.jwtToken ?: ""

    // Calculate web dashboard URL (frontend on :5173 if backend is on :8000)
    val webBaseUrl = remember(rawServerUrl) {
        val clean = rawServerUrl.trimEnd('/')
        if (clean.endsWith(":8000")) {
            clean.replace(":8000", ":5173")
        } else {
            clean
        }
    }

    // Handle Android system back press inside WebView
    BackHandler(enabled = webViewInstance?.canGoBack() == true && selectedTab != HubTab.DEVICE_BRIDGE) {
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

                // Status & Management Pill (Clickable directly opens Device Bridge)
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val isGranted = isNotificationListenerEnabled(context)
                    hasNotificationAccess = isGranted

                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(if (isGranted) Color(0xFF161B22) else Color(0xFF3B1812))
                            .border(
                                1.dp,
                                if (isGranted) Color(0xFF30363D) else Color(0xFFF85149),
                                RoundedCornerShape(20.dp)
                            )
                            .clickable { selectedTab = HubTab.DEVICE_BRIDGE }
                            .padding(horizontal = 10.dp, vertical = 5.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(7.dp)
                                    .background(
                                        if (isGranted) Color(0xFF22C55E) else Color(0xFFF85149),
                                        CircleShape
                                    )
                            )
                            Text(
                                text = if (isGranted) "Bridge Connected" else "Access Missing",
                                color = if (isGranted) Color(0xFFE6EDF3) else Color(0xFFFF7B72),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }

                    // Reload page button (only when viewing web view)
                    if (selectedTab != HubTab.DEVICE_BRIDGE) {
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
            }

            // Loading bar
            if (isPageLoading && selectedTab != HubTab.DEVICE_BRIDGE) {
                LinearProgressIndicator(
                    modifier = Modifier.fillMaxWidth().height(2.dp),
                    color = Color(0xFFDC2626),
                    trackColor = Color.Transparent
                )
            }

            // ── Main Content Area: Native Bridge Screen OR Hardware Accelerated WebView ──
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            ) {
                if (selectedTab == HubTab.DEVICE_BRIDGE) {
                    // Dedicated Native Phone Connection & Diagnostics Screen
                    DeviceBridgeScreen(
                        app = app,
                        onGrantNotificationAccess = onGrantNotificationAccess,
                        onDisconnect = onDisconnect,
                        onOpenPairingScreen = onOpenPairingScreen,
                        onNavigateToInbox = { selectedTab = HubTab.INBOX }
                    )
                } else {
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
                                    mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                                    cacheMode = WebSettings.LOAD_DEFAULT
                                    userAgentString = "${settings.userAgentString} OmniAndroidApp/1.0"
                                }

                                webViewClient = object : WebViewClient() {
                                    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                                        isPageLoading = true
                                        // Immediately hide web sidebar inside Android WebView
                                        view?.evaluateJavascript(
                                            """
                                            (function() {
                                                try {
                                                    document.body.classList.add('in-android-app');
                                                    var s = document.getElementById('omni-hide-sidebar');
                                                    if (!s) {
                                                        s = document.createElement('style');
                                                        s.id = 'omni-hide-sidebar';
                                                        s.innerHTML = '.sidebar { display: none !important; }';
                                                        document.head.appendChild(s);
                                                    }
                                                } catch(e) {}
                                            })();
                                            """.trimIndent(),
                                            null
                                        )
                                    }

                                    override fun onPageFinished(view: WebView?, url: String?) {
                                        isPageLoading = false
                                        // Hide web sidebar & auto-inject JWT token for seamless Single Sign-On
                                        view?.evaluateJavascript(
                                            """
                                            (function() {
                                                try {
                                                    document.body.classList.add('in-android-app');
                                                    var s = document.getElementById('omni-hide-sidebar');
                                                    if (!s) {
                                                        s = document.createElement('style');
                                                        s.id = 'omni-hide-sidebar';
                                                        s.innerHTML = '.sidebar { display: none !important; }';
                                                        document.head.appendChild(s);
                                                    }
                                                    if ('$jwtToken' && !localStorage.getItem('omni_token')) {
                                                        localStorage.setItem('omni_token', '$jwtToken');
                                                        console.log('Omni token injected successfully');
                                                    }
                                                } catch(e) { console.error(e); }
                                            })();
                                            """.trimIndent(),
                                            null
                                        )
                                    }
                                }

                                webViewInstance = this
                                loadUrl("$webBaseUrl${selectedTab.path}")
                            }
                        },
                        update = { webView ->
                            val targetUrl = "$webBaseUrl${selectedTab.path}"
                            if (webView.url != targetUrl) {
                                webView.loadUrl(targetUrl)
                            }
                        },
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }

            // ── Floating 3D Bottom Navigation Bar ────────────────────────────
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF07090E))
                    .padding(horizontal = 12.dp, vertical = 8.dp)
            ) {
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .shadow(
                            elevation = 16.dp,
                            shape = RoundedCornerShape(22.dp),
                            ambientColor = Color(0xFFDC2626).copy(alpha = 0.25f),
                            spotColor = Color(0xFFDC2626).copy(alpha = 0.4f)
                        )
                        .border(
                            width = 1.dp,
                            brush = Brush.horizontalGradient(
                                listOf(
                                    Color(0xFFDC2626).copy(alpha = 0.5f),
                                    Color(0xFF30363D),
                                    Color(0xFFDC2626).copy(alpha = 0.5f)
                                )
                            ),
                            shape = RoundedCornerShape(22.dp)
                        ),
                    shape = RoundedCornerShape(22.dp),
                    color = Color(0xFF0F141F).copy(alpha = 0.95f)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 6.dp, horizontal = 4.dp),
                        horizontalArrangement = Arrangement.SpaceAround,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        HubTab.values().forEach { tab ->
                            val isSelected = selectedTab == tab
                            val scale by animateFloatAsState(
                                targetValue = if (isSelected) 1.08f else 1.0f,
                                animationSpec = spring(
                                    dampingRatio = Spring.DampingRatioMediumBouncy,
                                    stiffness = Spring.StiffnessLow
                                ),
                                label = "tabScale"
                            )
                            val containerBg by animateColorAsState(
                                targetValue = if (isSelected) Color(0xFFDC2626).copy(alpha = 0.2f) else Color.Transparent,
                                label = "tabBg"
                            )

                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(2.dp),
                                modifier = Modifier
                                    .scale(scale)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(containerBg)
                                    .clickable { selectedTab = tab }
                                    .padding(horizontal = 10.dp, vertical = 6.dp)
                            ) {
                                Text(
                                    text = tab.iconText,
                                    fontSize = 18.sp
                                )
                                Text(
                                    text = tab.title,
                                    color = if (isSelected) Color.White else Color(0xFF8B949E),
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                    fontSize = 10.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

// ── 2. Dedicated Native Device Bridge & Connection Center ────────────────────

@Composable
fun DeviceBridgeScreen(
    app: OmniBridgeApp,
    onGrantNotificationAccess: () -> Unit,
    onDisconnect: () -> Unit,
    onOpenPairingScreen: () -> Unit,
    onNavigateToInbox: () -> Unit,
) {
    val context = LocalContext.current
    val session = app.sessionStore
    val scope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    var isSendingTest by remember { mutableStateOf(false) }
    var testResult by remember { mutableStateOf<String?>(null) }
    var isCheckingAccess by remember { mutableStateOf(false) }

    val hasAccess = isNotificationListenerEnabled(context)
    val isWsConnected = app.webSocketClient.isConnected()
    val deviceName = "${Build.MANUFACTURER} ${Build.MODEL}"

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF07090E))
            .verticalScroll(scrollState)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {

        // ── Card 1: Connection Health Banner ──────────────────────────────────
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .border(
                    1.dp,
                    if (hasAccess && isWsConnected) Color(0xFF22C55E).copy(alpha = 0.5f) else Color(0xFFDC2626).copy(alpha = 0.6f),
                    RoundedCornerShape(16.dp)
                ),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F141F)),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(12.dp)
                            .background(
                                if (hasAccess && isWsConnected) Color(0xFF22C55E) else Color(0xFFF85149),
                                CircleShape
                            )
                    )
                    Column {
                        Text(
                            text = if (hasAccess) "Phone Bridge Ready" else "Notification Permission Required",
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            fontSize = 16.sp
                        )
                        Text(
                            text = if (hasAccess) "Actively listening for WhatsApp, Messenger & SMS" else "Android is blocking message interception",
                            color = Color(0xFF8B949E),
                            fontSize = 12.sp
                        )
                    }
                }

                HorizontalDivider(color = Color(0xFF21262D))

                // Metadata Rows
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Device:", color = Color(0xFF8B949E), fontSize = 12.sp)
                    Text(deviceName, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Logged In Email:", color = Color(0xFF8B949E), fontSize = 12.sp)
                    Text(session.userEmail ?: "Unknown", color = Color(0xFF58A6FF), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Server Endpoint:", color = Color(0xFF8B949E), fontSize = 12.sp)
                    Text(session.serverUrl ?: "None", color = Color(0xFFE6EDF3), fontSize = 11.sp)
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("WebSocket Live Stream:", color = Color(0xFF8B949E), fontSize = 12.sp)
                    Text(
                        if (isWsConnected) "Connected 🟢" else "Reconnecting 🟡",
                        color = if (isWsConnected) Color(0xFF22C55E) else Color(0xFFE3B341),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }

        // ── Card 2: Essential Permissions & Xiaomi Setup ─────────────────────
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, Color(0xFF30363D), RoundedCornerShape(16.dp)),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F141F)),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = "⚙️ System Permissions",
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    fontSize = 15.sp
                )

                // 1. Notification Access Button
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Notification Listener", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                        Text(
                            text = if (hasAccess) "Granted ✅ — Omni can read chats" else "Required to intercept incoming chats",
                            color = if (hasAccess) Color(0xFF22C55E) else Color(0xFFF85149),
                            fontSize = 11.sp
                        )
                    }
                    Button(
                        onClick = onGrantNotificationAccess,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (hasAccess) Color(0xFF21262D) else Color(0xFFDC2626)
                        ),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(if (hasAccess) "Check" else "Grant Access", fontSize = 12.sp)
                    }
                }

                // 2. Xiaomi / HyperOS Restricted Settings Helper
                Surface(
                    color = Color(0xFF161B22),
                    shape = RoundedCornerShape(10.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF30363D))
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "💡 Xiaomi / HyperOS / MIUI Instructions:",
                            color = Color(0xFFE3B341),
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp
                        )
                        Text(
                            text = "If Android shows 'Restricted setting' when granting Notification Access:\n" +
                                    "1. Tap 'Open Xiaomi App Settings' below\n" +
                                    "2. Scroll down & tap 'Allow restricted settings'\n" +
                                    "3. Turn ON 'Autostart' & set Battery to 'No restrictions'\n" +
                                    "4. Return and grant 'Notification Access'.",
                            color = Color(0xFF8B949E),
                            fontSize = 11.sp,
                            lineHeight = 15.sp
                        )
                        Button(
                            onClick = { openAppDetailsSettings(context) },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF30363D)),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Open Xiaomi App Settings", fontSize = 12.sp, color = Color.White)
                        }
                    }
                }
            }
        }

        // ── Card 3: Test Message Dispatcher (Instant Verification) ────────────
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, Color(0xFF30363D), RoundedCornerShape(16.dp)),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F141F)),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "🧪 Live End-to-End Test",
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    fontSize = 15.sp
                )
                Text(
                    text = "Sends a simulated WhatsApp notification directly from this phone into your Omni database. It will immediately appear in your Inbox!",
                    color = Color(0xFF8B949E),
                    fontSize = 12.sp,
                    lineHeight = 16.sp
                )

                Button(
                    onClick = {
                        isSendingTest = true
                        testResult = null
                        scope.launch {
                            val payload = OmniApiClient.MessagePayload(
                                device_id = session.deviceId ?: "",
                                device_secret = session.deviceSecret ?: "",
                                platform = "whatsapp",
                                sender_name = "Omni Phone Bridge",
                                sender_handle = "+8801700000000",
                                content = "Test from ${Build.MODEL}! Phone bridge is connected and syncing perfectly.",
                                notification_key = "test_ping_${System.currentTimeMillis()}",
                                app_package = "com.whatsapp",
                                timestamp_ms = System.currentTimeMillis(),
                            )
                            val ok = app.apiClient.sendMessage(payload)
                            isSendingTest = false
                            if (ok) {
                                testResult = "Success! Test message ingested. Tap 'Inbox' to see it."
                                Toast.makeText(context, "✅ Message synced! Check your Inbox tab.", Toast.LENGTH_LONG).show()
                            } else {
                                testResult = "Failed to send message. Please check server URL & Wi-Fi."
                                Toast.makeText(context, "❌ Delivery failed. Check server IP.", Toast.LENGTH_LONG).show()
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF238636)),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isSendingTest
                ) {
                    Text(
                        text = if (isSendingTest) "Sending..." else "Send Test Message to Omni Inbox",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                if (testResult != null) {
                    Text(
                        text = testResult!!,
                        color = if (testResult!!.startsWith("Success")) Color(0xFF22C55E) else Color(0xFFF85149),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }

        // ── Card 4: Account & Connection Management ───────────────────────────
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, Color(0xFF30363D), RoundedCornerShape(16.dp)),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F141F)),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = "👤 Account & Device Pairing",
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    fontSize = 15.sp
                )

                Text(
                    text = "Logged in as: ${session.userEmail ?: "None"}.\nMake sure this matches your computer browser login so messages sync to the same inbox.",
                    color = Color(0xFF8B949E),
                    fontSize = 12.sp
                )

                // Pair with QR Code
                OutlinedButton(
                    onClick = onOpenPairingScreen,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFF58A6FF))
                ) {
                    Text("Re-Pair with Web QR Code", fontSize = 12.sp)
                }

                // Switch Account / Disconnect
                Button(
                    onClick = {
                        OmniConnectionService.stop(context)
                        session.clearSession()
                        onDisconnect()
                        Toast.makeText(context, "Logged out. You can now log in with another email.", Toast.LENGTH_SHORT).show()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF30363D)),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Switch Account / Log In with Different Email", fontSize = 12.sp, color = Color(0xFFF85149))
                }
            }
        }

        Spacer(modifier = Modifier.height(30.dp))
    }
}

// ── 3. Sleek Dark 3D Login & Sign Up Screen ───────────────────────────────────

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
            .padding(horizontal = 24.dp, vertical = 20.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            // Brand Logo
            Box(
                modifier = Modifier
                    .size(68.dp)
                    .shadow(16.dp, CircleShape, spotColor = Color(0xFFDC2626))
                    .background(
                        brush = Brush.radialGradient(
                            listOf(Color(0xFFEF4444), Color(0xFF991B1B), Color(0xFF000000))
                        ),
                        shape = CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text("Ω", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 34.sp)
            }

            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "Omni Mobile Suite",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 22.sp
                )
                Text(
                    text = "Real-time bridge & full communication hub",
                    color = Color(0xFF8B949E),
                    fontSize = 12.sp
                )
            }

            // 💡 Sync Guidance Note
            Surface(
                color = Color(0xFF161B22),
                shape = RoundedCornerShape(10.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF30363D).copy(alpha = 0.6f))
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("💡", fontSize = 16.sp)
                    Text(
                        text = "Sign in with the SAME email you use on your computer browser so chats sync together.",
                        color = Color(0xFFE2E8F0),
                        fontSize = 11.sp,
                        lineHeight = 15.sp
                    )
                }
            }

            // 3D Glassmorphic Form Card
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .shadow(14.dp, RoundedCornerShape(18.dp), spotColor = Color(0xFFDC2626).copy(alpha = 0.2f))
                    .border(1.dp, Color(0xFF30363D), RoundedCornerShape(18.dp)),
                color = Color(0xFF111622).copy(alpha = 0.95f),
                shape = RoundedCornerShape(18.dp)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Text(
                        text = if (isSignUpMode) "Create Account" else "Sign In & Connect Phone",
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        fontSize = 16.sp
                    )

                    if (authError != null) {
                        Surface(
                            color = Color(0xFF3B1812),
                            shape = RoundedCornerShape(8.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFF85149))
                        ) {
                            Text(
                                text = authError!!,
                                color = Color(0xFFFF7B72),
                                fontSize = 12.sp,
                                modifier = Modifier.padding(10.dp)
                            )
                        }
                    }

                    OutlinedTextField(
                        value = serverUrl,
                        onValueChange = { serverUrl = it },
                        label = { Text("Server URL", fontSize = 12.sp) },
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
                        Text("🔗 Or Pair with Web QR Code / Link", fontSize = 12.sp)
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
