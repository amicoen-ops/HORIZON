// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// OROLOGIO GARMIN (solo HORIZON 2, che ha il modulo nativo «Garmin»; nelle altre versioni questo file non fa niente).
// L'app «HORIZON Link» sull'orologio (cartella garmin/) manda una volta al secondo: posizione GPS (multibanda sul fenix),
// velocità e traccia, pressione e quota del barometro, prua della bussola, battito, saturazione (SpO2), batteria.
// · GPS: fonte di posizione in più (Impostazioni › Posizione): con «La più precisa» si usa quando la sua precisione è la
//   migliore tra telefono, GLO 2 e orologio; oppure «Solo orologio». La precisione dell'orologio è stimata dalla qualità
//   del fix che dà Garmin (buona ≈ 4 m, usabile ≈ 10 m, debole ≈ 25 m).
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
PH.fenixCfg=Object.assign({baro:true,bussola:false,avvisi:true},lsGet(KEY,{}));
const salva=()=>lsSet(KEY,PH.fenixCfg);
PH.fenix={stato:{},d:null,t:0,n:0};
const QM={4:4,3:10,2:25,1:60};                         // qualità Garmin → precisione stimata in metri
const fresco=()=>PH.fenix.d && Date.now()-PH.fenix.t<2500 && PH.fenix.d.la!=null;
// quota dalla pressione con il QNH dello strumento (atmosfera standard)
const baroMsl=p=>p>30000?44330.77*(1-Math.pow(p/(QNH*100),0.190263)):null;
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
  if(d.la!=null && (d.q||0)>=2){
    const bm=PH.fenixCfg.baro&&d.p!=null?baroMsl(d.p):null;
    PH.fixIn({src:'fenix',lat:d.la,lon:d.lo,msl:bm!=null?bm:(d.al!=null?d.al:null),speed:d.sp!=null?d.sp:null,heading:d.hd!=null?d.hd:null,
      acc:QM[d.q]||60,t:Date.now(),recv:Date.now()});
  }
}
G.addListener('dati',d=>{ try{ dati(d||{}); }catch(e){ PH.logErr&&PH.logErr('orologio: '+e); } });
G.addListener('stato',s=>{ PH.fenix.stato=s||{}; });
G.avvia().then(s=>{ PH.fenix.stato=s||{}; }).catch(e=>{ PH.fenix.stato={errore:String(e&&e.message||e)}; });
// allo strumento: dati da mostrare sull'orologio, una volta al secondo
setInterval(()=>{ if(!PH.fenix.stato.collegato) return;
  let dt=''; try{ if(NAV.dest){ const b=distBrg(S,NAV.dest); dt=`${NAV.dest.short.slice(0,10)} ${(b.d/1000).toFixed(1)} km ${String(Math.round(b.brg)).padStart(3,'0')}°`; } }catch(e){}
  G.invia({msg:{t:'s',gs:Math.round(S.gs||0),al:Math.round(S.alt||0),vs:+(S.vs||0).toFixed(1),dt}}).catch(()=>{}); },2000);   // ogni 2 s: il collegamento passa da Garmin Connect, non va intasato
// avvisi: quando lo strumento parla, l'orologio vibra e lo scrive
{ const prev=PH.alert; PH.alert=function(key,level,text){ const b=PH.alerts[key]; const r=prev.apply(this,arguments);
    if(PH.alerts[key]!==b && PH.fenixCfg.avvisi && PH.fenix.stato.collegato) G.invia({msg:{t:'a',l:level==='W'?'W':'C',x:String(text).slice(0,40)}}).catch(()=>{});
    return r; }; }
// Impostazioni › Stato (e dati tecnici delle segnalazioni): i sensori dell'orologio accanto a quelli del telefono
{ const prev=PH.status; if(prev) PH.status=function(){ const r=prev.apply(this,arguments); try{
    const s=PH.fenix.stato||{}, d=PH.fenix.d, ok=d&&Date.now()-PH.fenix.t<5000, q={4:'buona',3:'usabile',2:'debole',1:'scarsa',0:'nessuna'};
    const rows=[[s.collegato?(ok?'ok':'warn'):'bad','Orologio Garmin',s.collegato?`${s.nome||'collegato'} · ${ok?'dati adesso':'dati di '+Math.round((Date.now()-PH.fenix.t)/1000)+' s fa'} · ${PH.fenix.n} messaggi${d&&d.bt!=null?' · batteria '+d.bt+'%':''}${d&&d.mu!=null?' · memoria '+Math.round(d.mu/1024)+'/'+Math.round(d.mt/1024)+' KB':''}`:(s.errore||'non collegato')]];
    if(d){ rows.push([ok&&d.q>=3?'ok':'warn','Orologio: GPS',d.la!=null?`qualità ${q[d.q]||d.q} (≈ ±${({4:4,3:10,2:25,1:60})[d.q]||'?'} m) · ${d.sp!=null?Math.round(d.sp*3.6)+' km/h':''}${d.al!=null?' · quota '+Math.round(d.al/FT2M)+' ft':''}`:'nessun fix'],
        [d.p!=null?'ok':'warn','Orologio: barometro',d.p!=null?`${(d.p/100).toFixed(1)} hPa · quota con QNH ${QNH}: ${Math.round(44330.77*(1-Math.pow(d.p/(QNH*100),0.190263))/FT2M)} ft${d.ps!=null?' · QNH dall\'orologio '+Math.round(d.ps/100):''}`:'nessun dato'],
        [d.mh!=null?'ok':'warn','Orologio: bussola',d.mh!=null?`${String(Math.round(wrap360(d.mh))).padStart(3,'0')}° magnetica${PH.fenixCfg.bussola?' · in uso':' · non usata (solo con l\'orologio fermo)'}`:'nessun dato'],
        [d.hr!=null?'ok':'warn','Orologio: pilota',`battito ${d.hr!=null?Math.round(d.hr)+' bpm':'—'} · SpO₂ ${d.ox!=null?Math.round(d.ox)+'%'+(d.oxa>120?' ('+Math.round(d.oxa/60)+' min fa)':''):'—'}`]);
      if(d.pv&&!/^(chiusa normalmente|pronta)$/.test(d.pv)) rows.push(['warn','Orologio: ultima chiusura',d.pv+(d.pm?' · memoria '+d.pm:'')]); }
    r.rows.push(...rows); }catch(e){} return r; }; }
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
      <span>Pressione <b>${v(d.p!=null?d.p/100:null,' hPa',x=>x.toFixed(1))}</b></span><span>QNH dall'orologio <b>${v(d.ps!=null?d.ps/100:null,' hPa',x=>x.toFixed(0))}</b></span><span>Memoria <b>${d.mu!=null?Math.round(d.mu/1024)+'/'+Math.round(d.mt/1024)+' KB':'—'}</b></span><span>Bussola <b>${v(d.mh,'°',x=>String(Math.round(wrap360(x))).padStart(3,'0'))}</b></span><span>Battito <b>${v(d.hr,' bpm')}</b></span><span>SpO₂ <b>${v(d.ox,'%')}</b>${d.ox!=null&&d.oxa>120?' ('+Math.round(d.oxa/60)+' min fa)':''}</span><span>Batteria <b>${v(d.bt,'%')}</b></span></div>`:''}
    ${d&&d.pv&&!/^(chiusa normalmente|pronta)$/.test(d.pv)?`<p class="ph-sub" style="color:#ffc531">Ultima chiusura dell'app sull'orologio durante: <b>${esc(d.pv)}</b>${d.pm?' · memoria '+esc(d.pm):''}. Se si è chiusa da sola, mandami questa riga.</p>`:''}
    <div class="ph-btns"><button class="ph-btn" type="button" id="hzFxOpen">Apri l'app sull'orologio</button><button class="ph-btn" type="button" id="hzFxRetry">Ricollega</button></div>
    <p class="ph-sub"><b>Posizione</b>: la scelta tra telefono, GLO 2 e orologio è in «Posizione» (la più precisa, oppure una sola). Ora in uso: <b>${esc(PH.SRC_NOME[PH.src]||'—')}</b>.</p>
    ${PH.guidaTasti?PH.guidaTasti():''}
    <label class="ph-chk"><input type="checkbox" id="hzFxBaro" ${c.baro?'checked':''}> Quota dal barometro dell'orologio con il QNH (quando la posizione viene dall'orologio)</label>
    <label class="ph-chk"><input type="checkbox" id="hzFxBus" ${c.bussola?'checked':''}> Prua dalla bussola dell'orologio (solo con l'orologio fermo sul cruscotto, non al polso)</label>
    <label class="ph-chk"><input type="checkbox" id="hzFxAvv" ${c.avvisi?'checked':''}> Avvisi sull'orologio (vibra e scrive)</label>
    </section>`; }
function wire(sec){
  sec.querySelector('#hzFxOpen').onclick=()=>G.apri().then(()=>toast('APP APERTA SULL\'OROLOGIO')).catch(e=>toast(String(e&&e.message||e).toUpperCase()));
  sec.querySelector('#hzFxRetry').onclick=()=>G.avvia().then(s=>{ PH.fenix.stato=s||{}; ridisegna(); }).catch(()=>{});
  sec.querySelector('#hzFxBaro').onchange=e=>{ PH.fenixCfg.baro=e.target.checked; salva(); PH.vario.h=NaN; };
  sec.querySelector('#hzFxBus').onchange=e=>{ PH.fenixCfg.bussola=e.target.checked; salva(); PH.mag.hdg=null; };
  sec.querySelector('#hzFxAvv').onchange=e=>{ PH.fenixCfg.avvisi=e.target.checked; salva(); }; }
function ridisegna(){ const old=document.getElementById('hzFenix'); if(!old) return; const body=old.querySelector('.hz-sb');
  const t=document.createElement('div'); t.innerHTML=html(); const nu=t.firstElementChild;
  if(body){ body.innerHTML=''; [...nu.childNodes].slice(1).forEach(n=>body.appendChild(n)); wire(old); } else { old.replaceWith(nu); wire(nu); } }
{ const orig=PH.renderImp; PH.renderImp=function(){ orig.apply(this,arguments);
    const box=document.getElementById('phImpBody'); if(!box) return;
    const t=document.createElement('div'); t.innerHTML=html(); const sec=t.firstElementChild;
    const pos=[...box.querySelectorAll(':scope > section')].find(s=>/^Posizione/.test(s.dataset.t||s.textContent.trim().slice(0,30)));
    if(pos) pos.after(sec); else box.appendChild(sec);
    // stesse sezioni pieghevoli delle altre impostazioni
    const h=sec.querySelector('h3'); const b=document.createElement('div'); b.className='hz-sb'; while(h.nextSibling) b.appendChild(h.nextSibling); sec.appendChild(b);
    sec.dataset.t='Orologio Garmin'; h.classList.add('hz-sh'); h.onclick=()=>sec.classList.toggle('hz-open'); sec.classList.add('hz-open');
    wire(sec); }; }
setInterval(()=>{ const imp=document.getElementById('phImp'); if(imp&&!imp.hidden&&document.getElementById('hzFenix')) try{ ridisegna(); }catch(e){} },3000);
{ const s=document.createElement('style'); s.textContent=`.hz-fx{display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font:600 14px system-ui,sans-serif;color:#cfd8e0;margin:6px 0}`; document.head.appendChild(s); }
})();
