// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
package it.amicoen.horizon;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.TimeUnit;

/**
 * Collegamento con un server APRS della Open Glider Network: solo Java, senza Android, così si prova da solo.
 * Un thread legge (login, righe degli altri aeromobili, segni di vita del server), un altro scrive le righe di posizione.
 * Il protocollo è testo in chiaro su TCP: quello che parte è la posizione che il pilota ha scelto di rendere pubblica.
 */
final class OgnLink {

    /** Chi ascolta: lo stato del collegamento e le righe ricevute (già raggruppate, mai più di una chiamata ogni RIGHE_MS). */
    interface Ascolto {
        void stato(boolean attivo, boolean collegato, boolean verificato, String server, String errore);
        void righe(String righe, int quante);
    }

    static final int T_CONNESSIONE = 10000;      // ms per aprire il collegamento
    static final int T_SILENZIO = 60000;         // il server si fa vivo ogni 20 s: 60 s di silenzio = collegamento morto
    static final int ATTESA_MIN = 2000;          // prima attesa prima di riprovare; poi raddoppia
    static final int ATTESA_MAX = 300000;        // fino a 5 minuti: senza rete non si consuma la batteria a riprovare
    static final int RIGA_MAX = 512;             // una riga più lunga non è APRS: si butta
    static final int RIGHE_MS = 500;             // le righe ricevute vanno al JS al massimo due volte al secondo…
    static final int RIGHE_N = 40;               // …e al massimo 40 per volta: il resto si perde (traffico fitto, non serve tutto)
    static final int INVIO_MS = 1000;            // mai più di una riga al secondo verso OGN, qualunque cosa chieda il JS
    static final long INATTIVO_MS = 600000;      // 10 minuti senza inviare niente (app in sottofondo): si chiude da solo

    private final String host;
    private final int porta;
    private final Ascolto ascolto;
    private final ArrayBlockingQueue<String> coda = new ArrayBlockingQueue<>(4);   // corta e fissa: se è piena si rifiuta
    private final Object sonno = new Object();

    private volatile boolean run = false, collegato = false, verificato = false, pausa = false;
    private volatile int giro = 0;               // cambia a ogni avvia/stop: i thread vecchi si accorgono e finiscono
    private volatile Socket sock;
    private volatile String server = "", errore = "", utente = "";
    private volatile long ultimoInvio = 0, avviato = 0;
    private String login = "";
    private int attesaMs = T_SILENZIO, attesaMin = ATTESA_MIN;

    OgnLink(String host, int porta, Ascolto ascolto) { this.host = host; this.porta = porta; this.ascolto = ascolto; }

    /** Solo per le prove: tempi corti. */
    void tempi(int silenzioMs, int attesaMinMs) { attesaMs = silenzioMs; attesaMin = attesaMinMs; }

    boolean attivo() { return run; }
    boolean collegato() { return collegato; }
    boolean verificato() { return verificato; }
    String server() { return server; }
    String errore() { return errore; }

    /** Lettere, cifre e pochi segni: niente spazi né a capo dentro la riga di login. */
    static String pulito(String s, int max) {
        if (s == null) return "";
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < s.length() && b.length() < max; i++) {
            char c = s.charAt(i);
            if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' || c == '.' || c == '_') b.append(c);
        }
        return b.toString();
    }

    /** Apre il collegamento (o lo riapre se i dati del login sono cambiati). Torna subito: il lavoro è nei thread. */
    synchronized String avvia(String ut, String pass, String app, String vers, int km) {
        String u = pulito(ut, 9).toUpperCase();
        String p = pulito(pass, 5);
        if (u.length() < 3 || !p.matches("\\d{1,5}")) return "utente o passcode non validi";
        String a = pulito(app, 16), v = pulito(vers, 16);
        int f = Math.max(5, Math.min(50, km));       // il filtro resta piccolo: OGN chiede di non tirare giù dati inutili
        String l = "user " + u + " pass " + p + " vers " + (a.isEmpty() ? "app" : a) + " " + (v.isEmpty() ? "0" : v) + " filter m/" + f + "\r\n";
        if (run && l.equals(login)) return null;     // già in piedi con gli stessi dati
        ferma();
        login = l; utente = u; errore = ""; server = "";
        run = true; avviato = System.currentTimeMillis(); ultimoInvio = 0;
        final int g = ++giro;
        Thread r = new Thread(() -> leggi(g), "ogn"); r.setDaemon(true); r.start();
        Thread w = new Thread(() -> scrivi(g), "ogn-tx"); w.setDaemon(true); w.start();
        return null;
    }

    synchronized void stop() { ferma(); errore = ""; avvisa(); }

    private void ferma() {
        run = false; giro++; collegato = false; verificato = false;
        coda.clear();
        Socket s = sock; sock = null;
        try { if (s != null) s.close(); } catch (Exception ignored) { }      // sblocca la lettura e la scrittura
        synchronized (sonno) { sonno.notifyAll(); }                         // e l'attesa prima di riprovare
    }

    /** App in sottofondo: le righe ricevute non servono a nessuno e non devono accumularsi. */
    void pausa(boolean p) { pausa = p; }

    /** Mette in partenza una riga. Torna null se accettata, altrimenti il motivo. Non aspetta mai la rete. */
    String invia(String riga) {
        if (!run || !collegato) return "non collegato";
        if (!verificato) return "non verificato";
        if (riga == null) return "riga vuota";
        String r = riga.trim();
        if (r.length() < 12 || r.length() > 250) return "riga non valida";
        for (int i = 0; i < r.length(); i++) { char c = r.charAt(i); if (c < 0x20 || c > 0x7e) return "riga non valida"; }
        if (!r.startsWith(utente + ">")) return "riga non valida";           // si parla solo a nome proprio
        long now = System.currentTimeMillis();
        if (now - ultimoInvio < INVIO_MS) return "troppo presto";
        if (!coda.offer(r)) return "occupato";
        ultimoInvio = now;
        return null;
    }

    private void avvisa() {
        try { ascolto.stato(run, collegato, verificato, server, errore); } catch (Throwable ignored) { }
    }

    private void leggi(int g) {
        int attesa = attesaMin;
        byte[] buf = new byte[2048];
        while (run && g == giro) {
            Socket s = new Socket();
            long su = 0;
            boolean fine = false;
            try {
                InetAddress[] tutti = InetAddress.getAllByName(host);       // DNS a ogni tentativo: OGN ha più server e li fa girare
                InetAddress ip = tutti[(int) (Math.random() * tutti.length)];
                s.connect(new InetSocketAddress(ip, porta), T_CONNESSIONE);
                s.setSoTimeout(attesaMs);
                s.setTcpNoDelay(true);
                if (!run || g != giro) { s.close(); break; }
                sock = s;
                OutputStream out = s.getOutputStream();
                synchronized (this) { if (g != giro) break; out.write(login.getBytes(StandardCharsets.US_ASCII)); out.flush(); }
                collegato = true; verificato = false; errore = ""; su = System.currentTimeMillis();
                avvisa();
                InputStream in = s.getInputStream();
                StringBuilder riga = new StringBuilder(), pacco = new StringBuilder();
                boolean lunga = false;
                int nPacco = 0;
                long ultimoPacco = 0;
                while (run && g == giro) {
                    int n = in.read(buf);                                    // niente per T_SILENZIO → eccezione → si chiude e si riparte
                    if (n < 0) throw new java.io.EOFException("chiuso dal server");
                    for (int i = 0; i < n; i++) {
                        char c = (char) (buf[i] & 0xff);
                        if (c == '\n' || c == '\r') {
                            if (riga.length() > 0 && !lunga) {
                                String r = riga.toString();
                                if (r.charAt(0) == '#') { if (r.startsWith("# logresp")) logresp(r); }
                                else if (!pausa && nPacco < RIGHE_N) { if (nPacco > 0) pacco.append('\n'); pacco.append(r); nPacco++; }
                            }
                            riga.setLength(0); lunga = false;
                        } else if (riga.length() < RIGA_MAX) riga.append(c >= 0x20 && c < 0x7f ? c : '?');
                        else lunga = true;
                    }
                    long now = System.currentTimeMillis();
                    if (nPacco > 0 && now - ultimoPacco >= RIGHE_MS) {
                        ultimoPacco = now;
                        try { ascolto.righe(pacco.toString(), nPacco); } catch (Throwable ignored) { }
                        pacco.setLength(0); nPacco = 0;
                    }
                    if (now - Math.max(ultimoInvio, avviato) > INATTIVO_MS) { fine = true; throw new java.io.IOException("inattivo"); }
                }
            } catch (Throwable e) {
                if (run && g == giro) errore = motivo(e);
            } finally {
                try { s.close(); } catch (Exception ignored) { }
                if (g == giro) { if (sock == s) sock = null; collegato = false; verificato = false; coda.clear(); }
            }
            if (!run || g != giro) break;
            if (fine) { synchronized (this) { if (g == giro) { run = false; giro++; } } avvisa(); break; }
            avvisa();
            if (su > 0 && System.currentTimeMillis() - su > 30000) attesa = attesaMin;   // era andato bene: si riparte in fretta
            long fino = System.currentTimeMillis() + attesa + (long) (Math.random() * attesa * 0.2);
            synchronized (sonno) {
                while (run && g == giro) { long d = fino - System.currentTimeMillis(); if (d <= 0) break; try { sonno.wait(d); } catch (InterruptedException e) { break; } }
            }
            attesa = Math.min(ATTESA_MAX, attesa * 2);
        }
    }

    /** «# logresp OGN123456 verified, server GLIDERN4»: senza «verified» il server accetta il collegamento ma butta le nostre righe. */
    private void logresp(String r) {
        verificato = r.contains(" verified") && !r.contains("unverified");
        int i = r.indexOf("server ");
        server = i >= 0 ? pulito(r.substring(i + 7), 16) : "";
        if (!verificato) errore = "identificativo non accettato";
        avvisa();
    }

    /** Solo il tipo di errore: niente indirizzi né dati del telefono nei messaggi. */
    private static String motivo(Throwable e) {
        if (e instanceof java.net.UnknownHostException) return "senza rete (DNS)";
        if (e instanceof java.net.SocketTimeoutException) return "il server non risponde";
        if (e instanceof java.net.ConnectException || e instanceof java.net.NoRouteToHostException) return "server non raggiungibile";
        if (e instanceof java.io.EOFException) return "chiuso dal server";
        if ("inattivo".equals(e.getMessage())) return "inattivo";
        return "collegamento caduto";
    }

    private void scrivi(int g) {
        while (run && g == giro) {
            try {
                String r = coda.poll(1, TimeUnit.SECONDS);
                if (r == null) continue;
                Socket s = sock;
                if (s == null || !collegato || !verificato) continue;        // caduto nel frattempo: la riga è vecchia, si butta
                OutputStream out = s.getOutputStream();
                out.write((r + "\r\n").getBytes(StandardCharsets.US_ASCII));
                out.flush();
            } catch (InterruptedException e) {
                return;
            } catch (Throwable e) {                                          // scrittura fallita: chiudo, il lettore se ne accorge e riparte
                Socket s = sock;
                try { if (s != null) s.close(); } catch (Exception ignored) { }
            }
        }
    }
}
