package com.httpfileserver

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.janeasystems.nodejs_mobile_android.NodejsMobile
import org.json.JSONObject

/**
 * Foreground service that hosts the Node.js file server process.
 *
 * Lifecycle:
 *  1. MainActivity sends ACTION_START intent with root path + port.
 *  2. Service starts foreground notification, then starts Node.js.
 *  3. Node.js sends {"type":"ready"} — service replies with {"type":"start", ...config}.
 *  4. Node.js sends {"type":"started","url":"http://..."} — service broadcasts to UI.
 *  5. MainActivity sends ACTION_STOP → service sends stop to Node.js and shuts down.
 *
 * Bridge channel: "main"
 *   Node.js → Android : rn_bridge.channel.send(jsonString)
 *   Android → Node.js : NodejsMobile.sendMessageToNodeChannel("main", jsonString)
 */
class ServerService : Service() {

    companion object {
        const val ACTION_START = "com.httpfileserver.ACTION_START"
        const val ACTION_STOP  = "com.httpfileserver.ACTION_STOP"

        const val EXTRA_ROOT_PATH  = "root_path"
        const val EXTRA_PORT       = "port"

        const val BROADCAST_STATUS   = "com.httpfileserver.STATUS"
        const val EXTRA_STATUS_TYPE  = "status_type"
        const val EXTRA_SERVER_URL   = "server_url"

        private const val CHANNEL_ID      = "file_server_channel"
        private const val NOTIFICATION_ID = 1
        private const val BRIDGE_CHANNEL  = "main"
    }

    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private var rootPath: String = ""
    private var port: Int = 8080

    // ── Service lifecycle ──────────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                rootPath = intent.getStringExtra(EXTRA_ROOT_PATH) ?: defaultRootPath()
                port     = intent.getIntExtra(EXTRA_PORT, 8080)
                startServer()
            }
            ACTION_STOP -> stopServer()
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        releaseWakeLock()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ── Server start / stop ────────────────────────────────────────────────────

    private fun startServer() {
        acquireWakeLock()
        startForeground(NOTIFICATION_ID, buildNotification("Starting…"))

        // Register bridge listener BEFORE starting Node.js so no messages are missed
        NodejsMobile.registerNodeDataChannelReciever(BRIDGE_CHANNEL) { message ->
            handleNodeMessage(message)
        }

        // Node.js project is extracted from assets by the library on first run.
        // Entry point: app/src/main/assets/nodejs-project/main.js
        NodejsMobile.startNodeWithArguments(arrayOf("node", "main.js"))
    }

    private fun stopServer() {
        try {
            NodejsMobile.sendMessageToNodeChannel(
                BRIDGE_CHANNEL,
                JSONObject().put("type", "stop").toString()
            )
        } catch (_: Exception) { /* Node.js may already be stopped */ }

        releaseWakeLock()
        broadcastStatus("stopped", null)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    // ── Bridge message handler ─────────────────────────────────────────────────

    private fun handleNodeMessage(message: String) {
        try {
            val json = JSONObject(message)
            when (json.getString("type")) {
                "ready" -> {
                    // Node.js is up — send server configuration
                    val config = JSONObject().apply {
                        put("type",     "start")
                        put("rootPath", rootPath)
                        put("port",     port)
                    }
                    NodejsMobile.sendMessageToNodeChannel(BRIDGE_CHANNEL, config.toString())
                }
                "started" -> {
                    val url = json.getString("url")
                    updateNotification("Running at $url")
                    broadcastStatus("started", url)
                }
                "error" -> {
                    val msg = json.optString("message", "Unknown error")
                    broadcastStatus("error", msg)
                }
            }
        } catch (e: Exception) {
            broadcastStatus("error", "Bridge parse error: ${e.message}")
        }
    }

    // ── Broadcast helpers ──────────────────────────────────────────────────────

    private fun broadcastStatus(type: String, payload: String?) {
        val intent = Intent(BROADCAST_STATUS).apply {
            putExtra(EXTRA_STATUS_TYPE, type)
            if (payload != null) putExtra(EXTRA_SERVER_URL, payload)
        }
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
    }

    // ── Wake/WiFi locks ────────────────────────────────────────────────────────

    private fun acquireWakeLock() {
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "HttpFileServer:ServerLock")
            .also { it.acquire(12 * 60 * 60 * 1000L) } // 12 h max

        val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "HttpFileServer:WifiLock")
            .also { it.acquire() }
    }

    private fun releaseWakeLock() {
        runCatching { wakeLock?.takeIf { it.isHeld }?.release() }
        runCatching { wifiLock?.takeIf { it.isHeld }?.release() }
    }

    // ── Notification ───────────────────────────────────────────────────────────

    private fun buildNotification(text: String): Notification {
        val tapIntent = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val stopIntent = PendingIntent.getService(
            this, 1,
            Intent(this, ServerService::class.java).apply { action = ACTION_STOP },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_share)
            .setContentIntent(tapIntent)
            .addAction(android.R.drawable.ic_media_pause, "Stop", stopIntent)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(text: String) {
        val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        mgr.notify(NOTIFICATION_ID, buildNotification(text))
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "File Server", NotificationManager.IMPORTANCE_LOW
            ).apply { description = "LAN File Server background service" }
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                .createNotificationChannel(channel)
        }
    }

    private fun defaultRootPath(): String =
        android.os.Environment
            .getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS)
            .absolutePath
}
