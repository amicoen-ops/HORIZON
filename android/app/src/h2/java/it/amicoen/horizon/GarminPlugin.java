// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
package it.amicoen.horizon;

import com.garmin.android.connectiq.ConnectIQ;
import com.garmin.android.connectiq.IQApp;
import com.garmin.android.connectiq.IQDevice;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

/**
 * Orologio Garmin (solo HORIZON 2): collegamento con l'app «HORIZON Link» sull'orologio, tramite Garmin Connect.
 * avvia: prepara il collegamento e si iscrive ai messaggi degli orologi conosciuti.
 * Eventi: «dati» (messaggi dall'orologio), «stato» (orologio collegato o no, errori).
 * invia: manda un messaggio all'app dell'orologio (dati da mostrare, avvisi). apri: apre l'app sull'orologio.
 */
@CapacitorPlugin(name = "Garmin")
public class GarminPlugin extends Plugin {

    static final String APP_ID = "5d505a6e03c1428a9fc989338552bf61";   // uguale a garmin/manifest.xml
    private ConnectIQ ciq;
    private boolean pronto = false;
    private IQDevice orologio;
    private final IQApp app = new IQApp(APP_ID);
    private String errore = "";

    @PluginMethod
    public void avvia(PluginCall call) {
        if (ciq != null) { call.resolve(stato()); collega(); return; }
        try {
            ciq = ConnectIQ.getInstance(getContext(), ConnectIQ.IQConnectType.WIRELESS);
            ciq.initialize(getContext(), true, new ConnectIQ.ConnectIQListener() {
                @Override public void onSdkReady() { pronto = true; errore = ""; collega(); }
                @Override public void onInitializeError(ConnectIQ.IQSdkErrorStatus s) { pronto = false; errore = "Garmin Connect: " + s; notifica(); }
                @Override public void onSdkShutDown() { pronto = false; notifica(); }
            });
            call.resolve(stato());
        } catch (Exception e) {
            errore = String.valueOf(e.getMessage());
            call.reject("Garmin non disponibile: " + errore);
        }
    }

    private void collega() {
        if (!pronto || ciq == null) return;
        try {
            List<IQDevice> L = ciq.getKnownDevices();
            if (L == null || L.isEmpty()) { errore = "nessun orologio associato in Garmin Connect"; notifica(); return; }
            for (IQDevice d : L) {
                ciq.registerForDeviceEvents(d, (dev, st) -> {
                    if (st == IQDevice.IQDeviceStatus.CONNECTED) orologio = dev;
                    else if (orologio != null && orologio.getDeviceIdentifier() == dev.getDeviceIdentifier()) orologio = null;
                    notifica();
                });
                ciq.registerForAppEvents(d, app, (dev, a, messaggi, st) -> {
                    if (st != ConnectIQ.IQMessageStatus.SUCCESS || messaggi == null) return;
                    orologio = dev;
                    for (Object m : messaggi) {
                        JSObject o = converti(m);
                        if (o != null) notifyListeners("dati", o);
                    }
                });
                try { if (ciq.getDeviceStatus(d) == IQDevice.IQDeviceStatus.CONNECTED) orologio = d; } catch (Exception ignored) { }
            }
            errore = "";
            notifica();
        } catch (Exception e) {
            errore = String.valueOf(e.getMessage());
            notifica();
        }
    }

    @PluginMethod
    public void invia(PluginCall call) {
        JSObject m = call.getObject("msg");
        if (ciq == null || orologio == null || m == null) { call.reject("orologio non collegato"); return; }
        Map<String, Object> out = new HashMap<>();
        Iterator<String> it = m.keys();
        while (it.hasNext()) {
            String k = it.next();
            Object v = m.opt(k);
            if (v instanceof Double) { double x = (Double) v; out.put(k, (float) x); }       // l'orologio legge meglio i Float
            else if (v instanceof Integer || v instanceof Long || v instanceof String || v instanceof Boolean || v instanceof Float) out.put(k, v);
            else if (v != null) out.put(k, String.valueOf(v));
        }
        try {
            ciq.sendMessage(orologio, app, out, (dev, a, st) -> { });
            call.resolve();
        } catch (Exception e) {
            call.reject("invio non riuscito: " + e.getMessage());
        }
    }

    @PluginMethod
    public void apri(PluginCall call) {
        if (ciq == null || orologio == null) { call.reject("orologio non collegato"); return; }
        try {
            ciq.openApplication(orologio, app, (dev, a, st) -> { JSObject o = new JSObject(); o.put("apri", String.valueOf(st)); call.resolve(o); });
        } catch (Exception e) {
            call.reject("apertura non riuscita: " + e.getMessage());
        }
    }

    @PluginMethod
    public void info(PluginCall call) { call.resolve(stato()); }

    private JSObject stato() {
        JSObject o = new JSObject();
        o.put("pronto", pronto);
        o.put("collegato", orologio != null);
        o.put("nome", orologio != null ? orologio.getFriendlyName() : "");
        o.put("errore", errore);
        return o;
    }

    private void notifica() { notifyListeners("stato", stato()); }

    // il messaggio dell'orologio (dizionario Monkey C) in un oggetto JavaScript
    private static JSObject converti(Object m) {
        if (!(m instanceof Map)) return null;
        JSObject o = new JSObject();
        for (Object e : ((Map<?, ?>) m).entrySet()) {
            Map.Entry<?, ?> en = (Map.Entry<?, ?>) e;
            String k = String.valueOf(en.getKey());
            Object v = en.getValue();
            if (v instanceof Number) o.put(k, ((Number) v).doubleValue());
            else if (v instanceof Boolean) o.put(k, (Boolean) v);
            else if (v instanceof List) { JSArray a = new JSArray(); for (Object x : (List<?>) v) a.put(x); o.put(k, a); }
            else if (v != null) o.put(k, String.valueOf(v));
        }
        return o;
    }

    @Override
    protected void handleOnDestroy() {
        try { if (ciq != null) ciq.shutdown(getContext()); } catch (Exception ignored) { }
    }
}
