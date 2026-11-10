// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
package it.amicoen.horizon;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.SystemClock;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Barometro del telefono (sensore di pressione di Android, presente su molti telefoni di fascia media e alta).
 * Evento "p" {hPa, acc} circa 5 volte al secondo: la pressione dell'aria dove si è (non riportata al mare).
 * L'app la usa per la quota e il vario insieme al GPS: il barometro dà i cambi di quota (pochi metri di rumore),
 * il GPS tiene giusta la quota assoluta.
 */
@CapacitorPlugin(name = "Barometro")
public class BarometroPlugin extends Plugin implements SensorEventListener {

    // Al JavaScript vanno circa 5 letture al secondo: se ne chiedono 20 (50 ms) invece delle 50 di SENSOR_DELAY_GAME,
    // così il telefono non si sveglia per letture che poi si buttano. Non meno di 20: il filtro sotto lascia passare la
    // prima lettura oltre i 190 ms, e con letture rade una consegna in ritardo allungherebbe troppo il passo.
    private static final int PERIODO_US = 50_000;

    private SensorManager sm;
    private Sensor ps;
    private boolean on = false;
    private long last = 0;
    private int accuracy = -1;

    @Override
    public void load() {
        sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sm != null) ps = sm.getDefaultSensor(Sensor.TYPE_PRESSURE);
    }

    @PluginMethod
    public void info(PluginCall call) {
        JSObject r = new JSObject();
        r.put("presente", ps != null);
        if (ps != null) { r.put("nome", ps.getName()); r.put("produttore", ps.getVendor()); r.put("risoluzione", ps.getResolution()); }
        call.resolve(r);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (sm == null || ps == null) { call.reject("barometro non presente su questo telefono"); return; }
        if (!on) { sm.registerListener(this, ps, PERIODO_US); on = true; }
        JSObject r = new JSObject();
        r.put("nome", ps.getName());
        call.resolve(r);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (on && sm != null) sm.unregisterListener(this);
        on = false;
        call.resolve();
    }

    @Override
    public void onSensorChanged(SensorEvent e) {
        long now = SystemClock.elapsedRealtime();           // non l'ora di sistema: se torna indietro il filtro si bloccherebbe
        if (now - last < 190) return;                       // circa 5 al secondo: basta per il vario, poco carico
        last = now;
        float hPa = e.values[0];
        if (!(hPa > 100 && hPa < 1150)) return;
        JSObject o = new JSObject();
        o.put("hPa", (double) hPa);
        o.put("acc", accuracy);
        notifyListeners("p", o);
    }

    @Override
    public void onAccuracyChanged(Sensor s, int acc) { accuracy = acc; }

    @Override
    protected void handleOnPause() { if (on && sm != null) sm.unregisterListener(this); }

    @Override
    protected void handleOnResume() { if (on && sm != null) sm.registerListener(this, ps, PERIODO_US); }

    @Override
    protected void handleOnDestroy() { if (sm != null) sm.unregisterListener(this); on = false; }
}
