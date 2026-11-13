#!/usr/bin/env node
// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// PREPARA I RIQUADRI DEI PRATI (atterraggio fuori campo) per metterli su GitHub, ramo «prati-dati».
// Per ogni riquadro di 0,1° della zona chiede a Overpass (dati © contributori OpenStreetMap, ODbL) la stessa domanda
// dell'app e scrive lo stesso riquadro che l'app salva sul telefono: la logica è una sola, in www/prati-dati.js.
//   <uscita>/v1/<chiave>.json   il riquadro (per esempio v1/452_78.json)
//   <uscita>/v1/indice.json     versione del formato, data, elenco delle chiavi con la data di preparazione
// L'app (www/atterraggi.js) prende i riquadri da qui; Overpass le resta solo come riserva.
//
// Educato con Overpass: una richiesta alla volta, almeno 2 s di pausa, i tre servizi a turno, riprove con attese sempre
// più lunghe. Se un riquadro non riesce resta il file di prima: non si scrive MAI un riquadro vuoto al posto di un errore.
// Un riquadro davvero senza aree (mare, ghiacciai) è buono: la risposta è intera, solo senza elementi.
//
// Uso (Node 22, nessuna dipendenza):
//   node tools/prati_prepara.js [--uscita CARTELLA] [--zona SUD,OVEST,NORD,EST] [--limite N] [--minuti M]
//                               [--freschi GIORNI] [--rifai] [--pausa MS]
//   --uscita   cartella dove scrivere (di serie «prati-dati»); dentro ci va v1/
//   --zona     zona ridotta, in gradi (di serie la zona ZONA qui sotto)
//   --limite   al massimo N riquadri in questa corsa
//   --minuti   si ferma da solo dopo M minuti (il lavoro su GitHub ha un tempo massimo)
//   --freschi  i riquadri preparati da meno di G giorni si saltano (di serie 6): è la RIPRESA. Si parte sempre da quelli
//              che mancano, poi dai più vecchi, quindi una corsa interrotta riprende da dove era arrivata
//   --rifai    rifà tutto, anche i riquadri freschi
// Esce con 0 se non resta niente da fare, con 10 se restano riquadri (limite o tempo), con 1 se in questa corsa non ne è
// riuscito nessuno (Overpass non raggiungibile). I riquadri non riusciti si riprovano dopo 12 ore, non subito.
'use strict';
const fs=require('fs'), path=require('path');
const PD=require('../www/prati-dati.js');

// ---- zona: Nord-Ovest (prima prova). Per allargare basta cambiare questi quattro numeri ----
const ZONA={sud:44.0,ovest:6.6,nord:46.6,est:9.6};
const PAUSA_MIN=2000;                                            // ms tra due richieste: mai meno
const TENTATIVI=4;                                               // per riquadro, cambiando servizio ogni volta
const ATTESA=90000;                                              // ms di attesa della risposta (la domanda dice 60 s al servizio)
const UA='HORIZON-prati/1.0 (riquadri settimanali; github.com/amicoen-ops/HORIZON)';   // generico: nessun dato personale

function opzioni(av){ const o={uscita:'prati-dati',zona:ZONA,limite:Infinity,minuti:Infinity,freschi:6,rifai:false,pausa:PAUSA_MIN};
  for(let i=0;i<av.length;i++){ const a=av[i], v=()=>{ if(i+1>=av.length) throw new Error('manca il valore di '+a); return av[++i]; };
    if(a==='--uscita') o.uscita=v();
    else if(a==='--zona'){ const z=v().split(',').map(Number); if(z.length!==4||!z.every(isFinite)||z[0]>=z[2]||z[1]>=z[3]) throw new Error('--zona vuole SUD,OVEST,NORD,EST'); o.zona={sud:z[0],ovest:z[1],nord:z[2],est:z[3]}; }
    else if(a==='--limite'){ const n=v(); if(n!=='') { o.limite=Math.floor(+n); if(!(o.limite>0)) throw new Error('--limite vuole un numero maggiore di zero'); } }
    else if(a==='--minuti'){ o.minuti=+v(); if(!(o.minuti>0)) throw new Error('--minuti vuole un numero maggiore di zero'); }
    else if(a==='--freschi'){ o.freschi=+v(); if(!(o.freschi>=0)) throw new Error('--freschi vuole un numero di giorni'); }
    else if(a==='--pausa'){ o.pausa=Math.max(PAUSA_MIN,+v()||0); }
    else if(a==='--rifai') o.rifai=true;
    else throw new Error('opzione sconosciuta: '+a); }
  return o; }
// chiavi dei riquadri che toccano la zona, da sud a nord e da ovest a est
function chiaviZona(z){ const out=[], c=PD.CELLA, a0=Math.floor(z.sud/c+1e-9), a1=Math.ceil(z.nord/c-1e-9)-1, b0=Math.floor(z.ovest/c+1e-9), b1=Math.ceil(z.est/c-1e-9)-1;
  for(let a=a0;a<=a1;a++) for(let b=b0;b<=b1;b++) out.push(a+'_'+b); return out; }
const dormi=ms=>new Promise(r=>setTimeout(r,ms));
function leggiIndice(f){ try{ const j=JSON.parse(fs.readFileSync(f,'utf8')); if(j&&j.v===PD.VERSIONE&&j.riquadri&&typeof j.riquadri==='object') return j; }catch(e){} return {v:PD.VERSIONE,riquadri:{}}; }
function scrivi(f,testo){ const t=f+'.tmp'; fs.writeFileSync(t,testo); fs.renameSync(t,f); }      // mai un file a metà

// una richiesta a un servizio: il riquadro pronto, oppure un errore con il motivo
async function chiedi(url,k,prendi){
  const r=await prendi(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':UA,'Accept':'application/json'},
    body:'data='+encodeURIComponent(PD.domanda(k,true)),signal:AbortSignal.timeout(ATTESA)});      // stessa domanda dell'app (quella «semplice», accettata da tutti i servizi)
  if(!r.ok){ const e=new Error('risposta '+r.status); e.stato=r.status; throw e; }
  const testo=await r.text(); let js; try{ js=JSON.parse(testo); }catch(e){ throw new Error('risposta non leggibile'); }
  if(!PD.rispostaBuona(js)) throw new Error('risposta incompleta'+(js&&js.remark?': '+String(js.remark).slice(0,80):''));   // 200 ma tempo scaduto dentro: NON è un riquadro vuoto
  return {rec:PD.converti(js,k,Date.now()),byte:testo.length,elementi:js.elements.length}; }

async function prepara(o,strumenti){
  const prendi=(strumenti&&strumenti.fetch)||fetch, aspetta=(strumenti&&strumenti.dormi)||dormi, dice=(strumenti&&strumenti.log)||console.log;
  const dir=path.join(o.uscita,'v'+PD.VERSIONE), fInd=path.join(dir,'indice.json'); fs.mkdirSync(dir,{recursive:true});
  const ind=leggiIndice(fInd), ora0=Date.now(), fine=ora0+o.minuti*60000;
  // un riquadro è nell'elenco solo se il suo file c'è davvero
  for(const k of Object.keys(ind.riquadri)) if(!PD.chiaveBuona(k)||!fs.existsSync(path.join(dir,k+'.json'))) delete ind.riquadri[k];
  const eta=k=>{ const d=ind.riquadri[k]; return d?Date.parse(d.t)||0:0; };
  let lista=chiaviZona(o.zona); const tutti=lista.length;
  // quelli non riusciti da meno di 12 ore si lasciano stare: così le corse a pezzi non si fermano sempre sugli stessi
  if(!ind.falliti||typeof ind.falliti!=='object') ind.falliti={};
  if(!o.rifai) lista=lista.filter(k=>ora0-eta(k)>o.freschi*864e5 && ora0-(Date.parse(ind.falliti[k])||0)>12*36e5);
  // prima quelli che mancano, poi i più vecchi; a parità, dal centro della zona verso i bordi (dove si vola di più:
  // i bordi sono mare, Francia e Svizzera, e possono aspettare)
  const cLat=(o.zona.sud+o.zona.nord)/2, cLon=(o.zona.ovest+o.zona.est)/2, cc=Math.cos(cLat*Math.PI/180);
  const lontano=k=>{ const [a,b]=k.split('_').map(Number); return Math.hypot((a+0.5)*PD.CELLA-cLat,((b+0.5)*PD.CELLA-cLon)*cc); };
  const giorno=k=>Math.floor(eta(k)/864e5);                        // l'età conta a giorni: dentro lo stesso giorno decide la distanza
  lista.sort((a,b)=>(giorno(a)-giorno(b))||(lontano(a)-lontano(b)));
  const daFare=lista.length; let fatti=0, falliti=0, giro=0, ultima=0; const riposo=PD.SERVIZI.map(()=>0), errori=PD.SERVIZI.map(()=>0);
  const salva=()=>{ ind.fatto=new Date().toISOString(); ind.zona=o.zona; ind.fonte='© contributori OpenStreetMap (ODbL), via Overpass';
    const r={}; for(const k of Object.keys(ind.riquadri).sort()) r[k]=ind.riquadri[k]; ind.riquadri=r; scrivi(fInd,JSON.stringify(ind)); };
  dice(`Zona ${o.zona.sud}–${o.zona.nord} N, ${o.zona.ovest}–${o.zona.est} E: ${tutti} riquadri, ${daFare} da preparare${isFinite(o.limite)?', al massimo '+o.limite+' in questa corsa':''}.`);
  let i=0;
  for(;i<lista.length;i++){ const k=lista[i];
    if(fatti+falliti>=o.limite||Date.now()>fine) break;
    let rec=null, motivo='';
    for(let t=0;t<TENTATIVI&&!rec;t++){
      // servizio di turno, saltando quelli a riposo (troppi errori di fila)
      let s=-1; for(let j=0;j<PD.SERVIZI.length;j++){ const c=(giro+j)%PD.SERVIZI.length; if(Date.now()>=riposo[c]){ s=c; break; } }
      if(s<0){ s=riposo.indexOf(Math.min(...riposo)); await aspetta(Math.max(0,riposo[s]-Date.now())); }
      giro=s+1;
      const manca=o.pausa-(Date.now()-ultima); if(manca>0) await aspetta(manca);            // una richiesta alla volta, con la pausa
      try{ const r=await chiedi(PD.SERVIZI[s],k,prendi); ultima=Date.now(); errori[s]=0; rec=r; }
      catch(e){ ultima=Date.now(); motivo=(e&&e.name==='TimeoutError')?'tempo scaduto':String(e&&e.message||e); errori[s]++;
        if(errori[s]>=4){ riposo[s]=Date.now()+600000; errori[s]=0; }                       // quel servizio riposa 10 minuti
        // attesa che cresce: 5, 15, 45 s; il doppio se il servizio dice «troppe richieste» o «occupato»
        if(t<TENTATIVI-1) await aspetta(5000*3**t*((e&&(e.stato===429||e.stato===504))?2:1)); } }
    if(rec){
      // ---- QUI si innesterà l'incrocio con le foto satellitari (ESA WorldCover, 10 m): prima di scrivere il riquadro,
      // per ogni area di rec.rec.ok si guarderà la classe di copertura dentro il contorno (erba e coltivi sì; alberi,
      // costruito, acqua no) e si toglieranno o si segneranno le aree che il satellite smentisce. Oggi non si fa.
      const testo=JSON.stringify(rec.rec); scrivi(path.join(dir,k+'.json'),testo);
      ind.riquadri[k]={t:new Date(rec.rec.t).toISOString(),ok:rec.rec.ok.length,no:rec.rec.no.length,li:rec.rec.li.length,kb:Math.round(testo.length/1024)};
      delete ind.falliti[k]; fatti++; dice(`ok  ${k}  ${rec.rec.ok.length} aree adatte, ${rec.rec.no.length} da evitare, ${rec.rec.li.length} linee · ${Math.round(rec.byte/1024)} KB → ${Math.round(testo.length/1024)} KB${rec.elementi?'':' · VUOTO (risposta intera, nessun elemento)'}`);
    } else { ind.falliti[k]=new Date().toISOString(); falliti++; dice(`NO  ${k}  ${motivo} · resta ${ind.riquadri[k]?'il riquadro del '+ind.riquadri[k].t.slice(0,10):'senza riquadro (l\'app userà Overpass)'}`); }
    if((fatti+falliti)%20===0) salva();                            // l'elenco si salva ogni tanto: una corsa interrotta non perde il lavoro
  }
  salva();
  const restano=lista.length-i;
  dice(`Fatti ${fatti}, falliti ${falliti}, restano ${restano} · nell'elenco ${Object.keys(ind.riquadri).length} riquadri su ${tutti} della zona.`);
  return {fatti,falliti,restano,tutti,elenco:Object.keys(ind.riquadri).length}; }

module.exports={ZONA,opzioni,chiaviZona,prepara,chiedi};
if(require.main===module){
  let o; try{ o=opzioni(process.argv.slice(2)); }catch(e){ console.error('Errore: '+e.message); process.exit(2); }
  prepara(o).then(r=>{ process.exit((r.fatti===0&&r.falliti>0)?1:(r.restano>0?10:0)); },e=>{ console.error('Errore: '+(e&&e.message||e)); process.exit(1); });
}
