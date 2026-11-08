// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// SCHERMO. · Tema PIENO SOLE: testi bianchi e più spessi, bordi più chiari, contrasto dello strumento un po' più alto,
//   per leggere con il sole sullo schermo (Impostazioni › Interfaccia, o «In volo»).
// · Tablet in orizzontale: accanto all'orizzonte, a scelta, la mappa (come prima) o gli stimati (aggiornati ogni 5 s).
// · Tablet: un tocco sulla finestra grande scambia mappa e orizzonte; la riga centrale si trascina per allargare o
//   stringere le finestre (doppio tocco sulla riga: larghezza automatica).
(function(){
'use strict';
PH.sole=lsGet('ia517p_sole',false);
PH.panel2=lsGet('ia517p_panel2','mappa');
{ const s=document.createElement('style'); s.textContent=`
  body.hz-sole{--ink:#ffffff;--dim:#dfe5ea;--line:#5a6676}
  body.hz-sole .ph-card span,body.hz-sole .ph-card small,body.hz-sole .ph-sub,body.hz-sole .ph-row small{color:#e9eef2!important;font-weight:700}
  body.hz-sole .ph-card b{font-weight:800}
  body.hz-sole .ph-card,body.hz-sole .ph-imp section,body.hz-sole .ph-btn,body.hz-sole .ph-nav button{border-width:2px;border-color:#6b7889}
  body.hz-sole .unit canvas{filter:contrast(1.18) saturate(1.15) brightness(1.06)}
  body.hz-sole .ph-stat i{font-weight:800}
  #hzP2{position:relative;overflow:auto;border-radius:18px;border:1px solid #28323c;background:#0f1419;flex:none}
  #hzP2[hidden]{display:none} #hzP2 .ph-imp{padding:10px}`; document.head.appendChild(s); }
function applica(){ document.body.classList.toggle('hz-sole',!!PH.sole); }
applica();
PH.soleSet=function(v){ PH.sole=!!v; lsSet('ia517p_sole',PH.sole); applica(); toastShow(PH.sole?'TEMA PIENO SOLE':'TEMA NORMALE'); };

// ---- pannello accanto all'orizzonte (tablet) ----
const u2=document.getElementById('unit2');
const p2=document.createElement('div'); p2.id='hzP2'; p2.hidden=true; if(u2) u2.after(p2);
function riempi(){
  if(p2.hidden||!PH.stimHtml) return;
  const tmp=document.createElement('div'); tmp.innerHTML=PH.stimHtml(); const b=tmp.querySelector('.ph-imp');
  const y=p2.scrollTop; p2.innerHTML=''; if(b) p2.appendChild(b); p2.scrollTop=y;
  const f=p2.querySelector('#hzStF'); if(f) f.onclick=()=>PH.freqOpen&&PH.freqOpen();
  const n=p2.querySelector('#hzStN'); if(n) n.onclick=()=>PH.noteOpen&&PH.noteOpen();
}
// ---- disposizione per tablet ----
// Orizzontale: colonna sinistra con orizzonte + dati e tasti sotto, a destra la mappa (o gli stimati) a tutta altezza.
// Verticale: in alto orizzonte e mappa affiancati, sotto dati e tasti più grandi.
const side=document.querySelector('.ph-side'), un=document.getElementById('unit');
function tablet(){
  const vw=innerWidth, vh=innerHeight, tab=Math.min(vw,vh)>=700 && PH.ui!=='simple', land=vw>vh*1.15, on=tab&&PH.splitOn!==false;
  document.body.classList.toggle('hz-tab-l',on); document.body.classList.toggle('hz-narrow',on&&!land);
  if(!on){ if(side) side.style.width=''; un.style.height=''; un.style.aspectRatio=''; divisore(0); return; }
  PH.split=true; if(u2) u2.hidden=false;
  // colonna sinistra: orizzonte + dati e tasti; a destra la mappa (o gli stimati) a tutta altezza.
  // Larghezza della colonna: automatica, oppure quella scelta trascinando la riga centrale (PH.splitR, quota dello schermo).
  const r=+PH.splitR||0;
  let A=Math.floor(land?vw*0.42:(vw-28)/2), U;
  if(r){ A=Math.round(Math.max(260,Math.min(vw-300,vw*r)));
    if(side) side.style.width=A+'px'; const sh=side?side.offsetHeight:380; U=Math.max(220,Math.min(A,vh-sh-40)); }
  else { for(let i=0;i<2;i++){ if(side) side.style.width=A+'px'; const sh=side?side.offsetHeight:380; A=Math.max(280,Math.floor(Math.min(land?vw*0.46:(vw-28)/2,vh-sh-40))); } U=A; }
  // finestra piccola: larga quanto la colonna; se l'altezza non basta per un quadrato diventa un rettangolo (mappa piena)
  const box=h=>{ un.style.width=A+'px'; un.style.height=h+'px'; un.style.aspectRatio=h<A?'auto':''; };
  box(U); if(side) side.style.width=A+'px';
  for(let i=0;i<2;i++){ const bot=side?side.getBoundingClientRect().bottom:0, over=Math.max(document.documentElement.scrollHeight-vh,bot-vh+6); if(over<=0) break;
    U=Math.max(r?200:280,U-over-4); if(!r){ A=U; if(side) side.style.width=A+'px'; } box(U); }
  divisore(A,vh);
  const mw=Math.floor(vw-A-32), mh=Math.floor(vh-16);
  for(const x of [u2,p2]){ if(!x) continue; x.style.width=mw+'px'; x.style.height=mh+'px'; }
}
// ---- riga centrale da trascinare: allarga o stringe la colonna dell'orizzonte (doppio tocco: automatica) ----
PH.splitR=lsGet('ia517p_split_r',0);
const dv=document.createElement('div'); dv.id='hzDiv'; dv.hidden=true; dv.setAttribute('role','separator'); dv.setAttribute('aria-label','Trascina per cambiare la larghezza delle finestre'); dv.innerHTML='<i></i>';
document.body.appendChild(dv);
function divisore(A,vh){ if(!A){ dv.hidden=true; return; } dv.hidden=false; dv.style.left=(8+A+6-14)+'px'; }
{ let drag=null, raf=0, lastTap=0;
  dv.addEventListener('pointerdown',e=>{ e.preventDefault(); e.stopPropagation(); dv.setPointerCapture(e.pointerId); drag={x:e.clientX}; dv.classList.add('on');
    const now=performance.now(); if(now-lastTap<350){ PH.splitR=0; lsSet('ia517p_split_r',0); drag=null; dv.classList.remove('on'); PH.layout(); toastShow('FINESTRE: LARGHEZZA AUTOMATICA'); } lastTap=now; });
  dv.addEventListener('pointermove',e=>{ if(!drag) return; drag.x=e.clientX; if(raf) return;
    raf=requestAnimationFrame(()=>{ raf=0; if(!drag) return; PH.splitR=Math.max(0.2,Math.min(0.75,(drag.x-14)/innerWidth)); PH.layout(); }); });
  const fine=()=>{ if(!drag) return; drag=null; dv.classList.remove('on'); lsSet('ia517p_split_r',PH.splitR); PH.act&&PH.act('larghezza finestre '+Math.round(PH.splitR*100)+'%'); };
  dv.addEventListener('pointerup',fine); dv.addEventListener('pointercancel',fine); }
// ---- tocco sulla finestra grande: scambia mappa e orizzonte ----
{ const cv=document.getElementById('pfd2'); let t=null, n=0;
  if(cv){ cv.addEventListener('pointerdown',e=>{ n++; t=n===1?{x:e.clientX,y:e.clientY,t:performance.now()}:null; });
    cv.addEventListener('pointermove',e=>{ if(t&&Math.abs(e.clientX-t.x)+Math.abs(e.clientY-t.y)>12) t=null; });
    cv.addEventListener('pointerup',e=>{ n=Math.max(0,n-1); const ok=t&&!PH.pinch&&performance.now()-t.t<450; t=null;
      if(!ok||!document.body.classList.contains('hz-tab-l')) return;
      try{ closeMenu(); }catch(x){} togglePage(); toastShow(PAGE==='pfd'?'GRANDE: MAPPA':'GRANDE: ORIZZONTE'); });
    cv.addEventListener('pointercancel',()=>{ n=0; t=null; }); } }
{ const orig=PH.layout; PH.layout=function(){ orig.apply(this,arguments);
    try{ tablet(); }catch(e){ console.error('tablet',e); }
    const on=PH.split && PH.panel2==='stimati';
    if(u2){ if(on){ u2.hidden=true; if(!document.body.classList.contains('hz-tab-l')){ p2.style.width=u2.style.width; p2.style.height=u2.style.width; } } }
    p2.hidden=!on; if(on) riempi(); }; }
{ const s=document.createElement('style'); s.textContent=`
  body.phone.hz-tab-l{display:grid!important;grid-template-columns:auto 1fr;grid-template-rows:auto 1fr;gap:8px 12px;align-items:start;justify-items:start;padding:8px;overflow:hidden}
  body.hz-tab-l #unit{grid-column:1;grid-row:1}
  body.hz-tab-l .ph-side{grid-column:1;grid-row:2;max-height:none;overflow:visible;max-width:none}
  body.hz-tab-l #unit2,body.hz-tab-l #hzP2{grid-column:2;grid-row:1/3;aspect-ratio:auto;max-width:none}
  html body.phone.hz-tab-l .ph-cards{grid-template-columns:repeat(4,minmax(0,1fr))}
  html body.phone.hz-tab-l .ph-nav{position:static;margin-top:0}
  body.phone.ph-land.hz-tab-l .ph-side{width:auto}
  html body.phone.hz-narrow.hz-tab-l .ph-cards{grid-template-columns:repeat(2,minmax(0,1fr))}
  #hzDiv{position:fixed;top:0;bottom:0;width:28px;z-index:30;cursor:col-resize;touch-action:none;display:flex;align-items:center;justify-content:center}
  #hzDiv[hidden]{display:none} #hzDiv i{display:block;width:6px;height:72px;border-radius:3px;background:#3a4a5a;box-shadow:0 0 0 1px #0a0f14}
  #hzDiv.on i,#hzDiv:hover i{background:#33e1ff;height:120px}
  body.ph-simple #hzDiv{display:none!important}`; document.head.appendChild(s); }
setInterval(()=>{ try{ riempi(); }catch(e){} },5000);
try{ PH.layout(); PH.zoomBtns&&PH.zoomBtns(); }catch(e){}
// la colonna dei dati cambia altezza in volo (riga degli spazi, avvisi, banner radio): si ridispone se esce dallo schermo
// o se lascia molto spazio vuoto (al massimo una volta ogni mezzo secondo)
if(side && window.ResizeObserver){ let tm=null; new ResizeObserver(()=>{ if(!document.body.classList.contains('hz-tab-l')||tm) return;
  tm=setTimeout(()=>{ tm=null; const bot=side.getBoundingClientRect().bottom; if(bot>innerHeight-4||bot<innerHeight-70) PH.layout(); },500); }).observe(side); }
PH.panel2Set=function(v){ PH.panel2=v; lsSet('ia517p_panel2',v); PH.layout(); };

// ---- mappa alta e stretta (tablet in verticale): aereo e riquadri in basso, sopra più strada davanti ----
function inBasso(fn){ return function(){ if(H>W*1.25 && R>50){ const c=CY; CY=H-R*1.02; try{ return fn.apply(this,arguments); } finally{ CY=c; } } return fn.apply(this,arguments); }; }
try{ drawMap=inBasso(drawMap); }catch(e){}
try{ if(PH.trfMap) PH.trfMap=inBasso(PH.trfMap); }catch(e){}
// ---- impostazioni: sotto «Interfaccia» ----
{ const orig=PH.renderImp; PH.renderImp=function(){ orig.apply(this,arguments);
    const sp=document.getElementById('phSplit'); if(!sp) return; const lab=sp.closest('label');
    const box=document.createElement('div'); box.innerHTML=`
      <div class="ph-seg" id="hzP2s">${[['mappa','Accanto: mappa'],['stimati','Accanto: stimati']].map(([k,l])=>`<button data-p="${k}" aria-pressed="${PH.panel2===k}">${l}</button>`).join('')}</div>
      <label class="ph-chk"><input type="checkbox" id="hzSole" ${PH.sole?'checked':''}> Tema pieno sole (testi bianchi e più spessi, più contrasto)</label>`;
    lab.after(box);
    box.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{ PH.panel2Set(b.dataset.p); box.querySelectorAll('[data-p]').forEach(x=>x.setAttribute('aria-pressed',x===b)); });
    document.getElementById('hzSole').onchange=e=>PH.soleSet(e.target.checked); }; }
})();
