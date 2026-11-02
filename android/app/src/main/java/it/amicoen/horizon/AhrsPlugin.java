// HORIZON v2 · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
package it.amicoen.horizon;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Surface;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Assetto nativo, indipendente dalla pagina web.
 *  · Filtro Mahony a ~200 Hz su un thread suo (giroscopio + accelerometro), con compensazione di virata e
 *    accelerazione dalla velocità GPS letta qui (LocationManager), stesso modello dello strumento in JS.
 *  · Manda l'assetto alla pagina 50 volte al secondo («att»).
 *  · Watchdog: la pagina batte un colpo ogni 100 ms; se tace per più di 300 ms compare sopra a tutto
 *    l'ORIZZONTE DI RISERVA disegnato da Android, che sparisce appena la pagina riprende.
 */
@CapacitorPlugin(name = "Ahrs")
public class AhrsPlugin extends Plugin implements SensorEventListener {

    private static final double G = 9.80665, D2R = Math.PI / 180, R2D = 180 / Math.PI;
    private SensorManager sm;
    private HandlerThread th;
    private Handler bg;
    private final Handler ui = new Handler(Looper.getMainLooper());

    // montaggio (righe: avanti, destra, giù nel corpo, espresse negli assi dello schermo), come PH.M nella pagina
    private volatile double[][] M = {{0, 0, -1}, {1, 0, 0}, {0, -1, 0}};
    private volatile double smoothTau = 0.3;
    private volatile int scrAng = 0;

    // filtro
    private double q0 = 1, q1, q2, q3, ix, iy, iz, trust = 1;
    private final double kp = 1.8, ki = 0.02, trustG = 0.08, trustRate = 0.6;
    private boolean init = false;
    private final double[] acc = new double[3];
    private boolean accOk = false;
    private long lastGyroNs = 0;
    private volatile double roll, pitch, rollF, pitchF, slip;
    private volatile long attMs = 0;
    private int hz = 0, cnt = 0; private long cntT0 = 0;

    // GPS nativo
    private LocationManager lm;
    private volatile double gs = 0, trkRate = 0, dvdt = 0; private volatile long gpsMs = 0;
    private double lastTrk = Double.NaN, lastGs = Double.NaN; private long lastFixMs = 0;

    // pagina e orizzonte di riserva
    private volatile long beatMs = 0, armMs = 0;
    private volatile boolean watchOn = true;
    private RiservaView riserva;
    private long lastSend = 0;

    @Override
    public void load() {
        SharedPreferences p = getContext().getSharedPreferences("ahrs", Context.MODE_PRIVATE);
        String m = p.getString("M", null);
        if (m != null) try { String[] v = m.split(","); double[][] n = new double[3][3]; for (int i = 0; i < 9; i++) n[i / 3][i % 3] = Double.parseDouble(v[i]); M = n; } catch (Exception ignored) {}
        watchOn = p.getBoolean("watch", true);
        sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        th = new HandlerThread("horizon-ahrs", android.os.Process.THREAD_PRIORITY_URGENT_DISPLAY); th.start();
        bg = new Handler(th.getLooper());
        Sensor gy = sm.getDefaultSensor(Sensor.TYPE_GYROSCOPE), ac = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        if (ac != null) sm.registerListener(this, ac, 5000, bg);      // 5 ms = 200 Hz
        if (gy != null) sm.registerListener(this, gy, 5000, bg);
        startGps();
        armMs = SystemClock.uptimeMillis() + 4000;                    // all'avvio la pagina ha 4 s per caricarsi
        ui.post(this::addView);
        ui.postDelayed(watchdog, 100);
    }

    @Override
    protected void handleOnDestroy() {
        try { sm.unregisterListener(this); } catch (Exception ignored) {}
        try { if (lm != null) lm.removeUpdates(gpsL); } catch (Exception ignored) {}
        ui.removeCallbacks(watchdog);
        if (th != null) th.quitSafely();
    }

    // ---------- sensori (thread «horizon-ahrs») ----------
    @Override
    public void onSensorChanged(SensorEvent e) {
        if (e.sensor.getType() == Sensor.TYPE_ACCELEROMETER) { acc[0] = e.values[0]; acc[1] = e.values[1]; acc[2] = e.values[2]; accOk = true; return; }
        if (e.sensor.getType() != Sensor.TYPE_GYROSCOPE || !accOk) return;
        double dt = lastGyroNs == 0 ? 0.005 : (e.timestamp - lastGyroNs) * 1e-9; lastGyroNs = e.timestamp;
        if (dt <= 0 || dt > 0.1) dt = 0.005;
        long now = SystemClock.uptimeMillis();
        cnt++; if (now - cntT0 > 2000) { hz = (int) (cnt * 1000 / Math.max(1, now - cntT0)); cnt = 0; cntT0 = now; }
        // assi del telefono → assi dello schermo (telefono girato) → assi del corpo (montaggio)
        double a = scrAng * D2R, c = Math.cos(a), s = Math.sin(a);
        double[] av = {acc[0] * c - acc[1] * s, acc[0] * s + acc[1] * c, acc[2]};
        double[] wd = {e.values[0] * c - e.values[1] * s, e.values[0] * s + e.values[1] * c, e.values[2]};
        double[] fb = body(av); for (int i = 0; i < 3; i++) fb[i] /= G;
        double[] wb = body(wd);
        if (!init) { levelFrom(fb[0], fb[1], fb[2]); init = true; rollF = Double.NaN; }
        boolean gpsFresh = now - gpsMs < 3000;
        double V = gpsFresh && gs > 15 / 3.6 ? gs : 0;
        double fx = fb[0] - (V > 0 ? dvdt / G : 0), fy = fb[1] - wb[2] * V / G, fz = fb[2] + wb[1] * V / G;
        update(wb[0], wb[1], wb[2], fx, fy, fz, dt);
        roll = Math.atan2(2 * (q0 * q1 + q2 * q3), 1 - 2 * (q1 * q1 + q2 * q2)) * R2D;
        pitch = Math.asin(Math.max(-1, Math.min(1, 2 * (q0 * q2 - q3 * q1)))) * R2D;
        double kf = smoothTau > 0 ? 1 - Math.exp(-dt / smoothTau) : 1;
        if (Double.isNaN(rollF)) { rollF = roll; pitchF = pitch; }
        double dr = roll - rollF; while (dr > 180) dr -= 360; while (dr < -180) dr += 360;
        rollF += dr * kf; if (rollF > 180) rollF -= 360; else if (rollF < -180) rollF += 360;
        pitchF += (pitch - pitchF) * kf;
        slip += (-fb[1] - slip) * Math.min(1, dt * 3);
        attMs = now;
        if (now - lastSend >= 20) {                                  // 50 Hz alla pagina
            lastSend = now;
            JSObject o = new JSObject();
            o.put("r", Math.round(roll * 100) / 100.0); o.put("p", Math.round(pitch * 100) / 100.0);
            o.put("s", Math.round(slip * 1000) / 1000.0); o.put("tr", Math.round(trust * 100) / 100.0); o.put("hz", hz);
            notifyListeners("att", o);
        }
    }
    @Override public void onAccuracyChanged(Sensor s, int a) {}

    private double[] body(double[] v) {
        double[][] m = M;
        return new double[]{m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]};
    }
    private void levelFrom(double fx, double fy, double fz) {
        double r = Math.atan2(-fy, -fz), p = Math.atan2(fx, Math.hypot(fy, fz));
        double cr = Math.cos(r / 2), sr = Math.sin(r / 2), cp = Math.cos(p / 2), sp = Math.sin(p / 2);
        q0 = cr * cp; q1 = sr * cp; q2 = cr * sp; q3 = -sr * sp; ix = iy = iz = 0;
    }
    private void update(double gx, double gy, double gz, double fx, double fy, double fz, double dt) {
        double mag = Math.sqrt(fx * fx + fy * fy + fz * fz), rate = Math.sqrt(gx * gx + gy * gy + gz * gz);
        double e1 = (mag - 1) / trustG, e2 = rate / trustRate; trust = Math.exp(-e1 * e1) * Math.exp(-e2 * e2);
        if (mag > 0.3 && mag < 3) {
            double ax = -fx / mag, ay = -fy / mag, az = -fz / mag;
            double vx = 2 * (q1 * q3 - q0 * q2), vy = 2 * (q0 * q1 + q2 * q3), vz = q0 * q0 - q1 * q1 - q2 * q2 + q3 * q3;
            double ex = ay * vz - az * vy, ey = az * vx - ax * vz, ez = ax * vy - ay * vx, kk = kp * trust;
            if (trust > 0.05) { double L = 0.035; ix = clamp(ix + ki * ex * dt, L); iy = clamp(iy + ki * ey * dt, L); iz = clamp(iz + ki * ez * dt, L); }
            gx += kk * ex + ix; gy += kk * ey + iy; gz += kk * ez + iz;
        } else { gx += ix; gy += iy; gz += iz; }
        double h = 0.5 * dt, a = q0, b = q1, c = q2, d = q3;
        q0 += (-b * gx - c * gy - d * gz) * h; q1 += (a * gx + c * gz - d * gy) * h; q2 += (a * gy - b * gz + d * gx) * h; q3 += (a * gz + b * gy - c * gx) * h;
        double n = 1 / Math.sqrt(q0 * q0 + q1 * q1 + q2 * q2 + q3 * q3); q0 *= n; q1 *= n; q2 *= n; q3 *= n;
    }
    private static double clamp(double v, double L) { return v < -L ? -L : (v > L ? L : v); }

    // ---------- GPS nativo ----------
    private final LocationListener gpsL = new LocationListener() {
        @Override public void onLocationChanged(Location l) {
            long now = SystemClock.uptimeMillis();
            double v = l.hasSpeed() ? l.getSpeed() : 0, trk = l.hasBearing() ? l.getBearing() : Double.NaN;
            double dtF = lastFixMs == 0 ? 1 : (now - lastFixMs) / 1000.0;
            if (dtF > 0.2 && dtF < 4) {
                if (!Double.isNaN(lastGs)) dvdt = dvdt * 0.5 + 0.5 * (v - lastGs) / dtF;
                if (!Double.isNaN(trk) && !Double.isNaN(lastTrk) && v > 8) { double d = trk - lastTrk; while (d > 180) d -= 360; while (d < -180) d += 360; trkRate = trkRate * 0.5 + 0.5 * d / dtF; }
                else trkRate = 0;
            } else { dvdt = 0; trkRate = 0; }
            lastGs = v; lastTrk = trk; lastFixMs = now; gs = v; gpsMs = now;
        }
        @Override public void onStatusChanged(String p, int s, Bundle b) {}
        @Override public void onProviderEnabled(String p) {}
        @Override public void onProviderDisabled(String p) {}
    };
    @SuppressLint("MissingPermission")
    private void startGps() {
        try {
            lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
            lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 500, 0, gpsL, th.getLooper());
        } catch (Exception ignored) { /* permesso non ancora dato: riprova quando la pagina lo chiede (start) */ }
    }

    // ---------- dalla pagina ----------
    @PluginMethod
    public void start(PluginCall call) {                       // dopo il permesso di posizione: riavvia il GPS nativo
        if (lm == null || gpsMs == 0) { try { if (lm != null) lm.removeUpdates(gpsL); } catch (Exception ignored) {} startGps(); }
        JSObject r = new JSObject();
        r.put("gyro", sm.getDefaultSensor(Sensor.TYPE_GYROSCOPE) != null);
        r.put("acc", sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null);
        r.put("watch", watchOn);
        call.resolve(r);
    }
    @PluginMethod
    public void setMount(PluginCall call) {
        try {
            JSArray a = call.getArray("M"); double[][] n = new double[3][3]; StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 3; i++) { JSArray row = new JSArray(a.get(i).toString()); for (int j = 0; j < 3; j++) { n[i][j] = row.getDouble(j); sb.append(n[i][j]).append(i == 2 && j == 2 ? "" : ","); } }
            M = n; init = false;
            getContext().getSharedPreferences("ahrs", Context.MODE_PRIVATE).edit().putString("M", sb.toString()).apply();
        } catch (Exception e) { call.reject("montaggio non valido"); return; }
        Double tau = call.getDouble("tau"); if (tau != null) smoothTau = Math.max(0, Math.min(1, tau));
        Integer ang = call.getInt("scr"); if (ang != null) { if (ang != scrAng) init = false; scrAng = ang; }
        call.resolve();
    }
    @PluginMethod
    public void beat(PluginCall call) {
        beatMs = SystemClock.uptimeMillis();
        Integer ang = call.getInt("scr"); if (ang != null && ang != scrAng) { scrAng = ang; init = false; }
        call.resolve();
    }
    @PluginMethod
    public void setWatch(PluginCall call) {
        watchOn = call.getBoolean("on", true);
        getContext().getSharedPreferences("ahrs", Context.MODE_PRIVATE).edit().putBoolean("watch", watchOn).apply();
        call.resolve();
    }
    @PluginMethod
    public void showReserve(PluginCall call) {                 // per provarlo da terra: mostra l'orizzonte di riserva per qualche secondo
        long ms = call.getInt("ms", 4000);
        forceUntil = SystemClock.uptimeMillis() + ms; call.resolve();
    }
    @PluginMethod
    public void status(PluginCall call) {
        long now = SystemClock.uptimeMillis();
        JSObject r = new JSObject();
        r.put("hz", hz); r.put("roll", roll); r.put("pitch", pitch); r.put("trust", trust);
        r.put("attAge", attMs == 0 ? -1 : now - attMs); r.put("gpsAge", gpsMs == 0 ? -1 : now - gpsMs); r.put("gs", gs);
        r.put("beatAge", beatMs == 0 ? -1 : now - beatMs); r.put("reserve", riserva != null && riserva.getVisibility() == View.VISIBLE); r.put("watch", watchOn);
        call.resolve(r);
    }
    private volatile long forceUntil = 0;

    // ---------- watchdog e orizzonte di riserva ----------
    private final Runnable watchdog = new Runnable() {
        @Override public void run() {
            long now = SystemClock.uptimeMillis();
            boolean att = attMs != 0 && now - attMs < 500;
            boolean pageDead = watchOn && now > armMs && (beatMs == 0 ? true : now - beatMs > 300);
            boolean show = att && (pageDead || now < forceUntil);
            if (riserva != null) {
                if (show && riserva.getVisibility() != View.VISIBLE) { riserva.setVisibility(View.VISIBLE); riserva.bringToFront(); }
                else if (!show && riserva.getVisibility() == View.VISIBLE) riserva.setVisibility(View.GONE);
                if (show) riserva.invalidate();
            }
            ui.postDelayed(this, show ? 33 : 100);
        }
    };
    private void addView() {
        try {
            ViewGroup root = getActivity().findViewById(android.R.id.content);
            riserva = new RiservaView(getContext());
            riserva.setVisibility(View.GONE);
            root.addView(riserva, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            riserva.setOnClickListener(v -> forceUntil = 0);
        } catch (Exception ignored) {}
    }

    private class RiservaView extends View {
        private final Paint sky = new Paint(), gnd = new Paint(), w = new Paint(Paint.ANTI_ALIAS_FLAG), y = new Paint(Paint.ANTI_ALIAS_FLAG), t = new Paint(Paint.ANTI_ALIAS_FLAG), bg = new Paint(), red = new Paint();
        RiservaView(Context c) {
            super(c);
            sky.setColor(Color.rgb(31, 118, 199)); gnd.setColor(Color.rgb(122, 74, 34)); bg.setColor(Color.BLACK); red.setColor(Color.rgb(200, 30, 30));
            w.setColor(Color.WHITE); w.setStrokeWidth(4); w.setStyle(Paint.Style.STROKE);
            y.setColor(Color.rgb(255, 214, 10)); y.setStrokeWidth(9); y.setStyle(Paint.Style.STROKE); y.setStrokeCap(Paint.Cap.ROUND);
            t.setColor(Color.WHITE); t.setTextAlign(Paint.Align.CENTER); t.setFakeBoldText(true);
            setClickable(true);
        }
        @Override protected void onDraw(Canvas c) {
            int W = getWidth(), H = getHeight(); c.drawRect(0, 0, W, H, bg);
            float top = H * 0.11f, S = Math.min(W, H - top * 1.6f) * 0.96f, cx = W / 2f, cy = top + (H - top) / 2f, r = S / 2f;
            double ro = rollF, pi = pitchF; float ppd = S / 50f;               // 50° di beccheggio visibili
            c.save();
            Path clip = new Path(); clip.addCircle(cx, cy, r, Path.Direction.CW); c.clipPath(clip);
            c.rotate((float) -ro, cx, cy);
            float hy = cy + (float) (pi * ppd);
            c.drawRect(cx - S * 2, hy - S * 3, cx + S * 2, hy, sky); c.drawRect(cx - S * 2, hy, cx + S * 2, hy + S * 3, gnd);
            c.drawLine(cx - S * 2, hy, cx + S * 2, hy, w);
            t.setTextSize(S * 0.045f);
            for (int p = -30; p <= 30; p += 5) { if (p == 0) continue; float yy = hy - p * ppd, L = (p % 10 == 0 ? S * 0.22f : S * 0.11f);
                c.drawLine(cx - L / 2, yy, cx + L / 2, yy, w); if (p % 10 == 0) { c.drawText(String.valueOf(Math.abs(p)), cx - L / 2 - S * 0.05f, yy + S * 0.016f, t); c.drawText(String.valueOf(Math.abs(p)), cx + L / 2 + S * 0.05f, yy + S * 0.016f, t); } }
            c.restore();
            // scala di inclinazione e indice
            c.drawCircle(cx, cy, r, w);
            for (int b : new int[]{-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60}) { double a = (b - 90) * D2R; float r1 = r * 0.90f, r2 = b % 30 == 0 ? r * 0.80f : r * 0.85f;
                c.drawLine(cx + (float) (Math.cos(a) * r1), cy + (float) (Math.sin(a) * r1), cx + (float) (Math.cos(a) * r2), cy + (float) (Math.sin(a) * r2), w); }
            c.save(); c.rotate((float) -ro, cx, cy);
            Path ptr = new Path(); ptr.moveTo(cx, cy - r * 0.79f); ptr.lineTo(cx - r * 0.05f, cy - r * 0.69f); ptr.lineTo(cx + r * 0.05f, cy - r * 0.69f); ptr.close();
            Paint yf = new Paint(y); yf.setStyle(Paint.Style.FILL); c.drawPath(ptr, yf); c.restore();
            // simbolo dell'aereo, fisso
            c.drawLine(cx - S * 0.30f, cy, cx - S * 0.10f, cy, y); c.drawLine(cx + S * 0.10f, cy, cx + S * 0.30f, cy, y);
            c.drawLine(cx - S * 0.10f, cy, cx, cy + S * 0.05f, y); c.drawLine(cx, cy + S * 0.05f, cx + S * 0.10f, cy, y);
            c.drawCircle(cx, cy, 6, yf);
            // testi
            c.drawRect(0, 0, W, top, red);
            t.setTextSize(top * 0.36f); c.drawText("ORIZZONTE DI RISERVA", cx, top * 0.48f, t);
            t.setTextSize(top * 0.24f); c.drawText("lo schermo principale non risponde · tocca per chiudere la prova", cx, top * 0.85f, t);
            t.setTextSize(S * 0.06f);
            String rl = (Math.abs(ro) < 0.5 ? "0" : String.valueOf(Math.round(Math.abs(ro)))) + "°" + (ro > 0.5 ? " DX" : (ro < -0.5 ? " SX" : ""));
            String pl = (pi >= 0 ? "+" : "") + Math.round(pi) + "°";
            c.drawText("INCLINAZIONE " + rl + "   ·   BECCHEGGIO " + pl, cx, Math.min(H - S * 0.03f, cy + r + S * 0.08f), t);
            if (SystemClock.uptimeMillis() - gpsMs < 3000) { t.setTextSize(S * 0.05f); c.drawText(Math.round(gs * 3.6) + " km/h al suolo", cx, top + S * 0.07f, t); }
        }
    }
}
