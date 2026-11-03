
// ---------------- stato del telefono (batteria, segnale) e traffico in tempo reale ----------------
// Batteria e segnale: dal plugin nativo StatoTelefono (APK); nel browser, dalle funzioni del browser quando ci sono.
// Traffico: OGN (FLARM e tracker OGN, alianti e molti ULM) e adsb.lol (ADS-B e MLAT), dati aperti con licenza ODbL, senza chiavi.
// Sullo strumento compare solo un triangolo di pericolo: traffico entro 1000 ft di lato e in quota, adesso o entro 60 s.
PH.stato={batt:null,carica:null,rete:null,gen:null,pct:null,t:0,busy:false};
if(PH.native) PH.native.stato=(()=>{ try{ const C=window.Capacitor; return (C.Plugins&&C.Plugins.StatoTelefono)||C.registerPlugin('StatoTelefono'); }catch(e){ return null; } })();
PH.statoPoll=async function(){
  const st=PH.stato; if(st.busy) return; st.busy=true;
  try{
    if(PH.native&&PH.native.stato){
      const r=await PH.native.stato.get();
      st.batt=r.batt!=null?+r.batt:null; st.carica=!!r.carica; st.tempC=r.tempC!=null?+r.tempC:null;
      st.rete=r.rete||null; st.gen=r.gen||null; st.pct=r.pct!=null?+r.pct:null; st.internet=r.internet!==false;
    } else {
      if(navigator.getBattery){ if(!st.bm) st.bm=await navigator.getBattery(); st.batt=Math.round(st.bm.level*100); st.carica=!!st.bm.charging; }
      const c=navigator.connection; st.rete=c&&c.type==='wifi'?'WIFI':(c&&c.type==='cellular'?'CELL':null);
      st.gen=c&&c.effectiveType?String(c.effectiveType).toUpperCase().replace('SLOW-',''):null; st.pct=null; st.internet=navigator.onLine;
    }
    st.t=Date.now();
  }catch(e){ st.err=String(e&&e.message||e); }
  finally{ st.busy=false; }
};
// le etichette della riga di stato, al posto di NET
PH.statoHtml=function(){
  const st=PH.stato, on=navigator.onLine && st.internet!==false;
  let net;
  if(!on) net='<i class="b">NO NET</i>';
  else if(st.rete==='WIFI') net='<i class="o">WIFI</i>';
  else if(st.pct!=null) net=`<i class="${st.pct<25?'w':'o'}">${st.gen||'RETE'} ${st.pct}%</i>`;
  else net=`<i class="o">${st.gen||'NET'}</i>`;
  let bat='';
  if(st.batt!=null){ const c=st.carica?'o':(st.batt<20?'b':(st.batt<40?'w':'o')), hot=st.tempC!=null&&st.tempC>=45;
    bat=`<i class="${hot?'b':c}">BATT ${st.batt}%${st.carica?' ⚡':''}${hot?' '+Math.round(st.tempC)+'°C':''}</i>`; }
  return net+bat;
};

// ---- traffico ----
PH.TRF={on:lsGet('ia517p_trf',true), me:String(lsGet('ia517p_trf_me','')||''), rng:+lsGet('ia517p_trf_rng',10)||10,
  tg:new Map(), src:{ogn:{t:0,n:0,err:''},adsb:{t:0,n:0,err:''},gdl:{t:0,n:0,err:''}}, gdlOn:lsGet('ia517p_gdl',true), gdlOk:false, busy:false, last:0, alert:null, ghost:new Map(), ghostAt:new Map(), demo:null};
PH.TRF_LIM=1000*FT2M;                                    // 1000 ft = 305 m, di lato e in quota
PH.TRF_LOOK=60;                                          // secondi di previsione per la rotta di collisione
PH.trfNorm=s=>String(s||'').toUpperCase().replace(/[^0-9A-Z]/g,'');
PH.trfIsMe=function(t){
  const me=PH.trfNorm(PH.TRF.me), reg=PH.trfNorm(PH.ac&&PH.ac.reg);
  if(me && (PH.trfNorm(t.addr)===me || PH.trfNorm(t.reg)===me)) return true;
  if(reg && reg.length>=4 && (PH.trfNorm(t.reg)===reg || PH.trfNorm(t.cn)===reg)) return true;
  return (PH.TRF.ghost.get(t.id)||0)>=3;
};
PH.trfOgn=async function(lat,lon){
  const dLat=0.45, dLon=dLat/Math.max(0.2,Math.cos(lat*D2R));
  const q=`a=0&b=${(lat+dLat).toFixed(4)}&c=${(lat-dLat).toFixed(4)}&d=${(lon+dLon).toFixed(4)}&e=${(lon-dLon).toFixed(4)}`;
  let r; try{ r=await IA517.http('https://live.glidernet.org/lxml.php?'+q); }catch(e){ r=await IA517.http('http://live.glidernet.org/lxml.php?'+q); }
  if(r.status!==200) throw new Error('risposta '+r.status);
  const out=[], now=Date.now(), re=/<m a="([^"]*)"/g; let m;
  while((m=re.exec(r.text))){ const f=m[1].split(','); if(f.length<13) continue;
    const la=+f[0], lo=+f[1], age=Math.abs(+f[6]||0); if(!(la===la&&lo===lo) || age>180) continue;
    out.push({id:'O'+(f[12]||f[3]||f[2]), addr:f[12]||'', reg:f[3]||'', cn:f[2]||'', lat:la, lon:lo, altM:+f[4], trk:+f[7]||0, kmh:+f[8]||0, vz:+f[9]||0,
      t0:now-age*1000, ground:false, src:'OGN', type:+f[10]||0}); }
  return out;
};
PH.trfAdsb=async function(lat,lon){
  const r=await IA517.http(`https://api.adsb.lol/v2/point/${lat.toFixed(4)}/${lon.toFixed(4)}/16`);
  if(r.status!==200) throw new Error('risposta '+r.status);
  const j=JSON.parse(r.text), out=[], now=Date.now();
  for(const a of (j.ac||j.aircraft||[])){
    if(a.lat==null||a.lon==null) continue;
    const ground=a.alt_baro==='ground', alt=a.alt_geom!=null?+a.alt_geom:(ground?null:+a.alt_baro), age=+(a.seen_pos!=null?a.seen_pos:(a.seen||0));
    if(age>180) continue;
    out.push({id:'A'+String(a.hex||'').replace(/^~/,''), addr:String(a.hex||'').replace(/^~/,''), reg:a.r||'', cn:String(a.flight||'').trim(), lat:+a.lat, lon:+a.lon,
      altM:alt!=null?alt*FT2M:NaN, trk:+(a.track!=null?a.track:(a.true_heading||0)), kmh:(+a.gs||0)*1.852, vz:(+(a.geom_rate!=null?a.geom_rate:(a.baro_rate||0)))*0.00508,
      t0:now-age*1000, ground, src:'ADS-B', type:a.category||'', baro:a.alt_geom==null}); }
  return out;
};
PH.trfFetch=async function(){
  const T=PH.TRF; if(T.busy) return; T.busy=true; T.last=Date.now();
  const lat=S.lat, lon=S.lon;
  const one=async(k,fn)=>{ try{ const l=await fn(lat,lon); T.src[k]={t:Date.now(),n:l.length,err:''}; return l; }
    catch(e){ T.src[k]=Object.assign({},T.src[k],{err:String(e&&e.message||e).slice(0,60),te:Date.now()}); return []; } };
  try{
    const [a,b]=await Promise.all([one('ogn',PH.trfOgn),one('adsb',PH.trfAdsb)]);
    const seen=new Set();
    for(const t of [...b,...a]){                         // stesso aereo con ADS-B e FLARM: vale la posizione più fresca
      const dup=[...T.tg.values()].find(o=>o.id!==t.id && o.addr && t.addr && PH.trfNorm(o.addr)===PH.trfNorm(t.addr) && seen.has(o.id));
      if(dup){ if(t.t0>dup.t0){ T.tg.delete(dup.id); seen.delete(dup.id); } else continue; }
      const old=T.tg.get(t.id); if(old && old.t0>t.t0) { seen.add(t.id); continue; }
      T.tg.set(t.id,t); seen.add(t.id); }
  } finally{ T.busy=false; }
};
// SafeSky (Premium, «condivisione del traffico» con un'app GDL90) e SkyEcho, PilotAware, Stratux: messaggi GDL90 su UDP 4000.
// Finché arrivano, il traffico da internet non si scarica: SafeSky lo comprende già (FLARM/OGN, ADS-B, utenti SafeSky).
PH.gdlStart=async function(){
  const T=PH.TRF, G=PH.native&&(PH.native.gdl=PH.native.gdl||(()=>{ try{ const C=window.Capacitor; return (C.Plugins&&C.Plugins.Gdl90)||C.registerPlugin('Gdl90'); }catch(e){ return null; } })());
  if(!G) return;
  if(!T.gdlL){ T.gdlL=true;
    try{ const r=G.addListener('traffico',PH.gdlIn); if(r&&r.catch) r.catch(()=>{}); }catch(e){ T.src.gdl.err='ascolto: '+e.message; } }
  try{ if(T.gdlOn){ await G.start({porta:4000}); T.gdlOk=true; T.src.gdl.err=''; } else { await G.stop(); T.gdlOk=false; } }
  catch(e){ T.gdlOk=false; T.src.gdl.err=String(e&&e.message||e).slice(0,80); }
};
PH.gdlIn=function(o){
  const T=PH.TRF, now=Date.now(); if(!T.gdlOn || !o) return;
  if(o.proprio){ T.gdlOwn={lat:+o.lat,lon:+o.lon,altFt:o.altFt,t:now}; return; }
  const addr=String(o.addr||'').toUpperCase(), id='G'+addr;
  T.tg.delete('A'+addr); T.tg.delete('O'+addr);          // lo stesso aereo arrivato prima da internet
  T.tg.set(id,{id,addr,reg:'',cn:String(o.cs||''),lat:+o.lat,lon:+o.lon,altM:o.altFt!=null?o.altFt*FT2M:NaN,trk:+o.trk||0,
    kmh:o.kt!=null?o.kt*1.852:0,vz:o.fpm!=null?o.fpm*0.00508:0,t0:now,ground:!o.inVolo&&(o.kt||0)<30,src:'SafeSky',type:o.cat});
  T.src.gdl.t=now;
};
PH.gdlLive=()=>PH.TRF.gdlOn && Date.now()-PH.TRF.src.gdl.t<15000;
// traffico finto nel volo dimostrativo: uno di fronte in rotta di collisione, uno di fianco più alto, uno lontano
PH.trfDemo=function(){
  const T=PH.TRF, now=Date.now(), cl=Math.cos(S.lat*D2R), tr=((S.trk!=null)?S.trk:S.hdg)||0;
  const put=(id,dist,brg,dAltFt,trk,kmh,vz,reg)=>{ const b=(tr+brg)*D2R;
    T.tg.set(id,{id,addr:id,reg,cn:'',lat:S.lat+Math.cos(b)*dist/110540,lon:S.lon+Math.sin(b)*dist/(111320*cl),altM:(S.alt+dAltFt)*FT2M,trk:wrap360(tr+trk),kmh,vz,t0:now,ground:false,src:'DEMO'}); };
  if(!T.demo || now-T.demo>120000){ T.demo=now; T.tg.delete('D2'); T.tg.delete('D3');
    put('D2',2500,75,700,0,140,0.5,'D-MXYZ');           // a destra, più alto, parallelo
    put('D3',9000,-130,-1500,40,180,-1,'F-JABC'); }
  // uno arriva di fronte verso di te, quasi alla tua quota; passato, ne riparte un altro dopo un minuto
  const d1=T.tg.get('D1');
  if(!d1 && (!T.demoPass || now-T.demoPass>60000)) put('D1',4500,5,100,180,150,0,'I-DEMO');
  else if(d1){ const dd=distBrg({lat:S.lat,lon:S.lon},{lat:d1.lat,lon:d1.lon});
    const off=Math.abs(((dd.brg-tr)%360+540)%360-180);
    if(dd.d<120 || dd.d>7000 || (off>70 && dd.d>1500)){ T.tg.delete('D1'); T.demoPass=dd.d<1500?now:0; }
    else if(dd.d>800){ d1.trk=wrap360(dd.brg+180); d1.altM=(S.alt+100)*FT2M; } }
  for(const t of T.tg.values()){                         // si muovono con la loro velocità
    const dt=(now-t.t0)/1000; if(dt<=0) continue; const v=t.kmh/3.6, b=t.trk*D2R;
    t.lat+=Math.cos(b)*v*dt/110540; t.lon+=Math.sin(b)*v*dt/(111320*Math.cos(t.lat*D2R)); t.altM+=t.vz*dt; t.t0=now; }
  T.src.ogn={t:now,n:T.tg.size,err:''}; T.src.adsb={t:now,n:0,err:''};
};
// posizione di ogni traffico adesso (proiettata con la sua velocità dall'ultima posizione), distanze e pericolo
PH.trfEval=function(){
  const T=PH.TRF, now=Date.now(), cl=Math.cos(S.lat*D2R), out=[];
  const ownV=(S.gs||0)/3.6, ownB=(((S.trk!=null)?S.trk:S.hdg)||0)*D2R, ovx=Math.sin(ownB)*ownV, ovy=Math.cos(ownB)*ownV, ovz=S.vs||0;
  const air=!!PH.flight || (S.gs||0)>40 || PH.demo, altO=(S.alt||0)*FT2M;
  for(const [id,t] of T.tg){
    const age=(now-t.t0)/1000; if(age>180){ T.tg.delete(id); continue; }
    const pe=Math.min(age,45), v=t.kmh/3.6, b=t.trk*D2R, vx=Math.sin(b)*v, vy=Math.cos(b)*v;
    const x=(t.lon-S.lon)*111320*cl+vx*pe, y=(t.lat-S.lat)*110540+vy*pe, z=t.altM===t.altM?t.altM+t.vz*pe:NaN;
    const d=Math.hypot(x,y), dz=z===z?z-altO:NaN;
    const e={t,x,y,d,dz,age,brg:wrap360(Math.atan2(x,y)/D2R),lvl:0,tc:null};
    // il proprio aereo (FLARM, SafeSky, transponder) visto come traffico: stessa posizione e stessa velocità per 3 volte di fila
    if(!PH.demo && air && T.ghostAt.get(id)!==T.last){ T.ghostAt.set(id,T.last); const g0=T.ghost.get(id)||0;
      const same=d<150 && dz===dz && Math.abs(dz)<60 && Math.abs(((t.trk-(ownB/D2R))%360+540)%360-180)<30 && Math.abs(t.kmh-(S.gs||0))<25;
      if(g0<3) T.ghost.set(id,same?g0+1:0); else if(d>1000) T.ghost.set(id,0); }   // se si allontana non sei tu
    if(PH.trfIsMe(t)){ e.me=true; out.push(e); continue; }
    const grounded=t.ground || t.kmh<25;
    if(air && !grounded && dz===dz && age<=30){
      const rx=vx-ovx, ry=vy-ovy, rz=(t.vz||0)-ovz, vv=rx*rx+ry*ry;
      let tc=vv>0.01?-(x*rx+y*ry)/vv:0; tc=Math.max(0,Math.min(PH.TRF_LOOK,tc));
      const dm=Math.hypot(x+rx*tc,y+ry*tc), dzm=dz+rz*tc, L=PH.TRF_LIM;
      if(d<L && Math.abs(dz)<L){ e.lvl=2; e.tc=0; }
      else if(tc>0 && dm<L && Math.abs(dzm)<L){ e.lvl=tc<=30?2:1; e.tc=tc; }
    }
    out.push(e);
  }
  out.sort((a,b)=>(b.lvl-a.lvl)||(a.d-b.d));
  return out;
};
PH.trfTick=function(){
  const T=PH.TRF; if(!T.on){ T.alert=null; return; }
  const want=PH.demo || (S.gpsReal && navigator.onLine && (PH.flight || (S.gs||0)>40 || !el('phTrf').hidden));
  if(PH.demo) PH.trfDemo();
  else if(want && !PH.gdlLive() && Date.now()-T.last>6000) PH.trfFetch();
  T.src.gdl.n=[...T.tg.values()].filter(t=>t.src==='SafeSky').length;
  if(!PH.demo && T.demo){ T.demo=null; T.tg.clear(); }
  const ev=PH.trfEval(); T.view=ev;
  const a=ev.find(e=>e.lvl>0&&!e.me)||null;
  if(a && !T.alert) PH.act&&PH.act('traffico '+(a.t.reg||a.t.cn||a.t.id)+' '+Math.round(a.d)+' m');
  T.alert=a;
};
PH.trfClock=e=>{ const rel=wrap360(e.brg-(((S.trk!=null)?S.trk:S.hdg)||0)); return Math.round(rel/30)%12||12; };
PH.trfDz=e=>e.dz===e.dz?((e.dz>=0?'+':'−')+Math.round(Math.abs(e.dz)/FT2M/100)*100+' ft'):'quota ?';
// triangolo di pericolo sullo strumento (orizzonte e mappa)
PH.trfDraw=function(){
  const a=PH.TRF.alert; if(!a || !ctx) return;
  const blink=a.lvl>=2 || (Date.now()%1000)<700; if(!blink) return;
  const s=R*0.16, x0=CX+R*0.42, y0=CY-R*0.48, col=a.lvl>=2?'#ff2b2b':'#ffb020';
  ctx.save();
  ctx.beginPath(); ctx.moveTo(x0,y0-s*0.62); ctx.lineTo(x0+s*0.62,y0+s*0.46); ctx.lineTo(x0-s*0.62,y0+s*0.46); ctx.closePath();
  ctx.fillStyle=col; ctx.strokeStyle='#000'; ctx.lineWidth=Math.max(2,s*0.07); ctx.lineJoin='round'; ctx.fill(); ctx.stroke();
  ctx.fillStyle='#000'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font=`900 ${Math.round(s*0.62)}px "Oxanium",system-ui,sans-serif`;
  ctx.fillText('!',x0,y0+s*0.08);
  const txt=`ORE ${PH.trfClock(a)} · ${PH.trfDz(a)}`;
  ctx.font=`700 ${Math.max(10,Math.round(s*0.30))}px "Oxanium",system-ui,sans-serif`;
  const w=ctx.measureText(txt).width+10, ty=y0+s*0.80;
  ctx.fillStyle='rgba(0,0,0,.72)'; ctx.fillRect(x0-w/2,ty-s*0.21,w,s*0.42);
  ctx.fillStyle=col; ctx.fillText(txt,x0,ty);
  ctx.restore();
};

// ---- pagina TRAFFICO ----
PH.trfOpen=function(){
  const bar=el('phTrfBar');
  bar.innerHTML=[5,10,25].map(r=>`<button type="button" data-r="${r}" aria-pressed="${PH.TRF.rng===r}">${r} km</button>`).join('')+
    '<button type="button" id="phTrfSafe">SafeSky ↗</button>';
  bar.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{ PH.TRF.rng=+b.dataset.r; lsSet('ia517p_trf_rng',PH.TRF.rng); bar.querySelectorAll('[data-r]').forEach(x=>x.setAttribute('aria-pressed',x===b)); PH.trfPage(); });
  el('phTrfSafe').onclick=()=>{ const z=PH.TRF.rng<=5?12:(PH.TRF.rng<=10?11:10);
    window.open(`https://live.safesky.app/map?lat=${S.lat.toFixed(5)}&lng=${S.lon.toFixed(5)}&zoom=${z}&metric=feet`,'_blank'); };
  clearInterval(PH.trfT); PH.trfT=setInterval(PH.trfPage,1000); PH.trfTick(); requestAnimationFrame(PH.trfPage); PH.act&&PH.act('traffico');
};
PH.trfClose=function(){ clearInterval(PH.trfT); PH.trfT=null; };
PH.trfPage=function(){
  const cv=el('phTrfCv'); if(!cv || el('phTrf').hidden) return;
  const T=PH.TRF, ev=T.view||[], dpr=devicePixelRatio||1, W=cv.clientWidth, H=cv.clientHeight; if(W<50||H<50) return;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){ cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); }
  const c=cv.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0);
  const cx=W/2, cy=H/2, rr=Math.min(W,H)/2-14, sc=rr/(T.rng*1000), up=(((S.trk!=null)?S.trk:S.hdg)||0)*D2R;
  c.fillStyle='#0b1622'; c.fillRect(0,0,W,H);
  c.strokeStyle='rgba(255,255,255,.14)'; c.lineWidth=1; c.fillStyle='#8a96a3'; c.font='600 11px system-ui'; c.textAlign='left'; c.textBaseline='bottom';
  for(const f of [0.5,1]){ c.beginPath(); c.arc(cx,cy,rr*f,0,Math.PI*2); c.stroke(); c.fillText((T.rng*f).toString().replace('.',',')+' km',cx+rr*f*0.71+3,cy-rr*f*0.71); }
  c.beginPath(); c.moveTo(cx,cy-rr); c.lineTo(cx,cy+rr); c.moveTo(cx-rr,cy); c.lineTo(cx+rr,cy); c.stroke();
  // cerchio dei 1000 ft
  c.strokeStyle='rgba(255,176,32,.6)'; c.setLineDash([4,4]); c.beginPath(); c.arc(cx,cy,Math.max(3,PH.TRF_LIM*sc),0,Math.PI*2); c.stroke(); c.setLineDash([]);
  // nord
  c.save(); c.translate(cx,cy); c.rotate(-up); c.fillStyle='#ff6b6b'; c.font='700 13px "Oxanium",system-ui'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('N',0,-rr+10); c.restore();
  // il mio aereo
  c.fillStyle='#ffd23d'; c.beginPath(); c.moveTo(cx,cy-10); c.lineTo(cx+7,cy+7); c.lineTo(cx,cy+3); c.lineTo(cx-7,cy+7); c.closePath(); c.fill();
  const shown=ev.filter(e=>!e.me && e.d<=T.rng*1000*1.05 && !(e.dz===e.dz && Math.abs(e.dz)>6000*FT2M));
  for(const e of shown.slice().reverse()){
    const rel=Math.atan2(e.x,e.y)-up, px=cx+Math.sin(rel)*e.d*sc, py=cy-Math.cos(rel)*e.d*sc;
    const near=e.dz===e.dz && Math.abs(e.dz)<PH.TRF_LIM && e.d<3000;
    const col=e.lvl>=2?'#ff3b3b':(e.lvl===1?'#ffb020':(e.age>30||e.t.ground||e.t.kmh<25?'#6b7684':(near?'#ffe08a':'#4fd2ff')));
    c.save(); c.translate(px,py); c.rotate(e.t.trk*D2R-up); c.fillStyle=col; c.strokeStyle='#000'; c.lineWidth=1.5;
    c.beginPath(); c.moveTo(0,-9); c.lineTo(6,7); c.lineTo(0,3); c.lineTo(-6,7); c.closePath(); c.fill(); c.stroke(); c.restore();
    c.fillStyle=col; c.font='700 11px "Oxanium",system-ui'; c.textAlign='left'; c.textBaseline='middle';
    const v=e.t.vz>1?' ↑':(e.t.vz<-1?' ↓':'');
    c.fillText((e.t.reg||e.t.cn||e.t.addr||'?').slice(0,9),px+10,py-6); c.fillText(PH.trfDz(e)+v,px+10,py+7);
  }
  // elenco e fonti
  const ago=t=>t?Math.round((Date.now()-t)/1000)+' s fa':'mai';
  const sl=(k,name)=>{ const s=T.src[k]; return s.err&&(!s.t||s.te>s.t)?`<span class="b">${name}: non risponde (${s.err.replace(/</g,'')})</span>`:`<span class="${s.t&&Date.now()-s.t<30000?'o':'w'}">${name}: ${s.n} · ${ago(s.t)}</span>`; };
  const row=e=>`<div class="ph-trf-r ${e.lvl>=2?'b':(e.lvl===1?'w':'')}"><b>${(e.t.reg||e.t.cn||e.t.addr||'?').replace(/</g,'')}</b>`+
    `<span>${(e.d/1000).toFixed(1).replace('.',',')} km · ore ${PH.trfClock(e)} · ${PH.trfDz(e)}${e.t.vz>1?' ↑':(e.t.vz<-1?' ↓':'')} · ${Math.round(e.t.kmh)} km/h</span>`+
    `<small>${e.t.src}${e.t.baro?' (quota baro)':''} · ${Math.round(e.age)} s${e.lvl?(e.tc?` · incontro tra ${Math.round(e.tc)} s`:' · troppo vicino'):''}</small></div>`;
  const list=shown.slice(0,12), hid=ev.filter(e=>!e.me && e.d<=T.rng*1000*1.05).length-shown.length, me=ev.find(e=>e.me);
  el('phTrfInfo').innerHTML=
    (!T.on?'<p class="w">Traffico spento: si accende in Impostazioni › Traffico.</p>':'')+
    (T.on && !S.gpsReal && !PH.demo?'<p class="w">Aspetto la posizione GPS.</p>':'')+
    (T.on && !navigator.onLine && !PH.demo?'<p class="b">Senza internet il traffico non arriva.</p>':'')+
    (list.length?list.map(row).join(''):(T.on?'<p>Nessun traffico entro '+T.rng+' km e ±6000 ft.</p>':''))+
    (hid>0?`<p class="ph-sub">${hid} traffici più alti o più bassi di 6000 ft non sono mostrati.</p>`:'')+
    (me?`<p class="ph-sub">Il tuo aereo (${(me.t.reg||me.t.addr).replace(/</g,'')}) è riconosciuto e non è contato come traffico.</p>`:'')+
    `<p class="ph-src">${PH.demo?'<span class="w">Volo dimostrativo: traffico finto</span>':(T.gdlOn&&PH.native?(PH.gdlLive()?`<span class="o">SafeSky (GDL90): ${T.src.gdl.n} · ${ago(T.src.gdl.t)}</span><span class="o">internet in pausa</span>`:(T.src.gdl.err?`<span class="b">SafeSky: ${T.src.gdl.err.replace(/</g,'')}</span>`:'<span class="w">SafeSky: nessun dato</span>')):'')+(PH.gdlLive()?'':sl('ogn','OGN (FLARM)')+sl('adsb','adsb.lol (ADS-B)'))}</p>`+
    `<p class="ph-sub">Il triangolo di pericolo sullo strumento compare se un traffico è entro 1000 ft di lato e in quota, adesso o entro ${PH.TRF_LOOK} s se nessuno cambia rotta. `+
    `I dati via internet arrivano con 5–20 s di ritardo e mancano dove non ci sono ricevitori (valli, bassa quota) e per chi non ha FLARM, OGN o ADS-B: guarda sempre fuori. `+
    `Dati: SafeSky sul telefono, Open Glider Network e adsb.lol (licenza ODbL).</p>`;
};
// impostazioni: una sezione Traffico prima di Avvisi
{ const orig=PH.renderImp;
  PH.renderImp=function(){ orig.apply(this,arguments);
    const box=el('phImpBody'); if(!box) return;
    const sec=document.createElement('section');
    sec.innerHTML=`<h3>Traffico</h3>
      <label class="ph-chk"><input type="checkbox" id="phTrfOn" ${PH.TRF.on?'checked':''}> Traffico in tempo reale da internet (OGN e adsb.lol)</label>
      <p class="ph-sub">Si scarica solo in volo o con la pagina Traffico aperta, ogni 6 s: circa 5–15 MB l'ora. Sullo strumento compare solo il triangolo di pericolo; tutto il resto è nella pagina Traffico.</p>
      <label class="ph-chk"><input type="checkbox" id="phGdlOn" ${PH.TRF.gdlOn?'checked':''}> Ricevi il traffico di SafeSky sullo stesso telefono (GDL90, porta UDP 4000)</label>
      <p class="ph-sub">Con SafeSky Premium: in SafeSky › Impostazioni attiva la condivisione del traffico e scegli come software di navigazione <b>altro software GDL90</b>, poi premi DECOLLO e torna a HORIZON. SafeSky resta in sottofondo senza schermo: trasmette la tua posizione e passa a HORIZON il suo traffico; finché arriva, HORIZON non scarica il traffico da internet. Perché Android non lo chiuda: Impostazioni di Android › App › SafeSky › Batteria › <b>Senza restrizioni</b>. Funziona anche con SkyEcho, PilotAware e Stratux sul WiFi.</p>
      <p class="ph-sub" id="phGdlMsg">${!PH.native?'Solo nell\'app installata (APK).':(PH.gdlLive()?'SafeSky collegato: '+PH.TRF.src.gdl.n+' traffici.':(PH.TRF.src.gdl.err?'Errore: '+PH.TRF.src.gdl.err.replace(/</g,''):(PH.TRF.gdlOn?'In ascolto: nessun dato ancora.':'')))}</p>
      <div class="ph-btns"><label class="ph-fld">Il tuo codice FLARM/OGN o ICAO (esadecimale, es. DD1234), per non vederti come traffico<input id="phTrfMe" type="text" maxlength="8" autocapitalize="characters" value="${PH.TRF.me.replace(/"/g,'')}" placeholder="facoltativo"></label></div>
      <p class="ph-sub">Le marche del velivolo attivo (${(PH.ac&&PH.ac.reg||'—').replace(/</g,'')}) sono già escluse; in volo l'app riconosce da sola un traffico che ha sempre la tua posizione e la tua velocità.</p>`;
    const av=[...box.querySelectorAll('section h3')].find(h=>h.textContent==='Avvisi');
    if(av) av.parentNode.before(sec); else box.appendChild(sec);
    el('phTrfOn').onchange=e=>{ PH.TRF.on=e.target.checked; lsSet('ia517p_trf',PH.TRF.on); if(!PH.TRF.on){ PH.TRF.tg.clear(); PH.TRF.alert=null; } };
    el('phGdlOn').onchange=e=>{ PH.TRF.gdlOn=e.target.checked; lsSet('ia517p_gdl',PH.TRF.gdlOn); PH.gdlStart(); };
    el('phTrfMe').onchange=e=>{ PH.TRF.me=PH.trfNorm(e.target.value); e.target.value=PH.TRF.me; lsSet('ia517p_trf_me',PH.TRF.me); };
  };
}
// aggancio a pagine e fotogrammi
{ const origShow=PH.show;
  PH.show=function(v){ const s=el('phTrf'); if(s) s.hidden=v!=='trf'; origShow.apply(this,arguments); if(v==='trf') PH.trfOpen(); else PH.trfClose(); };
  const origAfter=PH.afterFrame;
  PH.afterFrame=function(g,dt){ origAfter.apply(this,arguments);
    try{ PH.trfDraw(); }catch(e){}
    const now=performance.now();
    if(now-(PH.trfSec||0)>1000){ PH.trfSec=now; try{ PH.trfTick(); }catch(e){ console.error(e); } }
    if(now-(PH.statoSec||0)>5000){ PH.statoSec=now; PH.statoPoll(); }
  };
}

setTimeout(()=>{ try{ PH.gdlStart(); }catch(e){} },1500);
