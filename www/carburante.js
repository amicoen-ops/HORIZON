// HORIZON · carburante sui campi e alternati per il rifornimento · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Dati: openAIP (CC BY-NC 4.0), copia aggiornata ogni notte sul sito dell'app, più i campi che segni tu.
// Tre fasce di criticità, uguali nel piano e in volo, sul carburante che ti resta quando atterri:
//   1 · COMODO        arrivi con almeno la riserva del piano (es. 30 min)
//   2 · RISERVA       arrivi intaccando la riserva, ma con almeno 10 minuti
//   3 · CRITICO       arrivi con meno di 10 minuti, oppure non ci arrivi
(function(){
'use strict';
const DATA={"src":"openAIP","lic":"CC BY-NC 4.0","upd":"2026-11-01","fields":[["ALISCARLINO","LIQY",42.91169,10.81654,26,["ul91"],2,650],["GORIZIA","LIPG",45.90756,13.60011,164,["avgas","mogas"],2,1100],["BIELLA / CERRIONE","LILE",45.49589,8.10253,889,["avgas","jet"],2,1320],["BOLZANO","LIPB",46.46,11.326,784,["avgas","jet"],9,1432],["FANO","LIDF",43.82389,13.02583,52,["avgas","jet"],2,1350],["LUCCA / TASSIGNANO","LIQL",43.82556,10.57817,39,["avgas","jet"],2,910],["GROSSETO","LIRS",42.76007,11.06994,52,["jet"],5,2994],["CATANIA/FONTANAROSSA","LICC",37.46679,15.06637,20,["jet"],9,2435],["CUNEO / LEVALDIGI","LIMZ",44.548,7.623,1266,["avgas","jet"],2,2100],["OZZANO - GUGLIELMO ZAMBONI","LIKO",44.4719,11.5407,102,["avgas","jet","mogas"],2,840],["ROMA / URBE","LIRU",41.9525,12.50214,33,["avgas","jet"],2,1084],["MILANO / LINATE","LIML",45.44778,9.27679,325,["jet"],3,2441],["RIMINI / MIRAMARE","LIPR",44.02028,12.61194,43,["jet"],0,2962],["ROMA / FIUMICINO","LIRF",41.8,12.239,13,["jet"],3,3902],["RENO AIR CLUB",null,44.613,11.324,82,["ul91"],2,0],["VENEZIA/TESSERA","LIPZ",45.505,12.352,7,["jet"],3,3300],["PADOVA","LIPU",45.396,11.848,46,["avgas","jet"],2,1122],["VENEZIA/LIDO","LIPV",45.42893,12.38903,20,["avgas","jet"],2,994],["PERUGIA/S. FRANCESCO","LIRZ",43.097,12.51361,636,["avgas","jet"],9,2199],["RIVOLI DI OSOPPO","LIKH",46.2343,13.07279,515,["avgas","jet","mogas"],2,850],["SIBARI FLY",null,39.7569,16.4381,2060,["mogas"],2,850],["CITTÀ DI CURTATONE",null,45.1017,10.74897,66,["avgas","mogas"],2,750],["ALBERTVILLE GAL P. DELACHENAL","LFKA",45.62639,6.32889,1040,["avgas","jet"],2,800],["ANNECY MEYTHET","LFLP",45.92917,6.09889,1522,["avgas","jet"],9,1630],["AVIGNON CAUMONT","LFMV",43.90667,4.90194,125,["avgas","jet","mogas"],9,1875],["AIX LES MILLES","LFMA",43.50528,5.36743,322,["avgas","jet"],9,1604],["ANNEMASSE","LFLI",46.19194,6.26833,1621,["avgas","jet"],2,1300],["CARPENTRAS","LFNH",44.02806,5.08389,387,["avgas","ul91"],2,1200],["BESANCON LA VEZE","LFQM",47.20694,6.08389,1270,["avgas","jet"],9,1400],["BONNAY",null,47.3334,6.03544,751,["mogas"],6,320],["CANNES MANDELIEU","LFMD",43.54639,6.95111,49,["jet"],9,1540],["BELLEY PEYRIEU","LFKY",45.69389,5.69167,738,["avgas"],2,638],["BALE-MULHOUSE","LFSB",47.59,7.52917,840,["avgas","jet"],3,3900],["BEAUNE CHALLANGES","LFGF",47.00639,4.89356,440,["avgas"],2,910],["BELLEGARDE VOUVRAY","LFHN",46.12333,5.80486,1598,["avgas","ul91"],2,670],["CHALON CHAMPFORGEUIL","LFLH",46.82611,4.8175,623,["avgas","jet"],9,1440],["CHATEAU ARNOUX SAINT AUBAN","LFMX",44.05833,5.99095,1483,["avgas"],2,999],["COURCHEVEL","LFLJ",45.39584,6.63251,6581,["avgas","jet"],13,537],["SAINT MARTIN DE CASTILLON",null,43.85306,5.55028,1083,["mogas"],6,800],["DOLE TAVAUX","LFGJ",47.03889,5.42722,646,["avgas","jet"],9,2230],["DIJON LONGVIC","LFSD",47.26584,5.09501,725,["avgas","jet"],9,2400],["CHAMBERY CHALLES LES EAUX","LFLE",45.56083,5.97556,974,["avgas"],2,990],["CUERS PIERREFEU","LFTF",43.24751,6.12723,266,["avgas","jet"],0,1925],["COLMAR HOUSSEN","LFGA",48.11028,7.35917,627,["avgas","jet"],9,1610],["GRAY SAINT ADRIEN","LFEV",47.43167,5.61778,679,["avgas","jet"],9,1265],["GRENOBLE LE VERSOUD","LFLG",45.2182,5.84851,719,["avgas","jet","ul91"],9,900],["GRIMAUD",null,43.26778,6.55194,16,["avgas","jet"],7,0],["GAP TALLARD","LFNA",44.45389,6.03667,1965,["avgas","jet","ul91"],2,945],["LA MOLE","LFTZ",43.20544,6.48194,59,["avgas","jet"],9,1071],["MONT DAUPHIN SAINT CREPIN","LFNC",44.70056,6.59917,2963,["avgas","jet"],2,845],["LE CASTELLET","LFMQ",43.25223,5.78612,1391,["avgas","jet"],9,1485],["NUITS SAINT GEORGES","LFGZ",47.14223,4.96834,797,["avgas"],2,894],["LONS LE SAUNIER COURLAOUX","LFGL",46.67512,5.46917,745,["avgas"],2,1100],["MACON CHARNAY","LFLM",46.29584,4.79583,728,["avgas","mogas"],2,1230],["MORESTEL","LFHI",45.68695,5.45251,804,["avgas"],2,787],["MONTBELIARD COURCELLES","LFSM",47.48667,6.79139,1040,["avgas","jet"],9,1700],["MULHOUSE MOENCHSBERG CENTRE HOSP","LFWO",47.72533,7.345,1053,["jet"],7,0],["ORANGE PLAN DE DIEU","LFPR",44.1794,4.91902,312,["avgas"],2,825],["PEROUGES MEXIMIEUX","LFHC",45.87167,5.18508,696,["ul91"],2,690],["MARSEILLE PROVENCE","LFML",43.43667,5.21501,20,["jet"],3,3500],["NICE COTE D'AZUR","LFMN",43.66028,7.21562,16,["jet"],9,2963],["LYON CORBAS","LFHJ",45.65278,4.91223,653,["avgas"],2,900],["LYON BRON","LFLY",45.72722,4.94425,650,["avgas","jet","mogas"],9,1820],["LYON SAINT EXUPERY","LFLL",45.72556,5.08849,781,["jet"],3,4000],["PONTARLIER","LFSP",46.90417,6.32689,2651,["avgas"],2,1000],["SAINT RAMBERT D'ALBON","LFLR",45.25263,4.82659,469,["avgas"],2,900],["SALON EYGUIERES","LFNE",43.65751,5.01278,246,["avgas","mogas"],2,1280],["PUIMOISSON","LFTP",43.86889,6.16278,2523,["avgas"],2,800],["SAINT CHAMOND L HORME","LFHG",45.49195,4.53445,1306,["avgas"],2,700],["SALON DE PROVENCE","LFMY",43.60722,5.10861,194,["avgas","jet"],0,2001],["VALENCE CHABEUIL","LFLU",44.92112,4.96981,423,["avgas","jet"],9,2100],["VESOUL FROTEY","LFQW",47.63862,6.20417,1201,["avgas","jet"],2,1408],["VILLEFRANCHE TARARE","LFHV",45.91862,4.63491,1030,["avgas","jet"],9,1040],["VINON","LFNF",43.73639,5.78306,902,["avgas"],2,1250],["MALAFRETAZ",null,46.33393,5.14042,630,["mogas"],6,400],["HAUSEN AM ALBIS \"R\"","LSZN",47.2386,8.5156,1929,["avgas","mogas"],2,700],["MOLLIS","LSZM",47.07917,9.065,1460,["avgas","jet"],0,1707],["SCHÄNIS \"R\"","LSZX",47.1717,9.0394,1365,["jet","mogas"],1,520],["WANGEN-LACHEN","LSPV",47.20485,8.86741,1325,["avgas"],2,500],["BEX","LSGB",46.2583,6.9864,1312,["avgas","jet"],2,700],["COURTELARY","LSZJ",47.18335,7.09072,2218,["mogas"],1,560],["FRICKTAL-SCHUPFART","LSZI",47.50906,7.94997,1788,["avgas","mogas"],2,530],["YVERDON-LES-BAINS","LSGY",46.7619,6.6133,1421,["avgas","jet","mogas"],2,872],["LUZERN-BEROMÜNSTER","LSZO",47.19,8.2047,2146,["avgas","jet"],2,510],["MUENSTER \"R\"","LSPU",46.48,8.26333,4357,["avgas","mogas"],2,815],["RARON","LSTA",46.30444,7.82167,2093,["avgas"],2,842],["SCHINDELLEGI","LSXS",47.17032,8.71409,2598,["avgas","jet"],7,0],["UNTERVAZ","LSXU",46.91262,9.55081,1759,["jet"],7,0],["LA CÔTE","LSGP",46.4064,6.2581,1352,["avgas"],2,560],["LAUTERBRUNNEN","LSXL",46.58529,7.91356,2618,["jet"],7,0],["LOMMIS","LSZT",47.5244,9.0031,1539,["avgas","mogas"],2,615],["SAANEN","LSGK",46.48654,7.24849,3307,["avgas","jet"],2,1400],["ST. GALLEN-ALTENRHEIN","LSZR",47.4851,9.56025,1270,["avgas","jet"],9,1455],["TRIENGEN","LSPN",47.22592,8.07857,1585,["avgas","jet","ul91"],2,570],["ZERMATT","LSEZ",46.02938,7.75332,5295,["jet"],7,0],["INTERLAKEN \"R\"","LSXI",46.67019,7.87615,1900,["jet"],7,0],["LEYSIN","LSEY",46.34144,7.02416,4042,["jet"],7,0],["LOCARNO","LSZL",46.16537,8.87832,646,["avgas","jet"],0,800],["LUGANO","LSZA",46.00361,8.91028,915,["avgas","jet"],9,1415],["SION","LSGS",46.21917,7.32694,1581,["avgas","jet","ul91"],0,2000],["TROGEN \"R\"","LSXT",47.40897,9.4731,2615,["jet"],7,0],["ZWEISIMMEN","LSTZ",46.55167,7.38111,3061,["avgas","ul91"],2,587],["BIRRFELD","LSZF",47.44368,8.23398,1276,["avgas","jet","mogas"],2,718],["GRUYERES","LSGT",46.5942,7.0944,2257,["avgas","jet"],2,885],["NEUCHATEL","LSGN",46.9575,6.8647,1427,["avgas","jet"],2,700],["RARON","LSER",46.30153,7.83302,2096,["jet"],7,0],["SAMEDAN","LSZS",46.53444,9.88417,5600,["avgas","jet"],9,1840],["SCHAFFHAUSEN","LSPF",47.69038,8.52677,1516,["avgas","ul91"],2,540],["SPECK-FEHRALTORF","LSZK",47.3764,8.7575,1759,["avgas","jet","mogas"],2,625],["REICHENBACH","LSGR",46.6136,7.6778,2372,["avgas","jet"],2,805],["TAVANASA","LSXA",46.76066,9.0932,2513,["jet"],7,0],["BAD RAGAZ","LSZE",47.01492,9.48182,1591,["avgas"],2,495],["BIEL-KAPPELEN","LSZP",47.08834,7.28918,1437,["avgas","jet","ul91"],2,690],["BERN-BELP","LSZB",46.91222,7.49944,1673,["avgas","jet","mogas"],3,1730],["GRENCHEN","LSZG",47.18163,7.4172,1411,["avgas","jet"],9,1000],["LAUSANNE-LA BLECHERETTE","LSGL",46.5453,6.6167,1995,["avgas","jet","ul91"],2,875],["SAN VITTORE","LSXV",46.2322,9.08952,856,["jet"],7,0],["SITTERDORF","LSZV",47.50897,9.26276,1637,["avgas","jet","ul91"],2,480],["THUN","LSZW",46.7564,7.6006,1837,["avgas"],2,800],["BRESSAUCOURT","LSZQ",47.39238,7.02886,1841,["avgas","jet","ul91"],2,800],["BUTTWIL","LSZU",47.2647,8.3025,2372,["avgas","jet"],2,675],["ECUVILLENS","LSGE",46.75528,7.07583,2297,["avgas","jet"],2,800],["ERSTFELD  \"R\"","LSXE",46.83415,8.63927,1506,["jet"],7,0],["GSTEIGWILER","LSXG",46.64771,7.8782,2251,["jet"],7,0],["HOLZIKEN","LSXH",47.31417,8.02611,1526,["avgas","jet"],7,0],["KÄGISWIL","LSPG",46.90748,8.25321,1493,["avgas"],2,780],["LES EPLATURES","LSGC",47.08417,6.79361,3366,["avgas","jet"],9,1090],["LODRINO","LSPR",46.29444,8.99278,850,["avgas","jet"],2,773],["PAYERNE","LSMP",46.8425,6.91361,1467,["jet"],0,2791],["GMUNDEN-LAAKIRCHEN","LOLU",47.95167,13.86778,1621,["avgas","jet","mogas"],2,550],["FÜRSTENFELD","LOGF",47.06203,16.08375,787,["avgas","jet","mogas"],2,700],["HOHENEMS-DORNBIRN","LOIH",47.38447,9.69972,1322,["avgas","jet","mogas"],2,630],["NIEDERÖBLARN","LOGO",47.47889,14.00722,2139,["avgas","jet","mogas"],2,730],["ST. JOHANN/TIROL","LOIJ",47.52028,12.44944,2156,["avgas","mogas"],2,750],["VÖSLAU","LOAV",47.96453,16.26111,715,["avgas","jet","mogas"],2,950],["WIENER NEUSTADT WEST","LOXN",47.8375,16.22361,866,["jet"],5,1620],["LIENZ-NIKOLSDORF","LOKL",46.79808,12.87833,2067,["avgas","jet","mogas"],2,500],["SEITENSTETTEN","LOLT",48.05056,14.66194,1050,["avgas","mogas"],2,830],["ZELL AM SEE","LOWZ",47.29156,12.79083,2454,["avgas","jet","mogas"],2,780],["FRIESACH-HIRT","LOKH",46.92861,14.43167,2028,["avgas","diesel","mogas"],2,707],["WIENER NEUSTADT/OST","LOAN",47.84333,16.26028,896,["avgas","jet","mogas"],2,1067],["AIGEN","LOXA",47.53556,14.14056,2083,["jet"],5,800],["KLAGENFURT","LOWK",46.64278,14.33722,1470,["avgas","jet"],3,2720],["ZELTWEG","LOXZ",47.20239,14.74222,2224,["jet"],5,2750],["HOFKIRCHEN","LOLH",48.13911,14.33583,1158,["avgas","mogas"],2,530],["WELS","LOLW",48.18389,14.04028,1043,["avgas","jet","mogas"],2,1390],["CERKLJE OB KRKI","LJCE",45.89993,15.53021,489,["avgas","jet"],5,3000],["PORTOROZ/SECOVLJE","LJPZ",45.4725,13.61556,7,["avgas","jet"],9,1200]]};
const KEY_UP='ia517_fuel_oa', KEY_MINE='ia517_fuelx', FINAL_MIN=10;
const LBL={mogas:'MOGAS',ul91:'UL91',avgas:'AVGAS 100LL',jet:'Jet A1',diesel:'Diesel'};
const SHORT={mogas:'MOGAS',ul91:'UL91',avgas:'100LL',jet:'JET',diesel:'DIESEL'};
// carburanti adatti al motore secondo il tipo nel profilo del velivolo (Rotax: MOGAS, UL91 e anche 100LL)
const OK_FOR={mogas:['mogas','ul91','avgas'],ul91:['ul91','avgas','mogas'],avgas:['avgas','ul91'],altro:['mogas','ul91','avgas','jet','diesel']};
const OA_SKIP=new Set([4,5,7,8]);                         // eliporti, militari, chiusi
const ls={get(k,d){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } },
          set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }};
const rad=Math.PI/180, R=6371;
const dkm=(a,b)=>{ const p1=a.lat*rad,p2=b.lat*rad,dp=p2-p1,dl=(b.lon-a.lon)*rad, h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2; return 2*R*Math.asin(Math.min(1,Math.sqrt(h))); };
const brg=(a,b)=>{ const p1=a.lat*rad,p2=b.lat*rad,dl=(b.lon-a.lon)*rad; return (Math.atan2(Math.sin(dl)*Math.cos(p2),Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl))/rad+360)%360; };
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmtMin=m=>{ m=Math.max(0,Math.round(m)); return m<60?m+"'":Math.floor(m/60)+'h'+String(m%60).padStart(2,'0'); };

function data(){ const u=ls.get(KEY_UP,null); return (u&&u.fields&&u.upd>DATA.upd)?u:DATA; }
function mine(){ return ls.get(KEY_MINE,{}); }
// i tuoi segni: {idCampo:{t:['mogas'],n:'nota',ts}}; t vuoto = «qui non c'è carburante»
function setMine(id,types,note){ const m=mine(); if(types==null) delete m[id]; else m[id]={t:types,n:note||'',ts:Date.now()}; ls.set(KEY_MINE,m); IDX=null; }

// abbina i campi openAIP a quelli dell'app: per sigla ICAO, se no il più vicino entro 1,5 km
let IDX=null, IDX_F=null, IDX_U='';
function index(fields){
  const d=data(), key=d.upd+'|'+fields.length+'|'+JSON.stringify(mine()).length;
  if(IDX && IDX_F===fields && IDX_U===key) return IDX;
  const byId=new Map(), extra=[];
  for(const [i,r] of d.fields.entries()){
    const [name,icao,lat,lon,ft,types,type,rwy]=r; if(OA_SKIP.has(type)) continue;
    let hit=icao?fields.find(f=>f.id===icao||f.short===icao):null;
    if(!hit){ let best=null,bd=1.5; for(const f of fields){ if(Math.abs(f.lat-lat)>0.03||Math.abs(f.lon-lon)>0.04) continue; const k=dkm(f,{lat,lon}); if(k<bd){ bd=k; best=f; } } hit=best; }
    if(hit) byId.set(hit.id,{types,src:'openAIP'});
    else extra.push({id:'OA-'+(icao||i),short:icao||name.slice(0,13),name:name.replace(/\s+/g,' '),lat,lon,elft:ft,kind:'aero',rwL:rwy,extra:true,fuel:{types,src:'openAIP'}});
  }
  for(const [id,m] of Object.entries(mine())) byId.set(id,{types:m.t||[],src:'tuo',note:m.n});
  IDX={byId,extra,upd:d.upd}; IDX_F=fields; IDX_U=key; return IDX;
}
function at(f,fields){ const x=index(fields); return f.extra?f.fuel:(x.byId.get(f.id)||null); }
function all(fields){ const x=index(fields), out=[];
  for(const f of fields){ const v=x.byId.get(f.id); if(v&&v.types.length) out.push({f,types:v.types,src:v.src,note:v.note}); }
  for(const f of x.extra) out.push({f,types:f.fuel.types,src:'openAIP'});
  return out; }
const compat=(types,ac)=>{ const ok=OK_FOR[ac]||OK_FOR.mogas; return types.filter(t=>ok.includes(t)); };
const band=(minLeft,res)=>minLeft>=res?1:(minLeft>=FINAL_MIN?2:3);
const BAND=[null,{c:'#2fd27a',t:'Fascia 1 · comodo',s:'arrivi con almeno la riserva'},{c:'#ffc531',t:'Fascia 2 · riserva',s:'arrivi intaccando la riserva'},{c:'#ff5a5a',t:'Fascia 3 · critico',s:'meno di 10 minuti all\'arrivo o fuori portata'}];

// ---- piano: per ogni campo con carburante vicino alla rotta, da dove si devia e con quanto si arriva ----
// o={pts:[{lat,lon,short}],fuel,taxi,burn,tas,res,ac,corridor}
function alongRoute(fields,o){
  const pts=o.pts.filter(p=>p&&isFinite(p.lat)); if(pts.length<2) return null;
  const tas=Math.max(30,o.tas||100), burn=Math.max(1,o.burn||14), res=o.res||30, corr=o.corridor||40;
  const segs=[]; let s0=0;
  for(let i=0;i<pts.length-1;i++){ const L=dkm(pts[i],pts[i+1]); segs.push({a:pts[i],b:pts[i+1],s0,L,i}); s0+=L; }
  const total=s0, start=(o.fuel||0)-(o.taxi||0);
  const fuelAt=s=>start-s/tas*burn;                        // litri a bordo dopo s km di rotta
  const sAtL=L=>(start-L)/burn*tas;                         // km di rotta dopo cui restano L litri
  const resL=res/60*burn, finL=FINAL_MIN/60*burn;
  const sRes=Math.min(total,Math.max(0,sAtL(resL))), sFin=Math.min(total,Math.max(0,sAtL(finL))), sDry=Math.max(0,sAtL(0));
  const proj=(p,g)=>{ const k=Math.cos(((g.a.lat+g.b.lat)/2)*rad)*111.32, ax=g.a.lon*k, ay=g.a.lat*110.57, bx=g.b.lon*k-ax, by=g.b.lat*110.57-ay,
      px=p.lon*k-ax, py=p.lat*110.57-ay, L2=bx*bx+by*by, t=L2?Math.max(0,Math.min(1,(px*bx+py*by)/L2)):0;
      return {t,x:Math.hypot(px-t*bx,py-t*by)}; };
  const rows=[], excl={inc:0};
  for(const it of all(fields)){
    const ok=compat(it.types,o.ac); if(!ok.length){ excl.inc++; continue; }
    let best=null;
    for(const g of segs){ const q=proj(it.f,g); const s=g.s0+q.t*g.L;
      // deviare prima conviene sempre: si sceglie il punto di rotta più vicino al campo
      if(!best||q.x<best.x-0.01) best={x:q.x,s,g}; }
    if(!best||best.x>corr) continue;
    const dev=best.x;
    const arrL=fuelAt(best.s)-dev/tas*burn, minLeft=arrL/burn*60;
    rows.push({f:it.f,types:it.types,ok,src:it.src,note:it.note,s:best.s,dev,leg:best.g.i,after:best.g.a.short,arrL,minLeft,b:band(minLeft,res)});
  }
  rows.sort((a,b)=>a.s-b.s);
  const usable=rows.filter(r=>r.b<3), last=usable.length?usable.reduce((m,r)=>r.s>m.s?r:m):null;
  const destL=fuelAt(total), short=destL<resL;
  return {rows,total,sRes,sFin,sDry,resL,finL,destL,short,last,excl,segs,tas,burn,res,start};
}

// ---- in volo: dalla posizione attuale, col carburante stimato ----
// o={pos:{lat,lon},fuelNow,burn,tas,gs,res,ac,max}
function fromHere(fields,o){
  const burn=Math.max(1,o.burn||14), res=o.res||30, sp=Math.max(40,o.gs>50?o.gs:(o.tas||100));
  const rows=[], excl={inc:0};
  for(const it of all(fields)){
    const ok=compat(it.types,o.ac); if(!ok.length){ excl.inc++; continue; }
    const d=dkm(o.pos,it.f), min=d/sp*60, arrL=o.fuelNow-min/60*burn, minLeft=arrL/burn*60;
    rows.push({f:it.f,types:it.types,ok,src:it.src,note:it.note,d,brg:brg(o.pos,it.f),min,arrL,minLeft,b:band(minLeft,res)});
  }
  rows.sort((a,b)=>a.d-b.d);
  const g=[1,2,3].map(b=>rows.filter(r=>r.b===b));
  return {b1:g[0].slice(0,o.max||8),b2:g[1].slice(0,o.max||8),b3:g[2].slice(0,3),n:rows.length,excl,sp,endur:o.fuelNow/burn*60};
}

// ---- disegno (stile proprio, va bene nel piano e sullo strumento) ----
function css(){ if(document.getElementById('fuCss')) return; const s=document.createElement('style'); s.id='fuCss'; s.textContent=`
.fu{font:14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#e8eef5}
.fu .fu-sub{color:#93a1b2;font-size:12.5px}
.fu .fu-bar{position:relative;height:42px;margin:10px 4px 4px}
.fu .fu-band{margin-top:10px;border-left:4px solid var(--c);padding:2px 0 2px 10px}
.fu .fu-band h4{margin:0 0 4px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--c)}
.fu .fu-row{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:7px 0;border-top:1px solid rgba(255,255,255,.07);cursor:pointer}
.fu .fu-row:first-of-type{border-top:0}
.fu .fu-row b{font-size:14.5px} .fu .fu-row .fu-r{text-align:right;font-variant-numeric:tabular-nums}
.fu .fu-chip{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.04em;padding:1px 6px;border-radius:5px;margin-right:4px;background:rgba(255,255,255,.08);color:#cfd8e3}
.fu .fu-chip.ok{background:rgba(47,210,122,.16);color:#2fd27a} .fu .fu-chip.me{background:rgba(120,170,255,.18);color:#9cc0ff}
.fu .fu-empty{color:#93a1b2;font-size:13px;padding:4px 0}
.fu .fu-act{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.fu button.fu-b{font:inherit;font-size:13px;font-weight:700;padding:7px 11px;border-radius:9px;border:1px solid rgba(255,255,255,.18);background:#1b2430;color:#e8eef5}
.fu button.fu-b.pri{background:#2a6df4;border-color:#2a6df4}
.fu .fu-alert{margin:8px 0;padding:8px 10px;border-radius:10px;background:rgba(255,90,90,.13);color:#ff8a8a;font-weight:600}
.fu .fu-good{margin:8px 0;padding:8px 10px;border-radius:10px;background:rgba(47,210,122,.12);color:#5fe39a;font-weight:600}
.fu .fu-ed{margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.1)}
.fu .fu-ed input[type=text]{width:100%;box-sizing:border-box;font:inherit;padding:8px 10px;border-radius:9px;border:1px solid rgba(255,255,255,.18);background:#0f151c;color:#e8eef5}
.fu .fu-ed label{display:inline-flex;align-items:center;gap:5px;margin:8px 12px 0 0;font-size:13.5px}
.fu .fu-big{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums}
`; document.head.appendChild(s); }

const chips=(r,ac)=>r.types.map(t=>`<span class="fu-chip${r.ok.includes(t)?' ok':''}">${SHORT[t]||t}</span>`).join('')+(r.src==='tuo'?'<span class="fu-chip me">segnato da te</span>':'');
const srcLine=fields=>{ const x=index(fields), n=Object.values(mine()).filter(m=>m.t&&m.t.length).length;
  return `Carburante: openAIP del ${x.upd.split('-').reverse().join('/')}${n?` + ${n} ${n===1?'campo segnato':'campi segnati'} da te`:''}. Verifica sempre per telefono o radio prima di contarci: orari e disponibilità cambiano.`; };

function routeBar(A){
  const pc=v=>(v/A.total*100).toFixed(2)+'%';
  const segs=[[0,A.sRes,'#2fd27a'],[A.sRes,A.sFin,'#ffc531'],[A.sFin,A.total,'#ff5a5a']].filter(z=>z[1]>z[0]+0.01);
  let h='<div class="fu-bar" aria-label="Carburante lungo la rotta">';
  for(const [x0,x1,c] of segs) h+=`<span style="position:absolute;left:${pc(x0)};width:${pc(x1-x0)};top:10px;height:6px;background:${c};opacity:.85"></span>`;
  const ticks=A.segs.map(g=>({s:g.s0,n:g.a.short})).concat([{s:A.total,n:A.segs[A.segs.length-1].b.short}]);
  for(const t of ticks) h+=`<span style="position:absolute;left:${pc(t.s)};top:4px;width:2px;height:18px;margin-left:-1px;background:#93a1b2"></span>`;
  // nomi dei punti: solo quelli che non si sovrappongono (il primo e l'ultimo sempre)
  const W=100, ch=2.0, shown=[], last=ticks.length-1;
  const L=ticks.map((t,i)=>{ const x=t.s/A.total*W, w=Math.min(13,String(t.n).length)*ch; return {...t,x,w,i,a:i===0?x:(i===last?x-w:x-w/2),b:i===0?x+w:(i===last?x:x+w/2)}; });
  const fits=t=>shown.every(o=>t.b+1.5<o.a||t.a>o.b+1.5);
  for(const t of [L[0],L[L.length-1],...L.slice(1,-1)]) if(t&&fits(t)) shown.push(t);
  for(const t of shown){ const al=t.i===0?'translateX(0)':(t.i===L.length-1?'translateX(-100%)':'translateX(-50%)');
    h+=`<span style="position:absolute;left:${t.x.toFixed(2)}%;top:26px;transform:${al};font-size:10.5px;color:#93a1b2;white-space:nowrap">${esc(String(t.n).slice(0,13))}</span>`; }
  for(const r of A.rows){ const d=r.b===1?16:13; h+=`<span title="${esc(r.f.name)}" style="position:absolute;left:${pc(r.s)};top:${13-d/2}px;width:${d}px;height:${d}px;margin-left:${-d/2}px;border-radius:50%;background:${BAND[r.b].c};border:3px solid #0b1016;box-sizing:border-box"></span>`; }
  return h+'</div>';
}

function planHtml(fields,o){
  css(); const A=alongRoute(fields,o);
  if(!A) return '<div class="fu"><div class="fu-empty">Imposta partenza e destinazione per vedere i campi con carburante lungo la rotta.</div></div>';
  let h=`<div class="fu"><div class="fu-sub">Campi con carburante adatto al motore (${esc(LBL[o.ac]||o.ac)}) entro ${o.corridor||40} km dalla rotta. Per ognuno: da dove deviare e con quanto carburante arrivi, partendo con ${o.fuel.toFixed(0)} L.</div>`;
  h+=routeBar(A);
  h+=`<div class="fu-sub" style="margin-top:12px">Barra: verde finché resta la riserva, giallo quando la intacchi, rosso sotto i 10 minuti. ${A.sDry<A.total?`A secco al km ${A.sDry.toFixed(0)} di ${A.total.toFixed(0)}.`:`All'arrivo restano ${A.destL.toFixed(1)} L (${fmtMin(A.destL/A.burn*60)}).`}</div>`;
  if(A.short){ const L=A.last;
    h+=L?`<div class="fu-alert">Il carburante non basta per arrivare con la riserva: l'ultimo rifornimento utile è <b>${esc(L.f.name)}</b> al km ${L.s.toFixed(0)} (dopo ${esc(L.after)}${L.dev>1?`, ${L.dev.toFixed(0)} km fuori rotta`:''}), ci arrivi con ${Math.max(0,L.arrL).toFixed(1)} L (${fmtMin(L.minLeft)}). Toccalo qui sotto e aggiungilo come tappa.</div>`
        :`<div class="fu-alert">Il carburante non basta e lungo la rotta non c'è un campo con carburante raggiungibile: rivedi il piano o segna i campi che conosci.</div>`; }
  else if(A.rows.length) h+=`<div class="fu-good">Arrivi con la riserva. Campi con carburante sulla rotta: ${A.rows.length}${A.last?`, l'ultimo raggiungibile è ${esc(A.last.f.name)} al km ${A.last.s.toFixed(0)}`:''}.</div>`;
  for(const b of [1,2,3]){ const rs=A.rows.filter(r=>r.b===b);
    h+=`<div class="fu-band" style="--c:${BAND[b].c}"><h4>${BAND[b].t}</h4><div class="fu-sub">${BAND[b].s}</div>`;
    h+=rs.length?rs.map(r=>`<div class="fu-row" data-fid="${esc(r.f.id)}" data-leg="${r.leg}">
        <div><b>${esc(r.f.name)}</b>${r.f.short&&r.f.short!==r.f.name?` <span class="fu-sub">${esc(r.f.short)}</span>`:''}<br>${chips(r)}</div>
        <div class="fu-r"><b>${r.arrL>0?r.arrL.toFixed(1)+' L':'non ci arrivi'}</b><br><span class="fu-sub">${r.arrL>0?fmtMin(r.minLeft)+' all\'arrivo':''}</span></div>
        <div class="fu-sub" style="grid-column:1/-1">km ${r.s.toFixed(0)} · dopo ${esc(r.after)}${r.dev>1?` · ${r.dev.toFixed(0)} km fuori rotta`:' · sulla rotta'}${r.note?' · '+esc(r.note):''}</div></div>`).join('')
      :'<div class="fu-empty">Nessun campo.</div>';
    h+=`</div>`; }
  if(A.excl.inc) h+=`<div class="fu-sub" style="margin-top:8px">${A.excl.inc} campi hanno solo carburante non adatto al motore (Jet A1, diesel…) e non sono in elenco.</div>`;
  h+=`<div class="fu-sub" style="margin-top:8px">${srcLine(fields)}</div>`+editorHtml()+`</div>`;
  return h;
}

function flightHtml(fields,o){
  css(); const F=fromHere(fields,o);
  let h=`<div class="fu">`;
  const row=r=>`<div class="fu-row" data-fid="${esc(r.f.id)}"><div><b>${esc(r.f.name)}</b> <span class="fu-sub">${esc(r.f.short||'')}</span><br>${chips(r)}</div>
    <div class="fu-r"><b>${String(Math.round(r.brg)).padStart(3,'0')}° · ${r.d.toFixed(0)} km</b><br><span class="fu-sub">${fmtMin(r.min)} · ${r.arrL>0?'arrivi con '+r.arrL.toFixed(1)+' L ('+fmtMin(r.minLeft)+')':'non ci arrivi'}</span></div></div>`;
  for(const b of [1,2,3]){ const rs=F['b'+b];
    h+=`<div class="fu-band" style="--c:${BAND[b].c}"><h4>${BAND[b].t}</h4>${rs.length?rs.map(row).join(''):'<div class="fu-empty">Nessun campo.</div>'}</div>`; }
  if(!F.n) h+=`<div class="fu-alert">Nessun campo con carburante adatto in elenco: segna quelli che conosci qui sotto.</div>`;
  h+=`<div class="fu-sub" style="margin-top:8px">Velocità usata: ${Math.round(F.sp)} km/h ${o.gs>50?'(al suolo, dal GPS)':'(di crociera)'} · consumo ${o.burn} L/h · riserva ${o.res} min. ${srcLine(fields)}</div>`+editorHtml()+`</div>`;
  return h;
}

function editorHtml(){
  return `<div class="fu-ed"><b>Segna il carburante su un campo che conosci</b><div class="fu-sub">Resta sul telefono e vale sopra i dati di openAIP. «Nessuno» toglie un campo dall'elenco.</div>
    <input type="text" class="fu-q" list="fuList" placeholder="Campo: nome o sigla" autocomplete="off"><datalist id="fuList"></datalist>
    <div>${['mogas','ul91','avgas','jet'].map(t=>`<label><input type="checkbox" class="fu-t" value="${t}"> ${LBL[t]}</label>`).join('')}<label><input type="checkbox" class="fu-none"> Nessuno</label></div>
    <input type="text" class="fu-n" placeholder="Nota (es. orari, telefono, solo soci)" style="margin-top:8px">
    <div class="fu-act"><button type="button" class="fu-b pri fu-save">Salva</button><button type="button" class="fu-b fu-del">Torna ai dati openAIP</button></div><div class="fu-sub fu-msg"></div></div>`;
}

// collega i tocchi: righe (azioni) ed editor. h={onRow(fid,row,el), onChange()}
function wire(box,fields,h){
  const dl=box.querySelector('#fuList'); if(dl) dl.innerHTML=fields.filter(f=>f.kind!=='glac').slice(0,2500).map(f=>`<option value="${esc(f.name)} · ${esc(f.short)}">`).join('');
  const q=box.querySelector('.fu-q'), msg=box.querySelector('.fu-msg');
  const pick=()=>{ const v=(q.value||'').trim(), sh=v.split(' · ').pop(); return fields.find(f=>f.short===sh||f.name===v||f.id===v||f.name.toLowerCase()===v.toLowerCase()); };
  if(q) q.addEventListener('change',()=>{ const f=pick(); if(!f) return; const cur=at(f,fields);
    box.querySelectorAll('.fu-t').forEach(c=>c.checked=!!(cur&&cur.types.includes(c.value))); box.querySelector('.fu-none').checked=!!(cur&&!cur.types.length);
    box.querySelector('.fu-n').value=(cur&&cur.note)||''; msg.textContent=cur?(cur.src==='tuo'?'Segnato da te.':'Dato openAIP: '+cur.types.map(t=>LBL[t]).join(', ')):'Nessun dato di carburante per questo campo.'; });
  const save=box.querySelector('.fu-save'); if(save) save.onclick=()=>{ const f=pick(); if(!f){ msg.textContent='Scegli un campo dall\'elenco.'; return; }
    const none=box.querySelector('.fu-none').checked, t=none?[]:[...box.querySelectorAll('.fu-t')].filter(c=>c.checked).map(c=>c.value);
    if(!none&&!t.length){ msg.textContent='Scegli almeno un carburante, oppure «Nessuno».'; return; }
    setMine(f.id,t,box.querySelector('.fu-n').value.trim()); h.onChange&&h.onChange(); };
  const del=box.querySelector('.fu-del'); if(del) del.onclick=()=>{ const f=pick(); if(!f){ msg.textContent='Scegli un campo dall\'elenco.'; return; } setMine(f.id,null); h.onChange&&h.onChange(); };
  box.querySelectorAll('.fu-row').forEach(el=>el.addEventListener('click',e=>{ if(e.target.closest('button')) return;
    const open=el.querySelector('.fu-act'); box.querySelectorAll('.fu-row .fu-act').forEach(x=>x.remove()); if(open) return;
    const a=document.createElement('div'); a.className='fu-act'; el.appendChild(a); h.onRow&&h.onRow(el.dataset.fid,el,a); }));
}

// copia aggiornata (ogni notte sul sito dell'app): al massimo una volta al giorno
async function refresh(get){
  const u=ls.get(KEY_UP,null); if(u&&u.t&&Date.now()-u.t<20*3600e3) return false;
  try{ const j=await get(); if(j&&Array.isArray(j.fields)&&j.fields.length>20){ j.t=Date.now(); ls.set(KEY_UP,j); IDX=null; return true; } }catch(e){}
  return false;
}
window.IA517_FUEL={data,index,at,all,compat,band,BAND,LBL,alongRoute,fromHere,planHtml,flightHtml,wire,setMine,mine,refresh,fmtMin,dkm,brg};
})();
