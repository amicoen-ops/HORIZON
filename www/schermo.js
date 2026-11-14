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
  #hzDiv{position:fixed;top:0;bottom:0;width:28px;z-index:15;cursor:col-resize;touch-action:none;display:flex;align-items:center;justify-content:center}
  #hzDiv[hidden]{display:none} #hzDiv i{display:block;width:6px;height:72px;border-radius:3px;background:#3a4a5a;box-shadow:0 0 0 1px #0a0f14}
  #hzDiv.on i,#hzDiv:hover i{background:#33e1ff;height:120px}
  body.ph-simple #hzDiv{display:none!important}`; document.head.appendChild(s); }
// ---- SOLO ORIZZONTE a schermo pieno ----
// Per chi vuole soltanto l'orizzonte: lo strumento prende tutto lo schermo (nastri ai bordi, prua in fondo), senza caselle, tasti e menu.
// Si appoggia all'interfaccia semplice (niente mappa né rotta). Avvisi e bandierine restano; il tasto SOS resta in alto a sinistra.
// Si esce tenendo premuto 0,8 s sullo schermo: un tocco per sbaglio in turbolenza non fa niente.
PH.pieno=false;
{ const s=document.createElement('style'); s.textContent=`
  body.hz-pieno{overflow:hidden!important}
  body.hz-pieno #unit{position:fixed!important;inset:0!important;width:auto!important;height:auto!important;max-width:none!important;aspect-ratio:auto!important;border-radius:0!important;border:0!important;margin:0!important;z-index:12;background:#05070a}
  body.hz-pieno #unit canvas{left:env(safe-area-inset-left,0px)!important;top:env(safe-area-inset-top,0px)!important;width:calc(100% - env(safe-area-inset-left,0px) - env(safe-area-inset-right,0px))!important;height:calc(100% - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px))!important}
  body.hz-pieno .ph-side,body.hz-pieno #unit2,body.hz-pieno #hzP2,body.hz-pieno #hzDiv{display:none!important}
  #hzPnSos,#hzPnEsci{display:none}
  body.hz-pieno #hzPnSos{display:block;position:absolute;left:calc(8px + env(safe-area-inset-left,0px));top:calc(8px + env(safe-area-inset-top,0px));z-index:7;margin:0;min-height:46px;min-width:72px}
  body.ph-land.hz-pieno #hzPnSos{left:calc(23vh + env(safe-area-inset-left,0px))} body.ph-land.hz-pieno #hzPnEsci{right:calc(27vh + env(safe-area-inset-right,0px))}
  body.hz-pieno .menu{display:none!important}
  body.hz-pieno #hzPnEsci{display:block;position:absolute;right:calc(8px + env(safe-area-inset-right,0px));top:calc(10px + env(safe-area-inset-top,0px));z-index:6;pointer-events:none;font:700 11px system-ui,sans-serif;letter-spacing:.04em;color:#e9eef2;background:rgba(7,10,15,.55);border:1px solid rgba(255,255,255,.25);border-radius:8px;padding:5px 8px;overflow:hidden}
  #hzPnEsci::before{content:'';position:absolute;inset:0;background:#33e1ff;opacity:.45;transform:scaleX(0);transform-origin:left}
  #hzPnEsci.hold::before{transform:scaleX(1);transition:transform 800ms linear}
  #hzPnBtn{display:none;flex:none;min-height:40px;min-width:44px;margin-left:6px;border-radius:10px;border:2px solid #3a4a5a;background:#121c25;color:#e9eef2;font:800 18px system-ui,sans-serif;cursor:pointer}
  body.ph-simple #hzPnBtn{display:inline-block}
  #hzPnGo{width:100%;min-height:54px;margin:8px 0 2px}`; document.head.appendChild(s); }
{ const sos=document.createElement('button'); sos.type='button'; sos.id='hzPnSos'; sos.className='hz-sos'; sos.textContent='SOS'; sos.setAttribute('aria-label','Emergenza: tieni premuto');
  const esci=document.createElement('div'); esci.id='hzPnEsci'; esci.textContent='TIENI PREMUTO PER USCIRE'; un.appendChild(sos); un.appendChild(esci);
  // pressione lunga: parte dopo ms, si annulla se il dito si alza o si sposta
  // Sullo schermo pieno i tocchi non arrivano allo strumento (niente menu né manopola per sbaglio): contano solo SOS, avvisi e domande.
  const libero=t=>!!(t&&t.closest&&t.closest('.prompt,.ph-flags,.ph-alert,.ph-wait'));
  let t=0, p=null, chi=null;
  const via=()=>{ if(t){ clearTimeout(t); t=0; } p=null; if(chi) chi.classList.remove('hold'); chi=null; };
  un.addEventListener('pointerdown',e=>{ if(!PH.pieno||libero(e.target)) return; e.stopPropagation(); via();
    const suSos=e.target===sos; chi=suSos?sos:esci; p={x:e.clientX,y:e.clientY}; chi.classList.add('hold');
    t=setTimeout(()=>{ via(); PH.pienoSet(false); if(suSos){ try{ PH.emerg?PH.emergOpen():PH.emergStart(); }catch(x){} } },800); },true);
  un.addEventListener('pointermove',e=>{ if(!PH.pieno||libero(e.target)) return; e.stopPropagation(); if(p&&Math.abs(e.clientX-p.x)+Math.abs(e.clientY-p.y)>18) via(); },true);
  for(const n of ['pointerup','pointercancel']) un.addEventListener(n,e=>{ if(!PH.pieno&&!p) return; via(); if(PH.pieno&&!libero(e.target)) e.stopPropagation(); },true);
  for(const n of ['click','wheel','keydown']) un.addEventListener(n,e=>{ if(PH.pieno&&!libero(e.target)) e.stopPropagation(); },true); }
PH.pienoSet=function(v,zitto){ v=!!v; if(v===PH.pieno) return;
  if(v){ try{ closeMenu(); }catch(e){} lsSet('ia517p_pieno_prima',PH.ui); if(PH.ui!=='simple') PH.setUi('simple'); try{ PH.moreOpen&&PH.moreOpen(false); }catch(e){} PH.pieno=true; PH.show('volo'); }
  else PH.pieno=false;
  lsSet('ia517p_pieno',PH.pieno); document.body.classList.toggle('hz-pieno',PH.pieno);
  try{ const d=document, r=d.documentElement;                      // via anche le barre del browser, dove si può (serve un tocco: all'avvio non riesce, e va bene)
    if(PH.pieno){ if(!d.fullscreenElement&&r.requestFullscreen){ const q=r.requestFullscreen(); if(q&&q.catch) q.catch(()=>{}); } }
    else if(d.fullscreenElement&&d.exitFullscreen){ const q=d.exitFullscreen(); if(q&&q.catch) q.catch(()=>{}); } }catch(e){}
  if(!PH.pieno && !zitto && lsGet('ia517p_pieno_prima','simple')==='full') PH.setUi('full');
  try{ window.phPieno(PH.pieno); }catch(e){}
  PH.layout(); PH.act&&PH.act('solo orizzonte '+(PH.pieno?'acceso':'spento'));
  if(!zitto) toastShow(PH.pieno?'SOLO ORIZZONTE · TIENI PREMUTO PER USCIRE':'SCHERMO NORMALE'); };
// se qualcosa porta a un'altra pagina o all'interfaccia completa, lo schermo pieno si toglie da solo
{ const su=PH.setUi; PH.setUi=function(u){ if(PH.pieno&&u!=='simple') PH.pienoSet(false,true); return su.apply(this,arguments); };
  const sh=PH.show; PH.show=function(v){ if(PH.pieno&&v!=='volo') PH.pienoSet(false,true); return sh.apply(this,arguments); }; }
// tasto ⛶ accanto a SOS (solo nell'interfaccia semplice) e tasto in Impostazioni › Interfaccia
{ const dopo=document.getElementById('hzSos')||document.getElementById('phLvl');
  if(dopo){ const b=document.createElement('button'); b.type='button'; b.id='hzPnBtn'; b.textContent='⛶'; b.title='Solo orizzonte a schermo pieno'; b.setAttribute('aria-label','Solo orizzonte a schermo pieno'); b.onclick=()=>PH.pienoSet(true); dopo.after(b); }
  const ri=PH.renderImp; PH.renderImp=function(){ ri.apply(this,arguments);
    const ui=document.getElementById('phUi'); if(!ui||document.getElementById('hzPnGo')) return;
    const b=document.createElement('button'); b.type='button'; b.className='ph-btn'; b.id='hzPnGo'; b.textContent='⛶ SOLO ORIZZONTE A SCHERMO PIENO'; b.onclick=()=>PH.pienoSet(true);
    const p=document.createElement('p'); p.className='ph-sub'; p.innerHTML='<b>Solo orizzonte</b>: lo strumento prende tutto lo schermo, con velocità, quota, vario e prua. Niente caselle, tasti e menu. Avvisi e tasto SOS restano. Per uscire tieni premuto lo schermo per un secondo.';
    const sec=ui.closest('section')||ui.parentNode; sec.appendChild(b); sec.appendChild(p); }; }
if(lsGet('ia517p_pieno',false)) setTimeout(()=>{ try{ PH.pienoSet(true,true); }catch(e){ console.error('pieno',e); } },0);
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
