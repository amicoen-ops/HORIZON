// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
package it.amicoen.horizon;

import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;
import android.provider.Settings;
import android.util.Base64;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.util.Collections;
import java.util.List;

/**
 * Licenza: dati del dispositivo, controllo della firma dell'app e abbonamento con Google Play (Play Billing).
 * L'abbonamento "licenza_annuale" (piano base annuale, rinnovo automatico) vale su tutti i telefoni dell'account Google: per ora è rinviato.
 * "Offrimi un caffè" è un prodotto a consumo: si può comprare più volte e non sblocca niente.
 */
@CapacitorPlugin(name = "Licenza")
public class LicenzaPlugin extends Plugin implements PurchasesUpdatedListener {

    // Chiave pubblica di licenza della Play Console (Monetizzazione › Configurazione › Licenze), base64.
    // Vuota: gli acquisti si verificano solo con Google Play stesso (senza il controllo della firma qui).
    private static final String PLAY_KEY = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAy+1jgHr5v42nPW4tt2sjt/uSeSgX1yS9r0O9cy9KdiCpQgny7cKWJUcwwHB4TPTFUNYW5/D2yxIV+9F8zb1Jc9ajkyExTxxrqFnNtti08QtaDWt8e0X8CRMr5Oq2YXIcBmoG5e0tooHj+sqipI4eBG12ESt0ObUEn46koq0zkonNtg/DfPVWT5coSsSx1sI5YxIF+o9WwfGfzoJcTZHrUn/eE+t6RcCvsMT84mUeeAwvCKFgHH1wJ25jbbA3/KHa5iEA+d9pUDBfMjSk6nVvhBaLc+UZ3M2C6BYjFw//PE7emL3AG1Cr5n8kWywd+kGRO4qK7IPIQdBk14qORo0hMQIDAQAB";
    // Impronte SHA-256 dei certificati che possono firmare l'app (Play App Signing e chiave degli APK).
    // Vuoto: controllo della firma spento.
    private static final String[] CERTS = {
        "5DA448CEC29E9CD8142342DECC900540D913DC65BAC03D69E25592702A7F7F11",   // firma di Google Play (Play App Signing)
        "EDB1F20C9034B92D28152BAD34A0832B4C42BDF5F26BECF04F8C0F977DF64ACB"    // chiave di caricamento, anche degli APK di GitHub
    };

    private BillingClient billing;
    private ProductDetails product;
    private PluginCall buyCall;
    private String basePlan = "annuale";
    private String offerToken;
    private ProductDetails caffe;
    private PluginCall caffeCall;

    @PluginMethod
    public void info(PluginCall call) {
        JSObject r = new JSObject();
        try {
            String id = Settings.Secure.getString(getContext().getContentResolver(), Settings.Secure.ANDROID_ID);
            r.put("deviceId", id == null ? "" : id);
            PackageInfo pi = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            r.put("firstInstall", pi.firstInstallTime);
            String inst = null;
            try {
                if (Build.VERSION.SDK_INT >= 30) inst = getContext().getPackageManager().getInstallSourceInfo(getContext().getPackageName()).getInstallingPackageName();
                else inst = getContext().getPackageManager().getInstallerPackageName(getContext().getPackageName());
            } catch (Exception ignored) { }
            r.put("installer", inst == null ? "" : inst);
            String cert = "";
            try { cert = certSha256(); } catch (Exception ignored) { }
            r.put("cert", cert);
            // firma valida se coincide con una delle impronte note, oppure se l'app arriva dal Play Store
            // (Google la firma con la chiave di Play App Signing; un errore nel leggere la firma non deve bloccare chi l'ha installata da lì)
            boolean ok = CERTS.length == 0 || cert.isEmpty() || "com.android.vending".equals(inst);
            for (String c : CERTS) if (c.equalsIgnoreCase(cert)) ok = true;
            r.put("signatureOk", ok);
        } catch (Exception e) { r.put("error", String.valueOf(e.getMessage())); }
        call.resolve(r);
    }

    @SuppressWarnings("deprecation")
    private String certSha256() throws Exception {
        PackageManager pm = getContext().getPackageManager();
        Signature[] sigs;
        if (Build.VERSION.SDK_INT >= 28) {
            PackageInfo pi = pm.getPackageInfo(getContext().getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
            sigs = pi.signingInfo.hasMultipleSigners() ? pi.signingInfo.getApkContentsSigners() : pi.signingInfo.getSigningCertificateHistory();
        } else {
            sigs = pm.getPackageInfo(getContext().getPackageName(), PackageManager.GET_SIGNATURES).signatures;
        }
        if (sigs == null || sigs.length == 0) return "";
        byte[] d = MessageDigest.getInstance("SHA-256").digest(sigs[sigs.length - 1].toByteArray());
        StringBuilder sb = new StringBuilder();
        for (byte b : d) sb.append(String.format("%02X", b));
        return sb.toString();
    }

    // ---------- Google Play Billing ----------
    @PluginMethod
    public void billingStart(PluginCall call) {
        String pid = call.getString("product", "licenza_annuale");
        basePlan = call.getString("basePlan", "annuale");
        if (billing == null) {
            billing = BillingClient.newBuilder(getContext())
                .setListener(this)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .build();
        }
        if (billing.isReady()) { queryProduct(pid, call); return; }
        billing.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult res) {
                if (res.getResponseCode() == BillingClient.BillingResponseCode.OK) queryProduct(pid, call);
                else { JSObject r = new JSObject(); r.put("ok", false); r.put("error", res.getDebugMessage()); r.put("code", res.getResponseCode()); call.resolve(r); }
            }
            @Override public void onBillingServiceDisconnected() { }
        });
    }

    private void queryProduct(String pid, PluginCall call) {
        QueryProductDetailsParams q = QueryProductDetailsParams.newBuilder()
            .setProductList(Collections.singletonList(QueryProductDetailsParams.Product.newBuilder()
                .setProductId(pid).setProductType(BillingClient.ProductType.SUBS).build()))
            .build();
        billing.queryProductDetailsAsync(q, (res, result) -> {
            JSObject r = new JSObject();
            List<ProductDetails> list = result.getProductDetailsList();
            if (res.getResponseCode() == BillingClient.BillingResponseCode.OK && list != null && !list.isEmpty()) {
                product = list.get(0);
                r.put("ok", true);
                // offerta del piano base annuale (senza offerte promozionali): il prezzo è l'ultima fase, quella che si rinnova
                List<ProductDetails.SubscriptionOfferDetails> offers = product.getSubscriptionOfferDetails();
                ProductDetails.SubscriptionOfferDetails pick = null;
                if (offers != null) for (ProductDetails.SubscriptionOfferDetails o : offers) {
                    if (basePlan.equals(o.getBasePlanId()) && o.getOfferId() == null) { pick = o; break; }
                    if (pick == null) pick = o;
                }
                if (pick != null) {
                    offerToken = pick.getOfferToken();
                    List<ProductDetails.PricingPhase> ph = pick.getPricingPhases().getPricingPhaseList();
                    ProductDetails.PricingPhase last = ph.get(ph.size() - 1);
                    r.put("price", last.getFormattedPrice());
                    r.put("period", last.getBillingPeriod());
                } else { r.put("ok", false); r.put("error", "nessun piano per l'abbonamento"); }
                r.put("title", product.getName());
            } else {
                r.put("ok", false); r.put("error", "prodotto non trovato: " + res.getDebugMessage()); r.put("code", res.getResponseCode());
            }
            call.resolve(r);
        });
    }

    @PluginMethod
    public void billingBuy(PluginCall call) {
        if (billing == null || !billing.isReady() || product == null || offerToken == null) { call.reject("Google Play non è pronto: riprova tra poco"); return; }
        buyCall = call;
        BillingFlowParams p = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(Collections.singletonList(
                BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product).setOfferToken(offerToken).build()))
            .build();
        BillingResult res = billing.launchBillingFlow(getActivity(), p);
        if (res.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            buyCall = null;
            if (res.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) { billingRestore(call); return; }
            call.reject("Acquisto non avviato: " + res.getDebugMessage());
        }
    }

    // ---------- Offrimi un caffè ----------
    @PluginMethod
    public void caffeStart(PluginCall call) {
        String pid = call.getString("product", "caffe");
        if (billing == null) {
            billing = BillingClient.newBuilder(getContext())
                .setListener(this)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .build();
        }
        if (billing.isReady()) { queryCaffe(pid, call); return; }
        billing.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult res) {
                if (res.getResponseCode() == BillingClient.BillingResponseCode.OK) queryCaffe(pid, call);
                else { JSObject r = new JSObject(); r.put("ok", false); r.put("error", res.getDebugMessage()); r.put("code", res.getResponseCode()); call.resolve(r); }
            }
            @Override public void onBillingServiceDisconnected() { }
        });
    }

    private void queryCaffe(String pid, PluginCall call) {
        QueryProductDetailsParams q = QueryProductDetailsParams.newBuilder()
            .setProductList(Collections.singletonList(QueryProductDetailsParams.Product.newBuilder()
                .setProductId(pid).setProductType(BillingClient.ProductType.INAPP).build()))
            .build();
        billing.queryProductDetailsAsync(q, (res, result) -> {
            JSObject r = new JSObject();
            List<ProductDetails> list = result.getProductDetailsList();
            if (res.getResponseCode() == BillingClient.BillingResponseCode.OK && list != null && !list.isEmpty()) {
                caffe = list.get(0);
                ProductDetails.OneTimePurchaseOfferDetails o = caffe.getOneTimePurchaseOfferDetails();
                r.put("ok", o != null);
                if (o != null) r.put("price", o.getFormattedPrice());
                consumaRimasti();
            } else {
                r.put("ok", false); r.put("error", "prodotto non trovato: " + res.getDebugMessage()); r.put("code", res.getResponseCode());
            }
            call.resolve(r);
        });
    }

    /** Un caffè pagato ma non consumato (app chiusa a metà) bloccherebbe il successivo: si consuma all'avvio. */
    private void consumaRimasti() {
        billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(), (res, list) -> {
            if (res.getResponseCode() != BillingClient.BillingResponseCode.OK || list == null) return;
            JSObject ignora = new JSObject();
            for (Purchase p : list) consumaCaffe(p, ignora);
        });
    }

    @PluginMethod
    public void caffeBuy(PluginCall call) {
        if (billing == null || !billing.isReady() || caffe == null) { call.reject("Google Play non è pronto: riprova tra poco"); return; }
        caffeCall = call;
        BillingFlowParams p = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(Collections.singletonList(
                BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(caffe).build()))
            .build();
        BillingResult res = billing.launchBillingFlow(getActivity(), p);
        if (res.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            caffeCall = null;
            call.reject("Acquisto non avviato: " + res.getDebugMessage());
        }
    }

    private boolean isCaffe(Purchase p) { return caffe != null && p.getProducts().contains(caffe.getProductId()); }

    private void consumaCaffe(Purchase p, JSObject r) {
        if (!isCaffe(p)) return;
        if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) { r.put("pending", true); return; }
        if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) return;
        if (!verify(p.getOriginalJson(), p.getSignature())) { r.put("badSignature", true); return; }
        billing.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(), (cr, token) -> { });
        r.put("thanks", true);
    }

    @Override
    public void onPurchasesUpdated(BillingResult res, List<Purchase> purchases) {
        boolean diCaffe = false;
        if (purchases != null) for (Purchase p : purchases) if (isCaffe(p)) diCaffe = true;
        if (caffeCall != null || diCaffe) {
            PluginCall cc = caffeCall; caffeCall = null;
            JSObject cr = new JSObject();
            if (res.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
                for (Purchase p : purchases) consumaCaffe(p, cr);
            } else if (res.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
                cr.put("cancelled", true);
            }
            if (cc != null) cc.resolve(cr);
            return;
        }
        PluginCall call = buyCall; buyCall = null;
        JSObject r = new JSObject(); r.put("checked", true); r.put("owned", false);
        if (res.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase p : purchases) if (handle(p, r)) break;
        } else if (res.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            r.put("cancelled", true);
        } else if (res.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            if (call != null) { billingRestore(call); return; }
        }
        if (call != null) call.resolve(r);
    }

    @PluginMethod
    public void billingRestore(PluginCall call) {
        if (billing == null || !billing.isReady()) { JSObject r = new JSObject(); r.put("checked", false); r.put("owned", false); call.resolve(r); return; }
        billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(), (res, list) -> {
            JSObject r = new JSObject(); r.put("owned", false);
            r.put("checked", res.getResponseCode() == BillingClient.BillingResponseCode.OK);
            if (list != null) for (Purchase p : list) if (handle(p, r)) break;
            call.resolve(r);
        });
    }

    /** Abbonamento valido: attivo (Google restituisce solo quelli in corso), del nostro prodotto, con firma corretta; confermato a Google se serve. */
    private boolean handle(Purchase p, JSObject r) {
        if (product != null && !p.getProducts().contains(product.getProductId())) return false;
        if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) { r.put("pending", true); return false; }
        if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) return false;
        if (!verify(p.getOriginalJson(), p.getSignature())) { r.put("badSignature", true); return false; }
        if (!p.isAcknowledged()) {
            billing.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(), ar -> { });
        }
        r.put("owned", true);
        r.put("autoRenew", p.isAutoRenewing());
        r.put("token", p.getPurchaseToken());
        r.put("order", p.getOrderId() == null ? "" : p.getOrderId());
        return true;
    }

    private boolean verify(String data, String sig) {
        if (PLAY_KEY.isEmpty()) return true;
        try {
            PublicKey k = KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(Base64.decode(PLAY_KEY, Base64.DEFAULT)));
            java.security.Signature s = java.security.Signature.getInstance("SHA1withRSA");
            s.initVerify(k); s.update(data.getBytes("UTF-8"));
            return s.verify(Base64.decode(sig, Base64.DEFAULT));
        } catch (Exception e) { return false; }
    }

    @Override
    protected void handleOnDestroy() { if (billing != null) billing.endConnection(); }
}
