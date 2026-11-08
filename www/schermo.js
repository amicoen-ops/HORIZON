// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// SCHERMO. · Tema PIENO SOLE: testi bianchi e più spessi, bordi più chiari, contrasto dello strumento un po' più alto,
//   per leggere con il sole sullo schermo (Impostazioni › Interfaccia, o «In volo»).
// · Tablet in orizzontale: accanto all'orizzonte, a scelta, la mappa (come prima) o gli stimati (aggiornati ogni 5 s).
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
{ const orig=PH.layout; PH.layout=function(){ orig.apply(this,arguments);
    const on=PH.split && PH.panel2==='stimati';
    if(u2){ if(on){ u2.hidden=true; p2.style.width=u2.style.width; p2.style.height=u2.style.width; } }
    p2.hidden=!on; if(on) riempi(); }; }
setInterval(()=>{ try{ riempi(); }catch(e){} },5000);
PH.panel2Set=function(v){ PH.panel2=v; lsSet('ia517p_panel2',v); PH.layout(); };

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
