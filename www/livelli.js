// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// LIVELLI DELLA MAPPA. Tasto ◧ accanto allo zoom: pannello a tasti grandi per accendere e spegnere spazi aerei, traffico,
// campi, zona di planata, prati per l'atterraggio fuori campo (atterraggi.js), punti di riporto VFR, scia del traffico, NOTAM (cerchi arancio dal Briefing) e meteo dei campi
// (anelli colorati dai METAR, disegnati da vento.js), e per cambiare la mappa di base.
// Spazi aerei sulla mappa dello strumento: contorni colorati per classe sotto campi e rotta. «Solo vicini alla mia quota»:
// quelli che toccano la tua quota (±1000 ft) in pieno, gli altri appena accennati (come lo Smart Airspace dei Garmin).
// Spegnere un livello toglie solo il disegno: gli avvisi (spazi, traffico, terreno) restano sempre.
// Disegno leggero: il contorno di ogni spazio si calcola una volta sola (Path2D in metri attorno al suo centro) e a ogni
// fotogramma si disegna con una trasformazione; gli spazi fuori dal riquadro si saltano subito; il giudizio delle regole vale 3 s.
(function(){
'use strict';
const KEY='ia517p_lyr';
PH.lyr=Object.assign({asp:true,aspSmart:true,trf:true,campi:true,vrp:true,scia:true,notam:true,meteo:true,prati:true},lsGet(KEY,{}));
const salva=()=>lsSet(KEY,PH.lyr);
const COL=c=>{ c=String(c||'').toUpperCase(); if(/^(P|R)$/.test(c)) return [255,77,77]; if(/^(CTR|A|B|C|D)$/.test(c)) return [79,155,255];
  if(/^(E|RMZ|TMZ)$/.test(c)) return [181,140,255]; if(/^(Q|DANGER)$/.test(c)) return [255,197,49]; if(c==='OFR') return [255,140,60]; return [150,160,172]; };

// ---- spazi aerei sulla mappa ----
let cache={t:0,key:'',list:[]};
const geoC=new WeakMap();                                         // geometria per spazio, calcolata una volta
function geo(a){ const o=ORIGIN.lat+','+ORIGIN.lon; let v=geoC.get(a); if(v&&v.o===o&&v.n===a.pts.length) return v;
  const p=a.pts.map(q=>enu(q.lat,q.lon)); let e0=1e12,e1=-1e12,n0=1e12,n1=-1e12;
  for(const q of p){ if(q.E<e0) e0=q.E; if(q.E>e1) e1=q.E; if(q.N<n0) n0=q.N; if(q.N>n1) n1=q.N; }
  const cE=(e0+e1)/2, cN=(n0+n1)/2, path=new Path2D();            // attorno al centro: numeri piccoli, niente errori di arrotondamento lontano dall'origine
  p.forEach((q,i)=>i?path.lineTo(q.E-cE,q.N-cN):path.moveTo(q.E-cE,q.N-cN)); path.closePath();
  v={o,n:a.pts.length,p,cE,cN,hE:(e1-e0)/2,hN:(n1-n0)/2,path,vt:0,bad:false,off:false,lt:0,li:-1}; geoC.set(a,v); return v; }
function visibili(c,rng){
  const now=performance.now(), key=Math.round(c.E/2000)+','+Math.round(c.N/2000)+','+rng;
  if(now-cache.t<1500 && cache.key===key) return cache.list;
  const out=[], ll={lat:ORIGIN.lat+c.N/110540, lon:ORIGIN.lon+c.E/(111320*Math.cos(ORIGIN.lat*D2R))}, dLa=rng*1.8/110540, dLo=rng*1.8/(111320*Math.cos(ll.lat*D2R));
  for(const a of (PH.aspList?PH.aspList():[])){ const bb=a.bb; if(!bb||!a.pts||a.pts.length<3) continue; if(/^(FIR|UIR)$/i.test(a.cls)) continue;
    if(bb[1]<ll.lat-dLa||bb[0]>ll.lat+dLa||bb[3]<ll.lon-dLo||bb[2]>ll.lon+dLo) continue;
    if(a.lo&&a.lo.ref!=='AGL'&&a.lo.ft>15000) continue; out.push(a); }
  cache={t:now,key,list:out}; return out;
}
// ---- NOTAM sulla mappa: cerchio tratteggiato arancio con oggetto e quote (dal Piano › Briefing › NOTAM) ----
// L'elenco si richiede al Piano solo quando può essere cambiato: il Piano ha ridisegnato (testo nuovo), è stato ricaricato,
// o sono passati 5 minuti (i NOTAM scaduti escono dall'elenco). Prima si rifaceva l'analisi del testo ogni 10 s.
let nCache={t:0,chk:0,list:[],w:null,dirty:true};
PH.notamMap=function(){ const now=performance.now(); if(now-nCache.chk<10000) return nCache.list; nCache.chk=now;
  try{ const w=document.getElementById('phAppFrame').contentWindow;
    if(w!==nCache.w||!w.__hzNotam){ nCache.w=w; nCache.dirty=true;
      if(w&&typeof w.update==='function'&&!w.__hzNotam){ const u=w.update; w.update=function(){ nCache.dirty=true; return u.apply(this,arguments); }; w.__hzNotam=1; } }
    if(nCache.dirty||!(w&&w.__hzNotam)||now-nCache.t>300000){ nCache.list=w&&w.IA517_notam?w.IA517_notam():[]; nCache.t=now; nCache.dirty=!(w&&w.IA517_notam); }   // Piano non ancora pronto: si riprova
  }catch(e){}
  return nCache.list; };
function notamDraw(toS){
  if(PH.lyr.notam===false||PH.ui==='simple') return; const L=PH.notamMap(); if(!L.length) return;
  const now=Date.now(); ctx.save(); ctx.font=font(R*0.032,'700'); ctx.textAlign='center'; ctx.textBaseline='bottom';
  for(const n of L){ const q=enu(n.lat,n.lon), p=toS(q.E,q.N), e=toS(q.E+n.r,q.N), rp=Math.hypot(e.x-p.x,e.y-p.y);
    if(p.x+rp<0||p.y+rp<0||p.x-rp>W||p.y-rp>H) continue;
    const att=(!n.from||n.from<=now)&&(n.perm||!n.to||n.to>=now), vic=n.lo==null||n.lo<=S.alt+1000;
    ctx.beginPath(); ctx.arc(p.x,p.y,Math.max(rp,6*k),0,2*Math.PI);
    ctx.fillStyle=`rgba(255,140,40,${att&&vic?0.12:0.04})`; ctx.fill();
    ctx.setLineDash([8*k,5*k]); ctx.lineWidth=(att&&vic?2.6:1.4)*k; ctx.strokeStyle=`rgba(255,150,50,${att&&vic?0.95:0.45})`; ctx.stroke(); ctx.setLineDash([]);
    if(ZOOMS[zi]<=60){ const t=`NOTAM ${n.subj}${n.lo!=null?' '+(n.lo?n.lo:'SFC')+'–'+n.hi+' ft':''}${att?'':' (più tardi)'}`;
      ctx.lineWidth=3*k; ctx.strokeStyle='rgba(0,0,0,.85)'; ctx.fillStyle='#ffa040'; const y=p.y-Math.max(rp,6*k)-2*k; ctx.strokeText(t,p.x,y); ctx.fillText(t,p.x,y); } }
  ctx.restore(); }
PH.mapUnder=function(toS,sc,c){
  try{ notamDraw(toS); }catch(e){}
  if(!PH.lyr.asp) return;
  const rng=ZOOMS[zi]*1000, list=visibili(c,rng); if(!list.length){ try{ PH.vrpDraw&&PH.vrpDraw(toS); }catch(e){} return; }
  const alt=S.alt, z0=terrain(...xy(enu(S.lat,S.lon))), gFt=z0===z0?z0/FT2M:0;
  const lim=L=>L.ref==='AGL'?(L.ft?L.ft+gFt:-1e9):L.ft;
  const R0=window.IA517_RULES, now=performance.now(), etich=ZOOMS[zi]<=30; let labels=0;
  // da metri a schermo: la stessa trasformazione di toS, ricavata da tre punti (pixel per metro lungo E e lungo N)
  const o0=toS(c.E,c.N), oE=toS(c.E+1000,c.N), oN=toS(c.E,c.N+1000), ma=(oE.x-o0.x)/1000, mb=(oE.y-o0.y)/1000, mc=(oN.x-o0.x)/1000, md=(oN.y-o0.y)/1000;
  const s1=Math.hypot(ma,mb)||1, eX=Math.abs(ma), eY=Math.abs(mb), nX=Math.abs(mc), nY=Math.abs(md);
  ctx.save(); ctx.lineJoin='round';
  for(const a of list){ try{
    const g=geo(a), dE=g.cE-c.E, dN=g.cN-c.N, ox=o0.x+ma*dE+mc*dN, oy=o0.y+mb*dE+md*dN, rx=eX*g.hE+nX*g.hN, ry=eY*g.hE+nY*g.hN;
    if(ox+rx<0||ox-rx>W||oy+ry<0||oy-ry>H) continue;              // riquadro dello spazio fuori dallo schermo: niente altro lavoro
    const lo=lim(a.lo), hi=lim(a.hi), vicino=lo<=alt+1000 && hi>=alt-1000, dentroQ=lo<=alt+50&&hi>=alt-50;
    const dim=PH.lyr.aspSmart && !vicino, [r,gg,b]=COL(a.cls);
    if(now-g.vt>3000||!g.vt){ g.vt=now; g.off=!!(R0&&R0.inattiva&&R0.inattiva(a)); g.bad=false; try{ g.bad=!!(R0&&R0.verdict(a).status==='bad'); }catch(e){} }
    ctx.save(); ctx.transform(ma,mb,mc,md,ox,oy);
    if(!dim){ ctx.fillStyle=`rgba(${r},${gg},${b},${g.bad&&dentroQ?0.16:0.06})`; ctx.fill(g.path); }
    ctx.setLineDash(g.off?[6*k/s1,6*k/s1]:[]); ctx.strokeStyle=`rgba(${r},${gg},${b},${dim?0.22:0.9})`; ctx.lineWidth=(dim?1:2.4)*k/s1; ctx.stroke(g.path);
    ctx.restore();
    // nome e limiti degli spazi vicini alla quota (al massimo 8, solo con zoom stretto). Il punto dell'etichetta si sceglie
    // tra i vertici visibili e si tiene finché resta sullo schermo (almeno 0,7 s): non salta da un vertice all'altro
    if(!dim && labels<8 && etich){ const P=g.p, X=q=>o0.x+ma*(q.E-c.E)+mc*(q.N-c.N), Y=q=>o0.y+mb*(q.E-c.E)+md*(q.N-c.N), vis=q=>{ const x=X(q), y=Y(q); return x>0&&x<W&&y>0&&y<H; };
      if(g.li<0||g.li>=P.length||(!vis(P[g.li])&&now-g.lt>700)){ g.lt=now; let n=0; for(const q of P) if(vis(q)) n++;
        g.li=-1; if(n){ let m=Math.floor(n/2); for(let i=0;i<P.length;i++) if(vis(P[i])&&m--===0){ g.li=i; break; } } }
      if(g.li>=0&&vis(P[g.li])){ const q=P[g.li], qx=X(q), qy=Y(q); ctx.setLineDash([]); ctx.font=font(R*0.034,'700'); ctx.textAlign='left'; ctx.textBaseline='middle';
        const tx=`${a.cls} ${String(a.name||'').slice(0,18)} ${a.lo.txt}–${a.hi.txt}`; ctx.lineWidth=3*k; ctx.strokeStyle='rgba(0,0,0,.8)'; ctx.fillStyle=`rgb(${r},${gg},${b})`;
        ctx.strokeText(tx,qx+4,qy); ctx.fillText(tx,qx+4,qy); labels++; } }
  }catch(e){} }
  ctx.setLineDash([]); ctx.restore();
  try{ PH.vrpDraw&&PH.vrpDraw(toS); }catch(e){}
};

// ---- pannello LIVELLI ----
const BASI=['ofm','topo','osm','igm','orto','esri','dem'];
function basi(){ return BASI.filter(b=>PH.BASES[b]&&!(PH.BASES[b].key&&!PH.esriKey)&&!(b==='ofm'&&!PH.cartaOk)&&!(PH.wmsBlocked&&PH.BASES[b].wms)); }
function pannello(){
  let d=document.getElementById('hzLyr'); if(d) d.remove();
  d=document.createElement('div'); d.className='ph-more'; d.id='hzLyr';
  const T=(k,l,s)=>`<button type="button" data-l="${k}" class="${PH.lyr[k]!==false?'on':''}"><i>${PH.lyr[k]!==false?'✓':'—'}</i>${l}${s?`<small>${s}</small>`:''}</button>`;
  d.innerHTML=`<div class="ph-more-g hz-lyr">
    ${T('asp','SPAZI AEREI')}${T('aspSmart','SOLO VICINI','alla mia quota ±1000 ft')}
    ${T('trf','TRAFFICO','gli avvisi restano')}${T('scia','SCIA TRAFFICO')}
    ${T('campi','CAMPI')}${T('vrp','PUNTI VFR','di riporto')}
    ${T('notam','NOTAM','dal Briefing')}${T('meteo','METEO CAMPI','colori VFR dai METAR')}
    <button type="button" data-l="planata" class="${PH.glideOn?'on':''}"><i>${PH.glideOn?'✓':'—'}</i>PLANATA<small>zona raggiungibile</small></button>
    ${T('prati','PRATI','© OpenStreetMap')}
    <button type="button" data-l="base"><i>🗺</i>MAPPA<small>${(PH.BASES[PH.base]||{}).name||PH.base} · tocca per cambiare</small></button>
    <button type="button" data-x class="x"><i>✕</i>CHIUDI</button></div>`;
  document.body.appendChild(d);
  d.onclick=e=>{ if(e.target===d) d.remove(); };
  d.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>{ const k=b.dataset.l;
    if(k==='planata'){ PH.glideOn=!PH.glideOn; lsSet('ia517p_glide',PH.glideOn); }
    else if(k==='base'){ const L=basi(), i=L.indexOf(PH.base); PH.base=L[(i+1)%L.length]; lsSet('ia517p_basemap',PH.base); MR.zi=-1; toastShow('MAPPA: '+((PH.BASES[PH.base]||{}).name||PH.base).toUpperCase()); }
    else { PH.lyr[k]=PH.lyr[k]===false; salva(); }
    PH.act&&PH.act('livello '+k); pannello(); });
  d.querySelector('[data-x]').onclick=()=>d.remove();
}
PH.lyrOpen=pannello;
{ const s=document.createElement('style'); s.textContent=`
  .hz-lyr button{flex-direction:column;gap:2px;min-height:70px} .hz-lyr button i{font-size:20px}
  .hz-lyr button small{display:block;font:600 11px system-ui,sans-serif;color:#9aa4b0;letter-spacing:0}
  .hz-lyr button.on{border-color:#33e1ff;color:#33e1ff} .hz-lyr button.x{grid-column:1/-1}
  .ph-zoom #hzLyrB{font-size:20px}`; document.head.appendChild(s); }
// tasto ◧ sopra lo zoom
{ const z=document.getElementById('phZoom'); if(z){ const b=document.createElement('button'); b.type='button'; b.id='hzLyrB'; b.setAttribute('aria-label','Livelli della mappa'); b.textContent='◧';
    b.addEventListener('pointerdown',e=>e.stopPropagation()); b.onclick=e=>{ e.stopPropagation(); pannello(); }; z.prepend(b); } }
})();
