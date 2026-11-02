// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
// =====================================================================================
//  Rotta disegnata a schermo pieno: un tocco aggiunge un punto, trascinando la linea
//  magenta si inserisce un punto, trascinando un punto su quello vicino lo si toglie.
//  Per ogni tratta: prua, minuti, distanza e quota sicura sul terreno. «Evita zone»
//  ricalcola la rotta intorno a P, R e (per il profilo di volo) agli spazi vietati,
//  passando dove il terreno lascia il margine alla quota di crociera.
// =====================================================================================
const RD={on:false,pts:[],hist:[],clat:45.25,clon:7.9,mpp:60,margin:store.get('ia517_rd_margin',1000),info:[],busy:false,msg:''};
const RD_HIT=24;
// punti liberi della rotta (non campi): restano nel telefono e allo strumento arrivano come punti di rotta
let RD_WPS=store.get('ia517_wps',[]);
// punti da non sorvolare (paesi, case, impianti…): cerchi che la rotta gira intorno
let RD_NOFLY=store.get('ia517_nofly',[]);
function rdNoflyHit(a,b){ const out=[]; for(const z of RD_NOFLY){ const cl=Math.cos(z.lat*D2R), ax=(a.lon-z.lon)*111320*cl, ay=(a.lat-z.lat)*110540, bx=(b.lon-z.lon)*111320*cl, by=(b.lat-z.lat)*110540;
  const dx=bx-ax, dy=by-ay, L2=dx*dx+dy*dy, t=L2?clamp(-(ax*dx+ay*dy)/L2,0,1):0; if(Math.hypot(ax+t*dx,ay+t*dy)<z.r) out.push(z); } return out; }
function rdWpField(w){ return {id:w.id,short:String(w.name).toUpperCase().slice(0,14),name:w.name,lat:w.lat,lon:w.lon,elft:null,kind:'wp',rw:[],ends:[],rdwp:true}; }
for(const w of RD_WPS) if(!byId(w.id)) FIELDS.push(rdWpField(w));
// punti di riporto VFR del Nord Italia (openAIP, CC BY-NC 4.0): [nome, sigla, lat, lon, obbligatorio]
const rdTitle=t=>t.toLowerCase().replace(/(^|[\s'(-])([a-zàèéìòù])/g,(m,a,b)=>a+b.toUpperCase());
const RD_RPP=(__RPP__).map(([name,code,lat,lon,c])=>{ const rest=code&&name.startsWith(code)?name.slice(code.length).trim():name, cd=(code||name).replace(/\s+/g,'');
  return {id:'RP-'+cd,short:(cd+(rest&&rest!==code?' '+rest:'')).slice(0,16),label:cd+(rest&&rest!==code?' ('+rdTitle(rest)+')':''),name,code:cd,lat,lon,comp:!!c,rp:true,kind:'rp'}; });

function rdDem(lat,lon,z){ try{ return parent&&parent.phDemAt?parent.phDemAt(lat,lon,z||10):NaN; }catch(e){ return NaN; } }
function rdAspAll(){ return (typeof ASP!=='undefined'&&Array.isArray(ASP)&&ASP_SRC.real)?ASP:[]; }
function rdPip(p,poly){ let ins=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){ const a=poly[i], b=poly[j];
  if(((a.lat>p.lat)!==(b.lat>p.lat)) && (p.lon<(b.lon-a.lon)*(p.lat-a.lat)/(b.lat-a.lat)+a.lon)) ins=!ins; } return ins; }
function rdLim(L,terrFt){ if(!L) return 0; if(L.ref==='AGL') return L.ft?L.ft+(terrFt||0):-1e9; return L.ft; }
// spazi da evitare con il profilo di volo scelto: P e R sempre, poi quelli che le regole vietano
function rdAvoid(a){ if(!a||!a.pts||a.pts.length<3) return false; if(a.cls==='P'||a.cls==='R') return true;
  try{ return window.IA517_RULES && IA517_RULES.verdict(a).status==='bad'; }catch(e){ return false; } }

// ---------- vista ----------
function rdW(){ return RD.cv.clientWidth; } function rdH(){ return RD.cv.clientHeight; }
function rdP(lat,lon){ const cl=Math.cos(RD.clat*D2R); return {x:rdW()/2+(lon-RD.clon)*111320*cl/RD.mpp, y:rdH()/2-(lat-RD.clat)*110540/RD.mpp}; }
function rdLL(x,y){ const cl=Math.cos(RD.clat*D2R); return {lat:RD.clat-(y-rdH()/2)*RD.mpp/110540, lon:RD.clon+(x-rdW()/2)*RD.mpp/(111320*cl)}; }
function rdFit(){ const ps=RD.pts.length?RD.pts:[HOME]; let la0=Math.min(...ps.map(p=>p.lat)), la1=Math.max(...ps.map(p=>p.lat)), lo0=Math.min(...ps.map(p=>p.lon)), lo1=Math.max(...ps.map(p=>p.lon));
  RD.clat=(la0+la1)/2; RD.clon=(lo0+lo1)/2; const cl=Math.cos(RD.clat*D2R);
  const spanE=(lo1-lo0)*111320*cl, spanN=(la1-la0)*110540; RD.mpp=Math.max(25,Math.max(spanE/(rdW()*0.75),spanN/(rdH()*0.6),15000/rdW())); }

// ---------- DOM ----------
function rdBuild(){
  if(RD.root) return;
  const st=document.createElement('style'); st.textContent=`
  .rdx{position:fixed;inset:0;z-index:50;background:#0a1410;display:flex;flex-direction:column;touch-action:none;user-select:none;-webkit-user-select:none}
  .rdx canvas{flex:1;width:100%;min-height:0;display:block;touch-action:none}
  .rdx .rdt{display:flex;align-items:center;gap:6px;padding:6px 8px;background:#0d1115;border-bottom:1px solid #26303b}
  .rdx .rdt b{flex:1;font:700 14px system-ui,sans-serif;color:#e8eef5;text-align:center}
  .rdx button{min-height:42px;padding:0 12px;border-radius:10px;border:1px solid #3a4250;background:#161c23;color:#e8eef5;font:700 13px system-ui,sans-serif}
  .rdx button.pri{background:#ff46e0;border-color:#ff46e0;color:#1a0016}
  .rdx button:disabled{opacity:.45}
  .rdx .rdb{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;padding:6px 8px;background:#0d1115;border-top:1px solid #26303b}
  .rdx .rdb button{padding:0 4px;font-size:12px}
  .rdx .rdi{padding:6px 10px 8px;background:#0d1115;color:#c9d3de;font:600 12px system-ui,sans-serif;max-height:28vh;overflow:auto}
  .rdx .rdi .bad{color:#ff6b6b} .rdx .rdi .warn{color:#ffb020} .rdx .rdi .ok{color:#5bd38a}
  .rdx .rdi select{width:auto;display:inline-block;min-height:0;background:#161c23;color:#e8eef5;border:1px solid #3a4250;border-radius:8px;padding:4px 6px;font:600 12px system-ui}
  .rdx .rdh{position:absolute;left:50%;transform:translateX(-50%);top:58px;background:rgba(7,10,15,.86);color:#e8eef5;border:1px solid #3a4250;border-radius:10px;padding:6px 10px;font:600 12px system-ui;pointer-events:none;max-width:92%;text-align:center}`;
  document.head.appendChild(st);
  const d=document.createElement('div'); d.className='rdx'; d.hidden=true;
  d.innerHTML=`<div class="rdt"><button type="button" id="rdClose">✕ Chiudi</button><b>Disegna la rotta</b><button type="button" class="pri" id="rdOk">Fatto</button></div>
    <canvas id="rdCv" aria-label="Mappa per disegnare la rotta"></canvas><div class="rdh" id="rdHint"></div>
    <div class="rdi" id="rdInfo"></div>
    <div class="rdb"><button type="button" id="rdUndo">↶ Annulla</button><button type="button" id="rdAv">Calcola rotta</button><button type="button" id="rdAlt">Quota sicura</button><button type="button" id="rdRev">⇄ Inverti</button><button type="button" id="rdClr">Svuota</button></div>`;
  document.body.appendChild(d); RD.root=d; RD.cv=d.querySelector('#rdCv'); RD.ctx=RD.cv.getContext('2d');
  $('rdClose').onclick=()=>rdClose(false); $('rdOk').onclick=()=>rdClose(true);
  $('rdUndo').onclick=()=>{ const h=RD.hist.pop(); if(h){ RD.pts=h; rdChanged(false); } };
  $('rdRev').onclick=()=>{ rdPush(); RD.pts.reverse(); rdChanged(false); };
  $('rdClr').onclick=()=>{ if(RD.pts.length && !confirm('Togliere tutti i punti e ridisegnare la rotta da capo?')) return; rdPush(); RD.pts=[]; rdChanged(false); };
  $('rdAv').onclick=()=>rdAvoidAll();
  $('rdAlt').onclick=()=>{ const mx=Math.max(0,...RD.info.map(l=>l.safeFt||0)); if(!mx){ rdHint('Quote del terreno non ancora pronte: riprova tra un attimo'); return; }
    const v=Math.max(mx,PLAN.cruiseFt); PLAN.cruiseFt=v; $('pAlt').value=v; rdHint(`Quota di crociera: ${v} ft (terreno più alto della rotta + ${RD.margin} ft)`); rdAnalyze(); };
  rdGestures(); addEventListener('resize',()=>{ if(RD.on) rdDraw(); });
}
function rdHint(t,ms){ const h=$('rdHint'); h.textContent=t; h.hidden=!t; clearTimeout(RD.hT); if(t) RD.hT=setTimeout(()=>{ h.hidden=true; },ms||3500); }
function rdOpen(){
  rdBuild();
  RD.pts=[PLAN.from,...PLAN.wps,PLAN.dest].map(byId).filter(Boolean).map(f=>({lat:f.lat,lon:f.lon,f}));
  RD.hist=[]; RD.root.hidden=false; RD.on=true;
  try{ parent.document.body.classList.add('ph-rdfull'); }catch(e){}
  requestAnimationFrame(()=>{ rdFit(); rdChanged(false); rdHint('Tocca per aggiungere un punto · trascina la linea per inserirne uno · trascina un punto su quello vicino per toglierlo',6000); });
}
function rdClose(save){
  if(save){ if(RD.pts.length<2){ rdHint('Servono almeno partenza e arrivo'); return; } rdSave(); }
  RD.on=false; RD.root.hidden=true; try{ parent.document.body.classList.remove('ph-rdfull'); }catch(e){}
}
function rdSave(){
  let n=0; const keep=new Set();
  const ids=RD.pts.map(p=>{
    if(p.f && p.f.rp && Math.abs(p.f.lat-p.lat)<1e-7 && Math.abs(p.f.lon-p.lon)<1e-7){ const id=p.f.id; keep.add(id);
      if(!RD_WPS.some(w=>w.id===id)) RD_WPS.push({id,name:p.f.short,lat:p.f.lat,lon:p.f.lon}); if(!byId(id)) FIELDS.push(rdWpField({id,name:p.f.short,lat:p.f.lat,lon:p.f.lon})); return id; }
    if(p.f && Math.abs(p.f.lat-p.lat)<1e-7 && Math.abs(p.f.lon-p.lon)<1e-7){ if(p.f.rdwp) keep.add(p.f.id); return p.f.id; }
    n++; const id='WP'+Date.now().toString(36).toUpperCase().slice(-5)+n, w={id,name:p.name||('P'+n),lat:+p.lat.toFixed(6),lon:+p.lon.toFixed(6)};
    RD_WPS.push(w); FIELDS.push(rdWpField(w)); keep.add(id); return id; });
  // punti liberi non più usati da nessuna rotta salvata: via
  const used=new Set([...keep]); try{ (ROUTES||[]).forEach(r=>r.wps.forEach(w=>used.add(w.id))); }catch(e){}
  RD_WPS=RD_WPS.filter(w=>used.has(w.id)).slice(-300); store.set('ia517_wps',RD_WPS);
  PLAN.from=ids[0]; PLAN.dest=ids[ids.length-1]; PLAN.wps=ids.slice(1,-1);
  renderRoute(); update(); toast('Rotta aggiornata: '+ids.length+' punti');
}
function rdPush(){ RD.hist.push(RD.pts.map(p=>Object.assign({},p))); if(RD.hist.length>40) RD.hist.shift(); }
function rdChanged(){ RD.sel=null; rdDraw(); clearTimeout(RD.aT); RD.aT=setTimeout(rdAnalyze,250); }

// ---------- tratte: prua, minuti, distanza, quota sicura, spazi attraversati ----------
// vento previsto (Open-Meteo sui campi della rotta) alla quota data: suolo, 925 hPa (~2500 ft), 850 hPa (~4800 ft), interpolato
function rdWindAt(lat,lon,ft){
  const wq=rdWxWind(lat,lon,ft); if(wq) return wq;
  let best=null, bd=1e12; try{ for(const m of Object.values(MODEL.data||{})){ if(m.lat==null) continue; const d=dist({lat,lon},m).d; if(d<bd){ bd=d; best=m; } } }catch(e){}
  if(!best || bd>80000) return null;
  const uv=w=>w&&w.kmh!=null&&w.dir!=null?[-w.kmh*Math.sin(w.dir*D2R),-w.kmh*Math.cos(w.dir*D2R)]:null;
  const L=[[0,uv({kmh:best.kmh,dir:best.dir})],[2500,uv(best.w925)],[4800,uv(best.w850)]].filter(x=>x[1]);
  if(!L.length) return null; ft=ft==null?PLAN.cruiseFt:ft;
  let u, v; if(ft<=L[0][0]){ [u,v]=L[0][1]; } else if(ft>=L[L.length-1][0]){ [u,v]=L[L.length-1][1]; }
  else for(let i=0;i<L.length-1;i++) if(ft>=L[i][0]&&ft<=L[i+1][0]){ const t=(ft-L[i][0])/(L[i+1][0]-L[i][0]); u=L[i][1][0]+(L[i+1][1][0]-L[i][1][0])*t; v=L[i][1][1]+(L[i+1][1][1]-L[i][1][1])*t; }
  return {kmh:Math.hypot(u,v), dir:wrap360(Math.atan2(-u,-v)*R2D)}; }
function rdGs(crs,w,tas){ if(!w) return {gs:tas,hdg:crs}; const wa=(w.dir-crs)*D2R, s=clamp(w.kmh*Math.sin(wa)/tas,-0.95,0.95), wca=Math.asin(s)*R2D;
  return {hdg:wrap360(crs+wca), gs:Math.max(20,tas*Math.cos(wca*D2R)-w.kmh*Math.cos(wa))}; }
function rdLeg(a,b,ft){
  const g=dist(a,b), tas=Math.max(40,PLAN.tas), w=rdWindAt((a.lat+b.lat)/2,(a.lon+b.lon)/2,ft), r=rdGs(g.brg,w,tas);
  return {d:g.d,crs:g.brg,hdg:r.hdg,gs:r.gs,min:g.d/1000/r.gs*60,wind:w};
}
// analisi di una tratta: terreno, zone, quota ideale; usata dall'editor e dal piano (profilo verticale)
function rdLegAnalyze(a,b,st){
  const asp=st.asp; let pending=false;
  {
    const L=rdLeg(a,b,PLAN.cruiseFt), n=Math.max(2,Math.ceil(L.d/250)), cl=Math.cos(a.lat*D2R);
    const ux=(b.lon-a.lon)*111320*cl/L.d||0, uy=(b.lat-a.lat)*110540/L.d||0;
    let maxM=-1e9, maxAt=null;
    for(let k=0;k<=n;k++){ const t=k/n, lat=a.lat+(b.lat-a.lat)*t, lon=a.lon+(b.lon-a.lon)*t;
      for(const off of [-500,0,500]){ const la=lat+(ux*off)/110540, lo=lon-(uy*off)/(111320*cl), z=rdDem(la,lo,10);
        if(z!==z){ pending=true; continue; } if(z>maxM){ maxM=z; maxAt={lat:la,lon:lo}; } } }
    const terrFt=maxM>-1e8?maxM/0.3048:null, safeFt=terrFt!=null?Math.ceil((terrFt+RD.margin)/100)*100:null;
    const lat0=Math.min(a.lat,b.lat), lat1=Math.max(a.lat,b.lat), lon0=Math.min(a.lon,b.lon), lon1=Math.max(a.lon,b.lon);
    const cand=asp.filter(x=>x.bb && !(x.bb[1]<lat0||x.bb[0]>lat1||x.bb[3]<lon0||x.bb[2]>lon1) && x.pts && x.pts.length>2);
    // tetto: base delle zone da evitare sotto cui si passa con il margine sul terreno (es. CTA da 2500 ft: si vola a 2400)
    let ceilFt=null, ceilName='';
    const samp=[]; for(let k=0;k<=n;k+=2){ const t=k/n, p={lat:a.lat+(b.lat-a.lat)*t, lon:a.lon+(b.lon-a.lon)*t}, zt=rdDem(p.lat,p.lon,10); samp.push({p,tf:zt===zt?zt/0.3048:0}); }
    for(const x of cand){ if(!rdAvoid(x)) continue;
      for(const sp of samp){ const bb=x.bb; if(sp.p.lat<bb[0]||sp.p.lat>bb[1]||sp.p.lon<bb[2]||sp.p.lon>bb[3]||!rdPip(sp.p,x.pts)) continue; const lo=rdLim(x.lo,sp.tf);
        if(lo-100>=sp.tf+RD.margin && (ceilFt==null || lo-100<ceilFt)){ ceilFt=Math.floor((lo-100)/100)*100; ceilName=`${x.cls} ${x.name}`; } } }
    // quota ideale: dentro la finestra [quota sicura sul terreno, base delle zone da evitare], quella con il vento migliore
    const cc=rdWxCloudCap((a.lat+b.lat)/2,(a.lon+b.lon)/2);              // nubi basse dal controllo meteo: si resta 500 ft sotto la base
    if(cc && (ceilFt==null || cc.capFt<ceilFt)){ ceilFt=cc.capFt; ceilName='nubi basse (base ~'+cc.baseFt+' ft)'; }
    const lo=safeFt||0, hiW=ceilFt!=null?ceilFt:12000; let altFt, why='';
    if(lo>hiW){ altFt=lo; why='terreno'; }                      // il terreno vince sempre sugli spazi aerei
    else { const cands=[...new Set([PLAN.cruiseFt,lo,hiW,2500,3500,4500,5500,6500].map(x=>Math.round(x/100)*100).filter(x=>x>=lo&&x<=hiW&&x>=1000))];
      if(!cands.length) cands.push(Math.max(lo,Math.min(PLAN.cruiseFt,hiW)));
      let best=null; for(const c of cands){ const r=rdLeg(a,b,c), sc=r.gs-Math.abs(c-PLAN.cruiseFt)/1000*1.5;   // a parità, vicino alla crociera
        if(!best||sc>best.sc) best={c,sc,gs:r.gs}; }
      altFt=best.c; const gs0=rdLeg(a,b,Math.max(lo,Math.min(PLAN.cruiseFt,hiW))).gs;
      why=altFt<PLAN.cruiseFt&&ceilFt!=null&&altFt>=ceilFt-50?'sotto':(best.gs-gs0>=4?'vento':''); }
    Object.assign(L,rdLeg(a,b,altFt));
    const hits=new Map();
    if(cand.length) for(const sp of samp){ for(const x of cand){ if(hits.has(x)) continue; const bb=x.bb; if(sp.p.lat<bb[0]||sp.p.lat>bb[1]||sp.p.lon<bb[2]||sp.p.lon>bb[3]||!rdPip(sp.p,x.pts)) continue;
        const lo=rdLim(x.lo,sp.tf), hi=rdLim(x.hi,sp.tf);
        if(altFt>=lo-50 && altFt<=hi+50){ let v={status:'warn',text:''}; try{ v=IA517_RULES.verdict(x); }catch(e){} hits.set(x,{a:x,v,avoid:rdAvoid(x)}); } } }
    for(const z of rdNoflyHit(a,b)) hits.set(z,{a:{cls:'NO',name:z.name},v:{status:'bad',text:'Punto da non sorvolare'},avoid:true});
    if(pending) st.pending=true;
    return Object.assign(L,{terrFt,safeFt,maxAt,altFt,why,ceilFt,ceilName,hits:[...hits.values()]});
  }
}
function rdAnalyze(){
  if(!RD.on) return;
  const st={asp:rdAspAll(),pending:false}, info=[];
  for(let i=0;i<RD.pts.length-1;i++) info.push(rdLegAnalyze(RD.pts[i],RD.pts[i+1],st));
  const pending=st.pending;
  RD.info=info; RD.vert=rdVert(RD.pts,info); RD.pending=pending; rdInfo(); rdDraw();
  if(pending){ clearTimeout(RD.aT); RD.aT=setTimeout(rdAnalyze,900); }
}
// ---------- profilo verticale: salite e discese possibili col velivolo, giri di 360° dove non bastano le tratte ----------
// Si parte dalla quota del campo di partenza, si arriva alla quota del circuito del campo d'arrivo. Una salita che il terreno
// chiede va finita prima del punto più alto della tratta. Peso: quello del piano (persone, bagaglio, carburante a bordo).
function rdFieldFt(p){ const f=p&&p.f; if(f&&f.elft!=null) return f.elft; const z=rdDem(p.lat,p.lon,11); return z===z?z/0.3048:null; }
function rdOrbitRoom(p,R,belowFt){ // giri possibili intorno al punto se il terreno nel cerchio (raggio + 200 m) resta sotto belowFt
  let mx=-1e9; const cl=Math.cos(p.lat*D2R);
  for(const r of [0,R*0.6,R+200]) for(let k=0;k<(r?12:1);k++){ const an=k*Math.PI/6, z=rdDem(p.lat+r*Math.cos(an)/110540,p.lon+r*Math.sin(an)/(111320*cl),11); if(z===z&&z>mx) mx=z; }
  return {ok:mx<=-1e8?true:mx/0.3048<belowFt, topFt:mx>-1e8?Math.round(mx/0.3048):null}; }
function rdVertHtml(V){ if(!V) return ''; const ls=V.legs.filter(v=>v.note);
  if(!ls.length) return `<div class="ok">Salite e discese stanno nelle tratte (peso stimato ${V.W} kg).</div>`;
  return ls.map(v=>`<div class="${v.ok?'warn':'bad'}">${v.arrive?'Arrivo':'T'+(v.i+1)}: ${v.dir==='su'?'salita':'discesa'} ${v.from}→${v.to} ft · ${esc(v.note)}${v.ok&&v.sec?` (+${fmtMin(v.sec/60)})`:''}</div>`).join('')+`<div class="sub">Peso stimato ${V.W} kg: rateo di salita calcolato con quota e peso.</div>`; }
function rdVert(pts,info){
  const P=window.IA517_PERF||(parent&&parent.IA517_PERF); if(!P||!info.length) return null;
  const a=ACP(), wb=PLAN.wb||{}, W=P.weight(a,{pil:wb.pil,pax:wb.pax,bag:wb.bag,fuelL:PLAN.fuel}), o={W,isa:0};
  const marg=600, dep=rdFieldFt(pts[0]), arr=rdFieldFt(pts[pts.length-1]), hc=+a.hcFt||1000;
  let h=dep!=null?dep:info[0].altFt; const out=[]; let extra=0;
  for(let i=0;i<info.length;i++){ const L=info[i], A=pts[i], gs=Math.max(15,(L.gs||PLAN.tas)/3.6), tgt=L.altFt, v={i,from:Math.round(h),to:tgt,turns:0,dir:'',note:'',ok:true};
    if(tgt>h+50){ // salita
      const need=P.climbDist(a,h,tgt,gs,o), terr=L.why==='terreno'||(L.safeFt&&L.safeFt>=tgt-100);
      const avail=terr&&L.maxAt?Math.max(0,dist(A,L.maxAt).d-300):L.d;
      v.need=need; v.avail=avail; v.dir='su';
      if(need>avail){ const hReach=P.climbIn(a,h,avail,gs,o), orb=P.orbit(a,(h+tgt)/2,o);
        if(!isFinite(need)||P.roc(a,tgt,o)<50){ v.ok=false; v.note=`il velivolo non arriva a ${tgt} ft (quota massima del profilo ${a.ceil||'?'} ft)`; }
        else { v.turns=Math.ceil((tgt-hReach)/Math.max(30,orb.up)); v.sec=v.turns*orb.sec; v.R=orb.R;
          const room=rdOrbitRoom(A,orb.R,i===0?h+500:h-marg);   // sul campo di partenza la spirale comincia a ~500 ft dal suolo
          if(!room.ok){ v.ok=false; v.note=`servirebbero ${v.turns} giri di 360° su ${A.f?A.f.short:('punto '+(i+1))}, ma il terreno intorno (${room.topFt} ft) non lascia spazio: cambia percorso o parti più in alto`; }
          else { extra+=v.sec; v.note=`${v.turns} ${v.turns===1?'giro':'giri'} di 360° in salita su ${A.f?A.f.short:('punto '+(i+1))} (raggio ${Math.round(orb.R)} m, ${Math.round(orb.up)} ft a giro)`; } } }
      h=tgt; }
    else if(tgt<h-50){ // discesa
      const need=P.descDist(a,h,tgt,gs), avail=L.d; v.dir='giù'; v.need=need; v.avail=avail;
      if(need>avail){ const orb=P.orbit(a,(h+tgt)/2,o), lost=avail/gs*P.rod(a)/60; v.turns=Math.ceil((h-tgt-lost)/Math.max(30,orb.down)); v.sec=v.turns*orb.sec; extra+=v.sec;
        const room=rdOrbitRoom(A,orb.R,tgt-marg); if(!room.ok){ v.ok=false; v.note=`discesa troppo ripida e il terreno non lascia girare: allunga la tratta`; }
        else v.note=`${v.turns} ${v.turns===1?'giro':'giri'} di 360° in discesa su ${A.f?A.f.short:('punto '+(i+1))}`; }
      h=tgt; }
    out.push(v); }
  // arrivo: dalla quota dell'ultima tratta al circuito del campo
  if(arr!=null){ const L=info[info.length-1], B=pts[pts.length-1], gs=Math.max(15,(L.gs||PLAN.tas)/3.6), circ=Math.round((arr+hc)/50)*50;
    if(h>circ+100){ const need=P.descDist(a,h,circ,gs);
      if(need>L.d){ const orb=P.orbit(a,(h+circ)/2,o), lost=L.d/gs*P.rod(a)/60, turns=Math.ceil((h-circ-lost)/Math.max(30,orb.down));
        const room=rdOrbitRoom(B,orb.R,circ-200); extra+=turns*orb.sec;
        out.push({i:info.length,arrive:true,from:Math.round(h),to:circ,turns,dir:'giù',sec:turns*orb.sec,ok:room.ok,note:room.ok?`${turns} ${turns===1?'giro':'giri'} di 360° in discesa sopra ${B.f?B.f.short:'l\'arrivo'} fino al circuito (${circ} ft)`:`arrivi troppo alto e il terreno intorno al campo non lascia girare: comincia a scendere prima`}); } } }
  return {legs:out,extraMin:extra/60,W:Math.round(W),ok:out.every(v=>v.ok)};
}
function rdInfo(){
  const box=$('rdInfo'); if(!box) return;
  if(RD.pts.length<2){ const tt=RD.root&&RD.root.querySelector('.rdt b'); if(tt) tt.textContent='Disegna la rotta'; box.innerHTML=RD.pts.length?'Tocca la mappa per il punto successivo.':'Tocca la mappa sul campo di partenza: i punti vicini a un campo si agganciano al campo.'; return; }
  const km=RD.info.reduce((s,l)=>s+l.d,0)/1000, min=RD.info.reduce((s,l)=>s+l.min,0), mx=Math.max(0,...RD.info.map(l=>l.safeFt||0));
  const tt=RD.root&&RD.root.querySelector('.rdt b'); if(tt) tt.textContent=`${km.toFixed(km<10?1:0).replace('.',',')} km · ${fmtMin(min)}`;
  const av=new Map(), ot=new Map(); RD.info.forEach((l,i)=>l.hits.forEach(h=>{ if(h.a.cls==='FMC') return; const m=h.avoid?av:ot, k=`${h.a.cls} ${String(h.a.name).slice(0,30)}`; if(!m.has(k)) m.set(k,[]); m.get(k).push(i+1); }));
  const lst=m=>[...m].map(([k,ts])=>`${esc(k)} (T${[...new Set(ts)].join(',')})`), avoid=lst(av), other=lst(ot);
  const under=RD.info.map((l,i)=>l.why==='sotto'?`T${i+1} a ${l.altFt} ft sotto ${esc(l.ceilName)}`:(l.why==='terreno'?`T${i+1} sali a ${l.altFt} ft per il terreno`:null)).filter(Boolean);
  const wind=RD.info.some(l=>l.wind);
  box.innerHTML=`<div><b>${km.toFixed(0)} km · ${fmtMin(min)}</b> a ${PLAN.tas} km/h${wind?' con il vento previsto':' senza vento'} · crociera ${PLAN.cruiseFt} ft · `+
    `margine sul terreno <select id="rdMg">${[500,1000,1500,2000].map(v=>`<option value="${v}"${v===RD.margin?' selected':''}>${v} ft</option>`).join('')}</select></div>`+
    (RD.pending?'<div class="warn">Scarico le quote del terreno…</div>':(mx>PLAN.cruiseFt?`<div class="bad">Quota sicura sulla rotta: ${mx} ft, più alta della crociera. Tocca «Quota sicura» per alzarla.</div>`:(mx?`<div class="ok">Terreno: la crociera di ${PLAN.cruiseFt} ft lascia almeno ${RD.margin} ft (quota sicura ${mx} ft).</div>`:'')))+
    (under.length?`<div class="warn">Quote: ${under.join(' · ')}</div>`:'')+
    rdVertHtml(RD.vert)+
    (avoid.length?`<div class="bad">Dentro zone da evitare: ${avoid.join(' · ')}. Tocca «Evita zone».</div>`:'')+
    (other.length?`<div class="warn">Attraversi: ${other.join(' · ')}</div>`:'')+
    (rdAspAll().length?'':'<div class="warn">Spazi aerei non caricati: Briefing › Scarica gli spazi aerei d\'Italia.</div>')+
    (RD.msg?`<div>${esc(RD.msg)}</div>`:'')+
    `<div style="margin-top:6px"><button type="button" id="rdWx" style="min-height:38px;width:auto;padding:0 12px">${RD.wxBusy?'Scarico il meteo…':'☁ Controllo meteo alle quote'}</button> ${RD.wx?wxStamp(RD.wx.t,'Meteo della rotta'):''}</div>`+
    (RD.wxRep?rdWxHtml(RD.wxRep):'');
  const wb=$('rdWx'); if(wb) wb.onclick=()=>rdWxCheck();
  const mg=$('rdMg'); if(mg) mg.onchange=()=>{ RD.margin=+mg.value; store.set('ia517_rd_margin',RD.margin); rdAnalyze(); };
}

// ---------- disegno ----------
RD.tiles=new Map();
function rdTiles(c){
  let P0=null; try{ P0=parent.PH; }catch(e){}
  if(!P0 || !P0.tileUrl) return;
  let def=null; try{ def=P0.base==='dem'?P0.BASES.topo:P0.baseDef(); if(def&&def.key&&!P0.esriKey) def=P0.BASES.topo; }catch(e){ return; }
  const cl=Math.cos(RD.clat*D2R), mppEq=RD.mpp/cl;
  let z=Math.round(Math.log2(156543.03/mppEq)); z=clamp(z,Math.max(4,def.min||4),def.max||16);
  const n=2**z, lat2y=la=>{ const r=la*D2R; return (1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*n; };
  const tl=rdLL(0,0), br=rdLL(rdW(),rdH());
  const x0=Math.floor((tl.lon+180)/360*n), x1=Math.floor((br.lon+180)/360*n), y0=Math.floor(lat2y(tl.lat)), y1=Math.floor(lat2y(br.lat));
  if((x1-x0+1)*(y1-y0+1)>80) return;
  const tLat=y=>Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*R2D, tLon=x=>x/n*360-180;
  for(let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++){
    const key=(def.name||'')+z+'/'+x+'/'+y; let T=RD.tiles.get(key);
    if(!T){ T={img:new Image(),ok:false}; T.img.onload=()=>{ T.ok=true; if(RD.on) rdDrawSoon(); }; T.img.src=P0.tileUrl(z,x,y,def); RD.tiles.set(key,T);
      if(RD.tiles.size>300) RD.tiles.delete(RD.tiles.keys().next().value); }
    if(!T.ok) continue;
    const a=rdP(tLat(y),tLon(x)), b=rdP(tLat(y+1),tLon(x+1)); c.drawImage(T.img,a.x,a.y,b.x-a.x+0.5,b.y-a.y+0.5);
  }
}
function rdDrawSoon(){ if(RD.dsT) return; RD.dsT=requestAnimationFrame(()=>{ RD.dsT=0; rdDraw(); }); }
function rdDraw(){
  if(!RD.on) return;
  const cv=RD.cv, dpr=devicePixelRatio||1, W=rdW(), H=rdH();
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){ cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); }
  const c=RD.ctx; c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,W,H); c.fillStyle='#0a1410'; c.fillRect(0,0,W,H);
  rdTiles(c); c.fillStyle='rgba(4,8,12,.28)'; c.fillRect(0,0,W,H);
  const tl=rdLL(0,0), br=rdLL(W,H);
  // spazi aerei
  const asp=rdAspAll();
  for(const a of asp){ const bb=a.bb; if(!bb||!a.pts||a.pts.length<3||bb[1]<br.lat||bb[0]>tl.lat||bb[3]<tl.lon||bb[2]>br.lon) continue;
    const av=rdAvoid(a), ctl=/^(A|B|C|D|E|CTR|CTA|TMA)$/.test(a.cls)||/ATZ/i.test(a.name);
    if(!av && !ctl && RD.mpp>250) continue;
    c.beginPath(); a.pts.forEach((p,i)=>{ const q=rdP(p.lat,p.lon); i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y); }); c.closePath();
    const sfc=!a.lo||!a.lo.ft;                                     // dal suolo: piena; con una base sopra il suolo: leggera e tratteggiata
    c.fillStyle=av?(sfc?'rgba(255,60,60,.2)':'rgba(255,60,60,.05)'):(ctl?'rgba(80,150,255,.06)':'rgba(255,176,32,.05)'); c.fill();
    c.strokeStyle=av?'rgba(255,80,80,.9)':(ctl?'rgba(110,170,255,.75)':'rgba(255,176,32,.6)'); c.lineWidth=av&&sfc?2:1.2; c.setLineDash(av&&sfc?[]:[6,4]); c.stroke(); c.setLineDash([]);
    if(RD.mpp<120){ const q=rdP((bb[0]+bb[1])/2,(bb[2]+bb[3])/2); if(q.x>0&&q.x<W&&q.y>0&&q.y<H){ c.font='600 10px system-ui'; c.textAlign='center'; c.fillStyle=av?'#ff8a8a':'#9cc4ff';
      c.fillText(`${a.cls} ${String(a.name).slice(0,22)}`,q.x,q.y); c.fillText(`${a.lo&&a.lo.txt||''}–${a.hi&&a.hi.txt||''}`,q.x,q.y+12); } }
  }
  // campi
  c.textAlign='left'; c.textBaseline='middle';
  for(const f of FIELDS){ if(f.kind==='wp') continue; if(f.lat<br.lat||f.lat>tl.lat||f.lon<tl.lon||f.lon>br.lon) continue; const q=rdP(f.lat,f.lon);
    c.fillStyle=f.kind==='aero'?'#7fd0ff':'#e8f6ee'; c.strokeStyle='#000'; c.lineWidth=1.2; c.beginPath(); c.arc(q.x,q.y,f.kind==='aero'?5:4,0,7); c.fill(); c.stroke();
    if(RD.mpp<90 || (RD.mpp<220 && f.kind==='aero')){ c.font='700 11px system-ui'; c.lineWidth=3; c.strokeStyle='rgba(0,0,0,.75)'; c.strokeText(f.short,q.x+7,q.y-6); c.fillStyle='#e8f6ee'; c.fillText(f.short,q.x+7,q.y-6); } }
  for(const z of RD_NOFLY){ const q=rdP(z.lat,z.lon), r=z.r/RD.mpp; if(q.x<-r||q.x>W+r||q.y<-r||q.y>H+r) continue;
    c.fillStyle='rgba(255,60,60,.22)'; c.strokeStyle='#ff5a5a'; c.lineWidth=2; c.beginPath(); c.arc(q.x,q.y,Math.max(r,6),0,7); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(q.x-Math.max(r,6)*0.7,q.y-Math.max(r,6)*0.7); c.lineTo(q.x+Math.max(r,6)*0.7,q.y+Math.max(r,6)*0.7); c.stroke();
    c.font='700 11px system-ui'; c.textAlign='center'; c.lineWidth=3; c.strokeStyle='rgba(0,0,0,.8)'; c.strokeText(z.name,q.x,q.y-Math.max(r,6)-6); c.fillStyle='#ff9a9a'; c.fillText(z.name,q.x,q.y-Math.max(r,6)-6); }
  if(RD.mpp<400) for(const r of RD_RPP){ if(r.lat<br.lat||r.lat>tl.lat||r.lon<tl.lon||r.lon>br.lon) continue; const q=rdP(r.lat,r.lon), z=8;
    c.beginPath(); c.arc(q.x,q.y,z,0,7); c.fillStyle='#fff'; c.fill(); c.strokeStyle='#5b3bb5'; c.lineWidth=2; c.stroke();
    c.font='800 10px system-ui'; c.textAlign='center'; c.textBaseline='middle'; c.fillStyle='#5b3bb5'; c.fillText('V',q.x,q.y+0.5);
    if(RD.mpp<130){ c.font='700 12px system-ui'; c.textAlign='left'; c.lineWidth=3.5; c.strokeStyle='rgba(255,255,255,.9)'; c.strokeText(r.label,q.x+11,q.y); c.fillStyle='#7a2fbf'; c.fillText(r.label,q.x+11,q.y); } }
  // tratte
  const P=RD.pts.map(p=>rdP(p.lat,p.lon));
  c.lineCap='round'; c.lineJoin='round';
  for(let i=0;i<P.length-1;i++){ const l=RD.info[i], bad=l&&l.hits.some(h=>h.avoid);
    c.strokeStyle='rgba(30,0,28,.85)'; c.lineWidth=8; c.beginPath(); c.moveTo(P[i].x,P[i].y); c.lineTo(P[i+1].x,P[i+1].y); c.stroke();
    c.strokeStyle=bad?'#ff5a5a':'#ff46e0'; c.lineWidth=RD.sel===i?7:5; c.setLineDash(bad?[10,6]:[]); c.beginPath(); c.moveTo(P[i].x,P[i].y); c.lineTo(P[i+1].x,P[i+1].y); c.stroke(); c.setLineDash([]);
    const dx=P[i+1].x-P[i].x, dy=P[i+1].y-P[i].y, len=Math.hypot(dx,dy), ux=dx/len, uy=dy/len;      // frecce del verso di volo
    if(len>90) for(let t=0.25;t<1;t+=len>300?0.25:0.5){ if(Math.abs(t-0.5)<0.01) continue; const cx=P[i].x+dx*t, cy=P[i].y+dy*t;
      c.strokeStyle='#5a0a50'; c.lineWidth=2.5; c.beginPath(); c.moveTo(cx-ux*6-uy*7,cy-uy*6+ux*7); c.lineTo(cx,cy); c.lineTo(cx-ux*6+uy*7,cy-uy*6-ux*7); c.stroke(); } }
  // etichette lungo le tratte: «8,6 km; 4 min; 349°»; toccando la tratta si aggiunge la riga della quota
  const nf=(v,d)=>v.toFixed(d).replace('.',',');
  for(let i=0;i<P.length-1;i++){ const l=RD.info[i]; if(!l) continue; const a=P[i], b=P[i+1], len=Math.hypot(b.x-a.x,b.y-a.y), sel=RD.sel===i;
    const t1=`${nf(l.d/1000,l.d<10000?1:0)} km; ${Math.max(1,Math.round(l.min))} min; ${String(Math.round(l.hdg)).padStart(3,'0')}°`;
    const up=l.why==='terreno', t2=sel?(up?`SALI a ${l.altFt} ft (terreno)`:(l.why==='sotto'?`${l.altFt} ft sotto ${String(l.ceilName).split(' ').slice(0,3).join(' ')}`:(l.why==='vento'?`${l.altFt} ft · vento migliore`:`${l.altFt} ft`+(l.safeFt?` · sicura ${l.safeFt}`:'')))):'';
    c.font=(sel?'700 14px':'700 12px')+' system-ui'; const w=Math.max(c.measureText(t1).width,t2?c.measureText(t2).width:0)+12, h=t2?36:(sel?22:19);
    if(len<w+30 && !sel) continue;
    let ang=Math.atan2(b.y-a.y,b.x-a.x); if(ang>Math.PI/2) ang-=Math.PI; else if(ang<-Math.PI/2) ang+=Math.PI;
    c.save(); c.translate((a.x+b.x)/2,(a.y+b.y)/2); c.rotate(ang);
    c.fillStyle='rgba(255,255,255,.95)'; c.strokeStyle=up?'#d4141b':'#222'; c.lineWidth=sel?2:1.2; c.beginPath(); c.roundRect?c.roundRect(-w/2,-h/2,w,h,h/2>12?8:h/2):c.rect(-w/2,-h/2,w,h); c.fill(); c.stroke();
    c.textAlign='center'; c.textBaseline='middle'; c.fillStyle='#111'; c.fillText(t1,0,t2?-8:0.5);
    if(t2){ c.font='700 12px system-ui'; c.fillStyle=up?'#c00':(l.why==='sotto'?'#8a5a00':'#0a6b35'); c.fillText(t2,0,9); }
    c.restore(); }
  c.textBaseline='middle';
  // punti
  P.forEach((q,i)=>{ const p=RD.pts[i], fld=p.f&&p.f.kind!=='wp'&&Math.abs(p.f.lat-p.lat)<1e-7, drag=RD.g&&RD.g.idx===i, merge=drag&&RD.g.merge!=null;
    c.fillStyle=merge?'#ff5a5a':(i===0?'#5bd38a':(i===P.length-1?'#ff46e0':'#fff')); c.strokeStyle='#000'; c.lineWidth=2;
    c.beginPath(); c.arc(q.x,q.y,drag?11:8,0,7); c.fill(); c.stroke();
    const nm=(i===0?'PARTENZA ':i===P.length-1?'ARRIVO ':'')+(fld?p.f.short:(p.name||'P'+i));
    c.font='700 12px system-ui'; c.textAlign='left'; c.lineWidth=3; c.strokeStyle='rgba(0,0,0,.8)'; c.strokeText(nm,q.x+12,q.y+12); c.fillStyle='#fff'; c.fillText(nm,q.x+12,q.y+12); });
  if(RD.g&&RD.g.snap){ const q=rdP(RD.g.snap.lat,RD.g.snap.lon); c.strokeStyle='#5bd38a'; c.lineWidth=3; c.beginPath(); c.arc(q.x,q.y,16,0,7); c.stroke(); }
  // scala
  const sk=[1,2,5,10,20,50,100,200], kmPx=1000/RD.mpp; let s=sk[0]; for(const v of sk) if(v*kmPx<W*0.3) s=v;
  c.strokeStyle='#fff'; c.lineWidth=2; c.beginPath(); c.moveTo(12,H-14); c.lineTo(12+s*kmPx,H-14); c.stroke(); c.font='700 11px system-ui'; c.textAlign='left'; c.fillStyle='#fff'; c.fillText(s+' km',14,H-24);
  if(RD.busy){ c.fillStyle='rgba(7,10,15,.8)'; c.fillRect(W/2-120,H/2-20,240,40); c.fillStyle='#fff'; c.textAlign='center'; c.font='700 13px system-ui'; c.fillText(RD.busy,W/2,H/2); }
}

// ---------- gesti ----------
function rdNearField(x,y){ let best=null, bd=RD_HIT; for(const f of [...FIELDS,...RD_RPP]){ if(f.kind==='wp') continue; const q=rdP(f.lat,f.lon), d=Math.hypot(q.x-x,q.y-y)+(f.rp?4:0); if(d<bd){ bd=d; best=f; } } return best; }
function rdNearPt(x,y){ let best=-1, bd=RD_HIT; RD.pts.forEach((p,i)=>{ const q=rdP(p.lat,p.lon), d=Math.hypot(q.x-x,q.y-y); if(d<bd){ bd=d; best=i; } }); return best; }
function rdNearLeg(x,y){ for(let i=0;i<RD.pts.length-1;i++){ const a=rdP(RD.pts[i].lat,RD.pts[i].lon), b=rdP(RD.pts[i+1].lat,RD.pts[i+1].lon);
    const dx=b.x-a.x, dy=b.y-a.y, L2=dx*dx+dy*dy; if(L2<1) continue; const t=((x-a.x)*dx+(y-a.y)*dy)/L2; if(t<0.08||t>0.92) continue;
    if(Math.hypot(a.x+t*dx-x,a.y+t*dy-y)<18) return i; } return -1; }
function rdGestures(){
  const cv=RD.cv, pts=new Map(); let pin=null;
  const xy=e=>{ const r=cv.getBoundingClientRect(); return [e.clientX-r.left,e.clientY-r.top]; };
  cv.addEventListener('pointerdown',e=>{ cv.setPointerCapture(e.pointerId); const [x,y]=xy(e); pts.set(e.pointerId,[x,y]);
    if(pts.size===2){ const [a,b]=[...pts.values()]; pin={d:Math.hypot(a[0]-b[0],a[1]-b[1])||1,mpp:RD.mpp,c:rdLL((a[0]+b[0])/2,(a[1]+b[1])/2)}; if(RD.g&&RD.g.idx!=null&&RD.g.moved&&RD.g.before){ RD.pts=RD.g.before; } RD.g=null; rdDraw(); return; }
    const i=rdNearPt(x,y);
    if(i>=0){ RD.g={kind:'pt',idx:i,x,y,moved:false,before:RD.pts.map(p=>Object.assign({},p))}; return; }
    const l=rdNearLeg(x,y);
    if(l>=0){ RD.g={kind:'leg',leg:l,x,y,moved:false,before:RD.pts.map(p=>Object.assign({},p))}; return; }
    RD.g={kind:'pan',x,y,lx:x,ly:y,moved:false};
    RD.g.lt=setTimeout(()=>{ const g=RD.g; if(g&&g.kind==='pan'&&!g.moved&&pts.size===1){ g.long=true; rdMenu(x,y); } },650); });
  cv.addEventListener('pointermove',e=>{ if(!pts.has(e.pointerId)) return; const [x,y]=xy(e); pts.set(e.pointerId,[x,y]);
    if(pin && pts.size>=2){ const [a,b]=[...pts.values()], d=Math.hypot(a[0]-b[0],a[1]-b[1]); RD.mpp=clamp(pin.mpp*pin.d/d,8,4000);
      const m=[(a[0]+b[0])/2,(a[1]+b[1])/2], now=rdLL(m[0],m[1]); RD.clat+=pin.c.lat-now.lat; RD.clon+=pin.c.lon-now.lon; rdDrawSoon(); return; }
    const g=RD.g; if(!g) return;
    if(Math.hypot(x-g.x,y-g.y)>8) g.moved=true;
    if(g.kind==='pan'){ if(!g.moved) return; const a=rdLL(g.lx,g.ly), b=rdLL(x,y); RD.clat+=a.lat-b.lat; RD.clon+=a.lon-b.lon; g.lx=x; g.ly=y; rdDrawSoon(); return; }
    if(g.kind==='leg'){ if(!g.moved) return; const ll=rdLL(g.x,g.y); RD.pts.splice(g.leg+1,0,{lat:ll.lat,lon:ll.lon,f:null}); g.kind='pt'; g.idx=g.leg+1; g.ins=true; RD.sel=null; }
    if(!g.moved) return;
    const ll=rdLL(x,y), p=RD.pts[g.idx]; p.lat=ll.lat; p.lon=ll.lon; p.f=null; p.name=null;
    // trascinato sul punto vicino: al rilascio si toglie
    g.merge=null; for(const j of [g.idx-1,g.idx+1]){ if(j<0||j>=RD.pts.length) continue; const q=rdP(RD.pts[j].lat,RD.pts[j].lon); if(Math.hypot(q.x-x,q.y-y)<RD_HIT){ g.merge=j; break; } }
    g.snap=g.merge==null?rdNearField(x,y):null; rdHint(g.merge!=null?'Rilascia per togliere il punto':(g.snap?'Si aggancia a '+g.snap.short:''),1200); rdDrawSoon(); });
  const up=e=>{ pts.delete(e.pointerId); if(pts.size<2) pin=null; const g=RD.g; RD.g=null; if(!g) return;
    clearTimeout(g.lt); if(g.long) return;
    if(g.kind==='leg'){ RD.sel=RD.sel===g.leg?null:g.leg; const l=RD.info[g.leg];                       // tocco sulla tratta: etichetta con la quota
      if(l && RD.sel!=null) rdHint(`Tratta ${g.leg+1}: rotta ${String(Math.round(l.crs)).padStart(3,'0')}°, prua ${String(Math.round(l.hdg)).padStart(3,'0')}°`+(l.wind?` (vento ${windDir(l.wind.dir)} ${Math.round(l.wind.kmh)} km/h, GS ${Math.round(l.gs)})`:' (senza vento)')+(l.terrFt!=null?` · terreno max ${Math.round(l.terrFt)} ft`:''),5000);
      rdDraw(); return; }
    if(g.kind==='pan'){ if(!g.moved && pts.size===0){ const [x,y]=xy(e), f=rdNearField(x,y); rdPush(); const ll=rdLL(x,y);
        RD.pts.push(f?{lat:f.lat,lon:f.lon,f}:{lat:ll.lat,lon:ll.lon,f:null}); rdChanged(); } return; }
    if(!g.moved){ rdHint((()=>{ const l=RD.info[g.idx]||RD.info[g.idx-1]; const p=RD.pts[g.idx]; return (p.f?p.f.name:'Punto '+g.idx)+(l&&l.terrFt!=null?` · terreno max tratta ${Math.round(l.terrFt)} ft`:''); })()); rdDraw(); return; }
    RD.hist.push(g.before); if(RD.hist.length>40) RD.hist.shift();
    if(g.merge!=null){ RD.pts.splice(g.idx,1); rdHint('Punto tolto'); }
    else if(g.snap){ const p=RD.pts[g.idx]; p.lat=g.snap.lat; p.lon=g.snap.lon; p.f=g.snap; }
    rdChanged(); };
  cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',up);
  cv.addEventListener('wheel',e=>{ e.preventDefault(); const [x,y]=xy(e), c0=rdLL(x,y); RD.mpp=clamp(RD.mpp*(e.deltaY>0?1.25:0.8),8,4000); const c1=rdLL(x,y); RD.clat+=c0.lat-c1.lat; RD.clon+=c0.lon-c1.lon; rdDrawSoon(); },{passive:false});
}

// controllo rapido di una tratta: quota sicura (terreno ±500 m + margine) e numero di zone da evitare attraversate a quella quota
function rdLegCheck(a,b){
  const d=dist(a,b).d, n=Math.max(2,Math.ceil(d/300)), cl=Math.cos(a.lat*D2R), ux=(b.lon-a.lon)*111320*cl/(d||1), uy=(b.lat-a.lat)*110540/(d||1);
  let mx=-1e9; const smp=[];
  for(let k=0;k<=n;k++){ const t=k/n, lat=a.lat+(b.lat-a.lat)*t, lon=a.lon+(b.lon-a.lon)*t; let zc=NaN;
    for(const off of [-500,0,500]){ const z=rdDem(lat+(ux*off)/110540, lon-(uy*off)/(111320*cl), 10); if(z===z){ if(z>mx) mx=z; if(!off) zc=z; } }
    smp.push({p:{lat,lon},tf:zc===zc?zc/0.3048:0}); }
  const safe=mx>-1e8?Math.ceil((mx/0.3048+RD.margin)/100)*100:0;
  const lat0=Math.min(a.lat,b.lat), lat1=Math.max(a.lat,b.lat), lon0=Math.min(a.lon,b.lon), lon1=Math.max(a.lon,b.lon);
  const cand=rdAspAll().filter(x=>rdAvoid(x)&&x.bb&&!(x.bb[1]<lat0||x.bb[0]>lat1||x.bb[3]<lon0||x.bb[2]>lon1));
  let ceil=Infinity; for(const x of cand) for(const q of smp){ const bb=x.bb; if(q.p.lat<bb[0]||q.p.lat>bb[1]||q.p.lon<bb[2]||q.p.lon>bb[3]||!rdPip(q.p,x.pts)) continue; const lo=rdLim(x.lo,q.tf); if(lo-100>=q.tf+RD.margin && lo-100<ceil) ceil=lo-100; }
  const alt=Math.max(safe,Math.min(PLAN.cruiseFt,ceil));                 // la stessa quota che sceglie l'analisi della tratta
  const zones=new Set(rdNoflyHit(a,b).map(z=>'NO '+z.name));
  for(const x of cand) for(const q of smp){ const bb=x.bb; if(q.p.lat<bb[0]||q.p.lat>bb[1]||q.p.lon<bb[2]||q.p.lon>bb[3]||!rdPip(q.p,x.pts)) continue; const lo=rdLim(x.lo,q.tf), hi=rdLim(x.hi,q.tf); if(alt>=lo-50&&alt<=hi+50){ zones.add(x.cls+' '+x.name); break; } }
  return {safe,alt,avoid:zones.size,zones};
}
// tieni premuto sulla mappa: punto da non sorvolare, punto di rotta qui, oppure togli un punto da non sorvolare
function rdMenu(x,y){
  const ll=rdLL(x,y), near=RD_NOFLY.find(z=>{ const q=rdP(z.lat,z.lon); return Math.hypot(q.x-x,q.y-y)<Math.max(RD_HIT,z.r/RD.mpp); });
  let m=$('rdMenu'); if(!m){ m=document.createElement('div'); m.id='rdMenu'; m.style.cssText='position:absolute;z-index:60;background:#0d1115;border:1px solid #3a4250;border-radius:12px;padding:6px;display:flex;flex-direction:column;gap:6px;min-width:220px;box-shadow:0 6px 24px rgba(0,0,0,.5)'; RD.root.appendChild(m); }
  const top=RD.cv.getBoundingClientRect().top;
  m.style.left=Math.min(Math.max(8,x-110),innerWidth-236)+'px'; m.style.top=Math.min(top+y+10,innerHeight-220)+'px';
  m.innerHTML=(near?`<button type="button" data-a="del">Togli «${esc(near.name)}»</button>`:
    `<button type="button" data-a="nf1">Da non sorvolare · raggio 1 km</button><button type="button" data-a="nf2">Da non sorvolare · raggio 2 km</button>`)+
    `<button type="button" data-a="wp">Punto di rotta qui (in fondo)</button><button type="button" data-a="x">Annulla</button>`;
  m.hidden=false;
  m.querySelectorAll('button').forEach(b=>b.onclick=()=>{ const a=b.dataset.a; m.hidden=true;
    if(a==='del'){ RD_NOFLY=RD_NOFLY.filter(z=>z!==near); store.set('ia517_nofly',RD_NOFLY); rdChanged(); }
    else if(a==='nf1'||a==='nf2'){ const nm=(prompt('Nome del punto da non sorvolare (paese, casa, impianto…)','NO SORVOLO '+(RD_NOFLY.length+1))||'').trim(); if(!nm) return;
      RD_NOFLY.push({lat:+ll.lat.toFixed(5),lon:+ll.lon.toFixed(5),r:a==='nf1'?1000:2000,name:nm.toUpperCase().slice(0,24)}); store.set('ia517_nofly',RD_NOFLY); rdChanged(); rdHint('Tocca «Calcola rotta» per girarci intorno'); }
    else if(a==='wp'){ rdPush(); RD.pts.push({lat:ll.lat,lon:ll.lon,f:null}); rdChanged(); } });
}
// ---------- rotta intorno alle zone da evitare, passando dove il terreno lascia il margine ----------
function rdHeap(){ const a=[]; return {push(n,f){ a.push([f,n]); let i=a.length-1; while(i>0){ const p=(i-1)>>1; if(a[p][0]<=a[i][0]) break; [a[p],a[i]]=[a[i],a[p]]; i=p; } },
  pop(){ const top=a[0], last=a.pop(); if(a.length){ a[0]=last; let i=0; for(;;){ const l=2*i+1, r=l+1; let m=i; if(l<a.length&&a[l][0]<a[m][0]) m=l; if(r<a.length&&a[r][0]<a[m][0]) m=r; if(m===i) break; [a[m],a[i]]=[a[i],a[m]]; i=m; } } return top&&top[1]; }, get size(){ return a.length; } }; }
async function rdAround(A,B){
  const cruise=PLAN.cruiseFt, margin=RD.margin;
  const pad=0.5, lat0=Math.min(A.lat,B.lat)-pad, lat1=Math.max(A.lat,B.lat)+pad, cl=Math.cos((lat0+lat1)/2*D2R), lon0=Math.min(A.lon,B.lon)-pad/cl, lon1=Math.max(A.lon,B.lon)+pad/cl;
  const spanE=(lon1-lon0)*111320*cl, spanN=(lat1-lat0)*110540; let cell=1000; while(spanE/cell*spanN/cell>60000) cell*=1.25;
  const nx=Math.ceil(spanE/cell), ny=Math.ceil(spanN/cell), N=nx*ny;
  const LL=(i,j)=>({lat:lat0+(j+0.5)*cell/110540, lon:lon0+(i+0.5)*cell/(111320*cl)});
  const IJ=p=>[clamp(Math.floor((p.lon-lon0)*111320*cl/cell),0,nx-1), clamp(Math.floor((p.lat-lat0)*110540/cell),0,ny-1)];
  // terreno: per ogni cella il punto più alto (centro e 4 punti a ±330 m): il margine vale sotto l'aereo, così le valli strette restano percorribili
  const terr=new Float32Array(N), off=[[0,0],[-1,-1],[1,-1],[-1,1],[1,1]];
  for(let tr=0;tr<16;tr++){ let miss=0;
    for(let j=0;j<ny;j++) for(let i=0;i<nx;i++){ let m=-1e9; for(const [u,v] of off){ const z=rdDem(lat0+(j+0.5+v*0.33)*cell/110540, lon0+(i+0.5+u*0.33)*cell/(111320*cl), 10); if(z!==z){ miss++; continue; } if(z>m) m=z; }
      terr[j*nx+i]=m>-1e8?m/0.3048:0; }
    if(!miss) break; RD.busy='Scarico il terreno… '+Math.round(100*(1-miss/(N*5)))+'%'; rdDraw(); await new Promise(r=>setTimeout(r,600)); }
  const tmax=new Float32Array(N);
  for(let j=0;j<ny;j++) for(let i=0;i<nx;i++){ let m=-1e9; for(let dj=-1;dj<=1;dj++) for(let di=-1;di<=1;di++){ const ii=i+di, jj=j+dj; if(ii>=0&&jj>=0&&ii<nx&&jj<ny&&terr[jj*nx+ii]>m) m=terr[jj*nx+ii]; } tmax[j*nx+i]=m; }
  // celle vietate: dentro una zona da evitare dove non ci si passa sotto con il margine sul terreno, più una cella di margine
  const blk=new Uint8Array(N);
  for(const a of rdAspAll()){ if(!rdAvoid(a)) continue; const bb=a.bb; if(!bb||bb[1]<lat0||bb[0]>lat1||bb[3]<lon0||bb[2]>lon1) continue;
    if(rdPip(A,a.pts)||rdPip(B,a.pts)) continue;                      // ci parti o ci arrivi: quella non si può girare, resta l'avviso
    const [i0,j0]=IJ({lat:bb[0],lon:bb[2]}), [i1,j1]=IJ({lat:bb[1],lon:bb[3]});
    for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){ const p=LL(i,j); if(!rdPip(p,a.pts)) continue; const k=j*nx+i, tf=terr[k], lo=rdLim(a.lo,terr[k]), hi=rdLim(a.hi,terr[k]);
      if(lo-100<tf+margin && hi>tf+margin) blk[k]=1; } }
  for(const z of RD_NOFLY){ if(dist(z,A).d<z.r||dist(z,B).d<z.r) continue; const [ci,cj]=IJ(z), rr=Math.ceil(z.r/cell)+1;
    for(let dj=-rr;dj<=rr;dj++) for(let di=-rr;di<=rr;di++){ const ii=ci+di, jj=cj+dj; if(ii<0||jj<0||ii>=nx||jj>=ny) continue; if(dist(LL(ii,jj),z).d<z.r+cell*0.5) blk[jj*nx+ii]=1; } }
  // base più bassa delle zone da evitare in ogni cella (dove ci si passa sotto): una tratta lunga deve restare sotto anche sul suo punto più alto
  const floorG=new Float32Array(N).fill(Infinity);
  for(const a of rdAspAll()){ if(!rdAvoid(a)) continue; const bb=a.bb; if(!bb||bb[1]<lat0||bb[0]>lat1||bb[3]<lon0||bb[2]>lon1) continue; if(rdPip(A,a.pts)||rdPip(B,a.pts)) continue;
    const [i0,j0]=IJ({lat:bb[0],lon:bb[2]}), [i1,j1]=IJ({lat:bb[1],lon:bb[3]});
    for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){ const k=j*nx+i; if(blk[k]) continue; const p=LL(i,j); if(!rdPip(p,a.pts)) continue; const f=rdLim(a.lo,terr[k])-100; if(f<floorG[k]) floorG[k]=f; } }
  const blk2=blk.slice(); for(let j=0;j<ny;j++) for(let i=0;i<nx;i++) if(blk[j*nx+i]) for(let dj=-1;dj<=1;dj++) for(let di=-1;di<=1;di++){ const ii=i+di, jj=j+dj; if(ii>=0&&jj>=0&&ii<nx&&jj<ny) blk2[jj*nx+ii]=1; }
  const [si,sj]=IJ(A), [ei,ej]=IJ(B);
  for(const [ci,cj] of [[si,sj],[ei,ej]]) for(let dj=-2;dj<=2;dj++) for(let di=-2;di<=2;di++){ const ii=ci+di, jj=cj+dj; if(ii>=0&&jj>=0&&ii<nx&&jj<ny) blk2[jj*nx+ii]=0; }
  // costo: distanza, tanto più cara quanto il terreno obbliga a salire sopra la crociera (ogni 500 ft in più vale come un'altra cella): si passa dalle valli
  const w=k=>1+Math.max(0,terr[k]+margin-cruise)/500;
  // vento: ogni passo costa il tempo che ci vuole in quella direzione (con vento contrario la strada «costa» di più)
  const tas=Math.max(40,PLAN.tas), wnd=rdWindAt((A.lat+B.lat)/2,(A.lon+B.lon)/2,cruise), wf={};
  for(let dj=-1;dj<=1;dj++) for(let di=-1;di<=1;di++) if(di||dj) wf[di+','+dj]=tas/rdGs(wrap360(Math.atan2(di,dj)*R2D),wnd,tas).gs;
  const g=new Float32Array(N).fill(Infinity), from=new Int32Array(N).fill(-1), done=new Uint8Array(N), H=rdHeap();
  const minW=Math.min(...Object.values(wf)), s=sj*nx+si, e=ej*nx+ei, hEst=k=>Math.hypot(k%nx-ei,((k/nx)|0)-ej)*minW;
  g[s]=0; H.push(s,hEst(s)); let it=0;
  while(H.size){ const k=H.pop(); if(done[k]) continue; done[k]=1; if(k===e) break; if(++it>600000) break;
    const i=k%nx, j=(k/nx)|0;
    for(let dj=-1;dj<=1;dj++) for(let di=-1;di<=1;di++){ if(!di&&!dj) continue; const ii=i+di, jj=j+dj; if(ii<0||jj<0||ii>=nx||jj>=ny) continue; const q=jj*nx+ii; if(blk2[q]||done[q]) continue;
      const c=g[k]+(di&&dj?1.4142:1)*wf[di+','+dj]*(w(k)+w(q))/2; if(c<g[q]){ g[q]=c; from[q]=k; H.push(q,c+hEst(q)); } } }
  RD.busy=false;
  if(from[e]<0 && s!==e) return null;
  const path=[]; for(let k=e;k>=0;k=from[k]){ path.push(k); if(k===s) break; } path.reverse();
  // semplifica: dal punto corrente al più lontano raggiungibile in linea retta senza celle vietate e senza terreno più alto di quello del percorso trovato
  const clear=(a,b)=>{ let pm=-1e9; for(let t=a;t<=b;t++) if(terr[path[t]]>pm) pm=terr[path[t]];
    const ia=path[a]%nx, ja=(path[a]/nx)|0, ib=path[b]%nx, jb=(path[b]/nx)|0, n=Math.max(2,Math.ceil(Math.hypot(ib-ia,jb-ja)*3));
    let mxT=-1e9, mnF=Infinity;
    for(let t=0;t<=n;t++){ const ii=Math.round(ia+(ib-ia)*t/n), jj=Math.round(ja+(jb-ja)*t/n), q=jj*nx+ii; if(blk2[q]) return false; if(terr[q]>pm+200) return false; if(terr[q]>mxT) mxT=terr[q]; if(floorG[q]<mnF) mnF=floorG[q]; }
    return !(mnF<mxT+margin); };   // con una quota sola sulla tratta: sopra il terreno più alto e sotto la base più bassa
  const keep=[]; let a=0;
  while(a<path.length-1){ let b=path.length-1; while(b>a+1 && !clear(a,b)) b--; keep.push(b); a=b; }
  // niente tratte cortissime: un punto a meno di 2 km dal precedente si toglie se la linea resta libera
  const idx=[0,...keep]; for(let t=1;t<idx.length-1;t++){ const pa=path[idx[t-1]], pb=path[idx[t]];
    if(Math.hypot(pa%nx-pb%nx,((pa/nx)|0)-((pb/nx)|0))*cell<2000 && clear(idx[t-1],idx[t+1])){ idx.splice(t,1); t--; } }
  return idx.slice(1,-1).map(t=>LL(path[t]%nx,(path[t]/nx)|0));
}
async function rdAvoidAll(){
  if(RD.pts.length<2){ rdHint('Disegna prima partenza e arrivo'); return; }
  const noAsp=!rdAspAll().length;                            // senza spazi aerei si calcola lo stesso: valli, terreno e vento
  if(noAsp) rdHint('Spazi aerei non caricati: calcolo con terreno e vento soltanto',4000);
  rdAnalyze(); const bad=RD.info.map((l,i)=>l.hits.some(h=>h.avoid)?i:-1).filter(i=>i>=0);
  rdPush(); RD.busy='Calcolo la rotta…'; rdDraw(); let added=0, failed=0, k=1;
  // anche le tratte senza zone: se il terreno chiede di salire, si cerca la valle
  const todo=RD.info.map((l,i)=>i);                          // tutte le tratte: la più breve in tempo, col vento, intorno alle zone, dalle valli
  for(const i of todo.reverse()){ const A=RD.pts[i], B=RD.pts[i+1], mid=await rdAround(A,B);
    if(mid===null){ failed++; continue; }
    RD.pts.splice(i+1,0,...mid.map(p=>({lat:p.lat,lon:p.lon,f:null,name:'R'+(k++)}))); added+=mid.length; }
  // pulizia: via i punti aggiunti che non servono (tratte corte), se senza di loro la tratta resta fuori dalle zone e il terreno non chiede di salire di più
  for(let pass=0;pass<3;pass++){ let removed=0;
    for(let i=1;i<RD.pts.length-1;i++){ const p=RD.pts[i]; if(!(p.name&&/^R\d+$/.test(p.name))) continue;
      const A=RD.pts[i-1], B=RD.pts[i+1], d1=dist(A,p).d, d2=dist(p,B).d; if(d1>4000 && d2>4000 && pass<2) continue;
      await new Promise(r=>setTimeout(r,0)); RD.busy='Rifinisco la rotta…'; rdDraw();
      const c1=rdLegCheck(A,p), c2=rdLegCheck(p,B), c=rdLegCheck(A,B);
      if([...c.zones].some(z=>!c1.zones.has(z)&&!c2.zones.has(z))) continue;          // senza il punto si entrerebbe in una zona nuova if(c.safe>Math.max(c1.safe,c2.safe)+300) continue;
      RD.pts.splice(i,1); i--; removed++; }
    if(!removed) break; }
  let kk=1; for(const p of RD.pts) if(p.name&&/^R\d+$/.test(p.name)) p.name='R'+(kk++);
  added=RD.pts.filter(p=>p.name&&/^R\d+$/.test(p.name)).length;
  RD.busy=false; rdAnalyze();
  if(noAsp) RD.msgNoAsp=true; else RD.msgNoAsp=false;
  const left=new Set(); RD.info.forEach(l=>l.hits.forEach(h=>{ if(h.avoid) left.add(`${h.a.cls} ${h.a.name}`); }));
  RD.msg=failed?`Per ${failed} tratte non trovo un passaggio libero alla quota di crociera: prova ad alzarla o abbassarla, oppure sposta i punti a mano.`:(added?`Aggiunti ${added} punti (R1, R2…): la rotta più breve in tempo con il vento previsto, intorno alle zone e ai punti da non sorvolare, dalle valli dove il terreno lo chiede.`+(left.size?` Restano da verificare: ${[...left].slice(0,4).join(', ')} (ci parti o ci arrivi, oppure il terreno obbliga a salire dentro). Controlla la rotta prima del volo.`:' Controlla la rotta prima del volo.'):(left.size?`La rotta diritta è già la migliore, ma restano: ${[...left].slice(0,4).join(', ')}.`:'La rotta diritta è già la più breve e libera: nessun punto da aggiungere.'));
  rdChanged(); rdHint(failed?'Rotta calcolata in parte: vedi sotto la mappa':(added?`Rotta calcolata: ${added} punti aggiunti`+(left.size?' · restano zone, vedi sotto':''):'La rotta diritta è già la migliore'),3500);
}

// ---------- controllo meteo della rotta alle quote (Open-Meteo: ICON-D2/ICON-EU, AROME, GFS, ECMWF) ----------
// tutti i livelli da 1000 a 700 hPa, all'ora in cui si passa su ogni tratta; la fonte è sostituibile (per esempio Windy Professional)
const WXL=[1000,975,950,925,900,850,800,700];
RD.wx=store.get('ia517_rdwx',null); RD.wxRep=null;
const wxHourMs=iso=>new Date(/Z$/.test(iso)?iso:iso+'Z').getTime();
function rdDepMs(){ const d=new Date(PLAN.dep||Date.now()); return isNaN(d)?Date.now():d.getTime(); }
async function rdWxFetch(points){
  const vars=[...WXL.flatMap(l=>[`wind_speed_${l}hPa`,`wind_direction_${l}hPa`,`geopotential_height_${l}hPa`,`temperature_${l}hPa`]),
    'temperature_2m','dew_point_2m','wind_speed_10m','wind_direction_10m','wind_gusts_10m','cloud_cover_low','cloud_cover_mid','visibility','precipitation','cape','freezing_level_height','weather_code'];
  const q=a=>a.map(x=>x.toFixed(4)).join(',');
  const url='https://api.open-meteo.com/v1/forecast?latitude='+q(points.map(p=>p.lat))+'&longitude='+q(points.map(p=>p.lon))+'&hourly='+vars.join(',')+'&wind_speed_unit=kmh&timezone=GMT&forecast_days=3';
  const ctl=new AbortController(), tm=setTimeout(()=>ctl.abort(),20000);
  const r=await fetch(url,{signal:ctl.signal}); clearTimeout(tm); if(!r.ok) throw new Error('servizio meteo: errore '+r.status);
  const j=await r.json(), arr=Array.isArray(j)?j:[j];
  return points.map((p,i)=>{ const h=(arr[i]||{}).hourly||{}, T=(h.time||[]).map(wxHourMs); let k=0, bd=1e18; T.forEach((t,x)=>{ const d=Math.abs(t-p.tPass); if(d<bd){ bd=d; k=x; } });
    const g=v=>h[v]?h[v][k]:null, lv=WXL.map(l=>({gh:g(`geopotential_height_${l}hPa`),kmh:g(`wind_speed_${l}hPa`),dir:g(`wind_direction_${l}hPa`),t:g(`temperature_${l}hPa`)})).filter(x=>x.gh!=null&&x.kmh!=null);
    return Object.assign({},p,{hour:T[k]||null,lv,t2:g('temperature_2m'),td2:g('dew_point_2m'),w10:{kmh:g('wind_speed_10m'),dir:g('wind_direction_10m')},gust:g('wind_gusts_10m'),
      ccl:g('cloud_cover_low'),ccm:g('cloud_cover_mid'),vis:g('visibility'),pr:g('precipitation'),cape:g('cape'),frz:g('freezing_level_height'),wc:g('weather_code'),elev:(arr[i]||{}).elevation}); });
}
function rdWxNear(lat,lon){ const W=RD.wx; if(!W||!W.pts||Date.now()-W.t>3*3600e3) return null; let best=null, bd=1e12;
  for(const p of W.pts){ const d=dist({lat,lon},p).d; if(d<bd){ bd=d; best=p; } } return bd<40000?best:null; }
// vento alla quota (ft AMSL): interpolato tra i livelli con la loro quota geopotenziale; sotto il primo livello, verso il vento a 10 m
function rdWxWind(lat,lon,ft){ const p=rdWxNear(lat,lon); if(!p||!p.lv.length) return null; const m=(ft==null?PLAN.cruiseFt:ft)*0.3048;
  const uv=w=>[-w.kmh*Math.sin(w.dir*D2R),-w.kmh*Math.cos(w.dir*D2R)];
  const L=[]; if(p.w10&&p.w10.kmh!=null) L.push([(p.elev||0)+10,uv(p.w10)]); for(const x of p.lv) if(x.gh>(L.length?L[L.length-1][0]:-1e9)) L.push([x.gh,uv(x)]);
  let u,v; if(m<=L[0][0]) [u,v]=L[0][1]; else if(m>=L[L.length-1][0]) [u,v]=L[L.length-1][1];
  else for(let i=0;i<L.length-1;i++) if(m>=L[i][0]&&m<=L[i+1][0]){ const t=(m-L[i][0])/(L[i+1][0]-L[i][0]); u=L[i][1][0]+(L[i+1][1][0]-L[i][1][0])*t; v=L[i][1][1]+(L[i+1][1][1]-L[i][1][1])*t; }
  return {kmh:Math.hypot(u,v), dir:wrap360(Math.atan2(-u,-v)*R2D)}; }
function rdWxTemp(p,ft){ const m=ft*0.3048, L=p.lv; if(!L.length) return null; if(m<=L[0].gh) return p.t2; for(let i=0;i<L.length-1;i++) if(m>=L[i].gh&&m<=L[i+1].gh) return L[i].t+(L[i+1].t-L[i].t)*(m-L[i].gh)/(L[i+1].gh-L[i].gh); return L[L.length-1].t; }
// base delle nubi basse stimata dallo scarto temperatura–rugiada (circa 400 ft per °C), solo con almeno metà cielo coperto di nubi basse
function rdWxCloudCap(lat,lon){ const p=rdWxNear(lat,lon); if(!p||p.ccl==null||p.ccl<50||p.t2==null||p.td2==null) return null;
  const baseFt=Math.round(((p.elev||0)/0.3048+Math.max(0,p.t2-p.td2)*400)/100)*100; return {baseFt,capFt:baseFt-500}; }
async function rdWxCheck(){
  if(RD.pts.length<2){ rdHint('Disegna prima la rotta'); return; }
  RD.wxBusy=true; rdInfo();
  try{
    rdAnalyze();                                                           // tempi delle tratte per l'ora di passaggio
    const dep=rdDepMs(), pts=[]; let cum=0;
    pts.push({lat:RD.pts[0].lat,lon:RD.pts[0].lon,tPass:dep,role:'dep',name:RD.pts[0].f?RD.pts[0].f.short:'Partenza'});
    RD.info.forEach((l,i)=>{ const a=RD.pts[i], b=RD.pts[i+1], n=l.d>40000?3:1;
      for(let k=1;k<=n;k++){ const t=k/(n+1); pts.push({lat:a.lat+(b.lat-a.lat)*t,lon:a.lon+(b.lon-a.lon)*t,tPass:dep+(cum+l.min*t)*60000,role:'leg',leg:i}); }
      cum+=l.min; });
    const B=RD.pts[RD.pts.length-1]; pts.push({lat:B.lat,lon:B.lon,tPass:dep+cum*60000,role:'arr',name:B.f?B.f.short:'Arrivo',f:B.f&&B.f.rw?B.f.id:null});
    RD.wx={t:Date.now(),pts:await rdWxFetch(pts.slice(0,40))}; store.set('ia517_rdwx',RD.wx);
    rdAnalyze();                                                           // quote ottimizzate col vento vero alle quote
    RD.wxRep=rdWxReport();
  }catch(e){ RD.wxRep={err:String(e&&e.message||e)}; }
  RD.wxBusy=false; rdInfo(); rdDraw();
  try{ PLAN.wxRep=RD.wxRep; PLAN.wxRepT=Date.now(); store.set('ia517_plan',PLAN); renderWxRoute&&renderWxRoute(); }catch(e){}
}
function rdWxReport(){
  const out={legs:[],ends:[],lvl:'ok',t:Date.now()}, bump=l=>{ if(l==='bad'||(l==='warn'&&out.lvl==='ok')) out.lvl=l; };
  const flag=(arr,l,txt)=>{ arr.push([l,txt]); bump(l); };
  const tas=Math.max(40,PLAN.tas); let fuel=0, tmin=0, tmin0=0;
  RD.info.forEach((l,i)=>{ const P=RD.wx.pts.filter(p=>p.role==='leg'&&p.leg===i), f=[];
    const w=rdWxWind((RD.pts[i].lat+RD.pts[i+1].lat)/2,(RD.pts[i].lon+RD.pts[i+1].lon)/2,l.altFt);
    const head=w?w.kmh*Math.cos((w.dir-l.crs)*D2R):0, cross=w?Math.abs(w.kmh*Math.sin((w.dir-l.crs)*D2R)):0;
    for(const p of P){
      if(p.wc>=95) flag(f,'bad','temporali previsti');
      else if(p.cape>1000) flag(f,'bad',`instabilità forte (CAPE ${Math.round(p.cape)})`); else if(p.cape>300) flag(f,'warn',`possibili cumuli e temporali (CAPE ${Math.round(p.cape)})`);
      if(p.vis!=null){ if(p.vis<1500) flag(f,'bad',`visibilità ${(p.vis/1000).toFixed(1)} km`); else if(p.vis<5000) flag(f,'warn',`visibilità ${(p.vis/1000).toFixed(1)} km`); }
      if(p.pr>2) flag(f,'bad',`pioggia forte ${p.pr} mm/h`); else if(p.pr>0.3) flag(f,'warn',`pioggia ${p.pr} mm/h`);
      const cc=p.ccl>=50&&p.t2!=null&&p.td2!=null?Math.round(((p.elev||0)/0.3048+Math.max(0,p.t2-p.td2)*400)/100)*100:null;
      if(cc!=null && l.altFt>cc-500) flag(f,(l.safeFt||0)>cc-500?'bad':'warn',`nubi basse ${p.ccl}% con base ~${cc} ft${(l.safeFt||0)>cc-500?': il terreno non lascia spazio sotto le nubi':''}`);
      const T=rdWxTemp(p,l.altFt); if(T!=null && T<=2 && (p.ccl>=50||p.ccm>=50||p.pr>0)) flag(f,'warn',`rischio ghiaccio: ${T.toFixed(0)} °C in nube o pioggia (zero termico ~${Math.round((p.frz||0)/0.3048/100)*100} ft)`);
    }
    if(head>0.4*tas) flag(f,'warn',`vento contrario forte (${Math.round(head)} km/h)`);
    tmin+=l.min; tmin0+=l.d/1000/tas*60; fuel+=l.min/60*PLAN.burn;
    out.legs.push({i,alt:l.altFt,why:l.why,w,head:Math.round(head),cross:Math.round(cross),gs:Math.round(l.gs||tas),min:l.min,hour:P[0]&&P[0].tPass,f:[...new Map(f.map(x=>[x[1],x])).values()]});
  });
  for(const p of RD.wx.pts.filter(p=>p.role!=='leg')){ const f=[];
    if(p.gust>55) flag(f,'bad',`raffiche ${Math.round(p.gust)} km/h`); else if(p.gust>40) flag(f,'warn',`raffiche ${Math.round(p.gust)} km/h`);
    if(p.vis!=null&&p.vis<5000) flag(f,p.vis<1500?'bad':'warn',`visibilità ${(p.vis/1000).toFixed(1)} km`);
    if(p.wc>=95) flag(f,'bad','temporali previsti');
    let xw=null; try{ const fld=p.f&&byId(p.f), a=ACP(), pk=fld&&pickRunway(fld,p.w10&&p.w10.kmh!=null?{dir:p.w10.dir,kmh:p.w10.kmh}:null);
      if(pk&&pk.xw!=null){ xw=Math.round(pk.xw); const xm=acN(a,'xwind'); if(xm&&pk.xw>xm) flag(f,'bad',`traverso ${xw} km/h sulla ${pk.end.id}, oltre il massimo del velivolo (${xm})`); } }catch(e){}
    out.ends.push({role:p.role,name:p.name,hour:p.tPass,w10:p.w10,gust:p.gust,xw,f}); }
  out.tmin=tmin; out.tmin0=tmin0; out.fuel=fuel+(PLAN.taxi||0);
  return out;
}
function rdWxHtml(R){
  if(R.err) return `<div class="bad">Controllo meteo non riuscito: ${esc(R.err)}</div>`;
  const col={ok:'#5bd38a',warn:'#ffb020',bad:'#ff6b6b'}, hm=t=>t?new Date(t).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}):'';
  const verdict={ok:'Nessun problema meteo sulla rotta alle quote proposte',warn:'Attenzione: ci sono punti da valutare',bad:'Condizioni sfavorevoli: valuta di non partire o di cambiare rotta o orario'}[R.lvl];
  const d3=v=>String(Math.round(v)).padStart(3,'0');
  return `<div style="margin-top:6px;padding:8px;border-radius:10px;border:1px solid ${col[R.lvl]}"><b style="color:${col[R.lvl]}">${verdict}</b>
    <div>Tempo col vento previsto: <b>${fmtMin(R.tmin)}</b> (senza vento ${fmtMin(R.tmin0)}) · carburante ~${R.fuel.toFixed(1)} L</div>`+
    R.ends.map(e=>`<div>${e.role==='dep'?'Partenza':'Arrivo'} ${esc(e.name||'')} alle ${hm(e.hour)}: vento ${e.w10&&e.w10.kmh!=null?windDir(e.w10.dir)+' · '+Math.round(e.w10.kmh):'n.d.'}${e.gust?' raff. '+Math.round(e.gust):''} km/h${e.xw!=null?' · traverso '+e.xw:''}${e.f.map(x=>` <span style="color:${col[x[0]]}">· ${esc(x[1])}</span>`).join('')}</div>`).join('')+
    R.legs.map(l=>`<div>T${l.i+1} alle ${hm(l.hour)} · <b>${l.alt} ft</b>${l.why==='vento'?' (vento migliore)':(l.why==='sotto'?' (sotto la base)':(l.why==='terreno'?' (terreno)':''))} · vento ${l.w?windDir(l.w.dir)+' · '+Math.round(l.w.kmh):'n.d.'} · ${l.head>=0?'contro '+l.head:'in coda '+(-l.head)} · GS ${l.gs}${l.f.map(x=>` <span style="color:${col[x[0]]}">· ${esc(x[1])}</span>`).join('')}</div>`).join('')+
    `<div style="opacity:.75;margin-top:4px">Previsione dei modelli (Open-Meteo), non un'osservazione: confronta con METAR, TAF e briefing ufficiale.</div></div>`;
}

// ---------- ingressi: tasto nella scheda Rotta e tocco sulla piccola mappa ----------
(()=>{ const b=document.createElement('button'); b.className='ghost'; b.type='button'; b.id='rdOpen'; b.textContent='✎ Disegna sulla mappa (schermo pieno)';
  $('addWp').after(b); b.addEventListener('click',rdOpen);
  $('map').addEventListener('click',rdOpen); $('map').style.cursor='pointer'; })();
window.IA517_routeEditor=rdOpen;
// per il collaudo automatico (emulatore): accesso dall'app dello strumento
window.IA517_rd={get RD(){ return RD; }, close:rdClose, open:rdOpen,
  plan(from,dest,ft){ PLAN.from=from; PLAN.wps=[]; PLAN.dest=dest; if(ft){ PLAN.cruiseFt=ft; $('pAlt').value=ft; } PV.autoDone=PV.sig(); renderRoute(); update(); }};

// riquadro nel Briefing: ultimo controllo meteo della rotta alle quote
(()=>{ const host=$('bSummary')&&$('bSummary').closest('section'); if(!host) return; const sec=document.createElement('section'); sec.className='card'; sec.id='wxRouteCard';
  sec.innerHTML='<h2>Meteo sulla rotta, alle quote</h2><div id="wxRoute"></div><div class="btnrow"><button class="btn pri" type="button" id="wxRouteGo">Apri la rotta e fai il controllo</button></div>';
  host.after(sec); $('wxRouteGo').onclick=()=>{ rdOpen(); setTimeout(()=>rdWxCheck(),600); }; })();
function renderWxRoute(){ const b=$('wxRoute'); if(!b) return; const R=PLAN.wxRep;
  b.innerHTML=R?`<div style="margin-bottom:6px">${wxStamp(PLAN.wxRepT,'Controllo meteo')}</div>`+rdWxHtml(R):'<div class="sub">Non ancora fatto per questa rotta: apri la rotta e tocca «Controllo meteo alle quote».</div>'; }
{ const _u2=update; update=function(){ _u2(); try{ renderWxRoute(); }catch(e){} }; }


// ---------- piano: profilo verticale della rotta e rotta migliore automatica ----------
// Il riquadro «Salite, discese e giri» mostra per ogni tratta la quota, se la salita o la discesa ci sta col velivolo
// (peso e quota) e i giri di 360° che servono; il tempo dei giri entra nel tempo e nel carburante del piano.
// Se la rotta è dritta (solo partenza e arrivo) e passa su zone da evitare, o il terreno obbliga a salire molto sopra la
// crociera, o la salita non ci sta, la rotta migliore si calcola da sola (una volta per coppia partenza-arrivo).
window.IA517_PV=null;
const PV={res:null,key:'',busy:false,autoDone:'',msg:'',straight:null,
  sig(){ return [PLAN.from,PLAN.dest,PLAN.cruiseFt,RD.margin].join('|'); }};
window.IA517_PV=PV;
function pvCompute(force){
  const pts=[PLAN.from,...PLAN.wps,PLAN.dest].map(byId).filter(Boolean).map(f=>({lat:f.lat,lon:f.lon,f}));
  if(pts.length<2){ PV.res=null; return null; }
  const a=ACP(), key=JSON.stringify([pts.map(p=>p.f.id),PLAN.cruiseFt,PLAN.tas,PLAN.fuel,PLAN.wb,RD.margin,a.roc,a.rod,a.ceil,a.mtow,a.empty,!!rdAspAll().length]);
  if(!force && PV.key===key && PV.res && !PV.res.pending) return PV.res;
  const st={asp:rdAspAll(),pending:false}, info=[];
  for(let i=0;i<pts.length-1;i++) info.push(rdLegAnalyze(pts[i],pts[i+1],st));
  const V=rdVert(pts,info); PV.res={pts,info,V,pending:st.pending}; PV.key=key;
  if(st.pending){ clearTimeout(PV.t); PV.t=setTimeout(()=>{ try{ pvCompute(true); renderPV(); pvAutoCheck(); update(); }catch(e){} },1500); }
  return PV.res;
}
(()=>{ const sec=document.createElement('section'); sec.className='card'; sec.id='pvCard';
  sec.innerHTML=`<h2>↗ Salite, discese e giri <span class="sub" id="pvSub"></span></h2><div id="pvBox" class="fuel"></div>`;
  const legs=$('legs'); (legs&&legs.closest('section')||$('fuel').closest('section')).after(sec); })();
function renderPV(){
  const box=$('pvBox'); if(!box) return; const R=PV.res;
  if(!R){ box.innerHTML='<span class="sub">Imposta partenza e arrivo.</span>'; return; }
  const V=R.V, rows=R.info.map((L,i)=>{ const v=V&&V.legs.find(x=>x.i===i&&!x.arrive);
    return `<div class="row"><span>T${i+1} ${esc(R.pts[i].f.short)} → ${esc(R.pts[i+1].f.short)}</span><span><b>${L.altFt} ft</b>${(L.safeFt&&L.safeFt>=L.altFt-100)?' · per il terreno':(L.why==='sotto'?' · sotto una zona':(L.why==='vento'?' · vento migliore':''))}</span></div>`+
      (v&&v.note?`<div class="sub" style="color:${v.ok?'var(--warn)':'var(--bad)'}">${v.dir==='su'?'Salita':'Discesa'} ${v.from}→${v.to} ft: ${esc(v.note)}${v.ok&&v.sec?` · +${fmtMin(v.sec/60)}`:''}</div>`:''); }).join('');
  const arr=V&&V.legs.find(x=>x.arrive);
  const avoid=R.info.some(l=>l.hits.some(h=>h.avoid));
  box.innerHTML=(PV.busy?`<div class="pill warn">${esc(PV.busy)}</div>`:'')+(PV.msg?`<div class="sub">${esc(PV.msg)}</div>`:'')+rows+
    (arr?`<div class="sub" style="color:${arr.ok?'var(--warn)':'var(--bad)'}">Arrivo ${arr.from}→${arr.to} ft: ${esc(arr.note)}${arr.ok?` · +${fmtMin(arr.sec/60)}`:''}</div>`:'')+
    (R.pending?'<div class="sub">Scarico le quote del terreno…</div>':'')+
    (V?`<div class="row sum"><span>Giri di 360° in tutto</span><span>${V.extraMin>0?'+'+fmtMin(V.extraMin)+' (già nel tempo e nel carburante)':'nessuno'}</span></div>`:'')+
    (V&&!V.ok?'<span class="pill bad">Una salita o una discesa non si può fare così: rivedi la rotta</span>':'')+
    (avoid?'<span class="pill bad">La rotta passa in zone da evitare</span>':'')+
    `<div class="btnrow" style="margin-top:6px">${PLAN.wps.length?'':'<button class="btn" type="button" id="pvBest">Calcola la rotta migliore</button>'}${PV.straight?'<button class="btn" type="button" id="pvStraight">Torna alla rotta dritta</button>':''}</div>`;
  $('pvSub').textContent=V?`· peso stimato ${V.W} kg`:'';
  const b=$('pvBest'); if(b) b.onclick=()=>pvBest(true);
  const s2=$('pvStraight'); if(s2) s2.onclick=()=>{ PLAN.wps=[]; PV.straight=null; PV.autoDone=PV.sig(); PV.msg='Rotta dritta ripristinata.'; renderRoute(); update(); store.set('ia517_plan',PLAN); };
}
// rotta migliore senza aprire l'editor (stesso calcolo di «Calcola rotta»)
async function pvBest(manual){
  if(PV.busy||RD.on) return; const pts=[PLAN.from,...PLAN.wps,PLAN.dest].map(byId).filter(Boolean); if(pts.length!==2) return;
  PV.busy='Calcolo la rotta migliore (valli, zone, vento, salite)…'; PV.msg=''; renderPV();
  try{ rdBuild(); RD.pts=pts.map(f=>({lat:f.lat,lon:f.lon,f})); RD.hist=[]; RD.on=true; RD.msg='';
    await rdAvoidAll();
    if(RD.pts.length>2){ PV.straight={from:PLAN.from,dest:PLAN.dest}; rdSave(); PV.msg=`Rotta migliore: ${RD.pts.length-2} ${RD.pts.length-2===1?"punto aggiunto (R1)":"punti aggiunti (R1, R2…)"} dalle valli, col vento previsto${RD.msgNoAsp?'. Spazi aerei non caricati: zone non considerate (Briefing › Scarica gli spazi aerei)':''}.`; }
    else PV.msg=manual?'La rotta dritta è già la migliore.':''; }
  catch(e){ PV.msg='Calcolo non riuscito: '+e.message; }
  finally{ RD.on=false; PV.busy=false; PV.autoDone=PV.sig(); renderPV(); }
}
function pvAutoCheck(){
  const R=PV.res; if(!R||R.pending||PLAN.wps.length||PV.busy||RD.on||PV.autoDone===PV.sig()||!R.info.length) return;
  const L=R.info[0], bad=L.hits.some(h=>h.avoid) || ((L.safeFt||0)>PLAN.cruiseFt+1000) || (R.V&&!R.V.ok);
  PV.autoDone=PV.sig();
  if(bad){ clearTimeout(PV.at); PV.at=setTimeout(()=>pvBest(false),800); }
}
{ const _u=update; update=function(){ try{ pvCompute(false); }catch(e){ console.error(e); } _u(); try{ renderPV(); pvAutoCheck(); }catch(e){ console.error(e); } }; }
// tempo e carburante: i giri di 360° si aggiungono al viaggio
{ const c0=compute; compute=function(){ const c=c0(); try{ const V=PV.res&&PV.res.V; if(V&&V.extraMin>0){ const add=V.extraMin, L=add/60*PLAN.burn;
      c.min+=add; c.trip+=L; c.need+=L; c.margin-=L; c.orbitMin=add; } }catch(e){} return c; }; }
