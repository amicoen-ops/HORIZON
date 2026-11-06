// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// Guida in linea, tour guidato e catalogo dei velivoli.
// Si apre da ALTRO › INFO › «Guida e tour»; il catalogo anche da Impostazioni › Velivoli › «Dal catalogo».
(function(){
'use strict';
const esc=x=>String(x??'').replace(/[<&>"]/g,c=>({'<':'&lt;','&':'&amp;','>':'&gt;','"':'&quot;'}[c]));

// ---------------- catalogo dei velivoli ----------------
// Dati INDICATIVI raccolti da schede pubbliche (costruttori, Wikipedia/Jane's, riviste, annunci): cambiano con la versione,
// il motore e il peso massimo. Toccando un modello si apre la scheda già compilata: va controllata col manuale di volo (POH)
// del proprio velivolo, poi si scrivono le marche e si salva. Velocità in km/h, pesi in kg, carburante in litri.
// Campi: m modello, mot motore, cat tipo di volo, vs0 vs1 vfe vno vne vc (crociera), roc (ft/min), gl (efficienza),
// fuel (L), burn (L/h), empty, mtow, seats, fonte.
const C=[
  {m:'Avid Flyer Mk IV',mot:'Rotax 582',cat:'vds_basico',vs0:55,vs1:63,vfe:105,vno:160,vne:193,vc:145,roc:800,gl:8,fuel:68,burn:16,empty:232,mtow:450,
    fonte:'Wikipedia (Simpson 2001), Aeropedia Mk IV, scheda SE-YVG: stallo pulito 39 mph, VNE 120 mph, crociera 90-95 mph, 68 L. MTOW di progetto 522 kg: in Italia 450 kg VDS.'},
  {m:'BRM Land Africa',mot:'Rotax 912 UL',cat:'vds_basico',vs0:50,vs1:58,vfe:100,vno:140,vne:170,vc:140,roc:900,gl:7,fuel:80,burn:15,empty:290,mtow:450,
    fonte:'Derivato STOL dello Zenith CH 701 (BRM, Portogallo). Crociera circa 80 kt (annunci); stallo e VNE stimati dalla famiglia CH 701: controllare il manuale BRM.'},
  {m:'Fly Synthesis Storch CL',mot:'Rotax 582',cat:'vds_basico',vs0:64,vs1:70,vfe:110,vno:180,vne:215,vc:145,roc:800,gl:9,fuel:60,burn:16,empty:250,mtow:450,
    fonte:'Wikipedia (Bayerl, Fly Synthesis): Storch CL 450 kg, HS 472,5 kg, S 500 kg. Aeropedia (Storch 80 CV): vuoto 248 kg, 60 L, crociera 159 km/h al 75%, stallo 65 km/h. Manuale HS J: VNE 215, VS 70, VS0 64. Col 582 (64 CV) crociera stimata 145 km/h.'},
  {m:'Rans S-12 Airaile',mot:'Rotax 582',cat:'vds_basico',vs0:55,vs1:63,vfe:100,vno:130,vne:160,vc:115,roc:900,gl:7,fuel:68,burn:18,empty:230,mtow:450,
    fonte:'Wikipedia, lightsportaircraft.ca, Dan Johnson: salita 900 ft/min col 582, 5,75 gal/h all\'85%, 9-18 gal secondo la versione, vuoto 215-295 kg, lordo di progetto 522 kg. Stallo e VNE stimati: controllare il manuale Rans.'},
  {m:'Pipistrel Virus 912',mot:'Rotax 912 UL',cat:'vds_basico',vs0:65,vs1:75,vfe:130,vno:200,vne:250,vc:200,roc:1000,gl:17,fuel:100,burn:14,empty:284,mtow:472,
    fonte:'pilotmix Virus 912 (stallo 35 kt, VNE 135 kt, efficienza fino a 24, vuoto 284 kg, MTOW 472,5 kg), Pipistrel: 2 × 50 L, efficienza 1:17 per le versioni da 472,5 kg. Il Virus non monta il 582.'},
  {m:'Jodel D18',mot:'Jabiru 2200',cat:'vds_basico',vs0:60,vs1:68,vfe:200,vno:200,vne:248,vc:175,roc:700,gl:12,fuel:65,burn:14,empty:230,mtow:450,
    fonte:'Wikipedia (versione Jabiru 2200 da 85 CV): vuoto 230 kg, 450 kg, 65 L, stallo 60 km/h. pilotmix D18 UL: VNE 134 kt, crociera 94 kt, salita 3,5 m/s. Senza flap: VFE uguale a VNO.'},
  {m:'Fisher Super Koala',mot:'Rotax 582',cat:'vds_basico',vs0:45,vs1:52,vfe:90,vno:130,vne:153,vc:120,roc:1000,gl:6,fuel:30,burn:15,empty:180,mtow:376,
    fonte:'pilotfriend, Wikipedia, lightsportaircraft.ca: col 582 lordo 376 kg, vuoto 170-180 kg, 8 gal (30 L), VNE 95 mph, crociera 70-80 mph, stallo con flap 28 mph, salita circa 1000 ft/min.'},
  {m:'Tecnam P92 Echo MkII',mot:'Rotax 912 ULS',cat:'vds_basico',vs0:65,vs1:75,vfe:130,vno:220,vne:250,vc:195,roc:950,gl:9,fuel:90,burn:17,empty:330,mtow:600,
    fonte:'Wikipedia e schede rivenditori: VS0 35 kt, VNE 135 kt, salita 4,9 m/s, 2 × 45 L, 17 L/h, MTOW 600 kg.'},
  {m:'Kitfox Series 7 Super Sport',mot:'Rotax 912 ULS',cat:'vds_basico',vs0:68,vs1:78,vfe:130,vno:180,vne:207,vc:180,roc:1000,gl:8,fuel:100,burn:18,empty:340,mtow:600,
    fonte:'kitfoxaircraft.com e Plane & Pilot: stallo 37-42 kt, VNE 112 kt, salita 1000-1150 ft/min, 100-105 L, vuoto 340-350 kg.'},
  {m:'Groppo Trail',mot:'Rotax 912 ULS',cat:'vds_basico',vs0:55,vs1:63,vfe:110,vno:180,vne:210,vc:170,roc:1000,gl:9,fuel:100,burn:16,empty:310,mtow:600,
    fonte:'Wikipedia (Jane\'s 2011/12): stallo 55 km/h, crociera 170 km/h, VNE 210 km/h, salita fino a 6 m/s. Trail MK1/MK2: 100 L, MTOW fino a 600 kg.'},
  {m:'Ikarus C42',mot:'Rotax 912 UL',cat:'vds_basico',vs0:63,vs1:72,vfe:110,vno:160,vne:185,vc:160,roc:900,gl:10,fuel:65,burn:14,empty:285,mtow:472,
    fonte:'Schede Comco Ikarus (C42 B): valori tipici, MTOW 472,5 kg con paracadute.'},
  {m:'ICP Savannah S',mot:'Rotax 912 UL',cat:'vds_basico',vs0:45,vs1:55,vfe:100,vno:150,vne:175,vc:145,roc:1000,gl:7,fuel:78,burn:15,empty:300,mtow:600,
    fonte:'Schede ICP (Savannah S): STOL, valori tipici. Il peso massimo dipende dall\'omologazione (450-600 kg).'},
  {m:'Zenith CH 701',mot:'Rotax 912 UL',cat:'vds_basico',vs0:45,vs1:52,vfe:100,vno:130,vne:160,vc:135,roc:1000,gl:6,fuel:72,burn:14,empty:265,mtow:450,
    fonte:'Schede Zenith Aircraft (STOL CH 701): valori tipici.'},
  {m:'Aeroprakt A22 Foxbat',mot:'Rotax 912 UL',cat:'vds_basico',vs0:56,vs1:64,vfe:110,vno:150,vne:175,vc:150,roc:1000,gl:10,fuel:90,burn:15,empty:285,mtow:472,
    fonte:'Schede Aeroprakt (A22L): valori tipici.'},
  {m:'Evektor EV-97 Eurostar',mot:'Rotax 912 UL',cat:'vds_basico',vs0:63,vs1:73,vfe:120,vno:200,vne:250,vc:180,roc:900,gl:10,fuel:65,burn:15,empty:290,mtow:600,
    fonte:'Schede Evektor (Eurostar SL): valori tipici.'},
  {m:'Tecnam P2002 Sierra',mot:'Rotax 912 ULS',cat:'vds_basico',vs0:70,vs1:80,vfe:120,vno:220,vne:250,vc:210,roc:1100,gl:10,fuel:100,burn:18,empty:330,mtow:600,
    fonte:'Schede Tecnam: valori tipici della versione ULM.'},
  {m:'Alpi Pioneer 300',mot:'Rotax 912 ULS',cat:'vds_basico',vs0:65,vs1:75,vfe:130,vno:250,vne:300,vc:250,roc:1300,gl:14,fuel:80,burn:18,empty:290,mtow:600,
    fonte:'Schede Alpi Aviation: valori tipici, carrello retrattile.'},
  {m:'Flight Design CT',mot:'Rotax 912 ULS',cat:'vds_basico',vs0:63,vs1:75,vfe:150,vno:220,vne:300,vc:220,roc:1100,gl:12,fuel:130,burn:17,empty:300,mtow:600,
    fonte:'Schede Flight Design (CTSW/CTLS): valori tipici.'},
];
// dal formato compatto al profilo completo dell'app (stessi campi di Impostazioni › Velivoli)
function profilo(c){ const r5=x=>Math.round(x/5)*5;
  return {model:c.m+' · '+c.mot,cat:c.cat,notes:'Dal catalogo HORIZON (dati indicativi, controlla il manuale di volo). Fonte: '+c.fonte,
    vs0:c.vs0,vs1:c.vs1,vfe:c.vfe,va:r5(Math.min(c.vno,c.vs1*2)),vno:c.vno,vne:c.vne,vx:r5(c.vs1*1.25),vy:r5(c.vs1*1.4),vglide:r5(c.vs1*1.35),
    vapp:r5(Math.max(c.vs0*1.3,c.vs1*1.2)),vcirc:r5(Math.max(c.vs0*1.3,c.vs1*1.2)+15),vcruise:c.vc,
    roc:c.roc,rod:700,glide:c.gl,todist:c.vs1<60?150:250,ldist:c.vs1<60?150:250,xwind:c.vs1<60?15:20,hcFt:c.vs1<60?700:1000,ceil:c.mtow>500?12000:10000,
    fuelType:'mogas',fuelCap:c.fuel,fuelUnus:2,burn:c.burn,res:30,taxi:1.5,
    empty:c.empty,emptyArm:'',mtow:c.mtow,seats:'2',pilotArm:'',paxArm:'',fuelArm:'',bagMax:15,bagArm:'',cgFwd:'',cgAft:'',
    xpdr:'no',radio:'1',elt:'0',chute:'0'}; }
PH.AC_CATALOGO=C;
PH.acDaCatalogo=function(i){ const c=C[i]; if(!c) return;
  const a=Object.assign({},PH.AC_NEW,profilo(c),{id:'ac-'+Date.now().toString(36),reg:''});
  PH.acEdit(a,true);
  setTimeout(()=>{ const w=document.getElementById('phAcWarn'); if(w) w.innerHTML='<b>Dati indicativi: '+esc(c.m)+'.</b> Controllali col manuale del tuo velivolo, scrivi le marche e salva.<br>'+w.innerHTML; },50); };
function catalogoHtml(){
  return `<p class="ph-sub">Tocca un modello: si apre la scheda già compilata con velocità, salita, planata, carburante e pesi. Sono <b>dati indicativi</b> presi da schede pubbliche e cambiano con versione, motore e peso massimo: controllali con il manuale di volo del tuo velivolo, scrivi le marche e salva. Il velivolo entra nella lista e diventa quello attivo.</p>
  <div class="hz-cat">${C.map((c,i)=>`<button type="button" class="hz-catb" data-cat="${i}"><b>${esc(c.m)}</b><small>${esc(c.mot)} · ${({vds_basico:'VDS basico',vds_avanzato:'VDS avanzato',vfr:'VFR'})[c.cat]} · VNE ${c.vne} · crociera ${c.vc} km/h · ${c.burn} L/h · MTOW ${c.mtow} kg</small></button>`).join('')}</div>
  <p class="ph-sub">Il tuo velivolo non c'è? Impostazioni › Velivoli › «Nuovo velivolo», oppure scegli il più simile e correggi i valori. Segnalacelo da Info: lo aggiungiamo.</p>`; }
function catalogoWire(box){ box.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>PH.acDaCatalogo(+b.dataset.cat)); }
PH.catalogoHtml=catalogoHtml; PH.catalogoWire=catalogoWire;

// ---------------- guida: una sezione per funzione ----------------
const G=[
  {id:'inizio',t:'Primi passi',h:`
    <ol><li>Accetta le avvertenze e concedi la <b>posizione</b> (e il Bluetooth se usi un GPS esterno).</li>
    <li>Scegli o crea il <b>velivolo</b>: Impostazioni › Velivoli, oppure dal <a href="#" data-g="catalogo">catalogo</a>. Da lui dipendono scala di velocità, circuito, simulazione, piano di volo, carburante e tipo di volo.</li>
    <li>Monta il telefono e, ad aereo fermo, premi <b>LIVELLA</b> (bordo giallo e nero, accanto a GPS · ASSETTO · TERRENO · NET).</li>
    <li>Prima di partire apri <b>PIANO</b>: rotta, meteo, NOTAM e spazi aerei; con internet scarica anche terreno e mappe della zona.</li>
    <li>Prova tutto a terra con ALTRO › <b>SIMULA</b>.</li></ol>
    <p>HORIZON è un aiuto alla consapevolezza: non sostituisce gli strumenti di bordo, le carte ufficiali e il giudizio del pilota.</p>`},
  {id:'barra',t:'Barra in basso e menu ALTRO',h:`
    <p><b>VOLO</b>: lo strumento. <b>PIANO</b>: rotte, campi, meteo, NOTAM, spazi aerei. <b>✈ TRAFFICO</b>: aerei intorno. <b>☰ ALTRO</b>: Impostazioni, Simula, Profilo (verticale: terreno e quota lungo la rotta), Carburante, Info.</p>
    <p>I tasti ◀ OK ▶ fanno da <b>manopola</b>: OK apre il menu (DIRECT TO, rotte salvate, QNH…), ◀ ▶ scorrono, OK tenuto premuto o PAGINA cambia pagina (orizzonte, mappa).</p>`},
  {id:'strumento',t:'Lo strumento: orizzonte e dati',h:`
    <p>Orizzonte artificiale dai sensori del telefono (giroscopio e accelerometro, con la velocità del GPS in virata). Ai lati velocità e quota, sotto prua e traccia; nelle schede GS, quota, vario, traccia, vento, destinazione, tempo di volo e tramonto.</p>
    <p><b>Bandierine rosse</b>: un dato vecchio non resta mai congelato. Assetto oltre 0,7 s, velocità e quota oltre 2,5 s, GPS oltre 3,5 s → bandierina rossa al posto del valore.</p>
    <p>La riga <b>GPS · ASSETTO · TERRENO · NET</b> dice cosa funziona: verde bene, giallo parziale, rosso assente.</p>`},
  {id:'montaggio',t:'Montaggio e LIVELLA',h:`
    <p>Il telefono può stare in verticale o in orizzontale, schermo verso il pilota. LIVELLA misura come è montato:</p>
    <ul><li><b>a terra</b>: aereo fermo, con l'assetto a terra del tuo velivolo (Impostazioni › Montaggio del telefono, di solito 10-12° per un biciclo);</li>
    <li><b>in volo</b>: ali livellate, volo rettilineo e costante.</li></ul>
    <p>Gli assi del giroscopio si riconoscono da soli (alcuni Android li danno in un altro ordine): girando il telefono nei primi secondi lo Stato passa da «in verifica» a «riconosciuti». Se l'orizzonte fa cose strane: Impostazioni › Registrazione dei sensori › «Registra 20 s e invia».</p>`},
  {id:'mappa',t:'Mappa, terreno e planata',h:`
    <p>PAGINA passa alla mappa. Zoom con due dita o con + e −; trascinando la mappa smette di seguire l'aereo, il tasto ⌖ la riporta sull'aereo.</p>
    <p>Terreno in <b>rosso</b> se è a meno di 60 m sotto di te (o sopra), <b>giallo</b> sotto 180 m. Il cerchio verde tratteggiato è la <b>planata</b>: altezza sul terreno × efficienza del velivolo × 0,75.</p>
    <p>Mappe di base: OpenStreetMap, OpenTopoMap, satellite, IGM e ortofoto (Impostazioni › Mappa di base).</p>`},
  {id:'dct',t:'DIRECT TO',h:`
    <p>OK › DIRECT TO: i 250 campi più vicini; scrivendo si cerca per nome o sigla in tutti i 1950 campi (Italia, Francia, Alpi).</p>
    <p>La guida parte subito sulla diritta; intanto il Piano calcola la rotta migliore come «Calcola rotta»: intorno a CTR e zone vietate per il tuo tipo di volo, dalle valli, evitando il mare, con la quota di ogni tratta. Se serve una deviazione diventa una rotta (→ CAMPO) e te lo dice a voce.</p>`},
  {id:'piano',t:'Piano di volo e Calcola rotta',h:`
    <p>In PIANO scegli partenza, arrivo e punti intermedi, oppure disegna la rotta sulla mappa. <b>Calcola rotta</b> cerca la più breve in tempo con il vento previsto:</p>
    <ul><li>gira intorno alle zone vietate per il tuo tipo di volo (VDS basico, avanzato, VFR) e ai punti «da non sorvolare» (tieni premuto sulla mappa);</li>
    <li>passa dalle valli dove il terreno lo chiede, sale gradualmente, non supera la tangenza;</li>
    <li>evita il mare: lo attraversa solo se non c'è altra strada (isole), nel punto più corto, e te lo dice;</li>
    <li>preferisce pianure e fondovalle larghi e porta i punti sopra i campi vicini, per avere sempre dove atterrare;</li>
    <li>in VDS basico resta a 5 km dagli aeroporti e sotto il limite di quota (si spezza la tratta solo se lo supereresti di oltre 500 ft).</li></ul>
    <p>Sotto la mappa: distanza, tempo, carburante, quota di ogni tratta e gli avvisi (rosso da cambiare, arancione da sapere).</p>`},
  {id:'rotte',t:'Rotte salvate e invio allo strumento',h:`
    <p>In PIANO › Rotte salvate: <b>Apri</b> per modificarla, <b>Vola</b> per mandarla allo strumento (a terra parte subito, in volo chiede conferma). Sullo strumento: OK › ROTTE SALVATE. Fino a 100 punti per rotta.</p>`},
  {id:'meteo',t:'Meteo, NOTAM e spazi aerei',h:`
    <p>Meteo della rotta alle quote (vento e temperatura da 1000 a 700 hPa all'ora in cui passi), METAR e TAF, avvisi per nubi basse, visibilità, pioggia, temporali, ghiaccio, raffiche e vento al traverso all'arrivo.</p>
    <p>Spazi aerei da openAIP (Briefing › Scarica gli spazi aerei) o da un file OpenAir tuo. In volo l'app avvisa se sei dentro una zona adesso, tra 30 secondi o tra un minuto, giudicandola secondo il tuo tipo di volo.</p>`},
  {id:'taws',t:'Avvisi di terreno (TAWS)',h:`
    <p>Ogni secondo l'app prevede dove sarai nei prossimi 60 s con il vario attuale. <b>«TERRENO! CABRA»</b> se entro 30 s saresti a meno di 100 ft dal terreno; <b>«ATTENZIONE TERRENO»</b> sotto 300 ft. Tace vicino alla destinazione in circuito e senza GPS. Serve il terreno scaricato (si scarica da solo con internet).</p>`},
  {id:'traffico',t:'Traffico',h:`
    <p><b>Senza internet</b>: ricevitori GDL90 sulla stessa rete Wi-Fi o sullo stesso telefono (SafeSky, SkyEcho, PilotAware; porta UDP 4000).</p>
    <p><b>Con internet</b>: OGN (FLARM e tracker) e adsb.lol ogni 6 s; all'esterno va solo la zona arrotondata a 0,1° (circa 10 km), mai la posizione esatta.</p>
    <p>Sullo strumento compare un triangolo di pericolo per un aereo entro 1000 ft di lato e di quota, adesso o entro 60 s. La pagina TRAFFICO mostra radar ed elenco; toccando un aereo se ne vede la scheda.</p>`},
  {id:'squadriglia',t:'Squadriglia',h:`
    <p>ALTRO › <b>SQUADRIGLIA</b>: gli aerei che volano con te. Per ognuno marche, nome del pilota, nominativo radio (se lo lasci vuoto lo scrive l'app dalle marche, con l'alfabeto ICAO: I-A517 → «India Alfa Cinque Uno Sette», abbreviato «India Uno Sette»), velivolo e, se lo conosci, il codice FLARM/OGN o ICAO.</p>
    <p>In volo, se l'aereo trasmette (SafeSky, FLARM/OGN, ADS-B), sulla mappa e nel radar compare col <b>nome del pilota in verde</b>; toccandolo vedi marche e nominativo radio. Il pericolo di collisione resta giallo e rosso come per tutti. Quando uno della squadriglia compare la prima volta, un avviso a schermo dice chi è e dove.</p>
    <p>Esporta la lista e mandala agli altri: la importano e vedete tutti gli stessi nomi.</p>`},
  {id:'circuito',t:'Circuito, atterraggio e piste rilevate',h:`
    <p>A 7 km dal campo lo strumento sceglie la pista con il vento più contrario e disegna il circuito alla quota del velivolo (Impostazioni › Velivoli). Controlla sempre manica a vento e radio.</p>
    <p>Se decolli o atterri su una pista che non conosce, l'app la propone: dopo averla salvata, a terra, chiede se <b>condividerla</b> in forma anonima con gli altri piloti. Una pista vista uguale da 3 telefoni entra nelle mappe di tutti; la riga «Campi volo» nello Stato dice quante e quando.</p>`},
  {id:'carburante',t:'Carburante e alternati',h:`
    <p>ALTRO › CARBURANTE: carburante a bordo, consumo, riserva e autonomia; gli alternati raggiungibili lungo la rotta in tre fasce (verde, giallo, rosso). Il consumo e la capacità vengono dal velivolo attivo.</p>`},
  {id:'velivoli',t:'Velivoli, carico e centraggio',h:`
    <p>Impostazioni › Velivoli: più velivoli, uno attivo. Ogni scheda ha velocità (VS0, VS1, VFE, VA, VNO, VNE, Vx, Vy, planata, avvicinamento, circuito, crociera), salita, efficienza, distanze, vento al traverso massimo, carburante, pesi e bracci per il centraggio, equipaggiamento (transponder, radio, ELT, paracadute).</p>
    <p>Puoi esportare e importare i velivoli in un file, oppure partire dal <a href="#" data-g="catalogo">catalogo</a>.</p>`},
  {id:'simula',t:'Simulazione e volo dimostrativo',h:`
    <p>ALTRO › SIMULA: un volo finto con avvisi veri, utile per provare rotte, circuito, TAWS e spazi aerei a terra. «Direct to un campo» › «Avvia la simulazione». Durante la simulazione LIVELLA è disattivato.</p>`},
  {id:'gps',t:'GPS esterno, quota e senza internet',h:`
    <p><b>Garmin GLO 2</b> via Bluetooth: Impostazioni › Posizione. Più preciso e più veloce del GPS del telefono.</p>
    <p><b>Quota GPS</b>: si può tarare su un campo noto (Impostazioni › Quota GPS). QNH dal METAR o dal menu.</p>
    <p><b>Senza internet</b>: campi, rotte, velivoli e diario sono sul telefono; terreno, mappe e spazi aerei funzionano se li hai scaricati prima (Impostazioni › Volare senza internet).</p>`},
  {id:'impostazioni',t:'Impostazioni utili',h:`
    <ul><li><b>Interfaccia</b>: Completa o Semplice (solo orizzonte, avvisi sempre attivi).</li>
    <li><b>Tipo di volo</b>: VDS basico, VDS avanzato o VFR: decide zone vietate, limiti di quota e avvisi.</li>
    <li><b>Avvisi</b>: voce (pista, circuito, terreno, spazi aerei, tramonto), vibrazione, schermo sempre acceso.</li>
    <li><b>Diario di volo</b>: i voli si registrano da soli dal decollo all'atterraggio; esporti in KML.</li>
    <li><b>Condivisione anonima</b>: piste rilevate e conteggio dei campi usati, sempre col tuo consenso.</li>
    <li><b>Stato</b>: cosa funziona e cosa no, con i numeri (frequenza dei sensori, assi del giroscopio, campi e piste).</li></ul>`},
  {id:'aiuto',t:'Segnalazioni, aggiornamenti e licenza',h:`
    <p>Info › Segnala un problema: arriva per posta all'autore, con i dati tecnici se lasci la spunta (mai la posizione); senza rete resta in coda.</p>
    <p>Aggiornamenti: dal Play Store, oppure da Info nella versione scaricata da GitHub. Su iPhone e iPad: Safari › Condividi › Aggiungi alla schermata Home.</p>
    <p>HORIZON è gratuita e senza pubblicità. Se ti è utile puoi offrire un caffè dalla pagina Info: è solo un grazie e non cambia niente nell'app.</p>`},
];

// ---------------- tour guidato ----------------
// ogni passo: elemento da evidenziare (il primo visibile tra i selettori), titolo e testo
const T=[
  {s:['#pfd'],t:'Lo strumento',x:'Orizzonte, velocità, quota e prua. Un dato vecchio diventa una bandierina rossa, mai un valore congelato.'},
  {s:['#phStat'],t:'Cosa funziona',x:'GPS · ASSETTO · TERRENO · NET: verde bene, giallo parziale, rosso assente.'},
  {s:['#phLvl'],t:'LIVELLA',x:'Dopo aver montato il telefono, ad aereo fermo o in volo livellato. Chiede conferma.'},
  {s:['.ph-ctl'],t:'La manopola',x:'OK apre il menu: DIRECT TO, rotte salvate, QNH. ◀ ▶ scorrono. PAGINA passa dall\'orizzonte alla mappa.'},
  {s:['.ph-cards'],t:'I dati di volo',x:'Velocità al suolo, quota, vario, traccia, vento, destinazione, tempo di volo e tramonto.'},
  {s:['.ph-nav [data-v="piano"]'],t:'PIANO',x:'Rotte, campi, meteo, NOTAM e spazi aerei. «Calcola rotta» gira intorno alle zone, passa dalle valli, evita il mare e sorvola i campi.'},
  {s:['.ph-nav [data-v="trf"]'],t:'TRAFFICO',x:'Aerei intorno da SafeSky/SkyEcho o da internet (OGN, ADS-B). Sullo strumento un triangolo avvisa del pericolo.'},
  {s:['#phNavMore'],t:'ALTRO',x:'Impostazioni (velivoli, montaggio, interfaccia), Simula, Profilo verticale, Carburante, Squadriglia (i nomi e i nominativi radio degli aerei che volano con te) e Info, dove trovi questa guida.'},
];
let tour=null;
function tourEl(st){ for(const q of st.s){ const e=document.querySelector(q); if(e){ const r=e.getBoundingClientRect(); if(r.width>4&&r.height>4&&!e.closest('[hidden]')) return e; } } return null; }
PH.tourStart=function(){
  try{ PH.show('volo'); }catch(e){}
  if(PH.moreOpen) PH.moreOpen(false);
  tour={i:0}; const o=document.createElement('div'); o.id='hzTour'; o.innerHTML='<div class="hz-spot"></div><div class="hz-bub" role="dialog" aria-live="polite"><b></b><p></p><div class="hz-tb"><button type="button" data-t="x">Esci</button><span></span><button type="button" data-t="p">◀</button><button type="button" data-t="n" class="pri">Avanti ▶</button></div></div>';
  document.body.appendChild(o); tour.o=o;
  o.querySelector('[data-t=x]').onclick=PH.tourEnd; o.querySelector('[data-t=p]').onclick=()=>tourGo(tour.i-1,-1); o.querySelector('[data-t=n]').onclick=()=>tourGo(tour.i+1,1);
  addEventListener('resize',tourPlace); tourGo(0,1); };
PH.tourEnd=function(){ if(!tour) return; tour.o.remove(); removeEventListener('resize',tourPlace); tour=null; try{ localStorage.setItem('ia517p_tour','1'); }catch(e){} };
function tourGo(i,dir){ while(i>=0&&i<T.length&&!tourEl(T[i])) i+=dir||1;            // salta gli elementi nascosti (es. interfaccia semplice)
  if(i<0) i=0; if(i>=T.length){ PH.tourEnd(); toast&&toast('TOUR FINITO · LA GUIDA È IN ALTRO › INFO'); return; }
  tour.i=i; const st=T[i], o=tour.o; o.querySelector('b').textContent=st.t; o.querySelector('p').textContent=st.x;
  o.querySelector('.hz-tb span').textContent=(i+1)+' / '+T.length; o.querySelector('[data-t=n]').textContent=i===T.length-1?'Fine ✓':'Avanti ▶'; tourPlace(); }
function tourPlace(){ if(!tour) return; const e=tourEl(T[tour.i]), sp=tour.o.querySelector('.hz-spot'), bb=tour.o.querySelector('.hz-bub');
  if(!e){ sp.style.display='none'; return; } const r=e.getBoundingClientRect(), pad=6; sp.style.display='block';
  Object.assign(sp.style,{left:(r.left-pad)+'px',top:(r.top-pad)+'px',width:(r.width+2*pad)+'px',height:(r.height+2*pad)+'px'});
  const below=r.top+r.height/2<innerHeight/2, w=Math.min(340,innerWidth-24);
  bb.style.width=w+'px'; bb.style.left=Math.max(12,Math.min(innerWidth-w-12,r.left+r.width/2-w/2))+'px';
  if(below){ bb.style.top=Math.min(innerHeight-170,r.bottom+pad+10)+'px'; bb.style.bottom='auto'; } else { bb.style.bottom=Math.min(innerHeight-170,innerHeight-r.top+pad+10)+'px'; bb.style.top='auto'; } }

// ---------------- pagina della guida ----------------
PH.guidaOpen=function(sez){
  let d=document.getElementById('hzGuida'); if(d) d.remove();
  d=document.createElement('div'); d.className='ph-sheet'; d.id='hzGuida';
  d.innerHTML=`<div class="ph-sheet-h"><button type="button" id="hzGBack">◀ Indietro</button><b>Guida di HORIZON</b></div>
  <div class="ph-imp">
    <section><h3>Tour guidato</h3><p class="ph-sub">Un giro di un minuto sui comandi dello strumento, passo per passo.</p>
      <div class="ph-btns"><button class="ph-btn pri" type="button" id="hzGTour">▶ Inizia il tour</button></div></section>
    <section><h3>Cerca nella guida</h3><input id="hzGQ" type="search" placeholder="es. livella, traffico, rotta, planata" style="width:100%"></section>
    <section><h3>Argomenti</h3><div class="hz-idx">${G.map(g=>`<a href="#" data-g="${g.id}">${esc(g.t)}</a>`).join('')}<a href="#" data-g="catalogo">Catalogo dei velivoli</a></div></section>
    ${G.map(g=>`<section class="hz-g" id="hzG-${g.id}"><details><summary><h3 style="display:inline">${esc(g.t)}</h3></summary><div class="hz-gt">${g.h}</div></details></section>`).join('')}
    <section class="hz-g" id="hzG-catalogo"><details><summary><h3 style="display:inline">Catalogo dei velivoli</h3></summary><div class="hz-gt">${catalogoHtml()}</div></details></section>
  </div>`;
  document.body.appendChild(d);
  const apri=id=>{ const s=document.getElementById('hzG-'+id); if(!s) return; const dt=s.querySelector('details'); dt.open=true; s.scrollIntoView({behavior:'smooth',block:'start'}); };
  d.querySelectorAll('[data-g]').forEach(a=>a.onclick=ev=>{ ev.preventDefault(); apri(a.dataset.g); });
  document.getElementById('hzGBack').onclick=()=>d.remove();
  document.getElementById('hzGTour').onclick=()=>{ d.remove(); PH.tourStart(); };
  catalogoWire(d);
  document.getElementById('hzGQ').oninput=ev=>{ const q=ev.target.value.trim().toLowerCase();
    d.querySelectorAll('.hz-g').forEach(s=>{ const hit=!q||s.textContent.toLowerCase().includes(q); s.hidden=!hit; const dt=s.querySelector('details'); if(q&&hit) dt.open=true; }); };
  if(sez) setTimeout(()=>apri(sez),50);
  PH.act&&PH.act('guida'+(sez?' '+sez:''));
};
// sezione da mettere in testa a Info
PH.guidaInfoHtml=function(){ return `<section><h3>Guida e tour</h3><p class="ph-sub">Come funziona ogni pagina e ogni impostazione, un tour guidato dei comandi e il catalogo dei velivoli da configurare con un tocco.</p>
  <div class="ph-btns"><button class="ph-btn pri" type="button" id="hzInfoG">Apri la guida</button><button class="ph-btn" type="button" id="hzInfoT">▶ Tour guidato</button><button class="ph-btn" type="button" id="hzInfoC">Catalogo velivoli</button></div></section>`; };
PH.guidaInfoWire=function(){ const g=document.getElementById('hzInfoG'); if(!g) return;
  g.onclick=()=>PH.guidaOpen(); document.getElementById('hzInfoT').onclick=()=>PH.tourStart(); document.getElementById('hzInfoC').onclick=()=>PH.guidaOpen('catalogo'); };

// stile
const css=document.createElement('style'); css.textContent=`
#hzTour{position:fixed;inset:0;z-index:90}
#hzTour .hz-spot{position:fixed;border-radius:12px;border:2px solid var(--cyan,#33d6ff);box-shadow:0 0 0 9999px rgba(0,0,0,.66);transition:all .25s;pointer-events:none}
#hzTour .hz-bub{position:fixed;background:#121a22;border:2px solid var(--cyan,#33d6ff);border-radius:14px;padding:12px 14px;color:#eef3f8;box-shadow:0 8px 30px rgba(0,0,0,.6)}
#hzTour .hz-bub b{font:800 18px "Oxanium",system-ui,sans-serif;letter-spacing:.03em}
#hzTour .hz-bub p{margin:6px 0 10px;font-size:15px;line-height:1.4}
#hzTour .hz-tb{display:flex;gap:8px;align-items:center}
#hzTour .hz-tb span{flex:1;text-align:center;opacity:.7;font-size:13px}
#hzTour .hz-tb button{min-height:44px;min-width:44px;padding:0 12px;border-radius:10px;border:2px solid #3a4a5a;background:#1b2530;color:#eef3f8;font:700 15px system-ui,sans-serif}
#hzTour .hz-tb button.pri{border-color:var(--cyan,#33d6ff);background:#0e3a48}
.hz-idx{display:flex;flex-wrap:wrap;gap:8px}
.hz-idx a{padding:8px 12px;border:1px solid #3a4a5a;border-radius:999px;color:#cfe9ff;text-decoration:none;font-size:14px}
.hz-g summary{cursor:pointer;list-style:none;padding:4px 0} .hz-g summary::-webkit-details-marker{display:none}
.hz-g summary::before{content:'▸ ';color:var(--cyan,#33d6ff)} .hz-g details[open] summary::before{content:'▾ '}
.hz-gt{font-size:15px;line-height:1.45} .hz-gt li{margin:4px 0} .hz-gt a{color:#7fdcff}
.hz-cat{display:grid;gap:8px}
.hz-catb{text-align:left;padding:10px 12px;border-radius:12px;border:2px solid #3a4a5a;background:#1b2530;color:#eef3f8;display:flex;flex-direction:column;gap:2px;min-height:56px}
.hz-catb b{font-size:16px} .hz-catb small{opacity:.75;font-size:12.5px} .hz-catb:active{background:#2a3846}`;
document.head.appendChild(css);
})();
