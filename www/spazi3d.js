// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// VISTA 3D DEGLI SPAZI AEREI (Briefing del Piano). Terreno vero attorno alla rotta, ogni spazio aereo come un solido
// tra base e tetto (il contorno della carta estruso in verticale: CTR appoggiati al suolo, CTA e TMA sospesi), la rotta
// alla quota del piano, il velo del limite VDS basico del giorno e la posizione dell'aereo (anche in simulazione).
// Due modi: ORBITA (un dito gira, due dita spostano e zoomano) e VOLA (comandi per avanzare, virare, salire, scendere;
// «Segui la rotta» la percorre da solo). Toccando uno spazio se ne vedono nome, classe, limiti e giudizio.
// La scena si taglia a una quota massima (di partenza 10.000 ft): gli spazi fino a FL195 finiscono lì, quelli che
// iniziano più in alto non si disegnano. FL in piedi con l'atmosfera standard. Solo a terra o in simulazione.
// Libreria: three.js (MIT), caricata solo quando si apre la vista.
(function(){
'use strict';
const FT=0.3048, D2R_=Math.PI/180;
const PS=()=>{ try{ return parent.phS||null; }catch(e){ return null; } };          // stato dell'aereo dello strumento
const st={EX:2,CAP:10000,veil:true,mode:'orbita',follow:false,segui:false,rotta:false,hid:new Set(),off:new Set(),fil:false};
// categorie per i filtri
const GRUPPI=[['vietati','Vietati e regolamentati (P, R)'],['controllati','Controllati (CTR, A–D)'],['e','E, RMZ, TMZ'],['pericolosi','Pericolosi e altri avvisi'],['altri','Altri (G, ATZ, …)']];
function gruppo(c){ c=String(c||'').toUpperCase(); if(/^(P|R)$/.test(c)) return 'vietati'; if(/^(CTR|A|B|C|D)$/.test(c)) return 'controllati'; if(/^(E|RMZ|TMZ)$/.test(c)) return 'e'; if(/^(Q|DANGER|W|GP)$/.test(c)) return 'pericolosi'; return 'altri'; }
let G=null;                                                   // scena aperta

function carica(){
  if(window.THREE) return Promise.resolve();
  return new Promise((ok,ko)=>{ const s=document.createElement('script'); s.src='three.min.js'; s.onload=()=>ok(); s.onerror=()=>ko(new Error('three.js non caricato')); document.head.appendChild(s); });
}
function inVoloVero(){ try{ const P=parent.PH, S_=PS(); if(!P||!S_) return false; if(P.demo||P.sim||S_.auto) return false; return !!P.flight||(S_.gpsReal&&S_.gs>45); }catch(e){ return false; } }

// ---- geometria locale (metri, attorno al centro della zona) ----
function zona(c){
  const pts=(c&&c.pts||[]).filter(p=>p&&p.lat!=null);
  let la0,lo0; if(pts.length){ la0=(Math.min(...pts.map(p=>p.lat))+Math.max(...pts.map(p=>p.lat)))/2; lo0=(Math.min(...pts.map(p=>p.lon))+Math.max(...pts.map(p=>p.lon)))/2; }
  else { const S_=PS()||{}; la0=S_.lat||45.25; lo0=S_.lon||7.9; }
  const kx=111320*Math.cos(la0*D2R_), ky=110540;
  const E=(lat,lon)=>({x:(lon-lo0)*kx, n:(lat-la0)*ky});
  let half=15000; for(const p of pts){ const q=E(p.lat,p.lon); half=Math.max(half,Math.abs(q.x)+12000,Math.abs(q.n)+12000); }
  half=Math.min(half,70000);
  return {la0,lo0,kx,ky,E,half,ll:(x,n)=>({lat:la0+n/ky,lon:lo0+x/kx})};
}
const yFt=ft=>ft*FT*st.EX;
// taglio di un contorno al quadrato della zona (Sutherland–Hodgman)
function clipSq(poly,h){
  const sides=[[p=>p.x>=-h,(a,b)=>{const t=(-h-a.x)/(b.x-a.x);return {x:-h,n:a.n+(b.n-a.n)*t};}],[p=>p.x<=h,(a,b)=>{const t=(h-a.x)/(b.x-a.x);return {x:h,n:a.n+(b.n-a.n)*t};}],
    [p=>p.n>=-h,(a,b)=>{const t=(-h-a.n)/(b.n-a.n);return {x:a.x+(b.x-a.x)*t,n:-h};}],[p=>p.n<=h,(a,b)=>{const t=(h-a.n)/(b.n-a.n);return {x:a.x+(b.x-a.x)*t,n:h};}]];
  let out=poly;
  for(const [inn,cut] of sides){ const inp=out; out=[]; if(!inp.length) break;
    for(let i=0;i<inp.length;i++){ const a=inp[i], b=inp[(i+1)%inp.length], ia=inn(a), ib=inn(b);
      if(ia) out.push(a); if(ia!==ib) out.push(cut(a,b)); } }
  return out;
}

// ---- costruzione della scena ----
function terreno(Z,THREE,grp,veilGrp){
  const N=96, h=Z.half, z=h>40000?9:10, n1=N+1, H=new Float32Array(n1*n1); let miss=0;
  for(let j=0;j<n1;j++) for(let i=0;i<n1;i++){ const x=-h+2*h*i/N, nn=h-2*h*j/N, p=Z.ll(x,nn);
    let v=NaN; try{ v=parent.phDemAt?parent.phDemAt(p.lat,p.lon,z):NaN; }catch(e){}
    if(!(v===v)){ miss++; v=0; } H[j*n1+i]=Math.max(0,v); }
  const geo=new THREE.PlaneGeometry(2*h,2*h,N,N); geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position, col=new Float32Array(pos.count*3), C=new THREE.Color();
  for(let k=0;k<pos.count;k++){ const m=H[k]; pos.setY(k,m*st.EX);
    if(m<5) C.setRGB(.05,.09,.14); else if(m<400) C.setRGB(.08,.13,.08); else if(m<1200) C.setRGB(.14,.15,.09); else if(m<2200) C.setRGB(.2,.17,.13); else C.setRGB(.45,.47,.5);   // scuro: gli spazi colorati si leggono meglio
    col[k*3]=C.r; col[k*3+1]=C.g; col[k*3+2]=C.b; }
  geo.setAttribute('color',new THREE.BufferAttribute(col,3)); geo.computeVertexNormals();
  grp.add(new THREE.Mesh(geo,new THREE.MeshLambertMaterial({vertexColors:true})));
  // velo del limite VDS basico del giorno (ft sul terreno)
  let agl=500; try{ agl=window.IA517_RULES?IA517_RULES.vdsMaxAgl(new Date()):500; }catch(e){}
  const vg=geo.clone(), vp=vg.attributes.position; for(let k=0;k<vp.count;k++) vp.setY(k,(H[k]+agl*FT)*st.EX);
  vg.deleteAttribute('color'); vg.computeVertexNormals();
  const veil=new THREE.Mesh(vg,new THREE.MeshBasicMaterial({color:0xffa020,transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide}));
  veil.userData={veil:true,agl}; veilGrp.add(veil);
  return {H,N,miss,agl,at:(x,nn)=>{ const i=Math.round((x+h)/(2*h)*N), j=Math.round((h-nn)/(2*h)*N); return (i>=0&&j>=0&&i<=N&&j<=N)?H[j*n1+i]:0; }};
}
function etichetta(THREE,txt,color,scale){
  const cv=document.createElement('canvas'), g=cv.getContext('2d'); g.font='700 44px sans-serif'; const w=Math.ceil(g.measureText(txt).width)+24;
  cv.width=w; cv.height=64; g.font='700 44px sans-serif'; g.fillStyle='rgba(6,10,15,.75)'; g.fillRect(0,0,w,64); g.fillStyle=color; g.textBaseline='middle'; g.fillText(txt,12,34);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),depthTest:false,transparent:true})); s.scale.set(scale*w/64,scale,1); s.renderOrder=10; return s;
}
function spazi(Z,THREE,grp,T){
  const list=[], h=Z.half, laMin=Z.la0-h/Z.ky, laMax=Z.la0+h/Z.ky, loMin=Z.lo0-h/Z.kx, loMax=Z.lo0+h/Z.kx;
  for(const a of (typeof ASP!=='undefined'?ASP:[])){
    if(!a.bb||a.bb[1]<laMin||a.bb[0]>laMax||a.bb[3]<loMin||a.bb[2]>loMax) continue;
    if(/^(FIR|UIR)$/i.test(a.cls)) continue;
    const poly=clipSq(a.pts.map(p=>Z.E(p.lat,p.lon)),h); if(poly.length<3) continue;
    const gm=poly.reduce((s,p)=>s+T.at(p.x,p.n),0)/poly.length;          // terreno medio sotto lo spazio (per i limiti AGL)
    const lo=a.lo.ref==='AGL'?(a.lo.ft?a.lo.ft+gm/FT:0):a.lo.ft, hi0=a.hi.ref==='AGL'?a.hi.ft+gm/FT:a.hi.ft;
    if(lo>=st.CAP) continue;
    const hi=Math.min(hi0,st.CAP), tagliato=hi0>st.CAP; if(hi-lo<50) continue;
    // base e tetto + pareti solo sui confini veri: dove il contorno è stato tagliato al bordo della zona niente parete
    // (prima i grandi CTA e TMA diventavano una scatola che copriva tutto)
    const col=new THREE.Color(typeof clsColor==='function'?clsColor(a.cls):'#8a96a2'), y0=yFt(lo), y1=yFt(hi), n=poly.length;
    const g=new THREE.Group(), meshes=[], mat=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.11,depthWrite:false,side:THREE.DoubleSide});
    const cap=new THREE.ShapeGeometry(new THREE.Shape(poly.map(p=>new THREE.Vector2(p.x,p.n)))); cap.rotateX(-Math.PI/2);
    const top=new THREE.Mesh(cap,mat); top.position.y=y1; g.add(top); meshes.push(top);
    if(lo>0){ const bot=new THREE.Mesh(cap,mat); bot.position.y=y0; g.add(bot); meshes.push(bot); }
    const lato=(p,q)=>(Math.abs(p.x-q.x)<1&&Math.abs(Math.abs(p.x)-h)<1)||(Math.abs(p.n-q.n)<1&&Math.abs(Math.abs(p.n)-h)<1);
    const wv=[], lb=[], lt=[], lv=[];
    for(let i=0;i<n;i++){ const p=poly[i], q=poly[(i+1)%n]; if(lato(p,q)) continue;
      wv.push(p.x,y0,-p.n, q.x,y0,-q.n, q.x,y1,-q.n,  p.x,y0,-p.n, q.x,y1,-q.n, p.x,y1,-p.n);
      lb.push(p.x,y0,-p.n,q.x,y0,-q.n); lt.push(p.x,y1,-p.n,q.x,y1,-q.n);
      const r=poly[(i+n-1)%n], d1=Math.atan2(p.n-r.n,p.x-r.x), d2=Math.atan2(q.n-p.n,q.x-p.x), turn=Math.abs(((d2-d1)*180/Math.PI+540)%360-180);
      if(turn>25) lv.push(p.x,y0,-p.n,p.x,y1,-p.n); }
    if(wv.length){ const wg=new THREE.BufferGeometry(); wg.setAttribute('position',new THREE.Float32BufferAttribute(wv,3)); const w=new THREE.Mesh(wg,mat); g.add(w); meshes.push(w); }
    const linea=(arr,dash)=>{ if(!arr.length) return; const lg=new THREE.BufferGeometry(); lg.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));
      const l=new THREE.LineSegments(lg,dash?new THREE.LineDashedMaterial({color:col,dashSize:h/150,gapSize:h/150,transparent:true,opacity:.85}):new THREE.LineBasicMaterial({color:col,transparent:true,opacity:.9}));
      if(dash) l.computeLineDistances(); g.add(l); };
    linea(lo>0?lb:[],false); linea(lt,tagliato); linea(lv,false);
    const s={g,meshes,a,poly,lo,hi,tagliato,gr:gruppo(a.cls),key:(a.name||'')+'|'+a.cls+'|'+a.lo.txt};
    meshes.forEach(m=>m.userData.s=s); grp.add(g); list.push(s);
  }
  return list;
}
function rotta(Z,THREE,grp,c,b){
  if(!b||!b.samples||b.samples.length<2) return null;
  const pts=b.samples.map(s=>{ const q=Z.E(s.lat,s.lon); let ft=0; try{ ft=profileAt(s.x,b.tot,b.e0,b.e1); }catch(e){ ft=(typeof PLAN!=='undefined'&&PLAN.cruiseFt)||2500; } return new THREE.Vector3(q.x,yFt(ft),-q.n); });
  const curve=new THREE.CatmullRomCurve3(pts,false,'centripetal');
  grp.add(new THREE.Mesh(new THREE.TubeGeometry(curve,Math.min(400,pts.length*2),Z.half/650,6,false),new THREE.MeshBasicMaterial({color:0xff46e0})));
  // campi e punti della rotta
  for(const p of (c.pts||[])){ const q=Z.E(p.lat,p.lon), g0=(()=>{ try{ return Math.max(0,parent.phDemAt(p.lat,p.lon,10)||0); }catch(e){ return 0; } })();
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(Z.half/700,Z.half/700,yFt(1500),6),new THREE.MeshBasicMaterial({color:0xffffff}));
    pole.position.set(q.x,g0*st.EX+yFt(750),-q.n); grp.add(pole);
    const l=etichetta(THREE,p.short||p.name||'',  '#ffffff',Z.half/22); l.position.set(q.x,g0*st.EX+yFt(1700),-q.n); grp.add(l); }
  return {curve,pts};
}

// ---- interfaccia ----
function html(){
  return `<div class="s3-bar">
    <button type="button" data-k="x">✕</button>
    <button type="button" data-k="mode">${st.mode==='orbita'?'🛩 VOLA':'🔄 ORBITA'}</button>
    <button type="button" data-k="follow"${st.follow?' class="on"':''}>▶ ROTTA</button>
    <button type="button" data-k="segui"${st.segui?' class="on"':''}>✈ SEGUI</button>
    <button type="button" data-k="fil"${st.fil?' class="on"':''}>☰ FILTRI</button>
    <button type="button" data-k="ex">×${st.EX}</button>
    <button type="button" data-k="cap">${st.CAP/1000}k ft</button>
    <button type="button" data-k="veil"${st.veil?' class="on"':''}>VDS</button></div>
  <div class="s3-hud" id="s3Hud"></div>
  <div class="s3-info" id="s3Info" hidden></div>
  <div class="s3-fil" id="s3Fil"${st.fil?'':' hidden'}>
    <label><input type="checkbox" data-f="rotta"${st.rotta?' checked':''}> Solo quelli attraversati dalla rotta</label>
    ${GRUPPI.map(([k,l])=>`<label><input type="checkbox" data-g="${k}"${st.hid.has(k)?'':' checked'}> ${l}</label>`).join('')}
    ${st.off.size?`<button type="button" data-k="mostra">Mostra di nuovo i ${st.off.size} nascosti</button>`:''}
    <small>Tocca uno spazio e premi «Nascondi» per toglierlo da solo.</small></div>
  <div class="s3-pad" id="s3Pad"${st.mode==='vola'?'':' hidden'}>
    <button data-p="su">⤒</button><button data-p="av">▲</button><button data-p="giu">⤓</button>
    <button data-p="sx">◀</button><button data-p="in">▼</button><button data-p="dx">▶</button></div>
  <div class="s3-leg">Rosso: vietati e regolamentati · Blu: controllati (CTR, A–D) · Viola: E, RMZ, TMZ · Giallo: pericolosi · Arancio: limite VDS del giorno · Quote ×${st.EX}</div>`;
}
{ const s=document.createElement('style'); s.textContent=`#s3{position:fixed;inset:0;z-index:60;background:#0a0f14;touch-action:none}
  #s3 canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
  #s3 .s3-bar{position:absolute;top:max(8px,env(safe-area-inset-top,0px));left:8px;right:8px;display:flex;gap:6px;flex-wrap:wrap;z-index:2}
  #s3 button{min-height:44px;min-width:44px;padding:0 10px;border-radius:10px;border:2px solid #3a4a5a;background:rgba(20,28,36,.88);color:#eef3f8;font:800 14px system-ui,sans-serif}
  #s3 button.on{border-color:#33e1ff;color:#33e1ff}
  #s3 .s3-hud{position:absolute;top:calc(max(8px,env(safe-area-inset-top,0px)) + 56px);left:8px;right:8px;font:700 14px system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px #000;z-index:2;pointer-events:none}
  #s3 .s3-info{position:absolute;left:8px;right:8px;bottom:calc(36px + env(safe-area-inset-bottom,0px));background:rgba(12,18,24,.94);border:1px solid #33e1ff;border-radius:12px;padding:10px;color:#e5ecf1;font:500 15px/1.35 system-ui,sans-serif;z-index:3}
  #s3 .s3-info b{font-size:17px} #s3 .s3-info .ok{color:#19e38a} #s3 .s3-info .warn{color:#ffd21e} #s3 .s3-info .bad{color:#ff5a5a}
  #s3 .s3-pad{position:absolute;right:8px;bottom:calc(40px + env(safe-area-inset-bottom,0px));display:grid;grid-template-columns:repeat(3,56px);gap:6px;z-index:2}
  #s3 .s3-pad button{min-height:56px;font-size:22px}
  #s3 .s3-fil{position:absolute;left:8px;right:8px;top:120px;max-width:420px;background:rgba(12,18,24,.95);border:1px solid #33e1ff;border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px;color:#e5ecf1;font:600 15px system-ui,sans-serif;z-index:4}
  #s3 .s3-fil label{display:flex;gap:10px;align-items:center;min-height:36px} #s3 .s3-fil input{width:22px;height:22px} #s3 .s3-fil small{color:#9aa4b0}
  #s3 .s3-leg{position:absolute;left:8px;right:8px;bottom:max(6px,env(safe-area-inset-bottom,0px));font:600 11px system-ui,sans-serif;color:#9aa4b0;z-index:2;pointer-events:none}`; document.head.appendChild(s); }

window.SP3D_open=async function(){
  if(inVoloVero()){ toast&&toast('Vista 3D: solo a terra o in simulazione'); return; }
  try{ await carica(); }catch(e){ toast&&toast('Vista 3D non disponibile: '+e.message); return; }
  const THREE=window.THREE;
  let c=null, b=typeof BRIEF!=='undefined'?BRIEF:null; try{ c=compute(); }catch(e){}
  const box=document.createElement('div'); box.id='s3'; document.body.appendChild(box);
  const renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  box.appendChild(renderer.domElement);
  const ui=document.createElement('div'); box.appendChild(ui);
  const scene=new THREE.Scene(); scene.background=new THREE.Color(0x0a0f14); scene.fog=null;
  scene.add(new THREE.HemisphereLight(0xdfe8ff,0x223018,.8)); const sun=new THREE.DirectionalLight(0xffffff,1.1); sun.position.set(-1,2,1); scene.add(sun);
  const cam=new THREE.PerspectiveCamera(55,1,10,1e6);
  const Z=zona(c), world=new THREE.Group(), veilGrp=new THREE.Group(); scene.add(world); scene.add(veilGrp);
  let T=null, L=[], R=null, tries=0;
  let build=()=>{ world.clear(); veilGrp.clear(); T=terreno(Z,THREE,world,veilGrp); L=spazi(Z,THREE,world,T); R=c&&b?rotta(Z,THREE,world,c,b):null; veilGrp.visible=st.veil; };
  // filtri: categorie, solo la rotta, spazi nascosti uno per uno (si spengono e basta: niente ricostruzione)
  const sullaRotta=()=>new Set(((typeof BRIEF!=='undefined'&&BRIEF&&BRIEF.asp)||[]).map(x=>x.a));
  function filtra(){ const R0=st.rotta?sullaRotta():null; for(const s of L) s.g.visible=!st.hid.has(s.gr)&&!st.off.has(s.key)&&(!R0||R0.has(s.a)); }
  const build0=build; build=()=>{ build0(); filtra(); };
  build();
  // il terreno arriva a pezzi: si ricostruisce finché mancano riquadri (al massimo 8 volte)
  const reb=setInterval(()=>{ if(!G||G.box!==box){ clearInterval(reb); return; } if(T.miss>0 && tries++<8) build(); else clearInterval(reb); },1500);
  // aereo (posizione dello strumento: vera, demo o simulazione)
  const plane=new THREE.Mesh(new THREE.ConeGeometry(Z.half/90,Z.half/28,10),new THREE.MeshBasicMaterial({color:0xffd21e,depthTest:false})); plane.renderOrder=20; plane.rotation.order='YXZ'; plane.rotation.x=-Math.PI/2; plane.visible=false; scene.add(plane);
  const dropG=new THREE.BufferGeometry(); dropG.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,0,0,0],3));
  const drop=new THREE.Line(dropG,new THREE.LineDashedMaterial({color:0xffd21e,dashSize:Z.half/200,gapSize:Z.half/200})); scene.add(drop);
  const trail=[], trailG=new THREE.BufferGeometry(), trailL=new THREE.Line(trailG,new THREE.LineBasicMaterial({color:0xffd21e,transparent:true,opacity:.8})); scene.add(trailL);
  // camera
  const O={tx:0,ty:yFt(2500),tz:0,dist:Z.half*2.2,az:0.6,el:0.8};
  const F={x:0,y:yFt(3000),z:Z.half*0.9,yaw:0,pitch:-0.08,keys:new Set(),s:0};
  function camOrbit(){ cam.position.set(O.tx+O.dist*Math.cos(O.el)*Math.sin(O.az),O.ty+O.dist*Math.sin(O.el),O.tz+O.dist*Math.cos(O.el)*Math.cos(O.az)); cam.lookAt(O.tx,O.ty,O.tz); }
  function camFly(){ cam.position.set(F.x,F.y,F.z); cam.lookAt(F.x-Math.sin(F.yaw)*Math.cos(F.pitch),F.y+Math.sin(F.pitch),F.z-Math.cos(F.yaw)*Math.cos(F.pitch)); }
  function size(){ const w=box.clientWidth, h=box.clientHeight; renderer.setSize(w,h,false); cam.aspect=w/Math.max(1,h); cam.updateProjectionMatrix(); }
  size(); const ro=new ResizeObserver(size); ro.observe(box);
  // dentro quali spazi è la camera (in VOLA): punto nel contorno e quota tra base e tetto
  const pip2=(p,poly)=>{ let ins=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){ const a=poly[i], q=poly[j]; if(((a.n>p.n)!==(q.n>p.n))&&(p.x<(q.x-a.x)*(p.n-a.n)/(q.n-a.n)+a.x)) ins=!ins; } return ins; };
  function hud(){
    const el=document.getElementById('s3Hud'); if(!el) return;
    if(st.mode==='vola'){ const ft=F.y/FT/st.EX, p={x:F.x,n:-F.z}, g0=T.at(p.x,p.n)/FT, dentro=L.filter(s=>ft>=s.lo&&ft<=s.hi&&pip2(p,s.poly));
      const vds=ft-g0>T.agl; el.innerHTML=`Quota ${Math.round(ft/10)*10} ft · sul terreno ${Math.round((ft-g0)/10)*10} ft${vds?' · <span style="color:#ffa020">SOPRA IL LIMITE VDS</span>':''}<br>${dentro.length?'Dentro: '+dentro.map(s=>esc((typeof clsLabel==='function'?clsLabel(s.a):s.a.cls)+' '+(s.a.name||''))).join(' · '):'Fuori dagli spazi disegnati'}`; }
    else { const vis=L.filter(s=>s.g.visible).length; let ae='';
      if(plane.visible&&PS()){ const S_=PS(), ft=S_.alt||0, p={x:plane.position.x,n:-plane.position.z}, g0=T.at(p.x,p.n)/FT, dentro=L.filter(s=>ft>=s.lo&&ft<=s.hi&&pip2(p,s.poly));
        ae=`<br>✈ ${Math.round(ft/10)*10} ft · sul terreno ${Math.round((ft-g0)/10)*10} ft${ft-g0>T.agl?' · <span style="color:#ffa020">SOPRA IL LIMITE VDS</span>':''} · ${dentro.length?'dentro: '+dentro.map(s=>esc((typeof clsLabel==='function'?clsLabel(s.a):s.a.cls)+' '+(s.a.name||''))).join(' · '):'fuori dagli spazi'}`; }
      el.innerHTML=`${vis}${vis!==L.length?' di '+L.length:''} spazi · zona ${Math.round(Z.half/500)} km di lato${T.miss?' · terreno in arrivo…':''}${ae}`; }
  }
  function info(s){
    const el=document.getElementById('s3Info'); if(!s){ el.hidden=true; return; }
    let v={status:'warn',text:''}; try{ v=IA517_RULES.verdict(s.a); }catch(e){}
    el.innerHTML=`<b>${esc((typeof clsLabel==='function'?clsLabel(s.a):s.a.cls))} · ${esc(s.a.name||'senza nome')}</b><br>da ${esc(s.a.lo.txt)} a ${esc(s.a.hi.txt)}${s.tagliato?` (disegnato fino a ${st.CAP} ft)`:''}<br><span class="${v.status}">${esc(v.text||'')}</span><br><button type="button" id="s3Hide">Nascondi questo spazio</button> <small>Tocca fuori per chiudere</small>`;
    el.hidden=false; document.getElementById('s3Hide').onclick=()=>{ st.off.add(s.key); filtra(); el.hidden=true; wire(); }; }
  // comandi: tocco e trascinamento
  const ptr=new Map(); let t0=0, moved=0, pinch=null;
  const cv=renderer.domElement;
  cv.addEventListener('pointerdown',e=>{ cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId,{x:e.clientX,y:e.clientY}); if(ptr.size===1){ t0=performance.now(); moved=0; } pinch=null; });
  cv.addEventListener('pointermove',e=>{ const p=ptr.get(e.pointerId); if(!p) return; const dx=e.clientX-p.x, dy=e.clientY-p.y; moved+=Math.abs(dx)+Math.abs(dy);
    if(ptr.size===1){ if(st.mode==='orbita'){ O.az-=dx*0.006; O.el=Math.max(0.03,Math.min(1.5,O.el+dy*0.005)); } else { F.yaw-=dx*0.005; F.pitch=Math.max(-1.2,Math.min(1.2,F.pitch-dy*0.004)); } }
    p.x=e.clientX; p.y=e.clientY;
    if(ptr.size===2){ const [a,q]=[...ptr.values()], d=Math.hypot(a.x-q.x,a.y-q.y), mx=(a.x+q.x)/2, my=(a.y+q.y)/2;
      if(pinch){ const k=pinch.d/Math.max(10,d);
        if(st.mode==='orbita'){ O.dist=Math.max(800,Math.min(Z.half*5,O.dist*k));
          // spostamento sul piano orizzontale: destra = (cos az, −sin az), avanti = (−sin az, −cos az)
          const s=O.dist/700, dx2=mx-pinch.mx, dy2=my-pinch.my, ca=Math.cos(O.az), sa=Math.sin(O.az);
          O.tx+=-dx2*s*ca-dy2*s*sa; O.tz+=dx2*s*sa-dy2*s*ca; }
        else F.y=Math.max(yFt(100),F.y*(k>1?1.02:0.98)); }
      pinch={d,mx,my}; } });
  const up=e=>{ ptr.delete(e.pointerId); pinch=null;
    if(ptr.size===0 && moved<10 && performance.now()-t0<350){ const r=cv.getBoundingClientRect(), m=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
      const rc=new THREE.Raycaster(); rc.setFromCamera(m,cam); const hit=rc.intersectObjects(L.filter(s=>s.g.visible).flatMap(s=>s.meshes),false)[0]; info(hit?hit.object.userData.s:null); } };
  cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',up);
  cv.addEventListener('wheel',e=>{ e.preventDefault(); if(st.mode==='orbita') O.dist=Math.max(800,Math.min(Z.half*5,O.dist*(e.deltaY>0?1.12:0.89))); else F.y=Math.max(yFt(100),F.y+(e.deltaY>0?-1:1)*yFt(200)); },{passive:false});
  // pulsanti
  const wire=()=>{ ui.innerHTML=html();
    ui.querySelectorAll('[data-k]').forEach(bt=>bt.onclick=()=>{ const k=bt.dataset.k;
      if(k==='x'){ chiudi(); return; }
      if(k==='mode'){ st.mode=st.mode==='orbita'?'vola':'orbita'; if(st.mode==='vola'){ F.x=O.tx+Math.sin(O.az)*Z.half*0.5; F.z=O.tz+Math.cos(O.az)*Z.half*0.5; F.y=yFt(3000); F.yaw=O.az; F.pitch=-0.05; } st.follow=false; }
      if(k==='follow'){ st.follow=!st.follow; if(st.follow){ st.mode='vola'; F.s=0; } }
      if(k==='ex'){ const o=[1,2,3]; st.EX=o[(o.indexOf(st.EX)+1)%o.length]; trail.length=0; build(); }
      if(k==='cap'){ const o=[6000,10000,15000]; st.CAP=o[(o.indexOf(st.CAP)+1)%o.length]; build(); }
      if(k==='veil'){ st.veil=!st.veil; veilGrp.visible=st.veil; }
      if(k==='fil') st.fil=!st.fil;
      if(k==='mostra'){ st.off.clear(); filtra(); }
      if(k==='segui'){ st.segui=!st.segui; if(st.segui){ st.mode='orbita'; st.follow=false; O.dist=Z.half*0.45; O.el=0.35; if(!plane.visible) toast&&toast('Aereo fuori dalla zona: avvia la simulazione o il volo dimostrativo'); } }
      wire(); });
    ui.querySelectorAll('[data-g]').forEach(c2=>c2.onchange=()=>{ c2.checked?st.hid.delete(c2.dataset.g):st.hid.add(c2.dataset.g); filtra(); });
    ui.querySelectorAll('[data-f="rotta"]').forEach(c2=>c2.onchange=()=>{ st.rotta=c2.checked; filtra(); });
    // la riga dei dati va sotto la barra dei tasti (che su schermi stretti va su due righe)
    const bar=ui.querySelector('.s3-bar'), hd=ui.querySelector('.s3-hud'); if(bar&&hd) requestAnimationFrame(()=>{ hd.style.top=(bar.offsetTop+bar.offsetHeight+6)+'px'; });
    ui.querySelectorAll('[data-p]').forEach(bt=>{ const k=bt.dataset.p;
      bt.addEventListener('pointerdown',e=>{ e.preventDefault(); F.keys.add(k); st.follow=false; }); ['pointerup','pointerleave','pointercancel'].forEach(ev=>bt.addEventListener(ev,()=>F.keys.delete(k))); }); };
  wire();
  // movimento in VOLA: velocità proporzionata alla zona (si attraversa in circa 40 s)
  let last=performance.now(), raf=0, hT=0;
  function loop(now){
    raf=requestAnimationFrame(loop); const dt=Math.min(0.05,(now-last)/1000); last=now;
    if(st.mode==='vola'){
      const v=Z.half/20;
      if(st.follow&&R){ F.s=(F.s+dt/45)%1; const p=R.curve.getPointAt(F.s), q=R.curve.getPointAt(Math.min(1,F.s+0.004)); F.x=p.x; F.y=p.y+yFt(400); F.z=p.z;
        F.yaw=Math.atan2(-(q.x-p.x),-(q.z-p.z)); F.pitch=-0.12; }
      else { const K=F.keys; if(K.has('av')){ F.x-=Math.sin(F.yaw)*v*dt; F.z-=Math.cos(F.yaw)*v*dt; } if(K.has('in')){ F.x+=Math.sin(F.yaw)*v*dt; F.z+=Math.cos(F.yaw)*v*dt; }
        if(K.has('sx')) F.yaw+=0.9*dt; if(K.has('dx')) F.yaw-=0.9*dt; if(K.has('su')) F.y+=yFt(1500)*dt; if(K.has('giu')) F.y=Math.max(yFt(100),F.y-yFt(1500)*dt); }
      const g0=T.at(F.x,-F.z)*st.EX+yFt(80); if(F.y<g0) F.y=g0;
      camFly();
    } else { if(st.segui&&plane.visible){ const k2=Math.min(1,dt*3); O.tx+=(plane.position.x-O.tx)*k2; O.ty+=(plane.position.y-O.ty)*k2; O.tz+=(plane.position.z-O.tz)*k2; } camOrbit(); }
    try{ const S_=PS(); if(S_&&S_.lat!=null){ const q=Z.E(S_.lat,S_.lon), y=yFt(S_.alt||0); plane.position.set(q.x,y,-q.n); plane.rotation.set(-Math.PI/2,-((S_.trk!=null?S_.trk:S_.hdg)||0)*D2R_,0);
      plane.visible=Math.abs(q.x)<Z.half*1.2&&Math.abs(q.n)<Z.half*1.2; drop.visible=trailL.visible=plane.visible;
      const dp=dropG.attributes.position; dp.setXYZ(0,q.x,y,-q.n); dp.setXYZ(1,q.x,T.at(q.x,q.n)*st.EX,-q.n); dp.needsUpdate=true; drop.computeLineDistances();
      const lp=trail[trail.length-1]; if(plane.visible&&(!lp||Math.hypot(lp.x-q.x,lp.z+q.n)>Z.half/400)){ trail.push(new THREE.Vector3(q.x,y,-q.n)); if(trail.length>1500) trail.shift(); trailG.setFromPoints(trail); } } }catch(e){}
    if(now-hT>300){ hT=now; hud(); }
    renderer.render(scene,cam);
  }
  raf=requestAnimationFrame(loop);
  function chiudi(){ cancelAnimationFrame(raf); clearInterval(reb); ro.disconnect(); renderer.dispose(); scene.traverse(o=>{ if(o.geometry) o.geometry.dispose(); if(o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{ if(m.map) m.map.dispose(); m.dispose(); }); } }); box.remove(); G=null; }
  G={box,chiudi};
  try{ parent.PH&&parent.PH.act&&parent.PH.act('vista 3D spazi aerei'); }catch(e){}
};
{ const b=document.getElementById('asp3d'); if(b) b.addEventListener('click',()=>window.SP3D_open()); }
})();
