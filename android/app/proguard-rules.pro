# HEXA ProGuard Rules
-keepattributes *Annotation*
-keepclassmembers class com.hexa.intelligence.HexaAndroidBridge {
    @android.webkit.JavascriptInterface <methods>;
}
