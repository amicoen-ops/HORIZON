// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
// =====================================================================================
//  App del piano dentro la versione telefono: i dati vanno allo strumento sullo stesso
//  telefono; meteo da Open-Meteo (modello sui campi della rotta), METAR da incollare.
// =====================================================================================
window.IA517_refresh=()=>{ try{ pullData(); }catch(e){} };
window.IA517_asp=()=>ASP_SRC.real?ASP:[];          // spazi aerei veri per gli avvisi in volo; gli esempi no

let MODEL=store.get('ia517_wx_model',{t:0,ids:'',data:{}}), MODEL_BUSY=false, MODEL_ERR='', MODEL_T=null, PASTED=store.get('ia517_metar_paste','');
function wxFields(){ const s=new Set(), out=[]; for(const f of [...planFields(),HOME,...ROUTE_EXTRA()]) if(f&&!s.has(f.id)){ s.add(f.id); out.push(f); } return out.slice(0,24); }
function ROUTE_EXTRA(){ return []; }
function modelSchedule(){ clearTimeout(MODEL_T); MODEL_T=setTimeout(()=>fetchModel(false),1200); }
async function fetchModel(force){
  const fs=wxFields(), ids=fs.map(f=>f.id).sort().join(',');
  const fresh=Date.now()-MODEL.t<20*60000, covered=fs.every(f=>MODEL.data[f.id]);
  if(!force && fresh && covered) return;
  if(MODEL_BUSY) return; MODEL_BUSY=true; MODEL_ERR='';
  const q=a=>a.map(x=>x.toFixed(4)).join(',');
  const url='https://api.open-meteo.com/v1/forecast?latitude='+q(fs.map(f=>f.lat))+'&longitude='+q(fs.map(f=>f.lon))+
    '&current=temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,visibility'+
    '&hourly=wind_speed_925hPa,wind_direction_925hPa,wind_speed_850hPa,wind_direction_850hPa,cloud_cover_low&forecast_hours=2&wind_speed_unit=kmh&timezone=UTC';
  try{
    const ctl=new AbortController(), tm=setTimeout(()=>ctl.abort(),12000);
    const r=await fetch(url,{signal:ctl.signal}); clearTimeout(tm);
    if(!r.ok) throw new Error('errore '+r.status);
    let j=await r.json(); if(!Array.isArray(j)) j=[j];
    const data=Object.assign({},MODEL.data);
    j.forEach((o,i)=>{ const f=fs[i], c=o.current||{}, h=o.hourly||{}; if(!f) return;
      data[f.id]={lat:f.lat,lon:f.lon,short:f.short,time:c.time,dir:c.wind_direction_10m,kmh:c.wind_speed_10m,gust:c.wind_gusts_10m,
        qnh:c.pressure_msl!=null?Math.round(c.pressure_msl):null,t:c.temperature_2m,cc:c.cloud_cover,vis:c.visibility,
        ccLow:h.cloud_cover_low?h.cloud_cover_low[0]:null,
        w925:h.wind_speed_925hPa?{kmh:h.wind_speed_925hPa[0],dir:h.wind_direction_925hPa[0]}:null,
        w850:h.wind_speed_850hPa?{kmh:h.wind_speed_850hPa[0],dir:h.wind_direction_850hPa[0]}:null}; });
    MODEL={t:Date.now(),ids,data}; store.set('ia517_wx_model',MODEL);
    if(PHONE) try{ parent.IA517.wx(MODEL.data); }catch(e){}
  }catch(e){ MODEL_ERR=navigator.onLine?'meteo non raggiungibile ('+(e.name==='AbortError'?'tempo scaduto':e.message)+')':'senza internet: dati dell\'ultimo scarico'; }
  finally{ MODEL_BUSY=false; renderWx(); const f=byId(PLAN.dest), {w}=f?nearestWx(f):{w:null};
    $('arrival').innerHTML=`<div style="margin-bottom:6px">${wxStamp(MODEL.t,'Meteo')}</div>`+arrivalHTML(f,(w&&!w.vrb)?{dir:w.dir,kmh:w.kmh}:null,w?w.id:''); }
}
// il vento al campo è quello del modello sul punto esatto del campo
function nearestWx(f){
  const m=MODEL.data[f.id];
  if(m && m.kmh!=null) return {w:{id:'previsto sul campo',vrb:false,dir:Math.round(m.dir),kmh:m.kmh,gust:m.gust,qnh:m.qnh},d:0};
  return {w:null,d:0};
}
// ora dell'aggiornamento sempre visibile: orario esatto, da quanto, e colore se è vecchio
function wxStamp(t,label){ if(!t) return `<span class="warn">${label||'Meteo'}: mai scaricato</span>`;
  const min=Math.round((Date.now()-t)/60000), hh=new Date(t).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}), dd=new Date(t).toDateString()===new Date().toDateString()?'':' del '+new Date(t).toLocaleDateString('it-IT');
  const cls=min>90?'bad':(min>30?'warn':'ok');
  return `<span class="pill ${cls}" style="font-weight:700">${label||'Meteo'} aggiornato alle ${hh}${dd} · ${min<1?'adesso':min+' min fa'}${min>30?' · aggiorna prima di partire':''}</span>`; }
const utcHM=iso=>{ if(!iso) return ''; const d=new Date(/Z$/.test(iso)?iso:iso+'Z'); return isNaN(d)?'':d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}); };
const d3=v=>String(Math.round(v)).padStart(3,'0');
// direzione del vento anche a parole: da dove viene (N, NE, E, SE, S, SO, O, NO) e il nome tradizionale
const W8=['N','NE','E','SE','S','SO','O','NO'], W8N=['tramontana','grecale','levante','scirocco','ostro','libeccio','ponente','maestrale'];
function windCard(dir){ const i=Math.round((((+dir)%360)+360)%360/45)%8; return W8[i]; }
function windDir(dir,long){ const i=Math.round((((+dir)%360)+360)%360/45)%8; return `${d3(dir)}° da ${W8[i]}${long?' ('+W8N[i]+')':''}`; }
function renderWx(){
  const age=MODEL.t?Math.round((Date.now()-MODEL.t)/60000):null;
  const fs=wxFields();
  let html=`<div style="margin:4px 0 8px">${wxStamp(MODEL.t,'Modello')}</div><div class="sub">Modello Open-Meteo sul punto di ogni campo${MODEL_ERR?` · <span class="warn">${esc(MODEL_ERR)}</span>`:''}. È una previsione, non un'osservazione: vale come orientamento, la manica a vento e la radio decidono.</div>
    <div class="btnrow"><button class="btn" type="button" id="wxRefresh">${MODEL_BUSY?'Aggiorno…':'Aggiorna meteo'}</button></div>`;
  html+=fs.map(f=>{ const m=MODEL.data[f.id]; if(!m) return `<div class="metar"><div class="mh"><b>${esc(f.short)}</b></div><div class="sub">non ancora scaricato</div></div>`;
    return `<div class="metar"><div class="mh"><b>${esc(f.short)} · ${esc(f.name)}</b>${m.time?`<span class="sub">previsione per le ${utcHM(m.time)}</span>`:''}${m.qnh?`<button class="btn" type="button" data-q="${m.qnh}">Invia QNH ${m.qnh}</button>`:''}</div>
      <div class="dec"><span>Vento <b>${windDir(m.dir,1)} · ${Math.round(m.kmh)} km/h${m.gust>m.kmh+9?' raffiche '+Math.round(m.gust):''}</b></span>
      ${m.w925?`<span>~2500 ft <b>${windDir(m.w925.dir)} · ${Math.round(m.w925.kmh)}</b></span>`:''}${m.w850?`<span>~5000 ft <b>${windDir(m.w850.dir)} · ${Math.round(m.w850.kmh)}</b></span>`:''}
      <span>Nubi <b>${m.cc!=null?m.cc+'%':'n.d.'}${m.ccLow!=null?' (basse '+m.ccLow+'%)':''}</b></span>
      <span>Vis. <b>${m.vis!=null?(m.vis>=10000?'≥10 km':(m.vis/1000).toFixed(1)+' km'):'n.d.'}</b></span>
      <span>T <b>${m.t!=null?Math.round(m.t)+'°':'n.d.'}</b></span><span>QNH <b>${m.qnh||'n.d.'}</b></span></div></div>`; }).join('');
  $('metars').innerHTML=html;
  $('metars').querySelectorAll('button[data-q]').forEach(b=>b.addEventListener('click',()=>sendQnh(+b.dataset.q)));
  $('wxRefresh').addEventListener('click',()=>fetchModel(true));
  // METAR ufficiali: nell'app installata si scaricano da soli; dal browser si aprono e si incollano
  if(LIVE_METAR.list.length) renderLiveMetar(); else {
  const pm=PASTED.split(/\n+/).map(s=>s.trim()).filter(s=>/^[A-Z]{4}\s+\d{6}Z/.test(s.replace(/^(METAR|SPECI)\s+/,''))).map(parseMetar);
  $('metarOff').innerHTML=`<div class="sub">I METAR veri si leggono su aviationweather.gov: aprili, copia il testo e incollalo qui per decodificarli e mandare il QNH.</div>
    <div class="btnrow"><a class="btn" href="https://aviationweather.gov/data/metar/?ids=LIMF,LIMC,LIMW,LILE,LIMZ,LIMA,LILI&hours=0" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;text-decoration:none">Apri i METAR della zona</a></div>
    <textarea id="metarIn" rows="3" placeholder="Incolla qui i METAR, uno per riga">${esc(PASTED)}</textarea>`+
    pm.map(w=>`<div class="metar"><div class="mh"><b>${esc(w.id)}</b>${w.qnh?`<button class="btn" type="button" data-q="${w.qnh}">Invia QNH ${w.qnh}</button>`:''}</div><div class="raw">${esc(w.raw)}</div>
      <div class="dec"><span>Vento <b>${w.vrb?'variabile':windDir(w.dir,1)} · ${Math.round(w.kmh||0)} km/h${w.gust?' raffiche '+Math.round(w.gust):''}</b></span><span>Vis. <b>${w.vis||'n.d.'}</b></span>
      <span>Nubi <b>${w.cl?w.cl.join(', '):(w.vis==='CAVOK'?'nessuna':'n.d.')}</b></span><span>QNH <b>${w.qnh||'n.d.'}</b></span><span class="sub">${w.time||''}</span></div></div>`).join('');
  $('metarOff').querySelectorAll('button[data-q]').forEach(b=>b.addEventListener('click',()=>sendQnh(+b.dataset.q)));
  $('metarIn').addEventListener('change',()=>{ PASTED=$('metarIn').value; store.set('ia517_metar_paste',PASTED); renderWx(); });
  }
  const f=byId(PLAN.dest);
  if(f){ const {w}=nearestWx(f), wind=w?{dir:w.dir,kmh:w.kmh}:null;
    $('wxDest').innerHTML=`<div style="margin-bottom:6px">${wxStamp(MODEL.t,'Meteo')}</div><div class="sub">${esc(f.name)}: ${w?'vento previsto dal modello sul campo':'meteo non ancora scaricato'}.</div>`+arrivalHTML(f,wind,'previsto'); }
}
// ---- METAR e TAF veri (aviationweather.gov): l'app nativa li legge senza i limiti del browser ----
let LIVE_METAR={t:0,list:[],taf:{},err:'',busy:false};
function metarStations(){
  const base=['LIMF','LIMA','LIMC','LILE','LIMW','LIMZ','LILI','LIMN'];
  const near=new Set();
  for(const f of planFields()){ FIELDS.filter(a=>a.kind==='aero' && /^[A-Z]{4}$/.test(a.id)).map(a=>({a,d:dist(f,a).d})).sort((x,y)=>x.d-y.d).slice(0,3).forEach(o=>near.add(o.a.id)); }
  return [...new Set([...near,...base])].slice(0,14);
}
async function fetchMetar(force){
  if(!PHONE || !parent.IA517 || !parent.IA517.http) return;
  if(LIVE_METAR.busy || (!force && Date.now()-LIVE_METAR.t<10*60000 && LIVE_METAR.list.length)) return;
  LIVE_METAR.busy=true; LIVE_METAR.err='';
  const ids=metarStations().join(',');
  try{
    const r=await parent.IA517.http('https://aviationweather.gov/api/data/metar?ids='+ids+'&format=raw&hours=2');
    if(r.status!==200) throw new Error('risposta '+r.status);
    const seen=new Set(), list=[];
    for(const line of r.text.split(/\n+/)){ const t=line.trim(); if(!t) continue; const w=parseMetar(t); if(!w.id||seen.has(w.id)) continue; seen.add(w.id); list.push(w); }
    let taf={}; try{ const rt=await parent.IA517.http('https://aviationweather.gov/api/data/taf?ids='+ids+'&format=raw');
      if(rt.status===200) rt.text.split(/\n(?=TAF |[A-Z]{4} \d{6}Z)/).forEach(b=>{ const m=b.replace(/^TAF\s+(AMD\s+|COR\s+)?/,'').match(/^([A-Z]{4})\s/); if(m && !taf[m[1]]) taf[m[1]]=b.trim(); }); }catch(e){}
    LIVE_METAR={t:Date.now(),list,taf,err:'',busy:false};
    store.set('ia517_metar_live',LIVE_METAR);
  }catch(e){ LIVE_METAR.busy=false; LIVE_METAR.err=(e&&e.message)||'non raggiungibile'; }
  renderWx();
}
function renderLiveMetar(){
  const age=Math.round((Date.now()-LIVE_METAR.t)/60000), nm=id=>{ const f=byId(id); return f?f.name:''; };
  $('metarOff').innerHTML=`<div style="margin:4px 0 8px">${wxStamp(LIVE_METAR.t,'METAR')}</div><div class="sub">Da aviationweather.gov${LIVE_METAR.err?` · <span class="warn">${esc(LIVE_METAR.err)}</span>`:''}. Aeroporti vicini ai campi del piano e della zona.</div>
    <div class="btnrow"><button class="btn" type="button" id="metarRefresh">${LIVE_METAR.busy?'Aggiorno…':'Aggiorna METAR'}</button></div>`+
    LIVE_METAR.list.map(w=>`<div class="metar"><div class="mh"><b>${esc(w.id)}${nm(w.id)?' · '+esc(nm(w.id)):''}</b>${w.qnh?`<button class="btn" type="button" data-q="${w.qnh}">Invia QNH ${w.qnh}</button>`:''}</div><div class="raw">${esc(w.raw)}</div>
      <div class="dec"><span>Vento <b>${w.vrb?'variabile':windDir(w.dir,1)} · ${Math.round(w.kmh||0)} km/h${w.gust?' raffiche '+Math.round(w.gust):''}</b></span><span>Vis. <b>${w.vis||'n.d.'}</b></span>
      <span>Nubi <b>${w.cl?w.cl.join(', '):(w.vis==='CAVOK'?'nessuna':'n.d.')}</b></span><span>QNH <b>${w.qnh||'n.d.'}</b></span><span class="sub">osservato ${w.time||''}</span></div>
      ${LIVE_METAR.taf[w.id]?`<details><summary>TAF</summary><div class="raw">${esc(LIVE_METAR.taf[w.id])}</div></details>`:''}</div>`).join('');
  $('metarOff').querySelectorAll('button[data-q]').forEach(b=>b.addEventListener('click',()=>sendQnh(+b.dataset.q)));
  $('metarRefresh').addEventListener('click',()=>fetchMetar(true));
}
(()=>{ const old=store.get('ia517_metar_live',null); if(old && old.list && Date.now()-old.t<3*3600e3) LIVE_METAR=Object.assign(old,{busy:false}); })();
if(PHONE && parent.IA517 && parent.IA517.native){ setTimeout(()=>fetchMetar(false),1500); setInterval(()=>fetchMetar(false),5*60000); }
// quando cambia il piano si aggiorna anche il meteo dei campi interessati
const _updateOrig=update;
update=function(){ _updateOrig(); modelSchedule(); };
if(PHONE){
  document.querySelectorAll('.tab .card').forEach(c=>{ const h=c.querySelector('h2'); if(h && /Collegare il telefono|Aggiornamenti/.test(h.textContent)) c.remove(); });
  const b=$('nfHere'); if(b) b.textContent='Posizione del telefono';
}
setInterval(()=>{ if(Date.now()-MODEL.t>20*60000 && navigator.onLine) fetchModel(false); },60000);
addEventListener('online',()=>fetchModel(false));

// ---------------- OpenAir 2.0 (riga AY con il tipo): la classe che usano briefing e avvisi ----------------
(function(){
  const MAP={R:'R',P:'P',Q:'Q',D:'Q',DANGER:'Q',RESTRICTED:'R',PROHIBITED:'P',TRA:'R',TSA:'R',OFR:'OFR',ASRA:'SPORT',GLIDING_SECTOR:'GSEC',TMZ:'TMZ',RMZ:'RMZ'};
  const norm=text=>{
    if(!/^AY\s/m.test(text)) return text;
    const out=[]; let blk=[];
    const flush=()=>{ if(!blk.length) return;
      const iAC=blk.findIndex(l=>/^AC\s/i.test(l)), ay=blk.find(l=>/^AY\s/i.test(l));
      if(iAC>=0 && ay){ const typ=ay.slice(2).trim().toUpperCase(), cls=blk[iAC].slice(2).trim().toUpperCase();
        if(typ==='FIR'||typ==='UIR'){ blk=[]; return; }
        if(MAP[typ] && (cls==='UNC'||cls==='UNCLASSIFIED'||!cls)) blk[iAC]='AC '+MAP[typ];
        const nm=(blk.find(l=>/^AN\s/i.test(l))||'');
        if(/\bFMC\b/i.test(nm)) blk[iAC]='AC FMC';                              // area FMC: codice e ascolto raccomandati, non un divieto
        const iAN=blk.findIndex(l=>/^AN\s/i.test(l));
        if(iAN>=0 && /^(CTR|CTA|TMA|ATZ|MATZ|TMZ|RMZ)$/.test(typ) && !new RegExp('\\b'+typ+'\\b','i').test(blk[iAN])) blk[iAN]='AN '+typ+' '+blk[iAN].slice(2).trim(); }
      out.push(...blk); blk=[]; };
    for(const l of text.split(/\r?\n/)){ if(/^AC\s/i.test(l)) flush(); blk.push(l); }
    flush(); return out.join('\n'); };
  { const lb=clsLabel; clsLabel=function(a){ return {FMC:'Area FMC',SPORT:'Attività sportive',OFR:'Sorvolo limitato',UNC:'Non classificato',GSEC:'Settore alianti'}[a.cls]||lb(a); }; }
  const base=parseOpenAir; parseOpenAir=function(text){ return base(norm(String(text||''))); };
  // gli spazi salvati sono stati letti all'avvio prima di questa correzione: si rileggono
  const st=store.get('ia517_openair',null);
  if(st && st.text && ASP_SRC.real){ const l=parseOpenAir(st.text); if(l.length){ ASP=l; ASP_SRC.count=l.length; } }
})();

// ---------------- spazi aerei veri dell'Italia da openAIP, ricaricati a ogni ciclo AIRAC ----------------
// Due strade, nell'ordine: 1) il file OpenAir dell'Italia che openAIP esporta ogni giorno (pubblico, senza account);
// 2) l'API di openAIP con la chiave gratuita del pilota. In più restano il file dal telefono e un indirizzo qualsiasi.
(function(){
  const file=$('aspFile'), row=file&&file.closest('.srcrow'); if(!row) return;
  const DAY=864e5, EP=Date.UTC(2020,0,2);                                  // inizio del ciclo AIRAC 2001
  const airac=t=>{ const n=Math.floor((t-EP)/(28*DAY)), s=EP+n*28*DAY, y=new Date(s).getUTCFullYear();
    return {start:s,code:String(y%100).padStart(2,'0')+String(Math.floor((s-Date.UTC(y,0,1))/(28*DAY))+1).padStart(2,'0')}; };
  // nell'app installata il file di openAIP; nel browser (iPhone, Chrome) la copia notturna sullo stesso sito, perché openAIP non permette la lettura diretta
  const FILES=(PHONE&&parent.IA517&&parent.IA517.native)?['https://storage.openaip.net/openaip-system-exports/it_asp_v2.txt']
    :['dati/it_asp_v2.txt','https://storage.openaip.net/openaip-system-exports/it_asp_v2.txt'];
  const API='https://api.core.openaip.net/api/airspaces';
  const saved=()=>store.get('ia517_openair',null)||{};
  const keyGet=()=>store.get('ia517_openaip_key','');
  const NATIVE=PHONE&&parent.IA517&&parent.IA517.native;
  const box=document.createElement('div'); box.className='aspnet';
  box.innerHTML=`<div class="btnrow" style="margin-top:10px"><button class="btn pri" type="button" id="oaipGo">Scarica gli spazi aerei d'Italia (openAIP)</button></div>
    <div class="sub" id="oaipMsg"></div>
    <details style="margin-top:8px"><summary class="sub">Chiave openAIP e altre strade</summary>
      <div class="sub" style="margin-top:6px">Non serve niente: l'app scarica il file dell'Italia che openAIP pubblica ogni notte (circa 1,5 MB, 1500 spazi). Solo se quel file non rispondesse, prova l'API di openAIP con la tua chiave gratuita: account su openaip.net › Profilo › API Clients › crea una chiave, e incollala qui.</div>
      <div class="fld"><label for="oaipKey">Chiave API openAIP (facoltativa)</label><input id="oaipKey" type="text" autocomplete="off" spellcheck="false" value="${esc(keyGet())}" placeholder="incolla la chiave"></div>
      <div class="fld"><label for="aspUrl">Oppure l'indirizzo di un file OpenAir</label><input id="aspUrl" type="text" inputmode="url" autocomplete="off" placeholder="https://…" value="${esc(saved().kind==='url'?saved().url||'':'')}"></div>
      <div class="btnrow"><button class="btn" type="button" id="aspUrlGo">Scarica da questo indirizzo</button><a class="btn" style="display:inline-flex;align-items:center;text-decoration:none" href="https://www.openaip.net/data/airspaces" target="_blank" rel="noopener">Apri openAIP</a></div>
    </details>`;
  row.after(box);
  const msg=h=>{ $('oaipMsg').innerHTML=h; };
  const show=()=>{ const s=saved(), a=airac(Date.now());
    if(!s.t){ msg('Scarica una volta con internet: poi restano sul telefono e si aggiornano da soli a ogni ciclo AIRAC (ogni 28 giorni).'); return; }
    msg(`In uso: <b>${esc(s.src||s.name)}</b> · ${s.count||ASP.length} spazi · scaricati il ${new Date(s.t).toLocaleDateString('it-IT')} (AIRAC ${airac(s.t).code})`+
        (s.t<a.start?` · <span class="warn">è iniziato il ciclo ${a.code}: li riscarico appena c'è rete</span>`:''));
  };
  const get=async(url,headers)=>{ const H=PHONE&&parent.IA517&&parent.IA517.http; if(H) return H(url,headers);
    const r=await fetch(url,{headers:headers||{}}); return {status:r.status,text:await r.text()}; };
  const use=(text,src,meta)=>{
    const list=parseOpenAir(text); if(!list.length) throw new Error('nessuno spazio aereo nel file');
    ASP=list; ASP_SRC={real:true,name:src,count:list.length};
    const rec=Object.assign({name:src,src,text,t:Date.now(),count:list.length},meta);
    store.set('ia517_openair',rec);
    if((store.get('ia517_openair',null)||{}).t!==rec.t) toast('Spazi aerei in uso, ma troppo grandi per restare salvati: riscaricali al prossimo avvio');
    update(); show(); return list.length;
  };
  // openAIP (API) -> OpenAir: stesso formato del file, così briefing, profilo e avvisi restano identici
  const dms=(v,pos,neg,w)=>{ const a=Math.abs(v), d=Math.floor(a), m=Math.floor((a-d)*60), s=Math.round(((a-d)*60-m)*60);
    const ss=s===60?59:s; return String(d).padStart(w,'0')+':'+String(m).padStart(2,'0')+':'+String(ss).padStart(2,'0')+' '+(v>=0?pos:neg); };
  const lim=L=>{ if(!L) return 'GND'; const v=+L.value||0, u=+L.unit, r=+L.referenceDatum;
    if(u===6) return 'FL'+Math.round(v); if(r===0 && v===0) return 'GND';
    const ft=u===0?Math.round(v/0.3048):Math.round(v); return ft+'ft '+(r===0?'AGL':'AMSL'); };
  const TYPE={1:'R',2:'Q',3:'P',4:'CTR',5:'TMZ',6:'RMZ',8:'R',9:'R',17:'Q',18:'Q',21:'GSEC',28:'W'};
  const SKIP=new Set([10,11,12,15,16,27,33]);                              // FIR, UIR, ADIZ, aerovie, MTR, settori ACC e FIS
  const CLS=['A','B','C','D','E','F','G'];
  const toOA=items=>{ const L=['* openAIP · CC BY-NC 4.0 · www.openaip.net'];
    for(const it of items){ if(SKIP.has(+it.type)) continue; const g=it.geometry; if(!g||!g.coordinates) continue;
      const ring=g.type==='Polygon'?g.coordinates[0]:(g.type==='MultiPolygon'?g.coordinates[0][0]:null); if(!ring||ring.length<4) continue;
      const cls=TYPE[+it.type]||CLS[+it.icaoClass]||'UNC';
      L.push('AC '+cls,'AN '+String(it.name||'').replace(/[\r\n]/g,' '),'AL '+lim(it.lowerLimit),'AH '+lim(it.upperLimit));
      for(const [lon,lat] of ring.slice(0,-1)) L.push('DP '+dms(lat,'N','S',2)+' '+dms(lon,'E','W',3)); }
    return L.join('\n'); };
  async function viaApi(key){
    const items=[]; let page=1, pages=1;
    do{ const r=await get(`${API}?country=IT&limit=1000&page=${page}`,{'x-openaip-api-key':key,'Accept':'application/json'});
      if(r.status===401||r.status===403) throw new Error('chiave openAIP non valida');
      if(r.status!==200) throw new Error('openAIP ha risposto '+r.status);
      const j=JSON.parse(r.text); items.push(...(j.items||[])); pages=j.totalPages||1; page++;
    } while(page<=pages && page<=10);
    return toOA(items);
  }
  // spazi aerei dei Paesi vicini, solo nella fascia alpina vicina al Nord Italia (per le rotte oltre confine: Tovière, Svizzera, Carinzia…)
  const NEAR=[['fr','Francia'],['ch','Svizzera'],['at','Austria'],['si','Slovenia']];
  const inAlps=(la,lo)=>la>=43.5&&la<=47.6&&lo>=5.3&&lo<=14.8;
  const dmsDec=(d,m,sec,h)=>(+d+(+m)/60+(+sec||0)/3600)*(/[SW]/.test(h)?-1:1);
  function alpsFilter(text){ const blocks=String(text).split(/\r?\n(?=AC\s)/), keep=[];
    for(const b of blocks){ if(!/^AC\s/.test(b)) continue; let ok=false;
      for(const m of b.matchAll(/(\d{1,3}):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?))?\s*([NS])[\s,]+(\d{1,3}):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?))?\s*([EW])/g)){
        if(inAlps(dmsDec(m[1],m[2],m[3],m[4]),dmsDec(m[5],m[6],m[7],m[8]))){ ok=true; break; } }
      if(ok) keep.push(b); }
    return keep.join('\n'); }
  async function alpsNear(){ const out=[], names=[];
    for(const [cc,nm] of NEAR){ const urls=(PHONE&&parent.IA517&&parent.IA517.native)?[]:[`dati/${cc}_asp_v2.txt`]; urls.push(`https://storage.openaip.net/openaip-system-exports/${cc}_asp_v2.txt`);
      for(const u of urls){ try{ const r=await get(u); if(r.status===200 && /AC\s/.test(r.text||'')){ const t=alpsFilter(r.text); if(t){ out.push('* '+nm+'\n'+t); names.push(nm); } break; } }catch(e){} } }
    return {text:out.join('\n'),names}; }
  async function openaip(quiet){
    if(!quiet) msg('Scarico da openAIP…');
    let why='';
    for(const f of FILES){                                                 // 1) file pubblico dell'Italia
      try{ const r=await get(f); if(r.status===200 && /^\s*(\*|AC\s)/m.test(r.text||'')){
          if(!quiet) msg('Italia scaricata. Scarico le Alpi vicine (Francia, Svizzera, Austria, Slovenia)…');
          const extra=await alpsNear(), txt=r.text+(extra.text?'\n'+extra.text:'');
          const n=use(txt,'openAIP · Italia'+(extra.names.length?' e Alpi vicine ('+extra.names.join(', ')+')':''),{kind:'openaip'});
          if(!quiet) toast(`${n} spazi aerei da openAIP`); return; }
        why='file openAIP: risposta '+r.status; }catch(e){ why='file openAIP: '+(e&&e.message||e); }
    }
    const key=($('oaipKey')&&$('oaipKey').value.trim())||keyGet();
    if(key){ try{ const n=use(await viaApi(key),'openAIP · Italia (API)',{kind:'openaip'}); if(!quiet) toast(`${n} spazi aerei d'Italia da openAIP`); return; }
             catch(e){ why=String(e&&e.message||e); } }
    else why+=(why?' · ':'')+'controlla la connessione e riprova';
    msg(`<span class="warn">Non riuscito: ${esc(why)}.</span>${NATIVE?'':' Dal browser openAIP può non permettere la lettura diretta: usa l\'app installata, oppure scarica il file e usa «Carica file OpenAir».'}`);
  }
  async function byUrl(url,quiet){
    url=String(url||'').trim(); if(!/^https?:\/\//i.test(url)){ if(!quiet) msg('<span class="warn">Serve un indirizzo che inizia con http:// o https://</span>'); return; }
    if(!quiet) msg('Scarico…');
    try{ const r=await get(url); if(r.status!==200) throw new Error('risposta '+r.status);
      const n=use(String(r.text||''),decodeURIComponent(url.split('?')[0].split('/').pop()||'openair.txt'),{kind:'url',url}); if(!quiet) toast(`${n} spazi aerei scaricati`);
    }catch(e){ msg(`<span class="warn">Non riuscito: ${esc(String(e&&e.message||e))}.</span>`); }
  }
  $('oaipGo').onclick=()=>openaip(false);
  $('oaipKey').addEventListener('change',e=>store.set('ia517_openaip_key',e.target.value.trim()));
  $('aspUrlGo').onclick=()=>byUrl($('aspUrl').value,false);
  show();
  // all'avvio: se è iniziato un ciclo AIRAC nuovo rispetto all'ultimo scarico, si riscarica in silenzio dalla stessa fonte
  const s=saved();
  if(s.t && s.t<airac(Date.now()).start){ if(s.kind==='openaip') setTimeout(()=>openaip(true),6000); else if(s.kind==='url'&&s.url) setTimeout(()=>byUrl(s.url,true),6000); }
})();

// ---------------- Desk Aeronautico: collegamenti rapidi (NOTAM, meteo, briefing) ----------------
(function(){
  const D='https://www.deskaeronautico.it/';
  const L=[['mappa/','Mappa NOTAM'],['cerca-notam/','Cerca NOTAM'],['airport-easy-briefing/','Briefing aeroporto'],['metar/','METAR'],['taf/','TAF'],['sigmet-e-airmet/','SIGMET e AIRMET'],['carte-meteo/','Carte meteo']];
  const card=(ids)=>{ const s=document.createElement('section'); s.className='card';
    s.innerHTML=`<h2>Desk Aeronautico</h2><div class="sub">Portale italiano gratuito con NOTAM, meteo e briefing presi dalle fonti AIS: comodo per un controllo veloce. Lo stesso sito avverte che non è una fonte ufficiale né a uso operativo: per il volo valgono AIP, NOTAM e meteo ufficiali.</div>
      <div class="btnrow" style="margin-top:8px">${L.filter(([p])=>ids.includes(p)).map(([p,t])=>`<a class="btn" style="display:inline-flex;align-items:center;text-decoration:none" href="${D+p}" target="_blank" rel="noopener">${t}</a>`).join('')}</div>`;
    return s; };
  const notam=$('notamList'), nSec=notam&&notam.closest('section');
  if(nSec) nSec.after(card(['mappa/','cerca-notam/','airport-easy-briefing/','sigmet-e-airmet/']));
  const met=$('tab-meteo'); if(met){ const first=met.querySelector('section'); const c=card(['metar/','taf/','sigmet-e-airmet/','carte-meteo/']); if(first) first.before(c); else met.appendChild(c); }
})();


// ---------------- tipo di volo: controlli della rotta secondo le regole (VDS basico, VDS avanzato, VFR) ----------------
(function(){
  const R=window.IA517_RULES; if(!R) return;
  const brief=$('tab-briefing'); if(!brief) return;
  const card=document.createElement('section'); card.className='card'; card.id='profCard';
  brief.insertBefore(card, brief.firstChild);
  const demAt=(lat,lon)=>{ try{ return parent&&parent.phDemAt?parent.phDemAt(lat,lon,10):NaN; }catch(e){ return NaN; } };
  // ostacolo più alto entro 5 km: terreno vero (ostacoli artificiali non compresi)
  const top5=(lat,lon)=>{ let m=-1e9, ok=0; const cosl=Math.cos(lat*Math.PI/180);
    for(const r of [0,2500,5000]) for(let k=0;k<(r?8:1);k++){ const a=k*Math.PI/4, la=lat+r*Math.cos(a)/110540, lo=lon+r*Math.sin(a)/(111320*cosl);
      const z=demAt(la,lo); if(z===z){ ok++; if(z>m) m=z; } }
    return ok?m/0.3048:NaN; };
  function checks(c,b){
    const prof=R.get(), out=[];
    if(!c||!b||!b.samples||!b.samples.length) return {prof,out};
    if(prof==='vds_basico'){
      const agl=R.vdsMaxAgl(new Date()), tot=b.tot;
      let worst=null, minLim=1e9, nT=0, nS=0;
      for(const s of b.samples){
        if(s.x<1.5 || s.x>tot-1.5) continue;                                 // decollo e atterraggio esclusi
        const h=profileAt(s.x,tot,b.e0,b.e1); let t5=top5(s.lat,s.lon); nS++;
        if(!(t5===t5)) t5=Math.max(b.e0,b.e1); else nT++;
        const lim=t5+agl; if(lim<minLim) minLim=lim;
        if(h>lim+20 && (!worst || h-lim>worst.over)) worst={x:s.x,h,lim,over:h-lim};
      }
      if(worst) out.push({status:'bad',text:`Quota oltre il limite del VDS basico: al km ${worst.x.toFixed(1)} pianifichi ${Math.round(worst.h)} ft, il massimo lì è circa ${Math.round(worst.lim/50)*50} ft AMSL (${agl} ft sull'ostacolo più alto entro 5 km${agl===500?', giorno feriale':', sabato, domenica o festivo'}). Abbassa la crociera a ${Math.max(0,Math.floor(minLim/100)*100)} ft o meno.`});
      else if(nS) out.push({status:'ok',text:`Quota entro il limite del VDS basico: ${agl} ft sull'ostacolo più alto entro 5 km${agl===500?' (giorno feriale)':' (sabato, domenica o festivo)'}.`});
      if(nS && nT<nS/2) out.push({status:'warn',text:'Terreno non ancora scaricato su parte della rotta: il limite di quota lì è calcolato solo sulle quote dei campi. Scaricalo in Impostazioni › Volare senza internet.'});
      // almeno 5 km dagli aeroporti
      const ends=new Set([c.pts&&c.pts[0]&&c.pts[0].id, c.dst&&c.dst.id]); const seen=new Set();
      for(const s of b.samples) for(const f of FIELDS){ if(f.kind!=='aero'||seen.has(f.id)) continue;
        const d=Math.hypot((f.lat-s.lat)*110540,(f.lon-s.lon)*111320*Math.cos(s.lat*Math.PI/180));
        if(d<5000){ seen.add(f.id); out.push({status:ends.has(f.id)?'warn':'bad',text:ends.has(f.id)?`${f.short} è un aeroporto: per il VDS basico decollo e atterraggio richiedono l'autorizzazione ENAC.`:`Passi a ${(d/1000).toFixed(1)} km da ${f.short} ${f.name}: il VDS basico deve stare ad almeno 5 km dagli aeroporti, salvo autorizzazione ENAC.`}); } }
      out.push({status:'warn',text:'Vietato sorvolare centri abitati, assembramenti, aree militari e impianti industriali: controlla la rotta sulla carta.'});
    } else {
      out.push({status:'ok',text:prof==='vfr'?'Aviazione generale VFR: tutte le classi aperte al VFR, con autorizzazione ATC in C e D; classe A vietata. Quote minime SERA: 1000 ft sui centri abitati, 500 ft altrove.':'VDS avanzato: tutto lo spazio aperto al VFR, con radio, transponder ed ELT; autorizzazione ATC in C e D; classe A vietata.'});
    }
    return {prof,out};
  }
  let last={prof:R.get(),out:[]};
  function render(){
    const prof=R.get(), agl=R.vdsMaxAgl(new Date()), day=new Date().toLocaleDateString('it-IT',{weekday:'long'});
    card.innerHTML=`<h2>Tipo di volo</h2>
      <div class="seg" id="profSeg" style="display:flex;gap:6px;flex-wrap:wrap">${Object.entries(R.PROFILES).map(([k,v])=>`<button type="button" class="btn${k===prof?' pri':''}" data-p="${k}">${v.name}</button>`).join('')}</div>
      <div class="sub" style="margin-top:6px">${prof==='vds_basico'?`VDS basico: solo fuori dagli spazi controllati (classi A–E) e dalle ATZ, ad almeno 5 km dagli aeroporti, fino a <b>${agl} ft</b> sull'ostacolo più alto entro 5 km (oggi è ${day}${agl===500?': 500 ft; 1000 ft sabato, domenica e festivi':': 1000 ft'}).`:(prof==='vds_avanzato'?'VDS avanzato: tutto lo spazio aperto al volo a vista, con radio, transponder ed ELT.':'Aviazione generale VFR: classi C e D con autorizzazione ATC, E libera, A vietata.')} Fonte: ${R.SOURCE}. Salvo autorizzazioni ENAC; valgono l'AIP in vigore e i NOTAM.</div>
      <div id="profList" style="margin-top:8px">${last.out.map(o=>`<div class="it"><span class="v ${o.status}">${esc(o.text)}</span></div>`).join('')}</div>`;
    card.querySelectorAll('[data-p]').forEach(bt=>bt.onclick=()=>{ R.set(bt.dataset.p); update(); });
  }
  const rb=runBriefing; runBriefing=function(c){ const b=rb(c); try{ last=checks(c,b); b.prof=last; }catch(e){ console.error(e); } return b; };
  const rr=renderBriefing; renderBriefing=function(c){ rr(c); try{ render();
      const nB=last.out.filter(o=>o.status==='bad').length, nW=last.out.filter(o=>o.status==='warn').length, nm=R.PROFILES[R.get()].name;
      const pill=nB?`<span class="pill bad">${nm}: ${nB} da risolvere</span>`:`<span class="pill ok">${nm}: rotta compatibile</span>`;
      $('bSummary').insertAdjacentHTML('afterbegin',pill); }catch(e){ console.error(e); } };
  render();
  // il tipo di volo cambiato dallo strumento (Impostazioni) aggiorna il briefing
  addEventListener('storage',e=>{ if(e.key===R.KEY) update(); });
  window.IA517_profChanged=()=>update();
})();


// ---------------- piano: scegliere i campi scrivendo il nome o la sigla (partenza, tappe, arrivo, alternato) ----------------
(function(){
  const norm=x=>String(x||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  const style=document.createElement('style');
  style.textContent=`.fsrch{margin:-2px 0 8px}.fsrch input{width:100%;box-sizing:border-box;min-height:42px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--ink);font:inherit;padding:0 10px}
    .fsrch .res{display:flex;flex-direction:column;gap:4px;margin-top:4px}.fsrch .res button{text-align:left;min-height:40px;border-radius:9px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font:inherit;padding:4px 10px}
    .fsrch .res button b{margin-right:6px}.fsrch .res .none{font-size:.85em;color:var(--dim,#8a96a2);padding:2px 4px}`;
  document.head.appendChild(style);
  function attach(sel,label){
    if(!sel || sel.dataset.srch) return; sel.dataset.srch='1';
    const host=sel.closest('.rp')||sel, box=document.createElement('div'); box.className='fsrch';
    box.innerHTML=`<input type="search" enterkeyhint="search" autocomplete="off" autocapitalize="characters" placeholder="${label}: scrivi il nome o la sigla"><div class="res"></div>`;
    host.after(box);
    const inp=box.querySelector('input'), res=box.querySelector('.res');
    const pick=id=>{ sel.value=id; sel.dispatchEvent(new Event('change',{bubbles:true})); inp.value=''; res.innerHTML=''; };
    const find=()=>{ const q=norm(inp.value).trim(); if(!q){ res.innerHTML=''; return []; }
      const ws=q.split(/\s+/), opts=[...sel.options].filter(o=>o.value && ws.every(w=>norm(o.textContent+' '+o.value).includes(w))).slice(0,8);
      res.innerHTML=opts.length?opts.map(o=>{ const [a,...b]=o.textContent.split(' · '); return `<button type="button" data-id="${esc(o.value)}"><b>${esc(a)}</b>${esc(b.join(' · '))}</button>`; }).join(''):'<div class="none">Nessun campo con questo nome: aggiungilo in Campi › Nuovo campo o pista.</div>';
      res.querySelectorAll('button').forEach(bt=>bt.onclick=()=>pick(bt.dataset.id)); return opts; };
    inp.addEventListener('input',find);
    inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); const o=find(); if(o.length) pick(o[0].value); } });
  }
  const tags={from:'Partenza',dest:'Arrivo',alt:'Alternato'};
  const deco=()=>{ document.querySelectorAll('#route select[data-k]').forEach(s=>attach(s,tags[s.dataset.k]||('Tappa '+(+String(s.dataset.k).slice(2)+1)))); };
  const rr=renderRoute; renderRoute=function(){ rr(); deco(); };
  deco();
  const cp=$('nfCopy'); if(cp){ const fb=$('nfFrom'); if(fb) fb.addEventListener('click',()=>setTimeout(()=>attach(cp,'Campo da copiare'),0)); }
})();


// ---------------- velivolo attivo (Impostazioni › Velivoli dello strumento) ----------------
const AC_FALLBACK={id:'',reg:'',vcruise:110,burn:14,res:30,taxi:1.5,fuelCap:73,fuelUnus:1,fuelType:'mogas',vne:145,empty:280,mtow:450,seats:'2',bagMax:10,xwind:20,todist:250,ldist:250};
function ACP(){ let a=null; try{ a=parent&&parent.IA517_AC?parent.IA517_AC():null; }catch(e){} return Object.assign({},AC_FALLBACK,a||{}); }
const acN=(a,k)=>{ const v=a[k]; return v===''||v==null||isNaN(+v)?null:+v; };
window.IA517_aircraft=function(a){
  a=Object.assign({},AC_FALLBACK,a||{});
  if(PLAN.acId!==a.id){                                          // velivolo cambiato: valori del piano dal suo profilo
    PLAN.acId=a.id; PLAN.tas=acN(a,'vcruise')||PLAN.tas; PLAN.burn=acN(a,'burn')||PLAN.burn; PLAN.res=acN(a,'res')??PLAN.res; PLAN.taxi=acN(a,'taxi')??PLAN.taxi;
    const usable=(acN(a,'fuelCap')||73)-(acN(a,'fuelUnus')||0); if(PLAN.fuel>usable) PLAN.fuel=usable;
    for(const [id,k] of Object.entries(numIn)) $(id).value=PLAN[k]; }
  $('pFuel').max=acN(a,'fuelCap')||73; $('pTas').max=acN(a,'vne')||145;
  try{ update(); }catch(e){}
};
// carico e centraggio
(()=>{ const sec=document.createElement('section'); sec.className='card'; sec.id='wbCard';
  sec.innerHTML=`<h2>Carico e centraggio <span class="sub" id="wbAc"></span></h2>
    <div class="grid2">
      <div class="fld"><label for="wbPil">Pilota (kg)</label><input id="wbPil" type="number" inputmode="decimal" step="1" min="0" max="200"></div>
      <div class="fld"><label for="wbPax">Passeggero (kg)</label><input id="wbPax" type="number" inputmode="decimal" step="1" min="0" max="200"></div>
      <div class="fld"><label for="wbBag">Bagaglio (kg)</label><input id="wbBag" type="number" inputmode="decimal" step="0.5" min="0" max="200"></div>
    </div><div id="wbOut" class="fuel"></div>`;
  $('fuel').closest('section').after(sec);
  PLAN.wb=PLAN.wb||{pil:80,pax:0,bag:0};
  [['wbPil','pil'],['wbPax','pax'],['wbBag','bag']].forEach(([id,k])=>{ $(id).value=PLAN.wb[k]; $(id).addEventListener('input',()=>{ PLAN.wb[k]=parseFloat($(id).value)||0; store.set('ia517_plan',PLAN); renderWB(); }); });
})();
function renderWB(){
  const a=ACP(), n=k=>acN(a,k), dens={mogas:0.74,avgas:0.72,ul91:0.72}[a.fuelType]||0.72, wb=PLAN.wb||{pil:0,pax:0,bag:0};
  let c=null; try{ c=compute(); }catch(e){}
  const fuelTo=Math.max(0,PLAN.fuel-(PLAN.taxi||0)), fuelLd=Math.max(0,fuelTo-(c?c.trip:0));
  const items=[['Vuoto',n('empty')||0,n('emptyArm')],['Pilota',wb.pil||0,n('pilotArm')],['Passeggero',wb.pax||0,n('paxArm')],['Bagaglio',wb.bag||0,n('bagArm')]];
  const calc=fuelL=>{ const it=items.concat([['Carburante',fuelL*dens,n('fuelArm')]]), W=it.reduce((s,x)=>s+x[1],0), arms=it.every(x=>x[1]===0||x[2]!=null);
    return {W,cg:arms&&W?it.reduce((s,x)=>s+x[1]*(x[2]||0),0)/W:null}; };
  const to=calc(fuelTo), ld=calc(fuelLd), mt=n('mtow'), fw=n('cgFwd'), af=n('cgAft'), bm=n('bagMax');
  const cgOk=cg=>cg==null||fw==null||af==null?null:(cg>=fw&&cg<=af);
  const pill=(ok,t)=>`<span class="pill ${ok?'ok':'bad'}">${t}</span>`;
  const rows=[];
  rows.push(`<div class="row"><span>Peso al decollo</span><span><b>${to.W.toFixed(0)} kg</b>${mt?' / MTOW '+mt+' kg':''}</span></div>`);
  rows.push(`<div class="row"><span>Peso all'atterraggio (carburante ${fuelLd.toFixed(0)} L)</span><span>${ld.W.toFixed(0)} kg</span></div>`);
  if(to.cg!=null) rows.push(`<div class="row"><span>Baricentro al decollo / all'atterraggio</span><span>${to.cg.toFixed(3)} / ${ld.cg.toFixed(3)} m${fw!=null&&af!=null?` (limiti ${fw}–${af})`:''}</span></div>`);
  const pills=[]; if(mt) pills.push(pill(to.W<=mt,to.W<=mt?`Peso entro il massimo (margine ${(mt-to.W).toFixed(0)} kg)`:`Oltre il MTOW di ${(to.W-mt).toFixed(0)} kg: scarica carburante o bagaglio`));
  if(bm!=null && (wb.bag||0)>bm) pills.push(pill(false,`Bagaglio oltre il massimo (${bm} kg)`));
  if((wb.pax||0)>0 && String(a.seats)==='1') pills.push(pill(false,'Il velivolo ha un posto solo'));
  const k1=cgOk(to.cg), k2=cgOk(ld.cg); if(k1!=null) pills.push(pill(k1&&k2,k1&&k2?'Baricentro entro i limiti, al decollo e all\'atterraggio':'Baricentro FUORI dai limiti: sposta il carico'));
  else pills.push('<span class="sub">Per il controllo del baricentro inserisci i bracci e i limiti nel profilo del velivolo (Impostazioni › Velivoli).</span>');
  // piste di partenza e arrivo contro le distanze del manuale (a peso massimo, +15% di margine)
  const rw=(id,need,what)=>{ const f=byId(id); if(!f||!f.rw||!f.rw.length||!need) return; const L=Math.max(...f.rw.map(r=>r.L||0)); if(!L) return;
    pills.push(pill(L>=need*1.15,`${what} ${f.short}: pista ${L} m, il manuale chiede ${need} m${L<need*1.15?' (+15%: troppo corta)':''}`)); };
  rw(PLAN.from,n('todist'),'Decollo da'); rw(PLAN.dest,n('ldist'),'Atterraggio a');
  $('wbAc').textContent=a.reg?'· '+a.reg+(a.model?' '+a.model:''):'';
  $('wbOut').innerHTML=rows.join('')+'<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">'+pills.join('')+'</div>';
}
{ const _u=update; update=function(){ _u(); try{ renderWB(); }catch(e){} }; }
// arrivo: vento al traverso oltre il massimo dimostrato del velivolo
{ const _ah=arrivalHTML; arrivalHTML=function(f,wind,src){ let h=_ah(f,wind,src); try{ const a=ACP(), xm=acN(a,'xwind'), p=f&&pickRunway(f,wind);
    if(p&&p.xw!=null&&xm&&p.xw>xm) h+=`<div class="alertline">Vento al traverso ${p.xw.toFixed(0)} km/h: oltre il massimo dimostrato del ${esc(a.reg||'velivolo')} (${xm} km/h)</div>`; }catch(e){}
  return h; }; }
setTimeout(()=>window.IA517_aircraft(ACP()),0);

setInterval(()=>{ try{ const a=document.activeElement; if(!document.hidden && !(a&&a.closest&&a.closest("#metars,#metarOff,input,textarea,select"))) renderWx(); }catch(e){} },60000);

// ---- alternati con carburante lungo la rotta, in tre fasce di criticità (modulo carburante.js) ----
(()=>{ const FU=window.IA517_FUEL; if(!FU) return;
  const sec=document.createElement('section'); sec.className='card'; sec.id='fuelAltCard';
  sec.innerHTML=`<h2>⛽ Alternati con carburante <span class="sub" id="fuAltSub"></span></h2><div id="fuAlt"></div>`;
  $('fuel').closest('section').after(sec);
})();
function renderFuelAlt(){
  const FU=window.IA517_FUEL, box=$('fuAlt'); if(!FU||!box) return;
  const c=compute(), a=ACP();
  box.innerHTML=FU.planHtml(FIELDS,{pts:c.pts,fuel:PLAN.fuel,taxi:PLAN.taxi||0,burn:PLAN.burn,tas:PLAN.tas,res:PLAN.res,ac:a.fuelType||'mogas',corridor:40});
  $('fuAltSub').textContent=a.reg?'· '+a.reg+' · '+(FU.LBL[a.fuelType]||a.fuelType):'';
  FU.wire(box,FIELDS,{
    onChange:()=>{ renderFuelAlt(); try{ parent.PH&&parent.PH.fuelRender&&parent.PH.fuelRender(); }catch(e){} },
    onRow:(fid,row,act)=>{ const f=byId(fid), leg=+row.dataset.leg, inRoute=[PLAN.from,...PLAN.wps,PLAN.dest].includes(fid);
      act.innerHTML=(f&&!inRoute?`<button type="button" class="fu-b pri" data-a="add">Aggiungi come tappa</button>`:'')+`<button type="button" class="fu-b" data-a="mark">Correggi il carburante</button>`;
      act.querySelector('[data-a=add]')&&(act.querySelector('[data-a=add]').onclick=()=>{ PLAN.wps.splice(Math.max(0,Math.min(PLAN.wps.length,leg)),0,fid); renderRoute(); update(); store.set('ia517_plan',PLAN);
        $('fuelAltCard').scrollIntoView({block:'start'}); });
      act.querySelector('[data-a=mark]').onclick=()=>{ const q=box.querySelector('.fu-q'); q.value=f?`${f.name} · ${f.short}`:''; q.dispatchEvent(new Event('change')); q.scrollIntoView({block:'center'}); };
    }});
}
{ const _u=update; update=function(){ _u(); try{ renderFuelAlt(); }catch(e){ console.error(e); } }; }
