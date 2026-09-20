package com.omni.bridge.service

import android.app.IntentService
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.omni.bridge.OmniBridgeApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Foreground service that maintains the persistent WebSocket connection to Omni backend.
 *
 * Must run as foreground to survive background process limits.
 * Shows a persistent status notification (tapping opens MainActivity).
 *
 * Also sets the reply callback on the WebSocket client so that
 * incoming reply_push events are dispatched to ReplyDispatcher.
 */
class OmniConnectionService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildStatusNotification("Connecting to Omni…"))
        Log.i(TAG, "OmniConnectionService started")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val app = OmniBridgeApp.get(this)

        // Wire reply_push events → ReplyDispatcher
        app.webSocketClient.onReplyPush = { event ->
            scope.launch {
                Log.i(TAG, "reply_push received for key=${event.notificationKey}")
                ReplyDispatcher.dispatch(
                    context = applicationContext,
                    event = event,
                    apiClient = app.apiClient,
                )
                updateNotification("Last reply sent via ${event.platform}")
            }
        }

        // Connect (or reconnect)
        if (!app.webSocketClient.isConnected()) {
            app.webSocketClient.connect()
        }

        updateNotification("Connected — listening for messages")

        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        OmniBridgeApp.get(this).webSocketClient.disconnect()
        Log.i(TAG, "OmniConnectionService destroyed")
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ── Notification helpers ──────────────────────────────────────────────

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID, "Omni Bridge Connection",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Keeps Omni Bridge connected to your inbox"
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildStatusNotification(text: String) =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Omni Bridge")
            .setContentText(text)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

    private fun updateNotification(text: String) {
        val nm = getSystemService(NotificationManager::class.java)
        nm.notify(NOTIFICATION_ID, buildStatusNotification(text))
    }

    companion object {
        private const val TAG = "OmniConnectionService"
        private const val CHANNEL_ID = "omni_bridge_connection"
        private const val NOTIFICATION_ID = 1001

        fun start(context: Context) {
            val intent = Intent(context, OmniConnectionService::class.java)
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, OmniConnectionService::class.java))
        }
    }
}
