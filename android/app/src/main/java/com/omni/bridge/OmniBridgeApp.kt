package com.omni.bridge

import android.app.Application
import android.content.Context
import com.omni.bridge.data.DeviceSessionStore
import com.omni.bridge.data.OmniApiClient
import com.omni.bridge.data.OmniWebSocketClient

/**
 * Application class — initialises singletons that are shared across
 * the notification service, connection service, and UI.
 */
class OmniBridgeApp : Application() {

    lateinit var sessionStore: DeviceSessionStore
    lateinit var apiClient: OmniApiClient
    lateinit var webSocketClient: OmniWebSocketClient

    override fun onCreate() {
        super.onCreate()
        instance = this
        sessionStore = DeviceSessionStore(this)
        apiClient = OmniApiClient(sessionStore)
        webSocketClient = OmniWebSocketClient(sessionStore, apiClient)
    }

    companion object {
        lateinit var instance: OmniBridgeApp
            private set

        fun get(context: Context): OmniBridgeApp =
            context.applicationContext as OmniBridgeApp
    }
}
