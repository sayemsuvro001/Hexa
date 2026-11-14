package com.hexa.intelligence

import android.app.ActivityManager
import android.app.AlarmManager
import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.os.Process
import android.os.StatFs
import android.os.SystemClock
import android.provider.AlarmClock
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.RandomAccessFile
import java.util.Calendar

class HexaAndroidBridge(private val context: Context) {

    private var prevCpuTotal = 0L
    private var prevCpuIdle = 0L
    private val mainHandler = Handler(Looper.getMainLooper())
    private var overlayView: View? = null

    @JavascriptInterface
    fun getDeviceRamInfo(): String {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val memInfo = ActivityManager.MemoryInfo()
        am.getMemoryInfo(memInfo)
        val total = memInfo.totalMem
        val avail = memInfo.availMem
        val used = (total - avail).coerceAtLeast(0L)
        val pct = if (total > 0) ((used.toDouble() / total.toDouble()) * 1000.0).toInt() / 10.0 else 0.0
        return JSONObject().apply {
            put("totalBytes", total)
            put("availableBytes", avail)
            put("usedBytes", used)
            put("usagePercent", pct)
        }.toString()
    }

    @JavascriptInterface
    fun getStorageInfo(): String {
        val stat = StatFs(Environment.getDataDirectory().path)
        val total = stat.totalBytes
        val avail = stat.availableBytes
        val used = (total - avail).coerceAtLeast(0L)
        val pct = if (total > 0) ((used.toDouble() / total.toDouble()) * 1000.0).toInt() / 10.0 else 0.0
        return JSONObject().apply {
            put("totalBytes", total)
            put("availableBytes", avail)
            put("usedBytes", used)
            put("usagePercent", pct)
        }.toString()
    }

    @JavascriptInterface
    fun getCpuInfo(): String {
        val cores = Runtime.getRuntime().availableProcessors()
        val arch = Build.SUPPORTED_ABIS.firstOrNull() ?: "arm64-v8a"
        val model = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && Build.SOC_MODEL.isNotBlank()) {
            Build.SOC_MODEL
        } else {
            Build.HARDWARE
        }

        var usagePercent: Double? = null
        try {
            RandomAccessFile("/proc/stat", "r").use { reader ->
                val line = reader.readLine()
                if (line != null && line.startsWith("cpu ")) {
                    val toks = line.trim().split(Regex("\\s+")).drop(1).mapNotNull { it.toLongOrNull() }
                    if (toks.size >= 5) {
                        val idle = toks[3] + toks[4]
                        val total = toks.sum()
                        if (prevCpuTotal > 0 && total > prevCpuTotal) {
                            val dTotal = total - prevCpuTotal
                            val dIdle = idle - prevCpuIdle
                            usagePercent = (((dTotal - dIdle).toDouble() / dTotal.toDouble()) * 1000.0).toInt() / 10.0
                        }
                        prevCpuTotal = total
                        prevCpuIdle = idle
                    }
                }
            }
        } catch (_: Exception) {
            // /proc/stat restricted on Android 8+ SELinux; return null honestly
        }

        return JSONObject().apply {
            if (usagePercent != null) put("usagePercent", usagePercent) else put("usagePercent", JSONObject.NULL)
            put("cores", cores)
            put("architecture", arch)
            put("model", model)
            put("androidVersion", "Android ${Build.VERSION.RELEASE}")
            put("deviceModel", "${Build.MANUFACTURER} ${Build.MODEL}")
            put("uptimeSeconds", SystemClock.elapsedRealtime() / 1000L)
        }.toString()
    }

    @JavascriptInterface
    fun getBatteryDetails(): String {
        val intent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val levelRaw = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scaleRaw = intent?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
        val level = if (levelRaw >= 0 && scaleRaw > 0) (levelRaw * 100) / scaleRaw else 0

        val status = intent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
            status == BatteryManager.BATTERY_STATUS_FULL

        val tempTenths = intent?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1) ?: -1
        val tempC = if (tempTenths > 0) tempTenths / 10.0 else null

        val healthCode = intent?.getIntExtra(BatteryManager.EXTRA_HEALTH, -1) ?: -1
        val health = when (healthCode) {
            BatteryManager.BATTERY_HEALTH_GOOD -> "Good"
            BatteryManager.BATTERY_HEALTH_OVERHEAT -> "Overheat"
            BatteryManager.BATTERY_HEALTH_DEAD -> "Dead"
            BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE -> "Over Voltage"
            BatteryManager.BATTERY_HEALTH_COLD -> "Cold"
            else -> "Unknown"
        }

        val tech = intent?.getStringExtra(BatteryManager.EXTRA_TECHNOLOGY) ?: "Li-ion"

        return JSONObject().apply {
            put("level", level)
            put("isCharging", isCharging)
            if (tempC != null) put("temperatureCelsius", tempC)
            put("health", health)
            put("technology", tech)
        }.toString()
    }

    @JavascriptInterface
    fun getNextAlarmClock(): String {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val info = am.nextAlarmClock
        return JSONObject().apply {
            put("available", info != null)
            if (info != null) {
                put("triggerTime", info.triggerTime)
                put("package", info.showIntent?.creatorPackage ?: "")
            }
        }.toString()
    }

    @JavascriptInterface
    fun getUsageStatsToday(): String {
        if (!hasUsageAccessPermission()) return "[]"
        val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val cal = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val start = cal.timeInMillis
        val end = System.currentTimeMillis()
        val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, end) ?: emptyList()

        val pm = context.packageManager
        val arr = JSONArray()
        for (stat in stats) {
            if (stat.totalTimeInForeground <= 0) continue
            val appName = try {
                val ai = pm.getApplicationInfo(stat.packageName, 0)
                pm.getApplicationLabel(ai).toString()
            } catch (_: Exception) {
                stat.packageName
            }
            val buckets = JSONArray()
            for (i in 0 until 24) buckets.put(0)

            arr.put(JSONObject().apply {
                put("packageName", stat.packageName)
                put("appName", appName)
                put("category", "Android App")
                put("totalDurationMs", stat.totalTimeInForeground)
                put("sessionsCount", 1)
                put("notificationsCount", 0)
                put("lastUsedAt", stat.lastTimeUsed)
                put("hourlyBucketsMs", buckets)
                put("events", JSONArray())
            })
        }
        return arr.toString()
    }

    @JavascriptInterface
    fun getRecentNotifications(): String {
        val prefs = context.getSharedPreferences(HexaNotificationListenerService.PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(HexaNotificationListenerService.KEY_NOTIFS, "[]") ?: "[]"
    }

    @JavascriptInterface
    fun hasUsageAccessPermission(): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    @JavascriptInterface
    fun hasNotificationListenerPermission(): Boolean {
        return NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
    }

    @JavascriptInterface
    fun hasOverlayPermission(): Boolean {
        return Settings.canDrawOverlays(context)
    }

    @JavascriptInterface
    fun requestUsageAccessPermission() {
        val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    @JavascriptInterface
    fun requestNotificationListenerPermission() {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    @JavascriptInterface
    fun requestOverlayPermission() {
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${context.packageName}")
        ).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    @JavascriptInterface
    fun openDefaultClockApp() {
        val intent = Intent(AlarmClock.ACTION_SHOW_ALARMS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        try {
            context.startActivity(intent)
        } catch (_: Exception) {
        }
    }

    @JavascriptInterface
    fun showFloatingTaskOverlay(title: String, priority: String) {
        if (!Settings.canDrawOverlays(context)) return
        mainHandler.post {
            removeOverlayInternal()
            val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
            val container = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(28, 20, 28, 20)
                background = GradientDrawable().apply {
                    setColor(Color.parseColor("#EA0A1328"))
                    cornerRadius = 16f
                    setStroke(3, Color.parseColor("#00DFFF"))
                }
            }

            val header = TextView(context).apply {
                text = "HEXA TASK · $priority"
                textSize = 10f
                setTextColor(Color.parseColor("#00DFFF"))
            }
            val body = TextView(context).apply {
                text = title
                textSize = 13f
                setTextColor(Color.parseColor("#EAF4FF"))
            }
            container.addView(header)
            container.addView(body)
            container.setOnClickListener { removeOverlayInternal() }

            val params = WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT
            ).apply {
                gravity = Gravity.TOP or Gravity.END
                x = 24
                y = 140
            }

            try {
                wm.addView(container, params)
                overlayView = container
            } catch (_: Exception) {
            }
        }
    }

    @JavascriptInterface
    fun hideFloatingTaskOverlay() {
        mainHandler.post { removeOverlayInternal() }
    }

    private fun removeOverlayInternal() {
        val view = overlayView ?: return
        val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        try {
            wm.removeView(view)
        } catch (_: Exception) {
        }
        overlayView = null
    }
}
