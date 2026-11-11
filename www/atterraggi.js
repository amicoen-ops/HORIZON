// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// PRATI PER L'ATTERRAGGIO FUORI CAMPO, dentro la zona di planata.
// · Dati: OpenStreetMap (© contributori OpenStreetMap, ODbL) tramite Overpass, a riquadri di 0,1° × 0,1°: alla rete va solo
//   il riquadro, mai la posizione esatta. Aree adatte (prati, coltivi, erba, campi di volo) e da evitare (paesi, zone
//   industriali, boschi, acqua, linee elettriche). Restano sul telefono (IndexedDB «horizon-prati», al massimo CFG.tetto riquadri).
// · Scarico: da solo e in sottofondo soltanto a terra e con la rete (attorno alla posizione e lungo la rotta attiva), un
//   riquadro alla volta con una pausa; in volo solo se manca del tutto il riquadro sotto l'aereo, al massimo uno al minuto.
//   Mai una domanda al pilota. Se la rete non risponde si aspetta sempre di più: nessuna raffica.
// · Scelta: per ogni area adatta nella zona di planata la striscia dritta più lunga (larga CFG.larg), meglio controvento;
//   si scarta se è corta, in pendenza, dentro o attaccata a un paese, attraversata da una linea elettrica (anche sul finale),
//   o se non ci si arriva con le regole dei campi (PH.glideArr di emergenza.js). Un punteggio tiene i migliori.
// · È un'indicazione dalle mappe, non una pista: coltura, fossi, recinti, fili non segnati si vedono solo dall'alto.
// Tutto il lavoro pesante è a pezzi di pochi millisecondi, fuori dal disegno: il fotogramma disegna solo forme già pronte.
(function(){
'use strict';
// ---- scelte numeriche: si cambiano qui ----
const CFG={
  cella:0.1,            // lato del riquadro in gradi
  giorni:30,            // dopo questi giorni il riquadro si riscarica alla prima occasione (a terra); intanto vale quello vecchio
  tetto:120,            // riquadri tenuti sul telefono: oltre, via i più vecchi
  mem:40,               // riquadri tenuti aperti in memoria
  pausa:6000,           // ms tra due richieste a terra
  pausaVolo:60000,      // ms tra due richieste in volo (solo il riquadro sotto l'aereo, se manca)
  tout:30000,           // ms di attesa della risposta
  lmin:250,             // m: striscia utile minima
  lbuona:500,           // m: oltre questa lunghezza il punteggio non cresce più
  larg:30,              // m: larghezza della striscia
  bordo:10,             // m tolti a ogni estremità (siepi, fossi sul bordo)
  areaMin:8000,         // m²: aree adatte più piccole non si salvano
  pendMax:4,            // gradi lungo la striscia: sopra si scarta
  pendTrasv:6,          // gradi di traverso: sopra si scarta
  linNo:30,             // m: linea elettrica più vicina di così alla striscia = scartata
  linAvv:50,            // m: linea elettrica più vicina di così al finale = quel verso di atterraggio è scartato
  finale:300,           // m di finale controllati prima della soglia
  linVicina:80,         // m: sotto, nota «linea elettrica vicina» e punteggio più basso
  caseVicine:100,       // m dal paese: sotto, nota «case vicine»
  alberi:40,            // m dal bosco: sotto, nota «alberi vicini»
  distanti:500,         // m minimi tra due prati mostrati
  quanti:8,             // prati tenuti
  ogni:3000,            // ms tra due scelte
  maxCand:400           // aree esaminate per volta (le più vicine)
};
const URL_OP='https://overpass-api.de/api/interpreter';
const KEY_I='ia517p_prati_idx';
const CO=Math.cos(ORIGIN.lat*D2R), M_LAT=110540, M_LON=111320;
const lat2N=N=>ORIGIN.lat+N/M_LAT, lon2E=E=>ORIGIN.lon+E/(M_LON*CO);
const quota=(E,N)=>phDemAt(lat2N(N),lon2E(E),11);                 // rilievo fine (z11) se c'è, altrimenti il meglio che c'è
const ora=()=>performance.now();

// ---- riquadri: chiave, elenco sul telefono, memoria ----
const chiave=(lat,lon)=>Math.floor(lat/CFG.cella+1e-9)+'_'+Math.floor(lon/CFG.cella+1e-9);
const bordi=k=>{ const [a,b]=k.split('_').map(Number); return [a*CFG.cella,b*CFG.cella,(a+1)*CFG.cella,(b+1)*CFG.cella].map(v=>v.toFixed(1)); };
let IDX=lsGet(KEY_I,{}); if(!IDX||typeof IDX!=='object'||Array.isArray(IDX)) IDX={};
const MEM=new Map();                                              // chiave → riquadro aperto (geometria in metri)
let GEN=0;                                                        // cambia quando arrivano dati: i conti fatti sui vicini si rifanno
let dbP=null;
function db(){ if(dbP) return dbP; dbP=new Promise(res=>{ try{ const r=indexedDB.open('horizon-prati',1);
    r.onupgradeneeded=()=>r.result.createObjectStore('t',{keyPath:'k'}); r.onsuccess=()=>res(r.result); r.onerror=()=>res(null); r.onblocked=()=>res(null); }catch(e){ res(null); } }); return dbP; }
async function dbGet(k){ const d=await db(); if(!d) return null; return new Promise(res=>{ try{ const q=d.transaction('t').objectStore('t').get(k); q.onsuccess=()=>res(q.result||null); q.onerror=()=>res(null); }catch(e){ res(null); } }); }
async function dbPut(rec){ const d=await db(); if(!d) return false; return new Promise(res=>{ try{ const tx=d.transaction('t','readwrite'); tx.objectStore('t').put(rec); tx.oncomplete=()=>res(true); tx.onerror=tx.onabort=()=>res(false); }catch(e){ res(false); } }); }
async function dbDel(k){ const d=await db(); if(!d) return; return new Promise(res=>{ try{ const tx=d.transaction('t','readwrite'); tx.objectStore('t').delete(k); tx.oncomplete=tx.onerror=tx.onabort=()=>res(); }catch(e){ res(); } }); }
async function tetto(){ const ks=Object.keys(IDX).sort((a,b)=>IDX[a]-IDX[b]);
  while(ks.length>CFG.tetto){ const k=ks.shift(); delete IDX[k]; MEM.delete(k); await dbDel(k); } lsSet(KEY_I,IDX); }

// ---- geometria ----
function pip(x,y,X,Y){ let c=false; for(let i=0,j=X.length-1;i<X.length;j=i++){ if((Y[i]>y)!==(Y[j]>y) && x<(X[j]-X[i])*(y-Y[i])/(Y[j]-Y[i])+X[i]) c=!c; } return c; }
function dPS(px,py,ax,ay,bx,by){ const dx=bx-ax, dy=by-ay, l=dx*dx+dy*dy; let t=l?((px-ax)*dx+(py-ay)*dy)/l:0; t=t<0?0:(t>1?1:t); return Math.hypot(px-ax-t*dx,py-ay-t*dy); }
function dSS(ax,ay,bx,by,cx,cy,dx,dy){                            // distanza tra due segmenti (0 se si incrociano)
  const o=(px,py,qx,qy,rx,ry)=>(qx-px)*(ry-py)-(qy-py)*(rx-px), d1=o(cx,cy,dx,dy,ax,ay), d2=o(cx,cy,dx,dy,bx,by), d3=o(ax,ay,bx,by,cx,cy), d4=o(ax,ay,bx,by,dx,dy);
  if(((d1>0&&d2<0)||(d1<0&&d2>0))&&((d3>0&&d4<0)||(d3<0&&d4>0))) return 0;
  return Math.min(dPS(ax,ay,cx,cy,dx,dy),dPS(bx,by,cx,cy,dx,dy),dPS(cx,cy,ax,ay,bx,by),dPS(dx,dy,ax,ay,bx,by)); }
// meno punti (Douglas-Peucker, tolleranza in metri) su una lista [lat,lon]
function semplifica(P,tol){
  if(P.length<4) return P; const c=Math.cos(P[0][0]*D2R), X=P.map(p=>(p[1]-P[0][1])*M_LON*c), Y=P.map(p=>(p[0]-P[0][0])*M_LAT);
  const tieni=new Uint8Array(P.length), pila=[[0,P.length-1]]; tieni[0]=tieni[P.length-1]=1;
  while(pila.length){ const [a,b]=pila.pop(); let m=-1, dm=tol; for(let i=a+1;i<b;i++){ const d=dPS(X[i],Y[i],X[a],Y[a],X[b],Y[b]); if(d>dm){ dm=d; m=i; } }
    if(m>0){ tieni[m]=1; pila.push([a,m],[m,b]); } }
  return P.filter((p,i)=>tieni[i]); }
function areaLL(P){ const c=Math.cos(P[0][0]*D2R); let s=0; for(let i=0,j=P.length-1;i<P.length;j=i++) s+=(P[j][1]-P[0][1])*M_LON*c*(P[i][0]-P[0][0])*M_LAT-(P[i][1]-P[0][1])*M_LON*c*(P[j][0]-P[0][0])*M_LAT; return Math.abs(s)/2; }
const pacco=P=>{ const o=[]; for(const p of P) o.push(Math.round(p[0]*1e5),Math.round(p[1]*1e5)); return o; };

// ---- dalla risposta di Overpass al riquadro da salvare ----
// m = prato/coltivo/erba, v = campo di volo, p = paese o capannoni, b = bosco, a = acqua
function classe(g){
  if(/^(residential|industrial|commercial|retail)$/.test(g.landuse||'')) return 'p';
  if(g.landuse==='forest'||g.natural==='wood') return 'b';
  if(g.natural==='water') return 'a';
  if(/^(aerodrome|airstrip)$/.test(g.aeroway||'')) return 'v';
  if(/^(meadow|farmland|grass)$/.test(g.landuse||'')||g.natural==='grassland') return /rice/i.test(g.crop||'')?'':'m';   // le risaie sono allagate
  return ''; }
async function leggi(js,k){
  const rec={k,t:Date.now(),v:1,ok:[],no:[],li:[],pl:[]}, els=(js&&Array.isArray(js.elements))?js.elements:[]; let n=0, t0=ora();
  for(const el of els){
    if(++n%200===0 && ora()-t0>6){ await new Promise(r=>setTimeout(r,0)); t0=ora(); }
    const g=el.tags||{};
    if(el.type==='node'){ if(/^(city|town|village|hamlet)$/.test(g.place||'')&&isFinite(el.lat)&&isFinite(el.lon)) rec.pl.push([Math.round(el.lat*1e5),Math.round(el.lon*1e5),g.place]); continue; }
    if(el.type!=='way'||!Array.isArray(el.geometry)) continue;
    let P=el.geometry.filter(p=>p&&isFinite(p.lat)&&isFinite(p.lon)).map(p=>[+p.lat,+p.lon]); if(P.length<2) continue;
    if(/^(line|minor_line)$/.test(g.power||'')){ rec.li.push([el.id,pacco(semplifica(P,8))]); continue; }
    if(P.length<4||P[0][0]!==P[P.length-1][0]||P[0][1]!==P[P.length-1][1]) continue;            // solo contorni chiusi
    const c=classe(g); if(!c) continue; const adatta=c==='m'||c==='v';
    P=semplifica(P,adatta?6:12); if(P.length<4) continue;
    const A=areaLL(P); if(A<(adatta?CFG.areaMin:2000)) continue;
    if(adatta) rec.ok.push([el.id,c==='v'?1:0,pacco(P)]); else rec.no.push([el.id,c,pacco(P)]); }
  return rec; }
// dal riquadro salvato alla geometria in metri (enu), pronta per i conti e per il disegno
function forma(id,c,g,chiusa){
  let n=g.length>>1; if(chiusa&&n>1&&g[0]===g[2*n-2]&&g[1]===g[2*n-1]) n--;
  const E=new Float64Array(n), N=new Float64Array(n); let e0=1e12,e1=-1e12,n0=1e12,n1=-1e12,la=0;
  for(let i=0;i<n;i++){ const q=enu(g[2*i]/1e5,g[2*i+1]/1e5); E[i]=q.E; N[i]=q.N; la+=g[2*i]/1e5; if(q.E<e0) e0=q.E; if(q.E>e1) e1=q.E; if(q.N<n0) n0=q.N; if(q.N>n1) n1=q.N; }
  return {id,c,E,N,e0,e1,n0,n1,cE:(e0+e1)/2,cN:(n0+n1)/2,kx:Math.cos(la/n*D2R)/CO,strips:null,path:null}; }   // kx: metri veri per metro E di enu() a quella latitudine
function apri(rec){
  const T={k:rec.k,t:rec.t,ok:[],no:[],li:[],pl:[],tr:null,u:ora()};
  for(const o of rec.ok||[]){ const f=forma(o[0],o[1]?'v':'m',o[2],true); if(f.E.length>=3){ let x=0,y=0; for(let i=0;i<f.E.length;i++){ x+=f.E[i]; y+=f.N[i]; } f.mE=x/f.E.length; f.mN=y/f.E.length; T.ok.push(f); } }
  for(const o of rec.no||[]){ const f=forma(o[0],o[1],o[2],true); if(f.E.length>=3) T.no.push(f); }
  for(const o of rec.li||[]){ const f=forma(o[0],'l',o[1],false); if(f.E.length>=2) T.li.push(f); }
  for(const o of rec.pl||[]){ const q=enu(o[0]/1e5,o[1]/1e5); T.pl.push({E:q.E,N:q.N,r:o[2]==='city'?1500:(o[2]==='town'?700:(o[2]==='village'?300:120))}); }
  return T; }
function inMem(T){ MEM.set(T.k,T); GEN++;
  if(MEM.size>CFG.mem){ const v=[...MEM.values()].sort((a,b)=>a.u-b.u); for(let i=0;i<v.length-CFG.mem;i++) MEM.delete(v[i].k); } }
const carico=new Set();
async function carica(k){ if(MEM.has(k)||carico.has(k)) return; carico.add(k);
  try{ const rec=await dbGet(k); if(rec&&rec.k===k) inMem(apri(rec)); else if(rec===null && (await db())){ delete IDX[k]; lsSet(KEY_I,IDX); } }catch(e){} finally{ carico.delete(k); } }

// ---- rete: un riquadro alla volta ----
const RETE={busy:false,last:0,poi:0,falliti:0,male:new Map(),semplice:false,forza:0,msg:'',fatti:0};
function domanda(k,semplice){ const [s,w,n,e]=bordi(k), f=semplice?'':'(if:length()>600)', f2=semplice?'':'(if:length()>300)';   // perimetro minimo: i ritagli non si scaricano nemmeno
  return `[out:json][timeout:25][bbox:${s},${w},${n},${e}];(way["landuse"~"^(meadow|farmland|grass)$"]${f};way["natural"="grassland"]${f};way["aeroway"~"^(aerodrome|airstrip)$"];`+
    `way["landuse"~"^(residential|industrial|commercial|retail|forest)$"]${f2};way["natural"~"^(wood|water)$"]${f2};way["power"~"^(line|minor_line)$"];node["place"~"^(city|town|village|hamlet)$"];);out geom qt;`; }
async function scarica(k){
  if(RETE.busy) return false; RETE.busy=true; RETE.last=Date.now(); let ok=false;
  const ctl=new AbortController(), tm=setTimeout(()=>ctl.abort(),CFG.tout);
  try{ const r=await fetch(URL_OP,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(domanda(k,RETE.semplice)),signal:ctl.signal});
    if(r.status===400&&!RETE.semplice){ RETE.semplice=true; throw new Error('domanda'); }      // filtro non accettato dal servizio: la prossima volta senza
    if(!r.ok) throw new Error('http '+r.status);
    const rec=await leggi(await r.json(),k);
    await dbPut(rec); IDX[k]=rec.t; inMem(apri(rec)); await tetto(); ok=true; RETE.falliti=0; RETE.fatti++; RETE.male.delete(k);
  }catch(e){ RETE.falliti++; RETE.male.set(k,Date.now()); RETE.poi=Date.now()+Math.min(900000,60000*2**Math.min(4,RETE.falliti-1)); }   // 1, 2, 4, 8, 15 minuti
  finally{ clearTimeout(tm); RETE.busy=false; RETE.last=Date.now(); }
  return ok; }
// riquadri che servono a terra: i 9 attorno alla posizione, poi quelli lungo la rotta attiva (una fascia di circa 5 km per lato)
// EXTRA: punti in più chiesti da fuori (anticipo.js: una rotta appena salvata, anche se non è attiva e anche senza GPS, a casa)
let EXTRA=[];
PH.pratiZona=function(pts){ EXTRA=Array.isArray(pts)?pts.filter(p=>p&&isFinite(+p.lat+ +p.lon)).slice(0,80).map(p=>({lat:+p.lat,lon:+p.lon})):[]; };
function voluti(){
  const out=[], add=(la,lo)=>{ const k=chiave(la,lo); if(out.length<60&&!out.includes(k)) out.push(k); };
  if(gpsOk()){ add(S.lat,S.lon); for(let a=-1;a<=1;a++) for(let b=-1;b<=1;b++) add(S.lat+a*CFG.cella,S.lon+b*CFG.cella); }
  try{ for(const p of EXTRA){ add(p.lat,p.lon); add(p.lat+0.05,p.lon+0.05); add(p.lat-0.05,p.lon-0.05); add(p.lat+0.05,p.lon-0.05); add(p.lat-0.05,p.lon+0.05); } }catch(e){}
  if(!gpsOk()) return out;
  try{ const P=[{lat:S.lat,lon:S.lon}];
    if(NAV.route&&NAV.route.r&&Array.isArray(NAV.route.r.wps)) for(let i=Math.max(0,NAV.route.idx|0);i<NAV.route.r.wps.length;i++) P.push({lat:+NAV.route.r.wps[i].lat,lon:+NAV.route.r.wps[i].lon});
    else if(NAV.dest) P.push({lat:NAV.dest.lat,lon:NAV.dest.lon});
    for(let i=0;i<P.length-1;i++){ const a=P[i], b=P[i+1]; if(!isFinite(a.lat+a.lon+b.lat+b.lon)) continue;
      const n=Math.max(1,Math.ceil(Math.hypot((b.lat-a.lat)*111,(b.lon-a.lon)*78)/5));
      for(let j=0;j<=n;j++){ const la=a.lat+(b.lat-a.lat)*j/n, lo=a.lon+(b.lon-a.lon)*j/n; add(la,lo); add(la+0.05,lo+0.05); add(la-0.05,lo-0.05); add(la+0.05,lo-0.05); add(la-0.05,lo+0.05); } }
  }catch(e){}
  return out; }
const gpsOk=()=>(S.gpsReal||!!PH.sim) && (PH.sim||!lost('gps')) && isFinite(S.lat+S.lon);
function rete(){
  if(RETE.busy||!navigator.onLine||(PH.stato&&PH.stato.internet===false)) return;
  const now=Date.now(), forza=now-RETE.forza<600000;
  if(now<RETE.poi&&!forza) return;
  if(!forza&&PH.lyr&&PH.lyr.prati===false) return;                // livello spento: niente scarichi da soli
  if((PH.demo&&!PH.sim)||(!gpsOk()&&!EXTRA.length)) return;       // volo dimostrativo o posizione non nota (e nessuna rotta da preparare): niente rete
  const volo=PH_air()||(PH.inVolo&&PH.inVolo())||(+S.gs||0)>=15;
  if(volo){ if(!gpsOk()) return; const k=chiave(S.lat,S.lon);                          // in volo: solo il riquadro sotto l'aereo, solo se manca del tutto
    if(IDX[k]||now-RETE.last<CFG.pausaVolo||now-(RETE.male.get(k)||0)<600000) return; scarica(k); return; }
  if(now-RETE.last<CFG.pausa) return;
  if(!forza&&PH.autoDl&&!PH.autoDl.permesso('zona')) return;       // Impostazioni › Scarico automatico: «mai», o «solo Wi-Fi» senza Wi-Fi
  const vecchio=now-CFG.giorni*864e5;
  for(const k of voluti()){ if(IDX[k]>vecchio||now-(RETE.male.get(k)||0)<600000) continue; scarica(k); return; }
  RETE.forza=0; }
setInterval(()=>{ try{ rete(); }catch(e){} },5000);

// ---- striscia più lunga per direzione (una volta per area) ----
function tagli(S1,T1,t,o){ o.length=0; const n=S1.length; for(let i=0,j=n-1;i<n;j=i++){ const a=T1[j], b=T1[i]; if((a>t)!==(b>t)) o.push(S1[j]+(t-a)/(b-a)*(S1[i]-S1[j])); } o.sort((x,y)=>x-y); return o; }
function comuni(a,b,o){ o.length=0; let i=0,j=0; while(i+1<a.length&&j+1<b.length){ const lo=Math.max(a[i],b[j]), hi=Math.min(a[i+1],b[j+1]); if(hi>lo) o.push(lo,hi); if(a[i+1]<b[j+1]) i+=2; else j+=2; } return o; }
function strisce(p){
  const n=p.E.length, X=new Float64Array(n), Y=new Float64Array(n), S1=new Float64Array(n), T1=new Float64Array(n), out=[];
  for(let i=0;i<n;i++){ X[i]=(p.E[i]-p.cE)*p.kx; Y[i]=p.N[i]-p.cN; }
  for(let a=0;a<180;a+=15){ const th=a*D2R, ux=Math.sin(th), uy=Math.cos(th), vx=uy, vy=-ux; let t0=1e12,t1=-1e12;
    for(let i=0;i<n;i++){ S1[i]=X[i]*ux+Y[i]*uy; const t=X[i]*vx+Y[i]*vy; T1[i]=t; if(t<t0) t0=t; if(t>t1) t1=t; }
    const passo=Math.max(CFG.larg/2,(t1-t0)/80), m=Math.floor((t1-t0)/passo); if(m<3) continue;           // tre righe vicine tutte dentro = corridoio largo almeno CFG.larg
    const righe=[]; for(let j=0;j<m;j++) righe.push(tagli(S1,T1,t0+passo*(j+0.5),[]));
    let bl=0,bs=0,bt=0; const q1=[], q2=[];
    for(let j=1;j<m-1;j++){ comuni(righe[j-1],righe[j],q1); comuni(q1,righe[j+1],q2); for(let i=0;i+1<q2.length;i+=2) if(q2[i+1]-q2[i]>bl){ bl=q2[i+1]-q2[i]; bs=q2[i]; bt=t0+passo*(j+0.5); } }
    const L=bl-2*CFG.bordo; if(L<CFG.lmin) continue;
    const s0=bs+CFG.bordo, s1=s0+L; out.push({th,L,ax:s0*ux+bt*vx,ay:s0*uy+bt*vy,bx:s1*ux+bt*vx,by:s1*uy+bt*vy,det:null,gen:-1}); }
  return out; }
// pendenza, paesi, boschi, acqua e linee attorno a una striscia (in metri veri attorno al centro dell'area)
function dettaglio(p,s,NO,LI,PL){
  if(s.det&&s.gen===GEN) return s.det;
  const kx=p.kx, lx=E=>(E-p.cE)*kx, ly=N=>N-p.cN, gE=x=>p.cE+x/kx, gN=y=>p.cN+y;
  const ux=Math.sin(s.th), uy=Math.cos(s.th), z=[]; for(let i=0;i<5;i++){ const q=quota(gE(s.ax+(s.bx-s.ax)*i/4),gN(s.ay+(s.by-s.ay)*i/4)); if(q!==q) return null; z.push(q); }   // senza rilievo non si giudica
  const mx=(s.ax+s.bx)/2, my=(s.ay+s.by)/2, zl=quota(gE(mx+uy*40),gN(my-ux*40)), zr=quota(gE(mx-uy*40),gN(my+ux*40)); if(zl!==zl||zr!==zr) return null;
  const gr=(dz,d)=>Math.atan2(Math.abs(dz),d)/D2R, d={no:false,zA:z[0],zB:z[4],zm:z[2],dP:1e9,dB:1e9,dA:1e9,dL:1e9,dLA:1e9,dLB:1e9,pl:false};
  d.pend=Math.max(gr(z[4]-z[0],s.L),gr(z[2]-z[0],s.L/2),gr(z[4]-z[2],s.L/2)); d.trasv=gr(zl-zr,80);
  if(d.pend>CFG.pendMax||d.trasv>CFG.pendTrasv){ d.no=true; s.det=d; s.gen=GEN; return d; }
  const mg=450, e0=Math.min(gE(s.ax),gE(s.bx))-mg, e1=Math.max(gE(s.ax),gE(s.bx))+mg, n0=Math.min(gN(s.ay),gN(s.by))-mg, n1=Math.max(gN(s.ay),gN(s.by))+mg;
  for(const f of NO){ if(f.e1<e0||f.e0>e1||f.n1<n0||f.n0>n1) continue;
    let m=1e9; if(pip(gE(mx),gN(my),f.E,f.N)||pip(gE(s.ax),gN(s.ay),f.E,f.N)||pip(gE(s.bx),gN(s.by),f.E,f.N)) m=0;
    else for(let i=0,j=f.E.length-1;i<f.E.length;j=i++){ const v=dSS(s.ax,s.ay,s.bx,s.by,lx(f.E[j]),ly(f.N[j]),lx(f.E[i]),ly(f.N[i])); if(v<m) m=v; }
    if(f.c==='p'){ if(m<d.dP) d.dP=m; } else if(f.c==='b'){ if(m<d.dB) d.dB=m; } else if(m<d.dA) d.dA=m; }
  if(d.dP<=0||d.dB<=0||d.dA<=0) d.no=true;                         // la striscia entra in un paese, in un bosco o nell'acqua
  const fx=ux*CFG.finale, fy=uy*CFG.finale;
  for(const f of LI){ if(f.e1<e0||f.e0>e1||f.n1<n0||f.n0>n1) continue;
    for(let i=1;i<f.E.length;i++){ const cx=lx(f.E[i-1]), cy=ly(f.N[i-1]), ex=lx(f.E[i]), ey=ly(f.N[i]);
      let v=dSS(s.ax,s.ay,s.bx,s.by,cx,cy,ex,ey); if(v<d.dL) d.dL=v;
      v=dSS(s.ax-fx,s.ay-fy,s.ax,s.ay,cx,cy,ex,ey); if(v<d.dLA) d.dLA=v;                       // finale di chi atterra da A verso B
      v=dSS(s.bx,s.by,s.bx+fx,s.by+fy,cx,cy,ex,ey); if(v<d.dLB) d.dLB=v; } }
  if(d.dL<CFG.linNo) d.no=true;
  for(const q of PL){ if(Math.hypot((q.E-gE(mx))*kx,q.N-gN(my))<q.r){ d.pl=true; break; } }
  s.det=d; s.gen=GEN; return d; }
// il prato visto dall'aereo: asse e verso di atterraggio migliori con il vento di adesso
function valuta(p,NO,LI,PL,ac){
  const w=WIND.valid, wk=w?Math.hypot(WIND.E,WIND.N)*3.6:0;
  const assi=p.strips.map(s=>{ const ux=Math.sin(s.th), uy=Math.cos(s.th), al=w?Math.abs(WIND.E*ux+WIND.N*uy)*3.6:0, tr=w?Math.abs(WIND.E*uy-WIND.N*ux)*3.6:0;
    return {s,al,tr,v:Math.min(s.L,CFG.lbuona)+al*6-tr*8}; }).sort((a,b)=>b.v-a.v).slice(0,3);          // 1 km/h contro vale 6 m di striscia, 1 km/h di traverso ne toglie 8
  for(const {s,al,tr} of assi){ const d=dettaglio(p,s,NO,LI,PL); if(!d) return null; if(d.no) continue;
    const ux=Math.sin(s.th), uy=Math.cos(s.th), gE=x=>p.cE+x/p.kx, gN=y=>p.cN+y, mE=gE((s.ax+s.bx)/2), mN=gN((s.ay+s.by)/2);
    // verso: da A a B (th) o da B ad A. Controvento se c'è vento (sotto 5 km/h non conta); l'1% di salita vale 2 km/h di vento; a parità, il più dritto per chi arriva
    const hwAB=w?-(WIND.E*ux+WIND.N*uy)*3.6:0, su=(d.zB-d.zA)/s.L, arr=Math.atan2((mE-ac.E)*p.kx,mN-ac.N), dr=Math.cos(arr-s.th);
    const pAB=(wk>=5?hwAB:0)+su*200+dr*2, okAB=d.dLA>=CFG.linAvv, okBA=d.dLB>=CFG.linAvv; if(!okAB&&!okBA) continue;
    const ab=okAB&&(!okBA||pAB>=0), hw=ab?hwAB:-hwAB, note=[];
    if(p.c==='v') note.push('campo di volo sulla mappa');
    if(d.dL<CFG.linVicina||(ab?d.dLA:d.dLB)<CFG.linVicina) note.push('linea elettrica vicina');
    if(d.dP<CFG.caseVicine||d.pl) note.push('case vicine');
    if(d.dB<CFG.alberi) note.push('alberi vicini');
    if(d.pend>2) note.push('in pendenza');
    const s0=35*Math.min(s.L,CFG.lbuona)/CFG.lbuona+10*Math.max(-1,Math.min(1,hw/20))-10*Math.min(1,tr/20)+10*Math.min(200,d.dP,d.dA)/200-4*d.pend-2*d.trasv
      -(d.dL<CFG.linVicina?15:0)-(d.pl||d.dP<CFG.caseVicine?8:0)-(d.dB<CFG.alberi?6:0)+(p.c==='v'?10:0);
    const A={E:gE(ab?s.ax:s.bx),N:gN(ab?s.ay:s.by)}, B={E:gE(ab?s.bx:s.ax),N:gN(ab?s.by:s.ay)};        // A = soglia, B = fondo
    return {p,E:mE,N:mN,elev:d.zm,L:s.L,dir:((ab?s.th:s.th+Math.PI)/D2R+360)%360,A,B,s0,note:note.slice(0,2).join(', ')}; }
  return null; }

// ---- scelta dei prati nella zona di planata (a pezzi di 4 ms) ----
let BEST=null, lavoro=false, ultimo=0;
async function scegli(z){
  lavoro=true; let t0=ora(); const fiato=async()=>{ if(ora()-t0>4){ await new Promise(r=>setTimeout(r,0)); t0=ora(); } };
  try{
    const zx=z.pts.map(q=>q.E), zy=z.pts.map(q=>q.N), e0=Math.min(...zx), e1=Math.max(...zx), n0=Math.min(...zy), n1=Math.max(...zy);
    const ks=[]; for(let la=Math.floor(lat2N(n0)/CFG.cella+1e-9);la<=Math.floor(lat2N(n1)/CFG.cella+1e-9)&&ks.length<CFG.mem;la++) for(let lo=Math.floor(lon2E(e0)/CFG.cella+1e-9);lo<=Math.floor(lon2E(e1)/CFG.cella+1e-9)&&ks.length<CFG.mem;lo++) ks.push(la+'_'+lo);
    for(const k of ks) if(IDX[k]&&!MEM.has(k)) await carica(k);
    const visti=new Set(), cand=[], NO=[], LI=[], PL=[], m=600;
    for(const k of ks){ const T=MEM.get(k); if(!T) continue; T.u=ora();
      for(const f of T.ok){ if(visti.has(f.id)) continue; visti.add(f.id); if(f.mE<e0||f.mE>e1||f.mN<n0||f.mN>n1||!pip(f.mE,f.mN,zx,zy)) continue;
        if(f.c==='v'){ if(f.noto===undefined) f.noto=FIELDS.some(c=>Math.abs(c.E-f.mE)<1200&&Math.abs(c.N-f.mN)<1200); if(f.noto) continue; }   // campo già nell'elenco dei campi: resta tra i campi
        f.d0=Math.hypot(f.mE-z.ac.E,f.mN-z.ac.N); cand.push(f); }
      for(const f of T.no) if(!visti.has(f.id)&&!(f.e1<e0-m||f.e0>e1+m||f.n1<n0-m||f.n0>n1+m)){ visti.add(f.id); NO.push(f); }
      for(const f of T.li) if(!visti.has(f.id)&&!(f.e1<e0-m||f.e0>e1+m||f.n1<n0-m||f.n0>n1+m)){ visti.add(f.id); LI.push(f); }
      for(const q of T.pl) PL.push(q); }
    await fiato();
    cand.sort((a,b)=>a.d0-b.d0); const out=[];
    for(const p of cand.slice(0,CFG.maxCand)){ await fiato(); if(!p.strips) p.strips=strisce(p); if(!p.strips.length) continue; const r=valuta(p,NO,LI,PL,z.ac); if(r) out.push(r); }
    // arrivo vero, con il terreno lungo la strada e la quota all'arrivo come per i campi: dai migliori in giù, finché bastano
    out.sort((a,b)=>b.s0-a.s0); const fin=[]; let visto=0;
    for(const r of out){ if(fin.length>=CFG.quanti*3||visto++>=120) break; await fiato();
      const a=PH.glideArr?PH.glideArr({E:r.E,N:r.N,elev:r.elev}):null; if(!a||!a.ok) continue;
      r.d=a.d; r.brg=a.brg; r.marg=a.marg; r.s=r.s0+25*Math.min(1,a.marg/1000)-a.d/2000; fin.push(r); }
    fin.sort((a,b)=>b.s-a.s); const list=[];
    for(const r of fin){ if(list.length>=CFG.quanti) break; if(list.some(q=>Math.hypot((q.E-r.E)*r.p.kx,q.N-r.N)<CFG.distanti)) continue; list.push(r); }
    BEST={t:ora(),z,list,no:NO.filter(f=>f.c==='p'),pl:PL,gen:GEN,tr:null};
  }catch(e){} finally{ lavoro=false; }
}
const serve=()=>!!PH.emerg || (PH.ui!=='simple' && PH.glideOn && !(PH.lyr&&PH.lyr.prati===false));   // nell'interfaccia semplice la mappa non c'è: solo in emergenza
function passo(){
  if(lavoro) return; const now=ora();
  if(!serve()||(PH.demo&&!PH.sim&&!PH.emerg)||!Object.keys(IDX).length){ BEST=null; return; }
  const z=PH.glideZone?PH.glideZone():null;                       // a pezzi: se non è pronta si riprova al prossimo giro
  if(!z){ if(BEST&&now-BEST.t>10000) BEST=null; return; }
  if((BEST&&BEST.z===z&&BEST.gen===GEN)||now-ultimo<CFG.ogni) return;
  ultimo=now; scegli(z); }
setInterval(()=>{ try{ passo(); }catch(e){} },300);

// prati raggiungibili adesso, dal migliore: prua, distanza e margine rifatti sulla posizione di adesso (al massimo una volta al secondo)
let LST=null;
PH.pratiList=function(n){
  try{ const now=ora(); if(!BEST||now-BEST.t>15000||!PH.glideArr) return [];
    if(!(LST&&LST.b===BEST&&now-LST.t<1000)){ const l=[];
      for(const r of BEST.list){ const a=PH.glideArr({E:r.E,N:r.N,elev:r.elev}); if(!a) return [];            // GPS perso: niente
        if(a.ok) l.push({brg:a.brg,d:a.d,marg:a.marg,L:r.L,dir:r.dir,note:r.note,E:r.E,N:r.N,s:r.s}); }
      LST={b:BEST,t:now,l}; }
    return LST.l.slice(0,n||5);
  }catch(e){ return []; } };

// ---- disegno: dentro la zona di planata, dopo la zona ----
let trama=null;
function tratteggio(){ if(trama&&trama.k===k&&trama.c===ctx) return trama.p; const s=Math.max(5,Math.round(4.5*k)), c=document.createElement('canvas'); c.width=c.height=s;
  const g=c.getContext('2d'); g.strokeStyle='rgba(255,170,90,.6)'; g.lineWidth=Math.max(1,0.8*k); g.beginPath(); g.moveTo(-1,s+1); g.lineTo(s+1,-1); g.moveTo(-1,1); g.lineTo(1,-1); g.moveTo(s-1,s+1); g.lineTo(s+1,s-1); g.stroke();
  trama={k,c:ctx,p:ctx.createPattern(c,'repeat')}; return trama.p; }
function sagoma(f){ if(f.path) return f.path; const q=new Path2D(); for(let i=0;i<f.E.length;i++) i?q.lineTo(f.E[i]-f.cE,f.N[i]-f.cN):q.moveTo(f.E[i]-f.cE,f.N[i]-f.cN); q.closePath(); f.path=q; return q; }
function disegna(toS){
  if(!PH.glideOn||(PH.demo&&!PH.sim&&!PH.emerg)||(PH.lyr&&PH.lyr.prati===false)||ZOOMS[zi]>60) return;
  const B=BEST; if(!B||ora()-B.t>15000) return;
  const z=PH.glideZone(); if(!z) return;                          // GPS perso o a terra: niente
  const c0=z.ac, o0=toS(c0.E,c0.N), oE=toS(c0.E+1000,c0.N), oN=toS(c0.E,c0.N+1000), ma=(oE.x-o0.x)/1000, mb=(oE.y-o0.y)/1000, mc=(oN.x-o0.x)/1000, md=(oN.y-o0.y)/1000, s1=Math.hypot(ma,mb)||1;
  const X=(E,N)=>o0.x+ma*(E-c0.E)+mc*(N-c0.N), Y=(E,N)=>o0.y+mb*(E-c0.E)+md*(N-c0.N);
  ctx.save();
  // paesi e capannoni: tratteggio leggero, solo dentro la zona di planata
  try{ if((B.no.length||B.pl.length)&&ZOOMS[zi]<=30){
      if(!B.tr){ const q=new Path2D(), q2=new Path2D();           // paesi e cerchi dei nomi in due forme: sovrapposti con verso opposto si annullerebbero
        for(const f of B.no){ for(let i=0;i<f.E.length;i++) i?q.lineTo(f.E[i]-c0.E,f.N[i]-c0.N):q.moveTo(f.E[i]-c0.E,f.N[i]-c0.N); q.closePath(); }
        for(const p of B.pl){ q2.moveTo(p.E-c0.E+p.r,p.N-c0.N); q2.arc(p.E-c0.E,p.N-c0.N,p.r,0,2*Math.PI); } B.tr={q,q2,E:c0.E,N:c0.N}; }
      ctx.save(); ctx.beginPath(); z.pts.forEach((p,i)=>i?ctx.lineTo(X(p.E,p.N),Y(p.E,p.N)):ctx.moveTo(X(p.E,p.N),Y(p.E,p.N))); ctx.closePath(); ctx.clip();
      const m=new DOMMatrix([ma,mb,mc,md,X(B.tr.E,B.tr.N),Y(B.tr.E,B.tr.N)]), sp=new Path2D(), sp2=new Path2D(); sp.addPath(B.tr.q,m); sp2.addPath(B.tr.q2,m);   // in pixel: la trama non si deforma con la mappa
      ctx.fillStyle=tratteggio(); ctx.fill(sp); ctx.fill(sp2); ctx.strokeStyle='rgba(255,170,90,.45)'; ctx.lineWidth=1*k; ctx.stroke(sp); ctx.restore(); } }catch(e){}
  // prati migliori: contorno chiaro e striscia con il verso di atterraggio
  try{ const em=!!PH.emerg; ctx.lineJoin='round'; ctx.lineCap='round';
    B.list.forEach((r,i)=>{ const f=r.p, ox=X(f.cE,f.cN), oy=Y(f.cE,f.cN), rr=(Math.abs(ma)+Math.abs(mc))*(f.e1-f.e0)/2+(Math.abs(mb)+Math.abs(md))*(f.n1-f.n0)/2;
      if(ox+rr<0||ox-rr>W||oy+rr<0||oy-rr>H) return;
      ctx.save(); ctx.transform(ma,mb,mc,md,ox,oy); ctx.fillStyle=`rgba(200,255,120,${em?0.26:0.16})`; ctx.fill(sagoma(f));
      ctx.strokeStyle=`rgba(200,255,120,${i<3?0.95:0.6})`; ctx.lineWidth=(em&&i<3?2.4:1.5)*k/s1; ctx.stroke(sagoma(f)); ctx.restore();
      const ax=X(r.A.E,r.A.N), ay=Y(r.A.E,r.A.N), bx=X(r.B.E,r.B.N), by=Y(r.B.E,r.B.N), l=Math.hypot(bx-ax,by-ay); if(l<5*k) return;
      ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.lineWidth=(em?6:4.6)*k; ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      ctx.strokeStyle='#f2ffd6'; ctx.lineWidth=(em?3.4:2.4)*k; ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by);
      const ux=(bx-ax)/l, uy=(by-ay)/l, h=Math.min(l*0.35,9*k);                                  // freccia sul fondo: si atterra da A verso B
      ctx.moveTo(bx-ux*h-uy*h*0.6,by-uy*h+ux*h*0.6); ctx.lineTo(bx,by); ctx.lineTo(bx-ux*h+uy*h*0.6,by-uy*h-ux*h*0.6); ctx.stroke();
      if(ZOOMS[zi]<=15&&(i<3||ZOOMS[zi]<=8)){ ctx.font=font(R*0.034,'700'); ctx.textAlign='center'; ctx.textBaseline='bottom'; const t=Math.round(r.L/10)*10+' m', ty=Math.min(ay,by)-4*k;
        ctx.lineWidth=3*k; ctx.strokeStyle='rgba(0,0,0,.8)'; ctx.fillStyle='#e6ffb0'; ctx.strokeText(t,(ax+bx)/2,ty); ctx.fillText(t,(ax+bx)/2,ty); } });
  }catch(e){}
  ctx.restore(); }
{ const orig=PH.glideRing; PH.glideRing=function(toS){ const r=orig.apply(this,arguments); try{ disegna(toS); }catch(e){} return r; }; }

// ---- Impostazioni › Volare senza internet: stato e scarico a richiesta (solo a terra) ----
PH.pratiStato=function(){ const now=Date.now(), n=Object.keys(IDX).length; let zona=0, tot=0;
  try{ if(gpsOk()){ const v=voluti(); tot=v.length; zona=v.filter(x=>IDX[x]>now-CFG.giorni*864e5).length; } }catch(e){}
  return {n,zona,tot,busy:RETE.busy,attesa:Math.max(0,RETE.poi-now),falliti:RETE.falliti,mem:MEM.size,best:BEST?BEST.list.length:0}; };
PH.pratiScarica=function(){ RETE.forza=Date.now(); RETE.poi=0; RETE.falliti=0; RETE.male.clear(); try{ rete(); }catch(e){} };
PH.pratiCfg=CFG;
if(PH.renderImp){ const orig=PH.renderImp; PH.renderImp=function(){ orig.apply(this,arguments);
  try{ const h=[...document.querySelectorAll('#phImpBody section')].find(s=>s.dataset.t==='Volare senza internet'||(s.querySelector('h3')&&s.querySelector('h3').textContent==='Volare senza internet')); if(!h) return;
    const host=h.querySelector('.hz-sb')||h, box=document.createElement('div'); box.id='hzPrati';
    const draw=()=>{ const s=PH.pratiStato(), volo=PH_air()||(+S.gs||0)>=15;
      box.innerHTML=`<p class="ph-sub"><b>Prati per l'atterraggio fuori campo</b> (dentro la zona di planata e nella pagina EMERGENZA): si scaricano da soli a terra, con la rete, attorno a dove sei e lungo la rotta attiva. Sul telefono: ${s.n} riquadr${s.n===1?'o':'i'}${s.tot?` · zona e rotta ${s.zona} su ${s.tot}`:''}${s.busy?' · scarico in corso…':(s.attesa&&s.falliti?' · servizio non raggiungibile, riprovo tra '+Math.ceil(s.attesa/60000)+' min':'')}. Dati © OpenStreetMap (ODbL): un'indicazione, da verificare a vista.</p>
      <div class="ph-btns"><button class="ph-btn" type="button" id="hzPrGo"${volo||!navigator.onLine?' disabled':''}>Scarica i prati della zona</button></div>`;
      const g=box.querySelector('#hzPrGo'); if(g) g.onclick=()=>{ PH.pratiScarica(); toastShow('PRATI: SCARICO IN SOTTOFONDO'); setTimeout(draw,600); }; };
    draw(); host.appendChild(box);
    const tm=setInterval(()=>{ if(!document.body.contains(box)){ clearInterval(tm); return; } try{ if(!box.contains(document.activeElement)) draw(); }catch(e){} },5000);
  }catch(e){} }; }
})();
