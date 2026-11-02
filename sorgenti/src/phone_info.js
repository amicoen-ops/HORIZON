// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
// =====================================================================================
//  Info: versione e aggiornamenti, segnalazioni, avvertenze, crediti, donazione
// =====================================================================================
const PH_INFO={
  author:'Enrico D\'Amico',
  mail:'amicoen@gmail.com',                       // le segnalazioni arrivano qui (FormSubmit, poi posta)
  paypal:'https://www.paypal.me/amicoen',
  web:'https://amicoen-ops.github.io/HORIZON/',
  w3f:'11d0883a-25d2-4be5-aa08-d0f6ce0623d3',                                         // chiave pubblica Web3Forms (vuota: FormSubmit, poi condivisione)
  releases:'https://api.github.com/repos/amicoen-ops/HORIZON/releases/latest',
  termsVersion:2,                                 // 2: aggiunta la licenza
  owner:"Enrico D'Amico",
};
const PH_CHANGES=[
  ['2.0.5','Modalità ☁ NUBE: solo l\'essenziale, tasti grandi per INVERSIONE 180° (flight director, virata standard dal lato del terreno più basso, quota minima), CAMPO VICINO e PUNTO A VISTA. Recupero da assetti inusuali sempre attivo. Controlli di integrità dell\'assetto (ATT DISAGREE con lo strumento fisico, assetto da GPS, sensori al limite). Strumento fisico via Bluetooth LE con IAS e quota barometrica. Orizzonte di riserva Android se la pagina si blocca.'],
  ['2.0','HORIZON v2 di prova: app separata che si installa accanto alla versione 1, con dati suoi. Qui arrivano le novità per il volo senza visibilità: orizzonte che non si blocca mai, controllo dell\'affidabilità dell\'assetto, modalità NUBE e inversione a 180°.'],
  ['1.0.39','⛽ Alternati con carburante in tre fasce (comodo, riserva, critico): nel piano lungo la rotta, con da dove deviare, con quanti litri arrivi e l\'ultimo rifornimento utile da aggiungere come tappa; in volo il tasto ⛽ li mostra dalla posizione attuale col carburante stimato, correggibile, e «Vai diretto». Dati openAIP aggiornati ogni notte, più i campi che segni tu.'],
  ['1.0.37','Controllo della versione a ogni avvio e tasto «Aggiorna ora»: l\'app scarica e installa da sola la versione nuova (dal Play Store nella versione del Play Store, ricarica sul browser). Mai in volo. Le segnalazioni arrivano per posta in italiano, con oggetto chiaro e campi in ordine. Corretto il tipo di volo nelle impostazioni, che non si cambiava.'],
  ['1.0.36','Calcola rotta più veloce sulle rotte lunghe con parchi e zone dai confini molto dettagliati: lo schermo resta sempre reattivo durante il calcolo.'],
  ['1.0.34','Calcola rotta: una tratta lunga resta sotto la base delle zone anche sul suo punto più alto; i punti si tolgono solo se la tratta, alla quota che le dà l\'app, non entra in zone.'],
  ['1.0.33','Parchi e aree protette (OFR, come il Parco Nazionale del Gran Paradiso): ora sono zone da non sorvolare per ogni tipo di volo, con avviso in volo; «Calcola rotta» li gira intorno. Campi delle Alpi oltre confine (Francia, Svizzera, Austria, Slovenia), per esempio l\'altiporto della Tovière; spazi aerei openAIP anche dei Paesi vicini, nella fascia alpina. Calcola rotta: la pulizia dei punti non fa più entrare in zone nuove. Il cerchio di planata sulla mappa si accende e si spegne in Impostazioni › Velivoli.'],
  ['1.0.31','Controllo meteo della rotta alle quote (nella rotta disegnata e nel Briefing): vento e temperatura su tutti i livelli da 1000 a 700 hPa, all\'ora in cui passi su ogni tratta; quota ottimizzata per tratta (terreno, basi delle zone e delle nubi basse, vento migliore); tempo e carburante col vento; avvisi in verde, giallo e rosso per nubi basse, visibilità, pioggia, temporali, ghiaccio, raffiche e traverso all\'arrivo. Tastino LIVELLA accanto a GPS · ASSETTO · TERRENO · NET (chiede conferma). Vento anche a parole: «270° da O (ponente)».'],
  ['1.0.30','L\'app si chiama HORIZON. Velivoli: in Impostazioni un profilo per ogni aereo (velocità e archi, prestazioni, carburante, pesi e centraggio, transponder e radio) che regola scala di velocità, circuito, simulazione, piano, carico e centraggio, piste, vento al traverso, spazi aerei e cerchio di planata. Meteo con l\'ora esatta dell\'aggiornamento. Novità: solo l\'ultima versione, le precedenti si aprono col triangolino. Richiede Android 14 o più recente.'],
  ['1.0.28','Licenza d\'uso: 30 giorni di prova, poi sul Play Store abbonamento annuale da 20 € (Google Play, su tutti i telefoni del tuo account, disdici quando vuoi). In volo l\'app non si blocca mai. Info › Licenza d\'uso mostra lo stato e il link per gestire l\'abbonamento. Codice nativo offuscato.'],
  ['1.0.26','Calcola rotta: tolti i punti in più (niente tratte corte a zig-zag) quando la tratta senza di loro resta fuori dalle zone e il terreno non chiede di salire.'],
  ['1.0.25','Profilo verticale in una pagina rettangolare (tasto PROFILO, oppure tocca la riga dello spazio aereo): terreno, spazi aerei colorati per il tuo tipo di volo, quota dell\'aereo con la tendenza del vario, crociera e punti della rotta; davanti 10–100 km o tutta la rotta. Terreno 3D più dettagliato (riquadri fino a 3 volte più piccoli) e disegnato più in fretta di prima; in Impostazioni il dettaglio, in automatico scende da solo se il telefono rallenta.'],
  ['1.0.24','Piano › ✎ Disegna sulla mappa: rotta a schermo pieno. Un tocco aggiunge un punto (si aggancia a campi e punti di riporto VFR), trascinando la linea magenta si inserisce un punto, trascinando un punto su quello vicino si toglie, tenendo premuto si segna un punto da non sorvolare. Toccando una tratta: km, minuti, prua e quota. «Calcola rotta» cerca la più breve in tempo con il vento previsto, intorno a zone P, R, spazi vietati e punti da non sorvolare, dalle valli; per ogni tratta la quota ideale: sopra il terreno con margine, sotto le basi delle zone, col vento migliore. Il terreno vince sempre.'],
  ['1.0.19','Avvisi di spazio aereo e terreno: un tocco li toglie dal video (lo spazio aereo torna ad avvisare dopo che ne sei uscito). Tasto segnalazioni riparato (Web3Forms; se non parte si sceglie un\'altra app). Orizzonte: in virata usa anche la velocità di virata del GPS se il giroscopio manca o non segue. Mappa: si sposta col dito, zoom sul punto guardato, ⌖ CENTRA per tornare. Interfaccia Semplice (solo orizzonte) o Completa. Tracce degli ultimi 50 voli nel telefono: le vedi sulla mappa e le esporti insieme in GPX o KML.'],
  ['1.0.18','Versione per browser e iPhone/iPad: link in Info (apri, copia, condividi); su iPhone un tocco consente i sensori di movimento e la bussola usa quella di iOS. Spazi aerei openAIP anche dal browser, da una copia aggiornata ogni notte.'],
  ['1.0.17','Riga dello spazio aereo: uno spazio che parte dal suolo (SFC) risulta «dentro» anche a terra, quando la quota GPS è sotto il terreno.'],
  ['1.0.16','Tipo di volo (VDS basico, VDS avanzato, aviazione generale VFR) in Impostazioni e nel Briefing: la rotta viene controllata con le sue regole (DPR 133/2010 per il VDS: spazi controllati e ATZ, 500/1000 ft sull\'ostacolo più alto entro 5 km, 5 km dagli aeroporti). Sotto lo strumento una riga dice sempre in che spazio aereo sei e se è consentito, anche in simulazione; gli avvisi degli spazi aerei funzionano anche simulando. Le aree FMC sono indicate come raccomandazione, non come divieto. Nel menu dello strumento, barra fissa con «Indietro» e «✕». Nel Piano i campi si scelgono anche scrivendo nome o sigla.'],
  ['1.0.15','Spazi aerei d\'Italia da openAIP corretti: il file giusto (lo stesso di XCSoar, aggiornato ogni notte, senza chiave) e lettura del formato OpenAir 2.0, con zone R, P e pericolose riconosciute (1555 spazi). Le aree per attività sportive si vedono ma non danno avvisi.'],
  ['1.0.14','Spazi aerei veri d\'Italia con un pulsante: «Scarica gli spazi aerei d\'Italia (openAIP)». Prima il file pubblico di openAIP, senza account; se non risponde, l\'API openAIP con la chiave gratuita. Si riscaricano da soli a ogni ciclo AIRAC.'],
  ['1.0.13','Bussola letta direttamente dal sensore di Android (prima dipendeva dal browser interno e poteva mancare). Da fermo mappa e riquadro usano la prua della bussola (scritta PRUA) invece della traccia GPS, che a velocità zero è solo rumore.'],
  ['1.0.12','Bussola del telefono: a terra e sotto 25 km/h la prua viene dalla bussola (con la declinazione, prua vera); in volo dalla traccia GPS. Scelta in Impostazioni › Bussola. Quota: si può tarare a mano con una quota nota («Tara qui»).'],
  ['1.0.11','Ricerca dei campi scrivendo il nome o la sigla, in DIRECT TO e in NUOVA ROTTA. Invito alla donazione nei primi 5 avvii (non nella versione del Play Store). Informativa sulla privacy in Info.'],
  ['1.0.10','Assetto giusto anche con il telefono girato in orizzontale (da tutte e due le parti) o capovolto: i sensori seguono il verso dello schermo, e quando giri il telefono l\'orizzonte si rilivella da solo.'],
  ['1.0.9','Corretto il blocco vero: con il GPS irregolare (al chiuso) il filtro della quota diventava instabile e la quota arrivava a miliardi di metri, bloccando la scala della quota. Nuovo filtro stabile e protezioni nel disegno. Nuova scheda SIMULA: vola da sola una rotta salvata o un direct to, con velocità, quota, vento e tempo accelerato fino a ×8. Campi di tutto il Nord Italia da OurAirports: 342 tra aeroporti e aviosuperfici.'],
  ['1.0.8','Scatola nera: l\'app ricorda ultimo stato e ultime azioni; dopo un blocco, alla riapertura, li alleghi alla segnalazione da Info.'],
  ['1.0.7','Zoom della mappa fino a 700 km (tutto il Nord Italia): 19 scale da 1 a 700 km. Oltre 60 km i campi diventano puntini e restano scritti solo gli aeroporti; il terreno usa tessere più leggere e si scarica anche per il volo senza internet.'],
  ['1.0.6','Corretto il blocco nel passaggio fra mappa e orizzonte; app più leggera (30 fotogrammi al secondo, terreno ricalcolato meno spesso). Zoom della mappa con due dita, con i pulsanti + e − e con 12 scale da 1 a 60 km. Orizzonte più morbido, regolabile in Impostazioni › Montaggio. A terra la mappa non si colora più di rosso.'],
  ['1.0.5','Licenza: © Enrico D\'Amico, tutti i diritti riservati. È nelle avvertenze, da riaccettare una volta, e nella pagina Info con il testo completo e le librerie di terze parti.'],
  ['1.0.4','Pagina Info: versione installata, aggiornamenti, segnalazioni per posta, avvertenze, crediti, donazione con PayPal.'],
  ['1.0','Prima versione per telefono e tablet: orizzonte e mappa dello strumento, rotte, circuito, piano di volo e meteo; GPS del telefono o Garmin GLO 2; terreno vero e avviso TERRENO; mappe OpenTopoMap, OpenStreetMap, satellite Esri, IGM 1:25.000, ortofoto; METAR e TAF; diario di volo con GPX; voce; tablet con due viste.'],
];
const PH_TERMS=`<p><b>Strumento sperimentale, non certificato.</b> Questa app non è un equipaggiamento approvato (EASA, ENAC o altre autorità) e non sostituisce alcuno strumento di bordo, carta aeronautica, documento ufficiale o briefing. Serve solo come ausilio alla consapevolezza della situazione.</p>
<p><b>Il pilota in comando resta l'unico responsabile</b> della condotta del volo, della navigazione, della separazione dal terreno, dagli ostacoli, dagli altri aeromobili e dagli spazi aerei, e del rispetto delle norme, compreso il regolamento VDS/ULM (DPR 133/2010) dove applicabile.</p>
<p><b>Limiti noti.</b> Il telefono non misura la velocità rispetto all'aria né la pressione: la velocità mostrata è quella al suolo, la quota è quella GPS con errori di decine di metri. L'assetto viene dai sensori del telefono e può essere sbagliato con supporti non rigidi, vibrazioni, accelerazioni o dopo un riavvio. GPS, sensori, Bluetooth e batteria possono smettere di funzionare senza preavviso. Campi, piste, quote, ostacoli, spazi aerei, terreno, mappe e meteo possono essere incompleti, sbagliati o non aggiornati; il meteo è una previsione di modello. Gli avvisi (terreno, spazi aerei, tramonto) possono mancare o arrivare in ritardo.</p>
<p><b>Uso in volo.</b> Fissa il telefono in modo che non intralci i comandi e non cada; non distrarti dal pilotaggio e dalla vista fuori. Verifica sempre AIP, NOTAM, carte e meteo ufficiali prima del volo.</p>
<p><b>Nessuna garanzia.</b> L'app è fornita gratuitamente «così com'è», senza garanzie di alcun tipo, esplicite o implicite, di funzionamento, precisione o idoneità a uno scopo. Nei limiti consentiti dalla legge, l'autore declina ogni responsabilità per danni diretti o indiretti, a persone o cose, derivanti dall'uso o dall'impossibilità di usare l'app o i dati che mostra.</p>
<p><b>Licenza.</b> © 2026 Enrico D'Amico, tutti i diritti riservati. Puoi installare e usare l'app ufficiale per uso personale e non commerciale. Copiarla, modificarla, ridistribuirla, venderla o riusarne il codice richiede il permesso scritto dell'autore. Le librerie di terze parti restano sotto le proprie licenze.</p>
<p><b>Dati personali.</b> Posizione, rotte, campi e diario di volo restano sul telefono. Escono solo le richieste ai servizi di mappe, terreno e meteo (con la zona visualizzata) e le segnalazioni che invii tu.</p>`;

PH.version=function(){ const b=window.IA517_BUILD||{version:'1.0.0',build:'dev',channel:'web'}; return b; };
PH.versionHistory=function(){
  const b=PH.version(), h=lsGet('ia517p_versions',[]);
  if(!h.length || h[0].v!==b.version){ h.unshift({v:b.version,build:b.build,t:Date.now()}); lsSet('ia517p_versions',h.slice(0,20)); }
  return h;
};
// controllo degli aggiornamenti all'avvio e aggiornamento dall'app
//  · APK di GitHub: legge l'ultima versione pubblicata, scarica l'APK e apre l'installazione di Android
//  · Google Play: chiede al Play Store se c'è una versione nuova e la installa dentro l'app (In-App Updates)
//  · browser / iPhone: confronta l'impronta delle pagine pubblicate e ricarica
PH.updBusy=false;
PH.checkUpdate=async function(manual){
  const b=PH.version(), out={state:'?',channel:b.channel};
  try{
    if(!navigator.onLine){ out.state='offline'; }
    else if(b.channel==='play'){
      const U=PH.native&&PH.native.upd; if(!U) throw new Error('modulo aggiornamenti assente');
      const r=await U.playCheck();
      if(r.error && !r.available){ out.state='errore'; out.msg=r.error; }
      else Object.assign(out,{state:r.available?'nuova':'ok',build:r.versionCode||0,latest:r.available?'1.0.'+r.versionCode:b.version,stale:r.staleDays}); }
    else if(b.channel==='web'){
      const r=await fetch('version.js?chk='+Date.now(),{cache:'no-store'}); if(!r.ok) throw new Error('risposta '+r.status);
      const t=await r.text(), bu=(t.match(/build:'([^']*)'/)||[])[1]||'', ve=(t.match(/version:'([^']*)'/)||[])[1]||'';
      Object.assign(out,{state:bu&&bu!==String(b.build)&&b.build!=='web'?'nuova':'ok',latest:ve||b.version,build:bu}); }
    else {
      const v2=b.line==='v2';                                 // HORIZON v2: solo le sue pre-release «v2-build-N»
      const r=await window.IA517.http(v2?PH_INFO.releases.replace(/\/latest$/,'?per_page=30'):PH_INFO.releases);
      if(r.status===404){ out.state='privato'; }
      else if(r.status!==200){ out.state='errore'; out.msg='risposta '+r.status; }
      else { let j=JSON.parse(r.text);
        if(v2){ j=(Array.isArray(j)?j:[]).filter(x=>/^v2-build-\d+$/.test(x.tag_name||'')&&!x.draft).sort((a,c)=>parseInt(c.tag_name.slice(9))-parseInt(a.tag_name.slice(9)))[0]||{}; }
        const n=parseInt(String(j.tag_name||'').replace(/^v2-/,'').replace(/\D+/g,''))||0, cur=parseInt(b.build)||0;
        const apk=(j.assets||[]).find(a=>/\.apk$/i.test(a.name)&&!/play/i.test(a.name));
        Object.assign(out,{state:n>cur?'nuova':'ok',latest:(j.name||j.tag_name||'').replace(/^HORIZON\s*(v2\s*·\s*)?/,'').replace(/\s*\(prova\)$/,''),build:n,
          url:apk?apk.browser_download_url:j.html_url,apk:!!apk,size:apk?apk.size:0,date:j.published_at,notes:j.body||''}); } }
  }catch(e){ out.state=navigator.onLine?'errore':'offline'; out.msg=e&&e.message; }
  out.t=Date.now(); lsSet('ia517p_update',out); PH.upd=out;
  if(out.state==='nuova' && !manual) PH.updPrompt(out);
  return out;
};
PH.updMoving=()=>!!(PH.flight || PH.sim || PH.imc || (S.gpsReal && S.gs>35));
// la finestra «Nuova versione»: mai sopra lo strumento in volo, aspetta l'atterraggio
PH.updPrompt=function(u){
  if(!u || u.state!=='nuova' || PH.updLater===u.build || document.getElementById('phUpdAsk')) return;
  if(PH.updMoving() || document.getElementById('phTerms') || document.getElementById('licWall')){ clearTimeout(PH.updWait); PH.updWait=setTimeout(()=>PH.updPrompt(u),60e3); return; }
  const nag=document.getElementById('phNag'); if(nag) nag.remove();
  const esc=x=>String(x||'').replace(/</g,'&lt;');
  const notes=u.notes?esc(u.notes).split('\n').filter(l=>l.trim()).slice(0,8).join('<br>'):'';
  const d=document.createElement('div'); d.className='ph-sheet ph-terms'; d.id='phUpdAsk';
  d.innerHTML=`<div class="ph-imp"><section><h3>Nuova versione disponibile</h3>
    <p><b class="ph-new">HORIZON ${esc(u.latest)}</b> · ora hai la ${esc(PH.version().version)}</p>
    ${notes?`<p class="ph-sub">${notes}</p>`:''}
    <p class="ph-sub">${u.channel==='web'?'Si ricarica la pagina con la versione nuova.':u.channel==='play'?'L\'aggiornamento arriva dal Play Store e si installa qui dentro.':'Si scarica e si installa sopra quella attuale: rotte, campi, velivoli, impostazioni e diario restano.'}</p>
    <div id="phUpdMsg" class="ph-sub"></div>
    <div class="ph-btns" style="justify-content:center"><button class="ph-btn pri" id="phUpdNow">Aggiorna ora</button><button class="ph-btn" id="phUpdLater">Più tardi</button></div></section></div>`;
  document.body.appendChild(d);
  el('phUpdLater').onclick=()=>{ PH.updLater=u.build; d.remove(); };
  el('phUpdNow').onclick=()=>PH.doUpdate(u,el('phUpdMsg'),el('phUpdNow'));
};
PH.doUpdate=async function(u,msg,btn){
  u=u||PH.upd||lsGet('ia517p_update',null); if(!u || PH.updBusy) return;
  const say=t=>{ if(msg) msg.innerHTML=t; };
  if(PH.updMoving()){ say('In volo non si aggiorna: riprova a terra.'); return; }
  PH.updBusy=true; if(btn) btn.disabled=true; PH.act&&PH.act('aggiorna '+(u.latest||''));
  try{
    if(u.channel==='web'){
      say('Carico la versione nuova…');
      try{ const ks=await caches.keys(); await Promise.all(ks.filter(k=>k.startsWith('ia517-app-')).map(k=>caches.delete(k))); }catch(e){}
      try{ const r=navigator.serviceWorker&&await navigator.serviceWorker.getRegistration(); if(r) await r.update(); }catch(e){}
      location.reload(); return; }
    const U=PH.native&&PH.native.upd;
    if(u.channel==='play'){
      if(!U) throw new Error('aggiorna dal Play Store');
      say('Apro l\'aggiornamento del Play Store…'); await U.playStart(); say('Segui le istruzioni del Play Store.'); return; }
    // APK di GitHub
    if(!U || !u.apk){ window.open(u.url,'_blank'); say('Si apre la pagina della versione: scarica l\'APK e installalo.'); return; }
    let lis=null;
    try{ lis=await U.addListener('progress',p=>{ const mb=v=>(v/1048576).toFixed(1);
      say(p.total>0?`Scarico… ${Math.round(p.done*100/p.total)}% · ${mb(p.done)} di ${mb(p.total)} MB`:`Scarico… ${mb(p.done)} MB`); }); }catch(e){}
    say('Scarico la versione nuova…');
    const r=await U.apkDownload({url:u.url});
    try{ lis&&lis.remove&&lis.remove(); }catch(e){}
    if(u.size && Math.abs(r.size-u.size)>0) throw new Error('file incompleto, riprova');
    PH.updFile=r.path;
    const inst=async()=>{ const x=await U.apkInstall({path:PH.updFile});
      if(x.needPermission){ say('Android chiede il permesso: attiva <b>«Consenti da questa fonte»</b> per HORIZON e torna qui, l\'installazione riparte da sola.');
        const back=()=>{ if(document.visibilityState==='visible'){ document.removeEventListener('visibilitychange',back); setTimeout(inst,600); } };
        document.addEventListener('visibilitychange',back); return; }
      say('Conferma «Aggiorna» nella finestra di Android. L\'app si riapre aggiornata.'); };
    await inst();
  }catch(e){ say('Aggiornamento non riuscito: '+String(e&&e.message||e).replace(/</g,'').slice(0,120)+(u.url?` · <a href="${u.url}" target="_blank" rel="noopener">scaricalo a mano</a>`:'')); }
  finally{ PH.updBusy=false; if(btn) btn.disabled=false; }
};
// registro degli errori, da allegare alle segnalazioni
PH.errLog=lsGet('ia517p_errlog',[]);
PH.logErr=function(msg){ PH.errLog.unshift(new Date().toISOString().slice(0,19)+' '+String(msg).slice(0,300)); PH.errLog=PH.errLog.slice(0,30); lsSet('ia517p_errlog',PH.errLog); };
addEventListener('error',e=>PH.logErr((e.message||'errore')+' @'+(e.filename||'').split('/').pop()+':'+(e.lineno||'')));
addEventListener('unhandledrejection',e=>PH.logErr('promise: '+(e.reason&&e.reason.message||e.reason)));
PH.diag=function(){
  const b=PH.version(), s=PH.status();
  return [`Versione ${b.version} (build ${b.build}, ${b.channel})`, navigator.userAgent, `Schermo ${innerWidth}×${innerHeight} @${devicePixelRatio}`,
    ...s.rows.map(r=>`${r[1]}: ${r[2]}`), `Giroscopio: ${PH.gyroOk?'sì':'assente'} · virate da ${PH.turnSrc}${PH.gyroSus?' (il giroscopio non seguiva la virata)':''} · virata GPS ${(+PH.trkRate||0).toFixed(1)}°/s`, `Errori di disegno: ${FRAME_ERR||0}${FRAME_LAST_ERR?' · ultimo: '+FRAME_LAST_ERR:''}`,
    `Disegno: ${PH.perf.avg.toFixed(1)} ms per fotogramma · ${PH.fps} al secondo · blocchi ${PH.perf.stalls}`,
    `Sessione precedente, ultimo stato: ${PH.hbPrev?new Date(PH.hbPrev.t).toLocaleString('it-IT')+' · pagina '+PH.hbPrev.page+' · zoom '+PH.hbPrev.zoom+' km · mappa '+PH.hbPrev.base+' · '+PH.hbPrev.ms+' ms (max '+PH.hbPrev.max+') · blocchi '+PH.hbPrev.stalls+(PH.hbPrev.menu?' · menu aperto':'')+(PH.hbPrev.prompt?' · domanda a schermo':'')+' · terreno '+PH.hbPrev.dem+' · tessere in arrivo '+PH.hbPrev.tl:'—'}`,
    'Ultime azioni della sessione precedente:', ...((PH.hbPrev&&PH.hbPrev.trail&&PH.hbPrev.trail.length)?PH.hbPrev.trail:['—']),
    'Ultimi errori:', ...(PH.errLog.length?PH.errLog.slice(0,12):['nessuno'])].join('\n');
};
// segnalazioni: inviate per posta tramite Web3Forms (FormSubmit di riserva); senza rete restano in coda e partono dopo
PH.reports=lsGet('ia517p_reports',[]);
// la posta che arriva a Enry: oggetto chiaro, campi in italiano e in ordine, dati tecnici in fondo
PH.repMail=function(rep){
  const b=PH.version(), d=new Date(rep.t), diag=rep.diag||'';
  const two=n=>String(n).padStart(2,'0'), when=`${two(d.getDate())}/${two(d.getMonth()+1)}/${d.getFullYear()} alle ${two(d.getHours())}:${two(d.getMinutes())}`;
  const ua=navigator.userAgent, m=ua.match(/Android\s+([\d.]+);\s*([^;)]+?)(?:\s+Build|\))/), ios=ua.match(/(iPhone|iPad)[^)]*OS\s+([\d_]+)/);
  const tel=m?`${m[2].trim()} · Android ${m[1]}`:ios?`${ios[1]} · iOS ${ios[2].replace(/_/g,'.')}`:(PH.isIOS?'iPhone':'browser');
  const acL=(diag.match(/^Velivolo:\s*(.+)$/m)||[])[1]||'—';
  const canale={apk:'APK da GitHub',play:'Google Play',web:'web / iPhone'}[b.channel]||b.channel;
  const short=rep.text.replace(/\s+/g,' ').trim(), cut=short.length>70?short.slice(0,70)+'…':short;
  return {access_key:PH_INFO.w3f, from_name:'HORIZON · segnalazioni', subject:`HORIZON · ${rep.kind} · ${b.version} — ${cut}`,
    replyto:rep.reply||undefined,
    'Segnalazione':rep.kind, 'Messaggio':rep.text, 'Rispondere a':rep.reply||'non indicato',
    'Velivolo':acL, 'Versione':`HORIZON ${b.version} · ${canale}`, 'Telefono':tel, 'Inviata il':when,
    'Dati tecnici':diag?diag.split('\n').filter(l=>!/^Velivolo:/.test(l)).join('\n'):'non allegati'};
};
PH.sendReport=async function(rep){
  const subj=`[HORIZON] ${rep.kind}: ${rep.text.slice(0,60)}`, ver=PH.version().version, when=new Date(rep.t).toLocaleString('it-IT');
  const post=async(url,body,extra)=>{ const h=Object.assign({'Content-Type':'application/json','Accept':'application/json'},extra||{});
    if(PH.native&&PH.native.http){ const r=await PH.native.http.post({url,headers:h,data:body}); let d=r.data; if(typeof d==='string'){ try{ d=JSON.parse(d); }catch(e){} } return {status:r.status,d}; }
    const r=await fetch(url,{method:'POST',headers:h,body:JSON.stringify(body)}); let d=null; try{ d=await r.json(); }catch(e){} return {status:r.status,d}; };
  const yes=v=>v===true||v==='true';
  if(PH_INFO.w3f){                                                         // Web3Forms: chiave pubblica, arriva per posta a Enry
    // dal WebView come da un browser (Web3Forms gratuito accetta solo invii da pagina web), il modulo nativo solo se fetch non passa
    const postW=async(url,body)=>{ try{ const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body)});
        let d=null; try{ d=await r.json(); }catch(e){} return {status:r.status,d}; }catch(e){ if(PH.native&&PH.native.http) return post(url,body); throw e; } };
    const r=await postW('https://api.web3forms.com/submit',PH.repMail(rep));
    if(r.status>=200&&r.status<300&&r.d&&yes(r.d.success)) return;
    throw new Error((r.d&&r.d.message)||('risposta '+r.status)); }
  const body={_subject:subj,_template:'box',_captcha:'false',tipo:rep.kind,messaggio:rep.text,rispondi_a:rep.reply||'(non indicato)',versione:ver,data:when,dati_tecnici:rep.diag||'(non allegati)'};
  if(rep.reply) body._replyto=rep.reply;
  const r=await post('https://formsubmit.co/ajax/'+PH_INFO.mail,body,PH.native?{'Referer':PH_INFO.web,'Origin':'https://amicoen-ops.github.io'}:null);
  // FormSubmit risponde 200 anche quando non inoltra (modulo da attivare, origine rifiutata): conta solo success:true
  if(!(r.status>=200&&r.status<300&&r.d&&yes(r.d.success))) throw new Error((r.d&&r.d.message)||('risposta '+r.status));
};
PH.repText=function(rep){ return '[HORIZON] '+rep.kind+'\n\n'+rep.text+(rep.reply?'\n\nRispondere a: '+rep.reply:'')+'\n\n---\n'+(rep.diag||''); };
PH.shareReport=async function(rep){ const t=PH.repText(rep);
  try{ if(PH.native&&PH.native.share){ await PH.native.share.share({title:'Segnalazione HORIZON',text:t,dialogTitle:'Invia la segnalazione con…'}); return true; }
    if(navigator.share){ await navigator.share({title:'Segnalazione HORIZON',text:t}); return true; } }catch(e){ return false; }
  try{ await navigator.clipboard.writeText(t); toast('TESTO COPIATO'); return true; }catch(e){ return false; } };
PH.flushReports=async function(){
  if(!PH.reports.length || !navigator.onLine) return;
  const left=[];
  for(const r of PH.reports){ try{ await PH.sendReport(r); }catch(e){ left.push(r); } }
  if(left.length<PH.reports.length) toast('SEGNALAZIONE INVIATA');
  PH.reports=left; lsSet('ia517p_reports',left);
};
addEventListener('online',()=>PH.flushReports());
PH.mailto=function(rep){
  return 'mailto:'+PH_INFO.mail+'?subject='+encodeURIComponent('[HORIZON] '+rep.kind)+'&body='+encodeURIComponent(rep.text+'\n\n---\n'+(rep.diag||''));
};

// avvertenze da accettare al primo avvio (e quando cambiano)
PH.terms=function(){
  const a=lsGet('ia517p_terms',null); if(a && a.v>=PH_INFO.termsVersion) return;
  const d=document.createElement('div'); d.className='ph-sheet ph-terms'; d.id='phTerms';
  d.innerHTML=`<div class="ph-imp"><section><h3>Prima di usare l'app</h3>${PH_TERMS}
    <label class="ph-chk"><input type="checkbox" id="phTermsOk"> Ho letto e accetto le avvertenze e la licenza: uso l'app sotto la mia responsabilità, come ausilio e non come strumento primario.</label>
    <div class="ph-btns"><button class="ph-btn pri" id="phTermsGo" disabled>Accetto e continuo</button></div></section></div>`;
  document.body.appendChild(d);
  el('phTermsOk').onchange=e=>{ el('phTermsGo').disabled=!e.target.checked; };
  el('phTermsGo').onclick=()=>{ lsSet('ia517p_terms',{v:PH_INFO.termsVersion,t:Date.now(),ver:PH.version().version}); d.remove(); setTimeout(()=>PH.donateNag(),1200); };
};

PH.renderInfo=function(){
  const b=PH.version(), h=PH.versionHistory(), up=lsGet('ia517p_update',null), acc=lsGet('ia517p_terms',null);
  const dt=t=>t?new Date(t).toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'}):'—';
  const upHtml=u=>{ if(!u) return '<p class="ph-sub">Non ancora controllato.</p>';
    const when=`controllato il ${new Date(u.t).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}`;
    if(u.state==='nuova') return `<p><b class="ph-new">Disponibile la versione ${u.latest}</b>${u.date?' ('+dt(u.date)+')':''}</p>${u.notes?`<p class="ph-sub">${u.notes.replace(/</g,'&lt;').slice(0,300)}</p>`:''}
      <div class="ph-btns"><button class="ph-btn pri" id="phUpdNowI">Aggiorna ora</button></div><div id="phUpdMsgI" class="ph-sub"></div><p class="ph-sub">${b.channel==='web'?'Ricarica la pagina con la versione nuova.':'Si installa sopra la versione attuale: rotte, campi, velivoli, impostazioni e diario restano.'} ${when}.</p>`;
    if(u.state==='ok') return `<p>✓ Hai l'ultima versione (${u.latest||b.version}). <span class="ph-sub">${when}</span></p>`;
    if(u.state==='privato') return `<p class="ph-sub">Le versioni non sono ancora pubblicate in modo pubblico: il controllo automatico non può leggerle. ${when}.</p>`;
    if(u.state==='offline') return `<p class="ph-sub">Senza internet: ricontrollo al prossimo avvio con la rete. ${when}.</p>`;
    return `<p class="ph-sub">Controllo non riuscito${u.msg?' ('+String(u.msg).replace(/</g,'').slice(0,100)+')':''}. ${when}.</p>`; };
  const upWire=()=>{ const x=el('phUpdNowI'); if(x) x.onclick=()=>PH.doUpdate(null,el('phUpdMsgI'),x); };
  const box=el('phInfoBody');
  box.innerHTML=`
  <section class="ph-hero"><img src="icon-192.png" alt="" width="64" height="64"><div><b>HORIZON${b.line==='v2'?' v2 · prova':''} · strumento di volo</b><span>${PH_INFO.author}</span><span class="ph-sub">© 2026 ${PH_INFO.owner} · Tutti i diritti riservati</span></div></section>
  <section><h3>Versione</h3>
    <div class="ph-row"><span>Installata</span><small><b>${b.version}</b> · build ${b.build} · ${b.channel==='apk'?'app Android':(b.channel==='play'?'Play Store':'app dal browser')}</small></div>
    <div class="ph-row"><span>Installata o aggiornata il</span><small>${dt(h[0]&&h[0].t)}</small></div>
    ${h[1]?`<div class="ph-row"><span>Versione precedente</span><small>${h[1].v} · fino al ${dt(h[0].t)}</small></div>`:''}
    <div class="ph-row"><span>Avvertenze accettate</span><small>${acc?dt(acc.t):'no'}</small></div>
  </section>
  ${window.IA517_LIC?IA517_LIC.infoHtml():''}
  <section><h3>Aggiornamenti</h3><p class="ph-sub">Controllo a ogni avvio con internet${b.channel==='play'?', dal Play Store':b.channel==='web'?'':', dalle versioni pubblicate su GitHub'}.</p><div id="phUpd">${upHtml(up)}</div>
    <div class="ph-btns"><button class="ph-btn" id="phUpdGo">Controlla ora</button></div>
  </section>
  <section><h3>Sul browser, anche iPhone e iPad</h3>
    <p class="ph-sub">La stessa app gira in Chrome o Safari da questo indirizzo. Su iPhone aprilo con Safari, poi Condividi › <b>Aggiungi alla schermata Home</b>: si apre a schermo intero e funziona anche senza internet.</p>
    <div class="ph-row ph-col"><b style="word-break:break-all">${PH_INFO.web}</b></div>
    <div class="ph-btns"><a class="ph-btn pri" href="${PH_INFO.web}" target="_blank" rel="noopener">Apri</a><button class="ph-btn" id="phWebCopy">Copia il link</button><button class="ph-btn" id="phWebShare">Condividi</button></div>
  </section>
  <section><h3>Novità della versione ${PH_CHANGES[0][0]}</h3><div class="ph-row ph-col"><small>${PH_CHANGES[0][1]}</small></div>
    <details class="ph-hist"><summary>Versioni precedenti (${PH_CHANGES.length-1})</summary>${PH_CHANGES.slice(1).map(([v,t])=>`<div class="ph-row ph-col"><b>${v}</b><small>${t}</small></div>`).join('')}</details></section>
  <section><h3>Segnala un problema o un'idea</h3>
    <p class="ph-sub">Arriva per posta all'autore. Se sei in volo o senza rete resta in coda e parte da sola.</p>
    <div class="ph-seg" id="phRepKind">${['Problema','Suggerimento','Dato sbagliato'].map((k2,i)=>`<button data-k="${k2}" aria-pressed="${i===0}">${k2}</button>`).join('')}</div>
    <textarea id="phRepText" rows="5" placeholder="Cosa è successo, dove (campo, rotta), cosa ti aspettavi…"></textarea>
    <label class="ph-fld">La tua email, se vuoi una risposta (facoltativa)<input id="phRepMail" type="email" inputmode="email" autocomplete="email" style="width:100%"></label>
    <label class="ph-chk"><input type="checkbox" id="phRepDiag" checked> Allega i dati tecnici (versione, telefono, stato dei sensori, ultimi errori; nessuna posizione)</label>
    <details><summary class="ph-sub">Vedi i dati tecnici</summary><pre class="ph-pre" id="phRepPre"></pre></details>
    <div class="ph-btns"><button class="ph-btn pri" id="phRepSend">Invia segnalazione</button><a class="ph-btn" id="phRepMailto" href="#">Scrivi con l'app di posta</a><button class="ph-btn" id="phRepShare">Invia con un'altra app</button></div>
    <p class="ph-sub" id="phRepMsg">${PH.reports.length?PH.reports.length+' segnalazioni in coda.':''}</p>
  </section>
  <section><h3>Avvertenze e responsabilità</h3>${PH_TERMS}</section>
  <section><h3>Licenza</h3>
    <p>© 2026 ${PH_INFO.owner}. <b>Tutti i diritti riservati.</b> Non è software libero.</p>
    <p class="ph-sub">Puoi installare e usare l'app ufficiale per uso personale e non commerciale. Per copiarla, modificarla, ridistribuirla, usarla a scopo di lucro o riusarne il codice serve il permesso scritto dell'autore (${PH_INFO.mail}). Una donazione non cambia queste condizioni.</p>
    <details id="phLicDet"><summary class="ph-sub">Testo completo della licenza e delle librerie di terze parti</summary><pre class="ph-pre" id="phLicTxt">…</pre></details>
  </section>
  <section><h3>Crediti</h3>
    <div class="ph-cred">
      <p><b>Campi e piste</b>: OurAirports (pubblico dominio) e note del pilota.</p>
      <p><b>Mappe</b>: © OpenStreetMap contributors (ODbL); OpenTopoMap (CC BY-SA); World Imagery © Esri, Vantor, Earthstar Geographics; IGM 1:25.000 e ortofoto AGEA dal Geoportale Nazionale (CC BY-SA).</p>
      <p><b>Spazi aerei</b>: openAIP (CC BY-NC 4.0, www.openaip.net), quando li scarichi da lì; oppure il file OpenAir che carichi tu.</p>
      <p><b>Terreno</b>: Terrain Tiles su AWS Open Data (Mapzen, da SRTM, EU-DEM e altre fonti pubbliche).</p>
      <p><b>Meteo</b>: Open-Meteo (CC BY 4.0); METAR e TAF da aviationweather.gov (NOAA).</p>
      <p><b>Librerie</b>: Capacitor e i plugin Filesystem, Share, Keep Awake, Text to Speech (MIT); AndroidX (Apache 2.0). Segnalazioni via FormSubmit.</p>
      <p><b>Progetto</b>: HORIZON nasce dallo strumento di volo da 80 mm costruito per un Avid Flyer; oggi funziona con qualsiasi ultraleggero o aereo VFR (profili dei velivoli in Impostazioni).</p>
      <p><b>Privacy</b>: niente account, pubblicità o analisi; posizione e dati restano sul telefono. Informativa completa: <a href="https://github.com/amicoen-ops/HORIZON/blob/main/PRIVACY.md" target="_blank" rel="noopener">PRIVACY.md</a>.</p>
    </div>
  </section>
  ${b.channel==='play'?'':`<section class="ph-donate"><h3>Ti è utile?</h3>
    <p class="ph-sub">L'app è gratuita e senza pubblicità. Se vuoi contribuire alle spese (servizi, hardware per le prove), puoi offrire un caffè o quello che preferisci.</p>
    <a class="ph-btn ph-paypal" href="${PH_INFO.paypal}" target="_blank" rel="noopener">♥ Dona con PayPal</a>
  </section>`}`;
  el('phLicDet').ontoggle=async e=>{ const pre=el('phLicTxt'); if(!e.target.open || pre.dataset.ok) return;
    try{ const r=await fetch('LICENZE.txt'); pre.textContent=(await r.text()).replace(/([a-zà-ù0-9,;:'")])\n(?=[^\n\s])/g,'$1 ').replace(/([a-zà-ù0-9,;:'")])\n {2,}(?![a-z]\) )/g,'$1 '); pre.style.whiteSpace='pre-wrap'; pre.dataset.ok=1; }catch(_){ pre.textContent='Testo non disponibile: lo trovi nel file LICENSE del repository amicoen-ops/strumento-i-a517.'; } };
  try{ window.IA517_LIC&&IA517_LIC.infoWire(); }catch(e){}
  el('phWebCopy').onclick=async()=>{ try{ await navigator.clipboard.writeText(PH_INFO.web); toast('LINK COPIATO'); }catch(e){ prompt('Copia il link:',PH_INFO.web); } };
  el('phWebShare').onclick=async()=>{ const d={title:'HORIZON · strumento di volo',text:'HORIZON, strumento di volo per telefono, tablet e browser',url:PH_INFO.web};
    try{ if(PH.native&&PH.native.share){ await PH.native.share.share(d); return; } if(navigator.share){ await navigator.share(d); return; } }catch(e){ return; }
    try{ await navigator.clipboard.writeText(PH_INFO.web); toast('LINK COPIATO'); }catch(e){} };
  let kind='Problema';
  el('phRepKind').querySelectorAll('button').forEach(x=>x.onclick=()=>{ kind=x.dataset.k; el('phRepKind').querySelectorAll('button').forEach(y=>y.setAttribute('aria-pressed',y===x)); });
  el('phRepPre').textContent=PH.diag();
  const rep=()=>({kind,text:el('phRepText').value.trim(),reply:el('phRepMail').value.trim(),diag:el('phRepDiag').checked?PH.diag():'',t:Date.now()});
  el('phRepMailto').onclick=e=>{ e.currentTarget.href=PH.mailto(rep()); };
  el('phRepShare').onclick=()=>{ const r=rep(); if(r.text.length<5){ el('phRepMsg').textContent='Scrivi due righe su cosa è successo.'; return; } PH.shareReport(r); };
  el('phRepSend').onclick=async()=>{
    const r=rep(), m=el('phRepMsg');
    if(r.text.length<5){ m.textContent='Scrivi due righe su cosa è successo.'; return; }
    if(r.reply && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.reply)){ m.textContent='L\'email per la risposta non sembra valida.'; return; }
    el('phRepSend').disabled=true; m.textContent='Invio…';
    try{ await PH.sendReport(r); m.textContent='Inviata, grazie. '+(r.reply?'Ti risponderò a '+r.reply+'.':''); el('phRepText').value=''; }
    catch(e){ PH.act&&PH.act('segnalazione non partita: '+String(e&&e.message||e).slice(0,60));
      if(!navigator.onLine){ PH.reports.push(r); lsSet('ia517p_reports',PH.reports); m.textContent='Senza rete: resta in coda e parte da sola appena torna internet.'; }
      else { m.textContent='Il servizio di invio non ha risposto ('+String(e&&e.message||e).slice(0,80)+'). Scegli un\'app per inviarla: Gmail, WhatsApp, Telegram…';
        if(await PH.shareReport(r)) el('phRepText').value=''; } }
    finally{ el('phRepSend').disabled=false; }
  };
  if(el('phUpdGo')) el('phUpdGo').onclick=async()=>{ el('phUpd').innerHTML='<p class="ph-sub">Controllo…</p>'; el('phUpd').innerHTML=upHtml(await PH.checkUpdate(true)); upWire(); };
  upWire();
};
// donazione: invito nei primi 5 avvii (non nella versione del Play Store, che non permette donazioni nell'app)
PH.donateNag=function(){
  if(PH.version().channel==='play' || PH.version().line==='v2' || PH.imc || lsGet('ia517p_donated',false)) return;   // mai nella v2 di prova né in NUBE
  const n=PH.launchN||0; if(n<1 || n>5 || document.getElementById('phNag') || document.getElementById('phTerms')) return;
  if(PH.flight || PH.sim || (S.gpsReal && S.gs>25)) return;          // mai sopra lo strumento in volo o in movimento
  const d=document.createElement('div'); d.className='ph-sheet ph-terms'; d.id='phNag';
  d.innerHTML=`<div class="ph-imp"><section class="ph-donate"><h3>Ti piace HORIZON?</h3>
    <p>L'app è gratuita e senza pubblicità: è nata per volare più sicuri con quello che abbiamo in tasca.</p>
    <p class="ph-sub">Se ti è utile, puoi contribuire alle spese (servizi, hardware per le prove, tempo) con un caffè o quello che preferisci. Non cambia niente nell'app: è solo un grazie.</p>
    <a class="ph-btn ph-paypal" id="phNagPay" href="${PH_INFO.paypal}" target="_blank" rel="noopener">♥ Dona con PayPal</a>
    <div class="ph-btns" style="justify-content:center"><button class="ph-btn" id="phNagLater">Più tardi</button><button class="ph-btn" id="phNagDone">Ho già donato</button></div>
    <p class="ph-sub">${n<5?`Questo invito compare ancora ${5-n} ${5-n===1?'volta':'volte'} all'avvio, poi resta solo in Info.`:'È l\'ultima volta che compare all\'avvio: la donazione resta sempre in Info.'}</p></section></div>`;
  document.body.appendChild(d);
  const close=()=>d.remove();
  el('phNagLater').onclick=close;
  el('phNagDone').onclick=()=>{ lsSet('ia517p_donated',true); close(); toast('GRAZIE!'); };
  el('phNagPay').addEventListener('click',()=>{ PH.act&&PH.act('dona'); setTimeout(close,400); });
};
// avvio: avvertenze, storico versioni, controllo aggiornamenti a ogni avvio, coda segnalazioni
(function(){
  PH.versionHistory(); PH.launchN=(lsGet('ia517p_launches',0)|0)+1; lsSet('ia517p_launches',PH.launchN);
  PH.terms(); if(!document.getElementById('phTerms')) setTimeout(()=>PH.donateNag(),2500);
  setTimeout(()=>PH.checkUpdate(false),4000);                        // controllo della versione a ogni avvio
  addEventListener('online',()=>{ const u=lsGet('ia517p_update',null); if(!u||u.state==='offline'||u.state==='errore') PH.checkUpdate(false); });
  setTimeout(()=>PH.flushReports(),5000);
})();
