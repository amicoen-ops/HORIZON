// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
package it.amicoen.horizon;

import java.util.ArrayList;
import java.util.List;

/**
 * Lettura dei messaggi GDL90 (protocollo aperto di Garmin, usato da SafeSky, SkyEcho, PilotAware, Stratux).
 * Un pacchetto UDP contiene uno o più messaggi racchiusi da 0x7E, con i byte 0x7E e 0x7D "scappati" (0x7D, b^0x20)
 * e due byte di controllo CRC-CCITT in coda (prima il meno significativo).
 * Si leggono il messaggio 20 (traffico) e il 10 (il proprio aereo). Nessuna dipendenza da Android: si prova anche sul PC.
 */
public final class Gdl90Parser {

    /** Un aereo: traffico (msg 20) o il proprio (msg 10). I valori non disponibili sono NaN. */
    public static final class Target {
        public boolean proprio;
        public int addrType;
        public String addr;
        public double lat, lon;
        public double altFt = Double.NaN;      // quota riportata (25 ft di risoluzione)
        public double kt = Double.NaN;         // velocità orizzontale
        public double fpm = Double.NaN;        // velocità verticale
        public double trk;                     // traccia o prua, gradi
        public boolean inVolo;
        public int cat;
        public String cs = "";
    }

    private static final int[] TABLE = new int[256];
    static {
        for (int i = 0; i < 256; i++) {
            int crc = (i << 8) & 0xFFFF;
            for (int b = 0; b < 8; b++) crc = ((crc << 1) ^ ((crc & 0x8000) != 0 ? 0x1021 : 0)) & 0xFFFF;
            TABLE[i] = crc;
        }
    }

    public static int crc(byte[] m, int len) {
        int crc = 0;
        for (int i = 0; i < len; i++) crc = (TABLE[(crc >>> 8) & 0xFF] ^ (crc << 8) ^ (m[i] & 0xFF)) & 0xFFFF;
        return crc;
    }

    public int frames = 0, bad = 0;

    /** Legge tutti i messaggi di un pacchetto e restituisce gli aerei trovati. */
    public List<Target> parse(byte[] buf, int len) {
        List<Target> out = new ArrayList<>();
        int i = 0;
        while (i < len) {
            while (i < len && buf[i] != 0x7E) i++;
            int start = ++i;
            while (i < len && buf[i] != 0x7E) i++;
            if (i >= len) break;
            int end = i;                          // buf[end] è il 0x7E di chiusura
            if (end - start < 3) continue;        // due 0x7E di fila: il secondo apre il messaggio successivo
            byte[] m = new byte[end - start];
            int n = 0;
            for (int k = start; k < end; k++) {
                byte b = buf[k];
                if (b == 0x7D && k + 1 < end) { b = (byte) (buf[++k] ^ 0x20); }
                m[n++] = b;
            }
            frames++;
            if (n < 3) { bad++; continue; }
            int fcs = (m[n - 2] & 0xFF) | ((m[n - 1] & 0xFF) << 8);
            if (crc(m, n - 2) != fcs) { bad++; continue; }
            int id = m[0] & 0xFF;
            if ((id == 20 || id == 10) && n - 2 >= 28) {
                Target t = report(m, id == 10);
                if (t != null) out.add(t);
            }
            i = end;                              // il 0x7E di chiusura può aprire il messaggio dopo
        }
        return out;
    }

    private static int s24(byte[] m, int o) {
        int v = ((m[o] & 0xFF) << 16) | ((m[o + 1] & 0xFF) << 8) | (m[o + 2] & 0xFF);
        return (v & 0x800000) != 0 ? v - 0x1000000 : v;
    }

    private static Target report(byte[] m, boolean proprio) {
        Target t = new Target();
        t.proprio = proprio;
        t.addrType = m[1] & 0x0F;
        t.addr = String.format("%02X%02X%02X", m[2] & 0xFF, m[3] & 0xFF, m[4] & 0xFF);
        t.lat = s24(m, 5) * 180.0 / 8388608.0;
        t.lon = s24(m, 8) * 180.0 / 8388608.0;
        if (t.lat == 0 && t.lon == 0) return null;   // posizione non valida
        int alt = ((m[11] & 0xFF) << 4) | ((m[12] & 0xF0) >> 4);
        if (alt != 0xFFF) t.altFt = alt * 25 - 1000;
        int misc = m[12] & 0x0F;
        t.inVolo = (misc & 0x08) != 0;
        int hv = ((m[14] & 0xFF) << 4) | ((m[15] & 0xF0) >> 4);
        if (hv != 0xFFF) t.kt = hv;
        int vv = ((m[15] & 0x0F) << 8) | (m[16] & 0xFF);
        if (vv != 0x800) t.fpm = ((vv & 0x800) != 0 ? vv - 0x1000 : vv) * 64;
        t.trk = (m[17] & 0xFF) * 360.0 / 256.0;
        t.cat = m[18] & 0xFF;
        StringBuilder cs = new StringBuilder();
        for (int k = 19; k < 27; k++) { char c = (char) (m[k] & 0xFF); if (c >= 32 && c < 127) cs.append(c); }
        t.cs = cs.toString().trim();
        return t;
    }
}
