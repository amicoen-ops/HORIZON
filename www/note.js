// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// PUNTI DI RIPORTO VFR E NOTE DELL'ENTE (soprattutto per il VDS avanzato).
// · Punti VFR (openAIP, CC BY-NC) sulla mappa: triangolo pieno se obbligatorio, vuoto se a richiesta, con la sigla
//   (livello «Punti VFR»). Nel riporto di posizione degli stimati, se sei entro 3 km da un punto VFR, si usa quello.
// · NOTE ENTE (ALTRO › NOTE ENTE, o dagli stimati): QNH, squawk, quota autorizzata, punto di ingresso o uscita e
//   frequenza si scrivono con tasti grandi, senza tastiera; sotto la frase da rileggere all'ente (readback). Il QNH si
//   può mandare allo strumento con un tocco. Le note valgono per il giorno.
(function(){
'use strict';
const esc=x=>String(x??'').replace(/[<&>"]/g,c=>({'<':'&lt;','&':'&amp;','>':'&gt;','"':'&quot;'}[c]));
const SETT=['nord','nord-est','est','sud-est','sud','sud-ovest','ovest','nord-ovest'];
PH.vrpList=function(){ try{ const w=document.getElementById('phAppFrame').contentWindow; return (w&&w.IA517_vrp&&w.IA517_vrp())||[]; }catch(e){ return []; } };
PH.vrpNear=function(n,km){ if(S.lat==null) return []; return PH.vrpList().map(v=>({v,d:distBrg(S,v).d})).filter(x=>x.d<(km||40)*1000).sort((a,b)=>a.d-b.d).slice(0,n||8); };

// ---- sulla mappa (chiamato dal livello spazi aerei di livelli.js, o da solo se gli spazi sono spenti) ----
const enuC=new WeakMap();
PH.vrpDraw=function(toS){
  if(!PH.lyr||PH.lyr.vrp===false||ZOOMS[zi]>60) return;
  const L=PH.vrpList(); if(!L.length) return;
  ctx.save(); ctx.font=font(R*0.034,'700'); ctx.textAlign='left'; ctx.textBaseline='middle';
  for(const v of L){ let e=enuC.get(v); if(!e){ e=enu(v.lat,v.lon); enuC.set(v,e); }
    const p=toS(e.E,e.N); if(p.x<-20||p.x>W+20||p.y<-20||p.y>H+20) continue;
    const s=R*0.022; ctx.beginPath(); ctx.moveTo(p.x,p.y-s); ctx.lineTo(p.x+s*0.9,p.y+s*0.65); ctx.lineTo(p.x-s*0.9,p.y+s*0.65); ctx.closePath();
    ctx.lineWidth=2*k; ctx.strokeStyle='#33e1ff'; if(v.comp){ ctx.fillStyle='#33e1ff'; ctx.fill(); } ctx.stroke();
    if(ZOOMS[zi]<=30){ ctx.lineWidth=3*k; ctx.strokeStyle='rgba(0,0,0,.8)'; ctx.fillStyle='#7fe0ff'; ctx.strokeText(v.code,p.x+s*1.2,p.y); ctx.fillText(v.code,p.x+s*1.2,p.y); } }
  ctx.restore();
};
{ const orig=PH.mapUnder; PH.mapUnder=function(toS,sc,c){ if(orig&&PH.lyr&&PH.lyr.asp!==false) orig.apply(this,arguments); else PH.vrpDraw(toS); }; }
// riporto di posizione: vicino a un punto VFR si usa quello
PH.vrpPos=function(){ const n=PH.vrpNear(1,3)[0]; if(!n) return null; const v=n.v, nm=v.label||v.short||v.code;
  if(n.d<800) return 'sopra '+nm; return `${(n.d/1000).toFixed(0)} km a ${SETT[Math.round(distBrg(v,S).brg/45)%8]} di ${nm}`; };

// ---- NOTE DELL'ENTE ----
const oggi=()=>new Date().toDateString();
function leggi(){ const n=lsGet('ia517p_note',null); return n&&n.d===oggi()?n:{d:oggi()}; }
function scrivi(n){ n.d=oggi(); n.t=Date.now(); lsSet('ia517p_note',n); }
PH.noteEnte=leggi;
function readback(n){
  const reg=(PH.ac&&PH.ac.reg&&!/XXXX/i.test(PH.ac.reg))?PH.ac.reg:'', fon=reg&&PH.sqFonBreve?PH.sqFonBreve(reg):'‹marche›', p=[];
  if(n.vrp) p.push(`via ${n.vrp}`); if(n.alt) p.push(`${n.altMode==='a'?'a':'non sopra'} ${n.alt} piedi`);
  if(n.sq) p.push(`squawk ${n.sq.split('').join(' ')}`); if(n.qnh) p.push(`QNH ${n.qnh}`); if(n.freq) p.push(`contatto ${n.freq}`);
  return p.length?`«${p.join(', ')}, ${fon}»`:'';
}
PH.noteLine=function(){ const n=leggi(), r=[]; if(n.qnh) r.push('QNH '+n.qnh); if(n.sq) r.push('squawk '+n.sq); if(n.alt) r.push((n.altMode==='a'?'a ':'max ')+n.alt+' ft'); if(n.vrp) r.push('via '+n.vrp); if(n.freq) r.push(n.freq); return r.join(' · '); };
PH.noteOpen=function(){
  let d=document.getElementById('hzNote'); if(d) d.remove();
  d=document.createElement('div'); d.className='ph-sheet'; d.id='hzNote';
  const n=leggi(); n.qnh=n.qnh||QNH;
  const draw=()=>{
    const vr=PH.vrpNear(6,40), fq=[]; try{ for(const {f} of FIELDS.map(f=>({f,d:distBrg(S,f).d})).sort((a,b)=>a.d-b.d).slice(0,12)) for(const v of (PH.freqOf?PH.freqOf(f):[])){ const s=Number(v[2]).toFixed(3); if(!fq.some(x=>x.s===s)) fq.push({s,l:v[1]||v[0]}); } }catch(e){}
    d.innerHTML=`<div class="ph-sheet-h"><button type="button" id="hzNoB">◀ Strumento</button><b>📝 Note dell'ente</b></div>
    <div class="ph-imp hz-no">
      <section><h3>QNH</h3><div class="hz-row"><button data-q="-5">−5</button><button data-q="-1">−1</button><b class="hz-big">${n.qnh}</b><button data-q="1">+1</button><button data-q="5">+5</button></div>
        <button type="button" class="ph-btn" id="hzNoQ"${n.qnh===QNH?' disabled':''}>${n.qnh===QNH?'Strumento già a QNH '+QNH:'Manda QNH '+n.qnh+' allo strumento (ora '+QNH+')'}</button></section>
      <section><h3>Squawk</h3><b class="hz-big">${esc((n.sq||'').padEnd(4,'·'))}</b>
        <div class="hz-kp">${[1,2,3,4,5,6,7,0].map(x=>`<button data-k="${x}">${x}</button>`).join('')}<button data-k="del">⌫</button><button data-k="7000">7000</button></div></section>
      <section><h3>Quota autorizzata</h3><div class="hz-row"><button data-a="-500">−500</button><button data-a="-100">−100</button><b class="hz-big">${n.alt?n.alt+' ft':'—'}</b><button data-a="100">+100</button><button data-a="500">+500</button></div>
        <div class="hz-row2"><button data-m="max" class="${n.altMode!=='a'?'on':''}">NON SOPRA</button><button data-m="a" class="${n.altMode==='a'?'on':''}">A QUOTA</button></div></section>
      <section><h3>Punto di ingresso / uscita</h3><div class="hz-chips">${vr.map(({v,d})=>`<button data-v="${esc(v.code)}" class="${n.vrp===v.code?'on':''}">${esc(v.code)}<small>${esc((v.label||'').replace(v.code,'').replace(/[()]/g,'').trim())} · ${(d/1000).toFixed(0)} km</small></button>`).join('')||'<p class="ph-sub">Nessun punto VFR entro 40 km.</p>'}</div></section>
      <section><h3>Frequenza</h3><div class="hz-chips">${fq.slice(0,8).map(x=>`<button data-f="${esc(x.s)}" class="${n.freq===x.s?'on':''}">${esc(x.s)}<small>${esc(x.l)}</small></button>`).join('')}</div></section>
      <section><h3>Da rileggere all'ente</h3><p class="hz-rb">${esc(readback(n))||'Scegli i valori qui sopra: la frase si compone da sola.'}</p>
        <div class="hz-row2"><button id="hzNoZ">Azzera</button><button id="hzNoS">Stimati</button></div>
        <p class="ph-sub">Le note valgono per oggi. Lo squawk accetta solo le cifre 0–7. In Italia il codice VFR è 7000; emergenza 7700.</p></section>
    </div>`;
    const sv=()=>{ scrivi(n); draw(); };
    d.querySelector('#hzNoB').onclick=()=>d.remove();
    d.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{ n.qnh=Math.max(950,Math.min(1060,n.qnh+(+b.dataset.q))); sv(); });
    const q=d.querySelector('#hzNoQ'); q.onclick=()=>{ QNH=n.qnh; lsSet('ia517_qnh',QNH); toast('QNH '+QNH+' hPa'); PH.act&&PH.act('QNH dalle note '+QNH); sv(); };
    d.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{ const k=b.dataset.k; let s=n.sq||''; if(k==='del') s=s.slice(0,-1); else if(k==='7000') s='7000'; else if(s.length<4) s+=k; n.sq=s; sv(); });
    d.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{ n.alt=Math.max(500,Math.min(15000,(n.alt||Math.round(S.alt/100)*100)+(+b.dataset.a))); sv(); });
    d.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{ n.altMode=b.dataset.m; sv(); });
    d.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{ n.vrp=n.vrp===b.dataset.v?'':b.dataset.v; sv(); });
    d.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{ n.freq=n.freq===b.dataset.f?'':b.dataset.f; sv(); });
    d.querySelector('#hzNoZ').onclick=()=>{ for(const k of ['sq','alt','altMode','vrp','freq']) delete n[k]; n.qnh=QNH; sv(); };
    d.querySelector('#hzNoS').onclick=()=>{ d.remove(); PH.stimOpen&&PH.stimOpen(); };
  };
  document.body.appendChild(d); draw(); PH.act&&PH.act('note ente');
};
{ const s=document.createElement('style'); s.textContent=`
  .hz-no .hz-big{font:800 30px "Oxanium",system-ui,sans-serif;color:#fff;text-align:center;min-width:110px;letter-spacing:.06em}
  .hz-no .hz-row{display:flex;gap:8px;align-items:center;justify-content:space-between}
  .hz-no .hz-row button,.hz-no .hz-row2 button,.hz-no .hz-kp button,.hz-no .hz-chips button{min-height:58px;min-width:58px;border-radius:12px;border:2px solid #3a4a5a;background:#1b2530;color:#eef3f8;font:800 18px "Oxanium",system-ui,sans-serif}
  .hz-no .hz-row2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .hz-no .hz-kp{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
  .hz-no .hz-chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
  .hz-no .hz-chips button{display:flex;flex-direction:column;align-items:flex-start;padding:6px 10px;text-align:left}
  .hz-no .hz-chips small{font:600 12px system-ui,sans-serif;color:#9aa4b0}
  .hz-no button.on{border-color:#33e1ff;color:#33e1ff}
  body:not(.ph-land) #phMore .ph-more-g button.x{grid-column:1/-1}
  .hz-no .hz-rb{font:700 18px/1.4 "Oxanium",system-ui,sans-serif;color:#fff;margin:0}`; document.head.appendChild(s); }
// ALTRO › NOTE ENTE
{ const g=document.querySelector('#phMore .ph-more-g'), x=g&&g.querySelector('[data-x]');
  if(g){ const b=document.createElement('button'); b.type='button'; b.id='hzNoteBtn'; b.innerHTML='<i>📝</i>NOTE ENTE';
    b.onclick=ev=>{ ev.stopPropagation(); PH.moreOpen(false); PH.noteOpen(); }; g.insertBefore(b,x||null); } }
})();
