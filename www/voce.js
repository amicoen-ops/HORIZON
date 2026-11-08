// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// A VOCE E SCADENZE.
// · Check list letta a voce: in ogni fase il tasto «🔊 LEGGI» dice la prima voce non spuntata; FATTO la spunta e passa
//   alla successiva, RIPETI la ridice. Mani libere durante i controlli.
// · METAR letto a voce: nel Piano (tasto 🔊 su ogni METAR) e nella pagina del vento.
// · Scadenze (Impostazioni › Diario di volo): certificato medico, attestato, assicurazione, revisione del velivolo, con la data.
//   Avviso a terra all'avvio quando una scade entro 30 giorni o è scaduta. Mai in volo.
// · Diario: tasto 3D per rivedere un volo nella vista 3D degli spazi aerei.
(function(){
'use strict';
const esc=x=>String(x??'').replace(/[<&>"]/g,c=>({'<':'&lt;','&':'&amp;','>':'&gt;','"':'&quot;'}[c]));
// parla anche con la voce degli avvisi spenta: l'ha chiesto il pilota con un tasto
PH.sayNow=function(t){ const v=PH.voice; PH.voice=true; try{ PH.say(t,true); }finally{ PH.voice=v; } };

// ---- check list a voce ----
let guida=null;                                                   // {sec, i}
function voci(sec){ return [...sec.querySelectorAll('[data-ck]')]; }
function barra(){ let b=document.getElementById('hzChkV'); const d=document.getElementById('hzChk');
  if(!guida||!d||!guida.sec.isConnected){ if(b) b.remove(); guida=null; return null; }
  if(!b){ b=document.createElement('div'); b.id='hzChkV'; d.appendChild(b); }
  return b; }
function dici(){ const b=barra(); if(!b) return;
  const L=voci(guida.sec), c=L.find(x=>!x.checked);
  if(!c){ b.innerHTML=`<span>✓ Fase completata</span><button type="button" data-v="stop">CHIUDI</button>`; PH.sayNow('fase completata'); wire(b); return; }
  const t=c.closest('label').textContent.trim(); guida.c=c;
  b.innerHTML=`<span>🔊 ${esc(t)}</span><button type="button" data-v="ok" class="pri">FATTO</button><button type="button" data-v="rip">RIPETI</button><button type="button" data-v="stop">STOP</button>`;
  wire(b); PH.sayNow(t); c.closest('label').scrollIntoView({block:'center',behavior:'smooth'}); }
function wire(b){ b.querySelectorAll('[data-v]').forEach(x=>x.onclick=()=>{ const k=x.dataset.v;
  if(k==='ok'&&guida&&guida.c){ guida.c.checked=true; guida.c.dispatchEvent(new Event('change')); dici(); }
  if(k==='rip') dici();
  if(k==='stop'){ guida=null; b.remove(); try{ speechSynthesis.cancel(); }catch(e){} } }); }
{ const prev=PH.chkOpen; if(prev) PH.chkOpen=function(){ const r=prev.apply(this,arguments);
    const d=document.getElementById('hzChk');
    if(d) d.querySelectorAll('.hz-fase').forEach(sec=>{ const h=sec.querySelector('h3'); if(!h||h.querySelector('.hz-say')) return;
      const b=document.createElement('button'); b.type='button'; b.className='ph-btn hz-say'; b.textContent='🔊 LEGGI';
      b.onclick=e=>{ e.preventDefault(); e.stopPropagation(); guida={sec}; dici(); }; h.appendChild(b); });
    return r; }; }

// ---- METAR a voce ----
PH.metarSay=function(frase){ if(frase) PH.sayNow(frase); };
{ const prev=PH.ventoOpen; if(prev) PH.ventoOpen=function(f){ const r=prev.apply(this,arguments);
    const d=document.getElementById('hzVento'); if(!d) return r;
    const add=()=>{ const M=PH.metarDi&&PH.metarDi(f||NAV.dest); const sec=d.querySelector('.ph-imp section'); if(!M||!M.say||!sec||sec.querySelector('.hz-msay')) return;
      const p=document.createElement('div'); p.className='ph-btns hz-msay'; p.innerHTML=`<button type="button" class="ph-btn">🔊 Leggi il METAR ${esc(M.id)}</button>`;
      p.firstChild.onclick=()=>PH.metarSay(M.say); sec.appendChild(p); };
    add(); new MutationObserver(add).observe(d,{childList:true,subtree:false}); return r; }; }

// ---- scadenze ----
const SK='ia517p_scad', VOCI=[['med','Certificato medico'],['att','Attestato VDS / licenza'],['ass','Assicurazione'],['rev','Revisione o manutenzione del velivolo'],['alt','Altra scadenza']];
const get=()=>lsGet(SK,{}), giorni=d=>Math.ceil((new Date(d+'T23:59:59')-Date.now())/86400e3);
PH.scadenze=function(){ const S0=get(); return VOCI.filter(([k])=>S0[k]&&S0[k].d).map(([k,l])=>({k,l:S0[k].n||l,d:S0[k].d,g:giorni(S0[k].d)})).sort((a,b)=>a.g-b.g); };
function recenti(){ const book=lsGet('ia517p_logbook',[]), t=Date.now()-90*86400e3; const v=book.filter(f=>f.start>=t);
  return {n:v.length,ult:book[0]?Math.floor((Date.now()-book[0].start)/86400e3):null}; }
function scadHtml(){ const S0=get(), r=recenti();
  return `<div id="hzScad"><h4 class="hz-sch">Scadenze</h4>
  ${VOCI.map(([k,l])=>{ const v=S0[k]||{}, g=v.d?giorni(v.d):null, cls=g==null?'':(g<0?'no':(g<=30?'att':'ok'));
    return `<label class="hz-sc ${cls}"><span>${k==='alt'?`<input type="text" data-n="${k}" value="${esc(v.n||'')}" placeholder="${l}">`:esc(l)}<small>${g==null?'nessuna data':(g<0?'SCADUTA da '+(-g)+' giorni':(g===0?'scade OGGI':'tra '+g+' giorni'))}</small></span><input type="date" data-d="${k}" value="${esc(v.d||'')}"></label>`; }).join('')}
  <p class="ph-sub">Voli negli ultimi 90 giorni: <b>${r.n}</b>${r.ult!=null?` · ultimo ${r.ult===0?'oggi':r.ult+' giorni fa'}`:''}. All'avvio, a terra, l'app avvisa se una data scade entro 30 giorni. Controlla le regole per il trasporto del passeggero.</p><h4 class="hz-sch">Voli</h4></div>`; }
function scadWire(sec){ sec.querySelectorAll('[data-d],[data-n]').forEach(i=>i.onchange=()=>{ const S0=get(), k=i.dataset.d||i.dataset.n; S0[k]=S0[k]||{};
  if(i.dataset.d) S0[k].d=i.value; else S0[k].n=i.value; if(!S0[k].d&&!S0[k].n) delete S0[k]; lsSet(SK,S0); const n=document.createElement('div'); n.innerHTML=scadHtml(); sec.replaceWith(n.firstElementChild); scadWire(document.getElementById('hzScad')); }); }
// nel diario: scadenze in cima e tasto 3D per ogni volo con la traccia
{ const prev=PH.renderLog; if(prev) PH.renderLog=function(){ const r=prev.apply(this,arguments);
    const box=document.getElementById('phLog'); if(!box) return r;
    const old=document.getElementById('hzScad'); if(old) old.remove();
    const w=document.createElement('div'); w.innerHTML=scadHtml(); const sec=w.firstElementChild;
    box.before(sec); scadWire(sec);
    const book=lsGet('ia517p_logbook',[]);
    box.querySelectorAll('[data-show]').forEach(b=>{ if(b.nextElementSibling&&b.nextElementSibling.dataset.r3) return; const f=book[+b.dataset.show]; if(!f) return;
      const x=document.createElement('button'); x.className='ph-btn'; x.type='button'; x.dataset.r3=b.dataset.show; x.textContent='3D';
      x.onclick=()=>{ try{ if(PH.ui==='simple') PH.setUi('full'); PH.show('piano'); const fr=document.getElementById('phAppFrame').contentWindow;
        const go=()=>fr.SP3D_replay?fr.SP3D_replay(f):setTimeout(go,300); go(); }catch(e){ toast('3D NON DISPONIBILE'); } };
      b.after(x); });
    return r; }; }
// avviso all'avvio, solo a terra
setTimeout(()=>{ try{ if(PH_air()) return; const L=PH.scadenze().filter(s=>s.g<=30); if(!L.length) return;
  const s=L[0]; toast(`${s.l.toUpperCase()}: ${s.g<0?'SCADUTO':(s.g===0?'SCADE OGGI':'SCADE TRA '+s.g+' GIORNI')}${L.length>1?' (+'+(L.length-1)+')':''}`); }catch(e){} },9000);

{ const s=document.createElement('style'); s.textContent=`
  .hz-fase h3 .hz-say{float:right;min-height:40px;font-size:14px;margin-top:-6px}
  #hzChkV{position:fixed;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom,0px));z-index:70;display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px;border-radius:14px;background:#0f2433;border:2px solid #33e1ff;box-shadow:0 6px 30px rgba(0,0,0,.6)}
  #hzChkV span{flex:1 1 100%;font:700 18px system-ui,sans-serif;color:#fff}
  #hzChkV button{flex:1;min-height:60px;border-radius:12px;border:2px solid #3a4a5a;background:#1b2530;color:#eef3f8;font:800 17px 'Oxanium',system-ui,sans-serif}
  #hzChkV button.pri{border-color:#3ddc84;color:#3ddc84}
  .hz-sch{margin:6px 0 2px;font:800 13px system-ui,sans-serif;letter-spacing:.08em;color:#7fe0ff;text-transform:uppercase}
  .hz-sc{display:flex;justify-content:space-between;align-items:center;gap:10px;min-height:56px;border-bottom:1px solid #1f2830}
  .hz-sc span{display:flex;flex-direction:column;font:600 15px system-ui,sans-serif} .hz-sc small{color:#9aa4b0;font-size:12px}
  .hz-sc.att small{color:#ffc531} .hz-sc.no small{color:#ff5a5a;font-weight:800} .hz-sc.ok small{color:#3ddc84}
  .hz-sc input[type=date]{min-height:44px;font-size:15px;background:#121c25;color:#eef3f8;border:1px solid #3a4a5a;border-radius:8px;padding:0 6px}
  .hz-sc input[type=text]{min-height:36px;font-size:15px;background:#121c25;color:#eef3f8;border:1px solid #3a4a5a;border-radius:8px;padding:0 6px}`; document.head.appendChild(s); }
})();
