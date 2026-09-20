package com.omni.bridge.service

import android.app.Notification
import android.app.PendingIntent
import android.app.RemoteInput
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.IBinder
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.omni.bridge.OmniBridgeApp
import com.omni.bridge.data.OmniApiClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Core service that intercepts incoming notifications from messaging apps.
 *
 * For each intercepted notification it:
 *  1. Extracts: sender name, sender handle (phone/username), message text, platform
 *  2. Caches the RemoteInput action (for sending the reply later)
 *  3. POSTs the payload to Omni backend via OmniApiClient
 *
 * Supported apps and their platform mappings:
 *   com.whatsapp              → whatsapp
 *   com.whatsapp.w4b          → whatsapp
 *   com.facebook.orca         → messenger
 *   com.instagram.android     → instagram
 *   com.google.android.apps.messaging → sms
 *   com.samsung.android.messaging     → sms
 */
class OmniNotificationService : NotificationListenerService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onBind(intent: android.content.Intent?): IBinder? {
        Log.i(TAG, "NotificationListenerService bound")
        return super.onBind(intent)
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return
        val pkg = sbn.packageName ?: return
        val platform = PACKAGE_PLATFORM_MAP[pkg] ?: return  // ignore non-messaging apps

        val app = OmniBridgeApp.get(applicationContext)
        if (!app.sessionStore.isPaired) return

        val notification = sbn.notification ?: return
        val extras = notification.extras ?: return

        // ── Extract message text ──────────────────────────────────────────
        val content = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
            ?: extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
            ?: return  // ignore notifications without text

        if (content.isBlank()) return

        // ── Extract sender info ───────────────────────────────────────────
        val senderName = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
            ?: extras.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE)?.toString()
            ?: "Unknown"

        // Use notification tag + id as sender_handle (unique per conversation thread)
        val senderHandle = deriveSenderHandle(pkg, sbn, extras)

        // ── Build notification_key (used to route the reply) ──────────────
        // Format: "{package}|{notification_tag}|{notification_id}"
        val notificationKey = buildNotificationKey(pkg, sbn)

        // ── Cache the RemoteInput action for replying later ───────────────
        cacheRemoteInput(notificationKey, notification)

        // ── Send to Omni backend ──────────────────────────────────────────
        val session = app.sessionStore
        val payload = OmniApiClient.MessagePayload(
            device_id = session.deviceId ?: return,
            device_secret = session.deviceSecret ?: return,
            platform = platform,
            sender_name = senderName,
            sender_handle = senderHandle,
            content = content,
            notification_key = notificationKey,
            app_package = pkg,
            timestamp_ms = sbn.postTime,
        )

        scope.launch {
            val ok = app.apiClient.sendMessage(payload)
            if (!ok) {
                Log.w(TAG, "Failed to send notification to Omni for pkg=$pkg")
            } else {
                Log.i(TAG, "Sent to Omni: $senderName on $platform — ${content.take(40)}")
            }
        }
    }

    // ── Helper: build a unique notification key ───────────────────────────

    private fun buildNotificationKey(pkg: String, sbn: StatusBarNotification): String {
        val tag = sbn.tag ?: "null"
        return "$pkg|$tag|${sbn.id}"
    }

    // ── Helper: derive a stable sender handle ─────────────────────────────

    private fun deriveSenderHandle(
        pkg: String,
        sbn: StatusBarNotification,
        extras: Bundle,
    ): String {
        // For WhatsApp, the tag is the phone number or group ID
        if (pkg in WHATSAPP_PACKAGES) {
            sbn.tag?.let { tag ->
                // WhatsApp tags look like "+8801234567890" or "1234567890@g.us"
                if (tag.isNotBlank()) return tag
            }
        }
        // For all others: use notification title as handle (best we can get without accessibility)
        return extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
            ?: sbn.tag
            ?: "${sbn.id}"
    }

    // ── Helper: cache RemoteInput for reply dispatch ──────────────────────

    private fun cacheRemoteInput(notificationKey: String, notification: Notification) {
        val actions = notification.actions ?: return
        for (action in actions) {
            val remoteInputs = action.remoteInputs ?: continue
            if (remoteInputs.isEmpty()) continue

            // This action has a RemoteInput — it's the "Reply" action
            RemoteInputCache.put(
                notificationKey,
                CachedReplyAction(
                    pendingIntent = action.actionIntent,
                    remoteInputs = remoteInputs,
                    resultKey = remoteInputs.first().resultKey,
                )
            )
            Log.d(TAG, "Cached RemoteInput for key=$notificationKey")
            break
        }
    }

    companion object {
        private const val TAG = "OmniNotificationService"

        private val WHATSAPP_PACKAGES = setOf("com.whatsapp", "com.whatsapp.w4b")

        /** Maps app package name → Omni platform identifier */
        val PACKAGE_PLATFORM_MAP: Map<String, String> = mapOf(
            "com.whatsapp" to "whatsapp",
            "com.whatsapp.w4b" to "whatsapp",
            "com.facebook.orca" to "messenger",
            "com.instagram.android" to "instagram",
            "com.google.android.apps.messaging" to "sms",
            "com.samsung.android.messaging" to "sms",
            "com.android.messaging" to "sms",
            "com.verizon.messaging.vzmsgs" to "sms",
        )
    }
}

/** A Reply action cached per notification_key. */
data class CachedReplyAction(
    val pendingIntent: PendingIntent,
    val remoteInputs: Array<RemoteInput>,
    val resultKey: String,
)

/** Thread-safe cache of active notification reply actions. */
object RemoteInputCache {
    private val cache = LinkedHashMap<String, CachedReplyAction>(32, 0.75f, true)
    private const val MAX_SIZE = 50

    @Synchronized
    fun put(key: String, action: CachedReplyAction) {
        if (cache.size >= MAX_SIZE) {
            cache.entries.first().let { cache.remove(it.key) }
        }
        cache[key] = action
    }

    @Synchronized
    fun get(key: String): CachedReplyAction? = cache[key]

    @Synchronized
    fun remove(key: String) = cache.remove(key)
}
