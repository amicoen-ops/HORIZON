// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
package it.amicoen.horizon;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.BatteryManager;
import android.telephony.CellInfo;
import android.telephony.CellSignalStrength;
import android.telephony.CellSignalStrengthGsm;
import android.telephony.CellSignalStrengthLte;
import android.telephony.CellSignalStrengthNr;
import android.telephony.CellSignalStrengthWcdma;
import android.telephony.SignalStrength;
import android.telephony.SubscriptionManager;
import android.telephony.TelephonyManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Stato del telefono per la riga di stato: batteria (percentuale, in carica, temperatura) e rete
 * (WIFI o cellulare, generazione 2G/3G/4G/5G, segnale in percentuale).
 * Nessun permesso in più: la potenza del segnale e il tipo di cella vengono da getSignalStrength() (Android 9+).
 */
@CapacitorPlugin(name = "StatoTelefono")
public class StatoTelefonoPlugin extends Plugin {

    private static int pct(int v, int lo, int hi) {
        if (v == Integer.MAX_VALUE || v == CellInfo.UNAVAILABLE) return -1;
        return Math.max(0, Math.min(100, Math.round((v - lo) * 100f / (hi - lo))));
    }

    @PluginMethod
    public void get(PluginCall call) {
        JSObject r = new JSObject();
        Context ctx = getContext();
        // batteria
        try {
            Intent i = ctx.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            if (i != null) {
                int l = i.getIntExtra(BatteryManager.EXTRA_LEVEL, -1), s = i.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
                if (l >= 0 && s > 0) r.put("batt", Math.round(l * 100f / s));
                r.put("carica", i.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) != 0);
                int t = i.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Integer.MIN_VALUE);
                if (t != Integer.MIN_VALUE) r.put("tempC", t / 10.0);
            }
        } catch (Exception ignored) { }
        // rete in uso
        try {
            ConnectivityManager cm = (ConnectivityManager) ctx.getSystemService(Context.CONNECTIVITY_SERVICE);
            Network n = cm != null ? cm.getActiveNetwork() : null;
            NetworkCapabilities nc = n != null ? cm.getNetworkCapabilities(n) : null;
            if (nc == null) { r.put("rete", "NESSUNA"); r.put("internet", false); }
            else {
                r.put("rete", nc.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ? "WIFI"
                        : nc.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ? "CELL" : "ALTRA");
                r.put("internet", nc.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED));
            }
        } catch (Exception ignored) { }
        // segnale del cellulare (SIM dei dati)
        try {
            TelephonyManager tm = (TelephonyManager) ctx.getSystemService(Context.TELEPHONY_SERVICE);
            int sub = SubscriptionManager.getDefaultDataSubscriptionId();
            if (tm != null && sub != SubscriptionManager.INVALID_SUBSCRIPTION_ID) tm = tm.createForSubscriptionId(sub);
            SignalStrength ss = tm != null ? tm.getSignalStrength() : null;
            if (ss != null) {
                String gen = null; int p = -1, rank = 0;
                for (CellSignalStrength c : ss.getCellSignalStrengths()) {
                    String g; int q, k;
                    if (c instanceof CellSignalStrengthNr) { g = "5G"; k = 4; q = pct(((CellSignalStrengthNr) c).getSsRsrp(), -120, -80); }
                    else if (c instanceof CellSignalStrengthLte) { g = "4G"; k = 3; q = pct(((CellSignalStrengthLte) c).getRsrp(), -120, -80); }
                    else if (c instanceof CellSignalStrengthWcdma) { g = "3G"; k = 2; q = pct(c.getDbm(), -110, -60); }
                    else if (c instanceof CellSignalStrengthGsm) { g = "2G"; k = 1; q = pct(c.getDbm(), -110, -60); }
                    else { g = null; k = 0; q = -1; }
                    if (q < 0) q = c.getLevel() * 25;
                    if (g != null && k > rank) { rank = k; gen = g; p = q; }
                }
                if (gen != null) { r.put("gen", gen); r.put("pct", p); }
                else if (ss.getLevel() > 0) r.put("pct", ss.getLevel() * 25);
                r.put("livello", ss.getLevel());
            }
        } catch (Exception ignored) { }
        call.resolve(r);
    }
}
