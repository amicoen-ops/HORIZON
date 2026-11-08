// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// CARTA VFR open flightmaps come mappa di base (solo app Android). Il pacchetto ufficiale dell'Italia (MBTiles, circa
// 105 MB, zoom 4–11) si scarica una volta col Wi-Fi dall'archivio di open flightmaps e resta sul telefono: si vola anche
// senza internet. A ogni ciclo AIRAC (28 giorni) l'app dice che c'è quella nuova. Licenza OFMA: «open flightmaps
// association / www.openflightmaps.org». Si sceglie da LIVELLI › MAPPA o da Impostazioni › Mappa di base.
(function(){
'use strict';
const NOME='li', esc=x=>String(x??'').replace(/[<&>"]/g,c=>({'<':'&lt;','&':'&amp;','>':'&gt;','"':'&quot;'}[c]));
const plug=(()=>{ try{ const C=window.Capacitor; if(!PH.native) return null; return (C.Plugins&&C.Plugins.Carta)||C.registerPlugin('Carta'); }catch(e){ return null; } })();
PH.BASES.ofm={name:'Carta VFR open flightmaps',min:4,max:11,local:true,attr:'open flightmaps association · www.openflightmaps.org'};
PH.cartaOk=false; PH.carta=null;
// ciclo AIRAC (es. 2611): cicli di 28 giorni dal 2 gennaio 2020 (ciclo 2001), come gli spazi aerei
PH.airac=function(dietro){ const d0=Date.UTC(2020,0,2), g=864e5*28; let t=d0; while(t+g<=Date.now()) t+=g; t-=g*(dietro||0);
  const d=new Date(t), y=d.getUTCFullYear(); let k=0, x=t; while(x>=Date.UTC(y,0,1)){ k++; x-=g; } return String(y%100).padStart(2,'0')+String(k).padStart(2,'0'); };
const url=a=>`https://storage.googleapis.com/snapshots.openflightmaps.org/live/${a}/tiles/li/noninteractive/epsg3857/li_256.mbtiles`;
async function aggiorna(){ if(!plug) return; try{ const r=await plug.info(); PH.carta=(r.carte||[]).find(c=>c.nome===NOME)||null; PH.cartaOk=!!PH.carta; }catch(e){ PH.cartaOk=false; } }
aggiorna();
PH.cartaTile=async function(z,x,y){ if(!plug||!PH.cartaOk) return null; try{ const r=await plug.tile({nome:NOME,z,x,y}); return r&&r.data||null; }catch(e){ return null; } };
let busy=false;
PH.cartaScarica=async function(onP){
  if(!plug){ toast('CARTA VFR: SOLO NELL\'APP ANDROID'); return; } if(busy) return; busy=true;
  const lst=plug.addListener?await plug.addListener('progresso',p=>onP&&onP(p.done,p.total)):null;
  try{ for(const a of [PH.airac(0),PH.airac(1)]){ try{ await plug.scarica({url:url(a),nome:NOME}); await aggiorna(); toast('CARTA VFR SCARICATA · AIRAC '+a); PH.act&&PH.act('carta VFR '+a); return true; }catch(e){ if(a===PH.airac(1)) throw e; } } }
  catch(e){ toast('CARTA VFR: '+String(e&&e.message||e).slice(0,60)); return false; }
  finally{ busy=false; try{ lst&&lst.remove(); }catch(e){} }
};
PH.cartaStato=function(){ if(!plug) return {txt:'Solo nell\'app Android (sul browser e su iPhone/iPad non è disponibile).',ok:false};
  if(!PH.carta) return {txt:'Non scaricata.',ok:false};
  const v=PH.carta.version||'?', nuovo=v!==PH.airac(0);
  return {txt:`Scaricata · AIRAC ${esc(v)} · ${(PH.carta.size/1048576).toFixed(0)} MB${nuovo?' · <b>c\'è il ciclo nuovo '+PH.airac(0)+': aggiornala</b>':''}`,ok:!nuovo}; };
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
