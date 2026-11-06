// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// SQUADRIGLIA: gli aerei che volano con me. Marche, nome del pilota, nominativo radio, velivolo e (facoltativo)
// codice FLARM/OGN o ICAO. In volo, se arrivano nel traffico (SafeSky, OGN, ADS-B), compaiono col nome del pilota
// e in verde; il pericolo di collisione resta giallo e rosso come per tutti. Si apre da ALTRO › SQUADRIGLIA.
(function(){
'use strict';
const esc=x=>String(x??'').replace(/[<&>"]/g,c=>({'<':'&lt;','&':'&amp;','>':'&gt;','"':'&quot;'}[c]));
const KEY='ia517p_squadriglia';
const rd=()=>{ try{ const v=JSON.parse(localStorage.getItem(KEY)||'[]'); return Array.isArray(v)?v:[]; }catch(e){ return []; } };
const wr=v=>{ try{ localStorage.setItem(KEY,JSON.stringify(v)); }catch(e){} };
PH.SQ=rd();
const N=s=>String(s||'').toUpperCase().replace(/[^0-9A-Z]/g,'');

// ---- nominativo radio dalle marche: alfabeto ICAO, cifre in italiano ----
const ALFA={A:'Alfa',B:'Bravo',C:'Charlie',D:'Delta',E:'Echo',F:'Foxtrot',G:'Golf',H:'Hotel',I:'India',J:'Juliett',K:'Kilo',L:'Lima',M:'Mike',N:'November',
  O:'Oscar',P:'Papa',Q:'Quebec',R:'Romeo',S:'Sierra',T:'Tango',U:'Uniform',V:'Victor',W:'Whiskey',X:'X-ray',Y:'Yankee',Z:'Zulu',
  '0':'Zero','1':'Uno','2':'Due','3':'Tre','4':'Quattro','5':'Cinque','6':'Sei','7':'Sette','8':'Otto','9':'Nove'};
PH.sqFon=function(reg){ const s=N(reg); return s.split('').map(c=>ALFA[c]||c).join(' '); };
// forma abbreviata (dopo il primo contatto, se l'ente lo consente): prima lettera e ultime due
PH.sqFonBreve=function(reg){ const s=N(reg); return s.length>3?[s[0],s[s.length-2],s[s.length-1]].map(c=>ALFA[c]||c).join(' '):PH.sqFon(reg); };
const radio=m=>m.radio||PH.sqFon(m.reg);

// ---- riconoscimento nel traffico ----
const cache=new Map();
PH.sqOf=function(t){ if(!t||!PH.SQ.length) return null;
  const k=t.id+'|'+(t.reg||'')+'|'+(t.cn||''); if(cache.has(k)) return cache.get(k);
  const reg=N(t.reg), cn=N(t.cn), addr=N(t.addr);
  const m=PH.SQ.find(x=>{ const r=N(x.reg), h=N(x.hex); return (r.length>=4&&(r===reg||r===cn)) || (h.length>=6&&addr.endsWith(h)); })||null;
  if(cache.size>500) cache.clear(); cache.set(k,m); return m; };
const origName=PH.trfName;
PH.trfName=t=>{ const m=PH.sqOf(t); return m?String(m.nome||m.reg).toUpperCase():origName(t); };
// righe in più nella scheda di un traffico toccato
PH.sqRows=function(t){ const m=PH.sqOf(t); if(!m) return [];
  return [['Squadriglia',`<b style="color:#6dff8f">${esc(m.nome||'')}</b> · ${esc(m.reg)}${m.tipo?' · '+esc(m.tipo):''}`],['Radio',`«${esc(radio(m))}»`]]; };

// avviso quando un membro compare per la prima volta in questo volo (solo a schermo, niente voce)
const visti=new Set();
setInterval(()=>{ try{ const ev=PH.TRF&&PH.TRF.view; if(!ev||!PH.SQ.length) return;
  for(const e of ev){ if(e.me) continue; const m=PH.sqOf(e.t); if(!m||visti.has(m.reg)) continue; visti.add(m.reg);
    toast(`SQUADRIGLIA: ${String(m.nome||m.reg).toUpperCase()} · ${(e.d/1000).toFixed(1).replace('.',',')} KM ORE ${PH.trfClock(e)}`); }
  if(!PH.flight&&!(PH.TRF.view||[]).length) visti.clear(); }catch(e){} },5000);

// ---- pagina ----
function inVolo(){ const ev=(PH.TRF&&PH.TRF.view)||[]; return ev.filter(e=>!e.me&&PH.sqOf(e.t)).map(e=>({e,m:PH.sqOf(e.t)})); }
function scheda(m,isNew){
  const d=document.createElement('div'); d.className='ph-sheet'; d.id='hzSqEd'; d.style.zIndex=80;
  d.innerHTML=`<div class="ph-sheet-h"><button type="button" id="hzSqEdB">◀ Indietro</button><b>${isNew?'Nuovo aereo della squadriglia':'Squadriglia · '+esc(m.reg)}</b></div>
  <div class="ph-imp"><section>
    <label class="ph-fld">Marche<input data-k="reg" value="${esc(m.reg)}" placeholder="I-A517" autocapitalize="characters"></label>
    <label class="ph-fld">Nome del pilota<input data-k="nome" value="${esc(m.nome)}" placeholder="Marco"></label>
    <label class="ph-fld">Nominativo radio <small>(vuoto: dalle marche)</small><input data-k="radio" value="${esc(m.radio)}" placeholder=""></label>
    <label class="ph-fld">Velivolo <small>(facoltativo)</small><input data-k="tipo" value="${esc(m.tipo)}" placeholder="Avid Flyer"></label>
    <label class="ph-fld">Codice FLARM/OGN o ICAO <small>(facoltativo, 6 caratteri)</small><input data-k="hex" value="${esc(m.hex)}" placeholder="DD1A2B" autocapitalize="characters"></label>
    <label class="ph-fld">Note <small>(frequenza di squadriglia, telefono…)</small><input data-k="note" value="${esc(m.note)}"></label>
    <p class="ph-sub" id="hzSqFon"></p>
    <p class="ph-sub">Il riconoscimento in volo usa le marche o il codice, se l'aereo trasmette con SafeSky, FLARM/OGN o ADS-B. Senza trasmettitore non si vede: guarda sempre fuori.</p>
    <div class="ph-btns"><button class="ph-btn pri" type="button" id="hzSqOk">Salva</button>${isNew?'':'<button class="ph-btn" type="button" id="hzSqDel">Togli dalla squadriglia</button>'}</div>
  </section></div>`;
  document.body.appendChild(d);
  const read=()=>{ const b=Object.assign({},m); d.querySelectorAll('[data-k]').forEach(i=>b[i.dataset.k]=i.value.trim()); b.reg=PH.trfFmtReg?PH.trfFmtReg(b.reg.toUpperCase()):b.reg.toUpperCase(); b.hex=N(b.hex); return b; };
  const fon=()=>{ const b=read(); document.getElementById('hzSqFon').innerHTML=b.reg?`In radio: <b>«${esc(b.radio||PH.sqFon(b.reg))}»</b>${b.radio?'':` · abbreviato «${esc(PH.sqFonBreve(b.reg))}» (prima lettera e ultime due: solo dopo che l'ente l'ha usato)`}`:''; };
  d.querySelectorAll('[data-k]').forEach(i=>i.addEventListener('input',fon)); fon();
  document.getElementById('hzSqEdB').onclick=()=>d.remove();
  document.getElementById('hzSqOk').onclick=()=>{ const b=read(); if(N(b.reg).length<4){ toast('SCRIVI LE MARCHE'); return; }
    const i=PH.SQ.findIndex(x=>x.id===b.id); if(i>=0) PH.SQ[i]=b; else PH.SQ.push(b);
    PH.SQ.sort((a,c)=>String(a.nome||a.reg).localeCompare(String(c.nome||c.reg),'it')); wr(PH.SQ); cache.clear(); d.remove(); PH.sqOpen(); toast('SQUADRIGLIA: '+String(b.nome||b.reg).toUpperCase()); };
  const del=document.getElementById('hzSqDel'); if(del) del.onclick=()=>{ if(!confirm('Togliere '+(m.nome||m.reg)+' dalla squadriglia?')) return; PH.SQ=PH.SQ.filter(x=>x.id!==m.id); wr(PH.SQ); cache.clear(); d.remove(); PH.sqOpen(); };
}
PH.sqOpen=function(){
  let d=document.getElementById('hzSq'); if(d) d.remove();
  d=document.createElement('div'); d.className='ph-sheet'; d.id='hzSq';
  const me=PH.ac&&PH.ac.reg&&!/XXXX/i.test(PH.ac.reg)?PH.ac.reg:'', iv=inVolo();
  d.innerHTML=`<div class="ph-sheet-h"><button type="button" id="hzSqB">◀ Strumento</button><b>👥 Squadriglia</b></div>
  <div class="ph-imp">
    ${me?`<section><h3>Il mio nominativo</h3><div class="ph-row ph-col"><b>${esc(me)}</b><small>«${esc(PH.sqFon(me))}» · abbreviato «${esc(PH.sqFonBreve(me))}», solo dopo che l'ente l'ha usato</small>
      <small>Primo contatto con un ente: «Pisa Radar, ${esc(PH.sqFon(me))}${/^vds/.test(PH.ac&&PH.ac.cat||'')?', ultralight':''}». Poi tipo, provenienza e destinazione, posizione e quota.</small></div></section>`:''}
    <section><h3>In volo adesso</h3>${iv.length?iv.map(({e,m})=>`<div class="ph-row ph-col"><b style="color:#6dff8f">${esc(m.nome||m.reg)} · ${esc(m.reg)}</b><small>${(e.d/1000).toFixed(1).replace('.',',')} km · ore ${PH.trfClock(e)} · ${PH.trfDz(e)} · ${Math.round(e.t.kmh)} km/h · radio «${esc(radio(m))}»</small></div>`).join(''):
      `<p class="ph-sub">${PH.SQ.length?'Nessuno della squadriglia ricevuto nel traffico in questo momento.':'Aggiungi gli aerei che volano con te: in volo li riconosci col nome.'}</p>`}</section>
    <section><h3>Aerei (${PH.SQ.length})</h3>
      ${PH.SQ.map(m=>`<div class="ph-row"><span style="flex:1"><b>${esc(m.nome||'—')}</b> · ${esc(m.reg)}${m.tipo?' · '+esc(m.tipo):''}<br><small>«${esc(radio(m))}»${m.hex?' · codice '+esc(m.hex):''}${m.note?' · '+esc(m.note):''}</small></span><button class="ph-btn" type="button" data-sq="${esc(m.id)}">Modifica</button></div>`).join('')}
      <div class="ph-btns"><button class="ph-btn pri" type="button" id="hzSqNew">Aggiungi aereo</button></div></section>
    <section><h3>Condividi la squadriglia</h3><p class="ph-sub">Esporta la lista in un file e mandala agli altri piloti: la importano e vedete tutti gli stessi nomi.</p>
      <div class="ph-btns"><button class="ph-btn" type="button" id="hzSqExp">Esporta</button><label class="ph-btn" style="cursor:pointer">Importa<input type="file" id="hzSqImp" accept=".json,application/json" hidden></label></div></section>
  </div>`;
  document.body.appendChild(d);
  document.getElementById('hzSqB').onclick=()=>d.remove();
  document.getElementById('hzSqNew').onclick=()=>scheda({id:'sq-'+Date.now().toString(36),reg:'',nome:'',radio:'',tipo:'',hex:'',note:''},true);
  d.querySelectorAll('[data-sq]').forEach(b=>b.onclick=()=>scheda(PH.SQ.find(x=>x.id===b.dataset.sq),false));
  document.getElementById('hzSqExp').onclick=()=>PH.download('HORIZON_squadriglia.json',JSON.stringify({horizon:'squadriglia',v:1,list:PH.SQ},null,2),'application/json');
  document.getElementById('hzSqImp').onchange=async ev=>{ const f=ev.target.files[0]; if(!f) return;
    try{ const j=JSON.parse(await f.text()), list=(j.list||j).filter(x=>x&&N(x.reg).length>=4); let n=0;
      for(const x of list){ const c={id:'sq-'+Date.now().toString(36)+n,reg:String(x.reg).toUpperCase(),nome:String(x.nome||'').slice(0,30),radio:String(x.radio||'').slice(0,60),tipo:String(x.tipo||'').slice(0,40),hex:N(x.hex).slice(0,8),note:String(x.note||'').slice(0,80)};
        const i=PH.SQ.findIndex(y=>N(y.reg)===N(c.reg)); if(i>=0) PH.SQ[i]=Object.assign(PH.SQ[i],c,{id:PH.SQ[i].id}); else PH.SQ.push(c); n++; }
      wr(PH.SQ); cache.clear(); toast(n+' AEREI IMPORTATI'); PH.sqOpen(); }catch(e){ toast('FILE NON VALIDO'); } };
  PH.act&&PH.act('squadriglia');
};
// con SQUADRIGLIA i tasti sono 7: CHIUDI occupa tutta l'ultima riga
{ const st=document.createElement('style'); st.textContent='#phMore .ph-more-g button.x{grid-column:1/-1}'; document.head.appendChild(st); }
// tasto nel menu ALTRO, prima di CHIUDI
{ const g=document.querySelector('#phMore .ph-more-g'), x=g&&g.querySelector('[data-x]');
  if(g){ const b=document.createElement('button'); b.type='button'; b.id='hzSqBtn'; b.innerHTML='<i>👥</i>SQUADRIGLIA';
    b.onclick=ev=>{ ev.stopPropagation(); PH.moreOpen(false); PH.sqOpen(); }; g.insertBefore(b,x||null); } }
})();
