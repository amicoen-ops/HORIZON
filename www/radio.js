// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// RADIO: nel circuito del campo d'arrivo un banner sopra la barra in basso fa scorrere la chiamata da fare
// (prima del sottovento, in virata base, in virata finale), da leggere tenendo premuto il PTT.
// Si accende e si spegne in Impostazioni › Radio. ALTRO › FREQUENZE: le frequenze utili adesso
// (campo d'arrivo, campi vicini, informazioni di volo, emergenza). Frequenze da OurAirports (frequenze.js) e
// dalle note dei campi del Piano: dati da verificare su AIP e carta prima del volo.
(function(){
'use strict';
const esc=x=>String(x??'').replace(/[<&>"]/g,c=>({'<':'&lt;','&':'&amp;','>':'&gt;','"':'&quot;'}[c]));
const N=s=>String(s||'').toUpperCase().replace(/[^0-9A-Z]/g,'');
const KEY='ia517p_radiocall';
PH.radioOn=lsGet(KEY,true);
const mhz=v=>Number(v).toFixed(3);
// frequenza della squadriglia (in volo tra noi): di partenza 131.100, si cambia in ALTRO › FREQUENZE
PH.sqFreq=function(v){
  if(v!==undefined){ const x=parseFloat(String(v).replace(',','.')); if(!(x>=118&&x<=136.975)) return null; lsSet('ia517p_sq_freq',mhz(x)); return mhz(x); }
  return lsGet('ia517p_sq_freq','131.100');
};

// ---- frequenze di un campo: prima quella delle note del Piano, poi OurAirports ----
const BLIND=/^(CTAF|UNIC|A\/A|A\/G|MULTI|RADIO|RDO)/, SERV=/^(AFIS|INFO)/, TWR=/^TWR/, FIS=/^(FIC|FIS)/;
PH.freqOf=function(f){
  if(!f) return [];
  const out=[], inf=(typeof FIELD_INFO!=='undefined'&&FIELD_INFO[f.id])||{};
  const nota=parseFloat(String(inf.freq||'').replace(',','.'));
  if(nota>=118&&nota<=136.975) out.push(['NOTA','Note del campo',nota]);
  for(const v of ((window.PH_FREQ||{})[f.id]||[])) if(!out.some(o=>Math.abs(o[2]-v[2])<0.001&&!FIS.test(v[0]))) out.push(v);
  return out;
};
// a chi si parla e su che frequenza: traffico (campo senza servizio), stazione radio o AFIS, torre
function stazione(f){
  const fl=PH.freqOf(f).filter(v=>!FIS.test(v[0])&&!/^(ATIS|GND|APP|DEP|ARR|CLD|OPS|PFLT)/.test(v[0]));
  const twr=fl.find(v=>TWR.test(v[0]));
  if(twr) return {tipo:'twr',f:twr};
  const s=fl.find(v=>SERV.test(v[0])), b=fl.find(v=>v[0]==='NOTA')||fl.find(v=>BLIND.test(v[0]));
  const radio=v=>v&&/radio|informazioni|info\b/i.test(v[1])&&!/^(AFIS|INFO|CTAF|RADIO)$/i.test(v[1].trim());
  if(s) return {tipo:'afis',f:s,nome:radio(s)?s[1]:f.name+' Informazioni'};
  if(b) return {tipo:'blind',f:b,nome:radio(b)?b[1]:f.name+' traffico'};
  return {tipo:'blind',f:null,nome:f.name+' traffico'};
}
const SETT=['nord','nord-est','est','sud-est','sud','sud-ovest','ovest','nord-ovest'];
function provenienza(A){
  const fr=PH.flight&&PH.flight.from;
  if(fr && fr!==A.f.short){ const g=FIELDS.find(x=>x.short===fr); return g?g.name:fr; }
  const b=distBrg(A.f,S).brg; return SETT[Math.round(b/45)%8];
}
function nominativi(){
  // marche del velivolo in uso; se è il profilo generico (I-XXXX), quelle del primo velivolo con le marche vere
  const vera=a=>a&&a.reg&&!/XXXX/i.test(a.reg)&&N(a.reg).length>=4;
  const ac=vera(PH.ac)?PH.ac:(PH.acs||[]).find(vera), reg=ac?String(ac.reg).toUpperCase():'';
  if(!reg) return {lungo:'‹le tue marche›',breve:'‹le tue marche›',manca:true,reg:'marche in Impostazioni › Velivoli'};
  const s=N(reg), lungo=PH.sqFon?PH.sqFon(reg):s;
  // abbreviato come lo dicono i piloti nel circuito: prima lettera e ultime tre (India Cinque Uno Sette)
  const breve=PH.sqFon&&s.length>4?PH.sqFon(s[0]+s.slice(-3)):lungo;
  return {lungo,breve,reg};
}
// testo del banner per la fase del circuito; null = niente da dire
PH.radioCall=function(A){
  if(!A||!A.f) return null;
  const st=stazione(A.f), rw=A.end.id, sx=A.side==='L'?'sinistro':'destro', sxa=A.side==='L'?'sinistra':'destra';
  const fq=st.f?mhz(st.f[2]):'';
  if(st.tipo==='twr') return A.idx<=1?{l:'TORRE '+fq,t:`Campo con torre: chiama ${A.f.name} Torre su ${fq} prima di entrare e segui le istruzioni. Spazio controllato: col VDS basico serve l'autorizzazione.`}:null;
  const nm=nominativi(), a=st.nome, ultra=/^vds/.test(PH.ac&&PH.ac.cat||'')&&st.tipo==='afis'?', ultralight':'';
  if(!A.prov) A.prov=provenienza(A);
  const f=fq?' · '+fq:'';
  if(A.idx<=1) return {l:'PRIMA DEL SOTTOVENTO'+f,r:nm.reg,t:`Ascolta e verifica la pista in uso (manica a vento, altri traffici).  «${a}, ${nm.lungo}${ultra}, proveniente da ${A.prov}, primo ingresso sottovento ${sx} pista ${rw}»`};
  if(A.idx===2) return {l:'IN VIRATA BASE'+f,r:nm.reg,t:`«${a}, ${nm.breve}, base ${sxa} ${rw}»`};
  if(A.idx===3||(A.idx===4&&performance.now()-(A.t4||(A.t4=performance.now()))<30000)) return {l:'IN VIRATA FINALE'+f,r:nm.reg,t:`«${a}, ${nm.breve}, finale ${rw}»`};
  return null;
};

// ---- banner che scorre, sopra la barra in basso ----
{ const st=document.createElement('style');
  st.textContent=`#hzRadio{display:flex;align-items:stretch;min-height:42px;border-radius:10px;background:#0f1d28;border:1px solid #2f6488;overflow:hidden;cursor:pointer}
  #hzRadio[hidden]{display:none}
  #hzRadio .l{flex:none;display:flex;align-items:center;padding:0 8px;background:#1a3a52;color:#7fe0ff;font:800 11px/1.15 'Oxanium',system-ui,sans-serif;letter-spacing:.05em;max-width:42%}
  #hzRadio .m{flex:1;min-width:0;overflow:hidden;white-space:nowrap;display:flex;align-items:center}
  #hzRadio .m span{display:inline-block;padding-left:100%;font:700 19px 'Oxanium',system-ui,sans-serif;color:#fff;animation:hzMarq var(--d,12s) linear infinite}
  #hzRadio.p .m{white-space:normal} #hzRadio.p .m span{padding:4px 8px;animation:none;font-size:16px}
  body.ph-land #phMore .ph-more-g button.x{grid-column:auto}
  @keyframes hzMarq{from{transform:translateX(0)}to{transform:translateX(-100%)}}`;
  document.head.appendChild(st); }
const box=document.createElement('div'); box.id='hzRadio'; box.hidden=true; box.setAttribute('role','status');
box.title='Tocca per fermare o far scorrere il testo';
box.innerHTML='<div class="l"></div><div class="m"><span></span></div>';
{ const nav=document.querySelector('.ph-side .ph-nav'); if(nav) nav.parentNode.insertBefore(box,nav); }
box.onclick=()=>box.classList.toggle('p');
let cur='';
function tick(){
  let c=null;
  try{ if(PH.radioOn && !(PH.ac&&PH.ac.radio==='0') && typeof NAV!=='undefined' && NAV.dest && NAV.app) c=PH.radioCall(NAV.app); }catch(e){ c=null; }
  const k=c?c.l+'|'+(c.r||'')+'|'+c.t:'';
  if(k===cur) return; cur=k;
  if(!c){ box.hidden=true; return; }
  { const [ph,...fq]=c.l.split(' · '), sub=[fq.join(' · '),c.r].filter(Boolean).join(' · ');
    box.querySelector('.l').innerHTML=`<span>${esc(ph)}${sub?`<b style="display:block;white-space:nowrap;color:#fff;font-size:12px;margin-top:2px">${esc(sub)}</b>`:''}</span>`; }
  const sp=box.querySelector('.m span'); sp.textContent=c.t;
  box.hidden=false;
  // velocità di lettura: circa 45 px al secondo (da leggere ad alta voce col PTT premuto)
  requestAnimationFrame(()=>{ const w=sp.scrollWidth||600; sp.style.setProperty('--d',Math.max(9,w/45).toFixed(1)+'s'); });
  PH.act&&PH.act('radio: '+c.l);
}
setInterval(tick,1000);
PH.radioTick=tick;

// ---- pagina FREQUENZE ----
function vicini(n,km){
  if(typeof S==='undefined'||S.lat==null) return [];
  return FIELDS.filter(f=>f.kind!=='wp'&&PH.freqOf(f).length).map(f=>({f,d:distBrg(S,f).d})).filter(x=>x.d<km*1000).sort((a,b)=>a.d-b.d).slice(0,n);
}
const riga=(v,extra)=>`<div class="ph-row"><span><b>${esc(mhz(v[2]))}</b> · ${esc(v[0]==='NOTA'?'note del campo':v[0])}${v[1]&&v[1]!==v[0]?' · '+esc(v[1]):''}</span>${extra?`<small>${extra}</small>`:''}</div>`;
PH.freqOpen=function(){
  let d=document.getElementById('hzFreq'); if(d) d.remove();
  d=document.createElement('div'); d.className='ph-sheet'; d.id='hzFreq';
  const dest=typeof NAV!=='undefined'&&NAV.dest&&NAV.dest.kind!=='wp'?NAV.dest:null;
  const vic=vicini(8,40), fis=[];
  for(const {f,d:dd} of vicini(60,120)) for(const v of PH.freqOf(f)) if(FIS.test(v[0])||/information|informazioni/i.test(v[1]))
    if(!fis.some(x=>Math.abs(x.v[2]-v[2])<0.001)) fis.push({v,dd});
  const st=dest?stazione(dest):null;
  const sez=(f,dd)=>{ const fl=PH.freqOf(f).filter(v=>!FIS.test(v[0])); return `<div class="ph-row ph-col"><b>${esc(f.name)}${dd!=null?` · ${(dd/1000).toFixed(0)} km`:''}</b></div>${fl.map(v=>riga(v)).join('')}`; };
  d.innerHTML=`<div class="ph-sheet-h"><button type="button" id="hzFreqB">◀ Strumento</button><b>📻 Frequenze</b></div>
  <div class="ph-imp">
    <section><h3>Campo d'arrivo</h3>${dest?(PH.freqOf(dest).length?sez(dest):`<p class="ph-sub">${esc(dest.name)}: nessuna frequenza nei dati. Chiedila al campo o guarda la carta; puoi scriverla nelle note del campo nel Piano.</p>`)
      +(st&&st.tipo!=='twr'?`<p class="ph-sub">Nel circuito: «${esc(st.nome)}», a ogni lato (ingresso sottovento, base, finale). Prima ascolta e verifica la pista in uso.</p>`:'')
      +(st&&st.tipo==='twr'?`<p class="ph-sub">Campo con torre: si entra solo con l'autorizzazione.</p>`:'')
      :'<p class="ph-sub">Nessuna destinazione. Con un Direct To o una rotta qui compare la frequenza del campo d\'arrivo.</p>'}</section>
    <section><h3>Squadriglia</h3>
      <div class="ph-row"><span><b id="hzSqFv">${esc(PH.sqFreq())}</b> · in volo tra noi</span><small><input id="hzSqF" type="text" inputmode="decimal" value="${esc(PH.sqFreq())}" style="width:6.5em" aria-label="Frequenza della squadriglia"></small></div>
      <p class="ph-sub">Per parlare tra voi in volo. Nel circuito torna sulla frequenza del campo.</p></section>
    <section><h3>Informazioni di volo (FIS)</h3>${fis.length?fis.slice(0,4).map(x=>riga(x.v)).join('')+'<p class="ph-sub">In spazio G puoi ascoltarle o chiamarle per il traffico e il meteo: la frequenza giusta dipende dal settore, guarda la carta.</p>':'<p class="ph-sub">Nessuna frequenza FIS nei dati vicino a te: guarda la carta del settore.</p>'}</section>
    <section><h3>Campi vicini</h3>${vic.length?vic.filter(x=>!dest||x.f.id!==dest.id).map(x=>sez(x.f,x.d)).join(''):'<p class="ph-sub">Nessun campo con frequenza nei dati entro 40 km (o posizione non ancora nota).</p>'}</section>
    <section><h3>Emergenza</h3>${riga(['EMERG','Emergenza, ascoltata da tutti gli enti',121.5])}
      <p class="ph-sub">MAYDAY (pericolo grave) o PAN PAN (urgenza) tre volte, nominativo, posizione, problema, intenzioni. Transponder 7700; avaria radio 7600.</p></section>
    <section><h3>Banner nel circuito</h3>
      <label class="ph-chk"><input type="checkbox" id="hzFreqOn" ${PH.radioOn?'checked':''}> Mostra la chiamata da leggere nel circuito</label>
      <p class="ph-sub">Frequenze dalla comunità OurAirports e dalle note dei campi: verifica sempre su AIP e carta prima del volo.</p></section>
  </div>`;
  document.body.appendChild(d);
  document.getElementById('hzFreqB').onclick=()=>d.remove();
  document.getElementById('hzFreqOn').onchange=e=>PH.radioSet(e.target.checked);
  document.getElementById('hzSqF').onchange=e=>{ const v=PH.sqFreq(e.target.value); if(v){ toast('SQUADRIGLIA SU '+v); e.target.value=v; document.getElementById('hzSqFv').textContent=v; } else { toast('FREQUENZA NON VALIDA (118.000–136.975)'); e.target.value=PH.sqFreq(); } };
  PH.act&&PH.act('frequenze');
};
PH.radioSet=function(v){ PH.radioOn=!!v; lsSet(KEY,PH.radioOn); const c=document.getElementById('phRadioOn'); if(c) c.checked=PH.radioOn; tick(); };

// tasto nel menu ALTRO, prima di CHIUDI
{ const g=document.querySelector('#phMore .ph-more-g'), x=g&&g.querySelector('[data-x]');
  if(g){ const b=document.createElement('button'); b.type='button'; b.id='hzFreqBtn'; b.innerHTML='<i>📻</i>FREQUENZE';
    b.onclick=ev=>{ ev.stopPropagation(); PH.moreOpen(false); PH.freqOpen(); }; g.insertBefore(b,x||null); } }
})();
