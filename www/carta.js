// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// CARTA VFR open flightmaps come mappa di base. App Android: plugin Carta (CartaPlugin.java). Versione web: worker
// carta-web.js con SQLite per il browser (sqlite3.js/.wasm) e la memoria privata del sito; su iPhone serve la schermata Home. Il pacchetto ufficiale dell'Italia (MBTiles, circa
// 105 MB, zoom 4–11) si scarica una volta col Wi-Fi dall'archivio di open flightmaps e resta sul telefono: si vola anche
// senza internet. A ogni ciclo AIRAC (28 giorni) l'app dice che c'è quella nuova. Licenza OFMA: «open flightmaps
// association / www.openflightmaps.org». Si sceglie da LIVELLI › MAPPA o da Impostazioni › Mappa di base.
(function(){
'use strict';
const NOME='li', esc=x=>String(x??'').replace(/[<&>"]/g,c=>({'<':'&lt;','&':'&amp;','>':'&gt;','"':'&quot;'}[c]));
const nativo=(()=>{ try{ const C=window.Capacitor; if(!PH.native) return null; return (C.Plugins&&C.Plugins.Carta)||C.registerPlugin('Carta'); }catch(e){ return null; } })();
// versione web: stesso lavoro in un worker (carta-web.js) con SQLite per il browser e la memoria privata del sito (OPFS)
PH.cartaWebOk=!nativo && typeof Worker!=='undefined' && !!(navigator.storage&&navigator.storage.getDirectory);
const web=PH.cartaWebOk?(()=>{ let w=null, n=0; const att={}, asc=[];
  const lavoratore=()=>{ if(w) return w; w=new Worker('carta-web.js',{type:'module'});
    w.onmessage=ev=>{ const m=ev.data||{}; if(m.prog){ asc.forEach(f=>f({done:m.prog[0],total:m.prog[1]})); return; } const p=att[m.id]; if(!p) return; delete att[m.id]; m.ok?p.ok(m.r):p.no(new Error(m.e)); };
    w.onerror=e=>{ Object.values(att).forEach(p=>p.no(new Error('carta: '+(e.message||'errore del worker')))); for(const k in att) delete att[k]; w=null; };
    return w; };
  const chiama=(op,a)=>new Promise((ok,no)=>{ const id=++n; att[id]={ok,no}; lavoratore().postMessage({id,op,a}); });
  return { info:()=>chiama('info'), tile:a=>chiama('tile',a), cancella:a=>chiama('cancella',a),
    scarica:async a=>{ try{ await navigator.storage.persist(); }catch(e){}
      try{ const q=await navigator.storage.estimate(); if(q.quota && q.quota-(q.usage||0)<130*1048576) throw new Error('spazio insufficiente nel browser'); }catch(e){ if(/spazio/.test(e.message)) throw e; }
      const m=/live\/(\d{4})\//.exec(a.url); return chiama('scarica',Object.assign({versione:m?m[1]:'0000'},a)); },
    addListener:async(ev,f)=>{ asc.push(f); return {remove(){ const i=asc.indexOf(f); if(i>=0) asc.splice(i,1); }}; } }; })():null;
const plug=nativo||web;
PH.BASES.ofm={name:'Carta VFR open flightmaps',min:4,max:11,local:true,attr:'open flightmaps association · www.openflightmaps.org'};
PH.cartaOk=false; PH.carta=null;
// ciclo AIRAC (es. 2611): cicli di 28 giorni dal 2 gennaio 2020 (ciclo 2001), come gli spazi aerei
PH.airac=function(dietro){ const d0=Date.UTC(2020,0,2), g=864e5*28; let t=d0; while(t+g<=Date.now()) t+=g; t-=g*(dietro||0);
  const d=new Date(t), y=d.getUTCFullYear(); let k=0, x=t; while(x>=Date.UTC(y,0,1)){ k++; x-=g; } return String(y%100).padStart(2,'0')+String(k).padStart(2,'0'); };
const url=a=>`https://storage.googleapis.com/snapshots.openflightmaps.org/live/${a}/tiles/li/noninteractive/epsg3857/li_256.mbtiles`;
const KW='ia517p_carta_web', segno=v=>{ try{ v?localStorage.setItem(KW,'1'):localStorage.removeItem(KW); }catch(e){} }, ha=()=>{ try{ return localStorage.getItem(KW)==='1'; }catch(e){ return true; } };
async function aggiorna(){ if(!plug) return; if(!nativo && !ha()){ PH.carta=null; PH.cartaOk=false; return; }   // web: SQLite si carica solo se la carta c'è
  try{ const r=await plug.info(); PH.carta=(r.carte||[]).find(c=>c.nome===NOME)||null; PH.cartaOk=!!PH.carta; if(!nativo) segno(PH.cartaOk); }catch(e){ PH.cartaOk=false; } }
aggiorna();
PH.cartaTile=async function(z,x,y){ if(!plug||!PH.cartaOk) return null; try{ const r=await plug.tile({nome:NOME,z,x,y}); return r&&r.data||null; }catch(e){ return null; } };
let busy=false;
PH.cartaPuo=!!plug;
// zitto=true: scarico automatico (anticipo.js), un errore non si dice a voce (il ciclo nuovo può non essere ancora pubblicato)
PH.cartaScarica=async function(onP,zitto){
  if(!plug){ if(!zitto) toast('CARTA VFR: NON DISPONIBILE IN QUESTO BROWSER'); return; } if(busy) return; busy=true;
  const lst=plug.addListener?await plug.addListener('progresso',p=>onP&&onP(p.done,p.total)):null;
  try{ for(const a of [PH.airac(0),PH.airac(1)]){ try{ await plug.scarica({url:url(a),nome:NOME}); if(!nativo) segno(true); await aggiorna(); toast('CARTA VFR SCARICATA · AIRAC '+a); PH.act&&PH.act('carta VFR '+a); return true; }catch(e){ if(a===PH.airac(1)) throw e;
      if(PH.carta && String(PH.carta.version)===PH.airac(1)) throw e; } } }   // il ciclo di prima è già sul telefono: non lo si riscarica sopra se stesso (uno scarico interrotto lascerebbe senza carta)
  catch(e){ if(!zitto) toast('CARTA VFR: '+String(e&&e.message||e).slice(0,60)); return false; }
  finally{ busy=false; try{ lst&&lst.remove(); }catch(e){} }
};
PH.cartaStato=function(){ if(!plug) return {txt:'Questo browser non può tenere la carta: usa l\'app Android, oppure Chrome o Safari aggiornati (su iPhone/iPad da iOS 16.4).',ok:false};
  const ios=/iPhone|iPad|Macintosh/.test(navigator.userAgent)&&'ontouchend' in document, home=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone;
  const nota=(!nativo&&ios&&!home)?' <b>Su iPhone/iPad aggiungi HORIZON alla schermata Home</b> (Condividi › Aggiungi alla schermata Home): altrimenti iOS può cancellare la carta se non usi il sito per qualche settimana.':'';
  if(!PH.carta) return {txt:'Non scaricata.'+nota,ok:false};
  const v=PH.carta.version||'?', nuovo=v!==PH.airac(0);
  return {txt:`Scaricata · AIRAC ${esc(v)} · ${(PH.carta.size/1048576).toFixed(0)} MB${nuovo?' · <b>c\'è il ciclo nuovo '+PH.airac(0)+': aggiornala</b>':''}${nota}`,ok:!nuovo}; };
// impostazioni: in «Volare senza internet»
{ const orig=PH.renderImp; PH.renderImp=function(){ orig.apply(this,arguments);
    const h=[...document.querySelectorAll('#phImpBody section')].find(s=>s.dataset.t==='Volare senza internet'||(s.querySelector('h3')&&s.querySelector('h3').textContent==='Volare senza internet')); if(!h) return;
    const host=h.querySelector('.hz-sb')||h, box=document.createElement('div'); box.className='hz-carta';
    const draw=()=>{ const s=PH.cartaStato();
      box.innerHTML=`<p class="ph-sub"><b>Carta VFR open flightmaps</b> (Italia, circa 105 MB): si scarica una volta col Wi-Fi e resta sul telefono. Si sceglie da ◧ LIVELLI › MAPPA. ${s.txt}</p>
      <div class="ph-btns">${plug?`<button class="ph-btn pri" type="button" id="hzCaGo">${PH.carta?'Aggiorna la carta':'Scarica la carta VFR'}</button>${PH.carta?'<button class="ph-btn" type="button" id="hzCaUse">Usala come mappa</button><button class="ph-btn" type="button" id="hzCaDel">Cancella</button>':''}`:''}</div>
      <p class="ph-sub" id="hzCaP"></p>`;
      const g=box.querySelector('#hzCaGo'); if(g) g.onclick=async()=>{
        if(PH.stato&&PH.stato.rete&&PH.stato.rete!=='WIFI' && !confirm('Non sei col Wi-Fi: scaricare circa 105 MB con i dati del telefono?')) return;
        g.disabled=true; const P=box.querySelector('#hzCaP');
        const ok=await PH.cartaScarica((d,t)=>{ P.textContent=t>0?`Scarico… ${Math.round(d/1048576)} di ${Math.round(t/1048576)} MB (${Math.round(d*100/t)}%)`:`Scarico… ${Math.round(d/1048576)} MB`; });
        if(ok&&PH.base!=='ofm'){ PH.base='ofm'; lsSet('ia517p_basemap','ofm'); MR.zi=-1; } draw(); };
      const u=box.querySelector('#hzCaUse'); if(u) u.onclick=()=>{ PH.base='ofm'; lsSet('ia517p_basemap','ofm'); MR.zi=-1; toast('MAPPA: CARTA VFR'); };
      const dl=box.querySelector('#hzCaDel'); if(dl) dl.onclick=async()=>{ if(!confirm('Cancellare la carta VFR dal telefono?')) return; try{ await plug.cancella({nome:NOME}); }catch(e){} if(PH.base==='ofm'){ PH.base='topo'; lsSet('ia517p_basemap','topo'); MR.zi=-1; } await aggiorna(); draw(); };
    };
    draw(); host.appendChild(box); }; }
// all'avvio: se la mappa scelta è la carta ma non c'è (browser, iPhone, cancellata), si torna a OpenTopoMap
setTimeout(()=>{ if(PH.base==='ofm' && !PH.cartaOk){ PH.base='topo'; MR.zi=-1; } },4000);
})();
