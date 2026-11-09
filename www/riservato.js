// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// MENU RISERVATO e CODICE DI LICENZA. In Info, 5 tocchi sul logo in alto a sinistra (entro 3 s) aprono il menu riservato:
// codice di questo telefono, «Chiedi la licenza» (manda il codice a horizonlicenses: Web3Forms o la posta del pilota;
// la risposta con i prezzi parte da GitHub, fuori dall'app), campo per il codice di licenza e il suo stato.
// Nessun prezzo e nessun link di pagamento, in nessuna versione (regole di Google Play): la licenza si ottiene fuori dall'app.
// Il codice (HZ1-…) è firmato dall'autore con una chiave privata (tools/licenze.py) e si verifica qui anche senza
// internet con la chiave pubblica: tipo M mensile, A annuale, P perenne, legato al codice del telefono, revocabile
// (lista delle licenze revocate, controllata una volta al giorno quando c'è internet). Per ora non blocca niente:
// lo schema deciso (senza licenza niente uso dal vivo, mai blocchi in volo) si accende più avanti.
(function(){
'use strict';
const PUB='MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEXSBbCj2UpmVa0G3EbWC80ENkN4APnYTEOG7O8d+gMq5s7OV4Gp/hifcmn6/+5haoE3kDLEVBcIWgOg6RccD4KQ==';          // chiave pubblica (SPKI in base64), messa dal comando «Licenze › crea-chiave»
const REVOCHE='https://raw.githubusercontent.com/amicoen-ops/HORIZON/licenze/licenze/revocate.json';
const ALFA='0123456789ABCDEFGHJKMNPQRSTVWXYZ', EPOCA=Date.UTC(2026,0,1), DAY=86400000;
const KC='ia517p_codice', KR='ia517p_revoche', KM='ia517p_mail';
const esc=x=>String(x??'').replace(/[<&>"]/g,c=>({'<':'&lt;','&':'&amp;','>':'&gt;','"':'&quot;'}[c]));
const get=(k,d)=>{ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } };
const put=(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} };
const L=window.IA517_LIC||(window.IA517_LIC={});
const telefono=()=>L.dev||'';

function unb32(s){ s=String(s).toUpperCase().replace(/O/g,'0').replace(/[IL]/g,'1'); let n=0,bits=0; const out=[];
  for(const ch of s){ const i=ALFA.indexOf(ch); if(i<0) continue; n=((n<<5)|i)&0xffffff; bits+=5; if(bits>=8){ bits-=8; out.push((n>>bits)&255); } }
  return new Uint8Array(out); }
const giorno=d=>new Date(EPOCA+d*DAY);
// legge e verifica un codice: {ok, tipo, emesso, scade, numero, tel} oppure {ok:false, perche}
async function leggi(codice){
  let c=String(codice||'').trim().toUpperCase(); if(!c) return {ok:false,perche:'nessun codice'};
  if(c.startsWith('HZ1')) c=c.slice(3); else return {ok:false,perche:'non è un codice di HORIZON (inizia con HZ1)'};
  const raw=unb32(c); if(raw.length<85) return {ok:false,perche:'codice incompleto: copialo tutto'};
  const dati=raw.slice(0,21), firma=raw.slice(21,85);
  if(/^__/.test(PUB)) return {ok:false,perche:'verifica non ancora attiva in questa versione'};
  try{ const der=Uint8Array.from(atob(PUB),ch=>ch.charCodeAt(0));
    const key=await crypto.subtle.importKey('spki',der,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
    const ok=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,firma,dati);
    if(!ok) return {ok:false,perche:'codice non valido (firma errata)'}; }
  catch(e){ return {ok:false,perche:'verifica non riuscita su questo telefono'}; }
  const dv=new DataView(dati.buffer,dati.byteOffset,21), tipo=String.fromCharCode(dati[1]), em=dv.getUint16(2), sc=dv.getUint16(4);
  const numero=(dati[6]<<16)|(dati[7]<<8)|dati[8], tel=String.fromCharCode(...dati.slice(9,21));
  return {ok:true,versione:dati[0],tipo,emesso:giorno(em),scade:sc===65535?null:giorno(sc),numero,tel};
}
// stato della licenza su questo telefono
L.codiceStato=async function(){
  const c=get(KC,''); if(!c) return {stato:'nessuno'};
  const r=await leggi(c); if(!r.ok) return {stato:'non valido',perche:r.perche};
  const qui=telefono().replace(/-/g,''); if(qui && r.tel!==qui) return Object.assign(r,{stato:'altro telefono'});
  if((get(KR,{n:[]}).n||[]).includes(r.numero)) return Object.assign(r,{stato:'revocato'});
  const ora=Math.max(Date.now(),get('ia517p_seen',0)||0);                 // orologio portato indietro: vale l'ora più avanti vista
  if(r.scade && ora>r.scade.getTime()+DAY) return Object.assign(r,{stato:'scaduto'});
  return Object.assign(r,{stato:'attivo'});
};
// licenze revocate: una volta al giorno, quando c'è internet
async function revoche(){ const v=get(KR,{t:0,n:[]}); if(Date.now()-(v.t||0)<DAY || !navigator.onLine) return;
  try{ const r=await fetch(REVOCHE+'?t='+Date.now(),{cache:'no-store'}); if(!r.ok) return; const j=await r.json(); put(KR,{t:Date.now(),n:Array.isArray(j.revocate)?j.revocate:[]}); }catch(e){} }
setTimeout(revoche,15000);

const TIPO={M:'mensile',A:'annuale',P:'perenne'};
const data=d=>d?d.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'}):'';
function statoHtml(s){
  if(s.stato==='nessuno') return 'Nessun codice inserito.';
  if(s.stato==='non valido') return `<span style="color:#ff5a5a">Codice non valido: ${esc(s.perche)}.</span>`;
  const base=`Licenza ${TIPO[s.tipo]||s.tipo} n. ${s.numero}, emessa il ${data(s.emesso)}`;
  if(s.stato==='altro telefono') return `<span style="color:#ff5a5a">${base}: è per un altro telefono (${esc(s.tel.replace(/(.{4})(?=.)/g,'$1-'))}).</span>`;
  if(s.stato==='revocato') return `<span style="color:#ff5a5a">${base}: revocata.</span>`;
  if(s.stato==='scaduto') return `<span style="color:#ffc531">${base}: scaduta il ${data(s.scade)}.</span>`;
  return `<span style="color:#3ddc84">${base} · ${s.scade?'valida fino al '+data(s.scade):'senza scadenza'}.</span>`;
}

// ---- pagina del menu riservato ----
PH.riservatoOpen=async function(){
  let d=document.getElementById('hzRis'); if(d) d.remove();
  d=document.createElement('div'); d.className='ph-sheet'; d.id='hzRis';
  const draw=async()=>{ const s=await L.codiceStato();
    d.innerHTML=`<div class="ph-sheet-h"><button type="button" data-close>◀ Indietro</button><b>Menu riservato</b></div>
    <div class="ph-imp">
      <section><h3>Licenza</h3>
        <p class="ph-sub">Codice di questo telefono</p>
        <div class="hz-tel"><b>${esc(telefono()||'…')}</b><button type="button" class="ph-btn" id="hzTelCp">Copia</button></div>
        <p class="ph-sub" style="margin-top:12px">Chiedi la licenza: il codice di questo telefono arriva all'autore, che ti risponde per posta</p>
        <input id="hzMail" type="email" inputmode="email" autocomplete="email" placeholder="la tua email" value="${esc(get(KM,''))}">
        <div class="ph-btns"><button type="button" class="ph-btn" id="hzChiedi">Invia la richiesta</button><a class="ph-btn" id="hzChiediMail" href="#">Scrivi dalla tua posta</a></div>
        <p id="hzChiediSt" class="ph-sub"></p>
        <p class="ph-sub" style="margin-top:12px">Codice di licenza</p>
        <textarea id="hzCod" rows="4" spellcheck="false" autocapitalize="characters" placeholder="HZ1-…">${esc(get(KC,''))}</textarea>
        <div class="ph-btns"><button type="button" class="ph-btn pri" id="hzCodOk">Attiva</button>${get(KC,'')?'<button type="button" class="ph-btn" id="hzCodNo">Togli il codice</button>':''}</div>
        <p id="hzCodSt">${statoHtml(s)}</p>
      </section>
      <section><h3>Altre voci</h3><p class="ph-sub">In arrivo.</p></section>
    </div>`;
    d.querySelector('[data-close]').onclick=()=>d.remove();
    d.querySelector('#hzTelCp').onclick=()=>{ try{ navigator.clipboard.writeText(telefono()); toast('CODICE COPIATO'); }catch(e){ toast(telefono()); } };
    d.querySelector('#hzCodOk').onclick=async()=>{ const v=d.querySelector('#hzCod').value.trim(); const r=await leggi(v);
      if(!r.ok){ d.querySelector('#hzCodSt').innerHTML=statoHtml({stato:'non valido',perche:r.perche}); return; }
      if(telefono() && r.tel!==telefono().replace(/-/g,'')){ d.querySelector('#hzCodSt').innerHTML=statoHtml(Object.assign(r,{stato:'altro telefono'})); return; }
      put(KC,v); PH.act&&PH.act('licenza '+r.tipo+' n. '+r.numero); await draw(); toast('CODICE INSERITO'); };
    // richiesta della licenza: con Web3Forms (come le segnalazioni) oppure dall'app di posta del pilota
    const oggetto=()=>'HORIZON licenza '+telefono();
    d.querySelector('#hzChiediMail').onclick=e=>{ e.currentTarget.href='mailto:'+PH_INFO.mail+'?subject='+encodeURIComponent(oggetto())
      +'&body='+encodeURIComponent('Ciao, vorrei la licenza di HORIZON.\nCodice del telefono: '+telefono()+'\n'); PH.act&&PH.act('richiesta licenza (posta)'); };
    d.querySelector('#hzChiedi').onclick=async()=>{ const st=d.querySelector('#hzChiediSt'), m=d.querySelector('#hzMail').value.trim();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)){ st.innerHTML='<span style="color:#ffc531">Scrivi la tua email: la risposta arriva lì.</span>'; return; }
      if(!telefono()){ st.textContent='Codice del telefono non ancora pronto: riprova tra un attimo.'; return; }
      put(KM,m); st.textContent='Invio…';
      try{ await PH.sendReport({kind:'Richiesta licenza',text:'Licenza per il telefono '+telefono(),reply:m,t:Date.now(),diag:''});
        st.innerHTML='<span style="color:#3ddc84">Richiesta inviata. Ti rispondiamo a '+esc(m)+' (guarda anche nello spam).</span>'; toast('RICHIESTA INVIATA'); PH.act&&PH.act('richiesta licenza'); }
      catch(e){ st.innerHTML='<span style="color:#ff5a5a">Invio non riuscito ('+esc(String(e&&e.message||e).slice(0,80))+'): usa «Scrivi dalla tua posta».</span>'; } };
    const no=d.querySelector('#hzCodNo'); if(no) no.onclick=async()=>{ put(KC,''); await draw(); };
  };
  document.body.appendChild(d); await draw(); PH.act&&PH.act('menu riservato');
};
// 5 tocchi sul logo di Info entro 3 secondi
{ let n=0, t0=0;
  document.addEventListener('click',e=>{ const img=e.target.closest&&e.target.closest('#phInfoBody .ph-hero img'); if(!img) return;
    const now=Date.now(); if(now-t0>3000) n=0; if(!n) t0=now; n++;
    if(n>=5){ n=0; PH.riservatoOpen(); } else if(n>=3) toast('ANCORA '+(5-n)+(5-n===1?' TOCCO':' TOCCHI')); }); }
{ const s=document.createElement('style'); s.textContent=`
  .hz-tel{display:flex;align-items:center;gap:12px;flex-wrap:wrap} .hz-tel b{font:800 22px 'Oxanium',system-ui,monospace;letter-spacing:.06em;color:#33e1ff}
  #hzMail{width:100%;box-sizing:border-box;font:600 15px system-ui,sans-serif;background:#121c25;color:#eef3f8;border:1px solid #3a4a5a;border-radius:10px;padding:8px;margin:4px 0}
  #hzCod{width:100%;box-sizing:border-box;font:600 14px ui-monospace,monospace;background:#121c25;color:#eef3f8;border:1px solid #3a4a5a;border-radius:10px;padding:8px;word-break:break-all}
  #hzCodSt{font:600 15px system-ui,sans-serif}`; document.head.appendChild(s); }
// per la verifica nei test
PH._licLeggi=leggi;
})();
