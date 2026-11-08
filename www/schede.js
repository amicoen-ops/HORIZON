// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// CASELLE DEI DATI A SCELTA. Sotto l'orizzonte ci sono le caselle (velocità, quota, vario...): in Impostazioni › Interfaccia
// si sceglie quali mostrare e in che ordine, separatamente per l'interfaccia completa e per quella semplice.
// L'interfaccia SEMPLICE resta sempre disponibile: orizzonte grande e poche caselle (di partenza velocità, quota, vario, prua).
// Toccare una casella apre la sua pagina: VENTO › vento sulla pista, DESTINAZIONE › stimati, AUTONOMIA › carburante.
(function(){
'use strict';
const esc=x=>String(x??'').replace(/[<&>"]/g,c=>({'<':'&lt;','&':'&amp;','>':'&gt;','"':'&quot;'}[c]));
// tutte le caselle: id, nome nel menu
const TUTTE=[['phGs','Velocità (GS)'],['phAlt','Quota'],['phVs','Vario'],['phTrk','Traccia / prua'],['phWind','Vento'],['phDest','Destinazione'],
  ['phTime','Tempo di volo'],['phSun','Tramonto'],['hzCAgl','Altezza sul terreno'],['hzCHw','Vento di prua'],['hzCFuel','Autonomia'],['hzCEta','Arrivo (ora)'],
  ['hzCQnh','QNH'],['hzCUtc','Ora UTC']];
const NUOVE={hzCAgl:'ALTEZZA',hzCHw:'VENTO PRUA',hzCFuel:'AUTONOMIA',hzCEta:'ARRIVO',hzCQnh:'QNH',hzCUtc:'ORA UTC'};
const DEF={full:['phGs','phAlt','phVs','phTrk','phWind','phDest','phTime','phSun'],simple:['phGs','phAlt','phVs','phTrk']};
// HORIZON 2 con l'orologio Garmin: caselle del pilota (battito, saturazione) e pressione dell'orologio
const H2=!!(window.Capacitor&&Capacitor.isPluginAvailable&&Capacitor.isPluginAvailable('Garmin'));
if(H2){ TUTTE.push(['hzCHr','Battito (orologio)'],['hzCOx','Saturazione SpO₂ (orologio)'],['hzCPr','Pressione (orologio)']);
  Object.assign(NUOVE,{hzCHr:'BATTITO',hzCOx:'SpO₂',hzCPr:'PRESSIONE'});
  DEF.full=['phGs','phAlt','phVs','phTrk','phWind','phDest','hzCHr','hzCOx']; }
const KEY={full:'ia517p_cards',simple:'ia517p_cards_s'};
const ok=id=>TUTTE.some(t=>t[0]===id);
function lista(m){ const L=lsGet(KEY[m],null); return Array.isArray(L)&&L.filter(ok).length?L.filter(ok).slice(0,8):DEF[m].slice(); }
const box=document.querySelector('.ph-cards');
// caselle nuove, nascoste finché non si scelgono
if(box) for(const id in NUOVE) if(!document.getElementById(id)){ const d=document.createElement('div'); d.className='ph-card'; d.id=id; d.innerHTML=`<span>${NUOVE[id]}</span><b>---</b><small></small>`; box.appendChild(d); }
PH.cardsApply=function(){ if(!box) return; const L=lista(PH.ui==='simple'?'simple':'full');
  for(const [id] of TUTTE){ const e=document.getElementById(id); if(!e) continue; const i=L.indexOf(id);
    e.classList.toggle('hz-off',i<0); e.style.order=i<0?99:i; }
  box.dataset.n=L.length; };
// valori delle caselle nuove, ogni mezzo secondo con le altre
const card=(id,v,s)=>{ const e=document.getElementById(id); if(e&&!e.classList.contains('hz-off')){ e.querySelector('b').textContent=v; e.querySelector('small').textContent=s||''; } };
function nuove(g){
  const gps=S.gpsReal||PH.demo||S.auto;
  { const z=gps&&typeof terrain==='function'?terrain(...xy(enu(S.lat,S.lon))):NaN; card('hzCAgl',z===z?Math.round(S.alt-z/FT2M)+' ft':'---',z===z?'sul terreno':'terreno n.d.'); }
  { const t=S.trk!=null?S.trk:S.hdg; if(WIND.valid){ const h=WIND.kmh*Math.cos((WIND.dir-t)*Math.PI/180); card('hzCHw',(h>=0?'−':'+')+Math.round(Math.abs(h)),h>=0?'km/h contrario':'km/h in coda'); } else card('hzCHw','---','vento n.d.'); }
  try{ const n=PH.fuelNow(); const m=n.L/n.burn*60; card('hzCFuel',Math.floor(m/60)+':'+String(Math.round(m%60)).padStart(2,'0'),`${n.L.toFixed(0)} L · ${n.burn} L/h`);
    const e=document.getElementById('hzCFuel'); if(e) e.classList.toggle('warn',m<45); }catch(e){ card('hzCFuel','---',''); }
  if(NAV.dest&&g&&g.ete){ const t=new Date(Date.now()+g.ete*1000); card('hzCEta',t.toISOString().slice(11,16)+'Z',t.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})+' locali · '+NAV.dest.short.slice(0,8)); }
  else card('hzCEta','---','nessuna destinazione');
  card('hzCQnh',String(Math.round(QNH)),'hPa · tocca per cambiare');
  { const d=new Date(); card('hzCUtc',d.toISOString().slice(11,16)+'Z',d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})+' locali'); }
  if(H2){ const F=PH.fenix||{}, d=F.d, ok=d&&Date.now()-F.t<5000;
    card('hzCHr',ok&&d.hr!=null?Math.round(d.hr)+' bpm':'---',ok?'dall\'orologio':'orologio non collegato');
    const o=ok&&d.ox!=null?Math.round(d.ox):null, a=ok&&d.oxa!=null?d.oxa:null;
    card('hzCOx',o!=null?o+' %':'---',o==null?(ok?'Pulse Ox spento sull\'orologio':'orologio non collegato'):(a>120?'misura di '+Math.round(a/60)+' min fa':'adesso'));
    { const e=document.getElementById('hzCOx'); if(e){ e.classList.toggle('warn',o!=null&&o<92&&o>=88); e.classList.toggle('bad',o!=null&&o<88); } }
    card('hzCPr',ok&&d.p!=null?(d.p/100).toFixed(1):'---','hPa · dall\'orologio'); }
}
{ const prev=PH.info; PH.info=function(g){ const r=prev.apply(this,arguments); try{ nuove(g); }catch(e){ PH._cardErr=String(e); } return r; }; }
// tocchi sulle caselle
const tocca=(id,fn)=>{ const e=document.getElementById(id); if(e){ e.style.cursor='pointer'; e.addEventListener('click',fn); } };
tocca('hzCFuel',()=>PH.show&&PH.show('fuel'));
tocca('hzCEta',()=>PH.stimOpen&&PH.stimOpen());
tocca('hzCHw',()=>PH.ventoOpen&&PH.ventoOpen());
tocca('hzCQnh',()=>PH.noteOpen?PH.noteOpen():PH.show('imp'));
// cambio di interfaccia: si riapplica la scelta
{ const prev=PH.setUi; if(prev) PH.setUi=function(){ const r=prev.apply(this,arguments); try{ PH.cardsApply(); }catch(e){} return r; }; }
PH.cardsApply();

// ---- impostazioni: sotto «Interfaccia» ----
let modo='full';
function cfgHtml(){ const L=lista(modo);
  return `<div class="ph-seg" id="hzCm">${[['full','Caselle: completa'],['simple','Caselle: semplice']].map(([k,l])=>`<button data-m="${k}" aria-pressed="${modo===k}">${l}</button>`).join('')}</div>
  <div class="hz-cl">${L.map((id,i)=>`<div class="hz-ci on"><b>${i+1}</b><span>${esc((TUTTE.find(t=>t[0]===id)||[])[1])}</span><button type="button" data-u="${i}" aria-label="Più su" ${i?'':'disabled'}>▲</button><button type="button" data-d="${i}" aria-label="Più giù" ${i<L.length-1?'':'disabled'}>▼</button><button type="button" data-x="${i}" aria-label="Togli" ${L.length>1?'':'disabled'}>✕</button></div>`).join('')}
  ${L.length<8?`<div class="hz-ca">${TUTTE.filter(t=>!L.includes(t[0])&&!(modo==='simple'&&/^(phDest|hzCEta)$/.test(t[0]))).map(t=>`<button type="button" class="ph-btn" data-a="${t[0]}">＋ ${esc(t[1])}</button>`).join('')}</div>`:'<p class="ph-sub">Al massimo 8 caselle.</p>'}
  </div><div class="ph-btns"><button type="button" class="ph-btn" id="hzCdef">Caselle di partenza</button></div>
  <p class="ph-sub">${modo==='simple'?'Interfaccia semplice: poche caselle, l\'orizzonte resta grande.':'Interfaccia completa: righe da 4 caselle.'} Tocca VENTO, DESTINAZIONE, AUTONOMIA, ARRIVO o QNH per aprire la loro pagina.</p>`; }
function cfgWire(el){
  const L=lista(modo), save=x=>{ lsSet(KEY[modo],x); PH.cardsApply(); el.innerHTML=cfgHtml(); cfgWire(el); PH.act&&PH.act('caselle '+modo); };
  el.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{ modo=b.dataset.m; el.innerHTML=cfgHtml(); cfgWire(el); });
  el.querySelectorAll('[data-u]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.u; [L[i-1],L[i]]=[L[i],L[i-1]]; save(L); });
  el.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.d; [L[i+1],L[i]]=[L[i],L[i+1]]; save(L); });
  el.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>{ L.splice(+b.dataset.x,1); save(L); });
  el.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{ L.push(b.dataset.a); save(L); });
  el.querySelector('#hzCdef').onclick=()=>save(DEF[modo].slice()); }
{ const orig=PH.renderImp; PH.renderImp=function(){ orig.apply(this,arguments);
    const ui=document.getElementById('phUi'); if(!ui) return; modo=PH.ui==='simple'?'simple':'full';
    const p=ui.nextElementSibling&&ui.nextElementSibling.tagName==='P'?ui.nextElementSibling:ui;
    if(p!==ui) p.innerHTML='<b>Semplice</b>: l\'orizzonte grande con poche caselle (di partenza velocità, quota, vario e prua). Niente mappa, rotte e simulazione. Gli avvisi di terreno, spazi aerei e traffico restano attivi, e il tasto SOS c\'è sempre. <b>Completa</b>: tutto.';
    const d=document.createElement('div'); d.id='hzCards'; d.innerHTML=cfgHtml(); p.after(d); cfgWire(d);
    ui.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{ modo=b.dataset.u==='simple'?'simple':'full'; d.innerHTML=cfgHtml(); cfgWire(d); })); }; }

{ const s=document.createElement('style'); s.textContent=`
  .ph-card.hz-off{display:none!important}
  .ph-card.warn b{color:#ffc531} .ph-card.bad b{color:#ff5a5a}
  body.ph-simple .ph-cards[data-n="4"],body.ph-simple .ph-cards[data-n="3"],body.ph-simple .ph-cards[data-n="2"]{grid-template-columns:repeat(var(--n,4),minmax(0,1fr))}
  body.ph-simple .ph-card b{font-size:clamp(18px,5vw,28px)} body.ph-simple .ph-card span{font-size:12px}
  .hz-cl{display:flex;flex-direction:column;gap:6px}
  .hz-ci{display:grid;grid-template-columns:28px 1fr 48px 48px 48px;gap:6px;align-items:center;min-height:50px;padding:2px 6px;border:1px solid #2c3a46;border-radius:10px;background:#121c25}
  .hz-ci b{font:800 16px 'Oxanium',system-ui;color:#33e1ff;text-align:center} .hz-ci span{font:600 15px system-ui,sans-serif}
  .hz-ci button{min-height:44px;border-radius:9px;border:1px solid #3a4a5a;background:#1b2530;color:#eef3f8;font-size:17px} .hz-ci button:disabled{opacity:.3}
  .hz-ca{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
  body.ph-simple #hzRadio{display:none!important}`; document.head.appendChild(s); }
{ const st=document.createElement('style'); document.head.appendChild(st);
  const n=()=>{ const v=box?Math.min(4,+box.dataset.n||4):4; st.textContent=`body.ph-simple .ph-cards{--n:${v}}`; };
  const prev=PH.cardsApply; PH.cardsApply=function(){ prev(); n(); }; n(); }
})();
