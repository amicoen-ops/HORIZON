#!/usr/bin/env node
// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// CONTROLLO DELLE QUOTE DEI CAMPI CONTRO IL TERRENO. Per ogni campo dell'elenco dell'app (FIELDS_RAW di www/index.html)
// misura la quota del rilievo con lo stesso metodo dell'app (phFieldDem: mediana del centro più 8 punti a 150 m, riquadro
// fine z12 del rilievo Terrarium) e la confronta con la quota scritta nell'elenco. NON corregge niente: scrive un elenco
// da guardare a mano, perché a sbagliare può essere l'elenco oppure il rilievo (crinali, valli strette, piste su terrapieno).
//   node tools/quote_campi.js [--soglia METRI] [--uscita FILE.md] [--limite N]
// Esce con 0 anche se trova scarti: è un rapporto, non una prova che blocca.
// Nessuna dipendenza: il PNG del rilievo si decodifica qui (zlib di Node). Il rilievo è dati aperti (Mapzen/AWS Terrain Tiles).
'use strict';
const fs=require('fs'), path=require('path'), zlib=require('zlib');
const D2R=Math.PI/180, FT=0.3048;
const URLB='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/';

// PNG a 8 bit, RGB o RGBA, non interlacciato → {w,h,canali,dati}
function png(buf){
  if(buf.length<33||buf.readUInt32BE(0)!==0x89504e47) throw new Error('non è un PNG');
  let p=8, w=0, h=0, tipo=0, prof=0, inter=0; const idat=[];
  while(p+8<=buf.length){ const n=buf.readUInt32BE(p), t=buf.toString('latin1',p+4,p+8), d=buf.subarray(p+8,p+8+n);
    if(t==='IHDR'){ w=d.readUInt32BE(0); h=d.readUInt32BE(4); prof=d[8]; tipo=d[9]; inter=d[12]; } else if(t==='IDAT') idat.push(d); else if(t==='IEND') break; p+=12+n; }
  if(prof!==8||(tipo!==2&&tipo!==6)||inter) throw new Error('PNG di un tipo non previsto');
  const c=tipo===2?3:4, riga=w*c, raw=zlib.inflateSync(Buffer.concat(idat)), out=Buffer.alloc(h*riga);
  for(let y=0;y<h;y++){ const f=raw[y*(riga+1)], s=y*(riga+1)+1, o=y*riga;
    for(let x=0;x<riga;x++){ const a=x>=c?out[o+x-c]:0, b=y?out[o-riga+x]:0, cc=(x>=c&&y)?out[o-riga+x-c]:0; let v=raw[s+x];
      if(f===1) v+=a; else if(f===2) v+=b; else if(f===3) v+=(a+b)>>1; else if(f===4){ const pp=a+b-cc, pa=Math.abs(pp-a), pb=Math.abs(pp-b), pc=Math.abs(pp-cc); v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?b:cc); }
      out[o+x]=v&255; } }
  return {w,h,canali:c,dati:out}; }
const quotaPx=(t,i,j)=>{ const o=(j*t.w+i)*t.canali; return t.dati[o]*256+t.dati[o+1]+t.dati[o+2]/256-32768; };
// quota del rilievo in un punto (bilineare), come phDemExact dell'app
function quotaIn(t,fx,fy){ let px=fx*256-0.5, py=fy*256-0.5; px=Math.max(0,Math.min(254.999,px)); py=Math.max(0,Math.min(254.999,py));
  const i=px|0, j=py|0, u=px-i, v=py-j; return (quotaPx(t,i,j)*(1-u)+quotaPx(t,i+1,j)*u)*(1-v)+(quotaPx(t,i,j+1)*(1-u)+quotaPx(t,i+1,j+1)*u)*v; }
const riq=(lat,lon,z)=>{ const n=2**z, fx=(lon+180)/360*n, lr=lat*D2R, fy=(1-Math.log(Math.tan(lr)+1/Math.cos(lr))/Math.PI)/2*n; return {x:Math.floor(fx),y:Math.floor(fy),fx:fx-Math.floor(fx),fy:fy-Math.floor(fy)}; };
// i 9 punti del campo (centro + 8 a 150 m), come phFieldDem
function punti(lat,lon){ const cl=Math.cos(lat*D2R), P=[]; for(let k=0;k<9;k++){ const r=k?150:0, an=k*Math.PI/4; P.push([lat+r*Math.cos(an)/110540,lon+r*Math.sin(an)/(111320*cl)]); } return P; }
const mediana=a=>{ const b=a.slice().sort((x,y)=>x-y); return b[b.length>>1]; };

// l'elenco dei campi dell'app: [sigla, breve, nome, lat, lon, quota in piedi o null, piste, tipo]
function campi(file){ const s=fs.readFileSync(file,'utf8'), i=s.indexOf('const FIELDS_RAW='); if(i<0) throw new Error('FIELDS_RAW non trovato');
  const a=s.indexOf('[',i), b=s.indexOf('\n',a); let t=s.slice(a,b).trim().replace(/;\s*$/,''); return JSON.parse(t); }

async function controlla(o,strumenti){
  const prendi=(strumenti&&strumenti.fetch)||fetch, dice=(strumenti&&strumenti.log)||console.log;
  let L=(strumenti&&strumenti.campi)||campi(path.join(__dirname,'../www/index.html')); if(isFinite(o.limite)) L=L.slice(0,o.limite);
  const mem=new Map(), Z=12;
  const tessera=async(x,y)=>{ const k=x+'/'+y; if(mem.has(k)) return mem.get(k);
    const p=(async()=>{ for(let t=0;t<3;t++){ try{ const r=await prendi(`${URLB}${Z}/${x}/${y}.png`,{signal:AbortSignal.timeout(30000)}); if(r.status===404) return null; if(!r.ok) throw new Error('risposta '+r.status);
          return png(Buffer.from(await r.arrayBuffer())); }catch(e){ if(t===2) return null; await new Promise(r=>setTimeout(r,1500*(t+1))); } } return null; })();
    mem.set(k,p); if(mem.size>400){ mem.delete(mem.keys().next().value); } return p; };
  const R=[]; let senzaRilievo=0, i=0;
  // a gruppi di 12 campi insieme: le tessere sono piccole e il servizio regge
  const uno=async f=>{ const [sig,breve,nome,lat,lon,ft]=f; const v=[];
    for(const [la,lo] of punti(lat,lon)){ const q=riq(la,lo,Z), t=await tessera(q.x,q.y); if(t) v.push(Math.max(0,quotaIn(t,q.fx,q.fy))); }
    if(v.length<7){ senzaRilievo++; return; }
    const dem=mediana(v), el=ft==null?null:ft*FT; R.push({sig,nome:nome||breve,lat,lon,ft,dem,diff:el==null?null:el-dem,giro:Math.max(...v)-Math.min(...v)}); };
  for(;i<L.length;i+=12){ await Promise.all(L.slice(i,i+12).map(uno)); if(i%240===0) dice(`  ${Math.min(i+12,L.length)} di ${L.length}…`); }
  const con=R.filter(r=>r.diff!=null), fuori=con.filter(r=>Math.abs(r.diff)>o.soglia).sort((a,b)=>Math.abs(b.diff)-Math.abs(a.diff)), senzaQuota=R.filter(r=>r.diff==null);
  const ass=con.map(r=>Math.abs(r.diff)).sort((a,b)=>a-b), pc=q=>ass.length?ass[Math.min(ass.length-1,Math.floor(ass.length*q))]:NaN;
  return {tutti:L.length,misurati:R.length,senzaRilievo,con:con.length,senzaQuota,fuori,mediana:pc(0.5),p90:pc(0.9),soglia:o.soglia}; }

function rapporto(r){
  const m=v=>Math.round(v), f=v=>Math.round(v/FT), link=x=>`https://www.openstreetmap.org/?mlat=${x.lat.toFixed(5)}&mlon=${x.lon.toFixed(5)}#map=15/${x.lat.toFixed(5)}/${x.lon.toFixed(5)}`;
  let t=`# Quote dei campi contro il terreno\n\nFatto il ${new Date().toISOString().slice(0,10)} da tools/quote_campi.js. Non corregge niente: è un elenco da guardare a mano.\n\n`+
    `- Campi nell'elenco: **${r.tutti}** · misurati sul rilievo: **${r.misurati}** · senza rilievo: ${r.senzaRilievo}\n- Con la quota nell'elenco: ${r.con} · scarto tipico (mediana) **${m(r.mediana)} m**, il 90% entro **${m(r.p90)} m**\n`+
    `- Oltre ${r.soglia} m di scarto: **${r.fuori.length}**\n- Senza quota nell'elenco: **${r.senzaQuota.length}** (qui sotto la quota del rilievo, da usare come proposta)\n\n`+
    `## Oltre ${r.soglia} m di scarto\n\n«Dislivello attorno» è la differenza tra il punto più alto e il più basso dei 9 misurati: se è grande il campo è in pendenza o su un crinale, e il rilievo è meno affidabile.\n\n`+
    `| Sigla | Campo | Elenco | Rilievo | Scarto | Dislivello attorno | Mappa |\n|---|---|---|---|---|---|---|\n`+
    r.fuori.map(x=>`| ${x.sig} | ${String(x.nome).replace(/\|/g,'/')} | ${x.ft} ft (${m(x.ft*FT)} m) | ${f(x.dem)} ft (${m(x.dem)} m) | ${x.diff>0?'+':''}${m(x.diff)} m | ${m(x.giro)} m | [mappa](${link(x)}) |`).join('\n')+
    `\n\n## Senza quota nell'elenco\n\n| Sigla | Campo | Rilievo | Dislivello attorno | Mappa |\n|---|---|---|---|---|\n`+
    r.senzaQuota.map(x=>`| ${x.sig} | ${String(x.nome).replace(/\|/g,'/')} | ${f(x.dem)} ft (${m(x.dem)} m) | ${m(x.giro)} m | [mappa](${link(x)}) |`).join('\n')+'\n';
  return t; }

module.exports={png,quotaIn,riq,punti,campi,controlla,rapporto};
if(require.main===module){
  const av=process.argv.slice(2), o={soglia:50,uscita:'',limite:Infinity};
  for(let i=0;i<av.length;i++){ if(av[i]==='--soglia') o.soglia=+av[++i]; else if(av[i]==='--uscita') o.uscita=av[++i]; else if(av[i]==='--limite') o.limite=+av[++i]; else { console.error('opzione sconosciuta: '+av[i]); process.exit(2); } }
  if(!(o.soglia>0)){ console.error('--soglia vuole un numero di metri'); process.exit(2); }
  controlla(o).then(r=>{ const t=rapporto(r); if(o.uscita) fs.writeFileSync(o.uscita,t);
    console.log(`Campi ${r.tutti} · misurati ${r.misurati} · senza rilievo ${r.senzaRilievo} · scarto tipico ${Math.round(r.mediana)} m, 90% entro ${Math.round(r.p90)} m · oltre ${r.soglia} m: ${r.fuori.length} · senza quota: ${r.senzaQuota.length}`);
    for(const x of r.fuori.slice(0,60)) console.log(`  ${x.sig.padEnd(8)} ${String(x.nome).slice(0,34).padEnd(34)} elenco ${String(Math.round(x.ft*FT)).padStart(5)} m · rilievo ${String(Math.round(x.dem)).padStart(5)} m · scarto ${(x.diff>0?'+':'')+Math.round(x.diff)} m · attorno ${Math.round(x.giro)} m`);
    if(r.misurati===0){ console.error('Nessun campo misurato: il rilievo non è raggiungibile.'); process.exit(1); } },e=>{ console.error('Errore: '+(e&&e.stack||e)); process.exit(1); });
}
