package com.omni.bridge.service

import android.app.PendingIntent
import android.app.RemoteInput
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import com.omni.bridge.data.OmniApiClient
import com.omni.bridge.data.OmniWebSocketClient

/**
 * Dispatches replies FROM Omni backend BACK to the originating messaging app.
 *
 * How it works:
 *   1. Receives a ReplyPushEvent (notification_key + content + conversationId)
 *   2. Looks up the cached RemoteInput for that notification_key
 *   3. Builds a Bundle with the reply text
 *   4. Fires the PendingIntent with RemoteInput result → this sends the message
 *      THROUGH the app (WhatsApp, Messenger, etc.) as if the user typed it
 *   5. Sends a reply-ack to Omni backend confirming delivery
 *
 * If the cached RemoteInput has expired (notification dismissed), falls back to
 * reporting "dismissed" to Omni, which logs it for audit.
 */
object ReplyDispatcher {

    private const val TAG = "ReplyDispatcher"

    suspend fun dispatch(
        context: Context,
        event: OmniWebSocketClient.ReplyPushEvent,
        apiClient: OmniApiClient,
    ) {
        val cached = RemoteInputCache.get(event.notificationKey)

        if (cached == null) {
            Log.w(TAG, "No cached RemoteInput for key=${event.notificationKey} — notification expired")
            apiClient.sendReplyAck(
                conversationId = event.conversationId,
                status = "dismissed",
                error = "Notification expired before reply arrived",
            )
            return
        }

        try {
            // Build the RemoteInput result bundle
            val resultBundle = Bundle()
            resultBundle.putCharSequence(cached.resultKey, event.content)

            // Fire the pending intent with RemoteInput data
            // This is equivalent to the user tapping "Reply" and typing the message
            val replyIntent = Intent()
            RemoteInput.addResultsToIntent(cached.remoteInputs, replyIntent, resultBundle)
            cached.pendingIntent.send(
                context,
                0,
                replyIntent,
            )

            // Remove from cache — each notification_key is used once
            RemoteInputCache.remove(event.notificationKey)

            Log.i(TAG, "Reply dispatched for key=${event.notificationKey}: ${event.content.take(40)}")

            // Notify Omni the reply was sent
            apiClient.sendReplyAck(
                conversationId = event.conversationId,
                status = "sent",
            )

        } catch (e: PendingIntent.CanceledException) {
            Log.e(TAG, "PendingIntent cancelled for key=${event.notificationKey}: $e")
            apiClient.sendReplyAck(
                conversationId = event.conversationId,
                status = "failed",
                error = "PendingIntent cancelled: ${e.message}",
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error dispatching reply: $e")
            apiClient.sendReplyAck(
                conversationId = event.conversationId,
                status = "failed",
                error = e.message,
            )
        }
    }
}
