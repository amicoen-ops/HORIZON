# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# I-A517: i moduli nativi sono chiamati da Capacitor per nome (riflessione): restano i nomi delle classi e dei metodi esposti
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    @com.getcapacitor.PluginMethod public <methods>;
    public <init>(...);
}
-keepclassmembers class * { @com.getcapacitor.PluginMethod public <methods>; }
-keep class it.ia517.strumento.MainActivity { *; }
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-dontwarn com.google.errorprone.annotations.**

# HORIZON 2: orologio Garmin (libreria Connect IQ e modulo caricato per nome)
-keep class com.garmin.** { *; }
-dontwarn com.garmin.**
-keep class it.amicoen.horizon.GarminPlugin { *; }
