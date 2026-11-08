// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// LIVELLI DELLA MAPPA. Tasto ◧ accanto allo zoom: pannello a tasti grandi per accendere e spegnere spazi aerei, traffico,
// campi, zona di planata, punti di riporto VFR e scia del traffico, e per cambiare la mappa di base.
// Spazi aerei sulla mappa dello strumento: contorni colorati per classe sotto campi e rotta. «Solo vicini alla mia quota»:
// quelli che toccano la tua quota (±1000 ft) in pieno, gli altri appena accennati (come lo Smart Airspace dei Garmin).
// Spegnere un livello toglie solo il disegno: gli avvisi (spazi, traffico, terreno) restano sempre.
(function(){
'use strict';
const KEY='ia517p_lyr';
PH.lyr=Object.assign({asp:true,aspSmart:true,trf:true,campi:true,vrp:true,scia:true},lsGet(KEY,{}));
const salva=()=>lsSet(KEY,PH.lyr);
const COL=c=>{ c=String(c||'').toUpperCase(); if(/^(P|R)$/.test(c)) return [255,77,77]; if(/^(CTR|A|B|C|D)$/.test(c)) return [79,155,255];
  if(/^(E|RMZ|TMZ)$/.test(c)) return [181,140,255]; if(/^(Q|DANGER)$/.test(c)) return [255,197,49]; if(c==='OFR') return [255,140,60]; return [150,160,172]; };

// ---- spazi aerei sulla mappa ----
let cache={t:0,key:'',list:[]};
const enuC=new WeakMap();                                         // contorni in metri, calcolati una volta per spazio
function pts(a){ let v=enuC.get(a); if(v&&v.o===ORIGIN.lat+','+ORIGIN.lon) return v.p; const p=a.pts.map(q=>enu(q.lat,q.lon)); enuC.set(a,{o:ORIGIN.lat+','+ORIGIN.lon,p}); return p; }
function visibili(c,rng){
  const now=performance.now(), key=Math.round(c.E/2000)+','+Math.round(c.N/2000)+','+rng;
  if(now-cache.t<1500 && cache.key===key) return cache.list;
  const out=[], ll={lat:ORIGIN.lat+c.N/110540, lon:ORIGIN.lon+c.E/(111320*Math.cos(ORIGIN.lat*D2R))}, dLa=rng*1.8/110540, dLo=rng*1.8/(111320*Math.cos(ll.lat*D2R));
  for(const a of (PH.aspList?PH.aspList():[])){ const bb=a.bb; if(!bb||!a.pts||a.pts.length<3) continue; if(/^(FIR|UIR)$/i.test(a.cls)) continue;
    if(bb[1]<ll.lat-dLa||bb[0]>ll.lat+dLa||bb[3]<ll.lon-dLo||bb[2]>ll.lon+dLo) continue;
    if(a.lo&&a.lo.ref!=='AGL'&&a.lo.ft>15000) continue; out.push(a); }
  cache={t:now,key,list:out}; return out;
}
PH.mapUnder=function(toS,sc,c){
  if(!PH.lyr.asp) return;
  const rng=ZOOMS[zi]*1000, list=visibili(c,rng); if(!list.length){ try{ PH.vrpDraw&&PH.vrpDraw(toS); }catch(e){} return; }
  const alt=S.alt, z0=terrain(...xy(enu(S.lat,S.lon))), gFt=z0===z0?z0/FT2M:0;
  const lim=L=>L.ref==='AGL'?(L.ft?L.ft+gFt:-1e9):L.ft;
  const R0=window.IA517_RULES; let labels=0;
  ctx.save(); ctx.lineJoin='round';
  for(const a of list){
    const lo=lim(a.lo), hi=lim(a.hi), vicino=lo<=alt+1000 && hi>=alt-1000, dentroQ=lo<=alt+50&&hi>=alt-50;
    const dim=PH.lyr.aspSmart && !vicino, [r,g,b]=COL(a.cls), off=R0&&R0.inattiva&&R0.inattiva(a);
    const P=pts(a).map(p=>toS(p.E,p.N));
    ctx.beginPath(); P.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.closePath();
    if(!dim){ let bad=false; try{ bad=R0&&R0.verdict(a).status==='bad'; }catch(e){}
      ctx.fillStyle=`rgba(${r},${g},${b},${bad&&dentroQ?0.16:0.06})`; ctx.fill(); }
    ctx.setLineDash(off?[6*k,6*k]:[]); ctx.strokeStyle=`rgba(${r},${g},${b},${dim?0.22:0.9})`; ctx.lineWidth=(dim?1:2.4)*k; ctx.stroke();
    // nome e limiti degli spazi vicini alla quota (al massimo 8, solo con zoom stretto)
    if(!dim && labels<8 && ZOOMS[zi]<=30){ const vis=P.filter(p=>p.x>0&&p.x<W&&p.y>0&&p.y<H); if(vis.length){
        const q=vis[Math.floor(vis.length/2)]; ctx.setLineDash([]); ctx.font=font(R*0.034,'700'); ctx.textAlign='left'; ctx.textBaseline='middle';
        const tx=`${a.cls} ${String(a.name||'').slice(0,18)} ${a.lo.txt}–${a.hi.txt}`; ctx.lineWidth=3*k; ctx.strokeStyle='rgba(0,0,0,.8)'; ctx.fillStyle=`rgb(${r},${g},${b})`;
        ctx.strokeText(tx,q.x+4,q.y); ctx.fillText(tx,q.x+4,q.y); labels++; } }
  }
  ctx.setLineDash([]); ctx.restore();
  try{ PH.vrpDraw&&PH.vrpDraw(toS); }catch(e){}
};

// ---- pannello LIVELLI ----
const BASI=['topo','osm','igm','orto','esri','dem'];
function basi(){ return BASI.filter(b=>PH.BASES[b]&&!(PH.BASES[b].key&&!PH.esriKey)); }
function pannello(){
  let d=document.getElementById('hzLyr'); if(d) d.remove();
  d=document.createElement('div'); d.className='ph-more'; d.id='hzLyr';
  const T=(k,l,s)=>`<button type="button" data-l="${k}" class="${PH.lyr[k]!==false?'on':''}"><i>${PH.lyr[k]!==false?'✓':'—'}</i>${l}${s?`<small>${s}</small>`:''}</button>`;
  d.innerHTML=`<div class="ph-more-g hz-lyr">
    ${T('asp','SPAZI AEREI')}${T('aspSmart','SOLO VICINI','alla mia quota ±1000 ft')}
    ${T('trf','TRAFFICO','gli avvisi restano')}${T('scia','SCIA TRAFFICO')}
    ${T('campi','CAMPI')}${T('vrp','PUNTI VFR','di riporto')}
    <button type="button" data-l="planata" class="${PH.glideOn?'on':''}"><i>${PH.glideOn?'✓':'—'}</i>PLANATA<small>zona raggiungibile</small></button>
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
