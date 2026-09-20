package com.omni.bridge.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.omni.bridge.OmniBridgeApp
import com.omni.bridge.service.OmniConnectionService

/**
 * Starts OmniConnectionService after device reboot or app update.
 * Requires RECEIVE_BOOT_COMPLETED permission.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action !in HANDLED_ACTIONS) return

        val session = OmniBridgeApp.get(context).sessionStore
        if (!session.isPaired) {
            Log.i(TAG, "Boot received but device not paired — skipping service start")
            return
        }

        Log.i(TAG, "Boot received — starting OmniConnectionService")
        OmniConnectionService.start(context)
    }

    companion object {
        private const val TAG = "BootReceiver"
        private val HANDLED_ACTIONS = setOf(
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
        )
    }
}
