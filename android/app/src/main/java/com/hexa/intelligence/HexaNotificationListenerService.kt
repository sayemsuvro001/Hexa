package com.hexa.intelligence

import android.app.Notification
import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

class HexaNotificationListenerService : NotificationListenerService() {

    companion object {
        const val PREFS_NAME = "hexa_notif_store"
        const val KEY_NOTIFS = "notifications_json"
        private const val MAX_STORED = 150
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return
        val extras = sbn.notification?.extras ?: return
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim().orEmpty()
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.trim().orEmpty()
        if (title.isEmpty() && text.isEmpty()) return

        val pkg = sbn.packageName ?: "unknown"
        val appName = try {
            val ai = packageManager.getApplicationInfo(pkg, 0)
            packageManager.getApplicationLabel(ai).toString()
        } catch (_: Exception) {
            pkg
        }

        val category = when (sbn.notification?.category) {
            Notification.CATEGORY_MESSAGE, Notification.CATEGORY_EMAIL -> "message"
            Notification.CATEGORY_ALARM, Notification.CATEGORY_REMINDER -> "reminder"
            Notification.CATEGORY_SYSTEM, Notification.CATEGORY_SERVICE -> "system"
            Notification.CATEGORY_ERROR -> "security"
            else -> "general"
        }

        val item = JSONObject().apply {
            put("id", "android_${sbn.key}_${sbn.postTime}")
            put("appName", appName)
            put("packageName", pkg)
            put("title", title.ifEmpty { appName })
            put("body", text)
            put("category", category)
            put("receivedAt", sbn.postTime)
            put("dismissed", false)
            put("read", false)
            put("priority", "normal")
            put("source", "android-bridge")
        }

        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val existing = try {
            JSONArray(prefs.getString(KEY_NOTIFS, "[]") ?: "[]")
        } catch (_: Exception) {
            JSONArray()
        }

        val next = JSONArray()
        next.put(item)
        for (i in 0 until minOf(existing.length(), MAX_STORED - 1)) {
            val prevObj = existing.optJSONObject(i) ?: continue
            if (prevObj.optString("id") != item.optString("id")) {
                next.put(prevObj)
            }
        }
        prefs.edit().putString(KEY_NOTIFS, next.toString()).apply()
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        sbn ?: return
        val targetId = "android_${sbn.key}_${sbn.postTime}"
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val existing = try {
            JSONArray(prefs.getString(KEY_NOTIFS, "[]") ?: "[]")
        } catch (_: Exception) {
            return
        }
        var changed = false
        for (i in 0 until existing.length()) {
            val obj = existing.optJSONObject(i) ?: continue
            if (obj.optString("id") == targetId) {
                obj.put("dismissed", true)
                changed = true
            }
        }
        if (changed) {
            prefs.edit().putString(KEY_NOTIFS, existing.toString()).apply()
        }
    }
}
