// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
package it.amicoen.horizon;

import android.os.Bundle;
import android.view.WindowManager;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GloSerialPlugin.class);          // Garmin GLO 2 via Bluetooth
        registerPlugin(CompassPlugin.class);            // bussola: sensore di rotazione di Android
        registerPlugin(BarometroPlugin.class);          // barometro del telefono: quota e vario insieme al GPS
        registerPlugin(LicenzaPlugin.class);            // licenza: firma dell'app e acquisto su Google Play
        registerPlugin(UpdaterPlugin.class);            // aggiornamenti: APK di GitHub o Google Play
        registerPlugin(StatoTelefonoPlugin.class);      // batteria e segnale 4G/5G per la riga di stato
        registerPlugin(CartaPlugin.class);              // carta VFR open flightmaps scaricata sul telefono (MBTiles)
        registerPlugin(Gdl90Plugin.class);              // traffico GDL90 su UDP 4000: SafeSky, SkyEcho, PilotAware
        registerPlugin(OgnPlugin.class);                // Open Glider Network: posizione trasmessa (se il pilota lo accende) e traffico vicino
        // orologio Garmin: il modulo c'è solo in HORIZON 2 (compilata con -Ph2); nelle altre versioni non si trova e basta
        try { registerPlugin(Class.forName("it.amicoen.horizon.GarminPlugin").asSubclass(com.getcapacitor.Plugin.class)); } catch (Throwable ignored) { }
        super.onCreate(savedInstanceState);
        // carattere di sistema ingrandito: la WebView lo applica a tutte le scritte e lo strumento non sta più nello
        // schermo (barra in basso tagliata, numeri troncati). Le misure dell'app sono già fatte per essere lette in volo.
        try { getBridge().getWebView().getSettings().setTextZoom(100); } catch (Exception ignored) { }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);   // in volo lo schermo non si spegne
        immersive();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }

    /** Schermo intero: barre di sistema nascoste, tornano con uno scorrimento dal bordo. */
    private void immersive() {
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.hide(WindowInsetsCompat.Type.systemBars());
    }
}
