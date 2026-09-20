package com.omni.bridge.data

import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonObject
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Persistent WebSocket client connecting to:
 *   wss://{serverUrl}/ws/device/{device_id}?secret={device_secret}
 *
 * Responsibilities:
 *   1. Maintain a persistent connection (auto-reconnect with exponential backoff)
 *   2. Send periodic pings to keep the connection alive
 *   3. Receive "reply_push" events and dispatch them to ReplyDispatcher
 *   4. Handle offline gracefully (messages stored until reconnected)
 */
class OmniWebSocketClient(
    private val session: DeviceSessionStore,
    private val apiClient: OmniApiClient,
) {
    private val gson = Gson()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val http = OkHttpClient.Builder()
        .pingInterval(30, TimeUnit.SECONDS)
        .connectTimeout(10, TimeUnit.SECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private val isConnected = AtomicBoolean(false)
    private var reconnectDelay = INITIAL_RECONNECT_MS

    // Callback set by OmniConnectionService when a reply arrives
    var onReplyPush: ((ReplyPushEvent) -> Unit)? = null

    // ── Connect ───────────────────────────────────────────────────────────

    fun connect() {
        if (!session.isPaired) {
            Log.w(TAG, "Not paired — WebSocket connection skipped")
            return
        }
        val serverUrl = session.serverUrl ?: return
        val deviceId = session.deviceId ?: return
        val deviceSecret = session.deviceSecret ?: return

        val wsUrl = serverUrl
            .replace("https://", "wss://")
            .replace("http://", "ws://")
            .plus("/ws/device/$deviceId?secret=$deviceSecret")

        val request = Request.Builder().url(wsUrl).build()
        webSocket = http.newWebSocket(request, listener)
        Log.i(TAG, "Connecting to $wsUrl")
    }

    fun disconnect() {
        webSocket?.close(1000, "User disconnected")
        webSocket = null
        isConnected.set(false)
    }

    fun isConnected() = isConnected.get()

    // ── Internal WebSocket listener ───────────────────────────────────────

    private val listener = object : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            Log.i(TAG, "WebSocket connected")
            isConnected.set(true)
            reconnectDelay = INITIAL_RECONNECT_MS
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            Log.d(TAG, "← $text")
            runCatching {
                val obj = gson.fromJson(text, JsonObject::class.java)
                when (obj.get("event")?.asString) {
                    "reply_push" -> {
                        val data = obj.getAsJsonObject("data")
                        val event = ReplyPushEvent(
                            notificationKey = data.get("notification_key").asString,
                            content = data.get("content").asString,
                            conversationId = data.get("conversation_id").asString,
                            platform = data.get("platform").asString,
                        )
                        onReplyPush?.invoke(event)
                    }
                    "pong" -> { /* keepalive ack */ }
                    else -> Log.d(TAG, "Unknown event: $text")
                }
            }.getOrElse { e ->
                Log.e(TAG, "Error parsing WS message: $e")
            }
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            Log.e(TAG, "WebSocket failure: $t — reconnecting in ${reconnectDelay}ms")
            isConnected.set(false)
            scheduleReconnect()
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            Log.i(TAG, "WebSocket closed: $code $reason")
            isConnected.set(false)
            if (code != 1000) {
                scheduleReconnect()
            }
        }
    }

    // ── Reconnect with exponential backoff ────────────────────────────────

    private fun scheduleReconnect() {
        scope.launch {
            delay(reconnectDelay)
            reconnectDelay = (reconnectDelay * 2).coerceAtMost(MAX_RECONNECT_MS)
            connect()
        }
    }

    // ── Data models ───────────────────────────────────────────────────────

    data class ReplyPushEvent(
        val notificationKey: String,
        val content: String,
        val conversationId: String,
        val platform: String,
    )

    companion object {
        private const val TAG = "OmniWebSocketClient"
        private const val INITIAL_RECONNECT_MS = 2_000L
        private const val MAX_RECONNECT_MS = 60_000L
    }
}
