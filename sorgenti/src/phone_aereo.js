// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
// =====================================================================================
//  Velivoli: un profilo per ogni aereo, con velocità, prestazioni, carburante, pesi e
//  centraggio, equipaggiamento. Il velivolo attivo regola tutta l'app: archi della
//  scala di velocità, simulazione, circuito, piano di volo (velocità, consumo, carburante),
//  carico e centraggio, piste e vento al traverso, tipo di volo, transponder, planata.
// =====================================================================================
PH.AC_SCHEMA=[
  {g:'Identità',f:[
    {k:'reg',l:'Marche',t:'text',ph:'I-A517',req:1},
    {k:'model',l:'Modello',t:'text',ph:'Avid Flyer'},
    {k:'cat',l:'Categoria (decide le regole degli spazi aerei)',t:'sel',o:[['vds_basico','VDS basico'],['vds_avanzato','VDS avanzato'],['vfr','Aviazione generale VFR']]},
    {k:'notes',l:'Note (hangar, frequenze, promemoria)',t:'area'}]},
  {g:'Velocità (km/h, indicate)',h:'Le trovi nel manuale di volo (POH). Colorano la scala di velocità: bianco VS0–VFE, verde VS1–VNO, giallo VNO–VNE, rosso VNE.',f:[
    {k:'vs0',l:'VS0 · stallo in atterraggio (flap giù)',n:[20,250]},
    {k:'vs1',l:'VS1 · stallo pulito',n:[20,250]},
    {k:'vfe',l:'VFE · massima con flap',n:[30,400]},
    {k:'va',l:'VA · manovra',n:[30,400]},
    {k:'vno',l:'VNO · massima strutturale in crociera',n:[30,500]},
    {k:'vne',l:'VNE · da non superare mai',n:[40,500]},
    {k:'vx',l:'VX · salita ripida',n:[20,300]},
    {k:'vy',l:'VY · salita rapida',n:[20,300]},
    {k:'vglide',l:'Miglior planata',n:[20,300]},
    {k:'vapp',l:'Avvicinamento in finale',n:[20,300]},
    {k:'vcirc',l:'Circuito (sottovento e base)',n:[20,300]},
    {k:'vcruise',l:'Crociera (velocità vera, per il piano)',n:[30,500]}]},
  {g:'Prestazioni',f:[
    {k:'roc',l:'Rateo di salita a pieno carico, al livello del mare (ft/min)',n:[100,3000]},
    {k:'rod',l:'Rateo di discesa massimo (ft/min)',n:[200,3000]},
    {k:'glide',l:'Efficienza in planata (1 : …)',n:[3,60],step:0.5},
    {k:'todist',l:'Decollo fino a 15 m di altezza, a peso massimo (m)',n:[30,3000]},
    {k:'ldist',l:'Atterraggio da 15 m di altezza, a peso massimo (m)',n:[30,3000]},
    {k:'xwind',l:'Vento al traverso massimo dimostrato (km/h)',n:[5,80]},
    {k:'hcFt',l:'Quota del circuito (ft sul campo)',n:[300,2000],step:50},
    {k:'ceil',l:'Quota massima operativa (ft)',n:[1000,25000],step:100}]},
  {g:'Carburante',f:[
    {k:'fuelType',l:'Tipo',t:'sel',o:[['mogas','Mogas 95 (benzina auto)'],['avgas','AVGAS 100LL'],['ul91','UL91'],['altro','Altro']]},
    {k:'fuelCap',l:'Capacità dei serbatoi (L)',n:[1,1000]},
    {k:'fuelUnus',l:'Non utilizzabile (L)',n:[0,100],step:0.5},
    {k:'burn',l:'Consumo in crociera (L/h)',n:[1,200],step:0.5},
    {k:'res',l:'Riserva finale (min)',n:[0,120],step:5},
    {k:'taxi',l:'Rullaggio e salita (L)',n:[0,50],step:0.5}]},
  {g:'Pesi e centraggio',h:'Bracci in metri dal riferimento (datum) del manuale. Senza bracci l\'app controlla solo i pesi.',f:[
    {k:'empty',l:'Peso a vuoto (kg)',n:[50,5000]},
    {k:'emptyArm',l:'Braccio del peso a vuoto (m)',n:[-10,20],step:0.001,opt:1},
    {k:'mtow',l:'Peso massimo al decollo, MTOW (kg)',n:[100,6000]},
    {k:'seats',l:'Posti',t:'sel',o:[['1','1'],['2','2'],['4','4']]},
    {k:'pilotArm',l:'Braccio pilota (m)',n:[-10,20],step:0.001,opt:1},
    {k:'paxArm',l:'Braccio passeggero (m)',n:[-10,20],step:0.001,opt:1},
    {k:'fuelArm',l:'Braccio carburante (m)',n:[-10,20],step:0.001,opt:1},
    {k:'bagMax',l:'Bagaglio massimo (kg)',n:[0,500]},
    {k:'bagArm',l:'Braccio bagaglio (m)',n:[-10,20],step:0.001,opt:1},
    {k:'cgFwd',l:'Limite anteriore del baricentro (m)',n:[-10,20],step:0.001,opt:1},
    {k:'cgAft',l:'Limite posteriore del baricentro (m)',n:[-10,20],step:0.001,opt:1}]},
  {g:'Equipaggiamento',f:[
    {k:'xpdr',l:'Transponder',t:'sel',o:[['no','Nessuno'],['c','Modo C'],['s','Modo S']]},
    {k:'radio',l:'Radio VHF (8,33 kHz)',t:'sel',o:[['1','Sì'],['0','No']]},
    {k:'elt',l:'ELT',t:'sel',o:[['0','No'],['1','Sì']]},
    {k:'chute',l:'Paracadute balistico',t:'sel',o:[['0','No'],['1','Sì']]}]}
];
// profilo di partenza: l'Avid Flyer di Enry (I-A517), con i valori che l'app usava finora
PH.AC_DEF={id:'ac-ia517',reg:'I-A517',model:'Avid Flyer',cat:'vds_basico',notes:'',
  vs0:42,vs1:55,vfe:100,va:110,vno:130,vne:145,vx:70,vy:80,vglide:80,vapp:95,vcirc:105,vcruise:110,
  roc:600,rod:700,glide:8,todist:250,ldist:250,xwind:20,hcFt:800,ceil:10000,
  fuelType:'mogas',fuelCap:73,fuelUnus:1,burn:14,res:30,taxi:1.5,
  empty:280,emptyArm:'',mtow:450,seats:'2',pilotArm:'',paxArm:'',fuelArm:'',bagMax:10,bagArm:'',cgFwd:'',cgAft:'',
  xpdr:'no',radio:'1',elt:'0',chute:'0'};
PH.AC_NEW={reg:'',model:'',cat:'vds_avanzato',notes:'',vs0:55,vs1:65,vfe:110,va:130,vno:180,vne:220,vx:85,vy:95,vglide:95,vapp:100,vcirc:115,vcruise:160,
  roc:800,rod:800,glide:10,todist:300,ldist:300,xwind:25,hcFt:1000,ceil:12000,fuelType:'mogas',fuelCap:80,fuelUnus:2,burn:16,res:30,taxi:2,
  empty:300,emptyArm:'',mtow:600,seats:'2',pilotArm:'',paxArm:'',fuelArm:'',bagMax:20,bagArm:'',cgFwd:'',cgAft:'',xpdr:'s',radio:'1',elt:'1',chute:'0'};
PH.acs=lsGet('ia517p_aircraft',null)||[Object.assign({},PH.AC_DEF)];
PH.acId=lsGet('ia517p_acid',PH.acs[0].id);
PH.ac=PH.acs.find(a=>a.id===PH.acId)||PH.acs[0];
PH.acSave=function(){ lsSet('ia517p_aircraft',PH.acs); lsSet('ia517p_acid',PH.ac.id); };
PH.acNum=(a,k)=>{ const v=a[k]; return v===''||v==null||isNaN(+v)?null:+v; };
PH.acDens=a=>({mogas:0.74,avgas:0.72,ul91:0.72}[a.fuelType]||0.72);
PH.acLabel=a=>(a.reg||'senza marche')+(a.model?' · '+a.model:'');
// controlli di coerenza: ordine delle velocità e dati mancanti
PH.acCheck=function(a){ const w=[], n=k=>PH.acNum(a,k);
  if(!a.reg) w.push('Mancano le marche.');
  if(n('vs0')>n('vs1')) w.push('VS0 dovrebbe essere minore o uguale a VS1.');
  if(n('vs1')>=n('vno')) w.push('VS1 dovrebbe essere minore di VNO.');
  if(n('vno')>=n('vne')) w.push('VNO dovrebbe essere minore di VNE.');
  if(n('vfe')>n('vne')) w.push('VFE non può superare VNE.');
  if(n('vcruise')>n('vno')) w.push('La crociera supera VNO: in aria turbolenta resta sotto VNO.');
  if(n('vapp')<1.2*n('vs0')) w.push('L\'avvicinamento è sotto 1,2 × VS0: margine sullo stallo scarso (di solito 1,3 × VS0).');
  if(n('empty')>=n('mtow')) w.push('Il peso a vuoto deve essere minore del MTOW.');
  if(n('fuelUnus')>=n('fuelCap')) w.push('Il carburante non utilizzabile supera la capacità.');
  if(n('cgFwd')!=null&&n('cgAft')!=null&&n('cgFwd')>=n('cgAft')) w.push('Il limite anteriore del baricentro deve essere minore di quello posteriore.');
  return w; };
// applica il velivolo attivo a tutta l'app; first=true quando lo si sceglie (circuito e tipo di volo cambiano solo allora)
PH.acApply=function(first){
  const a=PH.ac, n=k=>PH.acNum(a,k);
  Object.assign(ARCS,{vs0:n('vs0')||42,vs1:n('vs1')||55,vfe:n('vfe')||100,vno:n('vno')||130,vne:n('vne')||145});
  Object.assign(AC_,{vapp:n('vapp')||95,vcirc:n('vcirc')||105,vcruise:n('vcruise')||115,vs0:n('vs0')||42,glide:n('glide')||0});
  if(!PH.sim) SIM_CRUISE=AC_.vcruise;
  window.IA517_EQUIP={xpdr:a.xpdr||'no',radio:a.radio!=='0'};
  if(first){
    if(n('hcFt')) NAV.hcFt=n('hcFt');
    if(a.cat && window.IA517_RULES && IA517_RULES.PROFILES[a.cat]) IA517_RULES.set(a.cat);
    // decelerazione in corsa imparata per ogni velivolo
    const d=lsGet('ia517p_decel_'+a.id,null); if(d&&d.grass&&d.paved) Object.assign(DECEL,d);
  }
  try{ const w=el('phAppFrame').contentWindow; w && w.IA517_aircraft && w.IA517_aircraft(PH.acForPlan()); }catch(e){}
  try{ PH.renderAsp&&PH.renderAsp(); }catch(e){}
};
PH.acForPlan=function(){ return JSON.parse(JSON.stringify(PH.ac)); };
window.IA517_AC=()=>PH.acForPlan();
PH.acSelect=function(id){ const old=PH.ac; try{ lsSet('ia517p_decel_'+old.id,DECEL); }catch(e){}
  PH.ac=PH.acs.find(a=>a.id===id)||PH.acs[0]; PH.acSave(); PH.acApply(true); PH.act&&PH.act('velivolo '+PH.ac.reg); toast('VELIVOLO: '+(PH.ac.reg||'').toUpperCase()); };

// ---------- impostazioni: elenco e scheda del velivolo ----------
PH.acSectionHtml=function(){
  const e=x=>String(x??'').replace(/[<&>"]/g,c=>({'<':'&lt;','&':'&amp;','>':'&gt;','"':'&quot;'}[c]));
  return `<section><h3>Velivoli</h3>
    <p class="ph-sub">Il velivolo attivo regola tutta l'app: scala di velocità, circuito, simulazione, piano di volo, carico e centraggio, piste e vento al traverso, tipo di volo e transponder.</p>
    <div id="phAcList">${PH.acs.map(a=>`<label class="ph-row ph-acrow"><input type="radio" name="phAc" value="${e(a.id)}" ${a.id===PH.ac.id?'checked':''}><span style="flex:1"><b>${e(a.reg||'—')}</b> ${e(a.model||'')}<br><small>${({vds_basico:'VDS basico',vds_avanzato:'VDS avanzato',vfr:'VFR'})[a.cat]||''} · VNE ${e(a.vne)} km/h · crociera ${e(a.vcruise)} km/h · ${e(a.burn)} L/h</small></span><button class="ph-btn" type="button" data-ace="${e(a.id)}">Modifica</button></label>`).join('')}</div>
    <label class="ph-chk"><input type="checkbox" id="phGlide" ${PH.glideOn?'checked':''}> Cerchio di planata sulla mappa (dall'efficienza del velivolo attivo, con il 25% di margine)</label>
    <div class="ph-btns"><button class="ph-btn pri" type="button" id="phAcNew">Nuovo velivolo</button><button class="ph-btn" type="button" id="phAcDup">Duplica l'attivo</button><button class="ph-btn" type="button" id="phAcExp">Esporta</button><label class="ph-btn" style="cursor:pointer">Importa<input type="file" id="phAcImp" accept=".json,application/json" hidden></label></div>
  </section>`; };
PH.acSectionWire=function(){
  const box=el('phAcList'); if(!box) return;
  const gl=el('phGlide'); if(gl) gl.onchange=()=>{ PH.glideOn=gl.checked; lsSet('ia517p_glide',PH.glideOn); toast(PH.glideOn?'CERCHIO DI PLANATA ACCESO':'CERCHIO DI PLANATA SPENTO'); };
  box.querySelectorAll('input[name=phAc]').forEach(r=>r.onchange=()=>{ PH.acSelect(r.value); PH.renderImp(); });
  box.querySelectorAll('[data-ace]').forEach(b=>b.onclick=ev=>{ ev.preventDefault(); PH.acEdit(PH.acs.find(a=>a.id===b.dataset.ace)); });
  el('phAcNew').onclick=()=>PH.acEdit(Object.assign({},PH.AC_NEW,{id:'ac-'+Date.now().toString(36)}),true);
  el('phAcDup').onclick=()=>PH.acEdit(Object.assign({},PH.ac,{id:'ac-'+Date.now().toString(36),reg:PH.ac.reg+' (copia)'}),true);
  el('phAcExp').onclick=()=>PH.download('HORIZON_velivoli.json',JSON.stringify({horizon:'velivoli',v:1,list:PH.acs},null,2),'application/json');
  el('phAcImp').onchange=async ev=>{ const f=ev.target.files[0]; if(!f) return;
    try{ const j=JSON.parse(await f.text()), list=(j.list||j).filter(a=>a&&a.reg&&a.vne); let n=0;
      for(const a of list){ const c=Object.assign({},PH.AC_NEW,a); if(PH.acs.some(x=>x.id===c.id)) c.id='ac-'+Date.now().toString(36)+n; PH.acs.push(c); n++; }
      PH.acSave(); toast(n+' VELIVOLI IMPORTATI'); PH.renderImp(); }catch(e){ toast('FILE NON VALIDO'); } };
};
PH.acEdit=function(a,isNew){
  const e=x=>String(x??'').replace(/[<&>"]/g,c=>({'<':'&lt;','&':'&amp;','>':'&gt;','"':'&quot;'}[c]));
  const d=document.createElement('div'); d.className='ph-sheet'; d.id='phAcEd';
  const fld=f=>{ const v=a[f.k]??'';
    if(f.t==='sel') return `<label class="ph-fld">${e(f.l)}<select data-k="${f.k}">${f.o.map(([k2,l])=>`<option value="${k2}" ${String(v)===k2?'selected':''}>${e(l)}</option>`).join('')}</select></label>`;
    if(f.t==='area') return `<label class="ph-fld" style="grid-column:1/-1">${e(f.l)}<textarea data-k="${f.k}" rows="2">${e(v)}</textarea></label>`;
    if(f.t==='text') return `<label class="ph-fld">${e(f.l)}<input data-k="${f.k}" type="text" value="${e(v)}" placeholder="${e(f.ph||'')}" autocapitalize="characters"></label>`;
    return `<label class="ph-fld">${e(f.l)}${f.opt?' <small>(facoltativo)</small>':''}<input data-k="${f.k}" type="number" inputmode="decimal" step="${f.step||1}" min="${f.n[0]}" max="${f.n[1]}" value="${e(v)}"></label>`; };
  d.innerHTML=`<div class="ph-sheet-h"><button type="button" id="phAcBack">◀ Indietro</button><b>${isNew?'Nuovo velivolo':'Velivolo '+e(a.reg)}</b></div>
    <div class="ph-imp">${PH.AC_SCHEMA.map(g=>`<section><h3>${e(g.g)}</h3>${g.h?`<p class="ph-sub">${e(g.h)}</p>`:''}<div class="ph-acgrid">${g.f.map(fld).join('')}</div></section>`).join('')}
      <section><p class="ph-sub" id="phAcWarn"></p>
      <div class="ph-btns"><button class="ph-btn pri" type="button" id="phAcOk">Salva${isNew?'':' e usa'}</button>${!isNew&&PH.acs.length>1?'<button class="ph-btn" type="button" id="phAcDel">Elimina</button>':''}</div></section></div>`;
  document.body.appendChild(d);
  const read=()=>{ const b=Object.assign({},a); d.querySelectorAll('[data-k]').forEach(i=>{ b[i.dataset.k]=i.tagName==='INPUT'&&i.type==='number'?(i.value===''?'':+i.value):i.value; }); b.reg=String(b.reg||'').trim().toUpperCase(); return b; };
  const warn=()=>{ const w=PH.acCheck(read()); el('phAcWarn').innerHTML=w.length?'<b>Da controllare:</b><br>'+w.map(e).join('<br>'):'Dati coerenti.'; };
  d.querySelectorAll('[data-k]').forEach(i=>i.addEventListener('input',warn)); warn();
  el('phAcBack').onclick=()=>d.remove();
  el('phAcOk').onclick=()=>{ const b=read(); if(!b.reg){ el('phAcWarn').innerHTML='<b>Scrivi le marche del velivolo.</b>'; return; }
    const i=PH.acs.findIndex(x=>x.id===b.id); if(i>=0) PH.acs[i]=b; else PH.acs.push(b);
    PH.acSave(); d.remove(); PH.acSelect(b.id); PH.renderImp(); };
  if(el('phAcDel')) el('phAcDel').onclick=()=>{ if(!confirm('Eliminare il velivolo '+a.reg+'?')) return; PH.acs=PH.acs.filter(x=>x.id!==a.id);
    if(PH.ac.id===a.id) PH.ac=PH.acs[0]; PH.acSave(); d.remove(); PH.acSelect(PH.ac.id); PH.renderImp(); };
};
// cerchio di planata sulla mappa: distanza raggiungibile dall'altezza sul terreno, con un margine del 25%
PH.glideOn=lsGet('ia517p_glide',true);
PH.glideRing=function(toS,ac,sc){ const g=AC_.glide; if(!PH.glideOn||!g||PH.demo&&!PH.sim) return;
  if(!(S.gpsReal||PH.sim)) return; const z=terrain(ac.E,ac.N); if(z!==z) return; const h=S.alt*FT2M-z; if(h<60) return;
  const r=h*g*0.75, p=toS(ac.E,ac.N); ctx.save(); ctx.strokeStyle='rgba(120,255,170,.85)'; ctx.lineWidth=2*k; ctx.setLineDash([3*k,5*k]);
  ctx.beginPath(); ctx.arc(p.x,p.y,r*sc,0,7); ctx.stroke(); ctx.setLineDash([]);
  ctx.font=font(R*0.038,'700'); ctx.fillStyle='rgba(120,255,170,.95)'; ctx.textAlign='center'; ctx.textBaseline='bottom'; ctx.fillText('planata '+(r/1000).toFixed(1)+' km',p.x,p.y-r*sc-2); ctx.restore(); };
PH.acApply(false);
