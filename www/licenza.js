// I-A517 Strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
// =====================================================================================
//  Licenza d'uso: 30 giorni di prova, poi
//   · Google Play: abbonamento annuale nell'app (Play Billing), su tutti i telefoni dell'account Google
//   · APK e web: chiave comprata su Polar.sh (pagamento verificato, chiave alla mail di chi paga),
//     attivata sul server di Polar, al massimo 2 dispositivi per chiave
//  In volo l'app non si blocca mai: l'eventuale richiesta arriva a terra.
// =====================================================================================
(function(){
'use strict';
if(window.top!==window) return;                 // nella pagina del piano (dentro lo strumento) non serve
const CFG={
  polarOrg:'__POLAR_ORG__',                      // Organization ID di Polar (vuoto: licenza non ancora attiva su APK e web)
  polarApi:'https://api.polar.sh',                      // https://api.polar.sh oppure https://sandbox-api.polar.sh
  checkout:'__POLAR_CHECKOUT__',                 // link di pagamento del prodotto su Polar
  portal:'__POLAR_PORTAL__',                     // spazio del cliente su Polar (chiave, dispositivi, ricevute)
  playProduct:'licenza_annuale', playBasePlan:'annuale', price:'20 €', trialDays:30, offlineDays:30, playOfflineDays:7, recheckDays:3
};
const set=v=>v && !/^__/.test(v);
const DAY=86400000, K='ia517p_lic', KT='ia517p_t0', KS='ia517p_seen';
const ls={get(k,d){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } }, set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }};
// copia di sicurezza in IndexedDB: cancellare solo i dati del browser non azzera la prova
const idb={ db:null,
  open(){ if(this.db) return this.db; this.db=new Promise(res=>{ try{ const r=indexedDB.open('ia517_lic',1); r.onupgradeneeded=()=>r.result.createObjectStore('kv'); r.onsuccess=()=>res(r.result); r.onerror=()=>res(null); }catch(e){ res(null); } }); return this.db; },
  async get(k){ const db=await this.open(); if(!db) return null; return new Promise(res=>{ try{ const r=db.transaction('kv').objectStore('kv').get(k); r.onsuccess=()=>res(r.result??null); r.onerror=()=>res(null); }catch(e){ res(null); } }); },
  async set(k,v){ const db=await this.open(); if(!db) return; try{ db.transaction('kv','readwrite').objectStore('kv').put(v,k); }catch(e){} } };

const L={ cfg:CFG, state:null, dev:null, native:null, play:false, ready:false, busy:false };
window.IA517_LIC=L;
L.channel=()=>((window.IA517_BUILD||{}).channel)||'web';
// la licenza si applica: sul Play Store sempre (quando c'è il modulo di Google), su APK e web quando c'è il negozio Polar
L.enforced=()=>L.channel()==='play'?!!L.play:set(CFG.polarOrg);

async function sha(s){ const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join(''); }
const b32='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function code(hex){ let o=''; for(let i=0;i<12;i++) o+=b32[parseInt(hex.substr(i*2,2),16)%32]; return o.slice(0,4)+'-'+o.slice(4,8)+'-'+o.slice(8,12); }

L.init=async function(){
  const Cap=window.Capacitor, P=Cap&&Cap.Plugins;
  L.native=P&&P.Licenza||null;
  let info=null; if(L.native){ try{ info=await L.native.info(); }catch(e){} }
  // codice del dispositivo: su Android dall'ID del telefono (resta uguale anche reinstallando); nel browser casuale e salvato
  let raw=info&&info.deviceId; if(!raw){ raw=ls.get('ia517p_devraw',null)||await idb.get('devraw'); if(!raw){ raw=(crypto.randomUUID?crypto.randomUUID():String(Math.random()).slice(2)+Date.now()); } ls.set('ia517p_devraw',raw); idb.set('devraw',raw); }
  L.dev=code(await sha('ia517|'+raw));
  L.signOk=info?info.signatureOk!==false:true;
  // inizio della prova: il primo tra installazione, primo avvio e copia di sicurezza
  const now=Date.now(); let t0=Math.min(...[ls.get(KT,null),await idb.get('t0'),info&&info.firstInstall].filter(x=>x>0), now);
  ls.set(KT,t0); idb.set('t0',t0); L.t0=t0;
  // orologio portato indietro: si tiene l'ora più avanti mai vista
  const seen=Math.max(ls.get(KS,0),(await idb.get('seen'))||0); L.clockBack=seen-now>DAY; ls.set(KS,Math.max(seen,now)); idb.set('seen',Math.max(seen,now));
  L.state=ls.get(K,null)||await idb.get('lic')||null;
  if(L.channel()==='play' && L.native && L.native.billingStart){ try{ const r=await L.native.billingStart({product:CFG.playProduct,basePlan:CFG.playBasePlan}); L.play=!!r.ok; L.playPrice=r.price||CFG.price; }catch(e){ L.play=false; } }
  L.ready=true;
  await L.refresh(false);
  L.tick(); setInterval(L.tick,60000);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) L.tick(); });
};
L.save=function(){ ls.set(K,L.state); idb.set('lic',L.state); };
L.now=()=>Math.max(Date.now(),ls.get(KS,0));
L.trialLeft=()=>Math.max(0,Math.ceil((L.t0+CFG.trialDays*DAY-L.now())/DAY));
L.licensed=function(){ const s=L.state; if(!s||!s.ok) return false;
  if(s.kind==='play') return L.now()-(s.lastOk||0)<CFG.playOfflineDays*DAY;   // abbonamento: ricontrollato a ogni avvio; senza rete vale 7 giorni
  return L.now()-(s.lastOk||0)<CFG.offlineDays*DAY; };                     // Polar: valido fino a 30 giorni senza poterlo ricontrollare
L.status=function(){
  if(!L.ready) return {code:'wait'};
  if(!L.enforced()) return {code:'free'};
  if(!L.signOk) return {code:'tampered'};
  if(L.licensed()) return {code:'ok'};
  if(L.state&&L.state.revoked) return {code:'revoked'};
  const left=L.clockBack?0:L.trialLeft();
  return left>0?{code:'trial',left}:{code:'expired'};
};
// in volo (o appena decollato) non si blocca mai niente
L.inFlight=function(){ try{ return !!(typeof PH!=='undefined'&&PH&&PH.flight) || (typeof S!=='undefined'&&S.gpsReal&&S.gs>35); }catch(e){ return false; } };

// ---------- Polar ----------
async function post(path,body){
  const url=CFG.polarApi.replace(/\/$/,'')+path;
  const nh=typeof PH!=='undefined'&&PH&&PH.native&&PH.native.http;
  if(nh){ const r=await nh.post({url,headers:{'Content-Type':'application/json','Accept':'application/json'},data:body}); let d=r.data; if(typeof d==='string'){ try{ d=JSON.parse(d); }catch(e){} } return {status:r.status,d}; }
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body)}); let d=null; try{ d=await r.json(); }catch(e){} return {status:r.status,d};
}
L.activate=async function(key){
  key=String(key||'').trim().replace(/\s+/g,'');
  if(key.length<8) throw new Error('Chiave troppo corta: copiala intera dalla mail o dal tuo spazio su Polar.');
  const label=('I-A517 '+L.dev).slice(0,40);
  const meta={device:L.dev,app:((window.IA517_BUILD||{}).version)||'',canale:L.channel(),modello:(navigator.userAgent.match(/\(([^)]+)\)/)||[])[1]?.slice(0,120)||''};
  let r; try{ r=await post('/v1/customer-portal/license-keys/activate',{key,organization_id:CFG.polarOrg,label,conditions:{device:L.dev},meta}); }
  catch(e){ throw new Error(navigator.onLine?'Il server delle licenze non risponde: riprova tra poco.':'Serve internet per attivare la licenza: collegati e riprova.'); }
  if(r.status===403) throw new Error('Questa chiave è già attiva su 2 dispositivi. Liberane uno dal tuo spazio su Polar (link qui sotto) e riprova.');
  if(r.status===404) throw new Error('Chiave non trovata: controlla di averla copiata intera.');
  if(r.status<200||r.status>=300||!r.d||!r.d.id) throw new Error('Il server delle licenze non ha risposto ('+r.status+'). Riprova tra poco.');
  const lk=r.d.license_key||{};
  if(lk.status && lk.status!=='granted') throw new Error('Questa chiave non è valida (stato: '+lk.status+').');
  L.state={kind:'polar',ok:true,key,act:r.d.id,lastOk:Date.now(),mail:(lk.customer&&lk.customer.email)||'',limit:lk.limit_activations||2,display:lk.display_key||''};
  L.save(); return L.state;
};
L.validate=async function(){
  const s=L.state; if(!s||s.kind!=='polar'||!s.key) return;
  const r=await post('/v1/customer-portal/license-keys/validate',{key:s.key,organization_id:CFG.polarOrg,activation_id:s.act,conditions:{device:L.dev}});
  if(r.status>=200&&r.status<300&&r.d&&r.d.status==='granted'){ s.ok=true; s.revoked=false; s.lastOk=Date.now(); L.save(); return true; }
  if(r.status===404||(r.d&&r.d.status&&r.d.status!=='granted')){ s.ok=false; s.revoked=true; L.save(); return false; }   // annullata, rimborsata o dispositivo tolto
  return null;                                                               // server non raggiungibile: si riprova
};
// ---------- Google Play ----------
L.buyPlay=async function(){ const r=await L.native.billingBuy({product:CFG.playProduct}); return L.playResult(r); };
L.restorePlay=async function(){ const r=await L.native.billingRestore({product:CFG.playProduct}); return L.playResult(r); };
L.playResult=function(r){ if(r&&r.owned){ L.state={kind:'play',ok:true,token:r.token||'',autoRenew:!!r.autoRenew,lastOk:Date.now()}; L.save(); return true; }
  if(L.state&&L.state.kind==='play'&&r&&r.checked){ L.state.ok=false; L.state.revoked=true; L.save(); } return false; };
L.manageUrl=()=>'https://play.google.com/store/account/subscriptions?sku='+CFG.playProduct+'&package=it.ia517.strumento';

L.refresh=async function(force){
  if(!L.enforced()) return;
  const s=L.state;
  try{
    if(L.channel()==='play'&&L.play){ await L.restorePlay(); }
    else if(s&&s.kind==='polar'&&navigator.onLine&&(force||Date.now()-(s.lastOk||0)>CFG.recheckDays*DAY)) await L.validate();
  }catch(e){}
};

// ---------- schermata ----------
L.tick=function(){
  const st=L.status();
  if(st.code==='trial' && st.left<=7 && !ls.get('ia517p_licwarn_'+st.left,false) && !L.inFlight()){ ls.set('ia517p_licwarn_'+st.left,true); try{ toast('PROVA: ANCORA '+st.left+(st.left===1?' GIORNO':' GIORNI')); }catch(e){} }
  if((st.code==='expired'||st.code==='revoked'||st.code==='tampered') && !L.inFlight()) L.wall(st);
};
L.css=function(){ if(document.getElementById('licCss')) return; const s=document.createElement('style'); s.id='licCss'; s.textContent=`
  .lic-wall{position:fixed;inset:0;z-index:200;background:#0d1115;color:#e8eef5;display:flex;flex-direction:column;align-items:center;overflow:auto;padding:24px 18px;font:15px/1.45 system-ui,sans-serif}
  .lic-wall h2{font:800 22px "Oxanium",system-ui,sans-serif;margin:8px 0 4px;color:#3fd6ff;text-align:center}
  .lic-wall .lic-box{max-width:520px;width:100%}
  .lic-wall p{margin:8px 0;color:#c9d3de}
  .lic-wall .lic-code{font:800 22px ui-monospace,monospace;letter-spacing:.08em;text-align:center;background:#161c23;border:1px solid #3a4250;border-radius:10px;padding:8px;margin:6px 0}
  .lic-wall button,.lic-wall a.lic-a{display:block;width:100%;min-height:48px;margin:8px 0;border-radius:12px;border:1px solid #3a4250;background:#161c23;color:#e8eef5;font:700 15px system-ui,sans-serif;text-align:center;text-decoration:none;line-height:48px}
  .lic-wall .pri{background:#ff46e0;border-color:#ff46e0;color:#1a0016}
  .lic-wall textarea{width:100%;min-height:64px;border-radius:10px;border:1px solid #3a4250;background:#0a0e12;color:#e8eef5;font:600 14px ui-monospace,monospace;padding:8px;box-sizing:border-box}
  .lic-wall .lic-msg{min-height:1.4em;font-weight:700}
  .lic-wall .bad{color:#ff6b6b} .lic-wall .ok{color:#5bd38a} .lic-wall small{color:#8a96a3}`; document.head.appendChild(s); };
L.wall=function(st){
  if(document.getElementById('licWall')) return; L.css();
  const d=document.createElement('div'); d.className='lic-wall'; d.id='licWall'; d.setAttribute('role','dialog'); d.setAttribute('aria-modal','true');
  d.innerHTML=`<div class="lic-box">${L.panel(st)}</div>`;
  document.body.appendChild(d); L.wire(d);
};
L.panel=function(st){
  const play=L.channel()==='play'&&L.play, esc=x=>String(x).replace(/[<&>"]/g,c=>({'<':'&lt;','&':'&amp;','>':'&gt;','"':'&quot;'}[c]));
  const title=st.code==='tampered'?'App modificata':(st.code==='revoked'?(play?'Abbonamento scaduto':'Licenza non più valida'):(st.code==='expired'?'Prova finita':(play?'Abbonamento':'Licenza')));
  const why=st.code==='tampered'?'Questa copia dell\'app è stata modificata o firmata da altri: scarica quella ufficiale dal Play Store o da amicoen-ops.github.io/strumento-i-a517.':
    (st.code==='revoked'?(play?'L\'abbonamento non risulta attivo su questo account Google (disdetto, scaduto o pagamento non riuscito). Rinnovalo per continuare.':'La chiave è stata annullata (rimborso, chiave sostituita o dispositivo tolto). Attiva una chiave valida.'):
    (st.code==='expired'?`I ${CFG.trialDays} giorni di prova sono finiti. Grazie per averla provata!`:''));
  return `<h2>${title}</h2><p>${why}</p>`+(st.code==='tampered'?'':
    (play?`<p><b>Abbonamento annuale: ${esc(L.playPrice||CFG.price)} all'anno</b>, su tutti i telefoni del tuo account Google. Si rinnova da solo ogni anno finché non lo disdici; puoi disdire quando vuoi dal Play Store (Abbonamenti) e l'app resta attiva fino alla fine dell'anno già pagato.</p>
      <button class="pri" type="button" data-l="buy">Abbonati · ${esc(L.playPrice||CFG.price)}/anno</button><button type="button" data-l="restore">Ho già l'abbonamento: ripristina</button>
      <a class="lic-a" href="${L.manageUrl()}" target="_blank" rel="noopener">Gestisci o disdici l'abbonamento</a>`:
     `<p>Con la licenza da <b>${CFG.price}</b>, una volta sola, l'app resta completa per sempre su <b>2 dispositivi</b> (telefono, tablet o browser). La chiave arriva alla mail con cui paghi.</p>
      ${set(CFG.checkout)?`<a class="lic-a pri" href="${esc(CFG.checkout)}" target="_blank" rel="noopener" data-l="checkout">Acquista la licenza · ${CFG.price}</a>`:''}
      <p><b>Hai la chiave?</b> Incollala qui:</p><textarea id="licKey" placeholder="IA517-…" autocapitalize="characters" spellcheck="false"></textarea>
      <button type="button" data-l="act">Attiva su questo dispositivo</button>
      <p><small>Codice di questo dispositivo: <b>${L.dev}</b>. ${set(CFG.portal)?`Ricevute, chiave e dispositivi attivi: <a href="${esc(CFG.portal)}" target="_blank" rel="noopener" style="color:#3fd6ff">il tuo spazio su Polar</a>.`:''}</small></p>`))+
    `<p class="lic-msg" id="licMsg"></p><p><small>In volo l'app non si blocca mai: questa schermata compare solo a terra. Problemi? amicoen@gmail.com</small></p>`;
};
L.wire=function(root){
  const msg=t=>{ const m=root.querySelector('#licMsg'); if(m){ m.className='lic-msg '+(t&&t.ok?'ok':'bad'); m.textContent=t?t.text:''; } };
  const done=()=>{ msg({ok:true,text:'Licenza attiva. Buon volo!'}); setTimeout(()=>{ const w=document.getElementById('licWall'); if(w) w.remove(); try{ PH.renderInfo&&!el('phInfo').hidden&&PH.renderInfo(); }catch(e){} },1200); };
  root.querySelectorAll('[data-l]').forEach(b=>b.addEventListener('click',async ev=>{ const a=b.dataset.l; if(a==='checkout'){ try{ PH.act&&PH.act('licenza: acquisto'); }catch(e){} return; }
    if(L.busy) return; L.busy=true; b.disabled=true; msg({ok:true,text:'Un momento…'});
    try{
      if(a==='act'){ await L.activate(root.querySelector('#licKey').value); done(); }
      else if(a==='buy'){ if(await L.buyPlay()) done(); else msg({ok:false,text:'Abbonamento non completato.'}); }
      else if(a==='restore'){ if(await L.restorePlay()) done(); else msg({ok:false,text:'Nessun abbonamento attivo su questo account Google.'}); }
    }catch(e){ msg({ok:false,text:String(e&&e.message||e)}); }
    finally{ L.busy=false; b.disabled=false; } }));
};
// riquadro per Info
L.infoHtml=function(){
  const st=L.status();
  const line=st.code==='free'?'Versione completa, senza licenza da attivare.':(st.code==='ok'?(L.state.kind==='play'?`Abbonamento attivo (Google Play)${L.state.autoRenew===false?', disdetto: vale fino alla fine del periodo pagato':', si rinnova ogni anno'}. <a href="${L.manageUrl()}" target="_blank" rel="noopener">Gestisci o disdici</a>`:`Licenza attiva su questo dispositivo (${L.dev})${L.state.mail?' · '+L.state.mail:''}.`):
    (st.code==='trial'?`Prova: ancora <b>${st.left}</b> ${st.left===1?'giorno':'giorni'}.`:(st.code==='wait'?'…':'Licenza da attivare.')));
  return `<section><h3>Licenza d'uso</h3><p class="ph-sub">${line}</p>`+((st.code==='trial'||st.code==='expired'||st.code==='revoked')?`<div class="ph-btns"><button class="ph-btn pri" type="button" id="licOpen">${L.channel()==='play'?'Abbonati':'Acquista o attiva la licenza'}</button></div>`:'')+
    (st.code==='ok'&&L.state.kind==='polar'&&set(CFG.portal)?`<p class="ph-sub">Ricevute, chiave e dispositivi: <a href="${CFG.portal}" target="_blank" rel="noopener">il tuo spazio su Polar</a>.</p>`:'')+`</section>`;
};
L.infoWire=function(){ const b=document.getElementById('licOpen'); if(b) b.onclick=()=>{ const st=L.status(); L.wall(st.code==='trial'?{code:'buy'}:st); const w=document.getElementById('licWall');
  if(w&&st.code==='trial'){ const x=document.createElement('button'); x.type='button'; x.textContent='Torna all\'app'; x.onclick=()=>w.remove(); w.querySelector('.lic-box').appendChild(x); } }; };
document.addEventListener('DOMContentLoaded',()=>{ setTimeout(()=>{ L.init().catch(e=>{ L.ready=true; try{ PH.logErr&&PH.logErr('licenza: '+e); }catch(_){} }); },300); });
})();
