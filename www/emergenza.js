// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// EMERGENZA E PLANATA VERA.
// · Zona di planata: in 36 direzioni l'aereo scende con l'efficienza del velivolo, corretta con il vento (in favore va più
//   lontano, contro meno) e con il 25% di margine, finché non arriva a 200 ft dal terreno vero: ne esce una forma, non un
//   cerchio. Sostituisce il cerchio fisso sulla mappa.
// · Campi raggiungibili: per ogni campo vicino si controlla il terreno lungo la strada e la quota di arrivo, con almeno
//   500 ft sul campo per il circuito; il migliore è quello con più margine (con un vantaggio per le piste conosciute).
// · EMERGENZA (tasto SOS accanto a LIVELLA o ALTRO › EMERGENZA, da TENERE PREMUTO: in turbolenza un tocco per sbaglio
//   non la attiva): DIRECT TO sul campo migliore, voce, barra rossa sullo strumento con margine e distanza aggiornati,
//   pagina con gli altri campi raggiungibili, MAYDAY già compilato, 7700 e 121.500, check list d'emergenza.
// · Prati raggiungibili (atterraggi.js, dati OpenStreetMap): sotto i campi, mai prima di un campo vero raggiungibile.
// La planata è una stima: vale sempre il giudizio del pilota e il manuale del velivolo.
(function(){
'use strict';
const FT=0.3048, CLR=200*FT, ARR=500*FT, MARG=0.75, STEP=150, MAXD=45000;
const esc=x=>String(x??'').replace(/[<&>"]/g,c=>({'<':'&lt;','&':'&amp;','>':'&gt;','"':'&quot;'}[c]));
const SETT=['nord','nord-est','est','sud-est','sud','sud-ovest','ovest','nord-ovest'];

// ---- modello di planata ----
function par(){
  const a=PH.ac||{}, n=k=>PH.acNum?PH.acNum(a,k):null;
  const g=AC_.glide||n('glide')||0, vg=n('vglide')||AC_.vapp||80;
  return {g:g||8, gNote:!g, tas:Math.max(15,vg/3.6)};
}
// velocità al suolo lungo la direzione th (rad), col vento (WIND.E/N: verso cui soffia, m/s)
function gsAlong(th,tas){
  if(!WIND.valid) return tas;
  const ux=Math.sin(th), uy=Math.cos(th), wp=WIND.E*ux+WIND.N*uy, wx=WIND.E*uy-WIND.N*ux;
  return Math.max(3,Math.sqrt(Math.max(1,tas*tas-wx*wx))+wp);
}
// terreno grezzo: terrain() in più spiana i campi per la vista e per farlo scorre i campi vicini a ogni punto (era lo scatto della zona)
const ter=(E,N)=>{ const z=terrainRaw(E,N); return z===z?Math.max(0,z):NaN; };
// fin dove arriva la planata in direzione th, partendo da ac (ENU) a quota alt (m)
const kx=()=>Math.cos(S.lat*D2R)/Math.cos(ORIGIN.lat*D2R);      // metri veri per metro E di enu(): la scala est-ovest di enu() è quella dell'origine
function raggio(ac,alt,th,P){
  const k=P.g*MARG*gsAlong(th,P.tas)/P.tas, ux=Math.sin(th)/kx(), uy=Math.cos(th); let last=ter(ac.E,ac.N); if(last!==last) last=0;
  for(let d=STEP; d<=MAXD; d+=STEP){ const h=alt-d/k, z=ter(ac.E+ux*d,ac.N+uy*d); const zz=z===z?z:last; last=zz;
    if(h<zz+CLR) return Math.max(0,d-STEP/2); }
  return MAXD;
}
// arrivo su un campo: quota sul campo all'arrivo (m) e se il terreno lungo la strada lo permette
function arrivo(ac,alt,f,P){
  const dx=f.E-ac.E, dy=f.N-ac.N, d=Math.hypot(dx*kx(),dy), th=Math.atan2(dx*kx(),dy), k=P.g*MARG*gsAlong(th,P.tas)/P.tas;   // distanza e prua vere
  let ok=true, last=ter(ac.E,ac.N); if(last!==last) last=0;
  for(let s=STEP; s<d-300; s+=STEP){ const h=alt-s/k, z=ter(ac.E+dx*s/d,ac.N+dy*s/d), zz=z===z?z:last; last=zz; if(h<zz+CLR){ ok=false; break; } }
  const sopra=alt-d/k-(f.elev||0);
  return {d,brg:(th*180/Math.PI+360)%360,sopra,ok:ok&&sopra>=ARR,marg:(sopra-ARR)/FT};
}
function stato(){
  if(!(S.gpsReal||PH.sim||PH.demo)) return null;
  if(!PH.sim && !PH.demo && lost('gps')) return null;               // GPS perso: niente planata calcolata da posizione e quota ferme
  const ac=enu(S.lat,S.lon), alt=S.alt*FT2M, zt=terrain(ac.E,ac.N), z0=zt===zt?Math.max(0,zt):NaN, P=par();   // un punto solo: qui resta il terreno di sempre
  return {ac,alt,agl:z0===z0?alt-z0:null,P};
}
// zona raggiungibile (poligono in ENU), ricalcolata al massimo ogni 1,5 s o se ci si sposta di 300 m.
// Il calcolo è spezzato: pochi raggi per chiamata (circa 3 ms), così nessun fotogramma si allunga; intanto vale la zona di prima.
// subito=true: tutta in una volta (per chi non è chiamato a ogni fotogramma).
let Z=null, J=null;
const vale=(s,now,ms,m)=>Z && now-Z.t<ms && Math.hypot(Z.ac.E-s.ac.E,Z.ac.N-s.ac.N)<m && Math.abs(Z.alt-s.alt)<m/10;
PH.glideZone=function(subito){
  const s=stato(); if(!s||s.agl==null||s.agl<60){ J=null; return null; }
  const now=performance.now();
  if(vale(s,now,1500,300)) return Z;
  if(!J) J={t:now,s,q:kx(),pts:[]};
  const p=J.pts, a=J.s;
  while(p.length<36){ const th=p.length*10*Math.PI/180, r=raggio(a.ac,a.alt,th,a.P); p.push({E:a.ac.E+Math.sin(th)*r/J.q,N:a.ac.N+Math.cos(th)*r,r});
    if(!subito && !(p.length&1) && performance.now()-now>3) break; }
  if(p.length<36) return vale(s,now,8000,1500)?Z:null;            // zona vecchia solo se ancora vicina al vero
  let max=0; for(const q of p) if(q.r>max) max=q.r;
  Z={t:J.t,ac:a.ac,alt:a.alt,pts:p,P:a.P,max}; J=null; return Z;
};
// arrivo su un punto qualsiasi {E,N,elev} con le stesse regole dei campi (lo usa atterraggi.js per i prati)
PH.glideArr=function(p){ const s=stato(); return s?arrivo(s.ac,s.alt,p,s.P):null; };
// campi in ordine di convenienza: prima i raggiungibili (più margine, piste conosciute), poi i più vicini
// L'elenco vale 1 s: barra, pagina e avvio dell'emergenza chiedono la stessa cosa nello stesso momento.
let GF=null, A1=null;
PH.glideFields=function(n){
  const s=stato(); if(!s) return [];
  const now=performance.now();
  if(!(GF && now-GF.t<1000)){
    const lim=Math.min(MAXD,(s.agl||0)*s.P.g*1.6+3000), out=[];
    for(const f of FIELDS){ if(f.kind==='wp'||f.kind==='glac') continue; const d0=Math.hypot(f.E-s.ac.E,f.N-s.ac.N); if(d0>lim) continue;
      const a=arrivo(s.ac,s.alt,f,s.P), rw=f.rw&&f.rw.length?Math.max(...f.rw.map(r=>r.L||0)):0;
      a.f=f; a.rw=rw; a.score=(a.ok?100000:0)+a.marg+(rw>=250?300:0)+(f.kind==='aero'?150:0)-(f.kind==='alti'?400:0)-a.d/50; out.push(a); }
    out.sort((x,y)=>y.score-x.score); GF={t:now,list:out}; }
  return GF.list.slice(0,n||12);
};
// arrivo sul campo scelto: dall'elenco appena calcolato se c'è, altrimenti un conto solo al secondo
function arrivoDi(f){
  const s=stato(); if(!s) return null; const now=performance.now();
  if(GF && now-GF.t<1000){ const a=GF.list.find(x=>x.f===f); if(a) return a; }
  if(A1 && A1.f===f && now-A1.t<1000) return A1.a;
  const a=arrivo(s.ac,s.alt,f,s.P); A1={f,t:now,a}; return a;
}
// prati raggiungibili (atterraggi.js); niente dati o niente modulo: elenco vuoto
function prati(n){ try{ return PH.pratiList?PH.pratiList(n)||[]:[]; }catch(e){ return []; } }
const pratoTx=p=>`${String(Math.round(p.brg)).padStart(3,'0')}° · ${(p.d/1000).toFixed(1).replace('.',',')} km · striscia ${Math.round(p.L/10)*10} m`;

// ---- zona di planata sulla mappa (al posto del cerchio fisso) ----
PH.glideRing=function(toS){
  if(!PH.glideOn||(PH.demo&&!PH.sim&&!PH.emerg)) return;
  const z=PH.glideZone(); if(!z) return;
  const P=z.pts.map(p=>toS(p.E,p.N));
  ctx.save(); ctx.beginPath(); P.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.closePath();
  ctx.fillStyle=PH.emerg?'rgba(120,255,170,.14)':'rgba(120,255,170,.07)'; ctx.fill();
  ctx.strokeStyle='rgba(120,255,170,.9)'; ctx.lineWidth=(PH.emerg?3:2)*k; ctx.setLineDash([3*k,5*k]); ctx.stroke(); ctx.setLineDash([]);
  const top=P.reduce((a,p)=>p.y<a.y?p:a,P[0]);
  ctx.font=font(R*0.038,'700'); ctx.fillStyle='rgba(120,255,170,.95)'; ctx.textAlign='center'; ctx.textBaseline='bottom';
  ctx.fillText('planata fino a '+(z.max/1000).toFixed(1)+' km'+(z.P.gNote?' (efficienza 8, non impostata)':''),top.x,top.y-2);
  // in emergenza: i campi raggiungibili in verde, il scelto più grande
  if(PH.emerg){ for(const a of (PH.emerg.list||[]).slice(0,6)){ if(!a.ok) continue; const q=toS(a.f.E,a.f.N);
      ctx.strokeStyle=a.f===PH.emerg.f?'#ff4d4d':'#19e38a'; ctx.lineWidth=(a.f===PH.emerg.f?4:2.5)*k; ctx.beginPath(); ctx.arc(q.x,q.y,R*(a.f===PH.emerg.f?0.045:0.03),0,7); ctx.stroke(); } }
  ctx.restore();
};

// ---- posizione e MAYDAY ----
function posizione(){
  let best=null; for(const f of FIELDS){ if(f.kind==='wp'||/^campo utente\b/i.test(f.name||'')) continue; const d=distBrg(f,S).d; if(!best||d<best.d) best={f,d}; }
  if(!best||best.d>30000) return `${Math.abs(S.lat).toFixed(2)} ${S.lat>=0?'nord':'sud'} ${Math.abs(S.lon).toFixed(2)} ${S.lon>=0?'est':'ovest'}`;
  if(best.d<1500) return 'sopra '+best.f.name;
  return `${Math.round(best.d/1000)} km a ${SETT[Math.round(distBrg(best.f,S).brg/45)%8]} di ${best.f.name}`;
}
function marche(){ const a=(PH.ac&&PH.ac.reg&&!/XXXX/i.test(PH.ac.reg))?PH.ac:(PH.acs||[]).find(x=>x.reg&&!/XXXX/i.test(x.reg)); return a?String(a.reg).toUpperCase():''; }
function mayday(e){
  const reg=marche(), fon=reg&&PH.sqFon?PH.sqFon(reg):'‹marche›', tipo=(PH.ac&&PH.ac.model)||'ultraleggero';
  const hdg=String(Math.round(((S.trk!=null?S.trk:S.hdg)||0)/10)*10%360).padStart(3,'0');
  const dove=e&&e.f?`atterraggio di emergenza a ${e.f.name}`:'atterraggio fuori campo';
  return `MAYDAY MAYDAY MAYDAY, ${fon}, ${tipo}, piantata motore, ${dove}, ${posizione()}, ${Math.round(S.alt/100)*100} piedi, prua ${hdg}, ‹persone a bordo›`;
}
function fis(){ try{ const L=FIELDS.map(f=>({f,d:distBrg(S,f).d})).sort((a,b)=>a.d-b.d).slice(0,40);
  for(const {f} of L) for(const v of (PH.freqOf?PH.freqOf(f):[])) if(/^(FIC|FIS)/.test(v[0])||/information|informazioni/i.test(v[1])) return v; }catch(e){} return null; }

// ---- modo emergenza ----
PH.emerg=null;
function scegli(f,a){
  PH.emerg.f=f; PH.emerg.a=a;
  directTo(f,Math.round(((f.elev||0)/FT2M+1000)/100)*100);
  PH.say(`Emergenza. ${f.name}: ${(a.d/1000).toFixed(0)} chilometri, prua ${String(Math.round(a.brg)).padStart(3,'0').split('').join(' ')}, ${a.ok?'raggiungibile':'al limite'}`,true);
}
PH.emergStart=function(){
  const list=PH.glideFields(12); PH.emerg={t0:Date.now(),list,f:null,a:null};
  PH.act&&PH.act('EMERGENZA');
  const best=list[0];
  if(best) scegli(best.f,best); else PH.say('Emergenza. Nessun campo vicino nei dati: cerca un prato o un campo ampio controvento',true);
  barra(); PH.emergOpen();
};
PH.emergStop=function(){ PH.emerg=null; const b=document.getElementById('hzEmBar'); if(b) b.hidden=true; const d=document.getElementById('hzEm'); if(d) d.remove(); PH.act&&PH.act('fine emergenza'); };
PH.emergOpen=function(){
  if(!PH.emerg) return;
  let d=document.getElementById('hzEm'); if(d) d.remove();
  d=document.createElement('div'); d.className='ph-sheet'; d.id='hzEm';
  const draw=()=>{ const e=PH.emerg; if(!e){ d.remove(); return; }
    e.list=PH.glideFields(12); const cur=e.f&&e.list.find(x=>x.f===e.f)||e.a;
    const fq=e.f&&PH.freqOf?PH.freqOf(e.f):[], fi=fis(), chk=(PH.acChkPh?PH.acChkPh(PH.ac):[]).findIndex(x=>/emergen|piantata|avaria|motore in volo/i.test(x.t));
    const pr=prati(5), cOk=e.list.some(a=>a.ok);
    const rigaP=p=>`<div class="hz-emp"><b>Prato ${String(Math.round(p.brg)).padStart(3,'0')}° · ${(p.d/1000).toFixed(1).replace('.',',')} km</b><span>striscia ${Math.round(p.L/10)*10} m per ${String(Math.round(p.dir/10)*10%360||360).padStart(3,'0')}° · arrivi con +${Math.round(p.marg/10)*10} ft${p.note?' · '+esc(p.note):''}</span></div>`;
    const riga=a=>`<button type="button" class="hz-emf${a.f===e.f?' sel':''}${a.ok?'':' no'}" data-id="${esc(a.f.id)}"><b>${esc(a.f.name)}</b><span>${String(Math.round(a.brg)).padStart(3,'0')}° · ${(a.d/1000).toFixed(1).replace('.',',')} km · ${a.ok?'arrivi con +'+Math.round(a.marg/10)*10+' ft':'NON raggiungibile'}${a.rw?' · pista '+a.rw+' m':''}</span></button>`;
    d.innerHTML=`<div class="ph-sheet-h hz-emh"><button type="button" id="hzEmB">◀ Strumento</button><b>⚠ EMERGENZA</b></div>
    <div class="ph-imp">
      <section class="hz-emc">${cur&&e.f?`<div class="hz-emt">${esc(e.f.name)}</div><div class="hz-ems">PRUA ${String(Math.round(cur.brg)).padStart(3,'0')}° · ${(cur.d/1000).toFixed(1).replace('.',',')} km · ${cur.ok?'<span class="ok">ARRIVI CON +'+Math.round(cur.marg/10)*10+' ft</span>':'<span class="no">AL LIMITE: VALUTA UN ALTRO CAMPO O UN PRATO</span>'}</div>
        <small>${fq.length?'Frequenza del campo '+esc(Number(fq[0][2]).toFixed(3))+' · ':''}velocità di planata ${Math.round(par().tas*3.6)} km/h · ${par().gNote?'efficienza non impostata: uso 8 (Impostazioni › Velivoli)':'efficienza '+par().g}</small>${PH.ventoHtml&&e.f.ends&&e.f.ends.length?'<div style="margin-top:8px">'+PH.ventoHtml(e.f,PH.ventoAl(e.f),{size:120,inVolo:true})+'</div>':''}`
        :'<div class="hz-emt">Nessun campo raggiungibile nei dati</div><small>Cerca un prato ampio, controvento, senza fili. Tieni la velocità di planata.</small>'}</section>
      <section><h3>MAYDAY (da leggere)</h3><p class="hz-may">«${esc(mayday(e))}»</p>
        <p class="ph-sub">Sulla frequenza in uso, oppure <b>121.500</b>${fi?' o '+esc(fi[1]||'FIS')+' <b>'+esc(Number(fi[2]).toFixed(3))+'</b>':''}. Transponder <b>7700</b>.</p></section>
      <section><h3>Altri campi</h3>${e.list.slice(0,8).map(riga).join('')||'<p class="ph-sub">Nessun campo nei dati entro la planata.</p>'}</section>
      ${pr.length?`<section><h3>Prati raggiungibili · da verificare a vista</h3>${cOk?'<p class="ph-sub">Un campo vero è raggiungibile: viene prima.</p>':''}${pr.map(rigaP).join('')}
        <p class="ph-sub">Indicazione dalle mappe (© OpenStreetMap), <b>non una pista</b>: coltura, fossi, fili, recinti e pendenza vera si vedono solo dall'alto. Striscia e prua di atterraggio sono stimate, controvento se il vento è noto.</p></section>`:(()=>{ try{ const s=PH.pratiStato&&PH.pratiStato(); if(!s) return '';
          // senza prati il pilota deve sapere perché: dati non scaricati, oppure nessun prato adatto
          return `<section><h3>Prati raggiungibili</h3><p class="ph-sub">${s.qui===false?'Nessun dato dei prati per questa zona: si scaricano a terra, con la rete (Impostazioni › Volare senza internet).':(s.n?'Nessun prato adatto entro la planata, secondo le mappe.':'Dati dei prati mai scaricati: si scaricano a terra, con la rete (Impostazioni › Volare senza internet).')}</p></section>`; }catch(x){ return ''; } })()}
      <div class="hz-emb">${chk>=0?'<button type="button" class="ph-btn" id="hzEmChk">Check list di emergenza</button>':''}<button type="button" class="ph-btn" id="hzEmEnd">Fine emergenza</button></div>
      <p class="ph-sub">Stima con l'efficienza del velivolo, il vento e il terreno, con il 25% di margine e 500 ft per il circuito: vale sempre il tuo giudizio.</p>
    </div>`;
    document.getElementById('hzEmB').onclick=()=>{ clearInterval(tm); d.remove(); };
    document.getElementById('hzEmEnd').onclick=()=>{ clearInterval(tm); PH.emergStop(); };
    const c=document.getElementById('hzEmChk'); if(c) c.onclick=()=>{ PH.chkOpen&&PH.chkOpen(chk); };
    d.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{ const a=e.list.find(x=>x.f.id===b.dataset.id); if(a){ scegli(a.f,a); draw(); } }); };
  document.body.appendChild(d); draw();
  const tm=setInterval(()=>{ if(!document.getElementById('hzEm')){ clearInterval(tm); return; } try{ const q=d.querySelector('.ph-imp'), y=q?q.scrollTop:0; draw(); const q2=d.querySelector('.ph-imp'); if(q2) q2.scrollTop=y; }catch(e){} },4000);   // l'aggiornamento non riporta la pagina in cima
};
// barra rossa sullo strumento finché l'emergenza è attiva
function barra(){
  let b=document.getElementById('hzEmBar');
  if(!b){ b=document.createElement('button'); b.type='button'; b.id='hzEmBar'; b.hidden=true; b.onclick=()=>PH.emergOpen();
    const nav=document.querySelector('.ph-side .ph-nav'); if(nav) nav.parentNode.insertBefore(b,nav); else document.body.appendChild(b); }
  const e=PH.emerg; if(!e){ b.hidden=true; return; }
  let t=(!PH.sim&&!PH.demo&&S.gpsReal&&lost('gps'))?'⚠ EMERGENZA · GPS PERSO: distanze non calcolabili':'⚠ EMERGENZA · nessun campo: prato controvento';
  let aOk=false;
  if(e.f){ const a=arrivoDi(e.f); aOk=!!a&&a.ok;
    if(a) t=`⚠ ${e.f.name.toUpperCase()} · ${String(Math.round(a.brg)).padStart(3,'0')}° · ${(a.d/1000).toFixed(1).replace('.',',')} km · ${a.ok?'+'+Math.round(a.marg/10)*10+' ft':'AL LIMITE'}`;
    b.classList.toggle('lim',!!a&&!a.ok); }
  if(!aOk){ const p=prati(1)[0]; if(p) t+=` · PRATO ${pratoTx(p)}, da verificare`; }   // solo se nessun campo vero è raggiungibile
  b.textContent=t+' · tocca'; b.hidden=false;
}
setInterval(()=>{ try{ if(PH.emerg) barra(); }catch(e){} },1500);

// ---- attivazione: tieni premuto ----
function tieni(btn,ms,fn){
  let t=null;
  const via=()=>{ clearTimeout(t); t=null; btn.classList.remove('hold'); };
  btn.addEventListener('pointerdown',ev=>{ ev.preventDefault(); ev.stopPropagation(); btn.classList.add('hold'); btn.style.setProperty('--ms',ms+'ms'); t=setTimeout(()=>{ via(); fn(); },ms); });
  ['pointerup','pointerleave','pointercancel'].forEach(k=>btn.addEventListener(k,()=>{ if(t){ via(); toast('EMERGENZA: TIENI PREMUTO'); } }));
  btn.addEventListener('click',ev=>{ ev.preventDefault(); ev.stopPropagation(); });
}
{ const s=document.createElement('style'); s.textContent=`
  .hz-sos{flex:none;min-height:40px;min-width:64px;padding:0 10px;border-radius:10px;border:3px solid #ff4d4d;background:#2a0c10;color:#ffb3b8;font:800 15px "Oxanium",system-ui,sans-serif;letter-spacing:.06em;position:relative;overflow:hidden;cursor:pointer;margin-left:6px}
  .hz-sos::before,#phMore .hz-emg::before{content:'';position:absolute;inset:0;background:#ff4d4d;transform:scaleX(0);transform-origin:left;opacity:.45}
  .hz-sos.hold::before,#phMore .hz-emg.hold::before{transform:scaleX(1);transition:transform var(--ms,800ms) linear}
  #phMore .ph-more-g button.hz-emg{grid-column:1/-1;border-color:#ff4d4d;color:#ffb3b8;background:#2a0c10;position:relative;overflow:hidden}
  #hzEmBar{display:block;width:100%;min-height:54px;border-radius:12px;border:3px solid #ff4d4d;background:#3a0c12;color:#fff;font:800 17px "Oxanium",system-ui,sans-serif;letter-spacing:.03em;padding:6px 10px;text-align:left}
  #hzEmBar[hidden]{display:none} #hzEmBar.lim{background:#5a3a00;border-color:#ffd21e}
  .hz-emh{background:#3a0c12!important} .hz-emh b{color:#ffb3b8}
  .hz-emc{border-color:#ff4d4d!important} .hz-emt{font:800 28px "Oxanium",system-ui,sans-serif;color:#fff} .hz-ems{font:800 18px "Oxanium",system-ui,sans-serif;color:#e5ecf1}
  .hz-ems .ok{color:#19e38a} .hz-ems .no{color:#ffd21e}
  .hz-may{font:700 18px/1.4 "Oxanium",system-ui,sans-serif;color:#fff;margin:0}
  .hz-emf{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;min-height:64px;padding:8px 12px;margin-bottom:8px;border-radius:12px;border:2px solid #3a4a5a;background:#1b2530;color:#eef3f8;text-align:left}
  .hz-emf b{font:800 18px "Oxanium",system-ui,sans-serif} .hz-emf span{font:600 14px system-ui,sans-serif;color:#9aa4b0}
  .hz-emf.sel{border-color:#ff4d4d} .hz-emf.no b{color:#9aa4b0}
  .hz-emp{display:flex;flex-direction:column;gap:2px;padding:8px 12px;margin-bottom:8px;border-radius:12px;border:2px dashed #3d6a4c;background:#16221b;color:#eef3f8}
  .hz-emp b{font:800 17px "Oxanium",system-ui,sans-serif;color:#bfe8cc} .hz-emp span{font:600 14px system-ui,sans-serif;color:#9aa4b0}
  .hz-emb{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 10px} .hz-emb .ph-btn{min-height:60px;font-size:16px;font-weight:700}`;
  document.head.appendChild(s); }
// tasto SOS accanto a LIVELLA
{ const lv=document.getElementById('phLvl'); if(lv){ const b=document.createElement('button'); b.type='button'; b.className='hz-sos'; b.id='hzSos'; b.textContent='SOS';
    b.setAttribute('aria-label','Emergenza: tieni premuto'); lv.after(b); tieni(b,800,()=>PH.emerg?PH.emergOpen():PH.emergStart()); } }
// ALTRO › EMERGENZA (in cima, su tutta la riga)
{ const g=document.querySelector('#phMore .ph-more-g'); if(g){ const b=document.createElement('button'); b.type='button'; b.className='hz-emg'; b.id='hzEmgBtn'; b.innerHTML='<i>⚠</i>EMERGENZA · tieni premuto';
    g.prepend(b); tieni(b,800,()=>{ PH.moreOpen(false); PH.emerg?PH.emergOpen():PH.emergStart(); }); } }
})();
