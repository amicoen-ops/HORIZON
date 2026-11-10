// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// IMPOSTAZIONI ORDINATE. In cima «Prima di partire»: tutto quello da sistemare a terra, ognuno con lo stato (✓ / !)
// e un tasto grande che porta all'azione. In volo (o in simulazione) in cima «In volo»: solo i comandi utili in aria,
// con tasti molto grandi. Le altre sezioni si chiudono e si aprono toccando il titolo (l'app ricorda quali sono aperte).
// In volo tutti i tasti delle pagine diventano più grandi: in turbolenza è difficile centrarli con il dito.
(function(){
'use strict';
const esc=x=>String(x??'').replace(/[<&>"]/g,c=>({'<':'&lt;','&':'&amp;','>':'&gt;','"':'&quot;'}[c]));
const KEY='ia517p_imp_open';
let aperte=new Set(lsGet(KEY,['Prima di partire','In volo','Stato']));
const inVolo=()=>{ try{ return PH_air(); }catch(e){ return false; } };
const ok='<i class="hz-ok">✓</i>', no='<i class="hz-no">!</i>', wt='<i class="hz-wt">…</i>';

{ const s=document.createElement('style'); s.textContent=`
  .ph-imp section>h3.hz-sh{cursor:pointer;display:flex;justify-content:space-between;align-items:center;min-height:44px;margin:-4px 0}
  .ph-imp section>h3.hz-sh::after{content:'▸';font-size:20px;letter-spacing:0;color:#7fe0ff}
  .ph-imp section.hz-open>h3.hz-sh::after{content:'▾'}
  .ph-imp section:not(.hz-open)>.hz-sb{display:none}
  .ph-imp section>.hz-sb{display:flex;flex-direction:column;gap:8px}
  .ph-imp section.hz-lampo{outline:2px solid #33e1ff}
  .ph-imp section.hz-top{border-color:#2f6488}
  .hz-pr{display:grid;grid-template-columns:30px 1fr auto;gap:10px;align-items:center;min-height:62px;border-bottom:1px solid #1f2830;padding:4px 0}
  .hz-pr i{font-style:normal;font:800 16px system-ui;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center}
  .hz-pr .hz-ok{background:#1f5a32;color:#8dffb0} .hz-pr .hz-wt{background:#4a4220;color:#ffe08a} .hz-pr .hz-no{background:#5a1f25;color:#ffb3b8}
  .hz-pr:last-child{border-bottom:0} .hz-pr b{display:block;font-size:15px} .hz-pr small{color:#9aa4b0;font-size:13px}
  .hz-pr .ph-btn{min-height:52px;min-width:104px;font-size:15px;font-weight:700}
  .hz-iv{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .hz-iv button{min-height:76px;border-radius:14px;border:2px solid #3a4a5a;background:#1b2530;color:#eef3f8;font:800 17px "Oxanium",system-ui,sans-serif;padding:4px 6px}
  .hz-iv button.on{border-color:#33e1ff;color:#33e1ff} .hz-iv button small{display:block;font:600 12px system-ui,sans-serif;color:#9aa4b0;margin-top:2px}
  .hz-iv .w2{grid-column:1/-1}
  /* in volo: tasti grandi in tutte le pagine */
  body.hz-volo .ph-btn{min-height:60px;font-size:16px;padding:0 18px}
  body.hz-volo .ph-chk{min-height:56px;align-items:center} body.hz-volo .ph-chk input{width:30px;height:30px}
  body.hz-volo .ph-seg button{min-height:58px;font-size:16px}
  body.hz-volo .ph-sheet-h button{min-height:56px;min-width:128px;font-size:17px}
  body.hz-volo .ph-imp section>h3.hz-sh{min-height:58px}
  body.hz-volo input[type=range]{height:44px}`;
  document.head.appendChild(s); }
// in volo tasti grandi ovunque
setInterval(()=>{ document.body.classList.toggle('hz-volo',inVolo()); },1000);

function salva(){ lsSet(KEY,[...aperte]); }
function apri(s,on,quiet){ s.classList.toggle('hz-open',!!on); if(quiet) return; const t=s.dataset.t; on?aperte.add(t):aperte.delete(t); salva(); }
function vaiA(titolo){ const box=document.getElementById('phImpBody'); if(!box) return; const s=[...box.querySelectorAll(':scope > section')].find(x=>x.dataset.t===titolo); if(!s) return;
  apri(s,true); s.scrollIntoView({behavior:'smooth',block:'start'}); s.classList.add('hz-lampo'); setTimeout(()=>s.classList.remove('hz-lampo'),1600); }
const clic=id=>{ const e=document.getElementById(id); if(e) e.click(); return !!e; };
function passo(id,d){ const e=document.getElementById(id); if(!e) return; e.value=Math.max(+e.min,Math.min(+e.max,(+e.value)+d)); e.dispatchEvent(new Event('input',{bubbles:true})); }

// ---- «Prima di partire» ----
function righe(){
  const P={}; try{ for(const r of PH.preRows()) P[r[1]]=r; }catch(e){}
  const st=r=>r?r[0]:wt, tx=r=>r?esc(r[2]):'';                                  // marche, modello, nome del file degli spazi: testo dell'utente
  let prof='', agl=null; try{ prof=IA517_RULES.PROFILES[IA517_RULES.get()].name; agl=IA517_RULES.vdsMaxAgl(new Date()); }catch(e){}
  const glo=PH.glo&&PH.glo.port, dev=+PH.magDev||0, cal=PH.altCal;
  return [
    [st(P['Velivolo']),'Velivolo',tx(P['Velivolo']),'Velivoli',()=>vaiA('Velivoli')],
    [st(P['LIVELLA']),'LIVELLA (montaggio)',tx(P['LIVELLA']),'Livella ora',()=>{ if(inVolo()){ toast('LIVELLA: SOLO A TERRA, AEREO FERMO'); return; } clic('phLvl'); }],
    [st(P['GPS']),glo?'Posizione: Garmin GLO 2':'Posizione: GPS del telefono',tx(P['GPS'])+(glo?'':' Con il GLO 2 è più precisa.'),glo?'Posizione':'GLO 2',()=>vaiA('Posizione: GPS del telefono e Garmin GLO 2')],
    [(dev||PH.magAutoLast)?ok:wt,'Bussola a terra',PH.magAutoLast?`corretta da sola al decollo (${PH.magAutoLast.dev>0?'+':''}${PH.magAutoLast.dev}°).`:(dev?`allineata alla bussola di bordo (${dev>0?'+':''}${dev}°).`:(PH.magAutoOn?'si corregge da sola alla prima corsa di decollo; a terra puoi allinearla alla bussola di bordo.':'se a terra la prua non coincide con la bussola di bordo, allineala.')),'Allinea',()=>{ if(!clic('phMagAl')) vaiA('Bussola'); }],
    [cal?ok:wt,'Quota',cal?`tarata su ${esc(cal.field)}.`:'si tara da sola fermo su un campo noto, o a mano.','Quota',()=>vaiA('Quota')],
    [prof?ok:no,'Tipo di volo',prof?`${esc(prof)}${agl!=null&&/basico/i.test(prof)?' · oggi massimo '+agl+' ft sul terreno':''}.`:'da scegliere.','Cambia',()=>vaiA('Tipo di volo')],
    [st(P['Spazi aerei']),'Spazi aerei',tx(P['Spazi aerei']),'Piano',()=>{ PH.show('piano'); }],
    [st(P['Terreno']),'Terreno e mappe senza internet',tx(P['Terreno']),'Scarica',()=>vaiA('Volare senza internet')],
    [PH.radioOn!==false?ok:wt,'Radio e frequenze',PH.radioOn!==false?`banner nel circuito acceso · squadriglia ${esc(PH.sqFreq?PH.sqFreq():'')}.`:'banner della chiamata spento.','Frequenze',()=>{ PH.freqOpen&&PH.freqOpen(); }],
    [wt,'Check list del velivolo','i controlli prima del volo, a fasi.','Check list',()=>{ PH.chkOpen&&PH.chkOpen(); }],
  ];
}
function primaHtml(){ return righe().map((r,i)=>`<div class="hz-pr">${r[0]}<span><b>${esc(r[1])}</b><small>${r[2]}</small></span><button class="ph-btn" type="button" data-pr="${i}">${esc(r[3])}</button></div>`).join(''); }
function primaWire(sec){ const R=righe(); sec.querySelectorAll('[data-pr]').forEach(b=>b.onclick=()=>R[+b.dataset.pr][4]()); }

// ---- «In volo» ----
function voloHtml(){
  const vo=PH.voice!==false, sem=PH.ui==='simple';
  return `<div class="hz-iv">
    <button type="button" data-iv="voce" class="${vo?'on':''}">🔊 VOCE ${vo?'ACCESA':'SPENTA'}</button>
    <button type="button" data-iv="ui" class="${sem?'on':''}">${sem?'INTERFACCIA SEMPLICE':'INTERFACCIA COMPLETA'}<small>tocca per cambiare</small></button>
    <button type="button" data-iv="sm-">ORIZZONTE<small>più pronto</small></button><button type="button" data-iv="sm+">ORIZZONTE<small>più morbido (${esc(PH.smoothTxt?PH.smoothTxt():'')})</small></button>
    <button type="button" data-iv="hs-">BUSSOLA<small>più pronta</small></button><button type="button" data-iv="hs+">BUSSOLA<small>più morbida (${esc(PH.hdgSmoothTxt?PH.hdgSmoothTxt():'')})</small></button>
    <button type="button" data-iv="sole" class="${PH.sole?'on':''}">☀ PIENO SOLE<small>${PH.sole?'acceso':'spento'}</small></button><button type="button" data-iv="freq">📻 FREQUENZE</button></div>
    <p class="ph-sub">Tasti grandi per la turbolenza. Le altre impostazioni sono sotto, chiuse: a terra trovi in cima «Prima di partire».</p>`;
}
function voloWire(sec){
  sec.querySelectorAll('[data-iv]').forEach(b=>b.onclick=()=>{ const k=b.dataset.iv;
    if(k==='voce') clic('phVoice');
    if(k==='ui'){ const want=PH.ui==='simple'?'full':'simple'; const x=document.querySelector(`#phUi [data-u="${want}"]`); if(x) x.click(); }
    if(k==='sm-') passo('phSm',-1); if(k==='sm+') passo('phSm',1);
    if(k==='hs-') passo('phHs',-1); if(k==='hs+') passo('phHs',1);
    if(k==='freq'){ PH.freqOpen&&PH.freqOpen(); return; }
    if(k==='sole'&&PH.soleSet) PH.soleSet(!PH.sole);
    const c=sec.querySelector('.hz-sb'); if(c){ c.innerHTML=voloHtml(); voloWire(sec); } }); }

function sezione(box,titolo,html,wire,first){
  const s=document.createElement('section'); s.className='hz-top'; s.innerHTML=`<h3>${esc(titolo)}</h3>${html}`;
  if(first) box.prepend(s); else box.querySelector(':scope > section')?box.querySelector(':scope > section').after(s):box.appendChild(s);
  return s;
}
function riordina(){
  const box=document.getElementById('phImpBody'); if(!box) return;
  const volo=inVolo();
  const pp=sezione(box,'Prima di partire',primaHtml(),null,!volo), iv=volo?sezione(box,'In volo',voloHtml(),null,true):null;
  // tutte le sezioni pieghevoli (titolo = interruttore)
  for(const s of box.querySelectorAll(':scope > section')){ const h=s.querySelector(':scope > h3'); if(!h||s.dataset.t) continue;
    const t=h.textContent.trim(); s.dataset.t=t; const body=document.createElement('div'); body.className='hz-sb';
    while(h.nextSibling) body.appendChild(h.nextSibling); s.appendChild(body);
    h.classList.add('hz-sh'); h.setAttribute('role','button'); h.tabIndex=0;
    h.onclick=()=>apri(s,!s.classList.contains('hz-open')); h.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); h.click(); } };
    apri(s,aperte.has(t)||(volo&&t==='In volo'),true); }
  if(volo) apri(pp,false,true);
  primaWire(pp); if(iv) voloWire(iv);
  // stato di «Prima di partire» aggiornato mentre la pagina è aperta
  clearInterval(PH.impPrT); PH.impPrT=setInterval(()=>{ const imp=document.getElementById('phImp'); if(!imp||imp.hidden||!pp.isConnected){ clearInterval(PH.impPrT); return; }
    const c=pp.querySelector('.hz-sb'); if(c&&pp.classList.contains('hz-open')){ c.innerHTML=primaHtml(); primaWire(pp); } },3000);
}
const orig=PH.renderImp;
PH.renderImp=function(){ orig.apply(this,arguments); try{ riordina(); }catch(e){ console.error('impostazioni',e); } };
PH.impVai=vaiA;
})();
