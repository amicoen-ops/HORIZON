// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// Schermate dell'orologio, tre pagine. La pagina segue il volo da sola, così c'è sempre a vista quello che serve:
// a terra PILOTA, in rotta VOLO, avvicinandosi alla destinazione (ultimi 10 minuti e ingresso in circuito) ARRIVO,
// in base e in finale di nuovo VOLO (velocità, quota, vario, deviazione dall'asse). Un tocco o uno scorrimento sullo
// schermo mostra un'altra pagina per 20 secondi, poi torna quella del momento. Senza la fase dallo strumento
// (strumento vecchio o non collegato) la pagina resta quella scelta a mano.
// · VOLO: rosa sottile sul bordo che gira con la traccia (triangolo rosso = nord), pallino magenta verso la destinazione, velocità e quota grandi,
//   vario, destinazione, barra di deviazione dalla rotta (CDI), battito e saturazione.
// · ARRIVO: destinazione, distanza e minuti, rilevamento e ora di arrivo (Z), frequenza del campo, vento, tramonto.
// · PILOTA: ora UTC, battito e saturazione grandi, tempo di volo, autonomia, QNH e altezza sul terreno, batteria.
// I dati vengono dallo strumento se collegato; senza strumento (o se lo strumento non ha il GPS) velocità, quota e
// traccia sono quelle dei sensori dell'orologio. Un avviso dello strumento riempie lo schermo per 8 secondi
// (rosso se urgente, giallo se informativo), scritto su più righe.
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;
import Toybox.Position;
import Toybox.System;
import Toybox.Time;
import Toybox.Timer;
import Toybox.WatchUi;

class HorizonView extends WatchUi.View {
    var app;
    var pg = 0;                // pagina: 0 volo, 1 arrivo, 2 pilota e tempi
    var man = false;           // pagina scelta a mano (tocco o scorrimento): vale 20 secondi
    var manT = 0;

    function initialize(a) {
        View.initialize();
        app = a;
    }

    // nella scatola nera: quando l'orologio copre l'app con una sua schermata (notifica, menu) e quando la ridà
    var coperta = false;
    var copT = 0;
    var disT = 0;              // ultimo disegno riuscito a partire (per accorgersi di uno schermo fermo)
    function onShow() { coperta = false; disT = System.getTimer(); app.segnaSubito("visibile"); }
    function onHide() { coperta = true; copT = System.getTimer(); app.segnaSubito("coperta"); }

    function pagina(d) {
        pg = (pg + d + 3) % 3;
        man = true;
        manT = System.getTimer();
        app.segna("pagina " + pg);
        WatchUi.requestUpdate();
    }

    // un numero arrivato dal telefono (intero o con la virgola) → Float; qualunque altra cosa → null
    function num(v) {
        if (v == null) { return null; }
        if (v instanceof Lang.Number || v instanceof Lang.Float || v instanceof Lang.Long || v instanceof Lang.Double) { return v.toFloat(); }
        return null;
    }

    function fmt(v, dec) {
        if (v == null) { return "---"; }
        if (dec == 0) { return Math.round(v).toNumber().toString(); }
        return v.toFloat().format("%." + dec + "f");
    }

    function gradi(v) {
        if (v == null) { return "---"; }
        var n = Math.round(v).toNumber() % 360;
        if (n < 0) { n += 360; }
        return n.format("%03d") + "°";
    }

    // minuti → «1:05»
    function oreMin(m) {
        var n = Math.round(m).toNumber();
        if (n < 0) { n = 0; }
        return (n / 60).toString() + ":" + (n % 60).format("%02d");
    }

    // un errore nel disegno non deve chiudere l'app: si scrive e si va avanti
    function onUpdate(dc) {
        disT = System.getTimer();
        try {
            app.segna("disegno");
            disegna(dc);
        } catch (e) {
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_BLACK);
            dc.clear();
            dc.drawText(dc.getWidth() / 2, dc.getHeight() / 2, Graphics.FONT_SMALL, "HORIZON Link", Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
        }
    }

    function disegna(dc) {
        var w = dc.getWidth(), h = dc.getHeight();
        var now = System.getTimer();
        if (app.alertTxt != null && now - app.alertT < 8000) {
            app.segna("disegno avviso");
            avviso(dc, w, h);
            app.segna("avviso disegnato");
            return;
        }
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();
        // dati dello strumento: valgono 5 secondi
        var p = (app.phone != null && now - app.phoneT < 5000) ? app.phone : null;
        // la pagina del momento, dalla fase del volo che manda lo strumento (0 a terra, 1 in rotta, 2 in arrivo)
        if (man && now - manT > 20000) { man = false; }
        var fase = (p != null) ? num(p.get("ph")) : null;
        if (!man && fase != null) {
            pg = (fase < 0.5) ? 2 : ((fase > 1.5) ? 1 : 0);
        }
        if (pg == 1) { arrivo(dc, w, h, p); }
        else if (pg == 2) { pilota(dc, w, h, p); }
        else { volo(dc, w, h, p); }
        // in basso: quale pagina (tre punti; il punto è giallo finché la pagina è scelta a mano)
        for (var i = 0; i < 3; i++) {
            dc.setColor(i == pg ? (man && fase != null ? Graphics.COLOR_YELLOW : Graphics.COLOR_WHITE) : Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.fillCircle(w / 2 + (i - 1) * 12, (h * 0.925).toNumber(), i == pg ? 4 : 3);
        }
    }

    // ---- avviso dello strumento: tutto lo schermo, testo su più righe ----
    function avviso(dc, w, h) {
        var urg = app.alertLvl != null && app.alertLvl.equals("W");
        var bg = urg ? Graphics.COLOR_RED : Graphics.COLOR_YELLOW;
        dc.setColor(bg, bg);
        dc.clear();
        dc.setColor(urg ? Graphics.COLOR_WHITE : Graphics.COLOR_BLACK, Graphics.COLOR_TRANSPARENT);
        var txt = app.alertTxt.toString();
        var font = Graphics.FONT_MEDIUM;
        var L = righe(dc, txt, font, w * 0.80);
        if (L.size() > 4) {
            font = Graphics.FONT_SMALL;
            L = righe(dc, txt, font, w * 0.80);
        }
        var fh = dc.getFontHeight(font);
        var n = L.size() > 5 ? 5 : L.size();
        var y = h / 2 - (n * fh) / 2;
        for (var i = 0; i < n; i++) {
            dc.drawText(w / 2, y + i * fh, font, L[i], Graphics.TEXT_JUSTIFY_CENTER);
        }
    }

    // spezza un testo in righe che stanno nella larghezza data (alle parole)
    function righe(dc, txt, font, maxW) {
        var out = [];
        var rest = txt;
        var cur = "";
        var giri = 0;
        while (rest.length() > 0 && giri < 40) {
            giri++;
            var i = rest.find(" ");
            var parola = rest;
            if (i == null) {
                rest = "";
            } else {
                parola = (i > 0) ? rest.substring(0, i) : "";
                rest = (i + 1 < rest.length()) ? rest.substring(i + 1, rest.length()) : "";
            }
            if (parola == null) { parola = ""; }
            if (rest == null) { rest = ""; }
            if (parola.length() > 0) {
                var prova = (cur.length() == 0) ? parola : cur + " " + parola;
                if (cur.length() > 0 && dc.getTextWidthInPixels(prova, font) > maxW) {
                    out.add(cur);
                    cur = parola;
                } else {
                    cur = prova;
                }
            }
        }
        if (cur.length() > 0) { out.add(cur); }
        return out;
    }

    // ---- pagina VOLO ----
    function volo(dc, w, h, p) {
        var cx = w / 2;
        var q = (app.pos != null && app.pos.accuracy != null) ? app.pos.accuracy : 0;
        var gs = null, alt = null, vs = null, trk = null, brg = null;
        if (p != null) {
            gs = num(p.get("gs")); alt = num(p.get("al")); vs = num(p.get("vs"));
            trk = num(p.get("tk")); brg = num(p.get("br"));
        }
        var suoi = (gs == null);         // lo strumento non dà la velocità: valgono i sensori dell'orologio
        if (suoi) {
            vs = null; brg = null;
            if (app.pos != null && app.pos.speed != null && q >= Position.QUALITY_POOR) { gs = app.pos.speed * 3.6; }
            if (app.sens != null && app.sens.altitude != null) { alt = app.sens.altitude / 0.3048; }
            if (gs != null && gs > 15 && app.pos.heading != null) { trk = Math.toDegrees(app.pos.heading); }
        }
        rosa(dc, w, h, trk, brg);
        // collegamento e GPS
        dc.setColor(app.linkOk ? Graphics.COLOR_GREEN : Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx - 4, h * 0.205, Graphics.FONT_XTINY, app.linkOk ? "HORIZON" : "attendo", Graphics.TEXT_JUSTIFY_RIGHT);
        dc.setColor(q >= Position.QUALITY_GOOD ? Graphics.COLOR_GREEN : (q >= Position.QUALITY_POOR ? Graphics.COLOR_YELLOW : Graphics.COLOR_RED), Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx + 4, h * 0.205, Graphics.FONT_XTINY, suoi ? "GPS orol." : "GPS", Graphics.TEXT_JUSTIFY_LEFT);
        // traccia
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.095, Graphics.FONT_TINY, "TRK " + gradi(trk), Graphics.TEXT_JUSTIFY_CENTER);
        // velocità e quota
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w * 0.29, h * 0.30, Graphics.FONT_XTINY, "GS km/h", Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(w * 0.70, h * 0.30, Graphics.FONT_XTINY, "QUOTA ft", Graphics.TEXT_JUSTIFY_CENTER);
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        grande(dc, w * 0.29, h * 0.375, fmt(gs, 0), w * 0.32);
        grande(dc, w * 0.70, h * 0.375, fmt(alt, 0), w * 0.40);
        if (vs != null) {
            dc.setColor(vs >= 0 ? Graphics.COLOR_GREEN : Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.565, Graphics.FONT_SMALL, "VARIO " + (vs >= 0 ? "+" : "") + fmt(vs, 1) + " m/s", Graphics.TEXT_JUSTIFY_CENTER);
        }
        // destinazione: nome, distanza, minuti (dallo strumento nuovo); altrimenti la riga già pronta di quello vecchio
        var dn = (p != null) ? p.get("dn") : null;
        var riga = null;
        if (dn != null && dn.toString().length() > 0) {
            var dk = num(p.get("dk")), et = num(p.get("et"));
            riga = dn.toString();
            if (dk != null) { riga += " " + fmt(dk, dk < 100 ? 1 : 0) + " km"; }
            if (et != null) { riga += " " + fmt(et, 0) + "'"; }
        } else if (p != null && p.get("dt") != null) {
            riga = p.get("dt").toString();
        }
        if (riga != null && riga.length() > 0) {
            dc.setColor(Graphics.COLOR_PINK, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.66, Graphics.FONT_XTINY, riga, Graphics.TEXT_JUSTIFY_CENTER);
        }
        // deviazione dalla rotta: l'ago va dalla parte dove bisogna andare
        var xt = (p != null) ? num(p.get("xt")) : null;
        if (xt != null) {
            var xs = num(p.get("xs"));
            if (xs == null || xs < 50) { xs = 1000.0; }
            cdi(dc, w, h, xt, xs);
        }
        // pilota: battito e saturazione
        var hr = (app.sens != null && app.sens.heartRate != null) ? app.sens.heartRate.toString() : "--";
        dc.setColor(Graphics.COLOR_RED, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx - 5, h * 0.80, Graphics.FONT_XTINY, "HR " + hr, Graphics.TEXT_JUSTIFY_RIGHT);
        var o = app.ox();
        dc.setColor(coloreOx(o), Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx + 5, h * 0.80, Graphics.FONT_XTINY, o == null ? "SpO2 --" : "SpO2 " + o.toNumber().toString() + "%", Graphics.TEXT_JUSTIFY_LEFT);
    }

    // numero grande: se non sta nella larghezza si usa il carattere un po' più piccolo
    function grande(dc, x, y, txt, maxW) {
        var f = Graphics.FONT_NUMBER_MEDIUM;
        if (dc.getTextWidthInPixels(txt, f) > maxW) { f = Graphics.FONT_NUMBER_MILD; }
        if (dc.getTextWidthInPixels(txt, f) > maxW) { f = Graphics.FONT_MEDIUM; }
        dc.drawText(x, y, f, txt, Graphics.TEXT_JUSTIFY_CENTER);
    }

    // saturazione: gialla sotto 92%, rossa sotto 88%; grigia se la misura è vecchia (più di 10 minuti)
    function coloreOx(o) {
        if (o == null || app.oxEta() > 600) { return Graphics.COLOR_LT_GRAY; }
        if (o < 88) { return Graphics.COLOR_RED; }
        if (o < 92) { return Graphics.COLOR_YELLOW; }
        return Graphics.COLOR_BLUE;
    }

    // rosa della bussola sul bordo, sottile per lasciare lo schermo ai numeri: gira con la traccia (in alto c'è dove si va).
    // Triangolo rosso = nord, tacche lunghe = est, sud, ovest; pallino magenta = destinazione; indice bianco fisso in alto.
    function rosa(dc, w, h, trk, brg) {
        var cx = w / 2.0, cy = h / 2.0, r = w / 2.0 - 1;
        var t0 = (trk != null) ? trk : 0.0;
        var vivo = (trk != null);
        dc.setPenWidth(2);
        dc.setColor(vivo ? Graphics.COLOR_LT_GRAY : Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        for (var i = 1; i < 12; i++) {
            var a = Math.toRadians(i * 30 - t0);
            var s = Math.sin(a), c = Math.cos(a);
            var lung = (i % 3 == 0) ? 10 : 5;
            dc.drawLine((cx + s * (r - lung)).toNumber(), (cy - c * (r - lung)).toNumber(), (cx + s * r).toNumber(), (cy - c * r).toNumber());
        }
        dc.setPenWidth(1);
        // nord
        var an = Math.toRadians(-t0);
        var sn = Math.sin(an), cn = Math.cos(an);
        dc.setColor(vivo ? Graphics.COLOR_RED : Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.fillPolygon([
            [(cx + sn * (r - 13)).toNumber(), (cy - cn * (r - 13)).toNumber()],
            [(cx + sn * r + cn * 7).toNumber(), (cy - cn * r + sn * 7).toNumber()],
            [(cx + sn * r - cn * 7).toNumber(), (cy - cn * r - sn * 7).toNumber()]]);
        // destinazione
        if (vivo && brg != null) {
            var b = Math.toRadians(brg - t0);
            dc.setColor(Graphics.COLOR_PINK, Graphics.COLOR_TRANSPARENT);
            dc.fillCircle((cx + Math.sin(b) * (r - 7)).toNumber(), (cy - Math.cos(b) * (r - 7)).toNumber(), 7);
        }
        // indice fisso in alto (sopra a tutto)
        var ix = cx.toNumber();
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.fillPolygon([[ix - 6, 0], [ix + 6, 0], [ix, 9]]);
    }

    // barra di deviazione: 4 pallini (2 = fondo scala), ago magenta dalla parte della rotta
    function cdi(dc, w, h, xt, xs) {
        var cx = w / 2, y = (h * 0.755).toNumber(), passo = w * 0.07;
        var d = -xt / xs * 2.0;
        if (d > 2.3) { d = 2.3; }
        if (d < -2.3) { d = -2.3; }
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        for (var i = -2; i <= 2; i++) {
            if (i != 0) { dc.drawCircle((cx + i * passo).toNumber(), y, 3); }
        }
        dc.drawLine(cx, y - 7, cx, y + 8);
        var x = (cx + d * passo).toNumber();
        dc.setColor(Graphics.COLOR_PINK, Graphics.COLOR_TRANSPARENT);
        dc.fillPolygon([[x, y - 8], [x + 6, y], [x, y + 8], [x - 6, y]]);
    }

    function titolo(dc, w, h, t) {
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, h * 0.075, Graphics.FONT_XTINY, t, Graphics.TEXT_JUSTIFY_CENTER);
    }

    // ---- pagina ARRIVO ----
    function arrivo(dc, w, h, p) {
        var cx = w / 2;
        titolo(dc, w, h, "ARRIVO");
        var dn = (p != null) ? p.get("dn") : null;
        if (dn == null || dn.toString().length() == 0) {
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.36, Graphics.FONT_SMALL, p == null ? "attendo HORIZON" : "nessuna destinazione", Graphics.TEXT_JUSTIFY_CENTER);
        } else {
            var dk = num(p.get("dk")), et = num(p.get("et")), br = num(p.get("br"));
            dc.setColor(Graphics.COLOR_PINK, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.15, Graphics.FONT_MEDIUM, dn.toString(), Graphics.TEXT_JUSTIFY_CENTER);
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(w * 0.31, h * 0.30, Graphics.FONT_XTINY, "km", Graphics.TEXT_JUSTIFY_CENTER);
            dc.drawText(w * 0.69, h * 0.30, Graphics.FONT_XTINY, "minuti", Graphics.TEXT_JUSTIFY_CENTER);
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            grande(dc, w * 0.31, h * 0.375, dk == null ? "---" : fmt(dk, dk < 100 ? 1 : 0), w * 0.36);
            grande(dc, w * 0.69, h * 0.375, fmt(et, 0), w * 0.34);
            var ea = p.get("ea");
            dc.drawText(cx, h * 0.565, Graphics.FONT_TINY, "BRG " + gradi(br) + (ea != null ? "  " + ea.toString() : ""), Graphics.TEXT_JUSTIFY_CENTER);
            // pista del circuito (quando lo strumento l'ha scelta) e frequenza del campo
            var fq = p.get("fq"), rw = p.get("rw");
            var r2 = "";
            if (rw != null && rw.toString().length() > 0) { r2 = "PISTA " + rw.toString(); }
            if (fq != null && fq.toString().length() > 0) { r2 += (r2.length() > 0 ? "  " : "RADIO ") + fq.toString(); }
            if (r2.length() > 0) {
                dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
                dc.drawText(cx, h * 0.655, Graphics.FONT_TINY, r2, Graphics.TEXT_JUSTIFY_CENTER);
            }
        }
        if (p != null) {
            var wd = num(p.get("wd")), wk = num(p.get("wk"));
            if (wd != null && wk != null) {
                dc.setColor(Graphics.COLOR_BLUE, Graphics.COLOR_TRANSPARENT);
                dc.drawText(cx, h * 0.745, Graphics.FONT_TINY, "VENTO " + gradi(wd) + "/" + fmt(wk, 0), Graphics.TEXT_JUSTIFY_CENTER);
            }
            var ss = num(p.get("ss"));
            if (ss != null) {
                dc.setColor(ss <= 0 ? Graphics.COLOR_RED : (ss < 45 ? Graphics.COLOR_YELLOW : Graphics.COLOR_LT_GRAY), Graphics.COLOR_TRANSPARENT);
                dc.drawText(cx, h * 0.835, Graphics.FONT_XTINY, ss <= 0 ? "SOLE TRAMONTATO" : "TRAMONTO TRA " + oreMin(ss), Graphics.TEXT_JUSTIFY_CENTER);
            }
        }
    }

    // ---- pagina PILOTA E TEMPI ----
    function pilota(dc, w, h, p) {
        var cx = w / 2;
        titolo(dc, w, h, "PILOTA");
        var u = Time.Gregorian.utcInfo(Time.now(), Time.FORMAT_SHORT);
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.15, Graphics.FONT_MEDIUM, u.hour.format("%02d") + ":" + u.min.format("%02d") + " Z", Graphics.TEXT_JUSTIFY_CENTER);
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w * 0.31, h * 0.30, Graphics.FONT_XTINY, "BATTITO", Graphics.TEXT_JUSTIFY_CENTER);
        var o = app.ox();
        var eta = app.oxEta();
        dc.drawText(w * 0.69, h * 0.30, Graphics.FONT_XTINY, (o != null && eta > 120) ? "SpO2 " + (eta / 60).toString() + "' fa" : "SpO2 %", Graphics.TEXT_JUSTIFY_CENTER);
        dc.setColor(Graphics.COLOR_RED, Graphics.COLOR_TRANSPARENT);
        grande(dc, w * 0.31, h * 0.375, (app.sens != null && app.sens.heartRate != null) ? app.sens.heartRate.toString() : "--", w * 0.34);
        dc.setColor(coloreOx(o), Graphics.COLOR_TRANSPARENT);
        grande(dc, w * 0.69, h * 0.375, o == null ? "--" : o.toNumber().toString(), w * 0.34);
        if (p != null) {
            var ft = num(p.get("ft")), fu = num(p.get("fu")), qn = num(p.get("qn")), ag = num(p.get("ag"));
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.565, Graphics.FONT_TINY, ft != null ? "VOLO " + oreMin(ft) : "A TERRA", Graphics.TEXT_JUSTIFY_CENTER);
            if (fu != null) {
                dc.setColor(fu < 45 ? Graphics.COLOR_YELLOW : Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
                dc.drawText(cx, h * 0.655, Graphics.FONT_TINY, "AUTONOMIA " + oreMin(fu), Graphics.TEXT_JUSTIFY_CENTER);
            }
            var r3 = "";
            if (qn != null) { r3 = "QNH " + fmt(qn, 0); }
            if (ag != null) { r3 += (r3.length() > 0 ? "  " : "") + "TERR. " + fmt(ag, 0) + " ft"; }
            if (r3.length() > 0) {
                dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
                dc.drawText(cx, h * 0.745, Graphics.FONT_XTINY, r3, Graphics.TEXT_JUSTIFY_CENTER);
            }
        } else {
            dc.setColor(Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.565, Graphics.FONT_TINY, "attendo HORIZON", Graphics.TEXT_JUSTIFY_CENTER);
        }
        var st = System.getSystemStats();
        if (st != null && st.battery != null) {
            dc.setColor(st.battery < 15 ? Graphics.COLOR_YELLOW : Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.835, Graphics.FONT_XTINY, "OROLOGIO " + st.battery.toNumber().toString() + "%", Graphics.TEXT_JUSTIFY_CENTER);
        }
    }
}

// Tasti (comandano lo strumento sul telefono): START = OK, SU = ruota a sinistra, GIÙ = ruota a destra,
// SU tenuto (menu) = cambia pagina dello strumento, GIÙ + BACK insieme (i due tasti in basso) = cambia pagina dello
// strumento, BACK da solo = esci. GIÙ e BACK aspettano un attimo (0,35 s) prima di agire: se nel frattempo arriva
// l'altro tasto è la combinazione.
// Schermo (comanda l'orologio): un tocco, o scorrere a sinistra o in su = pagina dopo; scorrere a destra o in giù =
// pagina prima, per 20 secondi; poi torna la pagina del momento. Così un tocco per sbaglio sullo schermo non muove
// più la manopola dello strumento, e i tasti restano tutti per lo strumento.
class HorizonDelegate extends WatchUi.BehaviorDelegate {
    var app;
    var view;
    var tDown = 0;
    var tEsc = 0;
    var comboT = -10000;
    var pend = null;
    var pendT = null;

    function initialize(a, v) {
        BehaviorDelegate.initialize();
        app = a;
        view = v;
        pendT = new Timer.Timer();
    }

    // un avviso a schermo si toglie con un tocco o uno scorrimento (sullo strumento resta: lì si toglie dal telefono)
    function toglieAvviso() {
        if (app.alertTxt != null && System.getTimer() - app.alertT < 8000) {
            app.alertT = System.getTimer() - 60000;
            app.segna("avviso tolto");
            WatchUi.requestUpdate();
            return true;
        }
        return false;
    }

    function onSwipe(evt) {
        if (toglieAvviso()) { return true; }
        var d = evt.getDirection();
        if (d == WatchUi.SWIPE_LEFT || d == WatchUi.SWIPE_UP) { view.pagina(1); }
        else { view.pagina(-1); }
        return true;
    }

    function onTap(evt) {
        if (toglieAvviso()) { return true; }
        view.pagina(1);
        return true;
    }

    function onKeyPressed(evt) {
        var k = evt.getKey(), now = System.getTimer();
        if (k == WatchUi.KEY_DOWN) { tDown = now; }
        else if (k == WatchUi.KEY_ESC) { tEsc = now; }
        var d = tDown - tEsc;
        if (tDown > 0 && tEsc > 0 && d < 400 && d > -400 && now - comboT > 800) {
            comboT = now;
            annulla();
            app.key("pg");
            return true;
        }
        return false;
    }

    function annulla() {
        pendT.stop();
        pend = null;
    }

    function rimanda(cosa) {
        annulla();
        pend = cosa;
        pendT.start(method(:esegui), 350, false);
    }

    function esegui() as Void {
        var p = pend;
        pend = null;
        if (p == null || System.getTimer() - comboT < 800) { return; }
        if (p.equals("r")) { app.key("r"); }
        else if (p.equals("esci")) { System.exit(); }
    }

    // I TASTI arrivano qui. Le funzioni «di comportamento» (onSelect, onNextPage, onPreviousPage, onBack) NON ci sono
    // apposta: sul fenix le chiama anche lo schermo (tocco = selezione, scorrimento = pagina, verso destra = indietro) e
    // vengono prima di onTap e onSwipe; con quelle il tocco muoveva lo strumento e le pagine dell'orologio non cambiavano mai.
    function onKey(evt) {
        var k = evt.getKey();
        if (k == WatchUi.KEY_ENTER) { app.key("ok"); return true; }
        if (k == WatchUi.KEY_UP) { app.key("l"); return true; }
        if (k == WatchUi.KEY_DOWN) {
            if (System.getTimer() - comboT >= 800) { rimanda("r"); }
            return true;
        }
        if (k == WatchUi.KEY_ESC) {
            if (System.getTimer() - comboT >= 800) { rimanda("esci"); }
            return true;
        }
        return false;
    }

    function onMenu() {
        app.key("pg");
        return true;
    }
}
