// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// OPEN GLIDER NETWORK: TRASMETTI LA TUA POSIZIONE (solo app Android, che ha il modulo nativo «Ogn»; altrove non fa niente).
// Chi vola un ultraleggero «basico» non ha FLARM né trasponder: con questa funzione accesa HORIZON manda la posizione ai
// server APRS di OGN, così la vedono gli altri piloti HORIZON e chiunque guardi OGN. NASCE SPENTA: la accende il pilota,
// a terra, dopo aver letto cosa esce dal telefono.
// · Si trasmette SOLO in volo e con il GPS valido, una riga ogni 5 s (3 s in manovra): mai in simulazione o nel volo dimostrativo.
// · Identificativo: 6 cifre esadecimali ricavate dal codice del telefono con un hash (non è il codice, e non dice chi sei).
//   «Anonimo» = solo quello; «Con le marche» = ogni 5 minuti parte anche una riga di stato con le marche del velivolo attivo.
// · Sullo stesso collegamento arrivano gli aeromobili OGN entro 25 km dalla posizione trasmessa: vanno in PH.TRF.tg come
//   gli altri traffici. Il filtro è attorno alla posizione che il pilota ha già scelto di rendere pubblica.
// · Formato delle righe: wiki.glidernet.org, pagine «aprs-interaction-examples» e «ogn-flavoured-aprs».
// DA CONFERMARE CON OGN prima di accenderla per tutti: nome di destinazione (TOCALL), tipo di indirizzo, passcode.
(function(){
'use strict';
const P=(typeof PH!=='undefined'&&PH)||{};               // in Node (prove) lo strumento non c'è: restano le funzioni pure
const K={
  PFX:'OGN',                 // prefisso del nome: come nell'esempio di OGN per un dispositivo che non è ICAO né FLARM
  TOCALL:'OGNAPP',           // destinazione: quella dell'esempio; OGN ne assegna una per ogni applicazione (da chiedere)
  ADDR:3,                    // tipo di indirizzo nel campo id: 0 sconosciuto, 1 ICAO, 2 FLARM, 3 OGN
  APP:'HORIZON',
  FILTRO_KM:25,              // traffico ricevuto: raggio attorno alla posizione trasmessa
  T_NORM:5000, T_MANOVRA:3000,   // ms tra due righe: OGN chiede di non mandare ogni secondo, i ricevitori fanno 5 s in media
  T_VISIBILE:15000,          // senza una riga partita da più di 15 s non sei visibile
  T_STATO:300000,            // riga con le marche: ogni 5 minuti, come chiede OGN per i dati che non cambiano
  DDB:'ddb.glidernet.org', LIVE:'live.glidernet.org'
};
// simboli APRS per tipo di aeromobile (tabella di OGN): tabella + simbolo
const ICONE=['/z',"/'","/'",'/X','/g','\\^','/g','/g','\\^','/^','/z','/O','/O',"/'",'/z','\\n'];
// tipi che il pilota può scegliere (numeri della tabella FLARM usata da OGN: non c'è una voce «ultraleggero»)
const TIPI=[[8,'Ultraleggero o aereo a motore'],[1,'Aliante o motoaliante'],[3,'Elicottero o autogiro'],[6,'Deltaplano, anche a motore'],[7,'Parapendio o paramotore'],[11,'Mongolfiera']];
const pad=(n,l)=>String(Math.abs(Math.trunc(n))).padStart(l,'0');
const lim=(v,a,b)=>Math.max(a,Math.min(b,v));
const ora6=d=>pad(d.getUTCHours(),2)+pad(d.getUTCMinutes(),2)+pad(d.getUTCSeconds(),2);

// passcode APRS-IS: l'algoritmo pubblico (hash a 15 bit del nome, fino al trattino)
P.ognPass=function(nome){ const c=String(nome||'').toUpperCase().split('-')[0]; let h=0x73e2;
  for(let i=0;i<c.length;i+=2){ h^=c.charCodeAt(i)<<8; if(i+1<c.length) h^=c.charCodeAt(i+1); }
  return h&0x7fff; };
// identificativo: FNV-1a del codice del telefono, ripiegato a 24 bit. Non si torna indietro al codice.
P.ognId=function(dev){ const s='horizon-ogn|'+String(dev||''); let h=0x811c9dc5;
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i)&0xff; h=Math.imul(h,0x01000193)>>>0; }
  let v=((h>>>8)^((h&0xff)<<16))&0xffffff; if(v===0||v===0xffffff) v=0x5a5a5a;
  return v.toString(16).toUpperCase().padStart(6,'0'); };
// Riga di posizione. stato: {id, tipo, lat, lon, trk (gradi), gs (km/h), alt (ft AMSL), vs (m/s), acc (m), accV (m), rot (°/s), fl (ft, quota-pressione)}.
// Gradi e minuti con due decimali come vuole APRS; la terza cifra dei minuti va in !Wxy! (x latitudine, y longitudine).
P.ognRiga=function(st,ora){
  if(!st) return null;
  const id=String(st.id||'').toUpperCase(), lat=+st.lat, lon=+st.lon, d=new Date(ora==null?Date.now():ora);
  if(!/^[0-9A-F]{6}$/.test(id) || !(Math.abs(lat)<=90) || !(Math.abs(lon)<=180) || isNaN(d)) return null;
  const tipo=(st.tipo==null?8:+st.tipo)&15, ic=ICONE[tipo];
  const la=Math.round(Math.abs(lat)*60000), lo=Math.round(Math.abs(lon)*60000);          // millesimi di minuto, interi: mai «60.00»
  const gm=(v,n)=>pad(Math.floor(v/60000),n)+pad(Math.floor(v%60000/1000),2)+'.'+pad(Math.floor(v%1000/10),2);
  const trk=((Math.round(+st.trk||0)%360)+360)%360, kt=lim(Math.round((+st.gs||0)/1.852),0,999);
  const ft=lim(Math.round(+st.alt||0),-99999,999999), fpm=lim(Math.round((+st.vs||0)*196.8504),-9999,9999);
  let r=`${K.PFX}${id}>${K.TOCALL}:/${ora6(d)}h${gm(la,2)}${lat<0?'S':'N'}${ic[0]}${gm(lo,3)}${lon<0?'W':'E'}${ic[1]}${pad(trk,3)}/${pad(kt,3)}`+
    `/A=${ft<0?'-'+pad(ft,5):pad(ft,6)} !W${la%10}${lo%10}! id${((tipo<<2)|K.ADDR).toString(16).toUpperCase().padStart(2,'0')}${id} ${fpm<0?'-':'+'}${pad(fpm,3)}fpm`;
  if(st.rot!=null && isFinite(st.rot)){ const q=lim(+st.rot/3,-99.9,99.9); r+=` ${q<0?'-':'+'}${Math.abs(q).toFixed(1)}rot`; }   // 1 rot = mezzo giro al minuto
  if(st.fl!=null && isFinite(st.fl)){ const f=lim(+st.fl/100,0,999.99); r+=` FL${f.toFixed(2).padStart(6,'0')}`; }
  if(+st.acc>0 && isFinite(+st.acc)) r+=` gps${lim(Math.round(+st.acc),1,99)}x${lim(Math.round(st.accV!=null?+st.accV:+st.acc*1.5),1,99)}`;   // il verticale, se il GPS non lo dice, è stimato una volta e mezza
  return r; };
// Riga di stato con le marche (solo se il pilota ha scelto «con le marche»).
P.ognStato=function(id,reg,vers,ora){
  id=String(id||'').toUpperCase(); reg=String(reg||'').toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,9);
  if(!/^[0-9A-F]{6}$/.test(id) || reg.length<3) return null;
  const v=String(vers||'').replace(/[^0-9A-Za-z.]/g,'').slice(0,12);
  return `${K.PFX}${id}>${K.TOCALL}:>${ora6(new Date(ora==null?Date.now():ora))}h Reg=${reg} Soft=${K.APP}${v?'-'+v:''}`; };
// Riga ricevuta → traffico nel formato dello strumento, oppure null (segni di vita, ricevitori, stato, «no tracking»).
// t = ora scritta nella riga (ms); l'età la decide chi chiama, che conosce lo scarto dell'orologio del telefono.
const RE_POS=/^\/(\d\d)(\d\d)(\d\d)h(\d\d)(\d\d\.\d\d)([NS])(.)(\d{3})(\d\d\.\d\d)([EW])(.)(?:(\d{3})\/(\d{3}))?(?:\/A=(-?\d{5,6}))?/;
P.ognParse=function(riga,adesso){
  riga=String(riga||''); if(!riga || riga[0]==='#' || riga.length>400) return null;
  const i=riga.indexOf(':'); if(i<3) return null;
  const m=RE_POS.exec(riga.slice(i+1)); if(!m) return null;
  const com=riga.slice(i+1+m[0].length), mi=/\bid([0-9A-F]{2})([0-9A-F]{6})\b/i.exec(com); if(!mi) return null;   // senza id è un ricevitore a terra
  const fl=parseInt(mi[1],16); if(fl&0xc0) return null;                                  // «stealth» o «no tracking»: non si mostra mai
  const w=/!W(\d)(\d)!/.exec(com), vf=/([+-]\d{1,5})fpm/.exec(com);
  let lat=+m[4]+(+m[5]+(w?+w[1]/1000:0))/60, lon=+m[8]+(+m[9]+(w?+w[2]/1000:0))/60;
  if(m[6]==='S') lat=-lat; if(m[10]==='W') lon=-lon;
  if(!(Math.abs(lat)<=90) || !(Math.abs(lon)<=180)) return null;
  const now=adesso==null?Date.now():+adesso, d=new Date(now);
  let t=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),+m[1],+m[2],+m[3]);
  if(t-now>43200000) t-=86400000; else if(now-t>43200000) t+=86400000;                   // a cavallo della mezzanotte UTC
  const addr=mi[2].toUpperCase(), kt=m[13]!=null?+m[13]:0;
  return {id:'O'+addr, addr, reg:'', cn:'', lat, lon, altM:m[14]!=null?+m[14]*0.3048:NaN, trk:m[12]!=null?+m[12]%360:0, kmh:kt*1.852,
    vz:vf?+vf[1]*0.00508:0, t0:Math.min(t,now), t, ground:false, src:'OGN', type:(fl>>2)&15, tcp:true}; };
P.OGN_K=K;
if(typeof module!=='undefined' && module.exports) module.exports=P;

// ---- da qui in giù solo nell'app con il modulo nativo ----
if(typeof window==='undefined' || typeof PH==='undefined' || !PH) return;
const C=window.Capacitor;
if(!C || !C.isPluginAvailable || !C.isPluginAvailable('Ogn')) return;
const G=C.Plugins.Ogn, KEY='ia517p_ogn', esc=PH.esc||(x=>String(x??'').replace(/[<&>"']/g,''));
// on: acceso; ok: il pilota ha letto e accettato (una volta); ident: 'anon' o 'reg'; tipo: tabella TIPI
const O=PH.ogn={cfg:Object.assign({on:false,ok:false,ident:'anon',tipo:8},lsGet(KEY,{})), st:{}, id:lsGet('ia517p_ogn_id',null), tx:0, txOk:0, nTx:0, nRx:0, err:'', rot:0, skew:0};
const salva=()=>lsSet(KEY,O.cfg);
// l'identificativo si calcola una volta, quando licenza.js ha il codice del telefono, e poi resta quello
function mioId(){ if(O.id && /^[0-9A-F]{6}$/.test(O.id)) return O.id;
  const dev=window.IA517_LIC&&window.IA517_LIC.dev; if(!dev) return null;
  O.id=P.ognId(dev); lsSet('ia517p_ogn_id',O.id); return O.id; }
const marche=()=>String(PH.ac&&PH.ac.reg||'').toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,9);
const gpsOk=()=>!!S.gpsReal && !lost('gps') && !PH.demo && !PH.sim && !S.auto;         // mai una posizione finta su OGN
const inVolo=()=>gpsOk() && !!(PH.inVolo?PH.inVolo():PH.flight);
const acceso=()=>O.cfg.on && O.cfg.ok;

// visibile = acceso, in volo, e una riga partita verso OGN negli ultimi 15 s
PH.ognVisibile=function(){
  const now=Date.now();
  if(!acceso()) return {ok:false,perche:'spento'};
  if(PH.demo || PH.sim || S.auto) return {ok:false,perche:'simulazione'};
  if(!S.gpsReal || lost('gps')) return {ok:false,perche:'senza GPS'};
  if(!inVolo()) return {ok:false,perche:'a terra'};
  if(now-O.txOk<K.T_VISIBILE) return {ok:true,perche:''};
  if(!navigator.onLine) return {ok:false,perche:'senza rete'};
  if(O.st.collegato && O.st.verificato===false && O.st.errore) return {ok:false,perche:'identificativo non accettato da OGN'};
  return {ok:false,perche:O.st.collegato?'in collegamento':'non collegato'};
};
function avvia(){ const id=mioId(); if(!id) return; const u=K.PFX+id;
  G.avvia({utente:u,passcode:String(P.ognPass(u)),app:K.APP,versione:String((PH.version&&PH.version().version)||'0'),filtroKm:K.FILTRO_KM})
    .then(s=>{ if(s) O.st=s; }).catch(e=>{ O.err=String(e&&e.message||e).slice(0,60); }); }
function ferma(){ O.voluto=false; try{ const r=G.stop(); if(r&&r.catch) r.catch(()=>{}); }catch(e){} }
function manda(riga,poi){ if(!riga) return;
  try{ G.invia({riga}).then(()=>{ O.nTx++; O.err=''; poi&&poi(); }).catch(e=>{ O.err=String(e&&e.message||e).slice(0,60); }); }catch(e){ O.err='invio'; } }
function tick(){
  const now=Date.now(), volo=inVolo(), on=acceso() && !!mioId();
  if(volo) O.tVolo=now;
  // velocità di virata dalla traccia, per sapere se si è in manovra
  if(S.trk!=null && O.trkT){ const dt=(now-O.trkT)/1000, dv=((S.trk-O.trk)%360+540)%360-180; if(dt>0.3 && dt<3) O.rot=O.rot*0.5+(dv/dt)*0.5; else O.rot=0; }
  O.trk=S.trk; O.trkT=now;
  // il collegamento si apre quando ci si muove e si chiude 2 minuti dopo il volo: a terra fermi non consuma niente
  const serve=on && (volo || (gpsOk() && (+S.gs||0)>15) || now-(O.tVolo||0)<120000);
  if(serve){ O.voluto=true; if(!O.st.attivo && now-(O.tAvvia||0)>10000){ O.tAvvia=now; avvia(); } }
  else if(O.voluto || O.st.attivo){ O.st=Object.assign({},O.st,{attivo:false,collegato:false}); ferma(); }
  if(!(on && volo && O.st.collegato && O.st.verificato)) return;
  const per=(Math.abs(O.rot)>5 || Math.abs(+S.vs||0)>4)?K.T_MANOVRA:K.T_NORM;
  if(now-O.tx>=per){ O.tx=now;
    let fl=null; try{ if(PH.baroFresh && PH.baroFresh() && PH.baro.p>300) fl=44330.77*(1-Math.pow(PH.baro.p/1013.25,0.190263))/0.3048; }catch(e){}
    manda(P.ognRiga({id:O.id,tipo:O.cfg.tipo,lat:S.lat,lon:S.lon,trk:S.trk!=null?S.trk:S.hdg,gs:S.gs,alt:S.alt,vs:S.vs,acc:PH.acc,rot:O.rot,fl},now),()=>{ O.txOk=Date.now(); });
  } else if(O.cfg.ident==='reg' && now-(O.tStato||0)>K.T_STATO && now-O.tx>1500 && per-(now-O.tx)>1500){   // tra due posizioni: il modulo accetta una riga al secondo
    O.tStato=now; manda(P.ognStato(O.id,marche(),PH.version&&PH.version().version,now)); }
}
setInterval(()=>{ try{ tick(); }catch(e){ PH.logErr&&PH.logErr('ogn: '+e); } },1000);

// ---- traffico ricevuto ----
// lo stesso aereo arrivato anche da internet: resta la posizione più fresca. Per indirizzo quando c'è; altrimenti (su
// live.glidernet.org chi non è registrato ha un nome del giorno) solo se posizione, quota, traccia e velocità coincidono.
PH.ognDedup=function(){
  const T=PH.TRF, now=Date.now(), mio=[...T.tg.values()].filter(t=>t.tcp && now-t.t0<30000); if(!mio.length) return;
  for(const o of [...T.tg.values()]){ if(o.tcp || (o.src!=='OGN' && o.src!=='ADS-B')) continue;
    for(const t of mio){
      let same=!!o.addr && PH.trfNorm(o.addr)===t.addr;
      if(!same && o.src==='OGN'){ const dt=(o.t0-t.t0)/1000, v=t.kmh/3.6, b=t.trk*Math.PI/180;      // la mia posizione portata all'ora dell'altra
        const dx=(o.lon-t.lon)*111320*Math.cos(t.lat*Math.PI/180)-Math.sin(b)*v*dt, dy=(o.lat-t.lat)*110540-Math.cos(b)*v*dt;
        same=Math.abs(dt)<60 && Math.hypot(dx,dy)<150 && Math.abs(o.altM-(t.altM+t.vz*dt))<60 && Math.abs(o.kmh-t.kmh)<15 && (t.kmh<25 || Math.abs(((o.trk-t.trk)%360+540)%360-180)<20); }
      if(same){ if(o.t0>t.t0+2000 && o.addr){ T.tg.delete(t.id); } else T.tg.delete(o.id); break; } } }
};
function ricevi(ev){
  const txt=ev&&(ev.righe||ev.riga); if(!txt || !acceso() || !PH.TRF.on) return;
  if(PH.gdlLive && PH.gdlLive()) return;                 // SafeSky sta già dando tutto, OGN compreso: niente doppioni
  const T=PH.TRF, now=Date.now(), id=mioId();
  for(const r of String(txt).split('\n')){
    const t=P.ognParse(r,now); if(!t || t.addr===id) continue;                            // il proprio aereo non è traffico
    // orologio del telefono sbagliato: lo scarto più piccolo visto dice di quanto, e si toglie
    const eta=(now-t.t)/1000; O.skew=O.nRx?Math.min(O.skew+0.02,eta):eta; O.nRx++;
    const e=Math.max(0,eta-(Math.abs(O.skew)>30?O.skew:Math.min(0,O.skew))); if(e>120) continue;
    t.t0=now-e*1000; delete t.t;
    const old=T.tg.get(t.id); if(old && old.t0>t.t0) continue;
    T.tg.set(t.id,t); }
  PH.ognDedup();
}
try{ const a=G.addListener('stato',s=>{ O.st=s||{}; }); if(a&&a.catch) a.catch(()=>{});
     const b=G.addListener('riga',ev=>{ try{ ricevi(ev); }catch(e){ PH.logErr&&PH.logErr('ogn: '+e); } }); if(b&&b.catch) b.catch(()=>{}); }catch(e){}
{ const prev=PH.trfFetch; if(prev) PH.trfFetch=async function(){ const r=await prev.apply(this,arguments); try{ PH.ognDedup(); }catch(e){} return r; }; }
{ const prev=PH.trfIsMe; if(prev) PH.trfIsMe=function(t){ try{ if(O.id && t && PH.trfNorm(t.addr)===O.id) return true; }catch(e){} return prev.apply(this,arguments); }; }

// ---- a schermo ----
// riga di stato: in volo «OGN ↑» verde se visibile, «NO OGN» rosso se acceso ma non visibile; a terra niente
{ const prev=PH.statoHtml; if(prev) PH.statoHtml=function(){ let h=prev.apply(this,arguments);
    try{ if(acceso()){ const v=PH.ognVisibile(); if(v.ok) h+='<i class="o hz-ogn">OGN ↑</i>'; else if(v.perche!=='a terra' && v.perche!=='simulazione') h+='<i class="b hz-ogn">NO OGN</i>'; } }catch(e){}
    return h; }; }
const segno=()=>{ const v=PH.ognVisibile(); return v.ok?'<b style="color:#3ddc84">VISIBILE SU OGN</b>':`<b style="color:${acceso()&&v.perche!=='a terra'?'#ff6b6b':'#ffc531'}">NON VISIBILE SU OGN</b> · ${esc(v.perche)}`; };
// pagina TRAFFICO: la riga in cima
{ const prev=PH.trfPage; if(prev) PH.trfPage=function(){ const r=prev.apply(this,arguments);
    try{ const i=document.getElementById('phTrfInfo'), s=document.getElementById('phTrf'); if(i && s && !s.hidden && !PH.demo) i.insertAdjacentHTML('afterbegin',`<p class="hz-ognp">${segno()}</p>`); }catch(e){}
    return r; }; }

// ---- impostazioni: «Trasmetti la posizione (OGN)» ----
const TXT=`<b>Cosa esce dal telefono</b>: posizione, quota, velocità, traccia e rateo di salita, ogni 5 secondi, solo in volo, con una sigla di 6 cifre che non dice chi sei (e le marche, se scegli «con le marche»).
  <b>Chi lo vede</b>: chiunque guardi la Open Glider Network (${K.LIVE}, altre app e siti), anche dopo il volo: i dati restano pubblici.
  <b>Non è un anticollisione</b>: gli altri ti vedono solo se guardano OGN e con qualche secondo di ritardo; serve la rete del telefono, che in valle e in quota può mancare. Guarda sempre fuori.
  Consuma un po' di batteria e pochi dati (circa 1 MB l'ora).`;
function statoTxt(){ const s=O.st, id=mioId();
  return `${segno()}<br>Collegamento: ${s.collegato?(s.verificato?'collegato'+(s.server?' ('+esc(s.server)+')':''):'collegato, in attesa del server'):(s.attivo?'in collegamento…':'chiuso')}${s.errore?' · '+esc(s.errore):''}${O.err&&O.err!=='troppo presto'?' · '+esc(O.err):''} · righe inviate ${O.nTx}, ricevute ${O.nRx}<br>La tua sigla OGN: <b>${id?K.PFX+id:'non ancora pronta'}</b>`; }
function html(){ const c=O.cfg, reg=marche();
  return `<section id="hzOgn"><h3>Trasmetti la posizione (OGN)</h3>
    <label class="ph-chk"><input type="checkbox" id="hzOgnOn" ${acceso()?'checked':''}> Trasmetti la mia posizione sulla rete Open Glider Network quando sono in volo</label>
    <p class="ph-sub">${TXT}</p>
    <div class="ph-btns"><label class="ph-fld">Come ti vedono<select id="hzOgnId"><option value="anon" ${c.ident!=='reg'?'selected':''}>Anonimo (solo la sigla)</option><option value="reg" ${c.ident==='reg'?'selected':''}>Con le marche${reg?' ('+esc(reg)+')':''}</option></select></label>
      <label class="ph-fld">Tipo di aeromobile<select id="hzOgnTipo">${TIPI.map(([n,t])=>`<option value="${n}" ${+c.tipo===n?'selected':''}>${t}</option>`).join('')}</select></label></div>
    <p class="ph-sub" id="hzOgnSt">${statoTxt()}</p>
    <p class="ph-sub">«Con le marche»: le marche del velivolo attivo partono ogni 5 minuti insieme alla posizione. Perché compaiano anche su ${K.LIVE} la sigla va registrata dal pilota su ${K.DDB} (tipo di dispositivo OGN). Funzione in prova, in attesa dell'accordo con OGN.</p>
    </section>`; }
// la prima accensione chiede conferma, a terra; le volte dopo basta l'interruttore
function chiedi(si,no){
  const o=document.createElement('div'); o.id='hzOgnAsk';
  o.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;padding:16px';
  o.innerHTML=`<div style="max-width:520px;max-height:90vh;overflow:auto;background:#101b28;border:2px solid #ffc531;border-radius:14px;padding:16px;color:#e8eef4;font:500 15px/1.45 system-ui,sans-serif">
    <h3 style="margin:0 0 8px;font-size:18px">Trasmettere la posizione su OGN?</h3><p style="margin:0 0 12px">${TXT.replace(/\n\s*/g,'<br><br>')}</p>
    <div class="ph-btns"><button type="button" class="ph-btn" id="hzOgnSi">ACCETTO E ACCENDO</button><button type="button" class="ph-btn" id="hzOgnNo">ANNULLA</button></div></div>`;
  document.body.appendChild(o);
  o.querySelector('#hzOgnSi').onclick=()=>{ o.remove(); si(); };
  o.querySelector('#hzOgnNo').onclick=()=>{ o.remove(); no(); };
}
function wire(sec){
  sec.querySelector('#hzOgnOn').onchange=e=>{ const cb=e.target;
    if(!cb.checked){ O.cfg.on=false; salva(); PH.act&&PH.act('ogn spento'); return; }
    if(O.cfg.ok){ O.cfg.on=true; salva(); PH.act&&PH.act('ogn acceso'); return; }
    cb.checked=false;
    if(PH_air()){ toast('LA PRIMA VOLTA SI ACCENDE A TERRA'); return; }                   // mai domande in volo
    chiedi(()=>{ O.cfg.ok=true; O.cfg.on=true; O.cfg.okT=Date.now(); salva(); cb.checked=true; PH.act&&PH.act('ogn acceso'); },()=>{}); };
  sec.querySelector('#hzOgnId').onchange=e=>{ O.cfg.ident=e.target.value==='reg'?'reg':'anon'; O.tStato=0; salva(); };
  sec.querySelector('#hzOgnTipo').onchange=e=>{ O.cfg.tipo=(+e.target.value||8)&15; salva(); }; }
{ const orig=PH.renderImp; PH.renderImp=function(){ orig.apply(this,arguments);
    try{ const box=document.getElementById('phImpBody'); if(!box) return;
      const t=document.createElement('div'); t.innerHTML=html(); const sec=t.firstElementChild;
      const trf=[...box.querySelectorAll(':scope > section')].find(s=>/^Traffico/.test(s.dataset.t||s.textContent.trim().slice(0,30)));
      if(trf) trf.after(sec); else box.appendChild(sec);
      // stesse sezioni pieghevoli delle altre impostazioni (chiusa di partenza)
      const h=sec.querySelector('h3'), b=document.createElement('div'); b.className='hz-sb'; while(h.nextSibling) b.appendChild(h.nextSibling); sec.appendChild(b);
      sec.dataset.t='Trasmetti la posizione (OGN)'; h.classList.add('hz-sh'); h.onclick=()=>sec.classList.toggle('hz-open'); if(O.impOpen) sec.classList.add('hz-open');
      h.addEventListener('click',()=>{ O.impOpen=sec.classList.contains('hz-open'); });
      wire(sec); }catch(e){ PH.logErr&&PH.logErr('ogn: '+e); } }; }
// solo la riga dello stato si aggiorna da sola: rifare tutta la sezione chiuderebbe le scelte mentre si toccano
setInterval(()=>{ try{ const imp=document.getElementById('phImp'), p=document.getElementById('hzOgnSt'); if(p && imp && !imp.hidden) p.innerHTML=statoTxt(); }catch(e){} },2000);
{ const s=document.createElement('style'); s.textContent='body.ph-simple .hz-ogn{display:none}.hz-ognp{margin:0 0 6px;font:700 14px system-ui,sans-serif}'; document.head.appendChild(s); }
})();
