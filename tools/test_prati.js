#!/usr/bin/env node
// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// Prove dei riquadri dei prati: la conversione comune all'app e a GitHub (www/prati-dati.js) e lo script che li prepara
// (tools/prati_prepara.js), con un Overpass finto. Nessuna rete. Deve uscire con 0.
'use strict';
const fs=require('fs'), os=require('os'), path=require('path');
const PD=require('../www/prati-dati.js'), PP=require('./prati_prepara.js');
let prove=0, rotte=0;
const ok=(c,cosa)=>{ prove++; if(!c){ rotte++; console.log('ROTTA: '+cosa); } };
const uguale=(a,b,cosa)=>ok(JSON.stringify(a)===JSON.stringify(b),cosa+' · atteso '+JSON.stringify(b)+', trovato '+JSON.stringify(a));

// ---- una risposta di Overpass finta, attorno a 45,45 N 7,85 E ----
const LA=45.45, LO=7.85, mLat=1/110540, mLon=1/(111320*Math.cos(LA*Math.PI/180));
// rettangolo chiuso di a × b metri con l'angolo in (x,y) metri dal centro; in più punti a metà lato (la semplificazione li toglie)
const rett=(x,y,a,b)=>[[x,y],[x+a/2,y],[x+a,y],[x+a,y+b],[x,y+b],[x,y]].map(([e,n])=>({lat:LA+n*mLat,lon:LO+e*mLon}));
const via=(id,tags,geometry)=>({type:'way',id,tags,geometry});
const RISPOSTA={version:0.6,elements:[
  via(1,{landuse:'meadow'},rett(0,0,400,200)),                      // prato grande: adatto
  via(2,{landuse:'farmland'},rett(500,0,50,50)),                    // coltivo di 2500 m²: troppo piccolo
  via(3,{landuse:'farmland',crop:'rice'},rett(0,300,400,200)),      // risaia: no
  via(4,{landuse:'forest'},rett(0,600,100,100)),                    // bosco
  via(5,{landuse:'residential'},rett(200,600,100,100)),             // paese
  via(6,{natural:'water'},rett(400,600,100,100)),                   // acqua
  via(7,{aeroway:'airstrip'},rett(0,-300,500,40)),                  // campo di volo sulla mappa
  via(8,{power:'line'},[0,1,2,3,4].map(i=>({lat:LA+0.001*i,lon:LO+0.001*i}))),   // linea elettrica (dritta: restano i due capi)
  via(9,{landuse:'meadow'},rett(0,900,400,200).slice(0,5)),         // contorno non chiuso: si salta
  via(10,{landuse:'forest'},rett(600,600,30,30)),                   // boschetto di 900 m²: troppo piccolo
  via(11,{natural:'grassland'},rett(600,0,300,100)),                // erba naturale: adatta
  via(12,{highway:'track'},rett(0,1200,400,200)),                   // altro: si salta
  via(13,{landuse:'meadow'},[{lat:NaN,lon:LO},{lat:LA,lon:LO}]),    // punti non validi
  {type:'node',id:20,lat:45.4512345,lon:7.8512345,tags:{place:'village',name:'Paese finto'}},
  {type:'node',id:21,lat:45.46,lon:7.86,tags:{place:'locality'}},   // non è un paese
  {type:'relation',id:30,tags:{landuse:'meadow'}}                   // le relazioni non si chiedono
]};

// ---- chiavi, bordi, domanda ----
uguale(PD.chiave(45.4012,7.8312),'454_78','chiave del riquadro');
uguale(PD.chiave(45.4,7.9),'454_79','chiave sul bordo esatto');
uguale(PD.chiave(-0.05,-0.05),'-1_-1','chiave con gradi negativi');
uguale(PD.bordi('454_78'),['45.4','7.8','45.5','7.9'],'bordi sud, ovest, nord, est');
{ const d=PD.domanda('454_78',true);
  ok(d.includes('[bbox:45.4,7.8,45.5,7.9]'),'la domanda porta il riquadro di 0,1°');
  ok(d.includes('[out:json]')&&d.endsWith('out geom qt;'),'la domanda chiede JSON con la geometria');
  ok(!d.includes('length()'),'la domanda semplice non ha il filtro sul perimetro');
  ok(PD.domanda('454_78',false).includes('(if:length()>600)'),'la domanda completa ha il filtro sul perimetro');
  for(const t of ['meadow|farmland|grass','grassland','aerodrome|airstrip','residential|industrial|commercial|retail|forest','wood|water','line|minor_line','city|town|village|hamlet']) ok(d.includes(t),'la domanda chiede '+t); }
uguale(PD.SERVIZI.length,3,'tre servizi Overpass');
ok(PD.SERVIZI.every(u=>/^https:\/\//.test(u)),'servizi solo in https');
ok(PD.PRONTI==='https://raw.githubusercontent.com/amicoen-ops/HORIZON/prati-dati/v1/','indirizzo dei riquadri pronti');
ok(PD.chiaveBuona('454_78')&&PD.chiaveBuona('-1_-12')&&!PD.chiaveBuona('../x')&&!PD.chiaveBuona('454_78.json')&&!PD.chiaveBuona('__proto__'),'chiavi accettate e rifiutate');

// ---- classi ----
uguale(['meadow','farmland','grass'].map(l=>PD.classe({landuse:l})),['m','m','m'],'prati e coltivi');
uguale(PD.classe({natural:'grassland'}),'m','erba naturale');
uguale(PD.classe({landuse:'farmland',crop:'Rice'}),'','risaia scartata');
uguale(['residential','industrial','commercial','retail'].map(l=>PD.classe({landuse:l})),['p','p','p','p'],'paesi e capannoni');
uguale([PD.classe({landuse:'forest'}),PD.classe({natural:'wood'}),PD.classe({natural:'water'})],['b','b','a'],'bosco e acqua');
uguale([PD.classe({aeroway:'aerodrome'}),PD.classe({aeroway:'airstrip'}),PD.classe({aeroway:'runway'})],['v','v',''],'campi di volo');
uguale(PD.classe({landuse:'meadow',natural:'water'}),'a','acqua vince su prato');

// ---- geometria ----
{ const A=PD.areaLL(rett(0,0,400,200).map(p=>[p.lat,p.lon])); ok(Math.abs(A-80000)<80,'area di 400 × 200 m = 80000 m² (trovata '+Math.round(A)+')');
  const S=PD.semplifica(rett(0,0,400,200).map(p=>[p.lat,p.lon]),6); uguale(S.length,5,'la semplificazione toglie il punto a metà lato');
  uguale(PD.semplifica([[1,1],[2,2],[3,3]],6).length,3,'meno di 4 punti: non si tocca');
  uguale(PD.pacco([[45.123456,7.654321]]),[4512346,765432],'coordinate in centomillesimi di grado');
  ok(Math.abs(PD.dPS(0,10,-5,0,5,0)-10)<1e-9&&Math.abs(PD.dPS(10,0,-5,0,5,0)-5)<1e-9,'distanza punto-segmento'); }

// ---- conversione ----
{ const rec=PD.converti(RISPOSTA,'454_78',1234567890);
  uguale([rec.k,rec.t,rec.v],['454_78',1234567890,1],'intestazione del riquadro');
  uguale(Object.keys(rec),['k','t','v','ok','no','li','pl'],'campi del riquadro, nell\'ordine di sempre');
  uguale(rec.ok.map(o=>[o[0],o[1]]),[[1,0],[7,1],[11,0]],'aree adatte: prato, campo di volo (1), erba');
  uguale(rec.no.map(o=>[o[0],o[1]]),[[4,'b'],[5,'p'],[6,'a']],'aree da evitare: bosco, paese, acqua');
  uguale(rec.li.map(o=>[o[0],o[1].length]),[[8,4]],'linea elettrica semplificata a due punti');
  uguale(rec.pl,[[4545123,785123,'village']],'nome del paese');
  uguale(rec.ok[0][2].length,10,'il prato ha 5 punti (chiuso), cioè 10 numeri');
  uguale(rec.ok[0][2].slice(0,2),[4545000,785000],'primo punto del prato');
  uguale(rec.ok[0][2].slice(0,2),rec.ok[0][2].slice(-2),'contorno chiuso: primo punto = ultimo');
  ok(PD.riquadroBuono(rec,'454_78'),'il riquadro convertito è valido');
  ok(!PD.riquadroBuono(rec,'454_79'),'riquadro con la chiave di un altro: rifiutato');
  // lo stesso risultato un elemento alla volta, come fa l'app
  const r2=PD.nuovo('454_78',1234567890); for(const el of RISPOSTA.elements) PD.aggiungi(r2,el,PD.AREA_MIN); uguale(r2,rec,'un elemento alla volta = tutto insieme');
  // soglia dell'area: con una soglia più alta il prato da 30000 m² (erba 300 × 100) esce
  uguale(PD.converti(RISPOSTA,'454_78',1,40000).ok.map(o=>o[0]),[1],'soglia dell\'area passata da fuori'); }
{ const v=PD.converti({elements:[]},'440_66',5); uguale([v.ok.length,v.no.length,v.li.length,v.pl.length],[0,0,0,0],'risposta senza elementi: riquadro vuoto'); ok(PD.riquadroBuono(v,'440_66'),'il riquadro vuoto è valido');
  uguale(PD.converti(null,'440_66',5).ok.length,0,'risposta nulla: nessun errore'); }

// ---- risposta intera o no ----
ok(PD.rispostaBuona({elements:[]}),'risposta intera senza elementi: buona (zona davvero vuota)');
ok(PD.rispostaBuona(RISPOSTA),'risposta normale: buona');
ok(!PD.rispostaBuona({elements:[],remark:'runtime error: Query timed out in "query" at line 1 after 61 seconds.'}),'tempo scaduto dentro la risposta: NON buona');
ok(!PD.rispostaBuona({elements:RISPOSTA.elements,remark:'runtime error: Query run out of memory using about 2048 MB of RAM.'}),'memoria finita: NON buona');
ok(!PD.rispostaBuona({})&&!PD.rispostaBuona(null)&&!PD.rispostaBuona('x')&&!PD.rispostaBuona({elements:'no'}),'risposte senza elenco: NON buone');

// ---- riquadro arrivato da fuori ----
{ const b=()=>PD.converti(RISPOSTA,'454_78',10);
  let r=b(); r.v=2; ok(!PD.riquadroBuono(r,'454_78'),'versione diversa: rifiutato');
  r=b(); delete r.li; ok(!PD.riquadroBuono(r,'454_78'),'manca un elenco: rifiutato');
  r=b(); r.ok[0][2].push(1); ok(!PD.riquadroBuono(r,'454_78'),'coordinate dispari: rifiutato');
  r=b(); r.ok[0][2][0]='x'; ok(!PD.riquadroBuono(r,'454_78'),'coordinata non numerica: rifiutato');
  r=b(); r.no[0][1]='z'; ok(!PD.riquadroBuono(r,'454_78'),'classe sconosciuta: rifiutato');
  ok(!PD.riquadroBuono(null,'454_78')&&!PD.riquadroBuono([], '454_78'),'non è un riquadro: rifiutato'); }

// ---- l'app usa la stessa logica, senza una copia sua ----
{ const a=fs.readFileSync(path.join(__dirname,'../www/atterraggi.js'),'utf8');
  ok(/window\.PRATI_DATI/.test(a)&&/PD\.aggiungi\(/.test(a)&&/PD\.domanda/.test(a)&&/PD\.SERVIZI/.test(a),'atterraggi.js usa prati-dati.js');
  ok(!/function classe\(|function semplifica\(|function areaLL\(|overpass-api\.de/.test(a),'atterraggi.js non ha una copia della conversione');
  const i=fs.readFileSync(path.join(__dirname,'../www/index.html'),'utf8'), p1=i.indexOf('<script src="prati-dati.js">'), p2=i.indexOf('<script src="atterraggi.js">');
  ok(p1>0&&p2>p1,'index.html carica prati-dati.js prima di atterraggi.js');
  for(const [f,t] of [['../www/sw.js',"'prati-dati.js'"],['prepare_www.py','"prati-dati.js"'],['../.github/workflows/pubblica-web.yml','www/prati-dati.js']]) ok(fs.readFileSync(path.join(__dirname,f),'utf8').includes(t),f+' elenca prati-dati.js'); }

// ---- zona e opzioni dello script ----
uguale(PP.chiaviZona(PP.ZONA).length,26*30,'Nord-Ovest: 26 × 30 riquadri');
uguale(PP.chiaviZona({sud:45.4,ovest:7.8,nord:45.5,est:8.0}),['454_78','454_79'],'zona ridotta di due riquadri');
uguale(PP.chiaviZona({sud:45.43,ovest:7.83,nord:45.44,est:7.84}),['454_78'],'zona dentro un riquadro solo');
{ const o=PP.opzioni(['--uscita','x','--zona','45,7,46,8','--limite','5','--minuti','10','--freschi','0','--rifai','--pausa','100']);
  uguale([o.uscita,o.zona,o.limite,o.minuti,o.freschi,o.rifai,o.pausa],['x',{sud:45,ovest:7,nord:46,est:8},5,10,0,true,2000],'opzioni lette (la pausa non scende sotto 2 s)');
  uguale(PP.opzioni(['--limite','']).limite,null,'limite vuoto = nessun limite');     // Infinity in JSON è null
  let e=0; for(const av of [['--boh'],['--zona','1,2,3'],['--zona','46,7,45,8'],['--limite','0'],['--uscita']]) try{ PP.opzioni(av); }catch(x){ e++; } uguale(e,5,'opzioni sbagliate: errore'); }

// ---- lo script con un Overpass finto ----
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'prati-')), v1=path.join(dir,'v1'), leggi=f=>JSON.parse(fs.readFileSync(path.join(v1,f),'utf8'));
  const base={uscita:dir,zona:{sud:45.4,ovest:7.8,nord:45.5,est:8.2},limite:Infinity,minuti:Infinity,freschi:6,rifai:false,pausa:2000};   // 4 riquadri: 454_78 … 454_81
  let chiamate=[], attese=[], orologio=0, insieme=0, maxInsieme=0;
  const dormi=async ms=>{ attese.push(ms); orologio+=ms; };
  const vero=Date.now; Date.now=()=>vero()+orologio;               // le pause finte fanno passare il tempo
  const risp=(stato,corpo)=>({ok:stato===200,status:stato,text:async()=>typeof corpo==='string'?corpo:JSON.stringify(corpo)});
  const finto=come=>async(url,opz)=>{ insieme++; maxInsieme=Math.max(maxInsieme,insieme); await new Promise(r=>setImmediate(r));
    const q=decodeURIComponent(opz.body.slice(5)), m=/\[bbox:([\d.]+),([\d.]+),/.exec(q), k=PD.chiave(+m[1]+0.05,+m[2]+0.05); chiamate.push({url,k,ua:opz.headers['User-Agent'],t:Date.now()}); insieme--;
    const r=come(k,url); if(r instanceof Error) throw r; return r; };
  const zitto={dormi,log:()=>{}};
  // prima corsa: uno buono, uno vuoto ma intero, uno con «tempo scaduto» dentro, uno con 504 da tutti
  let r=await PP.prepara(base,Object.assign({fetch:finto(k=>k==='454_78'?risp(200,RISPOSTA):k==='454_79'?risp(200,{elements:[]}):k==='454_80'?risp(200,{elements:[],remark:'runtime error: Query timed out'}):risp(504,'Gateway Timeout'))},zitto));
  uguale([r.fatti,r.falliti,r.restano,r.elenco,r.tutti],[2,2,0,2,4],'prima corsa: due fatti, due falliti');
  let ind=leggi('indice.json');
  uguale(Object.keys(ind.riquadri),['454_78','454_79'],'nell\'elenco solo i riquadri riusciti');
  uguale([ind.v,typeof ind.fatto,ind.riquadri['454_78'].ok,ind.riquadri['454_79'].ok],[1,'string',3,0],'elenco: versione, data, conteggi');
  ok(!isNaN(Date.parse(ind.riquadri['454_78'].t)),'elenco: data di preparazione di ogni riquadro');
  uguale(leggi('454_78.json').ok.map(o=>o[0]),[1,7,11],'il file del riquadro è quello dell\'app');
  ok(PD.riquadroBuono(leggi('454_78.json'),'454_78')&&PD.riquadroBuono(leggi('454_79.json'),'454_79'),'i file scritti passano il controllo dell\'app');
  uguale(leggi('454_79.json').ok.length,0,'riquadro davvero vuoto: scritto, ed è nell\'elenco');
  ok(!fs.existsSync(path.join(v1,'454_80.json'))&&!fs.existsSync(path.join(v1,'454_81.json')),'un errore non scrive nessun file (mai un riquadro vuoto al posto di un errore)');
  uguale(Object.keys(ind.falliti).sort(),['454_80','454_81'],'i non riusciti sono annotati');
  uguale(chiamate.filter(c=>c.k==='454_81').length,4,'quattro tentativi per un riquadro che non riesce');
  uguale(new Set(chiamate.filter(c=>c.k==='454_81').map(c=>c.url)).size,3,'i tentativi girano sui tre servizi');
  uguale(maxInsieme,1,'una richiesta alla volta');
  ok(chiamate.every((c,i)=>i===0||c.t-chiamate[i-1].t>=2000),'almeno 2 s tra due richieste');
  ok(chiamate.every(c=>/^HORIZON-prati\//.test(c.ua)&&!/@/.test(c.ua)),'User-Agent generico, senza indirizzi');
  ok(attese.includes(5000)&&attese.includes(15000)&&attese.includes(45000)&&attese.includes(10000),'attese che crescono, doppie con 504');
  ok(!fs.readdirSync(v1).some(f=>f.endsWith('.tmp')),'nessun file a metà');
  // seconda corsa subito dopo: niente da fare (freschi e falliti da poco)
  chiamate=[]; r=await PP.prepara(base,Object.assign({fetch:finto(()=>risp(200,RISPOSTA))},zitto));
  uguale([r.fatti,r.falliti,chiamate.length],[0,0,0],'ripresa: i riquadri freschi e quelli appena falliti si saltano');
  // 13 ore dopo: si riprovano solo i due mancanti; uno riesce
  orologio+=13*36e5; chiamate=[]; r=await PP.prepara(base,Object.assign({fetch:finto(k=>k==='454_80'?risp(200,RISPOSTA):new Error('fetch failed'))},zitto));
  uguale([r.fatti,r.falliti,[...new Set(chiamate.map(c=>c.k))].sort()],[1,1,['454_80','454_81']],'dopo 12 ore si riprovano solo quelli che mancano');
  uguale(Object.keys(leggi('indice.json').falliti),['454_81'],'un riquadro riuscito esce dall\'elenco dei falliti');
  // 8 giorni dopo, con Overpass rotto: restano i riquadri vecchi, identici
  orologio+=8*864e5; const prima=fs.readFileSync(path.join(v1,'454_78.json'),'utf8'), dataPrima=leggi('indice.json').riquadri['454_78'].t;
  r=await PP.prepara(Object.assign({},base,{limite:2}),Object.assign({fetch:finto(()=>risp(200,{elements:[],remark:'runtime error: Query timed out'}))},zitto));
  uguale([r.fatti,r.falliti,r.restano],[0,2,2],'limite di due riquadri rispettato, gli altri restano');
  uguale(fs.readFileSync(path.join(v1,'454_78.json'),'utf8'),prima,'riquadro non riuscito: resta il file vecchio, identico');
  uguale(leggi('indice.json').riquadri['454_78'].t,dataPrima,'e resta la sua data vecchia nell\'elenco');
  // --rifai rifà tutto; i più vecchi per primi
  chiamate=[]; r=await PP.prepara(Object.assign({},base,{rifai:true}),Object.assign({fetch:finto(()=>risp(200,RISPOSTA))},zitto));
  uguale([r.fatti,r.falliti,r.elenco],[4,0,4],'--rifai: tutti e quattro');
  uguale(chiamate[0].k,'454_81','si parte dal riquadro che manca');
  ok(Date.parse(leggi('indice.json').riquadri['454_78'].t)>Date.parse(dataPrima),'riquadro rifatto: data nuova');
  // tempo massimo: con --minuti la corsa si ferma da sola
  orologio+=8*864e5; r=await PP.prepara(Object.assign({},base,{minuti:0.05}),Object.assign({fetch:finto(()=>risp(200,RISPOSTA))},zitto));
  ok(r.fatti>=1&&r.restano>=1&&r.fatti+r.restano===4,'--minuti: si ferma e dice quanti restano ('+r.fatti+' fatti, '+r.restano+' restano)');
  // un file dell'elenco sparito dalla cartella non resta nell'elenco
  fs.unlinkSync(path.join(v1,'454_79.json')); orologio+=1000; r=await PP.prepara(Object.assign({},base,{limite:1,freschi:9999}),Object.assign({fetch:finto(()=>risp(200,RISPOSTA))},zitto));
  ok(fs.existsSync(path.join(v1,'454_79.json')),'un riquadro dell\'elenco senza file viene rifatto per primo');
  Date.now=vero; fs.rmSync(dir,{recursive:true,force:true});
  console.log(rotte?`PROVE DEI PRATI: ${rotte} ROTTE su ${prove}`:`Prove dei prati: ${prove} su ${prove} passate`);
  process.exit(rotte?1:0);
})().catch(e=>{ console.log('ERRORE nelle prove: '+(e&&e.stack||e)); process.exit(1); });
