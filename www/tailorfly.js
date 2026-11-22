// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// TAILORFLY (prima parte). Una prova di 20 secondi, a terra e con il telefono fermo sul suo supporto, che misura quello che
// QUESTO dispositivo sa fare davvero e dice in chiaro com'è messo: sensori di movimento, bussola, barometro, GPS, velocità
// del disegno, schermo. Poi propone poche regolazioni e le applica solo se il pilota tocca «Applica».
// In questa prima parte si regolano solo cose che NON toccano il calcolo dell'assetto:
//   · qualità del terreno 3D (se il disegno è lento);
//   · quota e vario dal barometro (se c'è ed era spento);
//   · bussola (se manca o è disturbata: prua dalla traccia GPS).
// I filtri dell'orizzonte restano quelli di sempre: adattarli alla qualità dei sensori è la seconda parte, dopo un volo di prova.
// Niente esce dal telefono. Il risultato resta in memoria (ia517p_tailor) con i valori di prima, per poter tornare indietro.
// Mai in volo: la prova chiede il telefono fermo, e in volo non si fanno domande.
(function(){
'use strict';
if(typeof PH==='undefined'||!PH) return;
const KEY='ia517p_tailor', DUR=20000;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const media=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:NaN;
const scarto=a=>{ if(a.length<2) return NaN; const m=media(a); return Math.sqrt(a.reduce((s,v)=>s+(v-m)*(v-m),0)/(a.length-1)); };
const mediana=a=>{ if(!a.length) return NaN; const b=a.slice().sort((x,y)=>x-y); return b[b.length>>1]; };
// scarto di una serie di angoli in gradi (la bussola passa da 359 a 0)
const scartoAng=a=>{ if(a.length<2) return NaN; const r=Math.PI/180; let sx=0, sy=0; for(const v of a){ sx+=Math.cos(v*r); sy+=Math.sin(v*r); } const R=Math.hypot(sx,sy)/a.length; return R>=1?0:Math.sqrt(-2*Math.log(Math.max(1e-9,R)))/r; };
const inVolo=()=>{ try{ return !!(PH.flight||(PH.inVolo&&PH.inVolo())||(typeof PH_air==='function'&&PH_air())); }catch(e){ return false; } };

// ---- il giudizio: funzione pura (dalle misure alle righe e alle regolazioni), così si prova da sola ----
// m = {durata, eventi, giro:{n,medie:[3],scarti:[3]}, acc:{n,scarto}, bussola:{n,scarto,acc}, baro:{nativo,n,scarto}, gps:{n,acc,sat},
//      disegno:{mediana}, schermo:{w,h,dpr}, ora:{terrQ,baro,compass}}
function giudica(m){
  const R=[], P=[], hz=m.durata>0?m.eventi*1000/m.durata:0;
  // il telefono si è mosso? allora le misure non valgono
  const mosso=(m.giro.n>20&&Math.max(...m.giro.scarti)>1.5)||(m.acc.n>20&&m.acc.scarto>0.6);
  if(mosso) return {mosso:true,righe:[['bad','Prova da rifare','Il telefono si è mosso durante la misura. Appoggialo fermo sul supporto, a motore spento, e riprova.']],proposte:[],voto:null};
  // sensori di movimento
  if(m.eventi<20) R.push(['bad','Sensori di movimento','Non arrivano dati: senza, l\'orizzonte non funziona. Controlla il permesso dei sensori nel browser o nel telefono.']);
  else if(hz<20) R.push(['warn','Sensori di movimento',`Solo ${hz.toFixed(0)} letture al secondo: l'orizzonte sarà poco fluido.`]);
  else R.push(['ok','Sensori di movimento',`${hz.toFixed(0)} letture al secondo: bene.`]);
  // giroscopio: deriva a fermo (°/min) e rumore
  let der=NaN;
  if(m.giro.n<20) R.push(['bad','Giroscopio','Assente. L\'orizzonte in virata segue solo il GPS: su questo dispositivo non è affidabile come strumento.']);
  else { der=Math.hypot(...m.giro.medie)*60; const rum=Math.max(...m.giro.scarti);
    const v=der<6&&rum<0.15?'ok':(der<30&&rum<0.5?'warn':'bad');
    R.push([v,'Giroscopio',`Deriva a fermo ${der.toFixed(1)}° al minuto, rumore ${rum.toFixed(2)}°/s: ${v==='ok'?'buono':(v==='warn'?'discreto, l\'app lo corregge con accelerometro e GPS':'scarso, l\'orizzonte può scivolare nelle virate lunghe')}.`]); }
  // accelerometro
  if(m.acc.n<20) R.push(['bad','Accelerometro','Assente.']);
  else R.push([m.acc.scarto<0.08?'ok':'warn','Accelerometro',`Rumore ${m.acc.scarto.toFixed(3)} m/s²: ${m.acc.scarto<0.08?'buono':'un po\' alto (vibrazioni del supporto?)'}.`]);
  // bussola
  const bMal=m.bussola.n<5, bDist=!bMal&&(m.bussola.scarto>8||(m.bussola.acc!=null&&m.bussola.acc<2));
  if(bMal) R.push(['warn','Bussola','Assente o senza dati: la prua viene dalla traccia GPS, che a terra da fermi non c\'è.']);
  else if(bDist) R.push(['warn','Bussola',`Disturbata: da fermo oscilla di ${m.bussola.scarto.toFixed(0)}°${m.bussola.acc!=null&&m.bussola.acc<2?' e chiede la calibrazione (muovi il telefono a otto)':''}. Vicino a ferro, cavi o altoparlanti succede.`]);
  else R.push(['ok','Bussola',`Stabile (oscilla di ${m.bussola.scarto.toFixed(1)}° da fermo).`]);
  // barometro
  if(!m.baro.nativo) R.push(['warn','Barometro','Nella versione web non si può leggere: quota e vario vengono dal GPS, con qualche secondo di ritardo.']);
  else if(m.baro.n<5) R.push(['warn','Barometro','Questo dispositivo non ce l\'ha (o non risponde): quota e vario vengono dal GPS, con qualche secondo di ritardo.']);
  else R.push(['ok','Barometro',`Presente, rumore ${(m.baro.scarto*8.3).toFixed(1)} m: quota e vario pronti.`]);
  // GPS
  if(m.gps.n<2||!(m.gps.acc>0)) R.push(['warn','GPS','Nessuna posizione durante la prova. All\'aperto serve qualche secondo: rifai la prova fuori dall\'hangar.']);
  else R.push([m.gps.acc<=8?'ok':(m.gps.acc<=25?'warn':'bad'),'GPS',`Precisione ±${m.gps.acc<10?m.gps.acc.toFixed(1):Math.round(m.gps.acc)} m${m.gps.sat?`, ${m.gps.sat} satelliti`:''}, ${(m.gps.n*1000/m.durata).toFixed(1)} posizioni al secondo: ${m.gps.acc<=8?'buono':(m.gps.acc<=25?'discreto':'scarso, forse sei al chiuso')}.`]);
  // disegno
  const lento=m.disegno.mediana>30;
  if(!(m.disegno.mediana>0)) R.push(['warn','Velocità del disegno','Non misurata.']);
  else R.push([m.disegno.mediana<=20?'ok':(lento?'bad':'warn'),'Velocità del disegno',`${Math.round(1000/m.disegno.mediana)} immagini al secondo: ${m.disegno.mediana<=20?'fluido':(lento?'lento':'accettabile')}.`]);
  // schermo
  const corto=Math.min(m.schermo.w,m.schermo.h), tablet=corto>=700;
  R.push(['ok','Schermo',`${m.schermo.w}×${m.schermo.h} punti${tablet?', tablet: orizzonte e mappa affiancati':(corto<360?', piccolo: l\'interfaccia semplice o il solo orizzonte si leggono meglio':', telefono')}.`]);
  // regolazioni proposte (solo dove serve cambiare)
  if(lento&&m.ora.terrQ!=='0') P.push({k:'terrQ',v:'0',t:'Terreno 3D alla qualità più leggera, perché il disegno è lento.'});
  if(!lento&&m.disegno.mediana>0&&m.ora.terrQ!=='auto') P.push({k:'terrQ',v:'auto',t:'Terreno 3D in automatico: il dispositivo regge.'});
  if(m.baro.nativo&&m.baro.n>=5&&m.ora.baro===false) P.push({k:'baro',v:true,t:'Quota e vario dal barometro: c\'è, ed era spento.'});
  if((bMal||bDist)&&m.ora.compass!=='never') P.push({k:'compass',v:'never',t:'Bussola spenta: prua dalla traccia GPS. '+(bMal?'La bussola non dà dati.':'La bussola è disturbata; dopo averla calibrata rifai la prova.')});
  const bad=R.filter(r=>r[0]==='bad').length, warn=R.filter(r=>r[0]==='warn').length;
  return {mosso:false,righe:R,proposte:P,voto:bad?'scarso':(warn>2?'discreto':'buono'),deriva:der};
}

// ---- applicare e tornare indietro ----
function adesso(){ return {terrQ:String(PH.terrQ),baro:!!(PH.baro&&PH.baro.on),compass:PH.compassMode}; }
function metti(k,v){
  if(k==='terrQ'){ PH.terrQ=v; lsSet('ia517p_terrq',v); try{ PH.tqNow&&PH.tqNow(); }catch(e){} }
  if(k==='baro'&&PH.baro){ PH.baro.on=!!v; lsSet('ia517p_baro',PH.baro.on); PH.baro.ofs=null; try{ PH.vario.h=NaN; }catch(e){} }
  if(k==='compass'){ PH.compassMode=v; lsSet('ia517p_compass',v); } }
function applica(g){ const prima=adesso(), fatte=[]; for(const p of g.proposte){ metti(p.k,p.v); fatte.push(p); }
  const s=lsGet(KEY,{})||{}; s.applicate=fatte; s.prima=prima; s.tApplica=Date.now(); lsSet(KEY,s); PH.act&&PH.act('tailorfly applicato: '+fatte.map(p=>p.k+'='+p.v).join(' ')); return fatte; }
function annulla(){ const s=lsGet(KEY,null); if(!s||!s.prima) return false; for(const k of ['terrQ','baro','compass']) if(s.prima[k]!==undefined) metti(k,s.prima[k]);
  delete s.applicate; delete s.prima; lsSet(KEY,s); PH.act&&PH.act('tailorfly annullato'); return true; }

// ---- la misura ----
function misura(avanza){ return new Promise(fine=>{
  const g=[[],[],[]], a=[], hdg=[], pr=[], dis=[]; let ev=0, gpsN=0, gpsT=0, gpsAcc=NaN, raf=0, tPrec=0;
  const t0=performance.now();
  const mov=e=>{ ev++; const r=e.rotationRate; if(r&&r.alpha!=null&&r.beta!=null&&r.gamma!=null){ g[0].push(r.alpha); g[1].push(r.beta); g[2].push(r.gamma); }
    const q=e.accelerationIncludingGravity; if(q&&q.x!=null) a.push(Math.hypot(q.x,q.y,q.z)); };
  window.addEventListener('devicemotion',mov);
  const giro=now=>{ if(tPrec) dis.push(now-tPrec); tPrec=now; raf=requestAnimationFrame(giro); }; raf=requestAnimationFrame(giro);
  const tic=setInterval(()=>{ const now=performance.now();
    try{ if(PH.mag&&PH.mag.hdg!=null&&now-PH.mag.t<1500) hdg.push(PH.mag.hdg); }catch(e){}
    try{ if(PH.native&&PH.baro&&isFinite(PH.baro.pa)&&now-PH.baro.t<2000) pr.push(PH.baro.pa/100); }catch(e){}
    try{ const f=PH.fixes&&PH.fixes.phone; if(f&&f.t!==gpsT){ gpsT=f.t; gpsN++; if(f.acc>0) gpsAcc=f.acc; } }catch(e){}
    avanza(Math.min(1,(now-t0)/DUR));
    if(now-t0>=DUR||inVolo()){ clearInterval(tic); cancelAnimationFrame(raf); window.removeEventListener('devicemotion',mov);
      fine({durata:now-t0,eventi:ev,giro:{n:g[0].length,medie:g.map(media),scarti:g.map(scarto)},acc:{n:a.length,scarto:scarto(a)},
        bussola:{n:hdg.length,scarto:scartoAng(hdg),acc:PH.mag?PH.mag.acc:null},baro:{nativo:!!PH.native,n:pr.length,scarto:scarto(pr)},
        gps:{n:gpsN,acc:gpsAcc,sat:PH.stato&&PH.stato.satU},disegno:{mediana:mediana(dis)},schermo:{w:innerWidth,h:innerHeight,dpr:window.devicePixelRatio||1},ora:adesso(),interrotta:inVolo()}); } },200); }); }

// ---- la pagina ----
{ const s=document.createElement('style'); s.textContent=`
  #hzTf{position:fixed;inset:0;z-index:30;background:#0d1115;display:flex;flex-direction:column;color:#e9eef2;font:500 16px/1.4 system-ui,sans-serif}
  #hzTf .tf-h{display:flex;align-items:center;gap:10px;padding:max(10px,env(safe-area-inset-top,0px)) 12px 10px;border-bottom:1px solid #28323c}
  #hzTf .tf-h b{font:800 18px "Oxanium",system-ui,sans-serif;letter-spacing:.04em}
  #hzTf .tf-b{flex:1;overflow:auto;padding:14px 12px calc(20px + env(safe-area-inset-bottom,0px));max-width:680px;width:100%;margin:0 auto;box-sizing:border-box}
  #hzTf button{min-height:52px;padding:0 16px;border-radius:12px;border:2px solid #3a4a5a;background:#1b2530;color:#eef3f8;font:800 16px "Oxanium",system-ui,sans-serif;letter-spacing:.03em;cursor:pointer}
  #hzTf button.pri{border-color:#33e1ff;color:#33e1ff} #hzTf button:disabled{opacity:.4}
  #hzTf .tf-bar{height:14px;border-radius:7px;background:#1b2530;overflow:hidden;margin:16px 0} #hzTf .tf-bar i{display:block;height:100%;width:0;background:#33e1ff}
  #hzTf .tf-r{display:grid;grid-template-columns:26px 1fr;gap:8px;padding:10px 0;border-bottom:1px solid #1f2933} #hzTf .tf-r b{display:block}
  #hzTf .tf-r i{font-style:normal;font-weight:800} #hzTf .ok i{color:#19e38a} #hzTf .warn i{color:#ffd21e} #hzTf .bad i{color:#ff5a5a}
  #hzTf .tf-v{font:800 22px "Oxanium",system-ui,sans-serif;margin:6px 0 2px} #hzTf .tf-p{background:#121c25;border:1px solid #33e1ff;border-radius:12px;padding:12px;margin:14px 0}
  #hzTf .tf-p li{margin:6px 0} #hzTf .tf-k{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px} #hzTf small{color:#9aa4b0}`; document.head.appendChild(s); }
const SEGNO={ok:'✓',warn:'!',bad:'✕'};
function righeHtml(g){ return g.righe.map(r=>`<div class="tf-r ${r[0]}"><i>${SEGNO[r[0]]}</i><span><b>${esc(r[1])}</b>${esc(r[2])}</span></div>`).join(''); }
function apri(){
  if(inVolo()){ toastShow('TAILORFLY: SOLO A TERRA, TELEFONO FERMO'); return; }
  if(PH.demo||PH.sim){ toastShow('TAILORFLY: NON IN DEMO O SIMULAZIONE'); return; }
  let d=document.getElementById('hzTf'); if(d) d.remove();
  d=document.createElement('div'); d.id='hzTf'; d.innerHTML='<div class="tf-h"><button type="button" id="hzTfX">◀ Chiudi</button><b>TAILORFLY</b></div><div class="tf-b" id="hzTfB"></div>'; document.body.appendChild(d);
  const B=d.querySelector('#hzTfB'); d.querySelector('#hzTfX').onclick=()=>{ d.remove(); try{ PH.renderImp&&!document.getElementById('phImp').hidden&&PH.renderImp(); }catch(e){} };
  const inizio=()=>{ const s=lsGet(KEY,null);
    B.innerHTML=`<p>TailorFly misura quello che <b>questo dispositivo</b> sa fare e regola l'app di conseguenza.</p>
      <p>Appoggia il telefono <b>fermo sul suo supporto</b>, a motore spento, meglio all'aperto. La prova dura 20 secondi. Niente esce dal telefono.</p>
      <div class="tf-k"><button type="button" class="pri" id="hzTfGo">Avvia la prova</button>${s&&s.prima?'<button type="button" id="hzTfUndo">Torna a com\'era prima</button>':''}</div>
      ${s&&s.t?`<p><small>Ultima prova: ${new Date(s.t).toLocaleString('it-IT')} · giudizio ${esc(s.voto||'—')}${s.applicate&&s.applicate.length?' · regolazioni applicate: '+s.applicate.length:''}</small></p>`+(s.righe?righeHtml(s):''):''}`;
    B.querySelector('#hzTfGo').onclick=prova; const u=B.querySelector('#hzTfUndo'); if(u) u.onclick=()=>{ annulla(); toastShow('TAILORFLY: TORNATO A COM\'ERA'); inizio(); }; };
  const prova=async()=>{ B.innerHTML='<p><b>Misura in corso.</b> Non toccare il telefono.</p><div class="tf-bar"><i id="hzTfP"></i></div><p><small id="hzTfS">20 secondi</small></p>';
    const p=B.querySelector('#hzTfP'), st=B.querySelector('#hzTfS');
    const m=await misura(f=>{ p.style.width=(f*100).toFixed(0)+'%'; st.textContent=Math.max(0,Math.ceil((1-f)*DUR/1000))+' secondi'; });
    if(m.interrotta){ d.remove(); return; }
    const g=giudica(m); mostra(g); };
  const mostra=g=>{ if(!g.mosso) lsSet(KEY,{t:Date.now(),voto:g.voto,righe:g.righe,deriva:g.deriva});
    PH.act&&PH.act('tailorfly: '+(g.mosso?'telefono mosso':g.voto+', '+g.proposte.length+' regolazioni proposte'));
    B.innerHTML=(g.mosso?'':`<div class="tf-v">Dispositivo: ${esc(g.voto)}</div>`)+righeHtml(g)+
      (g.mosso?'':(g.proposte.length?`<div class="tf-p"><b>Regolazioni proposte</b><ul>${g.proposte.map(x=>`<li>${esc(x.t)}</li>`).join('')}</ul><small>I filtri dell'orizzonte non cambiano.</small></div>`:'<div class="tf-p"><b>Nessuna regolazione da fare</b>: l\'app è già impostata bene per questo dispositivo.</div>'))+
      `<div class="tf-k">${!g.mosso&&g.proposte.length?'<button type="button" class="pri" id="hzTfOk">Applica</button>':''}<button type="button" id="hzTfRe">Rifai la prova</button></div>`;
    const o=B.querySelector('#hzTfOk'); if(o) o.onclick=()=>{ const n=applica(g).length; toastShow('TAILORFLY: '+n+(n===1?' REGOLAZIONE APPLICATA':' REGOLAZIONI APPLICATE')); inizio(); };
    B.querySelector('#hzTfRe').onclick=prova; };
  inizio(); }
PH.tailorOpen=apri; PH.tailor={giudica,applica,annulla,scartoAng};
})();
