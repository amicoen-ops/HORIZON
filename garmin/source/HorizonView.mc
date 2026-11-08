// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// Schermata dell'orologio: pochi dati grandi. In alto lo stato del collegamento e del GPS, al centro velocità e quota
// (dallo strumento se collegato, altrimenti dai sensori dell'orologio), sotto vario e destinazione. Un avviso dello
// strumento riempie lo schermo per 8 secondi (rosso se urgente, giallo se informativo).
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Position;
import Toybox.System;
import Toybox.WatchUi;

class HorizonView extends WatchUi.View {
    var app;

    function initialize(a) {
        View.initialize();
        app = a;
    }

    function fmt(v, dec) {
        if (v == null) { return "---"; }
        if (dec == 0) { return v.toNumber().toString(); }
        return v.toFloat().format("%." + dec + "f");
    }

    function onUpdate(dc) {
        var w = dc.getWidth(), h = dc.getHeight(), cx = w / 2;
        var now = System.getTimer();
        // avviso dello strumento
        if (app.alertTxt != null && now - app.alertT < 8000) {
            var urg = app.alertLvl.equals("W");
            dc.setColor(urg ? Graphics.COLOR_RED : Graphics.COLOR_YELLOW, urg ? Graphics.COLOR_RED : Graphics.COLOR_YELLOW);
            dc.clear();
            dc.setColor(urg ? Graphics.COLOR_WHITE : Graphics.COLOR_BLACK, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h / 2, Graphics.FONT_MEDIUM, app.alertTxt.toString(), Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
            return;
        }
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();
        // stato: collegamento e GPS
        var q = (app.pos != null && app.pos.accuracy != null) ? app.pos.accuracy : 0;
        var gpsTxt = q >= Position.QUALITY_GOOD ? "GPS OK" : (q >= Position.QUALITY_POOR ? "GPS DEBOLE" : "GPS ...");
        dc.setColor(app.linkOk ? Graphics.COLOR_GREEN : Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.10, Graphics.FONT_XTINY, app.linkOk ? "HORIZON collegato" : "attendo HORIZON", Graphics.TEXT_JUSTIFY_CENTER);
        dc.setColor(q >= Position.QUALITY_GOOD ? Graphics.COLOR_GREEN : Graphics.COLOR_YELLOW, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.18, Graphics.FONT_XTINY, gpsTxt, Graphics.TEXT_JUSTIFY_CENTER);
        // dati: dallo strumento se arrivano, altrimenti dall'orologio
        var p = (app.phone != null && now - app.phoneT < 5000) ? app.phone : null;
        var gs = null, alt = null, vs = null, dest = null;
        if (p != null) {
            gs = p.get("gs"); alt = p.get("al"); vs = p.get("vs"); dest = p.get("dt");
        } else {
            if (app.pos != null && app.pos.speed != null) { gs = app.pos.speed * 3.6; }
            if (app.sens != null && app.sens.altitude != null) { alt = app.sens.altitude / 0.3048; }
        }
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w * 0.30, h * 0.30, Graphics.FONT_XTINY, "GS km/h", Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(w * 0.70, h * 0.30, Graphics.FONT_XTINY, "QUOTA ft", Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(w * 0.30, h * 0.38, Graphics.FONT_NUMBER_MEDIUM, fmt(gs, 0), Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(w * 0.70, h * 0.38, Graphics.FONT_NUMBER_MEDIUM, fmt(alt, 0), Graphics.TEXT_JUSTIFY_CENTER);
        if (vs != null) {
            dc.setColor(vs >= 0 ? Graphics.COLOR_GREEN : Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.62, Graphics.FONT_SMALL, "VARIO " + (vs >= 0 ? "+" : "") + fmt(vs, 1) + " m/s", Graphics.TEXT_JUSTIFY_CENTER);
        }
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        if (dest != null) {
            dc.drawText(cx, h * 0.72, Graphics.FONT_XTINY, dest.toString(), Graphics.TEXT_JUSTIFY_CENTER);
        }
        var hr = (app.sens != null && app.sens.heartRate != null) ? app.sens.heartRate.toString() + " bpm" : "";
        dc.drawText(cx, h * 0.82, Graphics.FONT_XTINY, hr, Graphics.TEXT_JUSTIFY_CENTER);
    }
}

// tasti: START = OK, SU = ruota a sinistra, GIÙ = ruota a destra, SU tenuto (menu) = cambia pagina
class HorizonDelegate extends WatchUi.BehaviorDelegate {
    var app;

    function initialize(a) {
        BehaviorDelegate.initialize();
        app = a;
    }

    function onSelect() {
        app.key("ok");
        return true;
    }

    function onPreviousPage() {
        app.key("l");
        return true;
    }

    function onNextPage() {
        app.key("r");
        return true;
    }

    function onMenu() {
        app.key("pg");
        return true;
    }
}
