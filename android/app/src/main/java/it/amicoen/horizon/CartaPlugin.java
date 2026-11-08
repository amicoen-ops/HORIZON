// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
package it.amicoen.horizon;

import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Carta VFR di open flightmaps sul telefono (pacchetto MBTiles, licenza OFMA: si cita la fonte).
 * scarica: scarica il pacchetto una volta (circa 105 MB per l'Italia) nella memoria dell'app, con l'avanzamento.
 * info: carte presenti, dimensione e ciclo AIRAC (dai metadati). tile: un'immagine PNG in base64 (righe TMS).
 * cancella: toglie una carta. Solo https e solo dall'archivio di open flightmaps.
 */
@CapacitorPlugin(name = "Carta")
public class CartaPlugin extends Plugin {

    private SQLiteDatabase db; private String dbName;

    private File dir() { File d = new File(getContext().getFilesDir(), "carte"); if (!d.exists()) d.mkdirs(); return d; }
    private static boolean nomeOk(String n) { return n != null && n.matches("[a-z0-9_]{1,24}"); }

    private synchronized SQLiteDatabase apri(String nome) {
        if (db != null && nome.equals(dbName)) return db;
        if (db != null) { try { db.close(); } catch (Exception ignored) { } db = null; dbName = null; }
        File f = new File(dir(), nome + ".mbtiles"); if (!f.exists()) return null;
        db = SQLiteDatabase.openDatabase(f.getAbsolutePath(), null, SQLiteDatabase.OPEN_READONLY); dbName = nome; return db;
    }

    @PluginMethod
    public void scarica(PluginCall call) {
        String url = call.getString("url"), nome = call.getString("nome");
        if (url == null || !url.startsWith("https://storage.googleapis.com/snapshots.openflightmaps.org/")) { call.reject("indirizzo non valido"); return; }
        if (!nomeOk(nome)) { call.reject("nome non valido"); return; }
        new Thread(() -> {
            HttpURLConnection c = null; File part = new File(dir(), nome + ".part"), out = new File(dir(), nome + ".mbtiles");
            try {
                c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(15000); c.setReadTimeout(30000);
                int code = c.getResponseCode(); if (code != 200) throw new Exception("risposta " + code);
                long total = c.getContentLengthLong(), done = 0, lastEvt = 0;
                try (InputStream in = c.getInputStream(); FileOutputStream fo = new FileOutputStream(part)) {
                    byte[] buf = new byte[128 * 1024]; int n;
                    while ((n = in.read(buf)) > 0) {
                        fo.write(buf, 0, n); done += n;
                        long now = System.currentTimeMillis();
                        if (now - lastEvt > 400) { lastEvt = now; JSObject p = new JSObject(); p.put("done", done); p.put("total", total); notifyListeners("progresso", p); }
                    }
                }
                if (done < 1_000_000) throw new Exception("file troppo piccolo");
                synchronized (this) { if (db != null && nome.equals(dbName)) { db.close(); db = null; dbName = null; } }
                if (out.exists() && !out.delete()) throw new Exception("carta vecchia non tolta");
                if (!part.renameTo(out)) throw new Exception("file non rinominato");
                JSObject r = new JSObject(); r.put("size", done); call.resolve(r);
            } catch (Exception e) {
                part.delete(); call.reject("download non riuscito: " + e.getMessage());
            } finally { if (c != null) c.disconnect(); }
        }).start();
    }

    @PluginMethod
    public void info(PluginCall call) {
        JSObject r = new JSObject(); com.getcapacitor.JSArray a = new com.getcapacitor.JSArray();
        File[] fs = dir().listFiles();
        if (fs != null) for (File f : fs) {
            if (!f.getName().endsWith(".mbtiles")) continue;
            String nome = f.getName().replace(".mbtiles", "");
            JSObject o = new JSObject(); o.put("nome", nome); o.put("size", f.length());
            try { SQLiteDatabase d = apri(nome);
                if (d != null) try (Cursor cu = d.rawQuery("select name, value from metadata where name in ('version','description','bounds')", null)) {
                    while (cu.moveToNext()) o.put(cu.getString(0), cu.getString(1)); }
            } catch (Exception ignored) { }
            a.put(o);
        }
        r.put("carte", a); call.resolve(r);
    }

    @PluginMethod
    public void tile(PluginCall call) {
        String nome = call.getString("nome"); Integer z = call.getInt("z"), x = call.getInt("x"), y = call.getInt("y");
        if (!nomeOk(nome) || z == null || x == null || y == null || z < 0 || z > 22) { call.reject("parametri"); return; }
        try {
            SQLiteDatabase d = apri(nome); if (d == null) { call.reject("carta non scaricata"); return; }
            int row = (1 << z) - 1 - y;                                    // MBTiles: righe contate dal basso (TMS)
            JSObject r = new JSObject();
            try (Cursor cu = d.rawQuery("select tile_data from tiles where zoom_level=? and tile_column=? and tile_row=?",
                    new String[]{String.valueOf(z), String.valueOf(x), String.valueOf(row)})) {
                if (cu.moveToFirst()) r.put("data", Base64.encodeToString(cu.getBlob(0), Base64.NO_WRAP));
            }
            call.resolve(r);
        } catch (Exception e) { call.reject("lettura non riuscita: " + e.getMessage()); }
    }

    @PluginMethod
    public void cancella(PluginCall call) {
        String nome = call.getString("nome"); if (!nomeOk(nome)) { call.reject("nome non valido"); return; }
        synchronized (this) { if (db != null && nome.equals(dbName)) { db.close(); db = null; dbName = null; } }
        boolean ok = new File(dir(), nome + ".mbtiles").delete();
        JSObject r = new JSObject(); r.put("ok", ok); call.resolve(r);
    }
}
