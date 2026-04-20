package com.httpfileserver

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.httpfileserver.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var serverRunning = false

    // Receiver for status updates from ServerService
    private val statusReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.getStringExtra(ServerService.EXTRA_STATUS_TYPE)) {
                "started" -> {
                    val url = intent.getStringExtra(ServerService.EXTRA_SERVER_URL) ?: return
                    onServerStarted(url)
                }
                "stopped" -> onServerStopped()
                "error" -> {
                    val msg = intent.getStringExtra(ServerService.EXTRA_SERVER_URL) ?: "Unknown error"
                    onServerError(msg)
                }
            }
        }
    }

    private val storagePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        // Re-check after returning from settings
        if (hasStorageAccess()) startServer() else showStorageRationale()
    }

    private val legacyPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        if (grants.values.any { it }) startServer() else showStorageRationale()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnToggle.setOnClickListener {
            if (serverRunning) stopServer() else requestStorageAndStart()
        }

        binding.tvServerUrl.setOnClickListener {
            val url = binding.tvServerUrl.text.toString()
            if (url.startsWith("http")) {
                val clip = getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                clip.setPrimaryClip(android.content.ClipData.newPlainText("Server URL", url))
                Toast.makeText(this, "URL copied", Toast.LENGTH_SHORT).show()
            }
        }

        setUiStopped()
    }

    override fun onResume() {
        super.onResume()
        LocalBroadcastManager.getInstance(this)
            .registerReceiver(statusReceiver, IntentFilter(ServerService.BROADCAST_STATUS))
    }

    override fun onPause() {
        super.onPause()
        LocalBroadcastManager.getInstance(this).unregisterReceiver(statusReceiver)
    }

    // ── Server control ─────────────────────────────────────────────────────────

    private fun requestStorageAndStart() {
        when {
            hasStorageAccess() -> startServer()
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.R -> {
                // Android 11+: request MANAGE_EXTERNAL_STORAGE via settings
                MaterialAlertDialogBuilder(this)
                    .setTitle("Storage access required")
                    .setMessage(
                        "LAN File Server needs access to all files to serve your directories. " +
                        "Tap OK to open Settings and grant \"Allow management of all files\"."
                    )
                    .setPositiveButton("Open Settings") { _, _ ->
                        val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                            Uri.fromParts("package", packageName, null))
                        storagePermissionLauncher.launch(intent)
                    }
                    .setNegativeButton("Cancel", null)
                    .show()
            }
            else -> {
                // Android 9–10: request legacy READ/WRITE permissions
                legacyPermissionLauncher.launch(arrayOf(
                    Manifest.permission.READ_EXTERNAL_STORAGE,
                    Manifest.permission.WRITE_EXTERNAL_STORAGE
                ))
            }
        }
    }

    private fun startServer() {
        setUiStarting()
        val intent = Intent(this, ServerService::class.java).apply {
            action = ServerService.ACTION_START
            putExtra(ServerService.EXTRA_ROOT_PATH, getDefaultRootPath())
            putExtra(ServerService.EXTRA_PORT, 8080)
        }
        ContextCompat.startForegroundService(this, intent)
    }

    private fun stopServer() {
        val intent = Intent(this, ServerService::class.java).apply {
            action = ServerService.ACTION_STOP
        }
        startService(intent)
    }

    // ── UI state ───────────────────────────────────────────────────────────────

    private fun onServerStarted(url: String) {
        serverRunning = true
        binding.btnToggle.text = getString(R.string.btn_stop)
        binding.btnToggle.isEnabled = true
        binding.statusIndicator.setBackgroundResource(R.drawable.status_dot_green)
        binding.tvStatus.text = getString(R.string.status_running)
        binding.tvServerUrl.text = url
        binding.tvServerUrl.visibility = View.VISIBLE
        binding.tvHint.visibility = View.VISIBLE
        binding.qrContainer.visibility = View.VISIBLE
        binding.tvRootPath.text = getDefaultRootPath()
        renderQrCode(url)
    }

    private fun onServerStopped() {
        serverRunning = false
        setUiStopped()
    }

    private fun onServerError(message: String) {
        serverRunning = false
        binding.btnToggle.text = getString(R.string.btn_start)
        binding.btnToggle.isEnabled = true
        binding.statusIndicator.setBackgroundResource(R.drawable.status_dot_red)
        binding.tvStatus.text = getString(R.string.status_error)
        Toast.makeText(this, "Server error: $message", Toast.LENGTH_LONG).show()
    }

    private fun setUiStarting() {
        binding.btnToggle.isEnabled = false
        binding.statusIndicator.setBackgroundResource(R.drawable.status_dot_grey)
        binding.tvStatus.text = getString(R.string.status_starting)
    }

    private fun setUiStopped() {
        serverRunning = false
        binding.btnToggle.text = getString(R.string.btn_start)
        binding.btnToggle.isEnabled = true
        binding.statusIndicator.setBackgroundResource(R.drawable.status_dot_grey)
        binding.tvStatus.text = getString(R.string.status_stopped)
        binding.tvServerUrl.text = ""
        binding.tvServerUrl.visibility = View.GONE
        binding.tvHint.visibility = View.GONE
        binding.qrContainer.visibility = View.GONE
    }

    // ── QR code ────────────────────────────────────────────────────────────────

    private fun renderQrCode(url: String) {
        // Simple QR bitmap via ZXing-like manual encoding is complex;
        // instead we request the Node.js server's built-in QR endpoint
        // and load it into the ImageView.
        val qrUrl = "$url/qr"
        binding.ivQrCode.setImageBitmap(null)
        Thread {
            try {
                val conn = java.net.URL(qrUrl).openConnection() as java.net.HttpURLConnection
                conn.connectTimeout = 3000
                conn.readTimeout = 3000
                conn.connect()
                val bmp = android.graphics.BitmapFactory.decodeStream(conn.inputStream)
                runOnUiThread { binding.ivQrCode.setImageBitmap(bmp) }
            } catch (_: Exception) {
                // QR fetch failed — display URL text instead (already visible)
            }
        }.start()
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private fun hasStorageAccess(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            ContextCompat.checkSelfPermission(
                this, Manifest.permission.READ_EXTERNAL_STORAGE
            ) == PackageManager.PERMISSION_GRANTED
        }
    }

    private fun showStorageRationale() {
        Toast.makeText(this,
            "Storage permission is required to serve files",
            Toast.LENGTH_LONG).show()
    }

    private fun getDefaultRootPath(): String {
        return Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            .absolutePath
    }
}
