# HORIZON · strumento di volo: scheda del Play Store e guida alla pubblicazione

## 1. Cosa fare tu, una volta sola

1. **Account sviluppatore Google Play**
   - Vai su https://play.google.com/console e crea un account personale.
   - Paghi una volta 25 dollari, con documento d'identità e verifica del telefono. La verifica può richiedere qualche giorno.
2. **Crea l'app**
   - In Play Console scegli *Crea app*.
   - Nome: «HORIZON · strumento di volo».
   - Lingua predefinita: italiano.
   - ID dell'app (pacchetto): **it.amicoen.horizon** — lo assegna il primo file .aab caricato e non si cambia più.
   - Tipo: app, gratuita (si scarica gratis; dopo 30 giorni di prova serve l'abbonamento, vedi il capitolo 6).
3. **Firma dell'app**
   - Accetta *Firma dell'app di Google Play*, che è la scelta proposta.
   - Il file .aab che compila GitHub è già firmato con la nostra chiave. Per Google quella diventa la *chiave di caricamento*.
4. **Test chiuso (obbligatorio per gli account personali nuovi)**
   - Vai in *Test › Test chiuso* e crea un canale.
   - Aggiungi almeno **12 tester**, con il loro indirizzo Gmail: Fabio, amici del campo…
   - Carica il file `HORIZON-1.0.N-play-store.aab`, che trovi nella release dello stesso numero su GitHub.
   - I tester devono accettare l'invito e restare iscritti **14 giorni di fila**. Solo dopo Google ti lascia chiedere l'accesso alla *Produzione*, cioè la pubblicazione per tutti.
5. **Compila le schede** con i testi qui sotto. Ti servono questi file della cartella `docs/play`:
   - `icona-512.png`;
   - `grafica-in-evidenza-1024x500.png`;
   - le schermate del telefono `schermata-*.png`, almeno 2 (sono 5);
   - la schermata del tablet `tablet-*.png`.
6. **Produzione**
   - Dopo i 14 giorni chiedi l'accesso alla produzione e rispondi alle domande sul test.
   - Poi carica lo stesso .aab in *Produzione*.

Ogni aggiornamento successivo: nella release nuova su GitHub prendi il file .aab e caricalo in Play Console, in *Produzione › Crea nuova release*.

**Attenzione: le due versioni non si aggiornano a vicenda.**
- **APK da GitHub**: firmato con la nostra chiave, con donazione e aggiornamenti automatici.
- **App del Play Store**: firmata da Google, senza donazione e aggiornata dal Play Store.

Android non installa l'una sopra l'altra. Per passare da una all'altra:
1. esporta rotte e diario;
2. disinstalla quella che hai;
3. installa l'altra.

## 2. Perché la versione Play Store non ha la donazione

Le regole sui pagamenti di Google Play non permettono di chiedere donazioni dentro l'app, se non per enti non profit riconosciuti. Nel settembre 2026 Google ha bloccato gli aggiornamenti di AnkiDroid per un link di donazione. Proibiscono anche gli aggiornamenti scaricati fuori dal Play Store.

Per questo la versione per il Play Store (`channel: play`):
- non mostra PayPal né l'invito all'avvio;
- non controlla gli aggiornamenti su GitHub: si aggiorna con il sistema di Google (Play In-App Updates, libreria `app-update`), che propone «Aggiorna ora» all'avvio;
- non ha il permesso `REQUEST_INSTALL_PACKAGES` (installare app): lo aggiunge la compilazione solo all'APK di GitHub, e la compilazione del Play Store controlla che non ci sia.

Tutto il resto è identico. La donazione resta nell'APK di GitHub.

Se un domani vuoi una donazione anche nel Play Store, l'unica strada ammessa è il sistema di pagamento di Google: per esempio un acquisto «Offrimi un caffè» dentro l'app, su cui Google trattiene il 15%. Si può aggiungere.

## 3. Scheda dello Store

Requisiti da indicare: **Android 14 o più recente** (il file .aab lo dichiara già: il Play Store non mostra l'app ai telefoni più vecchi). Consigliata l'ultima versione di Android.


**Nome dell'app** (massimo 30 caratteri):
HORIZON · strumento di volo

**Descrizione breve** (massimo 80 caratteri):
Orizzonte, mappa, terreno e piano di volo per ULM e VDS, anche senza internet

**Descrizione completa:**

HORIZON · strumento di volo trasforma il telefono o il tablet in uno strumento di bordo per la consapevolezza della situazione: orizzonte sintetico, mappa mobile con il terreno, guida verso il campo, circuito e avvisi.

Nato per un Avid Flyer basato alla Carolina (Caluso) e sviluppato per ULM, VDS e aviazione generale da diporto.

COSA FA
• Orizzonte sintetico dai sensori del telefono, con compensazione di virata dalla velocità GPS, regolabile più o meno morbido. Funziona col telefono in verticale o in orizzontale.
• Terreno vero (DEM) nella vista sintetica e nella mappa, con avviso vocale «TERRENO! CABRA» guardando 30–60 secondi avanti.
• Mappa mobile con zoom da 1 a 700 km: OpenTopoMap, OpenStreetMap, satellite Esri (con chiave gratuita), tavolette IGM 1:25.000 e ortofoto del Geoportale Nazionale.
• 342 aeroporti e aviosuperfici di tutto il Nord Italia, con piste. Ricerca scrivendo il nome; campi e piste aggiunti da te.
• Direct to e rotte: guida, scelta della pista col vento, circuito con sottovento, base e finale, stima dello spazio di arresto.
• Vento e velocità vera stimati dalle virate, senza Pitot.
• Piano di volo con meteo del modello su ogni campo, METAR e TAF, NOTAM confrontati con la rotta, spazi aerei OpenAir con profilo verticale, aggiornabili a ogni ciclo AIRAC.
• Simula: lo strumento vola da solo una rotta o un direct to, con vento e tempo accelerato, per provare la rotta a terra.
• Diario di volo automatico, con esportazione in GPX e CSV.
• GPS esterno Garmin GLO 2 via Bluetooth, oppure il GPS del telefono, con passaggio automatico.
• Avvisi di spazio aereo e di tramonto, voce e vibrazione.
• Su tablet in orizzontale: orizzonte e mappa insieme.
• Funziona senza internet: terreno e mappe si scaricano prima del volo.

PRIVACY
Nessun account, nessuna pubblicità, nessuna analisi. Posizione, rotte e diario restano sul telefono.

IMPORTANTE
Strumento sperimentale, non certificato e non approvato da EASA o ENAC. Non sostituisce gli strumenti di bordo, le carte, l'AIP, i NOTAM né il meteo ufficiale. Il pilota in comando resta l'unico responsabile del volo.

**Categoria:** Mappe e navigazione
**Tag:** Aviazione, Navigazione, Meteo
**Email di contatto:** amicoen@gmail.com
**Informativa sulla privacy (URL):** https://github.com/amicoen-ops/HORIZON/blob/main/PRIVACY.md

## 4. Contenuti dell'app (risposte per Play Console)

**Accesso all'app:** tutte le funzioni sono disponibili senza credenziali.

**Annunci:** no, l'app non contiene annunci.

**Classificazione dei contenuti** (questionario IARC):
- categoria «Utilità, produttività, comunicazione o altro»;
- risposta «no» a violenza, sesso, linguaggio, droghe, gioco d'azzardo, contenuti generati dagli utenti condivisi, acquisti;
- risultato atteso: PEGI 3.

**Pubblico di destinazione:** 18 anni e oltre. Non è rivolta ai bambini.

**App di notizie:** no. **App per la salute:** no. **Servizi finanziari:** no. **App governativa:** no.

**Sicurezza dei dati:**
- *Raccoglie o condivide dati?* Sì, solo per le segnalazioni facoltative.
- **Posizione**: non raccolta. La posizione resta sul telefono, e le richieste di mappe e terreno contengono solo la zona mostrata.
- **Informazioni personali › Indirizzo email**: raccolto solo se lo scrivi in una segnalazione.
  - Facoltativo, non condiviso con terzi.
  - Scopo: assistenza.
  - Trasmesso cifrato.
- **Informazioni e prestazioni dell'app › Log degli arresti anomali e Diagnostica**: raccolti solo quando invii una segnalazione con la spunta «dati tecnici».
  - Facoltativi.
  - Scopo: analisi e correzione dei problemi.
  - Trasmessi cifrati.
- **Altri contenuti generati dall'utente** (il testo della segnalazione): stesse condizioni.
- **I dati sono cifrati in transito:** sì (HTTPS).
- **Gli utenti possono chiedere la cancellazione:** sì, scrivendo a amicoen@gmail.com.

**Autorizzazioni:**
- **Posizione precisa**: usata solo in primo piano. Non serve la dichiarazione per la posizione in background.
- **Bluetooth (dispositivi nelle vicinanze)**: serve solo a collegare il GPS esterno scelto dall'utente.

## 5. File in questa cartella

| File | Uso |
|---|---|
| `icona-512.png` | Icona dell'app (512 × 512) |
| `grafica-in-evidenza-1024x500.png` | Grafica in evidenza |
| `schermata-1-orizzonte.png` … `schermata-5-piano.png` | Schermate del telefono (1080 × 1920) |
| `tablet-1-orizzonte-e-mappa.png` | Schermata per tablet da 10 pollici (2560 × 1600) |


## 6. Abbonamento annuale da 20 € (licenza d'uso)

Come funziona nell'app (versione Play Store):
- 30 giorni di prova senza carta dal primo avvio; avvisi negli ultimi 7 giorni.
- Poi l'app chiede l'abbonamento: **20 € all'anno**, rinnovo automatico, su tutti i telefoni dello stesso account Google. Si disdice dal Play Store (Abbonamenti) e resta attiva fino alla fine dell'anno pagato.
- L'app ricontrolla l'abbonamento con Google a ogni avvio; senza rete resta valido 7 giorni dall'ultimo controllo.
- **In volo non si blocca mai**: la richiesta compare solo a terra.
- Finché l'abbonamento non esiste nella Play Console, l'app resta completa (nessun blocco).

Passi nella Play Console (una volta sola):
1. **Profilo pagamenti**: Play Console › Impostazioni › Profilo pagamenti › crea o collega il profilo commerciante (dati fiscali e conto per gli incassi). Senza, non si possono creare prodotti a pagamento.
2. **Carica l'AAB** (`HORIZON-1.0.N-play-store.aab`) in Test › Test interni: la Play Console permette di creare abbonamenti solo dopo aver caricato una versione che contiene Google Play Billing.
3. Monetizzazione › Prodotti › **Abbonamenti** › Crea abbonamento:
   - ID prodotto: **`licenza_annuale`** (esattamente così)
   - Nome: «Licenza annuale HORIZON»
4. Nell'abbonamento › **Aggiungi un piano base**:
   - ID piano base: **`annuale`** (esattamente così)
   - Tipo: rinnovo automatico · Periodo di fatturazione: **1 anno**
   - Prezzo: **20,00 EUR** (Google propone i prezzi per gli altri Paesi: puoi accettarli)
   - Periodo di tolleranza e sospensione dell'account: lascia i valori proposti
   - Nessuna offerta di prova gratuita di Google (la prova di 30 giorni è già nell'app) → **Attiva** il piano base.
5. Impostazioni › **Test delle licenze**: aggiungi la tua Gmail (e quelle dei tester). Con quegli account l'acquisto è finto e l'abbonamento annuale si rinnova ogni 30 minuti: serve per provare acquisto, disdetta e scadenza senza pagare.
6. Monetizzazione › Configurazione › **Licenze**: copia la «chiave pubblica con codifica Base64» e mandamela: la metto nell'app per controllare la firma di Google su ogni acquisto.
7. Configurazione › Integrità dell'app › **Firma dell'app**: copia l'impronta **SHA-256 del certificato della chiave di firma dell'app** e mandamela: l'app verifica di essere firmata da Google per te (una copia modificata non si sblocca).

Commissione di Google sugli abbonamenti: 15%. Il prezzo comprende l'IVA, che Google versa per te. Su 20 €: circa 3,61 € di IVA, 2,46 € di commissione, a te circa 13,90 € a cliente all'anno. Per la dichiarazione dei guadagni senti il tuo commercialista.

Attenzione: finché l'APK di GitHub e la versione web restano gratuite, chi le trova può usare l'app senza abbonamento. Quando la versione del Play Store è pubblicata conviene togliere l'APK pubblico, oppure attivare anche lì la licenza (per esempio con Polar.sh).
