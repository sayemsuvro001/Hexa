package com.hexa.intelligence

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class HexaPowerReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        context ?: return
        val action = intent?.action ?: return
        val prefs = context.getSharedPreferences("hexa_power_events", Context.MODE_PRIVATE)
        if (action == Intent.ACTION_POWER_CONNECTED) {
            prefs.edit().putLong("last_connected_ms", System.currentTimeMillis()).apply()
        } else if (action == Intent.ACTION_POWER_DISCONNECTED) {
            prefs.edit().putLong("last_disconnected_ms", System.currentTimeMillis()).apply()
        }
    }
}
