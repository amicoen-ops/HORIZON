// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
package it.amicoen.horizon;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Aggiornamenti dall'app.
 *  · APK di GitHub: scarica il nuovo APK e apre l'installazione di Android (l'utente conferma).
 *  · Google Play: aggiornamento dentro l'app con il sistema di Google (Play In-App Updates).
 */
@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {

    private AppUpdateManager play;
    private AppUpdateInfo playInfo;

    // ---------- APK ----------
    @PluginMethod
    public void apkDownload(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !url.startsWith("https://")) { call.reject("indirizzo non valido"); return; }
        new Thread(() -> {
            HttpURLConnection c = null;
            try {
                File dir = new File(getContext().getCacheDir(), "aggiornamento");
                if (!dir.exists() && !dir.mkdirs()) throw new Exception("cartella non creata");
                File out = new File(dir, "HORIZON.apk");
                String u = url;
                for (int hop = 0; hop < 6; hop++) {                       // GitHub rimanda a un altro indirizzo per il file
                    c = (HttpURLConnection) new URL(u).openConnection();
                    c.setInstanceFollowRedirects(false); c.setConnectTimeout(15000); c.setReadTimeout(30000);
                    int code = c.getResponseCode();
                    if (code >= 300 && code < 400) { u = c.getHeaderField("Location"); c.disconnect(); continue; }
                    if (code != 200) throw new Exception("risposta " + code);
                    break;
                }
                long total = c.getContentLengthLong(), done = 0, lastEvt = 0;
                try (InputStream in = c.getInputStream(); FileOutputStream fo = new FileOutputStream(out)) {
                    byte[] buf = new byte[64 * 1024]; int n;
                    while ((n = in.read(buf)) > 0) {
                        fo.write(buf, 0, n); done += n;
                        long now = System.currentTimeMillis();
                        if (now - lastEvt > 250) { lastEvt = now; JSObject p = new JSObject(); p.put("done", done); p.put("total", total); notifyListeners("progress", p); }
                    }
                }
                if (done < 100_000) throw new Exception("file troppo piccolo");
                JSObject r = new JSObject(); r.put("path", out.getAbsolutePath()); r.put("size", done);
                call.resolve(r);
            } catch (Exception e) {
                call.reject("download non riuscito: " + e.getMessage());
            } finally { if (c != null) c.disconnect(); }
        }).start();
    }

    @PluginMethod
    public void apkInstall(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
                Intent s = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
                s.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(s);
                JSObject r = new JSObject(); r.put("needPermission", true); call.resolve(r); return;
            }
            File f = new File(call.getString("path", ""));
            if (!f.exists()) { call.reject("file dell'aggiornamento non trovato"); return; }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            JSObject r = new JSObject(); r.put("started", true); call.resolve(r);
        } catch (Exception e) { call.reject("installazione non avviata: " + e.getMessage()); }
    }

    // ---------- Google Play ----------
    @PluginMethod
    public void playCheck(PluginCall call) {
        try {
            if (play == null) play = AppUpdateManagerFactory.create(getContext());
            play.getAppUpdateInfo().addOnSuccessListener(info -> {
                playInfo = info;
                JSObject r = new JSObject();
                r.put("available", info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                    || info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS);
                r.put("versionCode", info.availableVersionCode());
                r.put("immediate", info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE));
                Integer st = info.clientVersionStalenessDays(); r.put("staleDays", st == null ? -1 : st);
                call.resolve(r);
            }).addOnFailureListener(e -> { JSObject r = new JSObject(); r.put("available", false); r.put("error", String.valueOf(e.getMessage())); call.resolve(r); });
        } catch (Exception e) { JSObject r = new JSObject(); r.put("available", false); r.put("error", String.valueOf(e.getMessage())); call.resolve(r); }
    }

    @PluginMethod
    public void playStart(PluginCall call) {
        if (play == null || playInfo == null) { call.reject("controlla prima l'aggiornamento"); return; }
        try {
            play.startUpdateFlow(playInfo, getActivity(), AppUpdateOptions.defaultOptions(AppUpdateType.IMMEDIATE))
                .addOnSuccessListener(code -> { JSObject r = new JSObject(); r.put("result", code); call.resolve(r); })
                .addOnFailureListener(e -> call.reject("aggiornamento non avviato: " + e.getMessage()));
        } catch (Exception e) { call.reject("aggiornamento non avviato: " + e.getMessage()); }
    }
}
