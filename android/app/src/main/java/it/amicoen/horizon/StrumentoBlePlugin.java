// HORIZON v2 · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
package it.amicoen.horizon;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.UUID;

/**
 * Strumento fisico HORIZON (scheda XIAO ESP32-S3) via Bluetooth LE, servizio «Nordic UART».
 * La scheda manda le stesse righe NMEA che manda al Raspberry: $RPYL (assetto), $POV (pressioni, velocità), $STAT.
 * Le righe arrivano alla pagina con l'evento «line»; si riconnette da sola se il collegamento cade.
 */
@CapacitorPlugin(
    name = "StrumentoBle",
    permissions = { @Permission(strings = { Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT }, alias = "ble") }
)
public class StrumentoBlePlugin extends Plugin {
    static final UUID NUS = UUID.fromString("6E400001-B5A3-F393-E0A9-E50E24DCCA9E");
    static final UUID NUS_TX = UUID.fromString("6E400003-B5A3-F393-E0A9-E50E24DCCA9E");   // dalla scheda al telefono (notify)
    static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    private final Handler h = new Handler(Looper.getMainLooper());
    private BluetoothGatt gatt;
    private BluetoothLeScanner scanner;
    private boolean want = false, scanning = false;
    private String addr = null, name = null;
    private final StringBuilder buf = new StringBuilder();
    private volatile long lastRx = 0;
    private int lines = 0;

    private boolean needsPermission() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && getPermissionState("ble") != PermissionState.GRANTED;
    }

    @Override public void load() {
        SharedPreferences p = getContext().getSharedPreferences("strumento", Context.MODE_PRIVATE);
        addr = p.getString("addr", null); name = p.getString("name", null);
    }

    @PluginMethod
    public void connect(PluginCall call) {
        if (needsPermission()) { requestPermissionForAlias("ble", call, "permDone"); return; }
        doConnect(call);
    }
    @PermissionCallback
    private void permDone(PluginCall call) {
        if (needsPermission()) { call.reject("Permesso Bluetooth negato"); return; }
        doConnect(call);
    }
    private void doConnect(PluginCall call) {
        BluetoothManager bm = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        BluetoothAdapter ad = bm == null ? null : bm.getAdapter();
        if (ad == null || !ad.isEnabled()) { call.reject("Bluetooth spento"); return; }
        want = true; startScan(ad);
        JSObject r = new JSObject(); r.put("scanning", true); r.put("known", name); call.resolve(r);
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        want = false; stopScan(); closeGatt(); state("spento", null); call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("want", want); r.put("connected", gatt != null && System.currentTimeMillis() - lastRx < 2000);
        r.put("name", name); r.put("lines", lines); r.put("age", lastRx == 0 ? -1 : System.currentTimeMillis() - lastRx);
        call.resolve(r);
    }

    @SuppressLint("MissingPermission")
    private void startScan(BluetoothAdapter ad) {
        if (scanning || !want) return;
        scanner = ad.getBluetoothLeScanner(); if (scanner == null) return;
        ScanFilter f = new ScanFilter.Builder().setServiceUuid(new ParcelUuid(NUS)).build();
        ScanSettings s = new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build();
        try { scanner.startScan(Collections.singletonList(f), s, scanCb); scanning = true; state("ricerca", null); } catch (Exception e) { state("errore", e.getMessage()); }
        h.postDelayed(() -> { if (scanning) { stopScan(); if (want && gatt == null) h.postDelayed(() -> startScan(ad), 5000); } }, 15000);
    }
    @SuppressLint("MissingPermission")
    private void stopScan() { try { if (scanner != null && scanning) scanner.stopScan(scanCb); } catch (Exception ignored) {} scanning = false; }

    private final ScanCallback scanCb = new ScanCallback() {
        @SuppressLint("MissingPermission")
        @Override public void onScanResult(int type, ScanResult r) {
            BluetoothDevice d = r.getDevice(); String n = d.getName() == null ? "" : d.getName();
            // la prima scheda col servizio giusto, oppure quella già usata
            if (addr != null && !addr.equals(d.getAddress()) && !n.startsWith("HORIZON")) return;
            stopScan(); addr = d.getAddress(); name = n.isEmpty() ? "HORIZON-AHRS" : n;
            getContext().getSharedPreferences("strumento", Context.MODE_PRIVATE).edit().putString("addr", addr).putString("name", name).apply();
            state("collego", name);
            gatt = d.connectGatt(getContext(), false, gattCb, BluetoothDevice.TRANSPORT_LE);
        }
    };

    private final BluetoothGattCallback gattCb = new BluetoothGattCallback() {
        @SuppressLint("MissingPermission")
        @Override public void onConnectionStateChange(BluetoothGatt g, int st, int ns) {
            if (ns == BluetoothProfile.STATE_CONNECTED) { g.requestConnectionPriority(BluetoothGatt.CONNECTION_PRIORITY_HIGH); g.requestMtu(185); }
            else if (ns == BluetoothProfile.STATE_DISCONNECTED) {
                closeGatt(); state("perso", name);
                if (want) h.postDelayed(() -> { BluetoothManager bm = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE); if (bm != null) startScan(bm.getAdapter()); }, 1500);
            }
        }
        @SuppressLint("MissingPermission")
        @Override public void onMtuChanged(BluetoothGatt g, int mtu, int st) { g.discoverServices(); }
        @SuppressLint("MissingPermission")
        @Override public void onServicesDiscovered(BluetoothGatt g, int st) {
            BluetoothGattService s = g.getService(NUS); BluetoothGattCharacteristic tx = s == null ? null : s.getCharacteristic(NUS_TX);
            if (tx == null) { state("errore", "servizio non trovato"); return; }
            g.setCharacteristicNotification(tx, true);
            BluetoothGattDescriptor d = tx.getDescriptor(CCCD);
            if (d != null) {
                if (Build.VERSION.SDK_INT >= 33) g.writeDescriptor(d, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                else { d.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE); g.writeDescriptor(d); }
            }
            state("collegato", name);
        }
        @Override public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic c, byte[] v) { rx(v); }
        @SuppressWarnings("deprecation")
        @Override public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic c) { if (Build.VERSION.SDK_INT < 33) rx(c.getValue()); }
    };

    private void rx(byte[] v) {
        if (v == null) return; lastRx = System.currentTimeMillis();
        buf.append(new String(v, StandardCharsets.US_ASCII));
        int i;
        while ((i = buf.indexOf("\n")) >= 0) {
            String line = buf.substring(0, i).trim(); buf.delete(0, i + 1);
            if (line.startsWith("$") && line.length() > 4) { lines++; JSObject o = new JSObject(); o.put("l", line); notifyListeners("line", o); }
        }
        if (buf.length() > 600) buf.setLength(0);
    }
    @SuppressLint("MissingPermission")
    private void closeGatt() { try { if (gatt != null) { gatt.disconnect(); gatt.close(); } } catch (Exception ignored) {} gatt = null; }
    private void state(String s, String n) { JSObject o = new JSObject(); o.put("s", s); if (n != null) o.put("n", n); notifyListeners("state", o); }
}
