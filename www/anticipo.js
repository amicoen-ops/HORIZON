// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// IN ANTICIPO. Tre cose, tutte perché l'aereo non arrivi mai in una zona «da preparare»:
// 1. PRECALCOLO IN VOLO (niente rete in più: solo ciò che lo strumento chiederebbe comunque, chiesto prima). Da traccia, velocità,
//    virata in corso e rotta attiva si stima dove sarà l'aereo tra 20, 40 e 60 secondi. Nel tempo libero tra i fotogrammi si
//    preparano la griglia di riserva dell'orizzonte (terrAhead) e il rilievo successivo della mappa (rastAhead), e si chiedono
//    prima i riquadri del terreno e le tessere della mappa che mancano davanti. Se la previsione sbaglia vale il comportamento
//    di sempre. Il precalcolo non parte se un fotogramma è in arrivo: disegno e avvisi (che girano nel fotogramma) passano prima.
// 2. MEMORIA CHE TIENE IL DAVANTI: quando la memoria è piena si butta ciò che è alle spalle e lontano da traccia e rotta
//    (PH.demDrop, PH.tileDrop), e tra i riquadri in coda parte prima quello più vicino lungo la traccia (PH.demRank).
// 3. SCARICO AUTOMATICO A TERRA (mai in volo, mai domande): rotta salvata o DIRECT TO → terreno, mappa di base e prati lungo la
//    rotta; all'avvio la zona attorno a dove sei e la carta VFR se è uscito un ciclo AIRAC nuovo. Impostazioni › Scarico automatico.
//    Alla rete vanno solo riquadri (tessere, celle di 0,1°), mai la posizione esatta.
(function(){
'use strict';
const CFG={
  // --- precalcolo in volo ---
  anticipo:[20,40,60],  // s: dove sarà l'aereo (punti della previsione)
  virataMax:20,         // s: una virata in corso si prolunga al massimo per questo tempo…
  virataGradi:120,      // …e per questi gradi; poi dritto
  ventaglio:17000,      // m: attorno all'aereo e ai punti previsti tutto è «davanti» (l'orizzonte vede 15 km)
  dietro:6000,          // m: alle spalle dell'aereo si tiene solo questo
  rottaKm:60,           // km di rotta attiva tenuti in memoria davanti all'aereo
  rottaFascia:10000,    // m per lato lungo la rotta attiva
  fresco:20000,         // ms: un riquadro appena arrivato non si butta (qualcuno l'ha appena chiesto)
  fetta:6,              // ms al massimo per ogni pezzo di precalcolo
  // --- scarico automatico a terra ---
  fasciaKm:10,          // km per lato lungo la rotta
  capiKm:6,             // km attorno a partenza e arrivo per il dettaglio più fine della mappa (livello 13)
  passoKm:5,            // un punto ogni tanti km di rotta
  tettoMB:60,           // MB al massimo per uno scarico automatico di rotta o zona (terreno + mappa)
  pausaMappa:300,       // ms tra due tessere della mappa (OpenTopoMap, OpenStreetMap: server gratuiti, una richiesta alla volta)
  pausaDem:60,          // ms tra due riquadri del terreno (archivio pubblico AWS), due alla volta
  kbDem:90, kbMappa:35, // peso medio stimato di un riquadro del terreno e di una tessera (per dire i MB prima di partire)
  giorni:30,            // dopo questi giorni rotta e zona si ricontrollano (si scarica solo ciò che manca)
  avvio:20000,          // ms dopo l'avvio prima del primo scarico (GPS e rete devono farsi vivi)
  riprova:600000,       // ms di attesa dopo uno scarico andato male
  cartaOgni:864e5       // ms tra due tentativi per la carta VFR
};
const D2=Math.PI/180, MONDO=40075016.686;
const errLog=(dove,e)=>{ try{ PH.logErr&&PH.logErr('anticipo · '+dove+': '+String(e&&e.message||e)); }catch(e2){} };
const mercY=lat=>{ const r=lat*D2; return (1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2; };

// ================= 1. previsione =================
const PRV={ok:false,pts:[],uE:0,uN:1,dE:0,dN:0,dH:0,p:[],v:0,w:0,t:0};
let trkPrev=null, trkT=0, omega=0;
const posOk=()=>((S.gpsReal&&!lost('gps'))||!!PH.demo||!!PH.sim) && isFinite(S.lat+S.lon);
// avanza di d metri lungo una spezzata di punti {lat,lon}; rende posizione e prua
function lungo(P,d){
  for(let i=0;i<P.length-1;i++){ const a=P[i], b=P[i+1], cl=Math.cos(a.lat*D2), e=(b.lon-a.lon)*111320*cl, n=(b.lat-a.lat)*110540, L=Math.hypot(e,n);
    if(d<=L || i===P.length-2){ const f=L>1?Math.min(1,d/L):1; return {lat:a.lat+(b.lat-a.lat)*f,lon:a.lon+(b.lon-a.lon)*f,h:Math.atan2(e,n)}; }
    d-=L; }
  return {lat:P[0].lat,lon:P[0].lon,h:0}; }
function punto(lat,lon,h,r,rb,c){ const cl=Math.cos(lat*D2); return {lat,lon,u:(lon+180)/360,v:mercY(lat),m:MONDO*cl,r,rb,c,sE:Math.sin(h),sN:Math.cos(h)}; }
function prevedi(){
  const now=performance.now();
  if(!posOk()){ PRV.ok=false; trkPrev=null; return; }
  const trk=(S.trk!=null?S.trk:S.hdg)||0, warp=(S.auto&&PH.sim)?(+PH.sim.warp||1):(S.auto?4:1);   // nel volo simulato il tempo corre: conta la velocità vera a schermo
  if(trkPrev!=null && now-trkT<1500 && now>trkT){ let d=trk-trkPrev; d-=360*Math.round(d/360); const w=Math.max(-30,Math.min(30,d/((now-trkT)/1000))); omega+=(w-omega)*0.4; } else omega=0;
  trkPrev=trk; trkT=now;
  const v=Math.max(0,(+(S.gs!=null?S.gs:S.ias)||0)/3.6)*warp, h0=trk*D2, cl=Math.cos(S.lat*D2);
  PRV.v=v; PRV.w=omega; PRV.t=now;
  if(v<5){ PRV.ok=false; PRV.dE=PRV.dN=PRV.dH=0; return; }                // fermo o in rullaggio: niente previsione, tutto come prima
  // rotta attiva: destinazione e punti successivi (la prossima virata sta qui)
  let R=null;
  try{ if(NAV.dest && isFinite(NAV.dest.lat+NAV.dest.lon)){ R=[{lat:S.lat,lon:S.lon},{lat:+NAV.dest.lat,lon:+NAV.dest.lon}];
      if(NAV.route&&NAV.route.r&&Array.isArray(NAV.route.r.wps)) for(let i=(NAV.route.idx|0)+1;i<NAV.route.r.wps.length;i++){ const w=NAV.route.r.wps[i]; if(isFinite(+w.lat+ +w.lon)) R.push({lat:+w.lat,lon:+w.lon}); } } }catch(e){ R=null; }
  let segue=false;
  if(R && Math.abs(omega)<1.5){ const e=(R[1].lon-S.lon)*111320*cl, n=(R[1].lat-S.lat)*110540; let d=Math.atan2(e,n)-h0; d-=2*Math.PI*Math.round(d/(2*Math.PI)); segue=Math.abs(d)<35*D2 || Math.hypot(e,n)<v*8; }
  const pts=[punto(S.lat,S.lon,h0,Math.max(CFG.ventaglio,mappaVista()?MR.half*1.1:0),CFG.dietro,0)], p=[];
  for(const t of CFG.anticipo){ let q;
    if(segue) q=lungo(R,v*t);
    else { let la=S.lat, lo=S.lon, h=h0, acc=0;                              // dritto, o lungo la virata in corso
      for(let s=0;s<t;s+=2.5){ if(s<CFG.virataMax && Math.abs(acc)<CFG.virataGradi){ const dh=omega*2.5; acc+=dh; h+=dh*D2; } la+=v*2.5*Math.cos(h)/110540; lo+=v*2.5*Math.sin(h)/(111320*cl); }
      q={lat:la,lon:lo,h}; }
    p.push(q); pts.push(punto(q.lat,q.lon,q.h,CFG.ventaglio,CFG.ventaglio,0)); }
  if(R){ for(let d=8000;d<=CFG.rottaKm*1000;d+=8000){ const q=lungo(R,d); pts.push(punto(q.lat,q.lon,q.h,CFG.rottaFascia,CFG.rottaFascia,5000)); } }
  const m=p[1]||p[0], e=(m.lon-S.lon)*111320*cl, n=(m.lat-S.lat)*110540, L=Math.hypot(e,n);
  PRV.uE=L>1?e/L:Math.sin(h0); PRV.uN=L>1?n/L:Math.cos(h0);
  const d=Math.min(150,v*0.3); PRV.dE=d*Math.sin(h0); PRV.dN=d*Math.cos(h0); PRV.dH=Math.max(-0.1,Math.min(0.1,omega*0.3*D2));
  PRV.pts=pts; PRV.p=p; PRV.ok=true;
}
const mappaVista=()=>{ try{ return performance.now()-(MR.seen||0)<2000 && MR.half>0; }catch(e){ return false; } };
const terrVista=()=>{ try{ return performance.now()-(TG.seen||0)<2000; }catch(e){ return false; } };
// quanto serve un riquadro (z,x,y): 0 = sotto l'aereo o nel ventaglio davanti; più alto = più lontano da traccia e rotta (metri).
// A parità vince chi è più vicino a dove l'aereo sarà tra 40 s. −1 = non si sa (a terra, posizione non nota).
function rango(z,x,y){
  if(!PRV.ok) return -1;
  const n=2**z, P=PRV.pts; let best=Infinity, d1=0;
  for(let i=0;i<P.length;i++){ const p=P[i], fx=p.u*n, fy=p.v*n, nx=fx<x?x:(fx>x+1?x+1:fx), ny=fy<y?y:(fy>y+1?y+1:fy);
    const dE=(nx-fx)/n*p.m, dN=(fy-ny)/n*p.m, d=Math.hypot(dE,dN), r=(d>0 && dE*p.sE+dN*p.sN<0)?p.rb:p.r, k=Math.max(0,d-r)+p.c;
    if(k<best) best=k; if(i===Math.min(2,P.length-1)) d1=d; }
  return best+d1*0.01; }
PH.demRank=rango;
PH.demDrop=function(){
  if(!PRV.ok) return null;
  const now=Date.now(); let wk=null, wr=-1;
  for(const k of PH.dem.keys()){ if(now-(PH.demT.get(k)||0)<CFG.fresco) continue; const a=k.split('/'), r=rango(+a[0],+a[1],+a[2]); if(r>wr){ wr=r; wk=k; } }
  return wk; };
PH.tileDrop=function(){
  const V=PH.baseV, now=Date.now(); let wk=null, wr=-1;
  for(const [k,T] of PH.tiles){ if(T.z==null) return k;
    if(T.b!==PH.base || (V && T.z!==V.z)){ if(now-T.t>3000) return k; continue; }   // altra mappa o altro zoom: via per prima
    if(!PRV.ok || now-T.t<CFG.fresco) continue;
    const r=rango(T.z,T.x,T.y); if(r>wr){ wr=r; wk=k; } }
  return wk; };

// ---- richieste in anticipo: i riquadri e le tessere che lo strumento chiederebbe tra poco ----
function chiedi(){
  if(!PRV.ok || document.hidden) return;
  const cl=Math.cos(S.lat*D2), til=(lat,lon,z)=>{ const n=2**z; return [Math.floor((lon+180)/360*n),Math.floor(mercY(lat)*n)]; };
  if(terrVista()){                                               // orizzonte: il ventaglio di 15 km dai punti previsti
    for(const q of PRV.p) for(const r of [5000,10000,15000]) for(const a of [-60,-30,0,30,60]){ const h=q.h+a*D2, t=til(q.lat+r*Math.cos(h)/110540,q.lon+r*Math.sin(h)/(111320*cl),11); phDemFetch(11,t[0],t[1]); } }
  if(mappaVista() && !PH.pan){                                   // mappa: il quadrato del rilievo e le tessere, spostati dove sarà l'aereo
    const km=ZOOMS[zi], z=km>=250?7:(km>=90?8:(km>=30?9:(km>=15?10:(km<=3?12:11)))), q=PRV.p[PRV.p.length-1], hf=MR.half;
    const a=til(q.lat+hf/110540,q.lon-hf/(111320*cl),z), b=til(q.lat-hf/110540,q.lon+hf/(111320*cl),z);
    if((b[0]-a[0]+1)*(b[1]-a[1]+1)<=40) for(let x=a[0];x<=b[0];x++) for(let y=a[1];y<=b[1];y++) phDemFetch(z,x,y);
    if(typeof phTilesAhead==='function') for(const p of PRV.p) phTilesAhead(p.lat-S.lat,p.lon-S.lon,4); }
}
// ---- tempo libero tra i fotogrammi ----
const SPENTO={terr:false,rast:false};
const ric=window.requestIdleCallback?cb=>window.requestIdleCallback(cb,{timeout:400}):cb=>setTimeout(()=>{ const t=performance.now(); cb({didTimeout:false,timeRemaining:()=>Math.max(0,4-(performance.now()-t))}); },50);
function libero(dl){
  ric(libero);
  try{
    if(document.hidden || dl.didTimeout) return;                 // nessun tempo libero: non si toglie niente al disegno
    const t0=performance.now(), P=PH.perf||{}, alProssimo=(P.lastDraw||0)+1000/(PH.fps||30)-3-t0;   // ms al prossimo fotogramma da disegnare
    const spazio=Math.min(CFG.fetta,dl.timeRemaining(),alProssimo); if(!(spazio>1)) return;
    const left=()=>spazio-(performance.now()-t0);
    if(!SPENTO.terr && typeof terrAhead==='function'){ try{ terrAhead(left,PRV.dE,PRV.dN,PRV.dH); }catch(e){ SPENTO.terr=true; errLog('griglia dell\'orizzonte',e); } }
    if(!SPENTO.rast && PRV.ok && left()>1 && typeof rastAhead==='function'){ try{ rastAhead(left,PRV.uE,PRV.uN); }catch(e){ SPENTO.rast=true; try{ MR.job=null; PH.demZ=11; }catch(e2){} errLog('rilievo della mappa',e); } }
  }catch(e){}
}
ric(libero);
let giriP=0;
setInterval(()=>{ try{ prevedi(); if((++giriP&1)===0) chiedi(); }catch(e){ if(!SPENTO.prev){ SPENTO.prev=true; errLog('previsione',e); } } },500);
PH.anticipo={CFG,PRV,rango,spento:SPENTO};

// ================= 3. scarico automatico a terra =================
const KEY='ia517p_autodl', KEY_F='ia517p_autodl_fatti', KEY_C='ia517p_autodl_carta';
const AD={cfg:Object.assign({zona:'sempre',carta:'wifi'},lsGet(KEY,{})||{}), job:null, coda:[], poi:0, fatti:lsGet(KEY_F,{})||{}, prove:{}, log:[], t0:Date.now(), ultimo:''};
for(const k of ['zona','carta']) if(!['sempre','wifi','mai'].includes(AD.cfg[k])) AD.cfg[k]=k==='zona'?'sempre':'wifi';
const nota=m=>{ AD.log.push(new Date().toTimeString().slice(0,8)+' '+m); if(AD.log.length>30) AD.log.shift(); };
// tipo di rete: dal telefono (StatoTelefono) o dal browser; se non si sa vale come rete mobile
const reteTipo=()=>{ try{ return PH.stato&&PH.stato.rete==='WIFI'?'wifi':'mobile'; }catch(e){ return 'mobile'; } };
const inRete=()=>{ try{ return navigator.onLine && !(PH.stato&&PH.stato.internet===false); }catch(e){ return false; } };
const permesso=k=>{ const v=AD.cfg[k]; return v==='sempre' || (v==='wifi' && reteTipo()==='wifi'); };
// a terra davvero: né volo dimostrativo o simulato, né in volo per diario o avvisi, né in corsa
const aTerra=()=>{ try{ return !PH.demo && !PH.sim && !PH_air() && !(PH.inVolo&&PH.inVolo()) && !((+S.gs||0)>=15); }catch(e){ return false; } };
const firma=(tipo,P)=>{ const s=tipo+'|'+PH.base+'|'+P.map(p=>(+p.lat).toFixed(2)+','+(+p.lon).toFixed(2)).join(';'); let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))|0; return tipo+(h>>>0).toString(36); };
const fatto=sig=>Date.now()-(AD.fatti[sig]||0)<CFG.giorni*864e5;
function segna(sig){ AD.fatti[sig]=Date.now(); const ks=Object.keys(AD.fatti).sort((a,b)=>AD.fatti[a]-AD.fatti[b]); while(ks.length>40) delete AD.fatti[ks.shift()]; lsSet(KEY_F,AD.fatti); }
// punti lungo la rotta, uno ogni passoKm; «capo» = partenza e arrivo
function campiona(P){
  const out=[]; P=P.filter(p=>p&&isFinite(+p.lat+ +p.lon)).map(p=>({lat:+p.lat,lon:+p.lon})); if(!P.length) return out;
  for(let i=0;i<P.length-1;i++){ const a=P[i], b=P[i+1], km=Math.hypot((b.lat-a.lat)*110.54,(b.lon-a.lon)*111.32*Math.cos(a.lat*D2)), n=Math.max(1,Math.ceil(km/CFG.passoKm));
    for(let j=0;j<n;j++) out.push({lat:a.lat+(b.lat-a.lat)*j/n,lon:a.lon+(b.lon-a.lon)*j/n}); }
  out.push(P[P.length-1]); out[0].capo=true; out[out.length-1].capo=true; return out.slice(0,400); }
// la mappa di base si scarica solo se è una di quelle che il telefono sa tenere da parte (sw.js): OpenTopoMap, OpenStreetMap
function mappaTenuta(){ try{ const bd=PH.baseDef(); if(PH.base==='dem'||bd.local||bd.wms||bd.key) return false; return /tile\.opentopomap\.org$|tile\.openstreetmap\.org$/.test(new URL(PH.tileUrl(10,535,365,bd)).hostname); }catch(e){ return false; } }
const R_ROTTA={dem:{7:60,8:40,9:25,10:15,11:12}, map:(z,c)=>z<=9?15:(z<=12?CFG.fasciaKm:(c.capo?CFG.capiKm:0))};
const R_ZONA={dem:{7:250,8:150,9:100,10:60,11:40}, map:z=>z<=9?60:(z<=11?30:(z===12?12:6))};
function accoda(tipo,nome,P){
  try{ const centri=tipo==='zona'?P:campiona(P); if(!centri.length) return false; const sig=firma(tipo,tipo==='zona'?[{lat:(+P[0].lat).toFixed(1),lon:(+P[0].lon).toFixed(1)}]:P);
    if(fatto(sig) || (AD.job&&AD.job.sig===sig) || AD.coda.some(j=>j.sig===sig) || (AD.prove[sig]||0)>=3) return false;
    AD.coda.push({tipo,nome:String(nome||'').toUpperCase().slice(0,24),centri,sig}); if(AD.coda.length>5) AD.coda.shift(); return true; }catch(e){ return false; } }
async function esegui(job){
  AD.job=job; job.kb=0; job.mb=0; job.fase='conto'; AD.prove[job.sig]=(AD.prove[job.sig]||0)+1;
  const ctl=typeof AbortController!=='undefined'?new AbortController():null; job.ctl=ctl;
  const stop=()=>!!job.ferma || !aTerra() || !permesso('zona') || !inRete();
  const RR=job.tipo==='zona'?R_ZONA:R_ROTTA, mOk=mappaTenuta();
  const oD={centri:job.centri,raggio:(z,c)=>RR.dem[z]||0,cache:true}, oM={centri:job.centri,raggio:(z,c)=>RR.map(z,c),cache:true};
  let esito='finito';
  try{
    if(job.tipo==='rotta' && PH.pratiZona){ try{ PH.pratiZona(job.centri.filter((c,i)=>i%2===0||c.capo)); }catch(e){} }   // i prati li scarica atterraggi.js, un riquadro ogni 6 s
    const nD=(await PH.prefetch('dem',null,Object.assign({conta:true},oD))).n, nM=mOk?(await PH.prefetch('map',null,Object.assign({conta:true},oM))).n:0;
    if(stop()){ esito='fermato'; return; }
    if(!nD && !nM){ segna(job.sig); esito='già sul telefono'; return; }
    const tetto=CFG.tettoMB*1024; job.mb=Math.min(CFG.tettoMB,(nD*CFG.kbDem+nM*CFG.kbMappa)/1024);
    toastShow(`SCARICO IN SOTTOFONDO · ${job.nome} · CIRCA ${Math.max(1,Math.round(job.mb))} MB`);   // senza voce: è solo un'informazione
    nota(`parte ${job.nome}: terreno ${nD}, mappa ${nM}, circa ${job.mb.toFixed(1)} MB`);
    let kb0=0, fatti=0, buoni=0, rete=0;
    job.fase='terreno';
    const a=await PH.prefetch('dem',(d,t,ok,kb,st)=>{ job.kb=kb; if(st) job.circa=true; },Object.assign({pausa:CFG.pausaDem,par:2,tettoKB:tetto,stop,kb:CFG.kbDem,signal:ctl&&ctl.signal},oD));
    kb0=a.kb||0; fatti+=a.done; buoni+=a.ok; rete+=a.rete||0;
    if(mOk && !stop() && kb0<tetto){ job.fase='mappa';
      const b=await PH.prefetch('map',(d,t,ok,kb,st)=>{ job.kb=kb0+kb; if(st) job.circa=true; },Object.assign({pausa:CFG.pausaMappa,par:1,tettoKB:tetto-kb0,stop,kb:CFG.kbMappa,signal:ctl&&ctl.signal},oM));
      kb0+=b.kb||0; fatti+=b.done; buoni+=b.ok; rete+=b.rete||0; }
    job.kb=kb0;
    if(stop()){ esito=aTerra()?'fermato':'fermato: decollo'; return; }
    if(fatti && buoni<fatti*0.7){ esito='rete o servizio non raggiungibile'; AD.poi=Date.now()+CFG.riprova; return; }
    segna(job.sig); esito=kb0>=tetto?`tetto di ${CFG.tettoMB} MB raggiunto`:'finito';
    if(aTerra()) toastShow(`SCARICO FINITO · ${job.nome} · ${Math.max(1,Math.round(kb0/1024))} MB`);
  }catch(e){ esito='errore: '+String(e&&e.message||e).slice(0,60); AD.poi=Date.now()+CFG.riprova; }
  finally{ AD.ultimo=`${job.nome}: ${esito} · ${(job.kb/1024).toFixed(1)} MB`; nota(AD.ultimo); chiusa(job,esito); AD.job=null; }
}
// fine di uno scarico: per qualche secondo la riga di stato e Impostazioni dicono com'è andata («fatto · 13 MB», o il motivo in giallo)
function chiusa(job,esito){ try{ if(job.fase==='conto'){ AD.fine=null; return; }                      // niente da scaricare: niente da dire
    const bene=/^(finito|tetto|scaricata)/.test(esito), decollo=/decollo/.test(esito);
    AD.fine=decollo?null:{tipo:job.tipo,nome:job.nome,kb:job.kb,mb:job.mb,circa:!!job.circa,err:bene?'':esito.replace(/^errore: /,'').replace('rete o servizio non','rete non'),t:Date.now()}; }catch(e){ AD.fine=null; } }
async function carta(){
  if(!PH.cartaPuo || !PH.cartaScarica || !PH.airac) return false;
  if(PH.carta && String(PH.carta.version)===PH.airac(0)) return false;          // quella del ciclo in corso c'è già
  if(Date.now()-(+lsGet(KEY_C,0)||0)<CFG.cartaOgni) return false;               // un tentativo al giorno: il ciclo nuovo può non essere ancora pubblicato
  lsSet(KEY_C,Date.now());
  const job=AD.job={tipo:'carta',nome:'CARTA VFR',sig:'carta',kb:0,mb:105,fase:'carta'};
  toastShow('SCARICO IN SOTTOFONDO · CARTA VFR · CIRCA 105 MB'); nota('parte la carta VFR');
  let ok=false;
  try{ ok=await PH.cartaScarica((d,t)=>{ job.kb=d/1024; if(t>0) job.mb=t/1048576; },true); }catch(e){}
  finally{ AD.ultimo='CARTA VFR: '+(ok?'scaricata':'non riuscita, riprovo domani'); nota(AD.ultimo); chiusa(job,ok?'scaricata':(PH.cartaErr||'non riuscita')+' · riprovo domani'); AD.job=null; }
  return true; }
// ogni 5 s, solo a terra e con la rete: una cosa alla volta
function giro(){
  if(AD.job || Date.now()-AD.t0<CFG.avvio || Date.now()<AD.poi) return;
  if(!aTerra() || !inRete()) return;
  if(PH.native && !(PH.stato&&PH.stato.t)) return;                              // nell'app: prima si aspetta di sapere che rete c'è
  if(permesso('zona')){
    // rotta attiva o DIRECT TO fatti a terra
    try{ if(NAV.route&&NAV.route.r&&Array.isArray(NAV.route.r.wps)&&NAV.route.r.wps.length>1) accoda('rotta',NAV.route.r.name||'ROTTA',NAV.route.r.wps);
      else if(NAV.dest && isFinite(NAV.dest.lat+NAV.dest.lon)){ const da=(S.gpsReal&&!lost('gps'))?{lat:S.lat,lon:S.lon}:NAV.from; if(da&&isFinite(da.lat+da.lon)) accoda('rotta','DIRECT '+(NAV.dest.short||''),[da,NAV.dest]); } }catch(e){}
    // zona attorno a dove sei (serve un fix vero)
    try{ if(!AD.coda.length && S.gpsReal && !lost('gps') && isFinite(S.lat+S.lon)) accoda('zona','ZONA',[{lat:S.lat,lon:S.lon}]); }catch(e){}
    const j=AD.coda.shift(); if(j){ esegui(j); return; } }
  else AD.coda.length=0;
  if(permesso('carta')) carta().catch(()=>{ AD.job=null; });
}
setInterval(()=>{ try{ giro(); }catch(e){ errLog('scarico automatico',e); } },5000);
// decollo (o impostazione cambiata, o rete persa): stop subito, anche della richiesta in corso
setInterval(()=>{ try{ const j=AD.job; if(j && j.tipo!=='carta' && (!aTerra() || !permesso('zona'))){ j.ferma=true; j.ctl&&j.ctl.abort(); } }catch(e){} },1000);
// rotta salvata dal Piano o dallo strumento, a terra: va in coda
function salvata(r){ try{ if(r && Array.isArray(r.wps) && r.wps.length>1 && aTerra() && permesso('zona')) accoda('rotta',r.name||'ROTTA',r.wps); }catch(e){} }
if(PH.handle){ const h0=PH.handle; PH.handle=function(m,p,b){ const r=h0.apply(this,arguments); try{ if(m==='POST' && p==='/api/routes') salvata(r&&r.route); else if(m==='POST' && p==='/api/plan') salvata(b&&b.route); }catch(e){} return r; }; }
if(PH.fromPfd){ const f0=PH.fromPfd; PH.fromPfd=function(o){ try{ if(o&&o.t==='route') salvata(o.r); }catch(e){} return f0.apply(this,arguments); }; }
// riga di stato: cosa si sta scaricando e quanti MB, con la barretta sottile dentro l'etichetta (PH.dlCss). La barretta e
// l'esito («FATTO 13 MB», o il motivo in giallo) solo a terra: in volo lo scarico è già fermo e non deve comparire niente di nuovo.
const TIPO={carta:'CARTA',zona:'ZONA',rotta:'ROTTA'};
// stato per PH.dlBar/PH.dlHtml: il totale di rotta e zona è una stima (media per riquadro), quello della carta è il peso vero
const perBarra=j=>({testo:j.nome,mb:j.kb/1024,mbTot:Math.max(j.mb,j.kb/1024),circa:j.tipo!=='carta'});
if(PH.statoHtml){ const s0=PH.statoHtml; PH.statoHtml=function(){ let h=s0.apply(this,arguments);
    try{ const j=AD.job, f=AD.fine, giu=aTerra(), bar=p=>`<span class="hz-dl-b"><b style="width:${Math.round(Math.max(0,Math.min(1,p))*50)*2}%"></b></span>`;   // a passi del 2%: la riga non si riscrive a ogni byte
      if(j && j.fase!=='conto') h+=`<i class="o${giu?' hz-dlk':''}">⬇ ${TIPO[j.tipo]||'ROTTA'} ${Math.round(j.kb/1024)}/${Math.max(1,Math.round(Math.max(j.mb,j.kb/1024)))} MB${giu?bar(j.kb/1024/Math.max(j.mb,0.1)):''}</i>`;   // la stima può essere scarsa: il totale non resta mai sotto lo scaricato
      else if(f && giu && Date.now()-f.t<(f.err?8000:4000)) h+=f.err?`<i class="w hz-dlk">⬇ ${TIPO[f.tipo]||''} ${PH.esc(f.err.toUpperCase().slice(0,28))}${bar(f.kb/1024/Math.max(f.mb,0.1))}</i>`
        :`<i class="o hz-dlk">⬇ ${TIPO[f.tipo]||''} FATTO · ${PH.dlMb(f.kb/1024)} MB${bar(1)}</i>`;
    }catch(e){} return h; }; }
PH.autoDl={cfg:AD.cfg,CFG,permesso,aTerra,reteTipo,
  stato:()=>({job:AD.job?{tipo:AD.job.tipo,nome:AD.job.nome,fase:AD.job.fase,kb:AD.job.kb,mb:AD.job.mb}:null,coda:AD.coda.length,ultimo:AD.ultimo,log:AD.log.slice(),rete:reteTipo(),aTerra:aTerra()}),
  set(k,v){ if(!['zona','carta'].includes(k)||!['sempre','wifi','mai'].includes(v)) return; AD.cfg[k]=v; lsSet(KEY,AD.cfg); },
  ferma(){ const j=AD.job; if(j){ j.ferma=true; try{ j.ctl&&j.ctl.abort(); }catch(e){} } AD.coda.length=0; }};
// Impostazioni › Scarico automatico: le due scelte e lo stato
if(PH.renderImp){ const orig=PH.renderImp; PH.renderImp=function(){ orig.apply(this,arguments);
  try{ for(const [id,k] of [['phAdZ','zona'],['phAdC','carta']]){ const box=document.getElementById(id); if(!box) continue;
      box.querySelectorAll('button').forEach(b=>{ b.setAttribute('aria-pressed',String(AD.cfg[k]===b.dataset.v));
        b.onclick=()=>{ PH.autoDl.set(k,b.dataset.v); box.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b))); msg(); }; }); }
    const msg=()=>{ const m=document.getElementById('phAdMsg'); if(!m) return; const j=AD.job;
      m.textContent=`Adesso: ${reteTipo()==='wifi'?'Wi-Fi':'rete mobile (o non riconosciuta)'} · ${aTerra()?'a terra':'in volo o in simulazione: nessuno scarico'}`+
        (j?` · scarico in corso: ${j.nome}`:(AD.ultimo?' · ultimo: '+AD.ultimo:''))+(PH.cartaPuo?'':' · carta VFR: non disponibile in questo browser'); barra(); };
    // la stessa barretta degli altri scarichi, sotto la riga; segue lo scarico due volte al secondo
    let bar=null, vista=false;
    const barra=()=>{ try{ const m=document.getElementById('phAdMsg'); if(!m||!PH.dlBar) return; if(!bar||!bar.isConnected){ bar=document.createElement('div'); bar.id='phAdBar'; m.after(bar); }
      const j=AD.job, f=AD.fine;
      if(j && j.fase!=='conto'){ PH.dlBar(bar,perBarra(j)); vista=true; }
      else if(vista){ vista=false; if(f&&f.err) PH.dlBar(bar,{testo:f.nome,err:f.err,mb:f.kb/1024,circa:f.circa}); else if(f) PH.dlBar(bar,{testo:f.nome,fine:true,mb:f.kb/1024,circa:f.circa}); else PH.dlBar(bar,null); } }catch(e){} };
    const tb=setInterval(()=>{ if(!document.getElementById('phAdMsg')){ clearInterval(tb); return; } barra(); },500);
    msg(); const tm=setInterval(()=>{ if(!document.getElementById('phAdMsg')){ clearInterval(tm); return; } try{ msg(); }catch(e){} },3000);
  }catch(e){} }; }
})();
