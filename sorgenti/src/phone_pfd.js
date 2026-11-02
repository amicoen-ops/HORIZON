// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
// =====================================================================================
//  VERSIONE TELEFONO / TABLET
//  Sensori del telefono al posto della scheda sensori: GPS (posizione, velocità, traccia,
//  quota) e giroscopio + accelerometro (assetto con lo stesso filtro della XIAO, compensato
//  in virata con la velocità GPS). Da internet: terreno vero (DEM), mappa di base, meteo.
//  Le funzioni dichiarate qui sostituiscono quelle con lo stesso nome dello strumento.
// =====================================================================================
var PH=null, PH_nearFields=null, SIM_CRUISE=115, AC_={vapp:95,vcirc:105,vcruise:115,vs0:42,glide:0};   // AC_: velivolo attivo (vedi phone_aereo.js)   // velocità di crociera della simulazione (km/h)

// chiavi di memoria: le note dello strumento non devono sovrascrivere quelle del piano
function phKey(k){ return k==='ia517_notes'?'ia517pfd_notes':k; }
function lsGet(key,d){ try{ const v=localStorage.getItem(phKey(key)); return v?JSON.parse(v):d; }catch(e){ return d; } }
function lsSet(key,v){ try{ localStorage.setItem(phKey(key),JSON.stringify(v)); }catch(e){} }

// terreno: DEM vero se c'è; quello sintetico solo nel volo dimostrativo
function terrainRaw(E,N){
  if(!PH) return terrainSynth(E,N);
  const lat=ORIGIN.lat+N/110540, lon=ORIGIN.lon+E/(111320*Math.cos(ORIGIN.lat*D2R));
  const z=phDemAt(lat,lon,PH.demZ);
  if(z===z) return z;
  return PH.demo?terrainSynth(E,N):NaN;
}
function phDemAt(lat,lon,z){
  z=z||11;
  for(let zz=z, zmin=Math.min(8,Math.max(5,z-2)); zz>=zmin; zz--){
    const n=2**zz, fx=(lon+180)/360*n, lr=lat*D2R, fy=(1-Math.log(Math.tan(lr)+1/Math.cos(lr))/Math.PI)/2*n;
    const tx=Math.floor(fx), ty=Math.floor(fy), t=PH.dem.get(zz+'/'+tx+'/'+ty);
    if(!t){ if(zz===z) phDemFetch(zz,tx,ty); continue; }
    let px=(fx-tx)*256-0.5, py=(fy-ty)*256-0.5;
    px=px<0?0:(px>254.999?254.999:px); py=py<0?0:(py>254.999?254.999:py);
    const i=px|0, j=py|0, u=px-i, v=py-j, o=j*256+i;
    return (t[o]*(1-u)+t[o+1]*u)*(1-v)+(t[o+256]*(1-u)+t[o+257]*u)*v;
  }
  return NaN;
}
function phDemUrl(z,x,y){ return `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`; }
async function phDemFetch(z,x,y){
  const key=z+'/'+x+'/'+y;
  if(PH.dem.has(key)||PH.demPend.has(key)||PH.demPend.size>=6) return;
  const f=PH.demFail.get(key); if(f && Date.now()-f<60000) return;
  PH.demPend.add(key);
  try{
    const r=await fetch(phDemUrl(z,x,y),{mode:'cors'}); if(!r.ok) throw new Error('http '+r.status);
    const bmp=await createImageBitmap(await r.blob());
    const c=PH.demCv||(PH.demCv=document.createElement('canvas')); c.width=256; c.height=256;
    const cx=c.getContext('2d',{willReadFrequently:true}); cx.clearRect(0,0,256,256); cx.drawImage(bmp,0,0);
    const d=cx.getImageData(0,0,256,256).data, a=new Int16Array(65536);
    for(let i=0;i<65536;i++){ const q=i*4; a[i]=Math.round(d[q]*256+d[q+1]+d[q+2]/256-32768); }
    PH.dem.set(key,a); PH.demVer++;
    if(PH.dem.size>220){ const first=PH.dem.keys().next().value; PH.dem.delete(first); }   // al massimo ~28 MB in memoria
  }catch(e){ PH.demFail.set(key,Date.now()); }
  finally{ PH.demPend.delete(key); }
}

// a terra niente colori di avviso del terreno (giallo e rosso): solo in volo o nel volo dimostrativo
function PH_air(){ return !PH || PH.demo || S.auto || !!PH.flight || (S.gpsReal && S.gs>45); }
function terrain(E,N){
  let z=terrainRaw(E,N);
  const L=(PH&&PH.nearF)||FIELDS;
  for(let i=0;i<L.length;i++){ const f=L[i], dx=E-f.E, dy=N-f.N, lim=f.flat*2.2;
    if(dx>lim||dx<-lim||dy>lim||dy<-lim) continue;
    // il campo si spiana alla sua quota; se la quota dell'elenco non torna col rilievo (oltre 50 m) si spiana al rilievo:
    // altrimenti il raccordo diventa un cono a punta («piramide») in mezzo alla pianura
    let tgt=f.elev;
    if(PH && f.demZ===undefined){ const t=performance.now(); if(!(t-(f.demTry||0)<1000)){ f.demTry=t; const dz=phDemAt(f.lat,f.lon,11);
        if(dz===dz){ f.demZ=dz; if(f.elev===f.elev && Math.abs(f.elev-dz)>50){ f.elevBad=true; (PH.elevBad||(PH.elevBad=new Set())).add(f.short);
          PH.act&&PH.act(`quota dubbia ${f.short}: elenco ${Math.round(f.elev/FT2M)} ft, rilievo ${Math.round(dz/FT2M)} ft`); } } } }
    if(f.elevBad) tgt=f.demZ;
    if(tgt!==tgt || z!==z) continue;
    const w=Math.exp(-(dx*dx+dy*dy)/(f.flat*f.flat)); z+=(tgt-z)*w; }
  return z;
}
PH_nearFields=function(){ if(!PH) return; const ac=enu(S.lat,S.lon), r=Math.max(30000,ZOOMS[zi]*1500), r2=r*r;
  PH.nearF=FIELDS.filter(f=>{ const dx=f.E-ac.E, dy=f.N-ac.N; return dx*dx+dy*dy<r2; }); };
// vista sintetica: come quella dello strumento, ma dove il terreno non è noto non disegna niente.
// Griglia più fitta (fino a 47×95 riquadri, lati di ~120 m vicino all'aereo) ma disegnata in modo più leggero:
// ogni vertice si calcola una volta sola, la foschia è mescolata nel colore, e i riquadri dello stesso colore di una fila
// si riempiono insieme (niente righe tra un riquadro e l'altro). Il livello si abbassa da solo se il telefono rallenta.
const TERR_Q=[[30,48],[40,72],[48,96]];                       // file in profondità × colonne
const TERR_FAR=70*Math.pow(1.205,29);                         // distanza massima come prima (~15 km)
function drawTerrain(ac,acAlt,hdgRad,sinP,cosP){
  const lvl=PH?(PH.terrQ==='auto'?PH.terrLvl:+PH.terrQ):0, FN=TERR_Q[lvl][0], LN=TERR_Q[lvl][1];
  const ratio=Math.pow(TERR_FAR/70,1/(FN-1)), sinH=Math.sin(hdgRad), cosH=Math.cos(hdgRad);
  const n=FN*LN, Z=new Float32Array(n), X=new Float32Array(n), Y=new Float32Array(n), OK=new Uint8Array(n);
  const fd=i=>70*Math.pow(ratio,i), ld=j=>(j/(LN-1)*2-1)*5600;
  for(let i=0;i<FN;i++){ const f=fd(i);
    for(let j=0;j<LN;j++){ const l=ld(j), E=ac.E+f*sinH+l*cosH, N=ac.N+f*cosH-l*sinH, z=terrain(E,N), k2=i*LN+j;
      if(z!==z) continue; const pr=project(l,f,z-acAlt,sinP,cosP); if(!pr) continue; Z[k2]=z; X[k2]=pr.x; Y[k2]=pr.y; OK[k2]=1; } }
  const air=PH_air();
  for(let i=FN-2;i>=0;i--){
    const f0=fd(i), f1=fd(i+1), fm=(f0+f1)/2, haze=clamp((f0-2500)/15000,0,.62), paths=new Map();
    for(let j=0;j<LN-1;j++){
      const a=i*LN+j, b=(i+1)*LN+j, c2=(i+1)*LN+j+1, d=i*LN+j+1;
      if(!(OK[a]&OK[b]&OK[c2]&OK[d])) continue;
      const zc=(Z[a]+Z[b]+Z[c2]+Z[d])/4, slope=((Z[b]+Z[c2])-(Z[a]+Z[d]))/2/(f1-f0);
      let clr=acAlt-zc; if(!air) clr=1e9; else if(inhField()){ const lm=(ld(j)+ld(j+1))/2; if(tawsInhibit(ac.E+fm*sinH+lm*cosH, ac.N+fm*cosH-lm*sinH)) clr=1e9; }
      let [r,g,bb]=tawsRGB(zc,1-slope*2.4,clr);
      if(haze>0){ r+=(134-r)*haze; g+=(171-g)*haze; bb+=(210-bb)*haze; }
      const key=((r/5)|0)*5+','+((g/5)|0)*5+','+((bb/5)|0)*5;
      let P=paths.get(key); if(!P){ P=new Path2D(); paths.set(key,P); }
      P.moveTo(X[a],Y[a]); P.lineTo(X[b],Y[b]); P.lineTo(X[c2],Y[c2]); P.lineTo(X[d],Y[d]); P.closePath();
    }
    for(const [key,P] of paths){ ctx.fillStyle='rgb('+key+')'; ctx.fill(P); }
  }
}
// mappa: rilievo dal DEM; con la mappa di base accesa restano solo le zone TAWS gialle e rosse
function rasterMap(ac){
  if(PH){ const now=performance.now();
    if(MR.zi===zi && MR.half>0 && now-(PH.rastT||0)<1500) return;
    PH.rastT=now; }
  const n=MR.n, half=ZOOMS[zi]*1000*1.4, acAlt=S.alt*FT2M, base=PH&&PH.base!=='dem';
  if(PH){ const km=ZOOMS[zi]; PH.demZ=km>=250?7:(km>=90?8:(km>=30?9:(km>=15?10:(km<=3?12:11)))); }
  MR.cv.width=n; MR.cv.height=n; const c2=MR.cv.getContext('2d'), img=c2.createImageData(n,n);
  const z=new Float32Array(n*n), st=2*half/n, air=PH_air();
  for(let j=0;j<n;j++) for(let i=0;i<n;i++) z[j*n+i]=terrain(ac.E-half+(i+0.5)*st, ac.N+half-(j+0.5)*st);
  for(let j=0;j<n;j++) for(let i=0;i<n;i++){
    const zz=z[j*n+i], o=(j*n+i)*4;
    if(zz!==zz){ img.data[o+3]=0; continue; }
    let zl=z[j*n+Math.max(0,i-1)], zu=z[Math.max(0,j-1)*n+i]; if(zl!==zl) zl=zz; if(zu!==zu) zu=zz;
    const sh=1+clamp(((zl-zz)+(zu-zz))/st*2.2,-0.45,0.35);
    const E=ac.E-half+(i+0.5)*st, N=ac.N+half-(j+0.5)*st, inh=!air||tawsInhibit(E,N), clr=inh?1e9:acAlt-zz;
    const [r,g,b]=tawsRGB(zz,sh,clr,true);
    img.data[o]=r; img.data[o+1]=g; img.data[o+2]=b;
    img.data[o+3]=base?(clr<TAWS_RED?210:(clr<TAWS_YEL?150:0)):255;
  }
  if(PH) PH.demZ=11;
  c2.putImageData(img,0,0);
  Object.assign(MR,{cE:ac.E,cN:ac.N,half,alt:acAlt,zi,inh:inhField()});
}
function fmtWind(){ return WIND.valid?`${String(Math.round(WIND.dir/10)*10).padStart(3,'0')}°/${Math.round(WIND.kmh)}${WIND.src==='prev'?' PREV':''}`:'---'; }
function renderMenuPos(){
  const q=PH&&PH.sim?'simulazione: '+PH.sim.name:PH&&PH.demo?'volo dimostrativo':(!S.gpsReal?'in attesa del GPS':(PH.src==='glo'?`GLO 2 · ${S.sats??'?'} sat · HDOP ${S.hdop??'?'}`:`GPS telefono ±${Math.round(PH.acc||0)} m`));
  el('menuPos').textContent=fmtCoord(S.lat,'N','S',2)+'  '+fmtCoord(S.lon,'E','W',3)+'  ·  '+q;
}
// niente servizio Raspberry: i dati restano sul telefono, il piano parla con lo strumento direttamente
function linkStart(){ LINK.ok=true; }
function linkSend(o){ if(PH) PH.fromPfd(o); return true; }
function toast(msg){ toastShow(msg); if(PH) PH.voiceToast(msg); }
function ask(text,yes,secs){ askShow(text,yes,secs); if(PH){ PH.say(text,true); PH.buzz([80,60,80]); } }
function buildApproach(f,pick,ac){
  const A=buildApproachBase(f,pick,ac);
  if(f.elevUnknown && !A.warn) A.warn='QUOTA CAMPO NON NOTA · GUIDA VERTICALE INDICATIVA';
  return A;
}

// ---------------- filtro di assetto (lo stesso della scheda sensori, ahrs_core.h) ----------------
function PhMahony(){ this.q0=1; this.q1=0; this.q2=0; this.q3=0; this.ix=0; this.iy=0; this.iz=0;
  this.kp=1.8; this.ki=0.02; this.trustG=0.08; this.trustRate=0.6; this.trust=1; }
PhMahony.prototype.levelFrom=function(fx,fy,fz){
  const roll=Math.atan2(-fy,-fz), pitch=Math.atan2(fx,Math.hypot(fy,fz));
  const cr=Math.cos(roll/2), sr=Math.sin(roll/2), cp=Math.cos(pitch/2), sp=Math.sin(pitch/2);
  this.q0=cr*cp; this.q1=sr*cp; this.q2=cr*sp; this.q3=-sr*sp; this.ix=this.iy=this.iz=0; };
PhMahony.prototype.down=function(){ const a=this;
  return [2*(a.q1*a.q3-a.q0*a.q2), 2*(a.q0*a.q1+a.q2*a.q3), a.q0*a.q0-a.q1*a.q1-a.q2*a.q2+a.q3*a.q3]; };
PhMahony.prototype.update=function(gx,gy,gz,fx,fy,fz,dt){
  const mag=Math.hypot(fx,fy,fz), rate=Math.hypot(gx,gy,gz);
  const e1=(mag-1)/this.trustG, e2=rate/this.trustRate; this.trust=Math.exp(-e1*e1)*Math.exp(-e2*e2);
  if(mag>0.3 && mag<3){
    const ax=-fx/mag, ay=-fy/mag, az=-fz/mag, [vx,vy,vz]=this.down();
    const ex=ay*vz-az*vy, ey=az*vx-ax*vz, ez=ax*vy-ay*vx, kk=this.kp*this.trust;
    if(this.ki>0 && this.trust>0.05){ const M=0.035;
      this.ix=clamp(this.ix+this.ki*ex*dt,-M,M); this.iy=clamp(this.iy+this.ki*ey*dt,-M,M); this.iz=clamp(this.iz+this.ki*ez*dt,-M,M); }
    gx+=kk*ex+this.ix; gy+=kk*ey+this.iy; gz+=kk*ez+this.iz;
  } else { gx+=this.ix; gy+=this.iy; gz+=this.iz; }
  const h=0.5*dt, a=this.q0, b=this.q1, c=this.q2, d=this.q3;
  this.q0+=(-b*gx-c*gy-d*gz)*h; this.q1+=(a*gx+c*gz-d*gy)*h; this.q2+=(a*gy-b*gz+d*gx)*h; this.q3+=(a*gz+b*gy-c*gx)*h;
  const n=1/Math.hypot(this.q0,this.q1,this.q2,this.q3); this.q0*=n; this.q1*=n; this.q2*=n; this.q3*=n; };
PhMahony.prototype.euler=function(){ const a=this;
  return [Math.atan2(2*(a.q0*a.q1+a.q2*a.q3),1-2*(a.q1*a.q1+a.q2*a.q2))*R2D,
          Math.asin(clamp(2*(a.q0*a.q2-a.q3*a.q1),-1,1))*R2D]; };
// vario: quota GPS + accelerazione verticale, filtro complementare del 3° ordine.
// Stabile anche con fix irregolari: guadagni limitati per passo, riparte da capo dopo un buco lungo
// o un salto grande, e senza GPS non integra l'accelerazione (niente deriva).
function PhVario(tau){ this.h=NaN; this.v=0; this.ab=0; this.tc=0; this.setTau(tau); }
PhVario.prototype.setTau=function(t){ this.k1=3/t; this.k2=3/(t*t); this.k3=1/(t*t*t); };
PhVario.prototype.reset=function(hm){ this.h=hm; this.v=0; this.ab=0; this.tc=performance.now(); };
PhVario.prototype.predict=function(aUp,dt){
  if(!(this.h===this.h)) return;
  if(performance.now()-this.tc>3000){ this.v*=0.97; return; }        // GPS fermo: niente integrazione, il vario torna a zero
  const a=clamp(aUp,-6,6)-this.ab; this.h+=this.v*dt+0.5*a*dt*dt; this.v=clamp(this.v+a*dt,-40,40); };
PhVario.prototype.correct=function(hm,dt){
  if(!isFinite(hm)) return;
  const e=hm-this.h;
  if(!isFinite(this.h) || !isFinite(this.v) || !(dt>0) || dt>3){ this.reset(hm); this.out=0; return; }
  if(Math.abs(e)>150){ this.out=(this.out||0)+1; if(this.out>=3){ this.reset(hm); this.out=0; } return; }   // un fix isolato fuori misura si scarta
  this.out=0;
  const d=Math.min(dt,1);
  this.h+=Math.min(0.9,this.k1*d)*e; this.v=clamp(this.v+Math.min(0.5/d,this.k2*d)*e,-40,40);
  this.ab=clamp(this.ab-this.k3*e*d,-1.5,1.5); this.tc=performance.now(); };

// ---------------- alba e tramonto (algoritmo NOAA semplificato) ----------------
function phSun(date,lat,lon){
  const rad=D2R, dayMs=86400000, J1970=2440588, J2000=2451545;
  const d=date.valueOf()/dayMs-0.5+J1970-J2000, lw=-lon*rad, phi=lat*rad;
  const n=Math.round(d-0.0009-lw/(2*Math.PI)), ds=0.0009+lw/(2*Math.PI)+n;
  const M=rad*(357.5291+0.98560028*ds), Cc=rad*(1.9148*Math.sin(M)+0.02*Math.sin(2*M)+0.0003*Math.sin(3*M));
  const L=M+Cc+rad*102.9372+Math.PI, dec=Math.asin(Math.sin(L)*Math.sin(rad*23.4397));
  const Jt=J2000+ds+0.0053*Math.sin(M)-0.0069*Math.sin(2*L);
  const w=Math.acos(clamp((Math.sin(-0.833*rad)-Math.sin(phi)*Math.sin(dec))/(Math.cos(phi)*Math.cos(dec)),-1,1));
  const a=0.0009+(w+lw)/(2*Math.PI)+n, Js=J2000+a+0.0053*Math.sin(M)-0.0069*Math.sin(2*L), Jr=Jt-(Js-Jt);
  const fj=j=>new Date((j+0.5-J1970)*dayMs);
  return {rise:fj(Jr),set:fj(Js)};
}

// ---------------- tutto il resto della versione telefono ----------------
PH={
  demo:false, dem:new Map(), demPend:new Set(), demFail:new Map(), demVer:0, demZ:11, demCv:null,
  base:lsGet('ia517p_basemap','topo'), tiles:new Map(), esriKey:lsGet('ia517p_esrikey',''), customMap:lsGet('ia517p_custommap',null), wmsLayers:lsGet('ia517p_wmslayers',null),
  acc:null, lastFix:null, fixT:0, motionHz:0, mCount:0, mT0:performance.now(),
  M:lsGet('ia517p_mount',null)||[[0,0,-1],[1,0,0],[0,-1,0]], mountCal:!!lsGet('ia517p_mount',null),
  groundPitch:lsGet('ia517p_gpitch',0),
  geoid:lsGet('ia517p_geoid',47), altOfsBy:lsGet('ia517p_altofs2',{phone:lsGet('ia517p_altofs',0),glo:0}), altOfs:0, altCal:lsGet('ia517p_altcal',null),
  srcPref:lsGet('ia517p_src','auto'), src:null, phoneFix:null, glo:{port:null,fix:null,gga:null,want:lsGet('ia517p_glo',false),n:0,hz:0,err:''},
  perf:{avg:0,max:0,n:0,stalls:0,lastRaf:0}, trail:[], fps:lsGet('ia517p_fps',30), hbPrev:lsGet('ia517p_hb',null),
  compassMode:lsGet('ia517p_compass','ground'), decl:lsGet('ia517p_decl',3), mag:{hdg:null,t:0,abs:false},
  ui:lsGet('ia517p_ui','full'), terrQ:lsGet('ia517p_terrq','auto'), terrLvl:2, terrLow:0, terrHigh:0,
  trkRate:0, trkRateT:0, trkPrev:null, gyroT:0, gyroOk:false, gyroSus:false, turnSrc:'giroscopio',
  ahrs:new PhMahony(), vario:new PhVario(3), ahrsInit:false, smooth:lsGet('ia517p_smooth',3), attF:null, hdg:null, slipF:0, gsPrev:null, dvdt:0,
  aAvg:[0,0,0], windBuf:[], tas:null, still:0, stillBuf:[],
  voice:lsGet('ia517p_voice',true), vib:lsGet('ia517p_vib',true), wake:null, wakeOn:lsGet('ia517p_wake',true),
  wx:{}, flight:null, alerts:{}, lastSec:0, lastHalf:0, split:false, view2:null, sunDay:'', sun:null,
};
Object.assign(STALE,{air:3500,baro:3500});          // velocità e quota vengono dal GPS: stessa scadenza della posizione
const OBST_SYN=OBST.slice();
OBST.length=0;                                           // ostacoli sintetici: solo nel volo dimostrativo

// ---- app installata (APK Capacitor): funzioni native al posto di quelle del browser ----
PH.native=(()=>{ const C=window.Capacitor; if(!C||!C.isNativePlatform||!C.isNativePlatform()) return null;
  const P=n=>{ try{ return (C.Plugins&&C.Plugins[n])||C.registerPlugin(n); }catch(e){ return null; } };
  return {tts:P('TextToSpeech'),awake:P('KeepAwake'),fs:P('Filesystem'),share:P('Share'),http:P('CapacitorHttp'),glo:P('GloSerial'),compass:P('Compass'),upd:P('Updater'),ahrs:P('Ahrs'),ble:P('StrumentoBle')}; })();
// ascolto di un evento nativo: con Capacitor 8 addListener può restituire una Promise o no; mai un errore che ferma l'avvio
PH.listen=function(pl,ev,cb){ try{ const r=pl&&pl.addListener&&pl.addListener(ev,cb); if(r&&typeof r.catch==='function') r.catch(()=>{}); return r; }catch(e){ PH.logErr&&PH.logErr('ascolto '+ev+': '+e.message); return null; } };
PH.call=function(pr){ try{ if(pr&&typeof pr.catch==='function') pr.catch(()=>{}); return pr; }catch(e){ return null; } };
// ---- voce e vibrazione ----
PH.say=function(text,urgent){
  if(!PH.voice || (!window.speechSynthesis && !(PH.native&&PH.native.tts))) return;
  let t=String(text).replace(/·/g,',').replace(/\bSX\b/g,'sinistro').replace(/\bDX\b/g,'destro').replace(/\bft\b/gi,'piedi')
    .replace(/\bPISTA (\d)(\d)([LRC]?)\b/gi,(m,a,b,c)=>`pista ${a} ${b}${c?' '+({L:'sinistra',R:'destra',C:'centro'}[c.toUpperCase()]):''}`)
    .replace(/(\d+)°\/(\d+)/g,'$1 gradi, $2 chilometri orari').replace(/(\d+)°/g,'$1 gradi').replace(/ km\b/g,' chilometri').replace(/'/g,' minuti');
  t=t.toLowerCase();
  if(PH.native&&PH.native.tts){ PH.native.tts.speak({text:t,lang:'it-IT',rate:1.05,pitch:1.0,volume:1.0,category:'playback',queueStrategy:urgent?0:1}).catch(()=>{}); return; }
  try{ if(urgent) speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(t); u.lang='it-IT'; u.rate=1.08;
    const v=speechSynthesis.getVoices().find(x=>/^it/i.test(x.lang)); if(v) u.voice=v; speechSynthesis.speak(u); }catch(e){}
};
PH.buzz=function(p){ if(PH.vib && navigator.vibrate) try{ navigator.vibrate(p); }catch(e){} };
PH.voiceToast=function(m){
  if(/^(DIRECT TO|PISTA CAMBIATA|PISTA \d|INGRESSO|SOTTOVENTO|BASE|FINALE|RIATTACCATA|ATTERRATO|ROTTA |PROSSIMO|FINE ROTTA|QNH)/.test(m) || /: PISTA /.test(m)) PH.say(m.split(' · ').slice(0,3).join(' · '));
};

// ---- montaggio del telefono: da coordinate del telefono ad aereo (avanti, destra, giù) ----
PH.toBody=function(v){ const M=PH.M; return [M[0][0]*v[0]+M[0][1]*v[1]+M[0][2]*v[2], M[1][0]*v[0]+M[1][1]*v[1]+M[1][2]*v[2], M[2][0]*v[0]+M[2][1]*v[1]+M[2][2]*v[2]]; };
PH.level=function(groundPitchDeg){
  const a=PH.aAvg, g=Math.hypot(a[0],a[1],a[2]); if(g<7||g>12.5){ toast('TIENI FERMO IL TELEFONO E RIPROVA'); return false; }
  const dn=[-a[0]/g,-a[1]/g,-a[2]/g];                  // "giù" visto dal telefono
  let fw=[0,0,-1]; const dd=fw[0]*dn[0]+fw[1]*dn[1]+fw[2]*dn[2];
  fw=[fw[0]-dd*dn[0],fw[1]-dd*dn[1],fw[2]-dd*dn[2]];
  if(Math.hypot(...fw)<0.3){ const e=dn[1]; fw=[-e*dn[0],1-e*dn[1],-e*dn[2]]; }   // telefono quasi in piano: avanti = alto dello schermo
  const nf=Math.hypot(...fw); fw=fw.map(x=>x/nf);
  const th=(groundPitchDeg||0)*D2R, c=Math.cos(th), s=Math.sin(th);
  const fwd=[fw[0]*c-dn[0]*s, fw[1]*c-dn[1]*s, fw[2]*c-dn[2]*s], down=[dn[0]*c+fw[0]*s, dn[1]*c+fw[1]*s, dn[2]*c+fw[2]*s];
  const right=[down[1]*fwd[2]-down[2]*fwd[1], down[2]*fwd[0]-down[0]*fwd[2], down[0]*fwd[1]-down[1]*fwd[0]];
  PH.M=[fwd,right,down]; PH.mountCal=true; PH.attF=null; PH.groundPitch=groundPitchDeg||0; PH.ahrsMount&&PH.ahrsMount();
  lsSet('ia517p_mount',PH.M); lsSet('ia517p_gpitch',PH.groundPitch);
  const fb=PH.toBody(a).map(x=>x/9.80665); PH.ahrs.levelFrom(fb[0],fb[1],fb[2]);   // forza specifica in g
  toast('ASSETTO LIVELLATO'+(PH.groundPitch?` · A TERRA ${PH.groundPitch}°`:''));
  return true;
};
// ---- bussola del telefono (orientamento assoluto: magnetometro + giroscopio + accelerometro di Android) ----
PH.onOrient=function(e){
  if(e.webkitCompassHeading!=null && !PH.mag.native){ PH.onOrientIOS(e); return; }
  const abs=e.type==='deviceorientationabsolute'||e.absolute===true;
  if(!abs) return; if(e.type==='deviceorientationabsolute') PH.mag.abs=true; else if(PH.mag.abs) return;
  const al=e.alpha, be=e.beta, ga=e.gamma; if(al==null||be==null||ga==null) return;
  if(PH.mag.native) return;                                                // c'è il modulo nativo: vale quello
  const ca=Math.cos(al*D2R), sa=Math.sin(al*D2R), cb=Math.cos(be*D2R), sb=Math.sin(be*D2R), cg=Math.cos(ga*D2R), sg=Math.sin(ga*D2R);
  PH.magFromR([[ca*cg-sa*sb*sg,-sa*cb,ca*sg+sa*sb*cg],[sa*cg+ca*sb*sg,ca*cb,sa*sg-ca*sb*cg],[-cb*sg,sb,cb*cg]],'browser');   // telefono -> Terra (Est, Nord, Su)
};
// iPhone: alpha è relativo; il riferimento al nord si ricava da webkitCompassHeading quando il lato alto del telefono
// non è verticale (telefono non dritto), e poi resta valido anche col telefono dritto in cabina
PH.onOrientIOS=function(e){
  const al=e.alpha, be=e.beta, ga=e.gamma; if(al==null||be==null||ga==null) return;
  const ca=Math.cos(al*D2R), sa=Math.sin(al*D2R), cb=Math.cos(be*D2R), sb=Math.sin(be*D2R), cg=Math.cos(ga*D2R), sg=Math.sin(ga*D2R);
  const Rm=[[ca*cg-sa*sb*sg,-sa*cb,ca*sg+sa*sb*cg],[sa*cg+ca*sb*sg,ca*cb,sa*sg-ca*sb*cg],[-cb*sg,sb,cb*cg]];
  const top=[Rm[0][1],Rm[1][1],Rm[2][1]];                                   // lato alto del telefono nella terna relativa
  if(Math.hypot(top[0],top[1])>0.6 && e.webkitCompassAccuracy!==-1){
    const rel=Math.atan2(top[0],top[1])*R2D, off=angDiff(e.webkitCompassHeading,rel);
    PH.mag.iosOff=PH.mag.iosOff==null?off:wrap360(PH.mag.iosOff+angDiff(off,PH.mag.iosOff)*0.1); }
  if(PH.mag.iosOff==null){ PH.mag.iosNeed=true; return; }
  PH.mag.iosNeed=false; if(e.webkitCompassAccuracy!=null) PH.mag.acc=e.webkitCompassAccuracy>25?1:3;
  const o=PH.mag.iosOff*D2R, co=Math.cos(o), so=Math.sin(o);                // rotazione attorno alla verticale: relativo -> nord magnetico
  PH.magFromR([[co*Rm[0][0]+so*Rm[1][0],co*Rm[0][1]+so*Rm[1][1],co*Rm[0][2]+so*Rm[1][2]],
               [-so*Rm[0][0]+co*Rm[1][0],-so*Rm[0][1]+co*Rm[1][1],-so*Rm[0][2]+co*Rm[1][2]],Rm[2]],'ios');
};
PH.magFromR=function(Rm,src){
  const scr=PH.scrAng()*D2R, c=Math.cos(scr), sn=Math.sin(scr);
  const toDev=v=>[v[0]*c+v[1]*sn, -v[0]*sn+v[1]*c, v[2]];                 // assi dello schermo -> assi del telefono
  const toE=v=>[Rm[0][0]*v[0]+Rm[0][1]*v[1]+Rm[0][2]*v[2], Rm[1][0]*v[0]+Rm[1][1]*v[1]+Rm[1][2]*v[2], Rm[2][0]*v[0]+Rm[2][1]*v[1]+Rm[2][2]*v[2]];
  let w=toE(toDev(PH.M[0]));                                               // asse avanti dell'aereo
  if(Math.abs(w[2])>0.85) w=toE(toDev([0,1,0]));                           // telefono in piano: conta il lato alto dello schermo
  if(Math.hypot(w[0],w[1])<0.2) return;
  const h=wrap360(Math.atan2(w[0],w[1])*R2D+(+PH.decl||0));                // magnetico -> vero con la declinazione
  PH.mag.raw=PH.mag.hdg==null?h:wrap360(PH.mag.raw+angDiff(h,PH.mag.raw)*0.25);
  PH.mag.hdg=PH.mag.raw; PH.mag.t=performance.now(); PH.mag.src=src;
};
PH.magInUse=function(){ return PH.mag.hdg!=null && performance.now()-PH.mag.t<1500 && !PH.demo &&
  (PH.compassMode==='always' || (PH.compassMode==='ground' && !(S.gpsReal && S.gs>25))); };
// verso dello schermo: 0 verticale, 90 o 270 orizzontale
PH.scrAng=function(){ if(PH.angTest!=null) return PH.angTest;
  const o=screen.orientation; const v=o&&typeof o.angle==='number'?o.angle:(typeof window.orientation==='number'?window.orientation:0); return ((v%360)+360)%360; };
PH.onRotate=function(){ const ang=PH.scrAng(); if(ang===PH.lastAng) return; PH.lastAng=ang;
  PH.ahrsInit=false; PH.attF=null; PH.aAvg=[0,0,0]; PH.act('schermo '+ang+'°'); };
PH.smoothTxt=function(){ const v=PH.smooth; return v<=0?'immediato':(v/10).toFixed(1).replace('.',',')+' s'; };
PH.resetMount=function(){ PH.M=[[0,0,-1],[1,0,0],[0,-1,0]]; PH.mountCal=false; PH.ahrsMount&&PH.ahrsMount(); try{ localStorage.removeItem('ia517p_mount'); }catch(e){} PH.ahrsInit=false; toast('MONTAGGIO: TELEFONO VERTICALE'); };

// ---- sensori di movimento ----
PH.onMotion=function(e){
  const a=e.accelerationIncludingGravity, r=e.rotationRate;
  if(!a || a.x==null) return;
  const now=performance.now();
  PH.mCount++; if(now-PH.mT0>2000){ PH.motionHz=Math.round(PH.mCount*1000/(now-PH.mT0)); PH.mCount=0; PH.mT0=now; }
  // i sensori arrivano sempre negli assi del telefono in verticale: li porto negli assi dello schermo,
  // così l'assetto è giusto anche col telefono girato in orizzontale (da una parte o dall'altra)
  const scr=PH.scrAng()*D2R, c=Math.cos(scr), sn=Math.sin(scr), ax=a.x||0, ay=a.y||0;
  const av=[ax*c-ay*sn, ax*sn+ay*c, a.z||0];
  for(let i=0;i<3;i++) PH.aAvg[i]+= (av[i]-PH.aAvg[i])*0.05;
  if(PH.demo) return;
  let dt=(e.interval>0?(e.interval>1?e.interval/1000:e.interval):0.016); dt=clamp(dt,0.004,0.06);
  const fb=PH.toBody(av).map(x=>x/9.80665);               // forza specifica nel corpo, in g (fermo e livellato: 0,0,-1)
  const rx=r?(r.beta||0)*D2R:0, ry=r?(r.gamma||0)*D2R:0, wd=[rx*c-ry*sn, rx*sn+ry*c, r?(r.alpha||0)*D2R:0];
  let wb=PH.toBody(wd);
  if(r && (Math.abs(r.alpha||0)+Math.abs(r.beta||0)+Math.abs(r.gamma||0))>1e-4) PH.gyroT=now;
  PH.gyroOk=now-(PH.gyroT||-1e9)<1500;
  // virata dal GPS: se il giroscopio non c'è, oppure non vede una virata che il GPS vede chiaramente da 3 secondi
  const gpsTurn=S.gpsReal && S.gs>40 && now-(PH.trkRateT||-1e9)<3000, phi0=(S.roll||0)*D2R;
  if(gpsTurn && PH.gyroOk){ const psiG=(wb[1]*Math.sin(phi0)+wb[2]*Math.cos(phi0))*R2D;
    const miss=Math.abs(PH.trkRate)>4 && Math.abs(psiG)<0.3*Math.abs(PH.trkRate);
    PH.gyroMissT=miss?(PH.gyroMissT||now):0; PH.gyroSus=miss && now-PH.gyroMissT>3000; } else PH.gyroSus=false;
  PH.turnSrc=(!PH.gyroOk||PH.gyroSus)?(gpsTurn?'gps':'nessuna'):'giroscopio';
  if(PH.turnSrc==='gps'){ const w=PH.trkRate*D2R, Vg=PH.tas||S.gs/3.6, pg=Math.atan(Vg*w/9.80665);   // inclinazione di virata coordinata
    wb=[0,w*Math.sin(pg),w*Math.cos(pg)]; }
  if(!PH.ahrsInit){ PH.ahrs.levelFrom(fb[0],fb[1],fb[2]); PH.ahrsInit=true; PH.attF=null; PH.hdg=S.trk!=null?S.trk:S.hdg; }
  // compensazione di virata e accelerazione con la velocità GPS (come la scheda sensori con il Pitot)
  const V=(S.gpsReal && S.gs>15)?(PH.tas||S.gs/3.6):0;
  const fx=fb[0]-(V>0?PH.dvdt/9.80665:0), fy=fb[1]-wb[2]*V/9.80665, fz=fb[2]+wb[1]*V/9.80665;
  PH.ahrs.update(wb[0],wb[1],wb[2],fx,fy,fz,dt);
  let [ro,pi]=PH.ahrs.euler();
  // v2: assetto dal modulo nativo (200 Hz, thread suo) quando arriva fresco; altrimenti quello della pagina
  const NA=PH.natAtt; PH.attSrc='pagina';
  if(NA && now-NA.t<150 && !PH.sim){ ro=NA.r; pi=NA.p; PH.attSrc='nativo'; }
  PH.integCheck(now,ro,pi,wb,fb);
  // orizzonte più morbido: filtro del primo ordine regolabile (0 = immediato, 10 = 1 s)
  const tau=clamp(PH.smooth,0,10)*0.1, kf=tau>0?1-Math.exp(-dt/tau):1;
  if(!PH.attF || !(PH.attF[0]===PH.attF[0])) PH.attF=[ro,pi];
  PH.attF[0]+=angDiff(ro,PH.attF[0])*kf; if(PH.attF[0]>180) PH.attF[0]-=360; else if(PH.attF[0]<-180) PH.attF[0]+=360;
  PH.attF[1]+=(pi-PH.attF[1])*kf;
  if(PH.extAtt(now)){ const E=PH.EXT; S.roll=E.r; S.pitch=E.p; PH.attSrc='strumento'; }   // v2: lo strumento fisico, se c'è, è la fonte principale
  else { S.roll=PH.attF[0]; S.pitch=PH.attF[1]; }
  PH.slipF+=(-fb[1]-PH.slipF)*Math.min(1,dt*3); S.slip=PH.extAtt(now)?clamp(PH.EXT.s,-1,1):clamp(PH.slipF,-1,1);
  // prua: giroscopio tra un fix e l'altro
  const phi=ro*D2R, th=pi*D2R, psiDot=(wb[1]*Math.sin(phi)+wb[2]*Math.cos(phi))/Math.max(0.2,Math.cos(th));
  if(PH.hdg==null) PH.hdg=S.hdg;
  PH.hdg=wrap360(PH.hdg+psiDot*R2D*dt);
  if(PH.magInUse()){ const dm=angDiff(PH.mag.hdg,PH.hdg);                 // a terra o lento: la bussola tiene la prua
    PH.hdg=Math.abs(dm)>25?PH.mag.hdg:wrap360(PH.hdg+dm*Math.min(1,dt/0.5)); }
  S.hdg=PH.hdg;
  // vario: accelerazione verticale dalla terna terrestre
  const [dx,dy,dz]=PH.ahrs.down(), aUp=(-(dx*fb[0]+dy*fb[1]+dz*fb[2])-1)*9.80665;
  PH.vario.predict(aUp,dt);
  LIVE.att=now; LIVE.any=true; S.auto=false;
  if(S.gpsReal) PH.seenAll=true;
};

// ---- GPS ----
// due fonti di posizione: GPS del telefono e Garmin GLO 2 via Bluetooth; si usa la migliore disponibile
PH.onPos=function(p){
  const c=p.coords;
  const fx={src:'phone',lat:c.latitude,lon:c.longitude,msl:(c.altitude!=null&&c.altitude===c.altitude)?c.altitude-PH.geoid:null,
    speed:c.speed,heading:c.heading,acc:c.accuracy,t:p.timestamp||Date.now(),recv:Date.now()};
  PH.phoneFix=fx;
  if(PH.useGlo()) return;
  PH.applyFix(fx);
};
PH.useGlo=function(){
  const g=PH.glo.fix;
  if(PH.srcPref==='phone') return false;
  if(PH.srcPref==='glo') return PH.glo.want || !!PH.glo.port;   // solo GLO 2: se tace, bandierine rosse
  return !!g && Date.now()-g.recv<2500;
};
PH.applyFix=function(fx){
  const now=performance.now(), tFix=fx.t;
  PH.acc=fx.acc; PH.src=fx.src; S.sats=fx.sats!=null?fx.sats:null; S.hdop=fx.hdop!=null?fx.hdop:null;
  PH.lastFix={lat:fx.lat,lon:fx.lon,t:fx.recv||Date.now(),acc:fx.acc,gs:null,src:fx.src};
  if(PH.demo) return;
  const prev=PH.prevFix, dtF=prev?clamp((tFix-prev.t)/1000,0.05,10):1;
  let gs=fx.speed, trk=fx.heading;
  if((gs==null||gs!==gs) && prev){ const d=distBrg(prev,fx); gs=d.d/dtF; if(gs>2) trk=d.brg; }
  gs=gs||0;
  PH.prevFix={lat:fx.lat,lon:fx.lon,t:tFix};
  S.lat=fx.lat; S.lon=fx.lon; S.gpsReal=true;
  if(PH.gsPrev!=null) PH.dvdt+=(clamp((gs-PH.gsPrev)/dtF,-4,4)-PH.dvdt)*Math.min(1,dtF/2); PH.gsPrev=gs;
  S.gs=gs*3.6; if(!PH.extAir()) S.ias=S.gs; PH.lastFix.gs=S.gs;
  if(gs>1.5 && trk!=null && trk===trk) S.trk=trk;
  else if(gs<1.2) S.trk=null;                    // fermo: la traccia GPS è solo rumore, conta la prua
  // velocità di virata dalla traccia GPS: serve all'orizzonte quando il giroscopio manca o non segue la virata
  if(gs>8 && trk!=null && trk===trk && PH.trkPrev!=null && dtF<3){ const rt=clamp(angDiff(trk,PH.trkPrev)/dtF,-20,20);
    PH.trkRate+=(rt-PH.trkRate)*Math.min(1,dtF/1.5); PH.trkRateT=now; }
  else if(gs<=8){ PH.trkRate=0; }
  PH.trkPrev=(gs>8&&trk!=null&&trk===trk)?trk:null;
  // prua: riallineata alla traccia (corretta con il vento stimato) quando si va abbastanza veloci
  if(S.gs>25 && S.trk!=null){
    let tgt=S.trk;
    if(WIND.valid && WIND.src==='stim'){ const vE=gs*Math.sin(S.trk*D2R)-WIND.E, vN=gs*Math.cos(S.trk*D2R)-WIND.N; if(Math.hypot(vE,vN)>8) tgt=wrap360(Math.atan2(vE,vN)*R2D); }
    if(PH.hdg==null) PH.hdg=tgt; else PH.hdg=wrap360(PH.hdg+angDiff(tgt,PH.hdg)*Math.min(1,dtF/3));
    S.hdg=PH.hdg;
  }
  // quota: ellissoide WGS84 -> livello del mare (geoide) + taratura sul campo
  if(fx.msl!=null){
    const msl=fx.msl, ofs=PH.altOfsBy[fx.src]||0;
    if(PH.altSrc!==fx.src){ PH.altSrc=fx.src; PH.vario.h=NaN; }      // cambio di fonte: il filtro riparte dalla nuova quota
    PH.mslRaw=msl;
    PH.vario.correct(msl+ofs,dtF);
    if(!PH.extBaro()){ S.alt=PH.vario.h/FT2M; S.vs=clamp(PH.vario.v,-30,30); }
    LIVE.baro=now;
    PH.autoCal(msl,gs,fx.acc,fx.src,tFix);
  }
  LIVE.gps=now; LIVE.air=now; LIVE.any=true; S.auto=false;
  PH.windSample(gs,tFix);
  PH.logFix(gs,tFix);
};
PH.onPosErr=function(err){ PH.gpsErr=err&&err.message||'errore'; if(err&&err.code===1) PH.gpsDenied=true; };
// taratura della quota: fermi su un campo di quota nota, la quota GPS si allinea al campo
PH.autoCal=function(msl,gs,acc,src,t){
  if(gs>0.8 || acc>20 || (PH.stillBuf.length && PH.stillBuf[0].src!==src)){ PH.stillBuf=[]; if(gs>0.8||acc>20) return; }
  PH.stillBuf.push({m:msl,t,src}); if(t-PH.stillBuf[0].t<20000 || PH.stillBuf.length<10) return;
  const f=FIELDS.map(x=>({x,d:distBrg(S,x).d})).filter(o=>o.d<700 && !o.x.elevUnknown && (ELEV_CONFIRMED[o.x.id]!=null||o.x.elft!=null)).sort((a,b)=>a.d-b.d)[0];
  if(!f){ PH.stillBuf.shift(); return; }
  const mean=PH.stillBuf.reduce((s,v)=>s+v.m,0)/PH.stillBuf.length, ofs=f.x.elev-mean;
  PH.stillBuf=[];
  if(Math.abs(ofs)>120) return;
  const changed=!PH.altCal || PH.altCal.field!==f.x.short || Math.abs(ofs-(PH.altOfsBy[src]||0))>3;
  PH.altOfsBy[src]=ofs; PH.altOfs=ofs; PH.altCal={field:f.x.short,t:Date.now(),src};
  lsSet('ia517p_altofs2',PH.altOfsBy); lsSet('ia517p_altcal',PH.altCal);
  PH.vario.h=NaN;
  if(changed) toast(`QUOTA TARATA SU ${f.x.short}: ${Math.round(f.x.elev/FT2M)} ft`);
};
// vento e velocità vera dalle virate: senza Pitot, |v_suolo − vento| = TAS costante
PH.windSample=function(gs,tFix){
  if(gs<12.5 || S.trk==null) { return; }
  const now=tFix||Date.now(), b=PH.windBuf;
  if(b.length && now-b[b.length-1][2]<900) return;
  b.push([gs*Math.sin(S.trk*D2R),gs*Math.cos(S.trk*D2R),now]);
  while(b.length && (b.length>100 || now-b[0][2]>180000)) b.shift();
  if(b.length<20) return;
  let cx=0,cy=0; for(const [e,n] of b){ const m=Math.hypot(e,n)||1; cx+=e/m; cy+=n/m; }
  if(Math.hypot(cx,cy)/b.length>0.85) return;               // serve una virata
  const A=[[0,0,0],[0,0,0],[0,0,0]], y=[0,0,0];
  for(const [e,n] of b){ const row=[2*e,2*n,-1], t=e*e+n*n; for(let i=0;i<3;i++){ y[i]+=row[i]*t; for(let j=0;j<3;j++) A[i][j]+=row[i]*row[j]; } }
  const det=m=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
  const D=det(A); if(Math.abs(D)<1e-6) return;
  const col=i=>A.map((r,ri)=>r.map((v,ci)=>ci===i?y[ri]:v));
  const wE=det(col(0))/D, wN=det(col(1))/D, cc=det(col(2))/D, tas2=wE*wE+wN*wN-cc;
  if(!(tas2>15*15 && tas2<70*70) || Math.hypot(wE,wN)>25) return;
  const tas=Math.sqrt(tas2);
  if(WIND.valid && WIND.src==='stim'){ WIND.E=WIND.E*0.8+wE*0.2; WIND.N=WIND.N*0.8+wN*0.2; PH.tas=PH.tas*0.8+tas*0.2; }
  else { WIND.E=wE; WIND.N=wN; PH.tas=tas; }
  WIND.valid=true; WIND.src='stim'; WIND.t=now; WIND.kmh=Math.hypot(WIND.E,WIND.N)*3.6; WIND.dir=wrap360(Math.atan2(-WIND.E,-WIND.N)*R2D);
};
// vento previsto (Open-Meteo, dal piano) per la pista di destinazione finché non c'è quello stimato
PH.applyForecast=function(){
  if(WIND.valid && WIND.src==='stim' && Date.now()-(WIND.t||0)<20*60000) return;
  const f=NAV.dest; if(!f) return;
  let w=PH.wx[f.id];
  if(!w){ let bd=25000; for(const [id,v] of Object.entries(PH.wx)){ if(v.lat==null) continue; const d=distBrg(f,v).d; if(d<bd){ bd=d; w=v; } } }
  if(!w || w.kmh==null) return;
  const s=w.kmh/3.6, d=w.dir*D2R;
  Object.assign(WIND,{valid:true,src:'prev',E:-s*Math.sin(d),N:-s*Math.cos(d),kmh:w.kmh,dir:w.dir});
};

// ---- diario di volo ----
PH.logFix=function(gs,tFix){
  const now=tFix||Date.now(), kmh=gs*3.6;
  if(!PH.flight){
    if(kmh>55){ if(!PH.fastSince) PH.fastSince=now; } else PH.fastSince=0;
    if(PH.fastSince && now-PH.fastSince>=5000){
      const near=FIELDS.map(x=>({x,d:distBrg(S,x).d})).sort((a,b)=>a.d-b.d)[0];
      PH.flight={start:now,from:near&&near.d<3000?near.x.short:'',pts:[],maxFt:0,dist:0,ac:(PH.ac&&PH.ac.reg)||''}; NAV.airborne=true; PH.slowSince=0; PH.fastSince=0;
      PH.say('decollo'); PH.saveFlight();
    }
  }
  const F_=PH.flight; if(!F_) return;
  const last=F_.pts[F_.pts.length-1];
  if(!last || now-last[3]>=2000){
    if(last) F_.dist+=distBrg({lat:last[0],lon:last[1]},S).d;
    F_.pts.push([+S.lat.toFixed(6),+S.lon.toFixed(6),Math.round(S.alt),now,Math.round(kmh)]);
    F_.maxFt=Math.max(F_.maxFt,Math.round(S.alt));
    if(F_.pts.length%10===0) PH.saveFlight();
  }
  if(kmh<20){ if(!PH.slowSince) PH.slowSince=now; if(now-PH.slowSince>=30000){ PH.slowSince=0; PH.endFlight(now); } } else PH.slowSince=0;
};
PH.saveFlight=function(){ try{ localStorage.setItem('ia517p_curflight',JSON.stringify(PH.flight)); }catch(e){} };
PH.endFlight=function(tEnd){
  const F_=PH.flight; if(!F_) return; PH.flight=null;
  try{ localStorage.removeItem('ia517p_curflight'); }catch(e){}
  const near=FIELDS.map(x=>({x,d:distBrg(S,x).d})).sort((a,b)=>a.d-b.d)[0];
  F_.end=tEnd||Date.now(); F_.to=near&&near.d<3000?near.x.short:'';
  try{ if(PH.ac) lsSet('ia517p_decel_'+PH.ac.id,DECEL); }catch(e){}
  PH.trkPut(F_.start,F_.pts||[]).then(ok=>{                 // la traccia va nel database del telefono, il diario resta leggero
    const book=lsGet('ia517p_logbook',[]); const e=Object.assign({},F_); delete e.pts; e.trk=ok?(F_.pts||[]).length:0; book.unshift(e);
    lsSet('ia517p_logbook',book.slice(0,200)); PH.trkPrune(book); PH.renderLog&&PH.renderLog(); });
};
// ---- tracce dei voli: IndexedDB (spazio molto più grande di localStorage); le ultime 50 restano sempre ----
PH.TRK_KEEP=50;
PH.trkDb=function(){ if(PH._db) return PH._db; PH._db=new Promise((res,rej)=>{ try{ const r=indexedDB.open('ia517_tracce',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('trk'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }catch(e){ rej(e); } }); return PH._db; };
PH.trkPut=async function(k,pts){ try{ const db=await PH.trkDb(); await new Promise((res,rej)=>{ const t=db.transaction('trk','readwrite'); t.objectStore('trk').put(pts,k); t.oncomplete=res; t.onerror=()=>rej(t.error); }); return true; }catch(e){ PH.logErr&&PH.logErr('traccia non salvata: '+e); return false; } };
PH.trkGet=async function(k){ try{ const db=await PH.trkDb(); return await new Promise((res,rej)=>{ const r=db.transaction('trk').objectStore('trk').get(k); r.onsuccess=()=>res(r.result||null); r.onerror=()=>rej(r.error); }); }catch(e){ return null; } };
PH.trkDel=async function(k){ try{ const db=await PH.trkDb(); db.transaction('trk','readwrite').objectStore('trk').delete(k); }catch(e){} };
PH.trkPrune=function(book){ book.slice(PH.TRK_KEEP).forEach(f=>{ if(f.trk){ PH.trkDel(f.start); f.trk=0; } }); lsSet('ia517p_logbook',book.slice(0,200)); };
// tracce dei voli vecchi (dentro il diario) spostate nel database, una volta sola
(async()=>{ const book=lsGet('ia517p_logbook',[]); let ch=false;
  for(const f of book) if(f.pts){ if(await PH.trkPut(f.start,f.pts)){ f.trk=f.pts.length; delete f.pts; ch=true; } }
  if(ch) lsSet('ia517p_logbook',book); })();
// traccia sulla mappa
PH.trackShow=null;
PH.drawTrack=function(toS){ const T=PH.trackShow; if(!T||!T.pts||T.pts.length<2) return;
  ctx.save(); ctx.lineJoin='round'; ctx.lineCap='round';
  for(const [w,c] of [[6,'rgba(0,0,0,.55)'],[3,'#ffd23f']]){ ctx.strokeStyle=c; ctx.lineWidth=w*k; ctx.beginPath();
    T.pts.forEach((p,i)=>{ const q=enu(p[0],p[1]), s2=toS(q.E,q.N); if(i) ctx.lineTo(s2.x,s2.y); else ctx.moveTo(s2.x,s2.y); }); ctx.stroke(); }
  ctx.restore(); };
PH.gpx=function(F_){
  const esc=s=>String(s).replace(/[<&>]/g,c=>({'<':'&lt;','&':'&amp;','>':'&gt;'}[c]));
  const name=`${F_.ac||'HORIZON'} ${new Date(F_.start).toISOString().slice(0,16).replace('T',' ')} ${F_.from||''}-${F_.to||''}`;
  const pts=(F_.pts||[]).map(p=>`<trkpt lat="${p[0]}" lon="${p[1]}"><ele>${(p[2]*FT2M).toFixed(1)}</ele><time>${new Date(p[3]).toISOString()}</time></trkpt>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="HORIZON" xmlns="http://www.topografix.com/GPX/1/1">\n<trk><name>${esc(name)}</name><trkseg>\n${pts}\n</trkseg></trk>\n</gpx>\n`;
};
PH.download=async function(name,text,type){
  if(PH.native&&PH.native.fs){
    try{ const r=await PH.native.fs.writeFile({path:name,data:text,directory:'CACHE',encoding:'utf8'});
      if(PH.native.share) await PH.native.share.share({title:name,files:[r.uri],dialogTitle:'Salva o invia '+name});
      else toast('SALVATO '+name); }
    catch(e){ if(!/cancel/i.test(String(e&&e.message))) toast('FILE NON SALVATO'); }
    return; }
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:type||'application/octet-stream'})); a.download=name;
  document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1500);
};

// ---- profilo verticale: terreno, spazi aerei, quota dell'aereo e della rotta, lungo la rotta o davanti all'aereo ----
PH.profRange=lsGet('ia517p_profr','rotta');
PH.profOpen=function(){
  const bar=el('phProfBar'), opts=[['rotta','Rotta'],['10','10 km'],['25','25 km'],['50','50 km'],['100','100 km']];
  bar.innerHTML=opts.map(([k2,l])=>`<button type="button" data-r="${k2}" aria-pressed="${PH.profRange===k2}">${l}</button>`).join('');
  bar.querySelectorAll('button').forEach(b=>b.onclick=()=>{ PH.profRange=b.dataset.r; lsSet('ia517p_profr',PH.profRange); bar.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b)); PH.profDraw(); });
  clearInterval(PH.profT); PH.profT=setInterval(PH.profDraw,1000); requestAnimationFrame(PH.profDraw); PH.act('profilo');
};
PH.profClose=function(){ clearInterval(PH.profT); PH.profT=null; };
// percorso davanti: posizione attuale, poi i punti di rotta che restano (o la destinazione, o la traccia)
PH.profPath=function(){
  const here={lat:S.lat,lon:S.lon,name:''}, pts=[here]; let what='traccia';
  if(NAV.route && NAV.route.r && NAV.route.r.wps){ const w=NAV.route.r.wps; for(let i=Math.max(1,NAV.route.idx);i<w.length;i++) pts.push({lat:w[i].lat,lon:w[i].lon,name:(w[i].name||w[i].id||'').toUpperCase().slice(0,12)}); what='rotta'; }
  else if(NAV.dest && NAV.dest.lat!=null){ pts.push({lat:NAV.dest.lat,lon:NAV.dest.lon,name:(NAV.dest.short||'').toUpperCase()}); what='destinazione'; }
  const rngKm=PH.profRange==='rotta'?null:+PH.profRange;
  if(pts.length<2 || rngKm){ const tr=((S.trk!=null)?S.trk:S.hdg)*D2R, R0=(rngKm||25)*1000, cl=Math.cos(S.lat*D2R);
    if(pts.length<2){ pts.push({lat:S.lat+Math.cos(tr)*R0/110540,lon:S.lon+Math.sin(tr)*R0/(111320*cl),name:''}); what='traccia'; } }
  // distanze cumulate e taglio alla portata scelta
  let d=0; const out=[{...pts[0],d:0}];
  for(let i=1;i<pts.length;i++){ const s2=distBrg(pts[i-1],pts[i]).d; if(rngKm && d+s2>rngKm*1000){ const f=(rngKm*1000-d)/s2;
      out.push({lat:pts[i-1].lat+(pts[i].lat-pts[i-1].lat)*f,lon:pts[i-1].lon+(pts[i].lon-pts[i-1].lon)*f,name:'',d:rngKm*1000}); break; }
    d+=s2; out.push({...pts[i],d}); }
  return {pts:out,what,total:out[out.length-1].d};
};
PH.profDraw=function(){
  const cv=el('phProfCv'); if(!cv || el('phProf').hidden) return;
  const dpr=devicePixelRatio||1, W=cv.clientWidth, H=cv.clientHeight; if(W<50||H<50) return;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){ cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); }
  const c=cv.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,W,H);
  const P=PH.profPath(), tot=Math.max(500,P.total), N=Math.min(400,Math.max(60,Math.round(W/2)));
  // campioni lungo il percorso
  const S2=[]; let seg=0;
  for(let k=0;k<=N;k++){ const dd=tot*k/N; while(seg<P.pts.length-2 && P.pts[seg+1].d<dd) seg++;
    const a=P.pts[seg], b=P.pts[Math.min(seg+1,P.pts.length-1)], f=b.d>a.d?(dd-a.d)/(b.d-a.d):0, lat=a.lat+(b.lat-a.lat)*f, lon=a.lon+(b.lon-a.lon)*f, z=phDemAt(lat,lon,11);
    S2.push({d:dd,lat,lon,ft:z===z?z/FT2M:NaN}); }
  const asp=PH.aspList(), cruise=(NAV.route&&NAV.route.r&&NAV.route.r.cruiseFt)||null;
  // spazi aerei lungo il percorso: per ogni area, i tratti in cui ci sei dentro, con base e tetto
  const runs=[]; const near=asp.filter(a=>{ const bb=a.bb; if(!bb||a.cls==='FMC') return false; return S2.some(p=>p.lat>=bb[0]&&p.lat<=bb[1]&&p.lon>=bb[2]&&p.lon<=bb[3]); });
  for(const a of near){ let r=null;
    for(let k=0;k<S2.length;k++){ const p=S2[k], bb=a.bb, ins=p.lat>=bb[0]&&p.lat<=bb[1]&&p.lon>=bb[2]&&p.lon<=bb[3]&&PH.pip(p,a.pts);
      if(ins){ const tf=p.ft===p.ft?p.ft:0, lo=a.lo.ref==='AGL'?(a.lo.ft?a.lo.ft+tf:-1e9):a.lo.ft, hi=a.hi.ref==='AGL'?a.hi.ft+tf:a.hi.ft;
        if(!r){ r={a,k0:k,cols:[]}; runs.push(r); } r.cols.push({k,lo,hi}); } else r=null; } }
  let top=Math.max(S.alt||0,cruise||0,...S2.map(p=>p.ft===p.ft?p.ft:0))+1500;
  for(const r of runs) for(const q of r.cols) if(q.lo>-1e8 && q.lo<top+3000) top=Math.max(top,Math.min(q.hi,q.lo+2500));
  top=Math.min(14000,Math.ceil(top/1000)*1000);
  const L=44, R=W-8, T=8, B=H-26, x=d=>L+(R-L)*d/tot, y=ft=>B-(B-T)*Math.max(0,ft)/top;
  c.fillStyle='#0b1622'; c.fillRect(0,0,W,H);
  // griglia
  c.strokeStyle='rgba(255,255,255,.08)'; c.lineWidth=1; c.font='600 11px system-ui'; c.fillStyle='#8a96a3'; c.textAlign='right'; c.textBaseline='middle';
  const stepF=top>8000?2000:1000; for(let f=0;f<=top;f+=stepF){ c.beginPath(); c.moveTo(L,y(f)); c.lineTo(R,y(f)); c.stroke(); c.fillText(f>=1000?(f/1000)+'k':String(f),L-6,y(f)); }
  const stepD=tot>60000?20000:(tot>25000?10000:(tot>8000?2000:1000)); c.textAlign='center'; c.textBaseline='top';
  for(let d=0;d<=tot;d+=stepD){ c.beginPath(); c.moveTo(x(d),T); c.lineTo(x(d),B); c.stroke(); c.fillText(Math.round(d/1000)+' km',x(d),B+6); }
  // spazi aerei (rosso = vietato per il tipo di volo, arancio = attenzione, blu = consentito)
  const R_=window.IA517_RULES, dx=(R-L)/N;
  for(const r of runs){ let v={status:'warn'}; try{ v=R_.verdict(r.a); }catch(e){}
    const col=v.status==='bad'?[255,70,70]:(v.status==='warn'?[255,176,32]:[90,160,255]);
    c.fillStyle=`rgba(${col},.22)`; c.strokeStyle=`rgba(${col},.95)`; c.lineWidth=1.5;
    c.beginPath(); r.cols.forEach((q,i)=>{ const X=x(S2[q.k].d), Y=y(Math.min(q.hi,top)); i?c.lineTo(X,Y):c.moveTo(X-dx/2,Y); }); for(let i=r.cols.length-1;i>=0;i--){ const q=r.cols[i]; c.lineTo(x(S2[q.k].d)+(i===r.cols.length-1?dx/2:0),y(q.lo<-1e8?0:q.lo)); } c.closePath(); c.fill(); c.stroke();
    const mid=r.cols[Math.floor(r.cols.length/2)], lab=`${r.a.cls} ${String(r.a.name).slice(0,22)}`;
    if(r.cols.length*dx>60){ c.font='700 11px system-ui'; c.textAlign='center'; c.textBaseline='bottom'; c.fillStyle=`rgb(${col})`; c.fillText(lab,x(S2[mid.k].d),Math.max(T+12,y(Math.min(mid.hi,top))+14)); } }
  // terreno
  c.beginPath(); c.moveTo(L,B); S2.forEach(p=>c.lineTo(x(p.d),y(p.ft===p.ft?p.ft:0))); c.lineTo(R,B); c.closePath();
  const gr=c.createLinearGradient(0,T,0,B); gr.addColorStop(0,'#8a6a3a'); gr.addColorStop(1,'#2f5a2a'); c.fillStyle=gr; c.fill();
  c.strokeStyle='#c9a46a'; c.lineWidth=1.5; c.beginPath(); S2.forEach((p,i)=>{ const Y=y(p.ft===p.ft?p.ft:0); i?c.lineTo(x(p.d),Y):c.moveTo(x(p.d),Y); }); c.stroke();
  // quota della rotta e punti
  if(cruise){ c.strokeStyle='#ff46e0'; c.lineWidth=2.5; c.setLineDash([8,5]); c.beginPath(); c.moveTo(L,y(cruise)); c.lineTo(R,y(cruise)); c.stroke(); c.setLineDash([]);
    c.fillStyle='#ff46e0'; c.textAlign='right'; c.textBaseline='bottom'; c.font='700 11px system-ui'; c.fillText('crociera '+cruise+' ft',R-4,y(cruise)-3); }
  c.font='700 11px system-ui'; c.textAlign='center';
  for(const p of P.pts.slice(1)){ if(!p.name) continue; const X=x(p.d); c.strokeStyle='rgba(255,70,224,.6)'; c.lineWidth=1; c.beginPath(); c.moveTo(X,T); c.lineTo(X,B); c.stroke();
    c.fillStyle='#ff9af0'; c.textBaseline='top'; c.save(); c.translate(X+4,T+4); c.rotate(Math.PI/2); c.textAlign='left'; c.fillText(p.name,0,0); c.restore(); }
  // aereo: quota attuale e dove porta il vario nei prossimi 2 minuti
  const ya=y(S.alt||0), v=S.gs/3.6, t2=Math.min(120,v>1?tot/v:120), dEnd=Math.min(tot,v*t2), aEnd=(S.alt||0)+(S.vs||0)/FT2M*t2;
  c.strokeStyle='#fff'; c.lineWidth=2; c.setLineDash([4,4]); c.beginPath(); c.moveTo(L,ya); c.lineTo(x(dEnd),y(aEnd)); c.stroke(); c.setLineDash([]);
  c.fillStyle='#fff'; c.strokeStyle='#000'; c.lineWidth=1.5; c.beginPath(); c.moveTo(L+12,ya); c.lineTo(L-2,ya-7); c.lineTo(L-2,ya+7); c.closePath(); c.fill(); c.stroke();
  c.textAlign='left'; c.textBaseline='bottom'; c.font='800 12px system-ui'; c.fillStyle='#fff'; c.fillText(Math.round(S.alt||0)+' ft',L+16,ya-4);
  // riepilogo sotto: terreno più alto davanti, primo spazio da evitare, margine
  const ahead=S2.filter(p=>p.ft===p.ft), mx=ahead.reduce((m,p)=>p.ft>m.ft?p:m,{ft:-1e9,d:0});
  const firstBad=runs.filter(r=>{ try{ return R_.verdict(r.a).status==='bad'; }catch(e){ return false; } }).map(r=>({r,d:S2[r.k0].d,lo:r.cols[0].lo,hi:r.cols[0].hi})).filter(q=>q.lo-50<=Math.max(S.alt||0,cruise||0)&&q.hi+50>=Math.min(S.alt||0,cruise||1e9)).sort((a,b)=>a.d-b.d)[0];
  const clr=mx.ft>-1e8?Math.round((S.alt||0)-mx.ft):null, h=PH.aspHere&&PH.aspHere();
  const here=h&&h.inside&&h.inside.length?h.inside.map(q=>`${q.a.cls} ${q.a.name}`).slice(0,2).join(' · '):'classe G';
  el('phProfInfo').innerHTML=`<div>${P.what==='traccia'?'Davanti, sulla traccia':(P.what==='rotta'?'Lungo la rotta':'Verso la destinazione')} · ${(tot/1000).toFixed(tot<10000?1:0)} km · ora in: <b>${here}</b></div>`+
    (mx.ft>-1e8?`<div class="${clr<500?'b':(clr<1000?'w':'o')}">Terreno più alto: ${Math.round(mx.ft)} ft a ${(mx.d/1000).toFixed(1)} km · margine alla quota attuale ${clr} ft</div>`:'<div class="w">Quote del terreno in arrivo…</div>')+
    (firstBad?`<div class="b">${firstBad.d<150?'Sei dentro':'A '+(firstBad.d/1000).toFixed(1)+' km'}: ${firstBad.r.a.cls} ${firstBad.r.a.name} (${firstBad.r.a.lo.txt}–${firstBad.r.a.hi.txt}) vietato per il tuo tipo di volo</div>`:'')+
    (asp.length?'':'<div class="w">Spazi aerei non caricati: Piano › Briefing.</div>');
};
PH.tqNow=function(){ const e=el('phTqNow'); if(e) e.textContent=PH.terrQ==='auto'?'ora: '+['normale','alto','massimo'][PH.terrLvl]+` · ${PH.perf.avg.toFixed(0)} ms per fotogramma`:''; };
// livello automatico: se il disegno occupa troppo del tempo di un fotogramma si scende, se avanza molto si risale
setInterval(()=>{ if(!PH || PH.terrQ!=='auto' || document.hidden) return; const budget=1000/(PH.fps||30), avg=PH.perf.avg;
  if(avg>budget*0.7){ PH.terrLow++; PH.terrHigh=0; if(PH.terrLow>=2 && PH.terrLvl>0){ PH.terrLvl--; PH.terrLow=0; PH.act&&PH.act('terreno 3D: livello '+PH.terrLvl); } }
  else if(avg<budget*0.35){ PH.terrHigh++; PH.terrLow=0; if(PH.terrHigh>=6 && PH.terrLvl<2){ PH.terrLvl++; PH.terrHigh=0; } }
  else { PH.terrLow=0; PH.terrHigh=0; }
  PH.tqNow(); },1500);
// ---- avvisi: terreno davanti, spazi aerei, tramonto ----
PH.alertMute={}; PH.alertSeen={};
// un tocco sull'avviso lo toglie dal video: per uno spazio aereo finché non ne esci, per gli altri per 1 minuto
PH.alert=function(key,level,text,every){
  const now=Date.now(), last=PH.alerts[key]||0; PH.alertSeen[key]=now;
  const m=PH.alertMute[key]; if(m && (m===true || now<m)) return;
  PH.showAlert(level,text,key);
  if(now-last<(every||60000)) return;
  PH.alerts[key]=now; PH.say(text,level==='W'); PH.buzz(level==='W'?[300,100,300,100,300]:[150,80,150]);
};
PH.showAlert=function(level,text,key){
  const d=el('phAlert'); if(!d) return;
  d.innerHTML=''; d.append(document.createTextNode(text)); const sm=document.createElement('small'); sm.textContent='tocca per togliere'; d.append(sm);
  d.className='ph-alert '+(level==='W'?'w':'c'); d.hidden=false; d.dataset.key=key||'';
  if(!d.onclick) d.onclick=ev=>{ ev.stopPropagation(); const k=d.dataset.key; d.hidden=true; clearTimeout(PH.alertT);
    if(k) PH.alertMute[k]=/^asp/.test(k)?true:Date.now()+60000; PH.act&&PH.act('avviso tolto '+k); };
  clearTimeout(PH.alertT); PH.alertT=setTimeout(()=>{ d.hidden=true; },level==='W'?4000:6000);
};
// lo spazio aereo torna ad avvisare quando ne sei uscito da più di 2 minuti
setInterval(()=>{ const now=Date.now(); for(const k in PH.alertMute) if(PH.alertMute[k]===true && now-(PH.alertSeen[k]||0)>120000) delete PH.alertMute[k]; },10000);
PH.checkTerrain=function(){
  if(PH.demo || !PH.flight || !S.gpsReal || lost('gps')) return;
  const ac=enu(S.lat,S.lon); if(tawsInhibit(ac.E,ac.N)) return;
  const v=S.gs/3.6, tr=(S.trk!=null?S.trk:S.hdg)*D2R; let lvl=null;
  for(let t=0;t<=60;t+=5){
    const E=ac.E+Math.sin(tr)*v*t, N=ac.N+Math.cos(tr)*v*t, z=terrain(E,N); if(z!==z) continue;
    const clr=(S.alt*FT2M+S.vs*t-z)/FT2M;
    if(t<=30 && clr<100){ lvl='W'; break; }
    if(clr<300) lvl=lvl||'C';
  }
  if(lvl==='W') PH.alert('taws','W','TERRENO! CABRA',5000);
  else if(lvl==='C') PH.alert('tawsc','C','ATTENZIONE TERRENO',30000);
};
PH.pip=function(p,poly){ let ins=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){ const a=poly[i], b=poly[j];
  if(((a.lat>p.lat)!==(b.lat>p.lat)) && (p.lon<(b.lon-a.lon)*(p.lat-a.lat)/(b.lat-a.lat)+a.lon)) ins=!ins; } return ins; };
PH.aspList=function(){ try{ const w=el('phAppFrame').contentWindow; if(w && w.IA517_asp) return w.IA517_asp(); }catch(e){} return []; };
PH.checkAirspace=function(){
  if(!(PH.sim || (PH.flight && S.gpsReal && !PH.demo))) return;
  const list=PH.aspList();
  if(!list.length) return;
  const v=S.gs/3.6, tr=(S.trk!=null?S.trk:S.hdg)*D2R, cosl=Math.cos(S.lat*D2R);
  const at=t=>({lat:S.lat+Math.cos(tr)*v*t/110540, lon:S.lon+Math.sin(tr)*v*t/(111320*cosl), ft:S.alt+S.vs*t/FT2M});
  const lim=(L,p)=>{ if(L.ref==='AGL'){ const z=terrain(...xy(enu(p.lat,p.lon))); return L.ft+(z===z?z/FT2M:0); } return L.ft; };
  for(const a of list){
    if(!window.IA517_RULES || !IA517_RULES.alerting(a)) continue;
    const bb=a.bb; if(!bb || S.lat<bb[0]-0.1 || S.lat>bb[1]+0.1 || S.lon<bb[2]-0.15 || S.lon>bb[3]+0.15) continue;
    const label=`${a.cls} ${a.name}`.slice(0,40);
    for(const t of [0,30,60]){ const p=at(t);
      if(PH.pip(p,a.pts) && p.ft>=lim(a.lo,p)-100 && p.ft<=lim(a.hi,p)+100){
        if(t===0){ const v=IA517_RULES.verdict(a); PH.alert('asp0'+a.name,v.status==='bad'?'W':'C','DENTRO '+label+(v.status==='bad'?' · VIETATO '+IA517_RULES.PROFILES[IA517_RULES.get()].short:''),120000); }
        else PH.alert('asp1'+a.name,'C',`TRA ${t===30?'30 SECONDI':'1 MINUTO'}: ${label} · ${a.lo.txt}–${a.hi.txt}`,180000);
        break; } }
  }
};
// spazio aereo dove sei adesso, alla tua quota (con il giudizio del tipo di volo) e il primo spazio sopra di te
PH.top5=function(){ const now=performance.now(); if(PH.t5 && now-PH.t5.t<5000 && Math.abs(PH.t5.lat-S.lat)<0.01 && Math.abs(PH.t5.lon-S.lon)<0.014) return PH.t5.ft;
  let m=-1e9, ok=0; const cosl=Math.cos(S.lat*D2R);
  for(const r of [0,2500,5000]) for(let k=0;k<(r?8:1);k++){ const a=k*Math.PI/4, z=phDemAt(S.lat+r*Math.cos(a)/110540, S.lon+r*Math.sin(a)/(111320*cosl), 10); if(z===z){ ok++; if(z>m) m=z; } }
  const ft=ok?m/FT2M:NaN; PH.t5={t:now,lat:S.lat,lon:S.lon,ft}; return ft; };
PH.aspHere=function(){
  const list=PH.aspList(), R=window.IA517_RULES; if(!R) return null;
  const p={lat:S.lat,lon:S.lon}, ft=S.alt, inside=[], above=[];
  const lim=(L)=>{ if(L.ref==='AGL'){ if(!L.ft) return -1e9;                  // SFC/GND: dal suolo, anche se la quota GPS è sotto il terreno
      const z=terrain(...xy(enu(p.lat,p.lon))); return L.ft+(z===z?z/FT2M:0); } return L.ft; };
  for(const a of list){ const bb=a.bb; if(!bb || p.lat<bb[0] || p.lat>bb[1] || p.lon<bb[2] || p.lon>bb[3] || !PH.pip(p,a.pts)) continue;
    const lo=lim(a.lo), hi=lim(a.hi);
    if(ft>=lo-50 && ft<=hi+50) inside.push({a,v:R.verdict(a)}); else if(lo>ft) above.push({a,lo}); }
  const rank={bad:2,warn:1,ok:0}; inside.sort((x,y)=>rank[y.v.status]-rank[x.v.status]);
  above.sort((x,y)=>x.lo-y.lo);
  return {n:list.length, inside, above:above[0]||null};
};
PH.renderAsp=function(){
  const b=el('phAsp'), R=window.IA517_RULES; if(!b||!R) return;
  const esc=x=>String(x).replace(/[<&>]/g,c=>({'<':'&lt;','&':'&amp;','>':'&gt;'}[c]));
  const prof=R.get(), pn=R.PROFILES[prof].short, h=PH.aspHere(); let cls='o', txt;
  if(!h || !h.n){ cls='w'; txt=`<b>SPAZI AEREI NON CARICATI</b> · Piano › Briefing › Scarica gli spazi aerei d'Italia`; }
  else if(!h.inside.length || h.inside.every(x=>x.v.status==='ok')){ const fmc=h.inside.find(x=>x.a.cls==='FMC'), sq=fmc&&(String(fmc.a.name).match(/SSR\s*(\d{4})/i)||[])[1];
    const cl=h.inside.find(x=>/^[A-G]$/.test(x.a.cls)); txt=`<b>CLASSE ${cl?esc(cl.a.cls):'G'}</b> · ${pn}: consentito`+(fmc?` · area FMC${sq?': squawk '+sq:''} e ascolto (raccomandati)`:''); }
  else { const x=h.inside[0]; cls=x.v.status==='bad'?'b':(x.v.status==='warn'?'w':'o');
    txt=`<b>${esc(x.a.cls)} · ${esc(String(x.a.name).slice(0,28))}</b> · ${esc(x.a.lo.txt)}–${esc(x.a.hi.txt)} · ${x.v.status==='bad'?'VIETATO '+pn:(x.v.status==='warn'?'ATTENZIONE':'consentito')}`+(h.inside.length>1?` · +${h.inside.length-1}`:''); }
  if(h && h.n && h.above){ const gap=h.above.lo-S.alt; txt+=` · sopra: ${esc(h.above.a.cls)} ${esc(String(h.above.a.name).slice(0,18))} da ${esc(h.above.a.lo.txt)}${gap<300?' <i>(vicina)</i>':''}`; if(gap<300 && cls==='o' && R.verdict(h.above.a).status==='bad') cls='w'; }
  if(prof==='vds_basico'){ const t5=PH.top5(), max=t5===t5?t5+R.vdsMaxAgl(new Date()):NaN;
    if(max===max){ const over=S.alt-max; txt+=` · max VDS ${Math.round(max/50)*50} ft`;
      if(over>50){ cls='b'; txt=`<b>SOPRA IL LIMITE VDS BASICO</b> (${Math.round(max/50)*50} ft) · `+txt;
        if((PH.flight&&S.gpsReal)||PH.sim) PH.alert('vdsalt','C',`SOPRA IL LIMITE VDS: MASSIMO ${Math.round(max/50)*50} PIEDI`,60000); } } }
  b.className='ph-asp '+cls; b.innerHTML=txt;
};
PH.checkSun=function(){
  const now=new Date(), day=now.toDateString()+Math.round(S.lat)+Math.round(S.lon);
  if(PH.sunDay!==day){ PH.sun=phSun(now,S.lat,S.lon); PH.sunDay=day; }
  if(!PH.flight) return;
  const m=(PH.sun.set-now)/60000;
  if(m<30 && m>25) PH.alert('sun30','C','TRAMONTO TRA 30 MINUTI',600000);
  if(m<10 && m>5) PH.alert('sun10','W','TRAMONTO TRA 10 MINUTI',600000);
};

// ---- terreno: quote dei campi senza quota nei dati ----
PH.fieldElev=function(){
  for(const f of (PH.nearF||[])){          // solo i campi vicini: niente tessere del terreno scaricate per tutto il Nord
    if(ELEV_CONFIRMED[f.id]!=null || f.elft!=null) { f.elevUnknown=false; continue; }
    const z=phDemAt(f.lat,f.lon,11);
    if(z===z){ if(f.elevUnknown!==false || Math.abs(f.elev-z)>1){ f.elev=z; f.elevUnknown=false; f.elevSrc='DEM'; } }
    else if(f.elevSrc!=='DEM') f.elevUnknown=true;
  }
};

// ---- mappa di base (OpenTopoMap / OpenStreetMap) sotto la mappa mobile ----
// mappe di base: tessere XYZ oppure WMS (la richiesta copre esattamente la tessera in gradi)
const PH_WMS_PCN='http://wms.pcn.minambiente.it/ogc?map=/ms_ogc/WMS_v1.3/raster/';
PH.BASES={
  topo:{name:'OpenTopoMap',max:16,attr:'© OpenStreetMap · OpenTopoMap',url:(z,x,y)=>`https://${'abc'[(x+y)%3]}.tile.opentopomap.org/${z}/${x}/${y}.png`},
  osm:{name:'OpenStreetMap',max:18,attr:'© OpenStreetMap',url:(z,x,y)=>`https://tile.openstreetmap.org/${z}/${x}/${y}.png`},
  esri:{name:'Satellite Esri',max:19,key:true,attr:'Esri, Vantor, Earthstar Geographics',
    url:(z,x,y)=>`https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}?token=${encodeURIComponent(PH.esriKey||'')}`},
  igm:{name:'IGM 1:25.000',max:16,min:11,wms:PH_WMS_PCN+'IGM_25000.map',layers:'CB.IGM25000',attr:'IGM · Geoportale Nazionale (CC BY-SA)'},
  orto:{name:'Ortofoto AGEA',max:18,min:12,wms:PH_WMS_PCN+'ortofoto_colore_12.map',layers:'OI.ORTOIMMAGINI.2012',attr:'AGEA · Geoportale Nazionale'},
  custom:{name:'Personalizzata',max:19,attr:'mappa personalizzata'},
  dem:{name:'Solo rilievo'},
};
PH.baseDef=function(){
  const b=PH.BASES[PH.base]||PH.BASES.topo;
  if(PH.base==='custom'){ const c=PH.customMap||{}; return Object.assign({},b,c.wms?{wms:c.wms,layers:c.layers}:{url:(z,x,y)=>String(c.xyz||'').replace('{z}',z).replace('{x}',x).replace('{y}',y)}); }
  const ov=PH.wmsLayers&&PH.wmsLayers[PH.base]; return ov?Object.assign({},b,{layers:ov}):b;
};
PH.tileUrl=function(z,x,y,def){
  const b=def||PH.baseDef();
  if(b.wms){ const n=2**z, lon0=x/n*360-180, lon1=(x+1)/n*360-180, lat=yy=>Math.atan(Math.sinh(Math.PI*(1-2*yy/n)))*R2D;
    return b.wms+(b.wms.includes('?')?'&':'?')+`SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${encodeURIComponent(b.layers)}&STYLES=&SRS=EPSG:4326`+
      `&BBOX=${lon0.toFixed(7)},${lat(y+1).toFixed(7)},${lon1.toFixed(7)},${lat(y).toFixed(7)}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=FALSE`; }
  return b.url(z,x,y);
};
// nomi dei livelli WMS letti dal servizio stesso (GetCapabilities), se il telefono riesce a leggerlo
PH.wmsDiscover=async function(key){
  const b=PH.BASES[key]; if(!b||!b.wms) return;
  try{ const r=await window.IA517.http(b.wms+'&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetCapabilities');
    const names=[...r.text.matchAll(/<Layer[^>]*>\s*<Name>([^<]+)<\/Name>/g)].map(m=>m[1]).filter(n=>!/^ms|^WMS$/i.test(n));
    if(names.length){ PH.wmsLayers=PH.wmsLayers||{}; PH.wmsLayers[key]=names.slice(names.length>1?1:0).join(','); lsSet('ia517p_wmslayers',PH.wmsLayers); PH.tiles.clear(); }
  }catch(e){}
};
function phoneBase(ac,sc,ax,ay,t){
  if(!PH || PH.base==='dem') return;
  const cosl=Math.cos(S.lat*D2R);
  const bd=PH.baseDef(); if(bd.key && !PH.esriKey) return;
  let z=Math.floor(Math.log2(40075016.686*cosl*sc/(256*1.15))); z=clamp(z,Math.max(4,bd.min||4),bd.max||17);
  const n=2**z, rM=1.4*R/sc;
  const lat2y=la=>{ const r=la*D2R; return (1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*n; };
  const pn=PH.pan, cLat=S.lat+(pn?pn.N/110540:0), cLon=S.lon+(pn?pn.E/(111320*cosl):0);   // centro della vista (mappa spostata col dito)
  const x0=Math.floor((cLon-rM/(111320*cosl)+180)/360*n), x1=Math.floor((cLon+rM/(111320*cosl)+180)/360*n);
  const y0=Math.floor(lat2y(cLat+rM/110540)), y1=Math.floor(lat2y(cLat-rM/110540));
  if((x1-x0+1)*(y1-y0+1)>90) return;
  const tLat=y=>Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*R2D, tLon=x=>x/n*360-180;
  ctx.save(); ctx.translate(ax,ay); ctx.rotate(-t); ctx.imageSmoothingEnabled=true;
  for(let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++){
    const key=PH.base+(PH.base==='custom'?JSON.stringify(PH.customMap):'')+z+'/'+x+'/'+y; let T=PH.tiles.get(key);
    if(!T){ if(PH.tilesLoading>12) continue;
      T={img:new Image(),ok:false,t:Date.now()}; PH.tilesLoading=(PH.tilesLoading||0)+1;
      T.img.onload=()=>{ T.ok=true; PH.tilesLoading--; }; T.img.onerror=()=>{ PH.tilesLoading--; setTimeout(()=>PH.tiles.delete(key),30000); };
      T.img.src=PH.tileUrl(z,x,y,bd); PH.tiles.set(key,T);
      if(PH.tiles.size>400){ const k0=PH.tiles.keys().next().value; PH.tiles.delete(k0); } }
    if(!T.ok) continue;
    const a=enu(tLat(y),tLon(x)), b=enu(tLat(y+1),tLon(x+1));
    ctx.drawImage(T.img,(a.E-ac.E)*sc,(ac.N-a.N)*sc,(b.E-a.E)*sc+0.6,(a.N-b.N)*sc+0.6);
  }
  ctx.restore();
  ctx.fillStyle='rgba(4,8,12,.30)'; ctx.fillRect(0,0,W,H);
}
PH.mapCaption=function(){
  const dem=PH.dem.size?'terreno DEM':'terreno non scaricato';
  if(PH.base==='dem') return PH.demo&&!PH.dem.size?'terreno sintetico (demo)':dem+' · campi OurAirports';
  const b=PH.baseDef();
  if(b.key && !PH.esriKey) return 'Esri: manca la chiave (Impostazioni) · '+dem;
  return b.attr+' · '+dem;
};

// ---- scarico per il volo senza internet ----
PH.prefetch=async function(kind,onProg){
  const c0=S.gpsReal?{lat:S.lat,lon:S.lon}:{lat:ORIGIN.lat,lon:ORIGIN.lon}, cosl=Math.cos(c0.lat*D2R), jobs=[];
  const add=(z,rKm,urlF)=>{ const n=2**z, lat2y=la=>{ const r=la*D2R; return (1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*n; };
    const x0=Math.floor((c0.lon-rKm*1000/(111320*cosl)+180)/360*n), x1=Math.floor((c0.lon+rKm*1000/(111320*cosl)+180)/360*n);
    const y0=Math.floor(lat2y(c0.lat+rKm*1000/110540)), y1=Math.floor(lat2y(c0.lat-rKm*1000/110540));
    for(let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++) jobs.push(urlF(z,x,y)); };
  if(kind==='dem'){ add(7,450,phDemUrl); add(8,250,phDemUrl); add(9,150,phDemUrl); add(10,100,phDemUrl); add(11,60,phDemUrl); }
  else { const bd=PH.baseDef(); if(PH.base==='dem') return {done:0,ok:0};
    for(const z of [8,9,10,11,12,13]) if(z>=(bd.min||6) && z<=(bd.max||17)) add(z,z<=9?60:(z<=11?30:(z===12?12:6)),(z,x,y)=>PH.tileUrl(z,x,y,bd)); }
  let done=0, ok=0;
  const worker=async()=>{ while(jobs.length){ const u=jobs.pop();
    try{ const r=await fetch(u,kind==='dem'?{mode:'cors'}:{mode:'no-cors'}); if(r.ok||r.type==='opaque') ok++; }catch(e){}
    done++; onProg&&onProg(done,done+jobs.length,ok); } };
  await Promise.all([worker(),worker(),worker(),worker()]);
  return {done,ok};
};

// ---- dati locali al posto del servizio: le stesse richieste che l'app faceva al Raspberry ----
PH.fromPfd=function(o){ if(o.t==='userfield'||o.t==='route') PH.appRefresh(); };
PH.appRefresh=function(){ try{ const w=el('phAppFrame').contentWindow; w && w.IA517_refresh && w.IA517_refresh(); }catch(e){} };
PH.valField=function(d){
  if(!d||typeof d!=='object') throw new Error('campo: formato non valido');
  const num=(v,lo,hi,n)=>{ v=+v; if(!(v>=lo&&v<=hi)) throw new Error(n+' fuori intervallo'); return v; };
  const u={id:String(d.id||('U-'+Date.now().toString(36).toUpperCase())).slice(0,16),short:String(d.short||'').toUpperCase().slice(0,14),
    name:String(d.name||d.short||'').slice(0,40),lat:num(d.lat,30,72,'latitudine'),lon:num(d.lon,-25,45,'longitudine'),
    elevFt:d.elevFt==null||d.elevFt===''?null:num(d.elevFt,-50,15000,'quota'),kind:['ulm','aero','alti','glac','wp'].includes(d.kind)?d.kind:'ulm',
    runways:[],source:String(d.source||'telefono').slice(0,20),updated:Math.floor(Date.now()/1000)};
  if(!u.short) throw new Error('manca la sigla');
  for(const r of (d.runways||[]).slice(0,6)){
    const le=String(r.le||'').toUpperCase(), he=String(r.he||'').toUpperCase();
    if(!/^(0[1-9]|[12]\d|3[0-6])[LCR]?$/.test(le)||!/^(0[1-9]|[12]\d|3[0-6])[LCR]?$/.test(he)) throw new Error(`pista ${le}/${he} non valida`);
    u.runways.push({le,he,hdg:num(r.hdg!=null?r.hdg:parseInt(le)*10,0,360,'rotta pista'),len:Math.round(num(r.len,100,5000,'lunghezza pista')),paved:r.paved?1:0});
  }
  for(const kk of ['pref','side','maxTail']) if(d[kk]!=null) u[kk]=d[kk];
  return u;
};
PH.valRoute=function(d){
  if(!d||!Array.isArray(d.wps)||d.wps.length<1||d.wps.length>40) throw new Error('rotta: da 1 a 40 punti');
  const wps=d.wps.map((w,i)=>{ const lat=+w.lat, lon=+w.lon; if(!(Math.abs(lat)<=90&&Math.abs(lon)<=180)) throw new Error(`punto ${i+1}: coordinate`);
    return {id:String(w.id||('P'+(i+1))).slice(0,16),name:String(w.name||w.id||('P'+(i+1))).slice(0,40),lat,lon,altFt:w.altFt!=null&&w.altFt!==''?+w.altFt:null,field:!!w.field}; });
  return {id:String(d.id||('R-'+Date.now().toString(36).toUpperCase())).slice(0,16),name:String(d.name||(wps[0].name+' - '+wps[wps.length-1].name)).slice(0,60),
    wps,cruiseFt:d.cruiseFt!=null&&d.cruiseFt!==''?+d.cruiseFt:null,updated:Math.floor(Date.now()/1000)};
};
PH.status=function(){
  const age=t=>t?Math.round((Date.now()-t)/100)/10:null, fx=PH.lastFix;
  const rows=[
    ['ok','Velivolo',PH.ac?PH.acLabel(PH.ac)+` · VNE ${PH.ac.vne} km/h`:'—'],
    [PH.demo?'warn':(fx&&age(fx.t)<5?'ok':'bad'),'GPS del telefono',PH.demo?'volo dimostrativo':(fx?`±${Math.round(fx.acc)} m · ${age(fx.t)<2?'adesso':age(fx.t)+' s fa'}`:(PH.gpsDenied?'permesso negato':'nessun fix'))],
    [PH.glo.port?(PH.glo.fix&&Date.now()-PH.glo.fix.recv<3000?'ok':'warn'):(PH.glo.want?'bad':'warn'),'Garmin GLO 2',
      PH.glo.port?(PH.glo.fix?`${PH.glo.fix.sats??'?'} sat · HDOP ${PH.glo.fix.hdop??'?'} · ${PH.glo.hz} Hz`:'collegato, nessun fix'):(PH.glo.want?'in attesa di ricollegarsi':(PH.glo.err||'non collegato'))],
    ['ok','Posizione in uso',PH.demo?'simulata':(PH.src==='glo'?'Garmin GLO 2':(PH.src==='phone'?'GPS del telefono':'nessuna'))+' · scelta '+{auto:'automatica',phone:'solo telefono',glo:'solo GLO 2'}[PH.srcPref]],
    [PH.motionHz>20?'ok':'bad','Sensori di movimento',PH.motionHz?PH.motionHz+' Hz':'nessun dato'],
    ...(PH.elevBad&&PH.elevBad.size?[['warn','Campi con quota dubbia',[...PH.elevBad].slice(0,12).join(', ')+' (rilievo usato per il 3D)']]:[]),
    ...(PH.EXT&&PH.EXT.want?[[PH.extAtt()?'ok':'bad','Strumento fisico',PH.extInfo()]]:[]),
    ...(PH.native&&PH.native.ahrs?[[PH.natAtt&&performance.now()-PH.natAtt.t<500?'ok':'bad','Assetto nativo (v2)',PH.natAtt?`${PH.natAtt.hz} Hz · ${PH.attSrc==='nativo'?'in uso':'non in uso'}`:'nessun dato']]:[]),
    [PH.mag.hdg!=null&&performance.now()-PH.mag.t<2000?'ok':'warn','Bussola',PH.mag.hdg!=null&&performance.now()-PH.mag.t<2000?`${String(Math.round(PH.mag.hdg)).padStart(3,'0')}° vera · ${PH.magInUse()?'in uso':(PH.compassMode==='never'?'spenta':'in volo usa la traccia GPS')}${PH.mag.acc!=null&&PH.mag.acc<2?' · da calibrare (muovi a otto)':''}`:(PH.mag.iosNeed?'inclina un momento il telefono in avanti (quasi in piano) per trovare il nord':(PH.mag.err?'non disponibile: '+PH.mag.err:'nessun dato'))],
    [PH.mountCal?'ok':'warn','Montaggio',PH.mountCal?('livellato'+(PH.groundPitch?` · a terra ${PH.groundPitch}°`:'')):'telefono verticale (predefinito)'],
    [PH.altCal?'ok':'warn','Quota GPS',PH.altCal?`tarata a ${PH.altCal.field}`:'geoide '+PH.geoid+' m, non tarata'],
    [PH.dem.size?'ok':'warn','Terreno (DEM)',PH.dem.size?`${PH.dem.size} riquadri in memoria`:'non ancora scaricato'],
    [navigator.onLine?'ok':'warn','Internet',navigator.onLine?'sì':'no: si vola con i dati salvati'],
    ['ok','Dati salvati',`${USER_FIELDS.length} campi tuoi · ${ROUTES.length} rotte`],
  ];
  return {version:'telefono',rows,fields:USER_FIELDS.length,routes:ROUTES.length,
    fix:fx&&!PH.demo?{lat:fx.lat,lon:fx.lon,age_s:age(fx.t),gs_kmh:Math.round(fx.gs||0)}:null};
};
PH.handle=function(method,path,body){
  const m=path.match(/^\/api\/(\w+)(?:\/(.+))?$/); if(!m) throw new Error('richiesta sconosciuta');
  const what=m[1], id=m[2]?decodeURIComponent(m[2]):null;
  if(what==='status') return PH.status();
  if(what==='fields'){
    if(method==='GET') return {fields:USER_FIELDS,notes:lsGet('ia517_notes',{})};
    if(method==='POST'){ const u=PH.valField(body); setUserFields(USER_FIELDS.filter(x=>x.id!==u.id).concat([u])); PH.fieldElev(); return {ok:true,field:u}; }
    if(method==='DELETE'){ setUserFields(USER_FIELDS.filter(x=>x.id!==id)); return {ok:true}; }
  }
  if(what==='notes' && method==='POST'){ if(!body||typeof body!=='object') throw new Error('note non valide'); setNotes(Object.assign({},lsGet('ia517_notes',{}),body)); return {ok:true}; }
  if(what==='routes'){
    if(method==='GET') return {routes:ROUTES};
    if(method==='POST'){ const r=PH.valRoute(body); setRoutes(ROUTES.filter(x=>x.id!==r.id).concat([r])); return {ok:true,route:r}; }
    if(method==='DELETE'){ setRoutes(ROUTES.filter(x=>x.id!==id)); return {ok:true}; }
  }
  if(what==='plan'){
    if(method==='GET') return {plan:null};
    const r=PH.valRoute(body&&body.route); offerRoute(r,'PIANO'); setTimeout(()=>PH.show('volo'),350); return {ok:true};
  }
  if(what==='cmd'){
    const q=String(body&&body.line||'').match(/QNH,(\d{3,4})$/);
    if(q && +q[1]>=950 && +q[1]<=1060){ QNH=+q[1]; lsSet('ia517_qnh',QNH); toast('QNH '+QNH+' hPa'); return {ok:true,sent:'telefono'}; }
    throw new Error('comando non disponibile sul telefono');
  }
  throw new Error('richiesta non disponibile');
};
window.IA517={
  api:(method,path,body)=>new Promise((res,rej)=>{ try{ res(JSON.parse(JSON.stringify(PH.handle(method,path,body)))); }catch(e){ rej(Object.assign(new Error(e.message),{http:400})); } }),
  wx:(data)=>{ PH.wx=data||{}; lsSet('ia517p_wx',PH.wx); PH.applyForecast(); },
  show:(v)=>PH.show(v),
  native:!!PH.native,
  http:async(url,headers)=>{
    if(PH.native&&PH.native.http){ const r=await PH.native.http.get({url,headers:Object.assign({'User-Agent':'HORIZON/1.0'},headers||{}),responseType:'text',connectTimeout:12000,readTimeout:30000});
      return {status:r.status,text:typeof r.data==='string'?r.data:JSON.stringify(r.data)}; }
    const ctl=new AbortController(), tm=setTimeout(()=>ctl.abort(),12000);
    try{ const r=await fetch(url,{signal:ctl.signal,headers:headers||{}}); return {status:r.status,text:await r.text()}; } finally{ clearTimeout(tm); }
  },
};
PH.wx=lsGet('ia517p_wx',{});

// ---------------- interfaccia del telefono ----------------
PH.show=function(v){
  for(const [id,name] of [['phPiano','piano'],['phImp','imp'],['phInfo','info'],['phSim','sim'],['phProf','prof'],['phFuel','fuel']]) el(id).hidden=v!==name;
  if(v==='fuel') PH.fuelOpen(); else PH.fuelClose&&PH.fuelClose();
  if(v==='prof') PH.profOpen(); else PH.profClose();
  document.querySelectorAll('.ph-nav button').forEach(b=>b.setAttribute('aria-current',b.dataset.v===v?'page':'false'));
  if(v==='imp') PH.renderImp();
  if(v==='info') PH.renderInfo();
  if(v==='sim') PH.renderSim();
  if(v==='piano'){ try{ const w=el('phAppFrame').contentWindow; w.IA517_refresh&&w.IA517_refresh(); }catch(e){} }
  PH.layout();
};
PH.layout=function(){
  const vw=innerWidth, vh=innerHeight, land=vw>vh*1.15, wide=land && vw>=820;
  document.body.classList.toggle('ph-land',land);
  PH.split=wide && PH.splitOn!==false && PH.ui!=='simple' && !PH.imc;     // in NUBE niente mappa affiancata
  const side=land?Math.min(300,Math.max(210,vw*0.24)):0;
  let size;
  if(land){ const avail=vw-side-24; size=PH.split?Math.min(avail/2-8,vh-20):Math.min(avail,vh-20); }
  else size=Math.min(vw-12,vh-(vw<420?250:280));
  if(PH.imc){ const bar=((el('phImcBar')&&el('phImcBar').offsetHeight)||70)+14;      // NUBE: l'orizzonte prende tutto lo spazio sopra i tasti
    document.body.style.setProperty('--imcbar',bar+'px');
    size=land?Math.min(vw-Math.min(190,vw*0.2)-16,vh-bar-16):Math.min(vw-8,vh-bar-60); }
  size=Math.max(220,Math.floor(size));
  el('unit').style.width=size+'px';
  el('unit2').hidden=!PH.split; el('unit2').style.width=size+'px';
};
PH.drawSplit=function(g){
  if(!PH.split || !PH.view2 || PH.view2.W<40 || el('unit2').offsetWidth<40) return;   // canvas nascosto o non ancora misurato: niente disegno
  const V2=PH.view2, sv={ctx,W,H,CX,CY,R,F,k};
  ctx=V2.ctx; W=V2.W; H=V2.H; CX=W/2; CY=H/2; R=Math.min(W,H)/2-2; F=R/Math.tan(26*Math.PI/180); k=R/240;
  try{ ctx.clearRect(0,0,W,H); if(PAGE==='pfd') drawMap(g); else drawPFD(g); }
  finally{ ctx=sv.ctx; W=sv.W; H=sv.H; CX=sv.CX; CY=sv.CY; R=sv.R; F=sv.F; k=sv.k; }
};
PH.info=function(g){
  const card=(id,v,s)=>{ const e=el(id); if(e){ e.querySelector('b').textContent=v; e.querySelector('small').textContent=s||''; } };
  card('phGs',S.gpsReal||PH.demo?Math.round(S.gs!=null?S.gs:S.ias):'---',PH.tas&&PH.flight?`TAS stim. ${Math.round(PH.tas*3.6)}`:'km/h suolo');
  card('phTrk',S.trk!=null?String(Math.round(S.trk)).padStart(3,'0')+'°':String(Math.round(wrap360(S.hdg))).padStart(3,'0')+'°',S.trk!=null?'traccia':(PH.magInUse()?'prua bussola':'prua'));
  { const h=el('phTrk'); if(h) h.querySelector('span').textContent=S.trk!=null?'TRK':'PRUA'; }
  card('phAlt',Math.round(S.alt)+' ft',PH.acc!=null&&!PH.demo?(PH.src==='glo'?`GLO 2 · ${S.sats??'?'} sat`:`GPS ±${Math.round(PH.acc)} m`)+(PH.altOfsBy[PH.src]?' · tarata':''):'');
  card('phVs',(S.vs>=0?'+':'')+S.vs.toFixed(1),'m/s');
  card('phWind',WIND.valid?fmtWind().replace(' PREV',''):'---',WIND.valid?('da '+['N','NE','E','SE','S','SO','O','NO'][Math.round(((WIND.dir%360)+360)%360/45)%8]+' · '+(WIND.src==='prev'?'previsto':'stimato in volo')):'vira per stimarlo');
  if(NAV.dest){ const d=NAV.app?g.s:g.dist, mins=Math.round((g.ete||0)/60);
    card('phDest',NAV.dest.short.slice(0,10),`${(d/1000).toFixed(d<10000?1:0)} km · ${mins<1?'<1':mins}'`); }
  else card('phDest','---','nessuna destinazione');
  const F_=PH.flight; card('phTime',F_?(()=>{ const m=Math.max(0,Math.floor((Date.now()-F_.start)/60000)); return Math.floor(m/60)+':'+String(m%60).padStart(2,'0'); })():'--:--',F_?'in volo da '+(F_.from||'?'):'a terra');
  if(PH.sun){ const m=Math.round((PH.sun.set-Date.now())/60000), hh=PH.sun.set.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
    card('phSun',hh,m>0?`tra ${Math.floor(m/60)}h${String(m%60).padStart(2,'0')}`:'già tramontato'); el('phSun').classList.toggle('warn',m<45); }
  const st=el('phStat'); if(st){
    const gpsOk=S.gpsReal&&!lost('gps'), attOk=!lost('att');
    st.innerHTML=PH.sim?`<i class="w">SIMULAZIONE</i> ${String(PH.sim.name).replace(/</g,'')} · ×${PH.sim.warp} · tocca per fermare`:PH.demo?'<i class="w">DEMO</i> volo dimostrativo':
      `<i class="${gpsOk?'o':'b'}">${PH.src==='glo'?'GLO 2':'GPS'}</i><i class="${attOk?'o':'b'}">ASSETTO</i><i class="${PH.dem.size?'o':'w'}">TERRENO</i><i class="${navigator.onLine?'o':'w'}">NET</i>`;
  }
  if(S.gpsReal && !lost('att')) PH.seenAll=true;             // dopo il primo fix le perdite le segnalano le bandierine rosse
  const wait=el('phWait'); if(wait) wait.hidden=PH.demo || PH.seenAll || PH.waitClosed || !menuEl.hidden || PH.sim;
};
PH.afterFrame=function(g,dt){
  PH.drawSplit(g);
  const now=performance.now();
  if(now-PH.lastHalf>500){ PH.lastHalf=now; try{ PH.info(g); }catch(e){} try{ PH.zoomBtns&&PH.zoomBtns(); }catch(e){} if(zi!==PH.ziSaved){ PH.ziSaved=zi; lsSet('ia517p_zoom',zi); } }
  if(now-PH.lastSec>1000){ PH.lastSec=now;
    try{ PH_nearFields(); }catch(e){}
    try{ PH.renderAsp(); }catch(e){ console.error(e); }
    try{ PH.simTick(); if(PH.sim && !el('phSim').hidden) PH.renderSim(); }catch(e){ console.error(e); }
    try{ PH.applyForecast(); PH.checkTerrain(); PH.checkAirspace(); PH.checkSun(); }catch(e){ console.error(e); }
    if(PH.demVer!==PH.demVerSeen && now-(PH.demRast||0)>1500){ PH.demVerSeen=PH.demVer; PH.demRast=now; MR.zi=-1; PH.fieldElev(); }
  }
};
PH.setDemo=function(on,label){
  PH.demo=on; OBST.length=0; if(on && !label) OBST.push(...OBST_SYN);
  if(!on && PH.sim){ PH.sim=null; SIM_CRUISE=AC_.vcruise; }
  if(on){ LIVE.any=false; S.gpsReal=false; S.auto=true; el('auto').checked=true; PH.flight=null; toast(label||'VOLO DIMOSTRATIVO'); }
  else { S.auto=false; el('auto').checked=false; LIVE.any=true; LIVE.att=LIVE.gps=LIVE.air=LIVE.baro=0; PH.ahrsInit=false; toast('SENSORI DEL TELEFONO'); }
  MR.zi=-1; PH.renderImp&&!el('phImp').hidden&&PH.renderImp();
};
PH.wakeLock=async function(){
  if(PH.native&&PH.native.awake){ try{ if(PH.wakeOn) await PH.native.awake.keepAwake(); else await PH.native.awake.allowSleep(); PH.wake=PH.wakeOn?{release:()=>PH.native.awake.allowSleep()}:null; }catch(e){} return; }
  if(!PH.wakeOn || !navigator.wakeLock || document.hidden) return;
  try{ PH.wake=await navigator.wakeLock.request('screen'); PH.wake.addEventListener('release',()=>{ PH.wake=null; }); }catch(e){}
};
PH.renderLog=function(){
  const box=el('phLog'); if(!box) return;
  const book=lsGet('ia517p_logbook',[]);
  if(!book.length){ box.innerHTML='<p class="ph-sub">Nessun volo registrato. Il diario parte da solo al decollo (oltre 55 km/h) e si chiude 30 s dopo l\'arresto. Le tracce degli ultimi '+PH.TRK_KEEP+' voli restano nel telefono.</p>'; return; }
  const tot=book.reduce((s,f)=>s+(f.end-f.start),0)/60000, has=f=>f.trk||f.pts;
  box.innerHTML=`<p class="ph-sub">${book.length} voli · ${Math.floor(tot/60)} h ${Math.round(tot%60)} min in tutto · tracce degli ultimi ${PH.TRK_KEEP} voli nel telefono. Spunta i voli da esportare.</p>`+
    `<div class="ph-btns"><button class="ph-btn" id="phTrkAll">Seleziona tutte</button><button class="ph-btn pri" id="phTrkGpx">Esporta GPX</button><button class="ph-btn" id="phTrkKml">Esporta KML (Google Earth)</button></div><p class="ph-sub" id="phTrkMsg"></p>`+
    book.slice(0,60).map((f,i)=>{
    const d=new Date(f.start), m=Math.round((f.end-f.start)/60000), on=PH.trackShow&&PH.trackShow.k===f.start;
    return `<div class="ph-row">${has(f)?`<input type="checkbox" class="ph-trkSel" data-i="${i}" aria-label="Seleziona il volo">`:'<span style="width:20px"></span>'}<span style="flex:1"><b>${d.toLocaleDateString('it-IT')} ${d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</b><br><small>${f.ac?f.ac+' · ':''}${f.from||'?'} → ${f.to||'?'} · ${Math.floor(m/60)}:${String(m%60).padStart(2,'0')} · ${(f.dist/1000).toFixed(0)} km · max ${f.maxFt} ft${has(f)?'':' · senza traccia'}</small></span>`+
      (has(f)?`<button class="ph-btn" data-show="${i}">${on?'Nascondi':'Sulla mappa'}</button>`:'')+`</div>`; }).join('')+
    `<div class="ph-btns"><button class="ph-btn" id="phCsv">Esporta diario (CSV)</button></div>`;
  const ptsOf=async f=>f.pts||await PH.trkGet(f.start)||[];
  const sel=()=>[...box.querySelectorAll('.ph-trkSel:checked')].map(c=>book[+c.dataset.i]);
  const stamp=f=>new Date(f.start).toISOString().slice(0,16).replace(/[:T]/g,'-');
  el('phTrkAll').onclick=()=>{ const cs=[...box.querySelectorAll('.ph-trkSel')], all=cs.every(c=>c.checked); cs.forEach(c=>c.checked=!all); };
  const exp=async kind=>{ const fs=sel(), msg=el('phTrkMsg'); if(!fs.length){ msg.textContent='Spunta almeno un volo.'; return; }
    const full=[]; for(const f of fs) full.push(Object.assign({},f,{pts:await ptsOf(f)}));
    const name=fs.length===1?`${(fs[0].ac||'HORIZON').replace(/\W+/g,'')}_${stamp(fs[0])}`:`HORIZON_${fs.length}_voli_${stamp(fs[fs.length-1])}`;
    if(kind==='gpx') PH.download(name+'.gpx',PH.gpxMulti(full),'application/gpx+xml'); else PH.download(name+'.kml',PH.kml(full),'application/vnd.google-earth.kml+xml');
    msg.textContent=`${fs.length} ${fs.length===1?'volo esportato':'voli esportati'}.`; };
  el('phTrkGpx').onclick=()=>exp('gpx'); el('phTrkKml').onclick=()=>exp('kml');
  box.querySelectorAll('[data-show]').forEach(b=>b.addEventListener('click',async()=>{ const f=book[+b.dataset.show];
    if(PH.trackShow&&PH.trackShow.k===f.start){ PH.trackShow=null; PH.renderLog(); return; }
    const pts=await ptsOf(f); if(pts.length<2){ toast('TRACCIA VUOTA'); return; }
    PH.trackShow={k:f.start,pts}; const mid=pts[Math.floor(pts.length/2)], cosl=Math.cos(S.lat*D2R);
    PH.pan={E:(mid[1]-S.lon)*111320*cosl,N:(mid[0]-S.lat)*110540}; PH.panBtn&&PH.panBtn();
    if(PH.ui==='simple') PH.setUi('full');
    PH.show('volo'); if(PAGE!=='map') togglePage(); toast('TRACCIA SULLA MAPPA · ⌖ CENTRA PER TORNARE'); }));
  el('phCsv').addEventListener('click',()=>{ const rows=['data;velivolo;partenza;arrivo;decollo;atterraggio;durata_min;km;quota_max_ft'].concat(book.map(f=>{
      const a=new Date(f.start), b=new Date(f.end); return [a.toLocaleDateString('it-IT'),f.ac||'',f.from,f.to,a.toLocaleTimeString('it-IT'),b.toLocaleTimeString('it-IT'),Math.round((f.end-f.start)/60000),(f.dist/1000).toFixed(1),f.maxFt].join(';'); }));
    PH.download('HORIZON_diario.csv','﻿'+rows.join('\n'),'text/csv'); });
};
PH.gpxMulti=function(fs){ const esc=s=>String(s).replace(/[<&>]/g,c=>({'<':'&lt;','&':'&amp;','>':'&gt;'}[c]));
  const trk=F_=>{ const name=`${F_.ac||'HORIZON'} ${new Date(F_.start).toISOString().slice(0,16).replace('T',' ')} ${F_.from||''}-${F_.to||''}`;
    return `<trk><name>${esc(name)}</name><trkseg>\n`+(F_.pts||[]).map(p=>`<trkpt lat="${p[0]}" lon="${p[1]}"><ele>${(p[2]*FT2M).toFixed(1)}</ele><time>${new Date(p[3]).toISOString()}</time></trkpt>`).join('\n')+`\n</trkseg></trk>`; };
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="HORIZON" xmlns="http://www.topografix.com/GPX/1/1">\n${fs.map(trk).join('\n')}\n</gpx>\n`; };
PH.kml=function(fs){ const esc=s=>String(s).replace(/[<&>]/g,c=>({'<':'&lt;','&':'&amp;','>':'&gt;'}[c]));
  const pm=F_=>`<Placemark><name>${esc(new Date(F_.start).toLocaleString('it-IT')+' '+(F_.from||'')+'-'+(F_.to||''))}</name><styleUrl>#t</styleUrl><LineString><altitudeMode>absolute</altitudeMode><coordinates>`+
    (F_.pts||[]).map(p=>`${p[1]},${p[0]},${(p[2]*FT2M).toFixed(0)}`).join(' ')+`</coordinates></LineString></Placemark>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>HORIZON voli</name><Style id="t"><LineStyle><color>ff3fd2ff</color><width>3</width></LineStyle></Style>\n${fs.map(pm).join('\n')}\n</Document></kml>\n`; };
PH.renderImp=function(){
  const box=el('phImpBody'), on=v=>v?'checked':'';
  box.innerHTML=`
  <section><h3>Stato</h3><div id="phImpStat"></div></section>
  ${PH.acSectionHtml?PH.acSectionHtml():''}
  <section><h3>Interfaccia</h3>
    <div class="ph-seg" id="phUi">${[['full','Completa'],['simple','Semplice']].map(([k2,l])=>`<button data-u="${k2}" aria-pressed="${PH.ui===k2}">${l}</button>`).join('')}</div>
    <p class="ph-sub"><b>Semplice</b>: solo l'orizzonte, come uno strumento di bordo classico, con velocità, quota, vario, prua, vento e tempo di volo. Niente mappa, rotte e simulazione. Gli avvisi di terreno e di spazio aereo restano attivi. <b>Completa</b>: tutto.</p>
  </section>
  <section><h3>Posizione: GPS del telefono e Garmin GLO 2</h3>
    <p class="ph-sub">Il GLO 2 (GPS e GLONASS, 10 posizioni al secondo, quota sul livello del mare) è più preciso del telefono. Abbinalo prima nelle impostazioni Bluetooth di Android, poi collegalo qui: le volte successive si ricollega da solo. In automatico si usa il GLO 2 quando dà la posizione e il telefono se il GLO 2 si spegne o perde il segnale.</p>
    <div class="ph-seg" id="phSrc">${[['auto','Automatica'],['glo','Solo GLO 2'],['phone','Solo telefono']].map(([k2,l])=>`<button data-s="${k2}" aria-pressed="${PH.srcPref===k2}">${l}</button>`).join('')}</div>
    <div class="ph-btns">${PH.glo.port?'<button class="ph-btn" id="phGloOff">Scollega GLO 2</button>':'<button class="ph-btn pri" id="phGloOn">Collega Garmin GLO 2</button>'}</div>
    <p class="ph-sub" id="phGloMsg">${('serial' in navigator)||(PH.native&&PH.native.glo)?'':'Questo browser non legge GPS Bluetooth: aggiorna Chrome, oppure usa l\'app Garmin GLO come posizione fittizia di Android (Opzioni sviluppatore › App di posizione fittizia): così il GLO 2 arriva come se fosse il GPS del telefono.'}</p>
  </section>
  <section><h3>Montaggio del telefono</h3>
    <p class="ph-sub">Di serie il telefono è verticale, schermo verso di te, in verticale o orizzontale. Se è montato in un altro modo, o per togliere l'errore di beccheggio, livella: in volo rettilineo e livellato, oppure a terra indicando di quanto è cabrato l'aereo fermo (biciclo come l'Avid: circa 10–12°).</p>
    <div class="ph-btns"><button class="ph-btn pri" id="phLevelAir">Livella ora (in volo, ali livellate)</button></div>
    ${PH.native&&PH.native.ahrs?`<div class="ph-row" style="margin-top:10px"><span>Orizzonte di riserva (v2)</span><small id="phResInfo">assetto nativo: ${PH.natAtt?PH.natAtt.hz+' Hz':'in avvio'}</small></div>
    <p class="ph-sub">Se lo schermo principale non risponde per più di 0,3 secondi, Android mostra da solo un orizzonte essenziale calcolato in modo indipendente, finché la pagina riprende.</p>
    <div class="ph-btns"><label class="ph-fld" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="phResOn" ${lsGet('ia517p_reserve',true)?'checked':''}> Attivo</label><button class="ph-btn" id="phResTest">Provalo 5 secondi</button></div>`:''}
    ${PH.native&&PH.native.ble?`<div class="ph-row" style="margin-top:10px"><span>Strumento fisico HORIZON (Bluetooth)</span><small id="phExtInfo">${PH.extInfo()}</small></div>
    <p class="ph-sub">La scheda dello strumento da 80 mm manda assetto, velocità all'aria e quota barometrica. Quando è collegata diventa la fonte principale e il telefono la controlla: se non concordano compare «ATT DISAGREE».</p>
    <div class="ph-btns"><label class="ph-fld" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="phExtOn" ${PH.EXT.want?'checked':''}> Collega</label></div>`:''}
    <div class="ph-btns"><label class="ph-fld">Assetto a terra (°)<input id="phGp" type="number" step="0.5" value="${PH.groundPitch||11}"></label><button class="ph-btn" id="phLevelGnd">Livella a terra</button><button class="ph-btn" id="phMountReset">Telefono verticale</button></div>
    <label class="ph-fld ph-range"><span>Orizzonte più morbido: <b id="phSmV">${PH.smoothTxt()}</b></span><input id="phSm" type="range" min="0" max="10" step="1" value="${PH.smooth}"></label>
    <div class="ph-row"><span>Fotogrammi al secondo</span></div>
    <div class="ph-seg" id="phFps">${[[30,'30 · consuma meno'],[60,'60 · più fluido']].map(([v,l])=>`<button data-f="${v}" aria-pressed="${PH.fps===v}">${l}</button>`).join('')}</div>
    <p class="ph-sub">Più morbido toglie il tremolio di vibrazioni e movimenti della mano, ma l'orizzonte arriva un po' dopo il movimento vero. In volo va bene 2–4; 0 è la risposta immediata.</p>
    <div class="ph-row"><span>Dettaglio del terreno 3D</span><small id="phTqNow"></small></div>
    <div class="ph-seg" id="phTq">${[['auto','Automatico'],['0','Normale'],['1','Alto'],['2','Massimo']].map(([v,l])=>`<button data-q="${v}" aria-pressed="${String(PH.terrQ)===v}">${l}</button>`).join('')}</div>
    <p class="ph-sub">Più dettaglio = riquadri più piccoli nella vista sintetica. In automatico parte dal massimo e scende da solo se il telefono non tiene i fotogrammi al secondo.</p>
  </section>
  <section><h3>Tipo di volo</h3>
    <div class="ph-seg" id="phFlType">${Object.entries(IA517_RULES.PROFILES).map(([k2,v])=>`<button data-p="${k2}" aria-pressed="${IA517_RULES.get()===k2}">${v.name}</button>`).join('')}</div>
    <p class="ph-sub">Decide che cosa è consentito. <b>VDS basico</b>: fuori dagli spazi controllati (A–E) e dalle ATZ, ad almeno 5 km dagli aeroporti, fino a 500 ft sull'ostacolo più alto entro 5 km (1000 ft sabato, domenica e festivi). <b>VDS avanzato</b> e <b>aviazione generale VFR</b>: tutto lo spazio aperto al VFR, con autorizzazione ATC in C e D; classe A vietata. Fonte: DPR 133/2010 art. 8–9. Salvo autorizzazioni ENAC; valgono l'AIP e i NOTAM.</p>
  </section>
  <section><h3>Bussola</h3>
    <p class="ph-sub">La prua viene dalla bussola del telefono, corretta in prua vera con la declinazione magnetica. In volo, sopra 25 km/h, conta la traccia GPS corretta col vento, perché nell'abitacolo motore e metallo disturbano la bussola. Se la bussola sbaglia, calibrala muovendo il telefono a otto per qualche secondo, lontano da oggetti di metallo.</p>
    <div class="ph-seg" id="phCmp">${[['ground','A terra e lento'],['always','Sempre'],['never','Mai']].map(([k2,l])=>`<button data-c="${k2}" aria-pressed="${PH.compassMode===k2}">${l}</button>`).join('')}</div>
    <div class="ph-btns"><label class="ph-fld">Declinazione magnetica (°, Est positiva; Piemonte ≈ +3)<input id="phDecl" type="number" step="0.5" value="${PH.decl}"></label></div>
  </section>
  <section><h3>Quota GPS</h3>
    <p class="ph-sub">L'app non usa il barometro: la quota è quella GPS (±10–30 m), riportata al livello del mare con il geoide e tarata da sola quando sei fermo su un campo di quota nota. Non usarla al posto dell'altimetro.</p>
    <div class="ph-btns"><label class="ph-fld">Geoide (m, Nord Italia ≈ 47)<input id="phGeo" type="number" step="1" value="${PH.geoid}"></label><button class="ph-btn" id="phAltReset">Azzera taratura</button></div>
    <div class="ph-btns"><label class="ph-fld">Quota vera qui, se la conosci (m)<input id="phAltKnown" type="number" step="1" placeholder="es. 229"></label><button class="ph-btn" id="phAltSet">Tara qui</button></div>
    <p class="ph-sub">Per esempio la quota di un altimetro con il QNH del giorno, o la quota di un punto noto. Vale per la fonte in uso (GPS del telefono o GLO 2).</p>
  </section>
  <section><h3>Volare senza internet</h3>
    <p class="ph-sub">Scarica prima, con il WiFi: il terreno per la vista sintetica e gli avvisi (circa 10 MB attorno a dove sei, o alla Carolina) e la mappa di base della zona. Pagine, campi, rotte e meteo già scaricato restano sul telefono.</p>
    <div class="ph-btns"><button class="ph-btn pri" id="phDlDem">Scarica terreno</button><button class="ph-btn" id="phDlMap">Scarica mappa della zona</button></div>
    <p class="ph-sub" id="phDlMsg"></p>
  </section>
  <section><h3>Mappa di base</h3>
    <div class="ph-seg ph-seg2" id="phBase">${Object.entries(PH.BASES).map(([k2,b])=>`<button data-b="${k2}" aria-pressed="${PH.base===k2}">${b.name}</button>`).join('')}</div>
    <p class="ph-sub" id="phBaseNote"></p>
    <div id="phBaseExtra"></div>
    <label class="ph-chk"><input type="checkbox" id="phSplit" ${on(PH.splitOn!==false)}> Su tablet in orizzontale: orizzonte e mappa insieme</label>
  </section>
  <section><h3>Avvisi</h3>
    <label class="ph-chk"><input type="checkbox" id="phVoice" ${on(PH.voice)}> Voce (pista, circuito, terreno, spazi aerei, tramonto)</label>
    <label class="ph-chk"><input type="checkbox" id="phVib" ${on(PH.vib)}> Vibrazione</label>
    <label class="ph-chk"><input type="checkbox" id="phWake" ${on(PH.wakeOn)}> Schermo sempre acceso</label>
    <div class="ph-btns"><button class="ph-btn" id="phVoiceTest">Prova la voce</button><button class="ph-btn" id="phFull">Schermo intero</button></div>
    <p class="ph-sub">Spazi aerei: si usano quelli del file OpenAir caricato nel Piano (Briefing). Con i soli esempi non c'è nessun avviso.</p>
  </section>
  <section><h3>Volo dimostrativo</h3>
    <p class="ph-sub">Simula un volo attorno alla Carolina, per provare menu, rotte e circuito a casa. Con il dimostrativo acceso i sensori sono ignorati.</p>
    <div class="ph-btns"><button class="ph-btn ${PH.demo?'':'pri'}" id="phDemo">${PH.demo?'Torna ai sensori del telefono':'Avvia volo dimostrativo'}</button></div>
  </section>
  <section><h3>Diario di volo</h3><div id="phLog"></div></section>
  <section><h3>Info</h3><div class="ph-btns"><button class="ph-btn" id="phToInfo">Versione, aggiornamenti, segnalazioni, crediti</button></div></section>
  <section><h3>Avvertenza</h3><p class="ph-sub">Strumento sperimentale per la consapevolezza della situazione, non certificato. Assetto dai sensori del telefono, velocità e quota dal GPS: nessuna velocità indicata vera, nessun altimetro barometrico. In volo valgono gli strumenti di bordo, la vista fuori, la manica a vento e la radio.</p></section>`;
  const stat=()=>{ const s=PH.status(); el('phImpStat').innerHTML=s.rows.map(([c,a,b])=>`<div class="ph-row"><span><i class="dot ${c}"></i>${a}</span><small>${b}</small></div>`).join(''); };
  stat(); clearInterval(PH.impT); PH.impT=setInterval(()=>{ if(el('phImp').hidden) clearInterval(PH.impT); else stat(); },1000);
  el('phSrc').querySelectorAll('button').forEach(b=>b.onclick=()=>{ PH.srcPref=b.dataset.s; lsSet('ia517p_src',PH.srcPref);
    el('phSrc').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b)); stat(); });
  if(el('phGloOn')) el('phGloOn').onclick=async()=>{ el('phGloMsg').textContent='Scegli il GLO 2 nell\'elenco…'; const ok=await PH.gloConnect(true);
    PH.renderImp(); el('phGloMsg').textContent=ok?'GLO 2 collegato.':('Non collegato: '+(PH.glo.err||'annullato')); };
  if(el('phGloOff')) el('phGloOff').onclick=async()=>{ await PH.gloClose(true); PH.renderImp(); };
  el('phFps').querySelectorAll('button').forEach(b=>b.onclick=()=>{ PH.fps=+b.dataset.f; lsSet('ia517p_fps',PH.fps); el('phFps').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b)); });
  el('phSm').oninput=e=>{ PH.smooth=+e.target.value; lsSet('ia517p_smooth',PH.smooth); PH.ahrsMount&&PH.ahrsMount(); el('phSmV').textContent=PH.smoothTxt(); };
  el('phLevelAir').onclick=()=>{ if(PH.level(0)) stat(); };
  el('phLevelGnd').onclick=()=>{ if(PH.level(+el('phGp').value||0)) stat(); };
  el('phMountReset').onclick=()=>{ PH.resetMount(); stat(); };
  if(el('phResOn')) el('phResOn').onchange=e=>{ lsSet('ia517p_reserve',e.target.checked); PH.call(PH.native.ahrs.setWatch({on:e.target.checked})); PH.act('riserva '+(e.target.checked?'attiva':'spenta')); };
  if(el('phExtOn')) el('phExtOn').onchange=e=>PH.extConnect(e.target.checked);
  clearInterval(PH.extInfoT); PH.extInfoT=setInterval(()=>{ const x=el('phExtInfo'); if(!x||el('phImp').hidden){ clearInterval(PH.extInfoT); return; } x.textContent=PH.extInfo(); },1000);
  if(el('phResTest')) el('phResTest').onclick=()=>{ PH.act('prova riserva'); PH.call(PH.native.ahrs.showReserve({ms:5000})); };
  el('phGeo').onchange=()=>{ const v=+el('phGeo').value; if(v>-110&&v<90){ PH.geoid=v; lsSet('ia517p_geoid',v); PH.vario.h=NaN; } };
  PH.acSectionWire&&PH.acSectionWire();
  el('phTq').querySelectorAll('button').forEach(b=>b.onclick=()=>{ PH.terrQ=b.dataset.q; lsSet('ia517p_terrq',PH.terrQ); el('phTq').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b)); PH.tqNow(); });
  PH.tqNow();
  el('phUi').querySelectorAll('button').forEach(b=>b.onclick=()=>{ PH.setUi(b.dataset.u); el('phUi').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b)); });
  el('phFlType').querySelectorAll('button').forEach(b=>b.onclick=()=>{ IA517_RULES.set(b.dataset.p); el('phFlType').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b)); PH.renderAsp();
    try{ const w=el('phAppFrame').contentWindow; w.IA517_profChanged&&w.IA517_profChanged(); }catch(e){} const pr=IA517_RULES.PROFILES[b.dataset.p]; toast('TIPO DI VOLO: '+(pr?pr.short:b.dataset.p)); });
  el('phCmp').querySelectorAll('button').forEach(b=>b.onclick=()=>{ PH.compassMode=b.dataset.c; lsSet('ia517p_compass',PH.compassMode); el('phCmp').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b)); stat(); });
  el('phDecl').onchange=()=>{ const v=+el('phDecl').value; if(v>=-30&&v<=30){ PH.decl=v; lsSet('ia517p_decl',v); } };
  el('phAltSet').onclick=()=>{ const v=+el('phAltKnown').value, src=PH.src||'phone';
    if(!isFinite(PH.mslRaw)){ toast('ASPETTA IL GPS E RIPROVA'); return; } if(!(v>-100&&v<5000)){ toast('QUOTA NON VALIDA'); return; }
    PH.altOfsBy[src]=v-PH.mslRaw; PH.altOfs=PH.altOfsBy[src]; PH.altCal={field:'manuale',t:Date.now(),src}; lsSet('ia517p_altofs2',PH.altOfsBy); lsSet('ia517p_altcal',PH.altCal); PH.vario.h=NaN;
    toast(`QUOTA TARATA: ${Math.round(v)} m (${Math.round(v/FT2M)} ft)`); stat(); };
  el('phAltReset').onclick=()=>{ PH.altOfs=0; PH.altOfsBy={phone:0,glo:0}; PH.altCal=null; lsSet('ia517p_altofs2',PH.altOfsBy); lsSet('ia517p_altcal',null); PH.vario.h=NaN; stat(); };
  const dl=async(kind)=>{ const m=el('phDlMsg'); m.textContent='Scarico…';
    const r=await PH.prefetch(kind,(d,t,ok)=>{ m.textContent=`${kind==='dem'?'Terreno':'Mappa'}: ${d}/${t} riquadri`; });
    m.textContent=`${kind==='dem'?'Terreno':'Mappa'}: ${r.ok} riquadri salvati su ${r.done}`+(r.ok<r.done?' · senza internet o servizio non raggiungibile':''); };
  el('phDlDem').onclick=()=>dl('dem'); el('phDlMap').onclick=()=>dl('map');
  const NOTE={topo:'Topografica con curve di livello, da OpenStreetMap. Gratuita, nessuna chiave.',
    osm:'Stradale OpenStreetMap. Gratuita, nessuna chiave.',
    esri:'Satellite ad alta risoluzione (World Imagery di Esri, 30–60 cm in Italia). Serve una chiave gratuita: crea un account ArcGIS Location Platform, genera una «API key» con il permesso Basemaps e incollala qui. Il piano gratuito comprende 2 milioni di tessere: per un uso personale bastano.',
    igm:'Tavolette IGM 1:25.000 (l\'Istituto Geografico Militare) dal Geoportale Nazionale. Si vedono solo con zoom 2–8 km. Il servizio è vecchio e solo http: nell\'app installata (APK) funziona, dal browser può essere bloccato.',
    orto:'Ortofoto a colori AGEA dal Geoportale Nazionale (solo http, come sopra). Si vedono con zoom 2–4 km.',
    custom:'Qualunque servizio: un indirizzo a tessere con {z} {x} {y}, oppure un WMS con i nomi dei livelli. Usa solo servizi di cui hai il diritto di uso.',
    dem:'Solo il rilievo calcolato dal terreno, con i colori delle quote e del TAWS.'};
  const extra=()=>{ el('phBaseNote').textContent=NOTE[PH.base]||'';
    let h='';
    if(PH.base==='esri') h=`<div class="ph-btns"><label class="ph-fld" style="flex:1">Chiave Esri (API key)<input id="phEsriKey" type="text" autocomplete="off" spellcheck="false" style="width:100%" value="${(PH.esriKey||'').replace(/"/g,'&quot;')}"></label></div>`;
    if(PH.base==='igm'||PH.base==='orto') h=`<div class="ph-btns"><button class="ph-btn" id="phWmsCaps">Rileggi i livelli dal servizio</button></div><p class="ph-sub">Livelli in uso: ${(PH.baseDef().layers||'').replace(/</g,'')}</p>`;
    if(PH.base==='custom'){ const c=PH.customMap||{}; h=`<label class="ph-fld">Tessere XYZ (es. https://…/{z}/{x}/{y}.png)<input id="phCxyz" type="text" spellcheck="false" style="width:100%" value="${(c.xyz||'').replace(/"/g,'&quot;')}"></label>
      <label class="ph-fld">oppure WMS (indirizzo del servizio)<input id="phCwms" type="text" spellcheck="false" style="width:100%" value="${(c.wms||'').replace(/"/g,'&quot;')}"></label>
      <label class="ph-fld">Livelli WMS (separati da virgola)<input id="phClay" type="text" spellcheck="false" style="width:100%" value="${(c.layers||'').replace(/"/g,'&quot;')}"></label>
      <div class="ph-btns"><button class="ph-btn pri" id="phCsave">Usa questa mappa</button></div>`; }
    el('phBaseExtra').innerHTML=h;
    if(el('phEsriKey')) el('phEsriKey').onchange=e=>{ PH.esriKey=e.target.value.trim(); lsSet('ia517p_esrikey',PH.esriKey); PH.tiles.clear(); MR.zi=-1; };
    if(el('phWmsCaps')) el('phWmsCaps').onclick=async()=>{ el('phWmsCaps').textContent='Leggo…'; await PH.wmsDiscover(PH.base); extra(); };
    if(el('phCsave')) el('phCsave').onclick=()=>{ PH.customMap={xyz:el('phCxyz').value.trim(),wms:el('phCwms').value.trim(),layers:el('phClay').value.trim()};
      if(PH.customMap.wms) delete PH.customMap.xyz; lsSet('ia517p_custommap',PH.customMap); PH.tiles.clear(); MR.zi=-1; toast('MAPPA PERSONALIZZATA'); };
  };
  extra();
  el('phBase').querySelectorAll('button').forEach(b=>b.onclick=()=>{ PH.base=b.dataset.b; lsSet('ia517p_basemap',PH.base); MR.zi=-1;
    el('phBase').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b)); extra();
    if((PH.base==='igm'||PH.base==='orto') && !(PH.wmsLayers&&PH.wmsLayers[PH.base])) PH.wmsDiscover(PH.base); });
  el('phSplit').onchange=e=>{ PH.splitOn=e.target.checked; lsSet('ia517p_split',PH.splitOn); PH.layout(); };
  el('phVoice').onchange=e=>{ PH.voice=e.target.checked; lsSet('ia517p_voice',PH.voice); };
  el('phVib').onchange=e=>{ PH.vib=e.target.checked; lsSet('ia517p_vib',PH.vib); };
  el('phWake').onchange=e=>{ PH.wakeOn=e.target.checked; lsSet('ia517p_wake',PH.wakeOn); if(PH.wakeOn) PH.wakeLock(); else if(PH.wake) PH.wake.release(); };
  el('phVoiceTest').onclick=()=>PH.say('Carolina, pista 3 6, circuito sinistro, 800 piedi',true);
  el('phFull').onclick=()=>{ try{ const q=document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen({navigationUI:'hide'}); if(q&&q.catch) q.catch(()=>toast(PH.native?'L\'APP È GIÀ A SCHERMO INTERO':'SCHERMO INTERO NON DISPONIBILE')); else if(!q) toast('SCHERMO INTERO NON DISPONIBILE'); }catch(e){} };
  el('phToInfo').onclick=()=>PH.show('info');
  el('phDemo').onclick=()=>{ PH.setDemo(!PH.demo); PH.renderImp(); };
  PH.renderLog();
};

// ---- Garmin GLO 2: Bluetooth (porta seriale RFCOMM) letto dal browser ----
const PH_SPP='00001101-0000-1000-8000-00805f9b34fb';
PH.gloNativeInit=function(){
  const N=PH.native&&PH.native.glo; if(!N||PH.gloNativeOn) return; PH.gloNativeOn=true;
  N.addListener('nmea',d=>{ (d&&d.lines||[]).forEach(PH.gloLine); });
  N.addListener('state',d=>{ if(d&&d.connected===false && PH.glo.port){ PH.glo.port=null; PH.glo.fix=null; PH.glo.err=d.error||'collegamento perso';
    toast('GLO 2 SCOLLEGATO'+(PH.phoneFix?' · USO IL GPS DEL TELEFONO':'')); } });
};
PH.gloNativeConnect=async function(ask){
  const G=PH.glo, N=PH.native.glo; PH.gloNativeInit();
  let addr=lsGet('ia517p_gloaddr',null);
  if(ask){
    let list=[]; try{ list=(await N.paired()).devices||[]; }catch(e){ G.err=e&&e.message||'Bluetooth non disponibile'; return false; }
    if(!list.length){ G.err='nessun dispositivo abbinato: abbina il GLO 2 nelle impostazioni Bluetooth'; return false; }
    addr=await PH.pickDevice(list); if(!addr){ G.err='nessun dispositivo scelto'; return false; }
  }
  if(!addr) return false;
  G.opening=true;
  try{ await N.connect({address:addr}); G.port={native:true,address:addr}; G.err=''; G.want=true; lsSet('ia517p_glo',true); lsSet('ia517p_gloaddr',addr); toast('GLO 2 COLLEGATO'); return true; }
  catch(e){ G.err=e&&e.message||'non risponde'; return false; }
  finally{ G.opening=false; }
};
PH.pickDevice=function(list){ return new Promise(res=>{
  const box=el('phGloMsg'); if(!box){ res(list[0].address); return; }
  list.sort((a,b)=>(/glo/i.test(b.name)?1:0)-(/glo/i.test(a.name)?1:0));
  box.innerHTML='Scegli il GLO 2:'+list.map((d,i)=>`<div class="ph-btns"><button class="ph-btn${/glo/i.test(d.name)?' pri':''}" data-i="${i}">${(d.name||'senza nome').replace(/</g,'')} · ${d.address}</button></div>`).join('');
  box.querySelectorAll('button').forEach(b=>b.onclick=()=>res(list[+b.dataset.i].address)); }); };
PH.gloConnect=async function(ask){
  const G=PH.glo;
  if(PH.native&&PH.native.glo){ if(G.port||G.opening) return !!G.port; return PH.gloNativeConnect(ask); }
  if(!('serial' in navigator)){ G.err='il browser non legge GPS Bluetooth'; return false; }
  if(G.port || G.opening) return !!G.port;
  G.opening=true;
  try{
    let port=null;
    if(ask) port=await navigator.serial.requestPort({allowedBluetoothServiceClassIds:[PH_SPP],filters:[{bluetoothServiceClassId:PH_SPP}]});
    else { const ports=await navigator.serial.getPorts();
      port=ports.find(p=>{ const i=p.getInfo?p.getInfo():{}; return (i.bluetoothServiceClassId||'').toLowerCase()===PH_SPP; }); if(!port) return false; }
    await port.open({baudRate:115200,bufferSize:4096});
    G.port=port; G.err=''; G.want=true; lsSet('ia517p_glo',true);
    PH.gloRead(port);
    toast('GLO 2 COLLEGATO');
    return true;
  }catch(e){ G.err=e&&e.name==='NotFoundError'?'nessun dispositivo scelto':(e&&e.message||'errore'); return false; }
  finally{ G.opening=false; }
};
PH.gloRead=async function(port){
  const G=PH.glo, dec=new TextDecoder(); let buf='';
  try{
    let ended=false;
    while(port.readable && G.port===port && !ended){
      const reader=port.readable.getReader(); G.reader=reader;
      try{ for(;;){ const {value,done}=await reader.read(); if(done){ ended=true; break; }
        buf+=dec.decode(value,{stream:true}); if(buf.length>8192) buf=buf.slice(-1024);
        let i; while((i=buf.indexOf('\n'))>=0){ const line=buf.slice(0,i).trim(); buf=buf.slice(i+1); if(line) PH.gloLine(line); } } }
      catch(e){ await new Promise(r=>setTimeout(r,300)); }          // errore non fatale (dati rovinati): si riprende a leggere
      finally{ try{ reader.releaseLock(); }catch(e){} }
    }
  }catch(e){ G.err='collegamento perso'; }
  if(G.port===port){ await PH.gloClose(false); toast('GLO 2 SCOLLEGATO'+(PH.phoneFix?' · USO IL GPS DEL TELEFONO':'')); }
};
PH.gloClose=async function(forget){
  const G=PH.glo, port=G.port; G.port=null; G.fix=null;
  if(forget){ G.want=false; lsSet('ia517p_glo',false); }
  if(port&&port.native){ try{ await PH.native.glo.disconnect(); }catch(e){} return; }
  try{ G.reader&&await G.reader.cancel(); }catch(e){}
  try{ port&&await port.close(); }catch(e){}
};
PH.nmeaOk=function(l){ const m=l.match(/^\$([^*]+)\*([0-9A-F]{2})$/i); if(!m) return null; let c=0; for(const ch of m[1]) c^=ch.charCodeAt(0);
  return c===parseInt(m[2],16)?m[1].split(','):null; };
PH.gloLine=function(line){
  const p=PH.nmeaOk(line); if(!p) return;
  const G=PH.glo, typ=p[0].slice(2), now=Date.now();
  if(typ==='GGA'){ G.gga={q:+p[6],sats:+p[7],hdop:+p[8],alt:p[9]!==''?+p[9]:null,t:now}; return; }
  if(typ!=='RMC' || p[2]!=='A') return;
  const lat=nmeaDeg(p[3],p[4]), lon=nmeaDeg(p[5],p[6]); if(lat==null||lon==null) return;
  G.n++; if(!G.t0||now-G.t0>2000){ G.hz=G.t0?Math.round(G.n*1000/(now-G.t0)):0; G.n=0; G.t0=now; }
  const gga=G.gga&&now-G.gga.t<1500&&G.gga.q>0?G.gga:null;
  const fx={src:'glo',lat,lon,msl:gga?gga.alt:null,speed:p[7]!==''?+p[7]*0.514444:null,heading:p[8]!==''?+p[8]:null,
    acc:gga&&gga.hdop?Math.max(2.5,gga.hdop*3):8,sats:gga?gga.sats:null,hdop:gga?gga.hdop:null,t:now,recv:now};
  G.fix=fx;
  if(PH.useGlo()) PH.applyFix(fx);
};

function demoTakeoff(){
  if(PH && PH.sim){ PH.simEnd('atterrato'); return; }
  S.alt+=400; S.ias=110; S.pitch=6; NAV.airborne=true; toast('DECOLLO (demo)'); nextDemo(); }

// ---- simulazione di una rotta salvata o di un direct to ----
PH.simCfg=function(){ return Object.assign({kind:'route',route:null,dest:'IT-0001',from:'IT-0074',start:'first',kmh:115,ft:2500,wdir:270,wkmh:10,warp:2},lsGet('ia517p_simcfg',{})); };
PH.simStart=function(cfg){
  lsSet('ia517p_simcfg',cfg);
  let r=null, f=null, start=null, first=1;
  if(cfg.kind==='route'){
    r=ROUTES.find(x=>x.id===cfg.route);
    if(!r||!Array.isArray(r.wps)||r.wps.length<2){ toast('SCEGLI UNA ROTTA CON ALMENO DUE PUNTI'); return false; }
    if(cfg.start==='here' && S.gpsReal){ start={lat:S.lat,lon:S.lon}; first=0; } else start={lat:+r.wps[0].lat,lon:+r.wps[0].lon};
  } else {
    f=FIELDS.find(x=>x.id===cfg.dest); if(!f){ toast('SCEGLI LA DESTINAZIONE'); return false; }
    const sf=FIELDS.find(x=>x.id===cfg.from);
    start=(cfg.from==='here'||!sf)?{lat:S.lat,lon:S.lon}:{lat:sf.lat,lon:sf.lon};
  }
  const name=r?r.name:'DIRECT '+f.short;
  PH.setDemo(true,'SIMULAZIONE: '+String(name).toUpperCase());
  PH.sim={name,warp:cfg.warp,t0:simClock,dist:0,last:{lat:start.lat,lon:start.lon},cfg};
  SIM_CRUISE=clamp(+cfg.kmh||115,60,250); SIM_WIND.dir=wrap360(+cfg.wdir||0); SIM_WIND.kmh=clamp(+cfg.wkmh||0,0,80);
  NAV.roll=null; NAV.app=null; NAV.airborne=true;
  S.lat=start.lat; S.lon=start.lon;
  const a0=enu(S.lat,S.lon), gz=terrain(a0.E,a0.N);
  S.alt=Math.max(((gz===gz?gz:250)+300)/FT2M, Math.min(+cfg.ft||2500,((gz===gz?gz:250)+300)/FT2M+500));   // si parte in volo, circa 1000 ft sul terreno
  S.ias=SIM_CRUISE; S.pitch=2; S.roll=0; S.vs=0; S.slip=0;
  if(r){ const rc=Object.assign({},r,{cruiseFt:+cfg.ft||r.cruiseFt||2500}); S.hdg=distBrg(start,r.wps[first]).brg; activateRoute(rc,first); }
  else { S.hdg=distBrg(start,f).brg; directTo(f,+cfg.ft||2500); }
  S.trk=S.hdg; PH.hdg=S.hdg; MR.zi=-1;
  PH.act('simula '+name);
  PH.show('volo');
  return true;
};
PH.simEnd=function(why){
  const P=PH.sim; if(!P) return;
  const min=(simClock-P.t0)/60;
  PH.simLast={name:P.name,why,min,km:P.dist/1000,at:NAV.lastDest||'',t:Date.now()}; lsSet('ia517p_simlast',PH.simLast);
  toast(`SIMULAZIONE FINITA · ${why.toUpperCase()} · ${Math.round(min)} MIN · ${(P.dist/1000).toFixed(0)} km`);
  PH.setDemo(false);
  if(!el('phSim').hidden) PH.renderSim();
};
PH.simTick=function(){                       // ogni secondo
  const P=PH.sim; if(!P) return;
  const d=distBrg(P.last,S).d; if(d<20000) P.dist+=d; P.last={lat:S.lat,lon:S.lon};
  if(NAV.dest && NAV.dest.kind==='wp' && NAV.wpDone && (!NAV.route || NAV.route.idx>=NAV.route.r.wps.length-1)) PH.simEnd('fine rotta');
  else if(!NAV.dest && !NAV.roll && !NAV.app) PH.simEnd('nessuna destinazione');
};
PH.renderSim=function(){
  const box=el('phSimBody'), c=PH.simCfg(), esc=x=>String(x==null?'':x).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  const seg=(id,opts,cur)=>`<div class="ph-seg" id="${id}">${opts.map(([v,l])=>`<button data-v="${v}" aria-pressed="${String(cur)===String(v)}">${l}</button>`).join('')}</div>`;
  if(PH.sim){ const P=PH.sim, R_=NAV.route;
    box.innerHTML=`<section><h3>Simulazione in corso</h3>
      <div class="ph-row"><span>Rotta</span><small><b>${esc(P.name)}</b></small></div>
      <div class="ph-row"><span>Prossimo</span><small>${NAV.dest?esc(NAV.dest.short):(NAV.roll?'in corsa sulla pista':'—')}${R_?` · punto ${R_.idx+1}/${R_.r.wps.length}`:''}</small></div>
      <div class="ph-row"><span>Fatto</span><small>${(P.dist/1000).toFixed(1)} km · ${Math.round((simClock-P.t0)/60)} min di volo simulato</small></div>
      <div class="ph-row"><span>Velocità del tempo</span></div>${seg('phSimWarpL',[[1,'×1'],[2,'×2'],[4,'×4'],[8,'×8']],P.warp)}
      <div class="ph-btns"><button class="ph-btn pri" id="phSimView">Guarda lo strumento</button><button class="ph-btn" id="phSimStop">Ferma la simulazione</button></div></section>`;
    el('phSimWarpL').querySelectorAll('button').forEach(b=>b.onclick=()=>{ P.warp=+b.dataset.v; const cc=PH.simCfg(); cc.warp=P.warp; lsSet('ia517p_simcfg',cc); PH.renderSim(); });
    el('phSimView').onclick=()=>PH.show('volo');
    el('phSimStop').onclick=()=>PH.simEnd('fermata a mano');
    return; }
  const routes=ROUTES.slice().sort((a,b)=>(b.updated||0)-(a.updated||0));
  if(!routes.find(r=>r.id===c.route) && routes[0]) c.route=routes[0].id;
  const ac=enu(S.lat,S.lon), fl=FIELDS.filter(f=>f.ends&&f.ends.length).map(f=>({f,d:Math.hypot(f.E-ac.E,f.N-ac.N)})).sort((a,b)=>a.d-b.d).slice(0,80);
  const opt=(cur)=>fl.map(({f,d})=>`<option value="${esc(f.id)}" ${f.id===cur?'selected':''}>${esc(f.short)} · ${esc(f.name)} · ${(d/1000).toFixed(0)} km</option>`).join('');
  const L=PH.simLast||lsGet('ia517p_simlast',null);
  box.innerHTML=`<section><h3>Cosa volare</h3>${seg('phSimKind',[['route','Rotta salvata'],['direct','Direct to un campo']],c.kind)}
    <div id="phSimRoute" ${c.kind==='route'?'':'hidden'}>${routes.length?routes.map(r=>`<label class="ph-chk"><input type="radio" name="phSimR" value="${esc(r.id)}" ${r.id===c.route?'checked':''}> <span><b>${esc(r.name)}</b> · ${r.wps.length} punti · ${routeKm(r).toFixed(0)} km</span></label>`).join(''):'<p class="ph-sub">Nessuna rotta salvata: creane una nel Piano (Rotte) o dal menu dello strumento (NUOVA ROTTA), poi torna qui.</p>'}
      <div class="ph-row"><span>Partenza</span></div>${seg('phSimStart',[['first','Dal primo punto'],['here','Da dove sono']],c.start)}</div>
    <div id="phSimDirect" ${c.kind==='direct'?'':'hidden'}>
      <label class="ph-fld">Da<select id="phSimFrom"><option value="here" ${c.from==='here'?'selected':''}>Dove sono adesso</option>${opt(c.from)}</select></label>
      <label class="ph-fld">A<select id="phSimDest">${opt(c.dest)}</select></label></div></section>
  <section><h3>Volo</h3>
    <div class="ph-btns"><label class="ph-fld">Crociera (km/h)<input id="phSimKmh" type="number" min="60" max="250" step="5" value="${c.kmh}"></label><label class="ph-fld">Quota (ft)<input id="phSimFt" type="number" min="500" max="12000" step="100" value="${c.ft}"></label></div>
    <div class="ph-btns"><label class="ph-fld">Vento da (°)<input id="phSimWd" type="number" min="0" max="360" step="10" value="${c.wdir}"></label><label class="ph-fld">Vento (km/h)<input id="phSimWk" type="number" min="0" max="80" step="1" value="${c.wkmh}"></label></div>
    <div class="ph-row"><span>Velocità del tempo</span></div>${seg('phSimWarp',[[1,'×1'],[2,'×2'],[4,'×4'],[8,'×8']],c.warp)}
    <div class="ph-btns"><button class="ph-btn pri" id="phSimGo">Avvia la simulazione</button></div>
    <p class="ph-sub">Lo strumento vola da solo la rotta: segue la guida, sceglie la pista col vento che hai messo, fa il circuito e atterra. Usa terreno, campi, spazi aerei e avvisi veri. Finché simuli, GPS e sensori del telefono restano fuori e il diario di volo non registra niente. Si ferma da sola all'atterraggio, oppure toccando la scritta SIMULAZIONE sopra i comandi.</p></section>
  ${L?`<section><h3>Ultima simulazione</h3><div class="ph-row"><span>${esc(L.name)}</span><small>${esc(L.why)} · ${Math.round(L.min)} min · ${L.km.toFixed(0)} km</small></div></section>`:''}`;
  const pick=(id,key)=>el(id).querySelectorAll('button').forEach(b=>b.onclick=()=>{ c[key]=isNaN(+b.dataset.v)?b.dataset.v:+b.dataset.v; lsSet('ia517p_simcfg',c); PH.renderSim(); });
  pick('phSimKind','kind'); pick('phSimWarp','warp'); if(el('phSimStart')) pick('phSimStart','start');
  box.querySelectorAll('input[name=phSimR]').forEach(i=>i.onchange=()=>{ c.route=i.value; lsSet('ia517p_simcfg',c); });
  el('phSimGo').onclick=()=>{
    Object.assign(c,{from:el('phSimFrom').value,dest:el('phSimDest').value,kmh:+el('phSimKmh').value||115,ft:+el('phSimFt').value||2500,wdir:+el('phSimWd').value||0,wkmh:+el('phSimWk').value||0});
    const sel=box.querySelector('input[name=phSimR]:checked'); if(sel) c.route=sel.value;
    PH.simStart(c); };
};

// ---- fotogrammi: tetto ai fotogrammi al secondo, misura del tempo di disegno, registro dei blocchi ----
function frame(now){
  requestAnimationFrame(frame);
  if(PH){ const P=PH.perf;
    if(P.lastRaf && !document.hidden && now-P.lastRaf>1500){ P.stalls++; PH.logErr&&PH.logErr(`blocco ${Math.round(now-P.lastRaf)} ms · pagina ${PAGE} · zoom ${ZOOMS[zi]} km · mappa ${PH.base} · terreno ${PH.dem.size} · tessere in arrivo ${PH.tilesLoading||0}`); }
    P.lastRaf=now;
    if(now-(P.lastDraw||0)<1000/PH.fps-3) return;
    P.lastDraw=now; }
  const t0=performance.now();
  try{ PH&&PH.sane(); }catch(e){}
  try{ frameBody(now); FRAME_OK=now; }
  catch(e){ FRAME_ERR++; FRAME_LAST_ERR=String(e&&e.message||e);
    if(FRAME_ERR%120===1) console.error('fotogramma', e);
    try{ if(ctx.reset) ctx.reset(); ctx.setTransform(1,0,0,1,0,0);
      ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H); failBox(CX,CY,R*0.7,R*0.2,'ERRORE DI VISUALIZZAZIONE','riprovo · '+FRAME_LAST_ERR.slice(0,40)); }catch(e2){} }
  if(PH){ const P=PH.perf, d=performance.now()-t0; P.avg+=(d-P.avg)*0.05; if(d>P.max) P.max=d; P.n++;
    if(now-(P.hbT||0)>1000){ P.hbT=now; lsSet('ia517p_hb',{t:Date.now(),page:PAGE,zoom:ZOOMS[zi],base:PH.base,ms:Math.round(P.avg),max:Math.round(P.max),stalls:P.stalls,menu:!menuEl.hidden,prompt:!!PROMPT,demo:PH.demo,dem:PH.dem.size,tl:PH.tilesLoading||0,trail:PH.trail.slice(-15)}); P.max=0; } }
}
// valori impossibili (numeri enormi o non numeri) non arrivano mai al disegno
PH.sane=function(){
  const bad=v=>typeof v!=='number'||!isFinite(v), note=m=>{ if(PH.saneNote!==m){ PH.saneNote=m; PH.logErr&&PH.logErr(m); } };
  if(bad(S.alt)||Math.abs(S.alt)>60000){ note('quota fuori scala ('+S.alt+'): ripresa dal GPS'); S.alt=isFinite(PH.mslRaw)?PH.mslRaw/FT2M:0; PH.vario.h=NaN; S.vs=0; }
  if(bad(S.vs)||Math.abs(S.vs)>60){ S.vs=0; }
  if(bad(S.gs)||S.gs>1500) S.gs=0; if(bad(S.ias)||S.ias>1500) S.ias=0;
  if(bad(S.roll)||bad(S.pitch)){ note('assetto non valido: riparte'); S.roll=0; S.pitch=0; PH.attF=null; PH.ahrsInit=false; }
  if(bad(S.hdg)) S.hdg=0; if(S.trk!=null&&bad(S.trk)) S.trk=null;
  if(bad(S.lat)||bad(S.lon)||Math.abs(S.lat)>89){ S.lat=ORIGIN.lat; S.lon=ORIGIN.lon; }
};
PH.act=function(a){ if(!PH) return; const t=new Date(); PH.trail.push(t.toTimeString().slice(0,8)+' '+a); if(PH.trail.length>30) PH.trail.splice(0,PH.trail.length-30); };
// ---- avvio della parte telefono ----
(function(){
  { const tp=togglePage; togglePage=function(){ if(PH.ui==='simple'){ if(PAGE!=='pfd') tp(); toastShow('INTERFACCIA SEMPLICE: SOLO ORIZZONTE'); return; } tp(); PH.act('pagina '+PAGE); }; }
  // interfaccia semplice (solo orizzonte) o completa
  { const dp=drawPFD; drawPFD=function(g){ if(PH.ui!=='simple') return dp(g);           // semplice: l'orizzonte senza rotta né destinazione
      const a=NAV.dest, b=NAV.app, c=NAV.route; NAV.dest=null; NAV.app=null; NAV.route=null; try{ return dp(g); } finally{ NAV.dest=a; NAV.app=b; NAV.route=c; } }; }
  PH.setUi=function(u){ PH.ui=u==='simple'?'simple':'full'; lsSet('ia517p_ui',PH.ui); PH.act('interfaccia '+PH.ui);
    document.body.classList.toggle('ph-simple',PH.ui==='simple');
    if(PH.ui==='simple'){ if(PAGE!=='pfd'){ PAGE='pfd'; try{ el('pageBtn').textContent='Pagina: Mappa'; }catch(e){} } PH.pan=null; if(PH.panBtn) PH.panBtn(); }
    PH.layout(); PH.zoomBtns&&PH.zoomBtns(); };
  PH.setUi(PH.ui);
  // DIRECT TO e NUOVA ROTTA: si può scrivere il nome (o la sigla) del campo per cercarlo
  PH.q='';
  const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const hit=f=>{ const q=norm(PH.q).trim(); if(!q) return true; const hay=norm(f.short+' '+f.name+' '+f.id); return q.split(/\s+/).every(w=>hay.includes(w)); };
  { const di=dtoItems; dtoItems=function(){ return di().filter(x=>x.t!=='field'||hit(x.f)); }; }
  { const bi=buildItems; buildItems=function(){ return bi().filter(x=>x.t!=='field'||hit(x.f)); }; }
  // barra fissa in cima al menu: Indietro e Chiudi (prima c'era solo una riga dell'elenco, che scorreva via)
  const mBar=document.createElement('div'); mBar.className='ph-mbar';
  mBar.innerHTML='<button type="button" id="phMBack">◀ Indietro</button><button type="button" id="phMClose" aria-label="Chiudi il menu">✕</button>';
  el('menuTitle').before(mBar);
  ['pointerdown','click'].forEach(ev=>mBar.addEventListener(ev,e=>e.stopPropagation()));
  el('phMBack').addEventListener('click',()=>{ PH.act('menu indietro'); if(menuMode==='main') closeMenu(); else openMain(); });
  el('phMClose').addEventListener('click',()=>{ PH.act('menu chiuso'); closeMenu(); });
  const qBox=document.createElement('div'); qBox.className='ph-q'; qBox.hidden=true;
  qBox.innerHTML='<input id="phQ" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="characters" placeholder="Scrivi il nome o la sigla del campo"><small id="phQn"></small>';
  el('menuTitle').after(qBox);
  const qIn=qBox.querySelector('input');
  qIn.addEventListener('input',()=>{ PH.q=qIn.value; items=menuMode==='dto'?dtoItems():buildItems(); const fi=items.findIndex(x=>x.t==='field'); sel=fi>=0?fi:0; renderMenu(); });
  qIn.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); qIn.blur(); const it=items[sel]; if(it&&it.t==='field') push(); } e.stopPropagation(); });
  ['pointerdown','click'].forEach(ev=>qBox.addEventListener(ev,e=>e.stopPropagation()));
  { const rm=renderMenu; renderMenu=function(){ rm(); const on=menuMode==='dto'||menuMode==='build'; qBox.hidden=!on;
      if(on){ const n=items.filter(x=>x.t==='field').length; el('phQn').textContent=PH.q?(n?`${n} ${n===1?'campo trovato':'campi trovati'}`:'nessun campo con questo nome'):`${n} campi · dal più vicino`; } }; }
  { const od=openDto; openDto=function(){ PH.q=''; qIn.value=''; return od(); }; }
  { const ob=openBuild; openBuild=function(){ PH.q=''; qIn.value=''; return ob(); }; }
  { const ba=buildAdd; buildAdd=function(f){ PH.q=''; qIn.value=''; return ba(f); }; }
  { const ro_=rotate; rotate=function(d){ PH.act('ruota '+d+(PAGE==='map'?' (zoom)':'')); return ro_(d); }; }
  { const pu_=push; push=function(){ PH.act('premi'); return pu_(); }; }
  { const sh=PH.show; PH.show=function(v){ PH.act('apri '+v); return sh(v); }; }
  document.body.classList.add('phone');
  PH.splitOn=lsGet('ia517p_split',true);
  // seconda vista (tablet in orizzontale)
  const cv2=el('pfd2'), ro=new ResizeObserver(()=>{ const r=cv2.getBoundingClientRect(), dpr=Math.min(window.devicePixelRatio||1,2);
    cv2.width=Math.max(2,Math.round(r.width*dpr)); cv2.height=Math.max(2,Math.round(r.height*dpr));
    PH.view2={ctx:cv2.getContext('2d'),W:cv2.width,H:cv2.height}; });
  ro.observe(cv2);
  addEventListener('resize',()=>PH.layout()); PH.layout();
  // comandi a schermo (la manopola del telefono)
  const rep=(btn,fn)=>{ let t=null, t2=null; btn.addEventListener('pointerdown',e=>{ e.preventDefault(); fn(); t=setTimeout(()=>{ t2=setInterval(fn,140); },450); });
    ['pointerup','pointerleave','pointercancel'].forEach(ev=>btn.addEventListener(ev,()=>{ clearTimeout(t); clearInterval(t2); })); };
  rep(el('phL'),()=>rotate(-1)); rep(el('phR'),()=>rotate(1));
  let okT=null, okLong=false;
  el('phOK').addEventListener('pointerdown',e=>{ e.preventDefault(); okLong=false; okT=setTimeout(()=>{ okLong=true; closeMenu(); togglePage(); toast(PAGE==='pfd'?'ORIZZONTE':'MAPPA'); },700); });
  el('phOK').addEventListener('pointerup',()=>{ clearTimeout(okT); if(!okLong) push(); });
  ['pointerleave','pointercancel'].forEach(ev=>el('phOK').addEventListener(ev,()=>clearTimeout(okT)));
  el('phPage').addEventListener('click',()=>{ closeMenu(); togglePage(); toast(PAGE==='pfd'?'ORIZZONTE':'MAPPA'); });
  // zoom della mappa: 19 passi da 1 a 700 km (tutto il Nord Italia), ricordato
  ZOOMS.splice(0,ZOOMS.length,1,2,3,4,6,8,11,15,22,30,45,60,90,125,180,250,350,500,700);
  zi=clamp(lsGet('ia517p_zoom',5)|0,0,ZOOMS.length-1); PH.ziSaved=zi;
  PH.zoomStep=function(d){ PH.act('zoom '+(d<0?'+':'−')); const nz=clamp(zi+d,0,ZOOMS.length-1); if(nz===zi){ toastShow(d<0?'ZOOM MASSIMO':'ZOOM MINIMO'); return; } zi=nz; MR.zi=-1; toastShow('ZOOM '+ZOOMS[zi]+' km'); };
  // gesti sullo strumento: tocco = premi, trascina in orizzontale = ruota, tieni premuto = pagina, due dita = zoom
  const cvm=el('pfd'), cvz=el('pfd2'); let g0=null;
  const pts=new Map(), mapOn=cv=>cv===cvm?PAGE==='map':PAGE==='pfd';
  [cvm,cvz].forEach(cv=>{
    cv.addEventListener('pointerdown',e=>{ pts.set(e.pointerId,[e.clientX,e.clientY]);
      if(pts.size===2){ const [a,b]=[...pts.values()]; PH.pinch={d0:Math.hypot(a[0]-b[0],a[1]-b[1])||1,cv,warned:false}; if(g0){ clearTimeout(g0.lt); g0=null; } } });
    cv.addEventListener('pointermove',e=>{ if(!pts.has(e.pointerId)) return; pts.set(e.pointerId,[e.clientX,e.clientY]);
      const P=PH.pinch; if(!P || pts.size<2) return;
      const [a,b]=[...pts.values()], d=Math.hypot(a[0]-b[0],a[1]-b[1]), r=d/P.d0;
      if(r>1.22||r<0.82){ if(mapOn(P.cv)) PH.zoomStep(r>1?-1:1); else if(!P.warned){ P.warned=true; toastShow('ZOOM: SULLA MAPPA · TIENI PREMUTO PER CAMBIARE PAGINA'); } P.d0=d; } });
    ['pointerup','pointercancel'].forEach(t=>cv.addEventListener(t,e=>{ pts.delete(e.pointerId); if(!pts.size) PH.pinch=null; }));
    let wT=0; cv.addEventListener('wheel',e=>{ if(!mapOn(cv)) return; e.preventDefault(); const now=performance.now(); if(now-wT<120) return; wT=now; PH.zoomStep(e.deltaY>0?1:-1); },{passive:false});
  });
  const zb=document.createElement('div'); zb.className='ph-zoom'; zb.id='phZoom'; zb.hidden=true;
  zb.innerHTML='<button type="button" id="phZin" aria-label="Zoom avanti">+</button><button type="button" id="phZout" aria-label="Zoom indietro">−</button>';
  el('unit').appendChild(zb);
  rep(el('phZin'),()=>PH.zoomStep(-1)); rep(el('phZout'),()=>PH.zoomStep(1));
  PH.zoomBtns=function(){ const host=PH.ui==='simple'?null:(PAGE==='map'?el('unit'):(PH.split?el('unit2'):null));
    if(host && zb.parentNode!==host) host.appendChild(zb); zb.hidden=!host; };
  cvm.addEventListener('pointerdown',e=>{ if(pts.size>1) return; g0={x:e.clientX,y:e.clientY,t:performance.now(),acc:0,moved:false,long:false};
    g0.lt=setTimeout(()=>{ if(g0&&!g0.moved){ g0.long=true; closeMenu(); togglePage(); toast(PAGE==='pfd'?'ORIZZONTE':'MAPPA'); } },700); });
  cvm.addEventListener('pointermove',e=>{ if(!g0||PH.pinch||g0.long) return; const dx=e.clientX-g0.x;
    if(Math.abs(dx)>12||Math.abs(e.clientY-g0.y)>12) g0.moved=true;
    if(PAGE==='map'){ if(g0.moved){ clearTimeout(g0.lt); PH.panBy(cvm,e.clientX-(g0.px??g0.x),e.clientY-(g0.py??g0.y)); g0.px=e.clientX; g0.py=e.clientY; } return; }
    const steps=Math.trunc((dx-g0.acc)/42); if(steps){ for(let i=0;i<Math.abs(steps);i++) rotate(Math.sign(steps)); g0.acc+=steps*42; } });
  cvm.addEventListener('pointerup',()=>{ if(!g0) return; clearTimeout(g0.lt); if(!g0.moved&&!g0.long) push(); g0=null; });
  cvm.addEventListener('pointercancel',()=>{ if(g0) clearTimeout(g0.lt); g0=null; });
  // mappa libera: trascinando col dito si sposta la vista (nord in alto); lo zoom resta sul punto guardato
  PH.pan=null;
  PH.panBy=function(cv,dxc,dyc){ const rc=cv.getBoundingClientRect(), f=cv.width/(rc.width||1), sc=PH.mapSc||1;
    if(!PH.pan){ PH.pan={E:0,N:0}; PH.act('mappa libera'); toastShow('MAPPA LIBERA · NORD IN ALTO'); }
    PH.pan.E-=dxc*f/sc; PH.pan.N+=dyc*f/sc;
    const lim=ZOOMS[ZOOMS.length-1]*1000; PH.pan.E=clamp(PH.pan.E,-lim,lim); PH.pan.N=clamp(PH.pan.N,-lim,lim);
    PH.panBtn(); };
  PH.panHome=function(){ PH.pan=null; MR.zi=-1; PH.panBtn(); toastShow('MAPPA CENTRATA SULL\'AEREO'); };
  const pb=document.createElement('button'); pb.type='button'; pb.id='phPanHome'; pb.className='ph-panhome'; pb.textContent='⌖ CENTRA'; pb.hidden=true;
  pb.onclick=e=>{ e.stopPropagation(); PH.panHome(); }; zb.appendChild(pb);
  PH.panBtn=function(){ pb.hidden=!PH.pan; };
  // seconda vista (schermo diviso): trascinare sposta la mappa allo stesso modo
  { let d2=null; cvz.addEventListener('pointerdown',e=>{ d2={x:e.clientX,y:e.clientY,moved:false}; });
    cvz.addEventListener('pointermove',e=>{ if(!d2||PH.pinch||!mapOn(cvz)) return; if(Math.abs(e.clientX-d2.x)+Math.abs(e.clientY-d2.y)>12) d2.moved=true;
      if(d2.moved){ PH.panBy(cvz,e.clientX-(d2.px??d2.x),e.clientY-(d2.py??d2.y)); d2.px=e.clientX; d2.py=e.clientY; } });
    ['pointerup','pointercancel'].forEach(t=>cvz.addEventListener(t,()=>{ d2=null; })); }
  // tastiera o telecomando Bluetooth (frecce, invio, tasti multimediali)
  document.addEventListener('keydown',e=>{
    if(e.target.closest && e.target.closest('input,textarea,select,#unit')) return;
    if(!el('phImp').hidden || !el('phPiano').hidden || !el('phSim').hidden) return;
    const k2=e.key;
    if(k2==='ArrowRight'||k2==='ArrowUp'||k2==='MediaTrackNext'||k2==='PageDown'){ e.preventDefault(); rotate(1); }
    else if(k2==='ArrowLeft'||k2==='ArrowDown'||k2==='MediaTrackPrevious'||k2==='PageUp'){ e.preventDefault(); rotate(-1); }
    else if(k2==='Enter'||k2===' '||k2==='MediaPlayPause'){ e.preventDefault(); push(); }
    else if(k2==='p'||k2==='P'){ closeMenu(); togglePage(); }
  });
  document.querySelectorAll('.ph-nav button').forEach(b=>b.addEventListener('click',()=>PH.show(b.dataset.v)));
  el('phStat').addEventListener('click',()=>{ if(PH.sim) PH.show('sim'); });
  // tastino LIVELLA accanto a GPS · ASSETTO · TERRENO · NET (bordo giallo e nero: si usa con attenzione, chiede conferma)
  { const st=el('phStat'), row=document.createElement('div'); row.className='ph-statrow'; st.parentNode.insertBefore(row,st); row.appendChild(st);
    const b=document.createElement('button'); b.type='button'; b.className='ph-lvl'; b.id='phLvl'; b.textContent='LIVELLA'; b.setAttribute('aria-label','Livella l\'assetto'); row.appendChild(b);
    b.addEventListener('click',ev=>{ ev.stopPropagation(); if(PH.demo||PH.sim){ toast('LIVELLA: NON IN DEMO O SIMULAZIONE'); return; }
      const air=!!PH.flight||(S.gpsReal&&S.gs>40), gp=air?0:(PH.groundPitch||11);
      PH.act&&PH.act('livella '+(air?'in volo':'a terra '+gp+'°'));
      ask(air?'LIVELLA ORA? ALI LIVELLATE, VOLO RETTILINEO':`LIVELLA A TERRA? AEREO FERMO, ASSETTO ${gp}°`,()=>{ PH.level(gp); },15); }); }
  { const ab=document.createElement('div'); ab.className='ph-asp w'; ab.id='phAsp'; ab.textContent='Spazio aereo…'; (el('phStat').closest('.ph-statrow')||el('phStat')).after(ab);
    ab.addEventListener('click',()=>{ PH.show(PH.aspList().length?'prof':'piano'); }); }
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>PH.show('volo')));
  el('phWaitDemo').onclick=()=>{ PH.setDemo(true); };
  el('phWaitClose').onclick=()=>{ PH.waitClosed=true; el('phWait').hidden=true; };
  // sensori
  if(PH.glo.want) PH.gloConnect(false);
  setInterval(()=>{ if(PH.glo.want && !PH.glo.port) PH.gloConnect(false); },5000);
  PH.lastAng=PH.scrAng();
  try{ screen.orientation&&screen.orientation.addEventListener('change',PH.onRotate); }catch(e){}
  addEventListener('orientationchange',PH.onRotate); addEventListener('resize',PH.onRotate);
  addEventListener('devicemotion',PH.onMotion);
  // v2: assetto nativo e orizzonte di riserva (vedi AhrsPlugin.java)
  PH.ahrsMount=function(){ const A=PH.native&&PH.native.ahrs; if(!A) return; try{ PH.call(A.setMount({M:PH.M,tau:clamp(PH.smooth,0,10)*0.1,scr:PH.scrAng()})); }catch(e){} };
  if(PH.native && PH.native.ahrs) try{ const A=PH.native.ahrs;
    PH.listen(A,'att',d=>{ PH.natAtt={r:d.r,p:d.p,s:d.s,tr:d.tr,hz:d.hz,t:performance.now()}; });
    PH.call(Promise.resolve(A.start()).then(r=>{ PH.natInfo=r; PH.ahrsMount(); }));
    setInterval(()=>{ try{ PH.call(A.beat({scr:PH.scrAng()})); }catch(e){} },100);
    setTimeout(()=>{ try{ PH.call(A.start()); }catch(e){} },15000);   // dopo il permesso di posizione il GPS nativo riparte
  }catch(e){ PH.logErr&&PH.logErr('assetto nativo: '+e.message); }
  PH.isIOS=/iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints>1);
  PH.iosPermNeeded=PH.isIOS && typeof DeviceMotionEvent!=='undefined' && typeof DeviceMotionEvent.requestPermission==='function';
  PH.iosPerm=async function(){ if(!PH.iosPermNeeded || PH.iosPermAsked) return; PH.iosPermAsked=true;
    try{ const a=await DeviceMotionEvent.requestPermission();
      const b=(typeof DeviceOrientationEvent!=='undefined' && DeviceOrientationEvent.requestPermission)?await DeviceOrientationEvent.requestPermission():'granted';
      if(a==='granted'&&b==='granted') toast('SENSORI ATTIVI'); else toast('SENSORI NEGATI: IMPOSTAZIONI › SAFARI › MOVIMENTO E ORIENTAMENTO'); }
    catch(e){ PH.iosPermAsked=false; } };
  if(PH.iosPermNeeded){ const once=()=>{ PH.iosPerm(); }; document.addEventListener('click',once,true); document.addEventListener('touchend',once,true);
    const w=el('phWait'); if(w){ const sp=w.querySelector('span'); if(sp) sp.textContent='Su iPhone e iPad tocca lo schermo una volta per consentire i sensori di movimento, poi consenti la posizione. All\'aperto il primo fix arriva in pochi secondi.'; } }
  addEventListener('deviceorientationabsolute',PH.onOrient); addEventListener('deviceorientation',PH.onOrient);
  if(PH.native && PH.native.compass){ try{
    PH.native.compass.addListener('rot',d=>{ const R=d&&d.R; if(!R||R.length<9) return; PH.mag.native=true; PH.mag.acc=d.acc;
      PH.magFromR([[R[0],R[1],R[2]],[R[3],R[4],R[5]],[R[6],R[7],R[8]]],'android'); });
    PH.native.compass.start().catch(e=>{ PH.mag.err=String(e&&e.message||e); });
  }catch(e){} }
  if(navigator.geolocation) navigator.geolocation.watchPosition(PH.onPos,PH.onPosErr,{enableHighAccuracy:true,maximumAge:0,timeout:15000});
  else PH.gpsErr='GPS non disponibile';
  PH.wakeLock(); document.addEventListener('visibilitychange',()=>{ PH.perf.lastRaf=0; if(!document.hidden) PH.wakeLock(); });
  document.addEventListener('pointerdown',()=>{ if(!PH.wake) PH.wakeLock(); },{passive:true});
  // volo interrotto (app chiusa o telefono riavviato in volo): si riprende
  const cur=lsGet('ia517p_curflight',null);
  if(cur && cur.pts && cur.pts.length && Date.now()-cur.pts[cur.pts.length-1][3]<15*60000){ PH.flight=cur; NAV.airborne=true; }
  // si parte con i sensori veri: finché non arrivano, le bandierine rosse lo dicono
  S.auto=false; el('auto').checked=false; LIVE.any=true;
  if(window.speechSynthesis) try{ speechSynthesis.getVoices(); }catch(e){}
  if('serviceWorker' in navigator && location.protocol==='https:' && !/claude|anthropic/.test(location.hostname))
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  else if('serviceWorker' in navigator && location.hostname==='localhost') navigator.serviceWorker.register('sw.js').catch(()=>{});
})();

// ---------------- ⛽ carburante e alternati in volo (modulo carburante.js) ----------------
// carburante ora = a bordo al decollo (piano, meno rullaggio) − consumo × tempo di volo; correggibile a mano
PH.fuelPlan=()=>lsGet('ia517_plan',{})||{};
PH.fuelNow=function(){
  const P=PH.fuelPlan(), a=PH.ac||{}, burn=+P.burn||+a.burn||14, fix=lsGet('ia517p_fuelfix',null), now=Date.now();
  const start=PH.flight&&PH.flight.start;
  if(fix && (!start || fix.t>=start-60e3) && now-fix.t<12*3600e3) return {L:Math.max(0,fix.L-(PH.flight?(now-fix.t)/3600e3*burn:0)),how:`impostato alle ${new Date(fix.t).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}${PH.flight?' meno il consumo':''}`,burn};
  const L0=(+P.fuel||0)-(+P.taxi||0);
  if(start){ const h=(now-start)/3600e3; return {L:Math.max(0,L0-h*burn),how:`${L0.toFixed(0)} L al decollo (${new Date(start).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}) − ${Math.round(h*60)} min × ${burn} L/h`,burn}; }
  return {L:Math.max(0,L0),how:'a bordo secondo il piano, meno il rullaggio',burn};
};
PH.fuelRender=function(){
  const box=el('phFuelBody'), FU=window.IA517_FUEL; if(!box||!FU||el('phFuel').hidden) return;
  if(box.contains(document.activeElement) && /INPUT/.test(document.activeElement.tagName)) return;     // non disturbare chi scrive
  const P=PH.fuelPlan(), a=PH.ac||{}, n=PH.fuelNow(), res=+P.res||+a.res||30;
  const pos=S.gpsReal?{lat:S.lat,lon:S.lon}:(FIELDS.find(f=>f.id===P.from)||{lat:S.lat,lon:S.lon});
  const gs=S.gpsReal?+S.gs||0:0;
  box.innerHTML=`<section><div class="ph-fuelnow"><div><div class="ph-sub">Carburante ora (stima)</div><div class="fu-big" style="font-size:24px;font-weight:800">${n.L.toFixed(0)} L · ${FU.fmtMin(n.L/n.burn*60)}</div><div class="ph-sub">${n.how}</div></div>
      <div style="display:flex;gap:6px;margin-left:auto"><button class="ph-btn" data-df="-5">−5</button><button class="ph-btn" data-df="5">+5</button><button class="ph-btn" id="phFuelSet">Imposta</button></div></div>
      ${S.gpsReal?'':'<p class="ph-sub">GPS non ancora pronto: distanze dal campo di partenza del piano.</p>'}
      <div id="phFuelList"></div></section>`;
  const list=el('phFuelList');
  list.innerHTML=FU.flightHtml(FIELDS,{pos,fuelNow:n.L,burn:n.burn,tas:+P.tas||+a.vcruise||100,gs,res,ac:a.fuelType||'mogas'});
  const fix=L=>{ lsSet('ia517p_fuelfix',{L:Math.max(0,L),t:Date.now()}); PH.act&&PH.act('carburante '+Math.round(L)+' L'); PH.fuelRender(); };
  box.querySelectorAll('[data-df]').forEach(b=>b.onclick=()=>fix(n.L+(+b.dataset.df)));
  el('phFuelSet').onclick=()=>{ const v=prompt('Carburante a bordo adesso (litri):',Math.round(n.L)); if(v!=null&&v!==''&&!isNaN(+v)) fix(+v); };
  FU.wire(list,FIELDS,{onChange:()=>{ PH.fuelRender(); try{ const w=el('phAppFrame').contentWindow; w.renderFuelAlt&&w.renderFuelAlt(); }catch(e){} },
    onRow:(fid,row,act)=>{ const f=FIELDS.find(x=>x.id===fid);
      act.innerHTML=(f?'<button type="button" class="fu-b pri" data-a="go">Vai diretto</button>':'')+'<button type="button" class="fu-b" data-a="mark">Correggi il carburante</button>';
      const g=act.querySelector('[data-a=go]'); if(g) g.onclick=()=>{ directTo(f,null); PH.act&&PH.act('diretto per carburante '+f.short); toast('DIRETTO · '+f.short); PH.show('volo'); };
      act.querySelector('[data-a=mark]').onclick=()=>{ const q=list.querySelector('.fu-q'); q.value=f?`${f.name} · ${f.short}`:''; q.dispatchEvent(new Event('change')); q.scrollIntoView({block:'center'}); }; }});
};
PH.fuelOpen=function(){ PH.act&&PH.act('apri carburante'); PH.fuelRender(); clearInterval(PH.fuelT); PH.fuelT=setInterval(PH.fuelRender,15000); };
PH.fuelClose=function(){ clearInterval(PH.fuelT); PH.fuelT=null; };
// copia notturna dei dati openAIP sul sito dell'app (una volta al giorno)
setTimeout(()=>{ if(!window.IA517_FUEL) return;
  IA517_FUEL.refresh(async()=>{ const u=PH.native?PH_INFO.web+'dati/carburante.json':'dati/carburante.json', r=await window.IA517.http(u+'?chk='+Date.now()); return r.status===200?JSON.parse(r.text):null; })
    .then(ok=>{ if(ok){ try{ const w=el('phAppFrame').contentWindow; w.renderFuelAlt&&w.renderFuelAlt(); }catch(e){} } }); },12000);

// ---------------- v2 · integrità dell'assetto e strumento fisico HORIZON (Bluetooth LE) ----------------
// Lo strumento fisico manda $RPYL (assetto), $POV (pressione statica, dinamica, vario) e $STAT.
// Quando c'è è la fonte principale; il telefono resta come confronto. Senza strumento il telefono
// si controlla da solo: giroscopio che non vede le virate, sensori saturi, filtro nativo e della pagina in disaccordo.
PH.EXT={want:lsGet('ia517p_ext',false),state:'spento',name:'',att:0,air:0,baro:0,r:0,p:0,y:0,s:0,ias:0,altFt:0,vs:0,stat:'',n:0};
PH.extAtt=now=>PH.EXT.att && (now||performance.now())-PH.EXT.att<500 && !PH.sim && !PH.demo;
PH.extAir=()=>PH.EXT.air && performance.now()-PH.EXT.air<2500 && !PH.sim && !PH.demo;
PH.extBaro=()=>PH.EXT.baro && performance.now()-PH.EXT.baro<2500 && !PH.sim && !PH.demo;
PH.extLine=function(line){ try{
  const p=line.trim().replace(/^\$/,'').split('*')[0].split(','), now=performance.now(), E=PH.EXT; E.n++;
  if(p[0]==='RPYL'){ const r=+p[1], pt=+p[2]; if(!isFinite(r)||!isFinite(pt)||Math.abs(r)>180||Math.abs(pt)>90) return;
    E.r=r; E.p=pt; E.y=+p[3]; E.s=+p[4]||0; E.att=now;
    if(PH.extAtt(now)){ S.roll=r; S.pitch=pt; S.slip=clamp(E.s,-1,1); LIVE.att=now; LIVE.any=true; } }
  else if(p[0]==='POV'){ for(let i=1;i<p.length-1;i+=2){ const v=+p[i+1]; if(!isFinite(v)) continue;
      if(p[i]==='Q'){ E.ias=Math.sqrt(2*Math.max(0,v)/1.225)*3.6; E.air=now; }
      else if(p[i]==='P' && v>300 && v<1100){ E.altFt=44330*(1-Math.pow(v/QNH,0.1903))/FT2M; E.baro=now; }
      else if(p[i]==='E') E.vs=clamp(v,-30,30); }
    if(PH.extAir()){ S.ias=E.ias; LIVE.air=now; }
    if(PH.extBaro()){ S.alt=E.altFt; S.vs=E.vs; LIVE.baro=now; } }
  else if(p[0]==='STAT') E.stat=p.slice(1).join(',');
}catch(e){} };
PH.extInfo=function(){ const E=PH.EXT, n=performance.now();
  if(!E.want) return 'non collegato';
  if(PH.extAtt(n)) return `${E.name||'collegato'} · ${Math.round(E.r)}° / ${Math.round(E.p)}°${PH.extAir()?' · '+Math.round(E.ias)+' km/h':''}${PH.extBaro()?' · '+Math.round(E.altFt)+' ft':''}`;
  return ({ricerca:'in ricerca…',collego:'collegamento…',collegato:'collegato, in attesa dei dati',perso:'perso, riprovo…',errore:'errore'})[E.state]||E.state; };
PH.extConnect=async function(on){ const B=PH.native&&PH.native.ble; if(!B){ toast('BLUETOOTH LE NON DISPONIBILE'); return; }
  PH.EXT.want=on; lsSet('ia517p_ext',on);
  try{ if(on){ await B.connect(); PH.act('strumento: ricerca'); } else { await B.disconnect(); PH.act('strumento: spento'); } }catch(e){ toast(String(e&&e.message||e).toUpperCase()); } };
if(PH.native && PH.native.ble){
  PH.listen(PH.native.ble,'line',d=>PH.extLine(d.l));
  PH.listen(PH.native.ble,'state',d=>{ PH.EXT.state=d.s; if(d.n) PH.EXT.name=d.n; PH.act&&PH.act('strumento: '+d.s);
    if(d.s==='collegato') toast('STRUMENTO COLLEGATO'); else if(d.s==='perso') toast('STRUMENTO PERSO'); });
  if(PH.EXT.want) setTimeout(()=>PH.extConnect(true),3000);
}

// controlli: un messaggio per volta, il più grave; ogni condizione deve durare prima di comparire
PH.INTEG={msg:null,lvl:0,t:{},sat:-1e9};
PH.integCheck=function(now,ro,pi,wb,fb){
  const I=PH.INTEG, hold=(k,cond,ms)=>{ if(cond){ I.t[k]=I.t[k]||now; return now-I.t[k]>ms; } I.t[k]=0; return false; };
  const rate=Math.hypot(wb[0],wb[1],wb[2])*R2D, gload=Math.hypot(fb[0],fb[1],fb[2]);
  if(rate>240||gload>3.6) I.sat=now;                                     // giroscopio o accelerometro al limite
  const E=PH.EXT, ext=PH.extAtt(now), NA=PH.natAtt;
  const pr=(PH.attF?PH.attF[0]:ro), pp=(PH.attF?PH.attF[1]:pi);
  const dis=ext && hold('dis',Math.abs(angDiff(E.r,pr))>6||Math.abs(E.p-pp)>5,2000);
  const nat=NA && now-NA.t<300 && hold('nat',Math.abs(angDiff(NA.r,PH.ahrs.euler()[0]))>10||Math.abs(NA.p-PH.ahrs.euler()[1])>8,3000);
  const gyr=hold('gyr',!!PH.gyroSus,1000);
  let m=null,l=0;
  if(dis){ m=['ATT DISAGREE',`strumento ${Math.round(E.r)}°/${Math.round(E.p)}° · telefono ${Math.round(pr)}°/${Math.round(pp)}°`]; l=2; }
  else if(gyr){ m=['ASSETTO DA GPS','il giroscopio non vede la virata: assetto stimato dalla traccia']; l=2; }
  else if(now-I.sat<5000){ m=['SENSORI AL LIMITE','manovra brusca: l\'assetto si riallinea in pochi secondi']; l=1; }
  else if(nat){ m=['ASSETTO INCERTO','i due calcoli del telefono non concordano']; l=1; }
  if(m && (!I.msg||I.msg[0]!==m[0])) PH.act&&PH.act('integrità: '+m[0]);
  I.msg=m; I.lvl=l;
};
// disegno: riquadro in alto sull'orizzonte, rosso o arancio; la croce rossa resta quella di «ASSETTO NON DISPONIBILE»
{ const dff=drawFailFlags; drawFailFlags=function(){ dff();
    const I=PH&&PH.INTEG; if(!I||!I.msg) return;
    if(lost('att')) return;
    ctx.save(); roundClip(); failBox(CX,CY-R*0.42,R*0.92,R*0.17,I.msg[0],I.msg[1],I.lvl>=2?'#ff3b3b':'#ffb020'); ctx.restore(); }; }

// ---------------- v2 · modalità NUBE, inversione a 180°, recupero da assetti inusuali ----------------
// NUBE: solo l'essenziale (assetto, velocità, quota, prua, virosbandometro), niente mappe né avvisi minori,
// voce solo per le cose gravi. In basso tre tasti grandi: INVERSIONE 180°, CAMPO VICINO, ESCI.
PH.imc=false;
PH.geoAt=(p,brg,km)=>{ const d=km/6371, b=brg*D2R, la=p.lat*D2R, lo=p.lon*D2R, la2=Math.asin(Math.sin(la)*Math.cos(d)+Math.cos(la)*Math.sin(d)*Math.cos(b));
  return {lat:la2*R2D,lon:(lo+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(la),Math.cos(d)-Math.sin(la)*Math.sin(la2)))*R2D}; };
PH.terrMaxAround=function(p,km){ let mx=NaN; for(let r=0;r<=km;r+=km/3) for(let a=0;a<360;a+=r?30:360){ const q=r?PH.geoAt(p,a,r):p, z=phDemAt(q.lat,q.lon); if(z===z) mx=mx===mx?Math.max(mx,z):z; } return mx; };
PH.imcSet=function(on){
  if(on===PH.imc) return; PH.imc=on; PH.act('NUBE '+(on?'attiva':'spenta'));
  document.body.classList.toggle('ph-imc',on);
  if(on && !PH.native){ try{ const d=document.documentElement; if(!document.fullscreenElement && d.requestFullscreen){ const q=d.requestFullscreen({navigationUI:'hide'}); PH.imcFs=true; if(q&&q.catch) q.catch(()=>{ PH.imcFs=false; }); } }catch(e){} }
  if(!on && PH.imcFs){ PH.imcFs=false; try{ if(document.fullscreenElement&&document.exitFullscreen) document.exitFullscreen().catch(()=>{}); }catch(e){} }
  if(on){ PH.imcPrev={ui:PH.ui,terr:S.terr,obst:S.obst,fd:S.fd,page:PAGE}; if(PAGE!=='pfd') togglePage(); S.obst=false; S.fd=true;
    PH.imcT0=Date.now(); PH.imcPos=S.gpsReal?{lat:S.lat,lon:S.lon,trk:S.trk!=null?S.trk:S.hdg,alt:S.alt}:null;
    // ultimo punto «a vista»: dove eri un minuto prima di entrare in nube (dal diario del volo), se c'è
    const pts=PH.flight&&PH.flight.pts; if(pts&&pts.length){ const t=Date.now()-60e3; let best=null; for(const q of pts){ if(q[3]<=t) best=q; } if(best) PH.imcVmc={lat:best[0],lon:best[1]}; }
    PH.say('modalità nube',true); }
  else { const P=PH.imcPrev||{}; S.terr=P.terr!=null?P.terr:S.terr; S.obst=P.obst!=null?P.obst:S.obst; S.fd=P.fd!=null?P.fd:S.fd; PH.rev=null; }
  PH.imcBar(); PH.layout&&PH.layout(); setTimeout(()=>PH.layout&&PH.layout(),350); };
// inversione: virata dalla parte del terreno più basso, inclinazione da virata standard (10–20°), quota mantenuta
// o portata sopra il terreno più alto nei dintorni + 500 ft; poi prua reciproca
PH.revStart=function(){
  const trk=S.trk!=null?S.trk:S.hdg, p={lat:S.lat,lon:S.lon};
  const zl=phDemAt(...Object.values(PH.geoAt(p,trk-90,2.5))), zr=phDemAt(...Object.values(PH.geoAt(p,trk+90,2.5)));
  const dir=(zl===zl&&zr===zr)?(zl<=zr?-1:1):-1;
  const V=Math.max(20,(S.gpsReal?S.gs:S.ias||100)/3.6), bank=clamp(Math.atan(V*3*D2R/9.80665)*R2D,10,20);
  const tz=PH.terrMaxAround(p,5), msaFt=tz===tz?Math.ceil((tz/FT2M+500)/100)*100:null;
  try{ el('toast').classList.remove('show'); }catch(e){}
  PH.rev={t0:Date.now(),tgt:wrap360(trk+180),dir,bank,alt:Math.max(S.alt||0,msaFt||0),msa:msaFt,phase:'vira',said:''};
  PH.act(`inversione 180 a ${dir<0?'sinistra':'destra'} ${Math.round(bank)}° verso ${Math.round(PH.rev.tgt)}`);
  PH.say(`inversione: vira a ${dir<0?'sinistra':'destra'}, ${Math.round(bank)} gradi`,true);
  PH.imcBar(); };
PH.revStep=function(){
  const r=PH.rev; if(!r) return null;
  const h=S.trk!=null&&S.gpsReal&&S.gs>30?S.trk:S.hdg, rem=angDiff(r.tgt,h);          // + = a destra
  const togo=r.dir<0?((-rem+360)%360):((rem+360)%360);                               // gradi da girare nel verso scelto
  if(r.phase==='vira' && (togo<12||togo>345)) r.phase='esci';
  if(r.phase==='esci' && Math.abs(rem)<4 && Math.abs(S.roll)<6){ r.phase='tieni'; }
  let cmdRoll=r.phase==='vira'?r.dir*r.bank:clamp(rem*1.5,-10,10);
  const dAlt=(r.alt-(S.alt||0)), cmdPitch=clamp(dAlt/150,-3,6);
  let line;
  if(r.phase==='vira') line=`VIRA A ${r.dir<0?'SINISTRA':'DESTRA'} ${Math.round(r.bank)}° · mancano ${Math.round(togo)}° (${Math.round(togo/3)} s)`;
  else if(r.phase==='esci') line=`LIVELLA LE ALI · prua ${String(Math.round(r.tgt)).padStart(3,'0')}°`;
  else line=`MANTIENI PRUA ${String(Math.round(r.tgt)).padStart(3,'0')}°`;
  const altTxt=Math.abs(dAlt)<120?`mantieni ${Math.round(r.alt/50)*50} ft`:(dAlt>0?`SALI a ${Math.round(r.alt/50)*50} ft`:`scendi dolce a ${Math.round(r.alt/50)*50} ft`);
  if(r.said!==r.phase){ r.said=r.phase; if(r.phase==='esci') PH.say('livella le ali',true); else if(r.phase==='tieni') PH.say('mantieni la prua',true); }
  return {cmdRoll,cmdPitch,line,altTxt,msa:r.msa};
};
PH.nearestRwyField=function(){ const p={lat:S.lat,lon:S.lon}; let best=null,bd=1e9;
  for(const f of FIELDS){ if(!f.ends||!f.ends.length||f.kind==='glac') continue; const d=distBrg(p,f).d; if(d<bd){ bd=d; best=f; } } return best; };
// barra in basso con i tasti grandi
PH.imcBar=function(){
  let b=el('phImcBar');
  if(!b){ b=document.createElement('div'); b.id='phImcBar'; b.className='ph-imcbar'; document.body.appendChild(b);
    b.addEventListener('click',e=>{ const t=e.target.closest('button'); if(!t) return; const a=t.dataset.a;
      if(a==='rev'){ if(PH.rev) { PH.rev=null; PH.act('inversione annullata'); PH.imcBar(); } else PH.revStart(); }
      else if(a==='near'){ const f=PH.nearestRwyField(); if(!f){ toast('NESSUN CAMPO CON PISTA NOTA'); return; }
        const tz=PH.terrMaxAround({lat:S.lat,lon:S.lon},5), alt=Math.max(S.alt||0,tz===tz?Math.ceil((tz/FT2M+500)/100)*100:0);
        directTo(f,alt); PH.rev=null; toast('DIRETTO · '+f.short); PH.say('diretto per '+f.name,true); PH.imcBar(); }
      else if(a==='vmc'){ const q=PH.imcVmc; if(!q){ toast('PUNTO A VISTA NON REGISTRATO'); return; }
        directTo({id:'VMC',short:'A VISTA',name:'Ultimo punto a vista',lat:q.lat,lon:q.lon,ends:[],elft:null,kind:'wp',...enu(q.lat,q.lon)},S.alt); PH.rev=null; toast('DIRETTO · ULTIMO PUNTO A VISTA'); PH.imcBar(); }
      else if(a==='exit') PH.imcSet(false); }); }
  b.hidden=!PH.imc;
  b.innerHTML=`<button type="button" data-a="rev" class="${PH.rev?'on':''}">${PH.rev?'ANNULLA 180°':'INVERSIONE 180°'}</button>
    <button type="button" data-a="near">CAMPO VICINO</button>${PH.imcVmc?'<button type="button" data-a="vmc">PUNTO A VISTA</button>':''}<button type="button" data-a="exit">ESCI</button>`;
};
// tasto NUBE accanto a LIVELLA
setTimeout(()=>{ const row=document.querySelector('.ph-statrow'); if(!row||el('phImcBtn')) return;
  const b=document.createElement('button'); b.type='button'; b.className='ph-lvl ph-imcbtn'; b.id='phImcBtn'; b.textContent='☁ NUBE'; b.setAttribute('aria-label','Modalità nube');
  b.addEventListener('click',ev=>{ ev.stopPropagation(); PH.imcSet(!PH.imc); }); row.insertBefore(b,el('phLvl')); },0);
// voce: in NUBE solo i messaggi urgenti
{ const sy=PH.say; PH.say=function(t,urgent){ if(PH.imc && !urgent) return; return sy.call(this,t,urgent); }; }
// disegno: in NUBE niente terreno 3D, campi, ostacoli e percorso; guida dell'inversione; recupero da assetti inusuali sempre
{ const dp=drawPFD; drawPFD=function(g){
    const unusual=!PH.demo && (PH.flight||PH.sim||(S.gpsReal&&S.gs>40)) && !lost('att') && (Math.abs(S.roll)>60||S.pitch>25||S.pitch<-20);
    const decl=PH.imc||unusual, sv={terr:S.terr,obst:S.obst};
    if(decl){ S.terr=false; S.obst=false; }
    let rv=null; if(PH.imc && PH.rev) rv=PH.revStep();
    const sd=S.fd; if(rv) S.fd=false;                                     // le barre le disegna l'inversione
    const nv={d:NAV.dest,a:NAV.app,r:NAV.route}; if(rv||unusual){ NAV.dest=null; NAV.app=null; NAV.route=null; }   // durante l'inversione e il recupero solo l'essenziale
    try{ dp(g); } finally{ S.terr=sv.terr; S.obst=sv.obst; S.fd=sd; NAV.dest=nv.d; NAV.app=nv.a; NAV.route=nv.r; }
    if(rv && !lost('att')){ fdBars({cmdRoll:rv.cmdRoll,cmdPitch:S.pitch+rv.cmdPitch});
      ctx.save(); roundClip(); failBox(CX,CY-R*0.44,R*1.1,R*0.19,rv.line,rv.altTxt+(rv.msa?` · minima ${rv.msa} ft`:''),'#ff5ae6'); ctx.restore(); }
    if(unusual) PH.drawUnusual();
    else PH.uaSaid=0;
  }; }
PH.drawUnusual=function(){
  const nh=S.pitch>25, nl=S.pitch<-20, bk=Math.abs(S.roll)>60, pitch=S.pitch*D2R, roll=S.roll*D2R, ph=F*Math.tan(pitch);
  ctx.save(); roundClip(); ctx.translate(CX,CY); ctx.rotate(-roll);
  // frecce rosse verso l'orizzonte
  const dirY=ph>0?1:-1, n=(nh||nl)?3:0;                                   // frecce solo per cabrata o picchiata
  for(let i=0;i<n;i++){ const y=dirY*(R*0.12+i*R*0.11); if(Math.abs(y)>Math.abs(ph)-R*0.04) break;
    ctx.beginPath(); ctx.moveTo(-R*0.16,y-dirY*R*0.05); ctx.lineTo(0,y+dirY*R*0.05); ctx.lineTo(R*0.16,y-dirY*R*0.05); ctx.lineWidth=7*k; ctx.strokeStyle='#ff2d2d'; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.stroke(); }
  ctx.restore();
  const lv=S.roll>0?'◀ LIVELLA LE ALI':'LIVELLA LE ALI ▶';                   // da che parte girare la cloche
  const t=nl?['PICCHIATA','RIDUCI MOTORE · LIVELLA LE ALI · RICHIAMA DOLCE']:nh?['CABRATA','MOTORE · PICCHIA · LIVELLA LE ALI']:[lv,'inclinazione '+Math.round(Math.abs(S.roll))+'°'];
  ctx.save(); roundClip(); failBox(CX,CY+R*0.52,R*1.12,R*0.2,t[0],t[1]); ctx.restore();
  const now=Date.now(); if(!PH.uaSaid||now-PH.uaSaid>6000){ if(!PH.uaSaid){ try{ el('toast').classList.remove('show'); }catch(e){} } PH.uaSaid=now; PH.say(nl?'picchiata. riduci motore, livella le ali, richiama':nh?'cabrata. motore, picchia, livella le ali':'livella le ali',true); PH.act('assetto inusuale '+t[0]); }
};
// durante l'inversione e il recupero da assetto inusuale niente scritte a comparsa sopra lo strumento
{ const tt=toast; toast=function(m){ if((PH.imc&&PH.rev)||(PH.uaSaid&&Date.now()-PH.uaSaid<6000)){ PH.act&&PH.act('(zitto) '+String(m).slice(0,40)); return; } return tt(m); }; }
