# Informativa sulla privacy — HORIZON · strumento di volo

Ultimo aggiornamento: 6 novembre 2026

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
- **Nomi dei punti della rotta** — Overpass API (OpenStreetMap). Mentre disegni una rotta l'app chiede i nomi di paesi, laghi e cime nel riquadro della rotta, arrotondato a 0,1° (circa 10 km): nessuna posizione esatta, nessun dato personale.
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

## Donazioni

L'app è gratuita.

- **Versione Play Store** — «Offrimi un caffè» si paga con il sistema di pagamento di Google Play. Il pagamento lo gestisce Google: l'app non vede né conserva carta, nome o indirizzo. Il trattamento dei dati di pagamento segue l'informativa di Google (https://policies.google.com/privacy).
- **Versione APK da GitHub e versione web** — La donazione si fa su PayPal, che si apre fuori dall'app e tratta i dati secondo la propria informativa.

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
**Donations.** The app is free. On Google Play the optional "Buy me a coffee" is paid through Google Play billing, and the app never sees payment details. In the GitHub APK and web version donations go through PayPal, outside the app.

Contact: amicoen@gmail.com
