# HORIZON · controllo generale del 10 novembre 2026

Tutto il codice è stato riletto a pezzi (strumento, Piano, moduli, Java, workflow, strumenti Python, orologio) e provato nel browser con un volo simulato. Qui c'è l'elenco: prima quello che è stato corretto in questo giro, poi quello che aspetta una tua decisione, poi le ottimizzazioni rimaste.

Come leggere: **provato** = c'è una prova che prima falliva e ora passa; **letto** = verificato sul codice, non con una prova.

## 1. Corretto in questo giro

### Strumento (`www/index.html`)

| Cosa succedeva | Ora | Prova |
|---|---|---|
| Riattaccata, passaggio basso o tocca-e-riparti sotto 30 m e 100 km/h = «ATTERRATO»: navigazione cancellata, riquadro ARRESTO in aria, TAWS zitto vicino al campo, nessun altro atterraggio visto fino al primo arresto | Sopra 45 m sul campo, o oltre 400 m dalla pista, torna in volo («RIATTACCATA»). La frenata si impara solo da una corsa vera dentro la pista | provato |
| «TERRENO! CABRA» coperto nello stesso secondo da un altro avviso (dentro una zona vietata, o «TRAMONTO TRA 10 MINUTI») | Il terreno urgente resta a schermo; la voce degli altri parla lo stesso | provato |
| La quota obiettivo alzata per il terreno non tornava più giù; dopo un cambio di obiettivo l'avviso diceva la quota di una cresta vecchia | Torna a quella di prima 20 s dopo il terreno; riparte dall'obiettivo nuovo | provato |
| GPS perso in accelerazione: l'ultima accelerazione restava nel calcolo, circa 11° di beccheggio falso | Non vale più dopo 3,5 s senza fix | provato (caso nuovo in `tools/test_assetto.js`, con controprova) |
| GPS perso: pericoli di traffico, «SALI A», manovre calcolati sulla posizione ferma | Sospesi finché il GPS non torna | letto |
| Prima del primo fix l'aereo «volava» da solo a 110 km/h dal Canavese (traccia finta, vento della simulazione preso per stimato) | Dal vivo sta fermo fino al primo fix | provato |
| Carburante impostato a terra più di un minuto prima del decollo: scartato al decollo (autonomia del piano, più alta); dopo l'atterraggio il valore risaliva | Vale se impostato dopo l'ultimo atterraggio; all'atterraggio resta il residuo | provato |
| Pista scelta a mano restava per la destinazione dopo | Torna automatica quando cambia il campo | letto |
| Traffico in volo senza dato di velocità disegnato «a terra», senza triangolo | Resta in volo | letto |
| Stesso aereo doppio al passaggio da internet a SafeSky; scie dei traffici usciti mai liberate; tocchi sulla mappa presi da traffici spariti | Corretti | letto |
| Un errore nel disegno spegneva anche TAWS, spazi aerei e tramonto | I controlli girano comunque | letto |
| Zoom largo: «campi vicini» fino a 1930, orizzonte a scatti (5–10 fotogrammi al secondo a 250 km) e terreno scaricato per ogni campo | Raggio al massimo 45 km | letto (misura del revisore: 99 ms → 9–17 ms a fotogramma) |
| «Tara qui» con il campo vuoto tarava a 0 m | Chiede la quota | letto |
| Voce: ogni apostrofo diventava «minuti» («L'AQUILA») | Solo dopo un numero | letto |
| Taratura automatica: 1950 campi scorsi a ogni fix lontano da un campo noto | Ogni 20 s | letto |
| Rateo di salita riletto da `localStorage` a ogni fotogramma con l'avviso di terreno; lo stesso avviso riscriveva la pagina 60–120 volte al secondo | Ogni 2 s; lo stesso testo rinnova solo il tempo | letto |
| Mappa di base lontano dal Nord: tessere mancanti su un lato | Corretto | letto |
| «NUOVA PISTA» accettata su un campo con piste nei dati: quelle sparivano | Restano | letto |
| Elenco dei velivoli salvato vuoto: strumento nero a ogni avvio | Si riparte dal profilo di serie | letto |
| Nomi di spazi aerei, traffici, velivoli e orologio scritti in pagina senza protezione (un file importato o un dato di rete poteva far girare codice) | Protetti (`PH.esc`) | letto |

### Moduli (`www/*.js`)

| Cosa succedeva | Ora | Prova |
|---|---|---|
| Emergenza e zona di planata: distanze est-ovest sbagliate lontano dal 45°N (Sicilia: campo a 10 km dato a 8,9 km, 620 ft di quota in meno del vero) | Distanze e prue vere | provato |
| Emergenza con GPS perso: «+450 ft» calcolato da posizione ferma | «GPS PERSO: distanze non calcolabili» | letto |
| Emergenza: lunghezza della pista sempre 0 (mai preferite le piste lunghe); pagina che tornava in cima ogni 4 s | Corretti | provato il primo |
| NOTAM spariti dalla mappa spegnendo gli spazi aerei | Restano | letto |
| Vento sulla pista: stimato vecchio di ore usato come buono in volo; previsto della destinazione usato per un altro campo | Stimato valido 20 minuti; il previsto vale per il suo campo | letto |
| STIMATI: riporto di posizione da leggere anche senza GPS (dal punto di partenza di serie); tasti morti su tablet con il pannello accanto | Corretti | letto |
| Carta VFR web: riscaricare lo stesso ciclo sopra se stesso poteva lasciare senza carta | Non si riscarica il ciclo già presente | letto |
| Tessere della mappa nella versione web: ognuna contava circa 7 MB nello spazio del browser | Chieste in modo che contino il loro peso vero | letto (non provato con il server vero: qui è bloccato) |
| Regole lette da `localStorage` per ogni spazio aereo, ogni secondo e a ogni fotogramma | Ogni 2 s | letto |

### Piano (`www/app.html`)

Tutte provate sulla pagina vera con terreno e meteo finti (41 casi).

| Cosa succedeva | Ora |
|---|---|
| Senza terreno in memoria «Calcola rotta» e il DIRECT TO dicevano «diritto libero» | «Terreno non disponibile: rotta NON verificata»; il DIRECT TO resta diretto, senza quota obiettivo |
| Briefing: il tetto «AGL» di una zona era riferito alla quota dei campi, non al terreno sotto la zona (zona su un rilievo data per «passi sopra») | Base e tetto dal terreno sotto la zona; giallo se il terreno manca |
| NOTAM con la riga Q a larghezza fissa (spazi tra le barre) non letto e dato per «OK» | Letto; un NOTAM valido senza posizione è «LEGGI», mai OK |
| NOTAM confrontato con la crociera scritta, non con le quote vere delle tratte | Quota più alta del profilo nella zona |
| Quote OpenAir «ASFC» lette come MSL; tetto non leggibile letto come 0 | ASFC = AGL; tetto non leggibile = illimitato |
| Scrivendo la quota, una pausa faceva partire la «rotta migliore» con il numero a metà (punti R1–R3 a 4 ft) | Parte a fine scrittura; valori fuori dai limiti rifiutati; niente «Infinity» a schermo |
| Due tocchi su «Calcola rotta» durante lo scarico del terreno: due calcoli sovrapposti (15 punti invece di 5) | Un calcolo alla volta |
| TAF: un BECMG di miglioramento valeva dall'inizio della transizione; dopo FM restavano i fenomeni vecchi | Vale dalla fine; nel mezzo il tempo di prima |
| Vento del modello vecchio di giorni mostrato come «aggiornato adesso» | Età per campo: 20 minuti per «coperto», oltre 3 ore non si usa |
| Meteo alle quote: partenza oltre i 3 giorni di previsione calcolata sull'ultima ora disponibile; rapporto vecchio mostrato dopo il cambio di rotta | Errore chiaro; il rapporto si mostra solo per la sua rotta |
| Limite VDS basico nel Briefing con il giorno di oggi, nel calcolo con il giorno della partenza | Giorno della partenza in tutti e due |
| METAR senza vento: «NaN° da undefined» | «Vento n.d.» |

### Workflow, Java, strumenti

- `build-apk.yml`: il controllo «niente REQUEST_INSTALL_PACKAGES nel pacchetto Play» non poteva mai fallire; ora fallisce davvero (provato). Aggiunti gruppo di concorrenza, cache di Gradle, e i 1,5 MB di SQLite del web tolti dall'APK.
- `posta_licenze.py`: una risposta con l'intestazione `References` su più righe (rinnovi) finiva in «Da vedere» senza codice (provato); due etichette M/A/P sulla stessa mail ora vanno in «Da vedere» invece di emettere il tipo sbagliato (provato).
- Segnalazioni delle piste: dalla mail si tengono solo i campi attesi, con tipo e limiti; al massimo 20 righe per mail; una riga guasta non ferma più il lavoro (provato).
- `pubblica-web.yml`: niente file degli spazi aerei a metà sul sito; `prestazioni.js` nell'impronta. `ofm_openair.py` si ferma se manca l'Italia (provato).
- `GarminPlugin.java`: dopo un errore di Garmin Connect «Ricollega» funziona senza riavviare. Barometro e bussola: frequenza chiesta vicina a quella usata, filtro che non si ferma se cambia l'ora.
- **Da fare a mano:** `tools/gmail-licenze/HORIZON-Licenze.gs` è cambiato e va reincollato in script.google.com.

### Orologio (HORIZON 2)

Tre pagine (VOLO, ARRIVO, PILOTA), avvisi su più righe, dati in più dallo strumento. Anteprima disegnata: `docs/garmin/pagine-orologio.png`. Dettagli nella guida dell'app, sezione «Orologio Garmin».

## 2. Da decidere (sicurezza: non ho toccato soglie né scelte tue)

1. **TAWS e spazi aerei tacciono finché il diario non vede il decollo.** Il volo parte sopra 55 km/h al suolo: un velivolo lento in salita controvento (85 km/h con 35 di vento) resta «a terra» e non ha avvisi. Lo stesso se in volo la velocità al suolo scende sotto 20 km/h per 30 s. Proposta: per gli avvisi vale «in volo» anche con più di 25 km/h e più di 60 m sul terreno.
2. **Origine fissa del piano E/N (Carolina).** Lontano dal 45°N assi pista e circuiti sono storti: a Comiso, sull'asse vero a 1500 m, lo strumento calcola 88 m di scarto. Mediana sulle piste: Sicilia 64 m, Sud e Sardegna 44 m, Nord Italia 3 m. Proposta: portare l'origine sulla posizione al primo fix e quando ci si sposta di oltre 100 km. È un lavoro a parte, da provare bene.
3. **TAWS senza rilievo davanti:** tace e l'etichetta TERRENO resta verde. Proposta: bandierina «TERRENO NON DISPONIBILE» ed etichetta gialla.
4. **Tocco sull'avviso rosso:** toglie anche voce e vibrazione per 60 s, anche per «TERRENO! CABRA».
5. **«TRAMONTO TRA 10 MINUTI»** è rosso al centro e torna ogni secondo per 5 minuti. Proposta: bandierina gialla.
6. **Vento per la scelta della pista:** lo stimato vecchio di ore e il previsto senza data valgono come «verificato»; il previsto resta quello della destinazione di prima. Proposta: stimato valido 20 minuti, previsto qualche ora, altrimenti «PISTA NON VERIFICATA».
7. **Fix imprecisi presi come GPS buono** (posizione di rete, ±500–2000 m): serve una soglia di precisione scelta da te.
8. **Carburante:** all'atterraggio ora resta il residuo solo per chi lo imposta a mano. Chi usa il piano, alla seconda tratta senza rifornire, riparte dal pieno del piano. Vuoi il residuo per tutti?
9. **«Prima del volo»** può comparire sopra lo strumento se l'app si apre già in volo e il fix non è ancora arrivato.
10. **Chiamata radio «base»:** sparisce quando inizia la virata base (compare già «finale»). Proposta: 12 s di coda come per il finale.
11. **Manovra guidata (spirale, inversione):** non ha tempo massimo e non si annulla con un DIRECT TO; finché dura i messaggi sono muti.
12. **Cambio pista senza isteresi** con vento attorno alle soglie: da verificare in volo.
13. **Caselle sotto lo strumento e pagina mappa:** a GPS perso restano scritti gli ultimi valori (sull'orizzonte ci sono le croci rosse). Proposta: «---».
14. **Sigle doppie dei campi** (13 sigle, 29 campi: Molinella, Albatros…): correzione del carburante e «proveniente da» possono prendere l'omonimo.
15. **Licenze, prima di accendere il blocco:** un avvio con la data avanti lascia le licenze a tempo «scadute» per sempre; da verificare se il codice del telefono è lo stesso tra APK e Play.
16. **Piste dei piloti:** i «3 telefoni» sono dichiarati da chi scrive la mail. Proposta: nelle mappe solo dopo `--approva`.
17. **Workflow:** azioni di terzi e immagine Connect IQ non fissate a una versione esatta (girano con le chiavi); il collaudo su emulatore è sempre verde; l'APK di collaudo con il debug è scaricabile da chiunque; la password del keystore protegge anche chiave e registro delle licenze finché non lanci «cambia-password».

## 3. Tasti dell'orologio: proposta da decidere insieme

Oggi: START = OK, SU / GIÙ = manopola, SU tenuto = pagina dello strumento, GIÙ + BACK = pagina dello strumento, BACK = esci. In questo giro lo schermo (tocco, scorrimento) cambia la pagina dell'orologio; i tasti non sono cambiati.

- **A · Tasti allo strumento, schermo all'orologio** (quello fatto ora). Niente da reimparare. Con i guanti o con il tocco spento resta la pagina VOLO.
- **B · Tutto sui tasti.** GIÙ + BACK passa alle pagine dell'orologio; SU tenuto resta la pagina dello strumento. Si usa sempre, anche con i guanti; una combinazione in meno per lo strumento.
- **C · L'orologio segue lo strumento.** La pagina dell'orologio cambia da sola: in rotta VOLO, in circuito ARRIVO, a terra PILOTA; gli avvisi sopra a tutto. Nessun tasto da premere, ma meno scelta.

## 4. Ottimizzazioni rimaste

- **Orizzonte con il terreno:** `drawTerrain` è la spesa più grande (nel profilo circa il 30% del tempo di calcolo in simulazione); crea array e centinaia di percorsi a ogni fotogramma.
- **Spazi aerei sulla mappa:** ridisegnati punto per punto a ogni fotogramma.
- **Piano:** ogni tasto in un campo rifà tutto il controllo (630–860 ms in VDS basico su un telefono medio); ogni apertura della scheda PIANO ricostruisce le liste (13.000 voci con 4 tappe) e cancella il testo non salvato; all'avvio il file degli spazi aerei è letto 9 volte e analizzato 3.
- **Vista 3D:** geometrie non liberate a ogni ricostruzione, disegno continuo anche a vista ferma.
- **Zona di planata:** scatto ogni 1,5 s (8–36 ms su PC).
- **Service worker:** il nome della cache non cambia mai, quindi con rete debole può restare una versione mista di file vecchi e nuovi.
- **Codice morto:** una decina di funzioni definite due volte (vale la seconda): chi corregge la prima non cambia niente.
- **Compilazione:** manca la cache dell'emulatore.
