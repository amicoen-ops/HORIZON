#!/usr/bin/env node
// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// RITAGLIO DELLA COPERTURA DEL SUOLO SOPRA UN RIQUADRO DEI PRATI, per l'incrocio con il satellite (PD.incrocia).
// Fonte: ESA WorldCover 10 m 2021 v200 (© ESA WorldCover project 2021 / contiene dati Copernicus Sentinel modificati (2021),
// licenza CC BY 4.0), archivio pubblico a mattonelle di 3°×3°. Non sono foto: è una mappa già classificata (erba, coltivi,
// alberi, costruito, acqua…), ricavata dalle immagini dei satelliti Sentinel. Le foto aeree di Google non si possono
// usare: le sue condizioni vietano lo scarico e l'analisi automatica.
// Si legge solo il pezzo che serve (0,1° ≈ 1200×1200 punti) con GDAL, che sa chiedere al server solo quei byte:
//   gdal_translate -of ENVI -projwin OVEST NORD EST SUD /vsicurl/<mattonella> <file>
// Serve quindi «gdal-bin» (sul lavoro di GitHub lo installa il workflow). Nessun'altra dipendenza.
//   node tools/prati_satellite.js 452_78        prova a mano: stampa quanti punti per classe
'use strict';
const fs=require('fs'), os=require('os'), path=require('path'), {execFile}=require('child_process');
const PD=require('../www/prati-dati.js');
const BASE='https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/';
// mattonella che contiene il riquadro: angolo sud-ovest a multipli di 3°
function mattonella(k){ const [s,w]=PD.bordi(k).map(Number), la=Math.floor((s+1e-6)/3)*3, lo=Math.floor((w+1e-6)/3)*3;
  const p=(v,n)=>String(Math.abs(v)).padStart(n,'0'); return `ESA_WorldCover_10m_2021_v200_${la<0?'S':'N'}${p(la,2)}${lo<0?'W':'E'}${p(lo,3)}_Map.tif`; }
const esegui=(cmd,arg,ms)=>new Promise((ok,ko)=>execFile(cmd,arg,{timeout:ms,maxBuffer:1<<20},(e,so,se)=>e?ko(new Error(String(se||e.message).trim().split('\n').pop().slice(0,160))):ok(so)));
// il ritaglio di un riquadro: {ovest,nord,passo,w,h,d}. origine = da dove leggere (di serie l'archivio ESA; nelle prove un file)
async function raster(k,origine){
  if(!PD.chiaveBuona(k)) throw new Error('chiave non valida');
  const [s,w,n,e]=PD.bordi(k), src=origine||('/vsicurl/'+BASE+mattonella(k));
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'prati-sat-')), f=path.join(tmp,'r.bin');
  try{
    await esegui('gdal_translate',['-q','-of','ENVI','-ot','Byte','-projwin',w,n,e,s,'--config','CPL_VSIL_CURL_ALLOWED_EXTENSIONS','.tif','--config','GDAL_HTTP_MAX_RETRY','3','--config','GDAL_HTTP_RETRY_DELAY','5',src,f],180000);
    const hdr=fs.readFileSync(path.join(tmp,'r.hdr'),'utf8'), num=r=>{ const m=r.exec(hdr); return m?+m[1]:NaN; };
    const W=num(/samples\s*=\s*(\d+)/i), H=num(/lines\s*=\s*(\d+)/i), d=new Uint8Array(fs.readFileSync(f));
    if(!(W>0)||!(H>0)||d.length!==W*H) throw new Error('ritaglio non leggibile');
    // angolo e passo veri del ritaglio (GDAL lo allinea ai punti della mattonella): dalla riga «map info» dell'intestazione
    const mi=/map info\s*=\s*\{([^}]*)\}/i.exec(hdr); let ovest=+w, nord=+n, passo=(+e-+w)/W;
    if(mi){ const a=mi[1].split(',').map(x=>x.trim()); if(isFinite(+a[3])&&isFinite(+a[4])&&+a[5]>0){ ovest=+a[3]; nord=+a[4]; passo=+a[5]; } }
    return {ovest,nord,passo,w:W,h:H,d};
  } finally { try{ fs.rmSync(tmp,{recursive:true,force:true}); }catch(e){} }
}
module.exports={BASE,mattonella,raster};
if(require.main===module){
  const k=process.argv[2]; if(!k){ console.error('Uso: node tools/prati_satellite.js CHIAVE [FILE]'); process.exit(2); }
  raster(k,process.argv[3]).then(R=>{ const c={}; for(const v of R.d) c[v]=(c[v]||0)+1;
    console.log(`${k}: ${R.w}×${R.h} punti, angolo ${R.nord.toFixed(5)} N ${R.ovest.toFixed(5)} E, passo ${(R.passo*111320).toFixed(1)} m in latitudine · classi: ${Object.keys(c).sort((a,b)=>a-b).map(x=>x+'='+c[x]).join(' ')}`); },
    e=>{ console.error('Errore: '+(e&&e.message||e)); process.exit(1); });
}
