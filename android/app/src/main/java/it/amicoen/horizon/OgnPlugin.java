// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
package it.amicoen.horizon;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Open Glider Network: il pilota che lo sceglie trasmette la propria posizione ai server APRS di OGN (TCP, testo in chiaro:
 * è il protocollo di OGN, e quello che parte è pubblico per scelta) e riceve sullo stesso collegamento gli aeromobili vicini.
 * Le righe le compone e le legge www/ogn.js; qui c'è solo il collegamento (OgnLink). Nessun wake lock: si lavora con lo
 * schermo acceso dello strumento, e in sottofondo il collegamento si chiude da solo dopo 10 minuti senza invii.
 * Eventi: "stato" {attivo, collegato, verificato, server, errore}; "riga" {righe, n} (righe separate da \n, al massimo 2 volte al secondo).
 */
@CapacitorPlugin(name = "Ogn")
public class OgnPlugin extends Plugin implements OgnLink.Ascolto {

    static final String HOST = "aprs.glidernet.org";     // l'unico indirizzo: il DNS dà ogni volta uno dei server di OGN
    static final int PORTA = 14580;                      // porta con il filtro scelto dal client

    private final OgnLink link = new OgnLink(HOST, PORTA, this);

    @PluginMethod
    public void avvia(PluginCall call) {
        String err = link.avvia(call.getString("utente", ""), call.getString("passcode", ""),
                call.getString("app", "HORIZON"), call.getString("versione", "0"), call.getInt("filtroKm", 25));
        if (err != null) { call.reject(err); return; }
        call.resolve(stato());
    }

    @PluginMethod
    public void invia(PluginCall call) {
        String err = link.invia(call.getString("riga", ""));
        if (err != null) { call.reject(err); return; }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) { link.stop(); call.resolve(stato()); }

    @PluginMethod
    public void stato(PluginCall call) { call.resolve(stato()); }

    private JSObject stato() {
        JSObject r = new JSObject();
        r.put("attivo", link.attivo());
        r.put("collegato", link.collegato());
        r.put("verificato", link.verificato());
        r.put("server", link.server());
        r.put("errore", link.errore());
        return r;
    }

    @Override
    public void stato(boolean attivo, boolean collegato, boolean verificato, String server, String errore) {
        JSObject r = new JSObject();
        r.put("attivo", attivo);
        r.put("collegato", collegato);
        r.put("verificato", verificato);
        r.put("server", server);
        r.put("errore", errore);
        notifyListeners("stato", r);
    }

    @Override
    public void righe(String righe, int quante) {
        JSObject r = new JSObject();
        r.put("righe", righe);
        r.put("n", quante);
        notifyListeners("riga", r);
    }

    @Override
    protected void handleOnPause() { link.pausa(true); }      // in sottofondo il JS è fermo: niente eventi in coda

    @Override
    protected void handleOnResume() { link.pausa(false); }

    @Override
    protected void handleOnDestroy() { link.stop(); }
}
