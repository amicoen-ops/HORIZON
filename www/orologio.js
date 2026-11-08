// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// OROLOGIO GARMIN (solo HORIZON 2, che ha il modulo nativo «Garmin»; nelle altre versioni questo file non fa niente).
// L'app «HORIZON Link» sull'orologio (cartella garmin/) manda una volta al secondo: posizione GPS (multibanda sul fenix),
// velocità e traccia, pressione e quota del barometro, prua della bussola, battito, batteria.
// · GPS: fonte di posizione in più. «Automatica» lo usa quando la sua qualità è buona (prima del telefono; il GLO 2
//   resta prima se c'è); «Orologio» solo quello (se tace, bandierine rosse); «Mai».
// · Quota dal barometro: quando la posizione viene dall'orologio, la quota è quella della pressione con il QNH dello
//   strumento (come l'altimetro di bordo); taratura sul campo come per il GPS.
// · Bussola: solo con l'orologio fermo (sul cruscotto o sul supporto): al polso si muove con il braccio. Spenta di partenza.
// · Tasti dell'orologio: START = OK, SU / GIÙ = ruota, SU tenuto = cambia pagina.
// · Allo strumento: velocità, quota, vario e destinazione sull'orologio; gli avvisi (terreno, spazi, traffico) lo fanno vibrare.
(function(){
'use strict';
const C=window.Capacitor;
if(!C || !C.isPluginAvailable || !C.isPluginAvailable('Garmin')) return;
const G=C.Plugins.Garmin;
const esc=x=>String(x??'').replace(/[<&>"]/g,c=>({'<':'&lt;','&':'&amp;','>':'&gt;','"':'&quot;'}[c]));
const KEY='ia517p_fenix';
PH.fenixCfg=Object.assign({gps:'auto',baro:true,bussola:false,avvisi:true},lsGet(KEY,{}));
const salva=()=>lsSet(KEY,PH.fenixCfg);
PH.fenix={stato:{},d:null,t:0,n:0};
const QM={4:5,3:15,2:40,1:100};                        // qualità Garmin → precisione indicativa in metri
const fresco=()=>PH.fenix.d && Date.now()-PH.fenix.t<2500 && PH.fenix.d.la!=null;
// l'orologio è la fonte di posizione?
PH.useFenix=function(){ const c=PH.fenixCfg.gps;
  if(c==='no') return false;
  if(c==='si') return true;
  const g=PH.glo&&PH.glo.fix; if(g && Date.now()-g.recv<2500) return false;   // automatica: il GLO 2 resta prima
  return fresco() && (PH.fenix.d.q||0)>=4; };
// quota dalla pressione con il QNH dello strumento (atmosfera standard)
const baroMsl=p=>p>30000?44330.77*(1-Math.pow(p/(QNH*100),0.190263)):null;
{ const prev=PH.onPos; PH.onPos=function(p){ if(PH.useFenix()){ try{ const c=p.coords; PH.phoneFix={src:'phone',lat:c.latitude,lon:c.longitude,acc:c.accuracy,t:p.timestamp||Date.now(),recv:Date.now()}; }catch(e){} return; } return prev.apply(this,arguments); }; }
{ const prev=PH.useGlo; PH.useGlo=function(){ if(PH.fenixCfg.gps==='si') return false; return prev.apply(this,arguments); }; }
// bussola dell'orologio: stessa strada di quella del telefono (deviazione, declinazione, filtro)
const bussolaOn=()=>PH.fenixCfg.bussola && PH.fenix.d && PH.fenix.d.mh!=null && Date.now()-PH.fenix.t<2500;
{ const prev=PH.magFromR; PH.magFromR=function(){ if(bussolaOn()) return; return prev.apply(this,arguments); }; }
function bussola(hm){
  hm=wrap360(hm); PH.mag.mRaw=hm;
  const h=wrap360(hm+(+PH.magDev||0)+(+PH.decl||0));
  const now=performance.now(), dt=PH.mag.t?Math.min(1,(now-PH.mag.t)/1000):1, tau=Math.max(0,+PH.hdgSmooth||0)*0.25, kf=tau>0?1-Math.exp(-dt/tau):1;
  PH.mag.raw=PH.mag.hdg==null?h:wrap360(PH.mag.raw+angDiff(h,PH.mag.raw)*kf);
  PH.mag.hdg=PH.mag.raw; PH.mag.t=now; PH.mag.src='orologio'; PH.mag.acc=3; }
// messaggi dall'orologio
function dati(d){
  if(d.t==='k'){ PH.act&&PH.act('orologio tasto '+d.k);
    try{ if(d.k==='ok') push(); else if(d.k==='l') rotate(-1); else if(d.k==='r') rotate(1); else if(d.k==='pg'){ closeMenu(); togglePage(); toast(PAGE==='pfd'?'ORIZZONTE':'MAPPA'); } }catch(e){}
    return; }
  if(d.t!=='d') return;
  PH.fenix.d=d; PH.fenix.t=Date.now(); PH.fenix.n++;
  if(PH.fenixCfg.bussola && d.mh!=null) bussola(d.mh);
  if(d.la!=null && PH.useFenix()){
    const bm=PH.fenixCfg.baro&&d.p!=null?baroMsl(d.p):null;
    PH.applyFix({src:'fenix',lat:d.la,lon:d.lo,msl:bm!=null?bm:(d.al!=null?d.al:null),speed:d.sp!=null?d.sp:null,heading:d.hd!=null?d.hd:null,
      acc:QM[d.q]||50,t:Date.now(),recv:Date.now()});
    if(typeof LIVE!=='undefined') LIVE.gps=performance.now();
  }
}
G.addListener('dati',d=>{ try{ dati(d||{}); }catch(e){ PH.logErr&&PH.logErr('orologio: '+e); } });
G.addListener('stato',s=>{ PH.fenix.stato=s||{}; });
G.avvia().then(s=>{ PH.fenix.stato=s||{}; }).catch(e=>{ PH.fenix.stato={errore:String(e&&e.message||e)}; });
// allo strumento: dati da mostrare sull'orologio, una volta al secondo
setInterval(()=>{ if(!PH.fenix.stato.collegato) return;
  let dt=''; try{ if(NAV.dest){ const b=distBrg(S,NAV.dest); dt=`${NAV.dest.short.slice(0,10)} ${(b.d/1000).toFixed(1)} km ${String(Math.round(b.brg)).padStart(3,'0')}°`; } }catch(e){}
  G.invia({msg:{t:'s',gs:Math.round(S.gs||0),al:Math.round(S.alt||0),vs:+(S.vs||0).toFixed(1),dt}}).catch(()=>{}); },1000);
// avvisi: quando lo strumento parla, l'orologio vibra e lo scrive
{ const prev=PH.alert; PH.alert=function(key,level,text){ const b=PH.alerts[key]; const r=prev.apply(this,arguments);
    if(PH.alerts[key]!==b && PH.fenixCfg.avvisi && PH.fenix.stato.collegato) G.invia({msg:{t:'a',l:level==='W'?'W':'C',x:String(text).slice(0,40)}}).catch(()=>{});
    return r; }; }
// posizione in uso, nello Stato e nella casella QUOTA
{ const prev=PH.statoHtml; if(prev) PH.statoHtml=function(){ const h=prev.apply(this,arguments); return (PH.fenix.stato.collegato?`<i class="${fresco()?'o':'w'}">⌚</i>`:'')+h; }; }

// ---- impostazioni: «Orologio Garmin» ----
function html(){ const s=PH.fenix.stato, d=PH.fenix.d, ok=fresco(), c=PH.fenixCfg;
  const v=(x,u,f)=>x==null?'—':(f?f(x):Math.round(x))+(u||'');
  const q={4:'buono',3:'usabile',2:'debole',1:'scarso',0:'nessuno'};
  return `<section id="hzFenix"><h3>Orologio Garmin</h3>
    <p class="ph-sub">${s.collegato?`<b style="color:#3ddc84">Collegato: ${esc(s.nome||'orologio')}</b>`:`<b style="color:#ffc531">${s.errore?esc(s.errore):'Non collegato'}</b>`}${d?` · dati ${ok?'adesso':Math.round((Date.now()-PH.fenix.t)/1000)+' s fa'} · ${PH.fenix.n} messaggi`:''}.
    Sull'orologio apri l'app <b>HORIZON Link</b> (dal menu delle app, o col tasto qui sotto). Serve l'app Garmin Connect sul telefono.</p>
    ${d?`<div class="hz-fx"><span>GPS <b>${v(d.q,'',x=>q[x]||x)}</b></span><span>Quota GPS <b>${v(d.al!=null?d.al/FT2M:null,' ft')}</b></span><span>Quota baro <b>${v(d.p!=null&&baroMsl(d.p)!=null?baroMsl(d.p)/FT2M:null,' ft')}</b></span>
      <span>Pressione <b>${v(d.p!=null?d.p/100:null,' hPa',x=>x.toFixed(1))}</b></span><span>Bussola <b>${v(d.mh,'°',x=>String(Math.round(wrap360(x))).padStart(3,'0'))}</b></span><span>Battito <b>${v(d.hr,' bpm')}</b></span><span>Batteria <b>${v(d.bt,'%')}</b></span></div>`:''}
    <div class="ph-btns"><button class="ph-btn" type="button" id="hzFxOpen">Apri l'app sull'orologio</button><button class="ph-btn" type="button" id="hzFxRetry">Ricollega</button></div>
    <p class="ph-sub"><b>Posizione dall'orologio</b></p>
    <div class="ph-seg" id="hzFxGps">${[['auto','Automatica'],['si','Solo orologio'],['no','Mai']].map(([k,l])=>`<button data-g="${k}" aria-pressed="${c.gps===k}">${l}</button>`).join('')}</div>
    <p class="ph-sub">Automatica: l'orologio quando il suo GPS è buono (il GLO 2, se collegato, resta prima; poi il telefono). Ora in uso: <b>${PH.src==='fenix'?'orologio':(PH.src==='glo'?'GLO 2':(PH.src==='phone'?'telefono':'—'))}</b>.</p>
    <label class="ph-chk"><input type="checkbox" id="hzFxBaro" ${c.baro?'checked':''}> Quota dal barometro dell'orologio con il QNH (quando la posizione viene dall'orologio)</label>
    <label class="ph-chk"><input type="checkbox" id="hzFxBus" ${c.bussola?'checked':''}> Prua dalla bussola dell'orologio (solo con l'orologio fermo sul cruscotto, non al polso)</label>
    <label class="ph-chk"><input type="checkbox" id="hzFxAvv" ${c.avvisi?'checked':''}> Avvisi sull'orologio (vibra e scrive)</label>
    <p class="ph-sub">Tasti dell'orologio: START = OK, SU e GIÙ = manopola, SU tenuto = cambia pagina.</p></section>`; }
function wire(sec){
  sec.querySelector('#hzFxOpen').onclick=()=>G.apri().then(()=>toast('APP APERTA SULL\'OROLOGIO')).catch(e=>toast(String(e&&e.message||e).toUpperCase()));
  sec.querySelector('#hzFxRetry').onclick=()=>G.avvia().then(s=>{ PH.fenix.stato=s||{}; ridisegna(); }).catch(()=>{});
  sec.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{ PH.fenixCfg.gps=b.dataset.g; salva(); ridisegna(); });
  sec.querySelector('#hzFxBaro').onchange=e=>{ PH.fenixCfg.baro=e.target.checked; salva(); PH.vario.h=NaN; };
  sec.querySelector('#hzFxBus').onchange=e=>{ PH.fenixCfg.bussola=e.target.checked; salva(); PH.mag.hdg=null; };
  sec.querySelector('#hzFxAvv').onchange=e=>{ PH.fenixCfg.avvisi=e.target.checked; salva(); }; }
function ridisegna(){ const old=document.getElementById('hzFenix'); if(!old) return; const body=old.querySelector('.hz-sb');
  const t=document.createElement('div'); t.innerHTML=html(); const nu=t.firstElementChild;
  if(body){ body.innerHTML=''; [...nu.childNodes].slice(1).forEach(n=>body.appendChild(n)); wire(old); } else { old.replaceWith(nu); wire(nu); } }
{ const orig=PH.renderImp; PH.renderImp=function(){ orig.apply(this,arguments);
    const box=document.getElementById('phImpBody'); if(!box) return;
    const t=document.createElement('div'); t.innerHTML=html(); const sec=t.firstElementChild;
    const pos=[...box.querySelectorAll(':scope > section')].find(s=>/GLO 2/.test(s.dataset.t||s.textContent.slice(0,60)));
    if(pos) pos.after(sec); else box.appendChild(sec);
    // stesse sezioni pieghevoli delle altre impostazioni
    const h=sec.querySelector('h3'); const b=document.createElement('div'); b.className='hz-sb'; while(h.nextSibling) b.appendChild(h.nextSibling); sec.appendChild(b);
    sec.dataset.t='Orologio Garmin'; h.classList.add('hz-sh'); h.onclick=()=>sec.classList.toggle('hz-open'); sec.classList.add('hz-open');
    wire(sec); }; }
setInterval(()=>{ const imp=document.getElementById('phImp'); if(imp&&!imp.hidden&&document.getElementById('hzFenix')) try{ ridisegna(); }catch(e){} },3000);
{ const s=document.createElement('style'); s.textContent=`.hz-fx{display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font:600 14px system-ui,sans-serif;color:#cfd8e0;margin:6px 0}`; document.head.appendChild(s); }
})();
