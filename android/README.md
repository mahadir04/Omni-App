# Omni Bridge — Android Companion App

This is the Android companion app that turns your phone into a **message relay bridge** for the Omni inbox.

## How It Works

```
WhatsApp / Messenger / Instagram
          │  (Notification arrives on phone)
          ▼
OmniNotificationService   ← NotificationListenerService
          │  Extracts: sender, content, RemoteInput action
          │  Caches RemoteInput under notification_key
          ▼
POST /api/device/message  → Omni Backend
          │  Stores message, runs AI pipeline
          ▼
GET /ws/device/{id}       ← Persistent WebSocket (OmniWebSocketClient)
          │  Receives reply_push event
          ▼
ReplyDispatcher
          │  Looks up cached RemoteInput
          │  Fires PendingIntent with reply text
          ▼
Message appears as sent in WhatsApp / Messenger / Instagram
```

## Project Structure

```
android/
├── app/src/main/
│   ├── AndroidManifest.xml
│   └── java/com/omni/bridge/
│       ├── OmniBridgeApp.kt              — Application class, singletons
│       ├── data/
│       │   ├── DeviceSessionStore.kt     — Encrypted credentials (Android Keystore)
│       │   ├── OmniApiClient.kt          — REST API client (register, sendMessage, replyAck)
│       │   └── OmniWebSocketClient.kt    — Persistent WS with auto-reconnect
│       ├── service/
│       │   ├── OmniNotificationService.kt — Core: intercepts notifications
│       │   ├── OmniConnectionService.kt   — Foreground service (keeps WS alive)
│       │   ├── ReplyDispatcher.kt         — Fires RemoteInput to send replies
│       │   └── RemoteInputCache          — (in OmniNotificationService.kt)
│       ├── receiver/
│       │   └── BootReceiver.kt           — Auto-start on reboot
│       └── ui/
│           ├── MainActivity.kt           — Status dashboard
│           └── PairingActivity.kt        — Pair device with Omni account
```

## Building

Requirements:
- Android Studio Hedgehog or later
- Android SDK 35
- Min device: Android 8.0 (API 26) — required for RemoteInput quick reply

```bash
cd android
./gradlew assembleDebug
```

APK output: `app/build/outputs/apk/debug/app-debug.apk`

## Pairing Your Phone

### Option A — Manual (from the app)
1. Install the APK on your phone
2. Open Omni web app → Settings → Devices → Generate Token
3. In the app, tap **Pair Device**
4. Enter your Omni server URL + the JWT token from step 2
5. Tap **Pair** — device registers and secret is stored encrypted

### Option B — Deep Link / QR
The Omni web app can generate a QR code or link in the format:
```
omni://pair?server=https://youromni.com&token=<your_jwt>
```
Scanning/tapping this opens PairingActivity and pre-fills the fields.

## Permissions Needed

| Permission | Why |
|---|---|
| `BIND_NOTIFICATION_LISTENER_SERVICE` | Read notifications from WhatsApp, Messenger, etc. |
| `FOREGROUND_SERVICE` | Keep WebSocket alive in background |
| `RECEIVE_BOOT_COMPLETED` | Auto-start after reboot |
| `INTERNET` | Talk to Omni backend |
| `POST_NOTIFICATIONS` | Show connection status notification (Android 13+) |

## Supported Apps

| App | Package | Platform sent to Omni |
|---|---|---|
| WhatsApp | com.whatsapp | whatsapp |
| WhatsApp Business | com.whatsapp.w4b | whatsapp |
| Messenger | com.facebook.orca | messenger |
| Instagram | com.instagram.android | instagram |
| Google Messages | com.google.android.apps.messaging | sms |
| Samsung Messages | com.samsung.android.messaging | sms |

## Important Notes

- **RemoteInput expiry**: The reply RemoteInput is only valid while the notification is visible. If the user dismisses the notification before Omni sends a reply, the reply will fail with status `dismissed`.
- **No root required**: Uses standard Android `NotificationListenerService` API — no root, no accessibility hack, fully supported by Google.
- **Privacy**: Only messages from monitored apps are sent to Omni. System notifications, alarms, etc. are ignored.
