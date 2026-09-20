plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.compose.compiler)
}

android {
    namespace = "com.omni.bridge"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.omni.bridge"
        minSdk = 26          // Android 8.0 — minimum for RemoteInput quick reply
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.okhttp)                         // WebSocket + HTTP
    implementation(libs.gson)                           // JSON parsing
    implementation(libs.kotlinx.coroutines.android)     // Coroutines
    implementation(libs.androidx.datastore.preferences) // Secure prefs
    implementation(libs.androidx.security.crypto)       // EncryptedSharedPreferences
    implementation(libs.androidx.work.runtime.ktx)      // WorkManager for retry
}
