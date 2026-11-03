// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
package it.amicoen.horizon;

import android.content.Context;
import android.net.wifi.WifiManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetSocketAddress;
import java.util.List;

/**
 * Ricevitore GDL90 su UDP (porta 4000 di serie): il traffico che SafeSky Premium manda alle app di navigazione
 * («Condivisione del traffico» › altro software GDL90), e anche SkyEcho, PilotAware o Stratux sul WiFi.
 * Evento "traffico" per ogni aereo letto: {proprio, addr, tipo, lat, lon, altFt, kt, fpm, trk, inVolo, cat, cs}.
 */
@CapacitorPlugin(name = "Gdl90")
public class Gdl90Plugin extends Plugin {

    private DatagramSocket sock;
    private Thread th;
    private volatile boolean run = false;
    private WifiManager.MulticastLock lock;
    private final Gdl90Parser parser = new Gdl90Parser();
    private volatile long pacchetti = 0, aerei = 0, ultimo = 0;
    private int porta = 4000;
    private String errore = "";

    @PluginMethod
    public void start(PluginCall call) {
        int p = call.getInt("porta", 4000);
        if (run && sock != null && p == porta) { call.resolve(stato()); return; }
        chiudi();
        porta = p;
        try {
            sock = new DatagramSocket(null);
            sock.setReuseAddress(true);
            sock.setBroadcast(true);
            sock.bind(new InetSocketAddress(porta));
        } catch (Exception e) {
            errore = "porta " + porta + " occupata: " + e.getMessage();
            chiudi();
            call.reject(errore);
            return;
        }
        try {   // i pacchetti in broadcast sul WiFi (SkyEcho, Stratux) arrivano solo con questo blocco
            WifiManager wm = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null) { lock = wm.createMulticastLock("horizon-gdl90"); lock.setReferenceCounted(false); lock.acquire(); }
        } catch (Exception ignored) { }
        errore = "";
        run = true;
        th = new Thread(this::ascolta, "gdl90");
        th.setDaemon(true);
        th.start();
        call.resolve(stato());
    }

    @PluginMethod
    public void stop(PluginCall call) { chiudi(); call.resolve(); }

    @PluginMethod
    public void status(PluginCall call) { call.resolve(stato()); }

    private JSObject stato() {
        JSObject r = new JSObject();
        r.put("attivo", run);
        r.put("porta", porta);
        r.put("pacchetti", pacchetti);
        r.put("aerei", aerei);
        r.put("scartati", parser.bad);
        r.put("ultimo", ultimo);
        r.put("errore", errore);
        return r;
    }

    private void ascolta() {
        byte[] buf = new byte[4096];
        while (run) {
            try {
                DatagramPacket p = new DatagramPacket(buf, buf.length);
                sock.receive(p);
                pacchetti++;
                List<Gdl90Parser.Target> l;
                synchronized (parser) { l = parser.parse(buf, p.getLength()); }
                for (Gdl90Parser.Target t : l) {
                    aerei++;
                    ultimo = System.currentTimeMillis();
                    JSObject o = new JSObject();
                    o.put("proprio", t.proprio);
                    o.put("addr", t.addr);
                    o.put("tipo", t.addrType);
                    o.put("lat", t.lat);
                    o.put("lon", t.lon);
                    if (!Double.isNaN(t.altFt)) o.put("altFt", t.altFt);
                    if (!Double.isNaN(t.kt)) o.put("kt", t.kt);
                    if (!Double.isNaN(t.fpm)) o.put("fpm", t.fpm);
                    o.put("trk", t.trk);
                    o.put("inVolo", t.inVolo);
                    o.put("cat", t.cat);
                    o.put("cs", t.cs);
                    notifyListeners("traffico", o);
                }
            } catch (Exception e) {
                if (run) { errore = String.valueOf(e.getMessage()); try { Thread.sleep(500); } catch (InterruptedException ignored) { } }
            }
        }
    }

    private void chiudi() {
        run = false;
        try { if (sock != null) sock.close(); } catch (Exception ignored) { }
        sock = null;
        try { if (lock != null && lock.isHeld()) lock.release(); } catch (Exception ignored) { }
        lock = null;
    }

    @Override
    protected void handleOnDestroy() { chiudi(); }
}
