---
name: horizon
description: Come lavorare su HORIZON (strumento di volo per ultraleggeri e VFR, Capacitor/Android + PWA). Usala per qualsiasi modifica a www/index.html o app.html, ai moduli Java, ai workflow, all'assetto, al vario, al TAWS, agli spazi aerei, alla licenza o al Play Store, e prima di dire che una modifica è provata.
---

# HORIZON: come è fatto e come si lavora

Testi, commenti, commit e risposte all'autore: **in italiano**, frasi semplici, termini aeronautici italiani (virata, beccheggio, rollio, vario, quota, prua, traccia).

## Struttura
- `www/index.html`: lo strumento (orizzonte, mappa, sensori, filtri, avvisi, diario). Un solo grande script; oggetto globale `PH`, stato `S`, scadenze `LIVE`/`STALE`.
- `www/app.html`: il piano (rotte, campi, meteo, NOTAM, spazi aerei openAIP); gira dentro un iframe dello strumento.
- `www/regole.js` (regole VDS basico/avanzato/VFR), `carburante.js`, `prestazioni.js`, `licenza.js`.
- `www/guida.js`: guida in linea (array `G`, una sezione per funzione), tour guidato (array `T`, selettori degli elementi) e catalogo dei velivoli (array `C`, dati indicativi con la fonte; `PH.acDaCatalogo` apre la scheda compilata). Si apre da Info › «Guida e tour» e da Impostazioni › Velivoli › «Dal catalogo». Quando cambia una funzione, aggiornare anche la sua sezione della guida. Ogni file nuovo di `www/` va aggiunto a `sw.js`, `tools/prepare_www.py` e all'impronta in `pubblica-web.yml`.
- `www/` è generata da `build_android.py` (sorgenti nel ramo `v2`, cartella `sorgenti`) e copiata con `tools/prepare_www.py`: una modifica fatta solo qui va riportata anche nei sorgenti.
- `android/app/src/main/java/it/amicoen/horizon/`: plugin nativi (GLO 2 Bluetooth, bussola, GDL90 UDP 4000, batteria/rete, licenza e Play Billing, aggiornamenti).
- Campi volo: `FIELDS_RAW`, uguale in `index.html` e `app.html` (circa 1950: tutta Italia, Francia, Alpi vicine). Si aggiornano scaricando `airports.csv` e `runways.csv` di OurAirports (raw.githubusercontent.com/davidmegginson/ourairports-data/main/), poi `python3 tools/campi_ourairports.py <cartella> campi.json` e `python3 tools/unisci_campi.py campi.json`: i campi esistenti restano come sono (prendono solo piste e quota se non le hanno). Il menu DIRECT TO mostra i 250 più vicini; la ricerca per nome cerca su tutti.
- **Archivio comune delle piste** (piste rilevate dai piloti e campi più usati): l'app manda, con il consenso e solo a terra, righe `HORIZON-PISTA {…}` e `HORIZON-CAMPI {…}` per posta (etichetta Gmail «HORIZON App/Segnalazioni»). `python3 tools/piste_piloti.py posta*.txt` le archivia in `tools/archivio/`, aggiunge a `FIELDS_RAW` di entrambe le pagine le piste viste da almeno 3 telefoni (stessa pista = centro entro 300 m, direzione entro 12°) e aggiorna `PISTE_PILOTI` (riga «Campi volo» nello Stato). Le altre restano in `tools/archivio/in_attesa.json` con il link alla mappa: si approvano con `--approva CHIAVE`. Mai domande in volo: passano da `PH.aTerra`.
- Novità mostrate nell'app: array `PH_CHANGES` in `index.html` (versione = `1.0.<numero della compilazione>`).

## Compilazione e collaudo (GitHub Actions)
- Push su `main` → `build-apk.yml`: prove dell'assetto, APK (canale `apk`), AAB per il Play Store (canale `play`, senza `REQUEST_INSTALL_PACKAGES`), APK di collaudo con il debug della WebView (artifact `apk-collaudo`, non va nelle Release).
- Dopo la compilazione → `test-emulatore.yml`: installa `apk-collaudo` su un emulatore Android 14 e lo pilota via CDP (`tools/emu_test.sh`, `tools/emu_cdp.py`); i risultati finiscono in una issue «Collaudo emulatore».
- In fondo a `build-apk.yml` il file `.aab` va da solo nel canale **Test interni** di Google Play (`r0adkll/upload-google-play`), se c'è il secret `PLAY_SERVICE_ACCOUNT_JSON`; note per i tester in `docs/play/novita/whatsnew-it-IT` (al massimo 500 caratteri). La Produzione resta a mano. Guida: `docs/play/SCHEDA-E-GUIDA.md`, capitolo 7.
- `pubblica-web.yml`: sito GitHub Pages (iPhone, browser) con copia notturna degli spazi aerei openAIP.
- Sul ramo di lavoro i workflow di compilazione non partono: le prove vere arrivano dopo l'unione in `main`.

## Prove da fare prima di dire «provato»
1. **Sintassi** di ogni script dentro le pagine: estrarre i `<script>` inline e compilarli con `new vm.Script(...)` in Node.
2. **Assetto**: `node tools/test_assetto.js`. Usa il codice vero di `PhMahony`, `PH.toBody` e `PH.onMotion`; deve uscire con 0. Se tocchi l'assetto aggiungi un caso, e fai la controprova: il caso nuovo deve fallire con il codice di prima.
   Le registrazioni vere dei telefoni (Impostazioni › «Registra 20 s e invia», arrivano per posta ad amicoen@gmail.com: un filtro di Gmail le mette nel Cestino, e da lì non si leggono finché non si tolgono) vanno in `tools/registrazioni/*.txt`, con l'intestazione `# montaggio [...]`: il test le rigioca nel codice vero.
3. **Browser**: servire `www/` con `python3 -m http.server` e aprire `index.html` con Playwright (Chromium già installato). Per superare le condizioni d'uso: spuntare `#phTermsOk`, poi cliccare `#phTermsGo`; l'invito alla donazione si chiude con «Più tardi». Barra in basso: VOLO, PIANO, TRAFFICO, ALTRO; da ALTRO › SIMULA › «Direct to un campo» › «Avvia la simulazione» per un volo finto con avvisi veri. Controllare `pageerror` e `console.error`. Gli errori di rete verso open-meteo, opentopomap o la cartella `dati/` sono attesi in locale.
4. La parte Java non si compila qui (manca l'SDK Android): dirlo, e lasciare la verifica alla compilazione su `main`.

## Assetto, sensori e vario: convenzioni
- Assi dell'aereo: avanti, destra, giù. Forza specifica a riposo e livellato = (0, 0, −1 g).
- `accelerationIncludingGravity` su Android = forza specifica negli assi del telefono. Safari iOS la dà col segno opposto: `PH.accSign`, riconosciuto da solo con il telefono dritto.
- `rotationRate`: beta attorno a x, gamma attorno a y, alpha attorno a z (°/s). Alcuni Android li danno in un altro ordine: `PH.gyroLearn` e `PH.gmap` li riconoscono confrontando la rotazione della gravità.
- I vettori del telefono si ruotano negli assi dello schermo con `PH.scrAng()`, poi negli assi dell'aereo con la matrice di montaggio `PH.M`: righe = avanti, destra, giù negli assi dello schermo. Il valore di partenza è il telefono in verticale, schermo verso il pilota; LIVELLA (`PH.level`) la ricalcola.
- Passo di tempo: misurato da `e.timeStamp`, perché molti Android dichiarano 16 ms ma mandano 100–200 Hz.
- Compensazione in virata: con V dal GPS, `fy -= r·V/g`, `fz += q·V/g`, `fx -= dV/dt/g`. Il filtro Mahony scarta l'accelerometro se |f| è lontano da 1 g o se la rotazione è forte (`trust`).
- **Virata dal GPS** (senza giroscopio, o giroscopio che per 3 s non vede la virata): la velocità di virata della traccia è una rotazione attorno alla **verticale**. Va portata negli assi dell'aereo con l'assetto **stimato in quel momento** (`[-w sinθ, w sinφ cosθ, w cosφ cosθ]`), mai con l'inclinazione teorica della virata coordinata: in macchina, o ad ali ancora livellate, quell'errore faceva beccheggiare l'orizzonte di circa 28° con il vario a −10 m/s.
- Vario: filtro complementare del 3° ordine su quota GPS e accelerazione verticale (`PhVario`, τ 3 s); senza GPS da 3 s non integra.
- Scadenze dei dati: assetto 0,7 s, velocità e quota 2,5 s, GPS 3,5 s → bandierine rosse, mai valori congelati.

## Logiche di sicurezza (non cambiare le soglie senza dirlo all'autore)
- TAWS: ogni 1 s, da 0 a 60 s a passi di 5 s con il vario. «TERRENO! CABRA» sotto 100 ft entro 30 s, «ATTENZIONE TERRENO» sotto 300 ft. Tace vicino alla destinazione in circuito e senza GPS. Colori del terreno: rosso sotto 60 m, giallo sotto 180 m.
- Spazi aerei: dentro adesso, tra 30 s, tra 1 minuto; giudizio da `IA517_RULES` secondo il tipo di volo.
- Traffico: GDL90 (SafeSky, SkyEcho, PilotAware), oppure OGN e adsb.lol da internet ogni 6 s; triangolo di pericolo entro 1000 ft di lato e di quota, adesso o entro 60 s.
- Planata: raggio = altezza sul terreno × efficienza × 0,75.
- Terreno (AWS Terrarium): contiene il fondo del mare. `phDemAt` dà sempre almeno 0 m (quote, TAWS, rotte); `phDemAt(...,true)` dà il valore vero, e sotto −5 m è mare.
- Calcola rotta (`rdAround` in app.html): il mare al largo è vietato; se non c'è altra strada (isole) si ripete con il mare permesso ma caro (×9, costa ×2). Il costo cresce oltre 3 km da un campo o da terreno pianeggiante (dove atterrare). Le scorciatoie non possono avere più mare del percorso trovato. Una tratta VDS basico si spezza solo se la quota supera il limite del giorno di oltre `RD_VDS_TOL` (500 ft, scelta dell'autore per avere meno punti); quelle sotto la tolleranza sono avvisate in arancione.

## Sicurezza e rete
- Release senza debug della WebView (`webContentsDebuggingEnabled: false`); solo HTTPS, tranne `wms.pcn.minambiente.it` (`network_security_config.xml`); niente backup (`allowBackup=false`, `data_extraction_rules.xml`); FileProvider solo sulla cache.
- Un indirizzo inserito dall'utente deve essere `https://`.
- Al traffico da internet va solo la zona arrotondata a 0,1°, mai la posizione esatta.

## Licenza e vendita
- Per ora si vende solo sul **Play Store**: abbonamento annuale da 30 € (`licenza_annuale` / `annuale`), 30 giorni di prova, in volo l'app non si blocca mai.
- La licenza Polar per APK e web è spenta finché `polarOrg` in `licenza.js` resta un segnaposto. I testi dicono comunque 30 €/anno.
- Niente inviti alla donazione nella versione Play, né quando la licenza a pagamento è attiva.

## Git
- Commit in italiano: titolo che dice cosa cambia per il pilota, poi il perché.
- Lavorare sul ramo assegnato. Se la pull request precedente è già unita, ripartire da `origin/main`.
