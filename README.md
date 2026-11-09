# HORIZON — strumento di volo

Orizzonte sintetico, mappa mobile, rotte disegnate a dito, profilo verticale, circuito e atterraggio, piano di volo e meteo per ultraleggeri (VDS) e aerei VFR, su telefono, tablet e browser.
HORIZON nasce dallo strumento da 80 mm costruito per un Avid Flyer; oggi gestisce più velivoli, ognuno con il suo profilo: velocità e archi, prestazioni, carburante, pesi e centraggio, equipaggiamento.

- **Android**: Google Play Store oppure APK dalle [Release](https://github.com/amicoen-ops/HORIZON/releases).
- **iPhone, iPad e computer**: [amicoen-ops.github.io/HORIZON](https://amicoen-ops.github.io/HORIZON/) — su iPhone Safari › Condividi › *Aggiungi alla schermata Home*.
- **Requisiti**: **Android 14** o più recente (consigliata l'ultima versione disponibile); su iPhone e iPad l'ultima versione di iOS/iPadOS.

## Cosa fa
- **Orizzonte sintetico** con terreno 3D vero (modello digitale del terreno), avvisi «TERRENO! CABRA», scala di velocità colorata secondo il velivolo attivo.
- **Mappa** da 1 a 700 km (OpenTopoMap, OpenStreetMap, satellite, IGM, ortofoto), spostabile col dito, con cerchio di planata.
- **Rotta disegnata a schermo pieno**: punti di riporto VFR, punti da non sorvolare, «Calcola rotta» intorno alle zone P/R e agli spazi vietati per il tipo di volo, dalle valli, col vento previsto; quota ideale per ogni tratta.
- **Profilo verticale** con terreno, spazi aerei e quota.
- **Spazi aerei d'Italia** da openAIP (aggiornati a ogni ciclo AIRAC) con le regole di VDS basico, VDS avanzato e aviazione generale VFR.
- **Velivoli**: profili con VS0, VS1, VFE, VA, VNO, VNE, VX, VY, planata, avvicinamento, crociera; salita, efficienza, distanze di decollo e atterraggio, vento al traverso; serbatoi e consumi; pesi, bracci e limiti del baricentro; transponder e radio.
- **Piano di volo** con carburante, carico e centraggio, meteo del modello, METAR e TAF, NOTAM.
- **Diario di volo** automatico, tracce degli ultimi 50 voli in GPX e KML.
- **Garmin GLO 2** via Bluetooth, bussola, voce per gli avvisi, schermo sempre acceso.

## Struttura del repository
- `www/` — le pagine dell'app (generate da `build_android.py` e copiate con `tools/prepare_www.py`).
- `android/` — progetto Capacitor; moduli nativi in `android/app/src/main/java/it/amicoen/horizon/` (GLO 2, bussola, firma dell'app e Google Play Billing).
- `.github/workflows/` — compilazione di APK e AAB, collaudo su emulatore Android, pubblicazione del sito.
- `docs/play/` — scheda del Play Store, immagini e guida alla pubblicazione e a «Offrimi un caffè».
- `tools/` — script di collaudo, campi da OurAirports, manuale PDF.

## Compilazione
Ogni push su `main` avvia GitHub Actions: l'APK e l'AAB per il Play Store finiscono tra le **Release**, firmati sempre con la stessa chiave. La chiave è nel repository solo cifrata (`keystore/strumento.keystore.enc`); la password sta nel secret `KEYSTORE_PASSWORD` delle Actions. Ogni versione passa un collaudo automatico su emulatore Android prima di essere distribuita.

## Permessi chiesti al primo uso
- Posizione: GPS del telefono.
- Sensori di movimento (su iPhone e iPad).
- Dispositivi nelle vicinanze: solo quando colleghi il Garmin GLO 2.

**Strumento sperimentale, non certificato**: altimetro, anemometro, vista fuori e radio restano il riferimento. Il pilota in comando è l'unico responsabile del volo.

## Licenza
© 2026 Enrico D'Amico. **Tutti i diritti riservati**: non è software libero né open source.

- **Puoi** installare e usare l'app ufficiale (Play Store, Release o sito) per uso personale e non commerciale, alle condizioni indicate nell'app. L'app è gratuita: chi vuole può offrire un caffè da Google Play o donare con PayPal.
- **Serve il permesso scritto** dell'autore (horizonlicenses@gmail.com) per copiare, modificare, ridistribuire, vendere o riusare il codice.

Testo completo in [LICENSE](LICENSE); componenti di terze parti in [NOTE-TERZE-PARTI](NOTE-TERZE-PARTI); privacy in [PRIVACY.md](PRIVACY.md).
