// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// STIMATI: solo quello che serve per parlare con l'ente. In alto il riporto di posizione già pronto da leggere
// (marche, posizione, ora, quota, prossimo punto e stimato), poi stimato all'arrivo, autonomia e i punti della
// rotta con quota, distanza, stimato (ETA) e ora di passaggio (ATA). Ore in UTC (Z), come si dicono in radio.
// Si apre toccando la casella DESTINAZIONE o da ALTRO › STIMATI.
(function(){
'use strict';
const esc=x=>String(x??'').replace(/[<&>"]/g,c=>({'<':'&lt;','&':'&amp;','>':'&gt;','"':'&quot;'}[c]));
const p2=n=>String(n).padStart(2,'0');
const Z=t=>{ const d=new Date(t); return p2(d.getUTCHours())+p2(d.getUTCMinutes()); };            // 1432 come in radio
const ZZ=t=>{ const d=new Date(t); return p2(d.getUTCHours())+':'+p2(d.getUTCMinutes())+' Z'; };
const LOC=t=>new Date(t).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
const MIN=s=>{ const m=Math.round(s/60); return m<60?m+"'":Math.floor(m/60)+'h'+p2(m%60); };
const SETT=['nord','nord-est','est','sud-est','sud','sud-ovest','ovest','nord-ovest'];

// ---- ora di passaggio (ATA) dei punti della rotta ----
const ATA={}; let rk=null, ri=null;
setInterval(()=>{ try{ const R=NAV.route; if(!R){ rk=null; return; }
  const k=String(R.r.id); if(k!==rk){ rk=k; ri=R.idx; ATA[k]=ATA[k]||{}; return; }
  if(R.idx>ri) for(let i=ri;i<R.idx;i++) if(!ATA[k][i]) ATA[k][i]=Date.now();
  ri=R.idx; }catch(e){} },1000);

// ---- velocità sulla tratta: velocità vera del velivolo (o stimata dalle virate) corretta col vento ----
function tasKmh(){ return (WIND.valid&&WIND.src==='stim'&&PH.tas>8)?PH.tas*3.6:(+(PH.ac&&PH.ac.vcruise)||AC_.vcruise||100); }
function gsOn(trk){
  const tas=tasKmh(); if(!WIND.valid||!(WIND.kmh>0)) return tas;
  const wa=(WIND.dir-trk)*D2R, xw=WIND.kmh*Math.sin(wa), hw=WIND.kmh*Math.cos(wa);
  return Math.max(20,tas*Math.cos(Math.asin(clamp(xw/tas,-1,1)))-hw);
}
// posizione detta come la vuole l'ente: distanza e settore dal campo più vicino
function posizione(){
  if(S.lat==null) return null;
  try{ const v=PH.vrpPos&&PH.vrpPos(); if(v) return {txt:v}; }catch(e){}            // vicino a un punto di riporto VFR: si usa quello
  let best=null; for(const f of FIELDS){ if(f.kind==='wp'||/^campo utente\b/i.test(f.name||'')) continue;   /* i campi senza nome non dicono niente all'ente */ const d=distBrg(f,S).d; if(!best||d<best.d) best={f,d}; }
  if(!best||best.d>25000) return {txt:`${Math.abs(S.lat).toFixed(2)}${S.lat>=0?'N':'S'} ${Math.abs(S.lon).toFixed(2)}${S.lon>=0?'E':'W'}`};
  if(best.d<1500) return {txt:'sopra '+best.f.name,f:best.f};
  const b=distBrg(best.f,S).brg; return {txt:`${(best.d/1000).toFixed(0)} km a ${SETT[Math.round(b/45)%8]} di ${best.f.name}`,f:best.f};
}
// i punti che restano, con distanza, tempo e stimato
PH.stimCalc=function(){
  const now=Date.now(), out={pts:[],now};
  const R=NAV.route, dest=NAV.dest;
  let list=[];
  if(R&&R.r&&R.r.wps&&R.r.wps.length) list=R.r.wps.map((w,i)=>({name:w.name||w.id,lat:w.lat,lon:w.lon,altFt:w.altFt!=null?w.altFt:(R.r.cruiseFt??null),i,passed:i<R.idx,ata:(ATA[String(R.r.id)]||{})[i]||null}));
  else if(dest) list=[{name:dest.name||dest.short,lat:dest.lat,lon:dest.lon,altFt:NAV.altTgt??null,i:0,passed:false}];
  if(!list.length) return out;
  const vivo=S.gs!=null&&S.gs>40;                               // in volo: per la tratta in corso conta la GS vera
  let from={lat:S.lat,lon:S.lon}, t=now, tot=0, first=true;
  for(const p of list){
    if(p.passed){ out.pts.push(p); continue; }
    const db=distBrg(from,p), gs=first&&vivo?S.gs:gsOn(db.brg), sec=db.d/1000/gs*3600;
    t+=sec*1000; tot+=db.d;
    out.pts.push(Object.assign({},p,{d:db.d,trk:db.brg,gs,sec,eta:t,tot}));
    from=p; first=false;
  }
  out.next=out.pts.find(p=>!p.passed)||null; out.after=out.next?out.pts[out.pts.indexOf(out.next)+1]||null:null;
  out.last=out.pts[out.pts.length-1];
  return out;
};
function marche(){ const a=(PH.ac&&PH.ac.reg&&!/XXXX/i.test(PH.ac.reg))?PH.ac:(PH.acs||[]).find(x=>x.reg&&!/XXXX/i.test(x.reg)); return a?String(a.reg).toUpperCase():''; }

function html(){
  const c=PH.stimCalc(), pos=posizione(), reg=marche(), alt=Math.round((S.alt||0)/100)*100, nx=c.next, now=c.now;
  const fon=reg&&PH.sqFon?PH.sqFon(reg):'‹marche›';
  const fuel=PH.fuelNow?PH.fuelNow():null, endur=fuel&&fuel.burn>0?fuel.L/fuel.burn*3600:null;
  let rip='';
  if(pos) rip=`«${esc(fon)}, ${esc(pos.txt)}, ${Z(now)}, ${alt} piedi${nx?`, stimato ${esc(nx.name)} ${Z(nx.eta)}`:''}${c.after&&!c.after.passed?`, poi ${esc(c.after.name)}`:''}»`;
  const riga=p=>p.passed?`<tr class="ps"><td>${esc(p.name)}</td><td>${p.altFt!=null?p.altFt:'—'}</td><td>—</td><td>—</td><td>${p.ata?Z(p.ata):'✓'}</td></tr>`
    :`<tr${p===nx?' class="nx"':''}><td>${esc(p.name)}</td><td>${p.altFt!=null?p.altFt:'—'}</td><td>${(p.d/1000).toFixed(p.d<10000?1:0).replace('.',',')}</td><td>${Z(p.eta)}</td><td>—</td></tr>`;
  const vel=`${S.gs!=null&&S.gs>40?'GS vera '+Math.round(S.gs):'velocità '+Math.round(tasKmh())} km/h${WIND.valid?` · vento ${String(Math.round(WIND.dir/10)*10).padStart(3,'0')}°/${Math.round(WIND.kmh)} ${WIND.src==='stim'?'stimato':'previsto'}`:' · senza vento'}`;
  return `<div class="ph-sheet-h"><button type="button" id="hzStB">◀ Strumento</button><b>🕑 Stimati</b><span style="margin-left:auto;font:700 15px 'Oxanium',system-ui;color:#7fe0ff">${ZZ(now)}</span></div>
  <div class="ph-imp hz-st">
    <section><h3>Riporto di posizione</h3>${pos?`<p class="hz-rip">${rip}</p><p class="ph-sub">Marche, posizione, ora (Z), quota${nx?', prossimo punto e stimato':''}. Prima di chiamare: QNH e frequenza giusta (ALTRO › FREQUENZE).</p>`:'<p class="ph-sub">Posizione non ancora nota.</p>'}</section>
    ${nx?`<section><h3>Stimati</h3>
      <div class="hz-big"><div><small>PROSSIMO</small><b>${esc(nx.name)}</b><span>${Z(nx.eta)} Z · ${(nx.d/1000).toFixed(1).replace('.',',')} km · ${MIN(nx.sec)}</span></div>
      ${c.last&&c.last!==nx?`<div><small>ARRIVO</small><b>${esc(c.last.name)}</b><span>${Z(c.last.eta)} Z · ${(c.last.tot/1000).toFixed(0)} km · ${MIN((c.last.eta-now)/1000)}</span></div>`:''}</div>
      <table class="hz-tb"><thead><tr><th>Punto</th><th>Quota ft</th><th>km</th><th>ETA Z</th><th>ATA Z</th></tr></thead><tbody>${c.pts.map(riga).join('')}</tbody></table>
      <p class="ph-sub">${vel}. Ore locali: prossimo ${LOC(nx.eta)}${c.last&&c.last!==nx?`, arrivo ${LOC(c.last.eta)}`:''}.</p></section>`
      :`<section><h3>Stimati</h3><p class="ph-sub">Nessuna rotta o destinazione: fai un Direct To o attiva una rotta e qui compaiono stimati e ore di passaggio.</p></section>`}
    <section><h3>Autonomia</h3><div class="ph-row"><span><b>${endur!=null?MIN(endur):'—'}</b>${fuel?` · ${Math.round(fuel.L)} L a ${fuel.burn} L/h`:''}</span><small>${fuel?esc(fuel.how):''}</small></div>
      <p class="ph-sub">Si dice in ore e minuti (es. «autonomia 2 ore e 10»); se serve, correggi il carburante in ALTRO › CARBURANTE.</p></section>
    ${PH.noteLine&&PH.noteLine()?`<section><h3>Note dell'ente</h3><p class="hz-rip" style="font-size:17px">${esc(PH.noteLine())}</p></section>`:''}
    <div class="ph-btns"><button class="ph-btn" type="button" id="hzStF">Frequenze</button><button class="ph-btn" type="button" id="hzStN">📝 Note ente</button></div>
  </div>`;
}
{ const st=document.createElement('style');
  st.textContent=`.hz-st .hz-rip{font:700 19px/1.35 'Oxanium',system-ui,sans-serif;color:#fff;margin:0}
  .hz-st .hz-big{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}
  .hz-st .hz-big div{background:#10202c;border:1px solid #2f6488;border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:2px;min-width:0}
  .hz-st .hz-big small{font:800 11px 'Oxanium',system-ui;color:#7fe0ff;letter-spacing:.06em}
  .hz-st .hz-big b{font:800 20px 'Oxanium',system-ui;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .hz-st .hz-big span{font:700 16px 'Oxanium',system-ui;color:#ffd21e}
  .hz-st .hz-tb{width:100%;border-collapse:collapse;font:600 15px 'Oxanium',system-ui;font-variant-numeric:tabular-nums}
  .hz-st .hz-tb th{font:800 11px 'Oxanium',system-ui;color:#9aa4b0;text-align:right;padding:4px 3px;border-bottom:1px solid #28323c}
  .hz-st .hz-tb td{text-align:right;padding:6px 3px;border-bottom:1px solid #1f2830}
  .hz-st .hz-tb th:first-child,.hz-st .hz-tb td:first-child{text-align:left;max-width:9em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .hz-st .hz-tb tr.nx td{color:#ff7af0;font-weight:800} .hz-st .hz-tb tr.ps td{color:#6c7884}
  #phDest{cursor:pointer}`;
  document.head.appendChild(st); }

PH.stimOpen=function(){
  let d=document.getElementById('hzSt'); if(d) d.remove();
  d=document.createElement('div'); d.className='ph-sheet'; d.id='hzSt';
  const draw=()=>{ const y=d.querySelector('.ph-imp')?d.querySelector('.ph-imp').scrollTop:0; d.innerHTML=html();
    d.querySelector('.ph-imp').scrollTop=y;
    document.getElementById('hzStB').onclick=()=>{ clearInterval(tm); d.remove(); };
    document.getElementById('hzStF').onclick=()=>{ PH.freqOpen&&PH.freqOpen(); };
    document.getElementById('hzStN').onclick=()=>{ clearInterval(tm); d.remove(); PH.noteOpen&&PH.noteOpen(); }; };
  document.body.appendChild(d); draw();
  const tm=setInterval(()=>{ if(!document.getElementById('hzSt')){ clearInterval(tm); return; } try{ draw(); }catch(e){} },5000);
  PH.act&&PH.act('stimati');
};

// la casella DESTINAZIONE apre gli stimati (tocco breve, anche in volo: è solo una pagina da leggere)
{ const c=document.getElementById('phDest'); if(c){ c.title='Stimati'; c.addEventListener('click',()=>PH.stimOpen()); } }
// tasto nel menu ALTRO, prima di CHIUDI; con 10 tasti CHIUDI sta accanto agli altri (in verticale) o su tutta la riga (in orizzontale)
{ const st=document.createElement('style'); st.textContent='body:not(.ph-land) #phMore .ph-more-g button.x{grid-column:auto} body.ph-land #phMore .ph-more-g button.x{grid-column:1/-1}'; document.head.appendChild(st);
  const g=document.querySelector('#phMore .ph-more-g'), x=g&&g.querySelector('[data-x]');
  if(g){ const b=document.createElement('button'); b.type='button'; b.id='hzStBtn'; b.innerHTML='<i>🕑</i>STIMATI';
    b.onclick=ev=>{ ev.stopPropagation(); PH.moreOpen(false); PH.stimOpen(); }; g.insertBefore(b,x||null); } }
})();
