# Informativa sulla privacy — HORIZON · strumento di volo

Ultimo aggiornamento: 3 novembre 2026

Titolare: Enrico D'Amico, amicoen@gmail.com

L'app non ha account, pubblicità o strumenti di analisi. Non vende dati e non li cede a nessuno.

## Cosa resta sul telefono

Questi dati restano solo sul telefono, nella memoria dell'app:

- posizione e quota;
- assetto, cioè sensori di movimento;
- rotte, campi aggiunti e note;
- diario di volo e tracce GPX;
- impostazioni.

Si cancellano disinstallando l'app o cancellandone i dati da Android.

## Cosa esce in rete, e verso chi

Per funzionare l'app chiede dati a servizi esterni. Ogni richiesta porta solo quello che serve a quel servizio.

- **Mappe** — OpenStreetMap, OpenTopoMap, Esri (solo con la tua chiave), Geoportale Nazionale. L'app chiede le tessere della zona mostrata, e dalla zona si capisce dove ti trovi più o meno.
- **Terreno** — AWS Open Data (Terrain Tiles). Anche qui l'app chiede le tessere della zona mostrata.
- **Meteo** — Open-Meteo e aviationweather.gov (NOAA). Al primo l'app manda le coordinate dei campi del piano di volo, al secondo le sigle ICAO degli aeroporti.
- **Traffico in tempo reale**, solo se è acceso (Impostazioni › Traffico) — Open Glider Network (live.glidernet.org) e adsb.lol. L'app manda la zona in cui sei arrotondata a 0,1° (circa 10 km), mai la posizione esatta, e riceve gli aerei di quella zona. Se usi SafeSky sullo stesso telefono, il suo traffico arriva dentro il telefono (porta UDP 4000) e non esce niente.
- **Aggiornamenti**, solo nella versione scaricata da GitHub — GitHub. L'app legge il numero dell'ultima versione pubblicata.
- **Segnalazioni** — Web3Forms (FormSubmit di riserva), che le inoltra per posta al titolare. Partono solo quando invii tu una segnalazione dalla pagina Info, e contengono:
  - il testo che scrivi;
  - la tua email, se la metti;
  - i dati tecnici, se lasci la spunta: versione, modello del telefono, stato dei sensori, ultimi errori e ultime azioni nell'app, mai la posizione.
- **Archivio comune delle piste e dei campi**, solo se dici di sì — stesso canale delle segnalazioni (Web3Forms o FormSubmit, poi posta del titolare). Serve a mettere nelle mappe di tutti le piste che mancano e a sapere quali campi si usano di più.
  - **Pista rilevata**: dopo che hai salvato una pista nuova, l'app ti chiede, a terra e ogni volta, se condividerla. Se dici di sì manda la posizione del centro della pista, la direzione, la lunghezza, la quota e il campo vicino. È la posizione della pista, non la tua traccia di volo.
  - **Campi usati**: se accetti il conteggio (la prima volta l'app lo chiede, poi si cambia in Impostazioni › Condivisione anonima), l'app conta decolli e atterraggi per campo e una volta alla settimana manda solo le sigle dei campi e i numeri, senza orari e senza tracce.
  - Entrambi portano un codice casuale del telefono (8 caratteri, creato dall'app, non legato a te né al telefono) e la versione dell'app: serve solo a contare quanti telefoni diversi hanno visto la stessa pista. Una pista entra nelle mappe di tutti se la vedono almeno 3 telefoni diversi, oppure dopo il controllo del titolare.

Ognuno di questi servizi tratta le richieste secondo la propria informativa.

## Abbonamento e licenza

- **Versione Play Store** — L'abbonamento annuale si acquista con il sistema di pagamento di Google Play. Il pagamento lo gestisce Google: l'app non vede né conserva carta, nome o indirizzo. A ogni avvio l'app chiede a Google Play solo se l'abbonamento è attivo, e salva sul telefono lo stato e la data dell'ultimo controllo. Il trattamento dei dati di pagamento segue l'informativa di Google (https://policies.google.com/privacy).
- **Versione APK da GitHub e versione web** — L'abbonamento annuale si paga su Polar (polar.sh). Se attivi la chiave, l'app manda a Polar la chiave di licenza e un identificativo casuale del dispositivo, creato dall'app, per contare i dispositivi attivati. L'email con cui paghi la tratta Polar secondo la propria informativa.

Dati di prova: i 30 giorni di prova si contano sul telefono e non escono dal telefono.

## Bluetooth e permessi

- **Posizione precisa**: serve per GPS, mappa, navigazione e avvisi. L'app la usa solo mentre è aperta, mai in background.
- **Dispositivi nelle vicinanze (Bluetooth)**: serve solo a collegare il GPS esterno che scegli, per esempio un Garmin GLO 2. L'app non cerca e non registra altri dispositivi.
- **Stato della batteria e del segnale**: l'app legge la carica e la potenza del segnale per mostrarle nella riga di stato. Non escono dal telefono.
- **WiFi multicast**: serve solo a ricevere il traffico in GDL90 da SafeSky, SkyEcho, PilotAware o Stratux sulla rete locale.

## Conservazione e cancellazione

Le segnalazioni restano nella casella di posta del titolare finché servono a risolvere il problema. Le piste condivise e i conteggi dei campi restano nell'archivio del progetto, senza il codice del telefono quando entrano nelle mappe. Per farle cancellare, o per qualunque domanda, scrivi a amicoen@gmail.com.

## Minori

L'app è uno strumento per piloti e non è rivolta ai minori.

---

## Privacy policy (English summary)

The app has no accounts, ads or analytics. Position, routes, logbook and settings stay on the device.

Network requests go to map, terrain and weather services, and contain only the area shown or the airfield codes. If live traffic is on, the app sends the area rounded to 0.1° (about 10 km), never the exact position, to Open Glider Network and adsb.lol. Reports are sent by e-mail through Web3Forms (FormSubmit as fallback), and only when you send one. They contain the text you write, your e-mail address if you add it, and, if you allow it, technical data without position.

If you say yes, the app also shares runways it detected (runway position, direction, length and elevation, never your track) and, once a week, how many take-offs and landings you made at each airfield (airfield codes and counts only). Both carry a random 8-character code created by the app, used only to count how many different phones saw the same runway. A runway is added to everyone's maps when at least 3 phones saw it, or after the developer checks it. You can turn the airfield count off in Settings › Condivisione anonima.

Location is used only while the app is open. Bluetooth is used only to connect the external GPS you choose.
**Subscription.** On Google Play the yearly subscription is paid through Google Play billing; the app never sees payment details and only asks Google Play whether the subscription is active. In the GitHub APK and web version the yearly subscription is paid on Polar (polar.sh); activating the key sends the licence key and a random device identifier to Polar. The 30-day trial is counted on the device.

Contact: amicoen@gmail.com
