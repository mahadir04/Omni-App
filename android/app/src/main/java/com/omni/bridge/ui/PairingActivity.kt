package com.omni.bridge.ui

import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.widget.Toast
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Pairing screen — allows user to link this Android device with their Omni account.
 *
 * Two entry paths:
 *  1. From MainActivity "Pair" button (manual entry of server URL + JWT token)
 *  2. From deep link: omni://pair?server=https://...&token=jwt_token
 *     (The Omni web app generates this link/QR code from the Settings → Devices page)
 */
class PairingActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Check for deep link (omni://pair?server=...&token=...)
        var prefillServer = ""
        var prefillToken = ""
        intent?.data?.let { uri ->
            if (uri.scheme == "omni" && uri.host == "pair") {
                prefillServer = uri.getQueryParameter("server") ?: ""
                prefillToken = uri.getQueryParameter("token") ?: ""
                Log.i(TAG, "Deep link pairing: server=$prefillServer")
            }
        }

        setContent {
            OmniBridgeTheme {
                PairingScreen(
                    prefillServer = prefillServer,
                    prefillToken = prefillToken,
                    onPaired = {
                        OmniConnectionService.start(this)
                        Toast.makeText(this, "Device paired successfully!", Toast.LENGTH_LONG).show()
                        finish()
                    },
                    onCancel = { finish() },
                    app = OmniBridgeApp.get(this),
                )
            }
        }
    }

    companion object {
        private const val TAG = "PairingActivity"
    }
}

@Composable
fun PairingScreen(
    prefillServer: String,
    prefillToken: String,
    onPaired: () -> Unit,
    onCancel: () -> Unit,
    app: OmniBridgeApp,
) {
    val scope = rememberCoroutineScope()
    var serverUrl by remember { mutableStateOf(prefillServer) }
    var jwtToken by remember { mutableStateOf(prefillToken) }
    var deviceName by remember { mutableStateOf(android.os.Build.MODEL) }
    var isLoading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    val background = Brush.verticalGradient(listOf(Color(0xFF0D1117), Color(0xFF161B22)))

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(brush = background)
            .padding(24.dp),
    ) {
        Column(
            modifier = Modifier.align(Alignment.Center),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("Pair Device", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = Color.White)
            Text(
                "Enter your Omni server URL and a JWT token from the web app.",
                color = Color(0xFF8B949E), fontSize = 13.sp,
            )

            Spacer(Modifier.height(8.dp))

            OmniTextField(value = serverUrl, onValueChange = { serverUrl = it }, label = "Server URL", placeholder = "https://youromni.com")
            OmniTextField(value = jwtToken, onValueChange = { jwtToken = it }, label = "User Token (from Omni web app Settings → Devices)")
            OmniTextField(value = deviceName, onValueChange = { deviceName = it }, label = "Device Name")

            error?.let {
                Text(it, color = Color(0xFFF85149), fontSize = 12.sp)
            }

            Button(
                onClick = {
                    scope.launch {
                        isLoading = true
                        error = null
                        val result = withContext(Dispatchers.IO) {
                            app.apiClient.registerDevice(serverUrl.trim(), jwtToken.trim(), deviceName.trim())
                        }
                        isLoading = false
                        if (result != null) {
                            app.sessionStore.serverUrl = serverUrl.trim()
                            app.sessionStore.deviceId = result.device_id
                            app.sessionStore.deviceSecret = result.device_secret
                            app.sessionStore.jwtToken = jwtToken.trim()
                            onPaired()
                        } else {
                            error = "Pairing failed — check URL and token, then try again"
                        }
                    }
                },
                enabled = !isLoading && serverUrl.isNotBlank() && jwtToken.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF238636)),
                modifier = Modifier.fillMaxWidth().height(50.dp),
            ) {
                if (isLoading) {
                    CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                } else {
                    Text("Pair Device", fontWeight = FontWeight.SemiBold)
                }
            }

            TextButton(onClick = onCancel) {
                Text("Cancel", color = Color(0xFF8B949E))
            }
        }
    }
}

@Composable
fun OmniTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    placeholder: String = "",
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label, color = Color(0xFF8B949E), fontSize = 12.sp) },
        placeholder = { Text(placeholder, color = Color(0xFF484F58)) },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = Color.White,
            unfocusedTextColor = Color(0xFFE6EDF3),
            focusedBorderColor = Color(0xFF388BFD),
            unfocusedBorderColor = Color(0xFF30363D),
            cursorColor = Color(0xFF388BFD),
        ),
        shape = RoundedCornerShape(8.dp),
    )
}
