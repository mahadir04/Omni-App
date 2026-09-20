package com.omni.bridge.data

import android.util.Log
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * HTTP client for communicating with the Omni backend REST API.
 *
 * Endpoints used:
 *   POST /api/device/register   — pair device (called once during setup, with JWT)
 *   POST /api/device/message    — push captured notification to backend
 *   POST /api/device/reply-ack  — confirm a reply was dispatched from the phone
 */
class OmniApiClient(private val session: DeviceSessionStore) {

    private val gson = Gson()
    private val json = "application/json; charset=utf-8".toMediaType()
    private val http = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(10, TimeUnit.SECONDS)
        .build()

    // ── Authentication (Login & Signup directly from phone) ───────────────

    data class AuthResult(
        val token: String? = null,
        val errorMessage: String? = null,
    )

    suspend fun login(
        serverUrl: String,
        email: String,
        password: String,
    ): AuthResult = withContext(Dispatchers.IO) {
        val body = mapOf("email" to email, "password" to password)
        val request = Request.Builder()
            .url("$serverUrl/api/auth/login")
            .post(gson.toJson(body).toRequestBody(json))
            .build()

        runCatching {
            http.newCall(request).execute().use { response ->
                val raw = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val map = gson.fromJson(raw, Map::class.java)
                    val token = map["access_token"] as? String
                    if (token != null) AuthResult(token = token)
                    else AuthResult(errorMessage = "Server returned empty token.")
                } else {
                    Log.e(TAG, "Login failed: ${response.code} $raw")
                    val detail = try {
                        val map = gson.fromJson(raw, Map::class.java)
                        map["detail"] as? String
                    } catch (_: Exception) { null }
                    AuthResult(errorMessage = detail ?: "Invalid credentials (HTTP ${response.code})")
                }
            }
        }.getOrElse { e ->
            Log.e(TAG, "Login network error: $e")
            AuthResult(errorMessage = "Cannot reach server: ${e.localizedMessage ?: e.message}")
        }
    }

    suspend fun signup(
        serverUrl: String,
        fullName: String,
        email: String,
        password: String,
    ): AuthResult = withContext(Dispatchers.IO) {
        val body = mapOf("full_name" to fullName, "email" to email, "password" to password)
        val request = Request.Builder()
            .url("$serverUrl/api/auth/signup")
            .post(gson.toJson(body).toRequestBody(json))
            .build()

        runCatching {
            http.newCall(request).execute().use { response ->
                val raw = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    // Auto login after signup
                    login(serverUrl, email, password)
                } else {
                    Log.e(TAG, "Signup failed: ${response.code} $raw")
                    val detail = try {
                        val map = gson.fromJson(raw, Map::class.java)
                        map["detail"] as? String
                    } catch (_: Exception) { null }
                    AuthResult(errorMessage = detail ?: "Signup error (HTTP ${response.code})")
                }
            }
        }.getOrElse { e ->
            Log.e(TAG, "Signup network error: $e")
            AuthResult(errorMessage = "Cannot reach server: ${e.localizedMessage ?: e.message}")
        }
    }

    // ── Register device (called during pairing or direct login) ───────────

    suspend fun registerDevice(
        serverUrl: String,
        jwtToken: String,
        deviceName: String,
    ): RegisterResponse? = withContext(Dispatchers.IO) {
        val body = mapOf("device_name" to deviceName)
        val request = Request.Builder()
            .url("$serverUrl/api/device/register")
            .addHeader("Authorization", "Bearer $jwtToken")
            .post(gson.toJson(body).toRequestBody(json))
            .build()

        runCatching {
            http.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    gson.fromJson(response.body?.string(), RegisterResponse::class.java)
                } else {
                    Log.e(TAG, "Register failed ${response.code}: ${response.body?.string()}")
                    null
                }
            }
        }.getOrElse { e ->
            Log.e(TAG, "Register error: $e")
            null
        }
    }

    // ── Send captured notification to backend ─────────────────────────────

    suspend fun sendMessage(payload: MessagePayload): Boolean = withContext(Dispatchers.IO) {
        val serverUrl = session.serverUrl ?: return@withContext false
        val body = gson.toJson(payload).toRequestBody(json)
        val request = Request.Builder()
            .url("$serverUrl/api/device/message")
            .post(body)
            .build()

        runCatching {
            http.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    Log.e(TAG, "sendMessage failed ${response.code}: ${response.body?.string()}")
                }
                response.isSuccessful
            }
        }.getOrElse { e ->
            Log.e(TAG, "sendMessage error: $e")
            false
        }
    }

    // ── Acknowledge reply dispatch ─────────────────────────────────────────

    suspend fun sendReplyAck(
        conversationId: String,
        status: String,      // "sent" | "failed" | "dismissed"
        error: String? = null,
    ) = withContext(Dispatchers.IO) {
        val serverUrl = session.serverUrl ?: return@withContext
        val deviceId = session.deviceId ?: return@withContext
        val deviceSecret = session.deviceSecret ?: return@withContext

        val payload = mapOf(
            "device_id" to deviceId,
            "device_secret" to deviceSecret,
            "conversation_id" to conversationId,
            "status" to status,
            "error" to error,
        )
        val request = Request.Builder()
            .url("$serverUrl/api/device/reply-ack")
            .post(gson.toJson(payload).toRequestBody(json))
            .build()

        runCatching {
            http.newCall(request).execute().close()
        }.getOrElse { e ->
            Log.e(TAG, "sendReplyAck error: $e")
        }
    }

    // ── Data models ───────────────────────────────────────────────────────

    data class RegisterResponse(
        val device_id: String,
        val device_secret: String,
    )

    data class MessagePayload(
        val device_id: String,
        val device_secret: String,
        val platform: String,
        val sender_name: String,
        val sender_handle: String,
        val content: String,
        val notification_key: String,
        val app_package: String?,
        val timestamp_ms: Long,
    )

    companion object {
        private const val TAG = "OmniApiClient"
    }
}
