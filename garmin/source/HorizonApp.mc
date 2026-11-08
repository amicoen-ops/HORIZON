// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// HORIZON Link: l'orologio Garmin collegato a HORIZON 2 sul telefono (tramite l'app Garmin Connect).
// · Manda al telefono, una volta al secondo: posizione GPS (multibanda se l'orologio la ha), velocità e traccia,
//   pressione e quota del barometro, prua della bussola, battito.
// · Riceve dal telefono i dati da mostrare (velocità, quota, vario, destinazione) e gli avvisi: vibra e li scrive.
// · Tasti: START = OK, SU / GIÙ = ruota a sinistra / destra, SU tenuto (menu) = cambia pagina, INDIETRO = esci.
import Toybox.Activity;
import Toybox.Application;
import Toybox.Attention;
import Toybox.Communications;
import Toybox.Lang;
import Toybox.Math;
import Toybox.Position;
import Toybox.Sensor;
import Toybox.SensorHistory;
import Toybox.System;
import Toybox.Time;
import Toybox.Timer;
import Toybox.WatchUi;

class HorizonApp extends Application.AppBase {
    var pos = null;            // ultimo Position.Info
    var sens = null;           // ultimo Sensor.Info
    var phone = null;          // dati dallo strumento
    var phoneT = 0;
    var alertTxt = null;
    var alertLvl = "C";
    var alertT = 0;
    var linkOk = false;
    var linkT = 0;
    var sentOk = 0;
    var errors = 0;
    var busy = false;
    var busyT = 0;
    var queue = [];            // tasti premuti, partono prima dei dati
    var timer = null;
    var oxH = null;            // ultima saturazione dallo storico (se il sensore non la dà in diretta)
    var oxHT = 0;
    var nTick = 0;
    var passo = "";           // scatola nera: ultimo punto del codice, salvato; alla riapertura va al telefono
    var prevPasso = null;
    var prevMem = null;

    function initialize() {
        AppBase.initialize();
    }

    // scatola nera: dove si trova l'app adesso (resta salvato se l'orologio la chiude per un errore)
    // in memoria gli ultimi passi; si salvano una volta al secondo (scrivere a ogni passo stancherebbe l'orologio)
    var traccia = [];
    function segna(p) {
        passo = p;
        traccia.add(p);
        if (traccia.size() > 12) { traccia = traccia.slice(traccia.size() - 12, null); }
    }
    function salvaTraccia(fine) {
        var t = "";
        for (var i = 0; i < traccia.size(); i++) { t += (i > 0 ? " > " : "") + traccia[i]; }
        try { Application.Storage.setValue("passo", fine != null ? fine : t); } catch (e) { }
    }

    function onStart(state) {
        try {
            prevPasso = Application.Storage.getValue("passo");
            prevMem = Application.Storage.getValue("mem");
        } catch (e) { }
        segna("avvio");
        salvaTraccia("avvio");
        startGps();
        // niente sensori esterni né Pulse Ox continuo: il battito del polso arriva da solo, la SpO2 dallo storico
        // dell'orologio (Pulse Ox «tutto il giorno» acceso nelle impostazioni del fenix). Meno carico, meno chiusure.
        Sensor.enableSensorEvents(method(:onSensor));
        if (Communications has :registerForPhoneAppMessages) {
            Communications.registerForPhoneAppMessages(method(:onPhone));
        }
        timer = new Timer.Timer();
        timer.start(method(:tick), 1000, true);
        segna("pronta");
    }

    function onStop(state) {
        salvaTraccia("chiusa normalmente");
        if (timer != null) { timer.stop(); }
        Position.enableLocationEvents(Position.LOCATION_DISABLE, method(:onPos));
        Sensor.enableSensorEvents(null);
    }

    // GPS: multibanda (L1+L5) se l'orologio la supporta, altrimenti GPS + Galileo
    function startGps() {
        var ok = false;
        if (Position has :CONFIGURATION_GPS_GLONASS_GALILEO_BEIDOU_L1_L5 && Position has :hasConfigurationSupport) {
            try {
                if (Position.hasConfigurationSupport(Position.CONFIGURATION_GPS_GLONASS_GALILEO_BEIDOU_L1_L5)) {
                    Position.enableLocationEvents({
                        :acquisitionType => Position.LOCATION_CONTINUOUS,
                        :configuration => Position.CONFIGURATION_GPS_GLONASS_GALILEO_BEIDOU_L1_L5
                    }, method(:onPos));
                    ok = true;
                }
            } catch (e) {
                ok = false;
            }
        }
        if (!ok && Position has :CONSTELLATION_GALILEO) {
            try {
                Position.enableLocationEvents({
                    :acquisitionType => Position.LOCATION_CONTINUOUS,
                    :constellations => [Position.CONSTELLATION_GPS, Position.CONSTELLATION_GALILEO]
                }, method(:onPos));
                ok = true;
            } catch (e) {
                ok = false;
            }
        }
        if (!ok) {
            Position.enableLocationEvents(Position.LOCATION_CONTINUOUS, method(:onPos));
        }
    }

    function onPos(info) {
        pos = info;
        WatchUi.requestUpdate();
    }

    function onSensor(info) {
        sens = info;
    }

    // messaggi dal telefono: {t:"s"} dati da mostrare, {t:"a"} avviso
    function onPhone(msg) {
        segna("messaggio dal telefono");
        var d = msg.data;
        if (d == null || !(d instanceof Dictionary)) { return; }
        linkOk = true;
        linkT = System.getTimer();
        var t = d.get("t");
        if (t != null && t.equals("a")) {
            alertTxt = d.get("x");
            alertLvl = d.get("l") != null ? d.get("l") : "C";
            alertT = System.getTimer();
            vibra(alertLvl);
        } else if (t != null && t.equals("s")) {
            phone = d;
            phoneT = System.getTimer();
        }
        WatchUi.requestUpdate();
    }

    function vibra(lvl) {
        segna("vibrazione");
        if (!(Attention has :vibrate)) { return; }
        var p;
        if (lvl.equals("W")) {
            p = [new Attention.VibeProfile(100, 500), new Attention.VibeProfile(0, 150), new Attention.VibeProfile(100, 500), new Attention.VibeProfile(0, 150), new Attention.VibeProfile(100, 500)];
        } else {
            p = [new Attention.VibeProfile(70, 250), new Attention.VibeProfile(0, 150), new Attention.VibeProfile(70, 250)];
        }
        Attention.vibrate(p);
        if (Attention has :backlight) {
            try { Attention.backlight(true); } catch (e) { }
        }
    }

    // un tasto: va in coda e parte subito
    function key(k) {
        segna("tasto " + k);
        queue.add({"t" => "k", "k" => k});
        send();
    }

    function tick() as Void {
        var now = System.getTimer();
        // l'invio passa da Garmin Connect e può metterci parecchi secondi: mai un secondo invio finché il primo non risponde
        // (troppi invii in attesa fanno chiudere l'app); dopo 15 s senza risposta si riprova
        if (busy && now - busyT > 15000) { busy = false; }
        if (linkOk && now - linkT > 8000) { linkOk = false; }
        nTick++;
        if (nTick % 5 == 0) { salvaTraccia(null); traccia = []; }   // gli ultimi passi: se l'app si chiude da sola, restano qui
        segna("secondo");
        if (nTick % 10 == 0) {
            var ms = System.getSystemStats();
            try { Application.Storage.setValue("mem", ms.usedMemory.toString() + "/" + ms.totalMemory.toString()); } catch (e) { }
        }
        if (nTick % 60 == 5) { segna("storico SpO2"); storicoOx(); }
        if (queue.size() > 4) { queue = queue.slice(queue.size() - 4, null); }   // coda corta: i dati vecchi non servono
        if (queue.size() == 0 && !busy) { queue.add(dati()); }
        send();
        WatchUi.requestUpdate();
    }

    function send() {
        if (busy || queue.size() == 0) { return; }
        segna("invio al telefono");
        var m = queue[0];
        queue = queue.slice(1, null);
        busy = true;
        busyT = System.getTimer();
        try {
            Communications.transmit(m, null, new HorizonLink(self));
        } catch (e) {
            busy = false;
            errors++;
        }
    }

    function sent(ok) {
        segna(ok ? "invio riuscito" : "invio non riuscito");
        busy = false;
        if (ok) { sentOk++; linkOk = true; linkT = System.getTimer(); } else { errors++; }
        if (queue.size() > 0) { send(); }
    }

    // saturazione dallo storico dell'orologio (misura della funzione Pulse Ox), ogni 30 secondi
    function storicoOx() {
        if (!(Toybox has :SensorHistory) || !(SensorHistory has :getOxygenSaturationHistory)) { return; }
        try {
            var it = SensorHistory.getOxygenSaturationHistory({:period => 1, :order => SensorHistory.ORDER_NEWEST_FIRST});
            var s = it != null ? it.next() : null;
            if (s != null && s.data != null) {
                oxH = s.data;
                oxHT = s.when != null ? s.when.value() : 0;
            }
        } catch (e) {
        }
    }

    // saturazione: dal sensore in diretta se c'è, altrimenti l'ultima dello storico
    function ox() {
        if (sens != null && (sens has :oxygenSaturation) && sens.oxygenSaturation != null) { return sens.oxygenSaturation; }
        return oxH;
    }

    // i dati dei sensori in un dizionario piccolo (le chiavi corte occupano meno nella trasmissione)
    function dati() {
        segna("lettura dei sensori");
        var d = {"t" => "d", "v" => 2};
        if (pos != null && pos.position != null && pos.accuracy != null && pos.accuracy >= Position.QUALITY_POOR) {
            var ll = pos.position.toDegrees();
            d.put("la", ll[0]);
            d.put("lo", ll[1]);
            d.put("q", pos.accuracy);
            if (pos.altitude != null) { d.put("al", pos.altitude); }
            if (pos.speed != null) { d.put("sp", pos.speed); }
            if (pos.heading != null) { d.put("hd", Math.toDegrees(pos.heading)); }
            if (pos.when != null) { d.put("w", pos.when.value()); }
        }
        if (sens != null) {
            if (sens.pressure != null) { d.put("ps", sens.pressure); }        // pressione riportata al livello del mare (come un QNH)
            if (sens.altitude != null) { d.put("ba", sens.altitude); }
            if (sens.heading != null) { d.put("mh", Math.toDegrees(sens.heading)); }
            if (sens.heartRate != null) { d.put("hr", sens.heartRate); }
            if (sens.temperature != null) { d.put("te", sens.temperature); }
            if ((sens has :oxygenSaturation) && sens.oxygenSaturation != null) { d.put("ox", sens.oxygenSaturation); d.put("oxa", 0); }
        }
        if (d.get("ox") == null && oxH != null) {
            d.put("ox", oxH);
            d.put("oxa", oxHT > 0 ? Time.now().value() - oxHT : -1);      // età della misura in secondi
        }
        // pressione vera dell'aria dove si è (per la quota con il QNH dello strumento)
        var ai = Activity.getActivityInfo();
        if (ai != null && (ai has :ambientPressure) && ai.ambientPressure != null) { d.put("p", ai.ambientPressure); }
        var st = System.getSystemStats();
        if (st != null && st.battery != null) { d.put("bt", st.battery.toNumber()); }
        if (st != null) { d.put("mu", st.usedMemory); d.put("mt", st.totalMemory); }
        if (nTick < 60 && prevPasso != null) { d.put("pv", prevPasso); if (prevMem != null) { d.put("pm", prevMem); } }
        return d;
    }

    function getInitialView() {
        return [new HorizonView(self), new HorizonDelegate(self)];
    }
}

// esito di ogni trasmissione
class HorizonLink extends Communications.ConnectionListener {
    var app;
    function initialize(a) {
        ConnectionListener.initialize();
        app = a;
    }
    function onComplete() {
        app.sent(true);
    }
    function onError() {
        app.sent(false);
    }
}
