// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// PRATI: DALLA RISPOSTA DI OVERPASS AL RIQUADRO SALVATO. Solo funzioni pure, senza rete e senza pagina.
// Lo stesso file serve a due cose, così la logica è scritta una volta sola:
// · nell'app (atterraggi.js) come oggetto globale PRATI_DATI;
// · in Node (tools/prati_prepara.js, tools/test_prati.js) con require().
// Il formato del riquadro NON va cambiato senza pensarci: i telefoni ne hanno già in memoria (IndexedDB «horizon-prati»)
// e i riquadri preparati su GitHub (ramo «prati-dati», cartella v1/) sono identici.
//   {k:'452_78', t:<ms>, v:1,
//    ok:[[id, 1 se campo di volo altrimenti 0, [lat·1e5, lon·1e5, …]], …],     aree adatte
//    no:[[id, 'p' paese | 'b' bosco | 'a' acqua, [lat·1e5, lon·1e5, …]], …],  aree da evitare
//    li:[[id, [lat·1e5, lon·1e5, …]], …],                                      linee elettriche
//    pl:[[lat·1e5, lon·1e5, 'city'|'town'|'village'|'hamlet'], …]}             nomi dei paesi
(function(radice,fabbrica){ const o=fabbrica(); if(typeof module==='object'&&module&&module.exports) module.exports=o; else radice.PRATI_DATI=o; })(typeof self!=='undefined'?self:this,function(){
'use strict';
const D2R=Math.PI/180, M_LAT=110540, M_LON=111320;
const CELLA=0.1;              // lato del riquadro in gradi
const AREA_MIN=8000;          // m²: aree adatte più piccole non si salvano
const AREA_MIN_NO=2000;       // m²: aree da evitare più piccole non si salvano
const VERSIONE=1;             // versione del formato (campo v del riquadro, cartella v1/ su GitHub)
// i tre servizi Overpass pubblici, nell'ordine in cui si provano
const SERVIZI=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.private.coffee/api/interpreter'];
// riquadri già pronti (li prepara .github/workflows/prati-prepara.yml con tools/prati_prepara.js)
const PRONTI='https://raw.githubusercontent.com/amicoen-ops/HORIZON/prati-dati/v'+VERSIONE+'/';

// ---- riquadri: chiave e bordi ----
const chiave=(lat,lon)=>Math.floor(lat/CELLA+1e-9)+'_'+Math.floor(lon/CELLA+1e-9);
const bordi=k=>{ const [a,b]=k.split('_').map(Number); return [a*CELLA,b*CELLA,(a+1)*CELLA,(b+1)*CELLA].map(v=>v.toFixed(1)); };   // sud, ovest, nord, est
const chiaveBuona=k=>/^-?\d{1,4}_-?\d{1,4}$/.test(String(k));

// ---- geometria ----
function dPS(px,py,ax,ay,bx,by){ const dx=bx-ax, dy=by-ay, l=dx*dx+dy*dy; let t=l?((px-ax)*dx+(py-ay)*dy)/l:0; t=t<0?0:(t>1?1:t); return Math.hypot(px-ax-t*dx,py-ay-t*dy); }
// meno punti (Douglas-Peucker, tolleranza in metri) su una lista [lat,lon]
function semplifica(P,tol){
  if(P.length<4) return P; const c=Math.cos(P[0][0]*D2R), X=P.map(p=>(p[1]-P[0][1])*M_LON*c), Y=P.map(p=>(p[0]-P[0][0])*M_LAT);
  const tieni=new Uint8Array(P.length), pila=[[0,P.length-1]]; tieni[0]=tieni[P.length-1]=1;
  while(pila.length){ const [a,b]=pila.pop(); let m=-1, dm=tol; for(let i=a+1;i<b;i++){ const d=dPS(X[i],Y[i],X[a],Y[a],X[b],Y[b]); if(d>dm){ dm=d; m=i; } }
    if(m>0){ tieni[m]=1; pila.push([a,m],[m,b]); } }
  return P.filter((p,i)=>tieni[i]); }
function areaLL(P){ const c=Math.cos(P[0][0]*D2R); let s=0; for(let i=0,j=P.length-1;i<P.length;j=i++) s+=(P[j][1]-P[0][1])*M_LON*c*(P[i][0]-P[0][0])*M_LAT-(P[i][1]-P[0][1])*M_LON*c*(P[j][0]-P[0][0])*M_LAT; return Math.abs(s)/2; }
const pacco=P=>{ const o=[]; for(const p of P) o.push(Math.round(p[0]*1e5),Math.round(p[1]*1e5)); return o; };

// ---- la domanda a Overpass per un riquadro ----
// semplice=false aggiunge un perimetro minimo (i ritagli non si scaricano nemmeno); non tutti i servizi lo accettano
function domanda(k,semplice){ const [s,w,n,e]=bordi(k), f=semplice?'':'(if:length()>600)', f2=semplice?'':'(if:length()>300)';
  return `[out:json][timeout:60][bbox:${s},${w},${n},${e}];(way["landuse"~"^(meadow|farmland|grass)$"]${f};way["natural"="grassland"]${f};way["aeroway"~"^(aerodrome|airstrip)$"];`+
    `way["landuse"~"^(residential|industrial|commercial|retail|forest)$"]${f2};way["natural"~"^(wood|water)$"]${f2};way["power"~"^(line|minor_line)$"];node["place"~"^(city|town|village|hamlet)$"];);out geom qt;`; }
// La risposta è intera? Overpass a volte risponde 200 ma con un avviso («remark») di tempo scaduto o memoria finita e
// dentro solo una parte degli elementi, o nessuno: salvarla vorrebbe dire «qui non ci sono prati» per un mese, ed è falso.
// Una risposta intera con zero elementi invece è buona: mare, ghiacciai, zone senza niente sulla mappa.
function rispostaBuona(js){ return !!js && typeof js==='object' && Array.isArray(js.elements) && !/error|timed out|out of memory/i.test(String(js.remark||'')); }

// ---- dalla risposta di Overpass al riquadro da salvare ----
// m = prato/coltivo/erba, v = campo di volo, p = paese o capannoni, b = bosco, a = acqua
function classe(g){
  if(/^(residential|industrial|commercial|retail)$/.test(g.landuse||'')) return 'p';
  if(g.landuse==='forest'||g.natural==='wood') return 'b';
  if(g.natural==='water') return 'a';
  if(/^(aerodrome|airstrip)$/.test(g.aeroway||'')) return 'v';
  if(/^(meadow|farmland|grass)$/.test(g.landuse||'')||g.natural==='grassland') return /rice/i.test(g.crop||'')?'':'m';   // le risaie sono allagate
  return ''; }
const nuovo=(k,t)=>({k,t:t||Date.now(),v:VERSIONE,ok:[],no:[],li:[],pl:[]});
// un elemento della risposta dentro il riquadro (l'app ne passa un po' alla volta per non fermare il disegno)
function aggiungi(rec,el,areaMin){
  if(!el) return; const g=el.tags||{};
  if(el.type==='node'){ if(/^(city|town|village|hamlet)$/.test(g.place||'')&&isFinite(el.lat)&&isFinite(el.lon)) rec.pl.push([Math.round(el.lat*1e5),Math.round(el.lon*1e5),g.place]); return; }
  if(el.type!=='way'||!Array.isArray(el.geometry)) return;
  let P=el.geometry.filter(p=>p&&isFinite(p.lat)&&isFinite(p.lon)).map(p=>[+p.lat,+p.lon]); if(P.length<2) return;
  if(/^(line|minor_line)$/.test(g.power||'')){ rec.li.push([el.id,pacco(semplifica(P,8))]); return; }
  if(P.length<4||P[0][0]!==P[P.length-1][0]||P[0][1]!==P[P.length-1][1]) return;            // solo contorni chiusi
  const c=classe(g); if(!c) return; const adatta=c==='m'||c==='v';
  P=semplifica(P,adatta?6:12); if(P.length<4) return;
  const A=areaLL(P); if(A<(adatta?(areaMin||AREA_MIN):AREA_MIN_NO)) return;
  if(adatta) rec.ok.push([el.id,c==='v'?1:0,pacco(P)]); else rec.no.push([el.id,c,pacco(P)]); }
// tutta la risposta in una volta (Node)
function converti(js,k,t,areaMin){ const rec=nuovo(k,t); for(const el of (js&&Array.isArray(js.elements))?js.elements:[]) aggiungi(rec,el,areaMin); return rec; }
// Un riquadro arrivato da fuori (GitHub) è fatto come deve? Si controlla prima di salvarlo sul telefono.
function riquadroBuono(rec,k){
  if(!rec||typeof rec!=='object'||rec.k!==k||rec.v!==VERSIONE||!isFinite(rec.t)) return false;
  const coppie=g=>Array.isArray(g)&&g.length>=4&&g.length%2===0&&g.every(Number.isFinite);
  if(![rec.ok,rec.no,rec.li,rec.pl].every(Array.isArray)) return false;
  return rec.ok.every(o=>Array.isArray(o)&&o.length===3&&coppie(o[2])) && rec.no.every(o=>Array.isArray(o)&&o.length===3&&/^[pba]$/.test(o[1])&&coppie(o[2])) &&
    rec.li.every(o=>Array.isArray(o)&&o.length===2&&coppie(o[1])) && rec.pl.every(o=>Array.isArray(o)&&o.length===3&&isFinite(o[0])&&isFinite(o[1])); }

return {CELLA,AREA_MIN,VERSIONE,SERVIZI,PRONTI,D2R,M_LAT,M_LON,chiave,bordi,chiaveBuona,dPS,semplifica,areaLL,pacco,domanda,rispostaBuona,classe,nuovo,aggiungi,converti,riquadroBuono};
});
