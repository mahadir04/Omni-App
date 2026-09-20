package com.omni.bridge.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Encrypted local storage for device credentials and server config.
 * Uses EncryptedSharedPreferences backed by the Android Keystore.
 *
 * Keys stored:
 *   device_id        — UUID issued by Omni backend on registration
 *   device_secret    — 64-char hex secret for API auth
 *   server_url       — Base URL of the Omni backend (e.g. https://omni.example.com)
 *   user_email       — Logged-in user email (display only)
 */
class DeviceSessionStore(context: Context) {

    private val prefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        EncryptedSharedPreferences.create(
            context,
            "omni_bridge_session",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    var deviceId: String?
        get() = prefs.getString(KEY_DEVICE_ID, null)
        set(v) = prefs.edit().putString(KEY_DEVICE_ID, v).apply()

    var deviceSecret: String?
        get() = prefs.getString(KEY_DEVICE_SECRET, null)
        set(v) = prefs.edit().putString(KEY_DEVICE_SECRET, v).apply()

    var serverUrl: String?
        get() = prefs.getString(KEY_SERVER_URL, null)
        set(v) = prefs.edit().putString(KEY_SERVER_URL, v?.trimEnd('/'), ).apply()

    var userEmail: String?
        get() = prefs.getString(KEY_USER_EMAIL, null)
        set(v) = prefs.edit().putString(KEY_USER_EMAIL, v).apply()

    val isPaired: Boolean
        get() = deviceId != null && deviceSecret != null && serverUrl != null

    fun clearSession() {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_DEVICE_SECRET = "device_secret"
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_USER_EMAIL = "user_email"
    }
}
