#!/usr/bin/env node
// HORIZON · © 2026 Enrico D'Amico. Prove di tools/quote_campi.js con un rilievo finto (PNG fatto qui).
'use strict';
const zlib=require('zlib'), Q=require('./quote_campi.js');
let prove=0, rotte=0; const ok=(c,n)=>{ prove++; if(!c){ rotte++; console.log('ROTTA: '+n); } };
// un PNG Terrarium 256×256 con la quota data da una funzione (filtri delle righe a rotazione, per provarli tutti)
const crc=(()=>{ const T=[]; for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c=c&1?0xedb88320^(c>>>1):c>>>1; T[n]=c>>>0; } return b=>{ let c=0xffffffff; for(const v of b) c=T[(c^v)&255]^(c>>>8); return (c^0xffffffff)>>>0; }; })();
function fai(quota,alfa){ const w=256,h=256,c=alfa?4:3, px=Buffer.alloc(w*h*c);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const v=quota(x,y)+32768, o=(y*w+x)*c; px[o]=Math.floor(v/256); px[o+1]=Math.floor(v)%256; px[o+2]=Math.floor((v%1)*256); if(alfa) px[o+3]=255; }
  const raw=Buffer.alloc(h*(w*c+1));
  for(let y=0;y<h;y++){ const f=y%5, s=y*(w*c+1); raw[s]=f;
    for(let i=0;i<w*c;i++){ const a=i>=c?px[y*w*c+i-c]:0, b=y?px[(y-1)*w*c+i]:0, cc=(i>=c&&y)?px[(y-1)*w*c+i-c]:0; let p=0;
      if(f===1) p=a; else if(f===2) p=b; else if(f===3) p=(a+b)>>1; else if(f===4){ const pp=a+b-cc, pa=Math.abs(pp-a), pb=Math.abs(pp-b), pc=Math.abs(pp-cc); p=(pa<=pb&&pa<=pc)?a:(pb<=pc?b:cc); }
      raw[s+1+i]=(px[y*w*c+i]-p)&255; } }
  const pezzo=(t,d)=>{ const b=Buffer.alloc(12+d.length); b.writeUInt32BE(d.length,0); b.write(t,4,'latin1'); d.copy(b,8); b.writeUInt32BE(crc(b.subarray(4,8+d.length)),8+d.length); return b; };
  const ih=Buffer.alloc(13); ih.writeUInt32BE(w,0); ih.writeUInt32BE(h,4); ih[8]=8; ih[9]=alfa?6:2;
  return Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),pezzo('IHDR',ih),pezzo('IDAT',zlib.deflateSync(raw)),pezzo('IEND',Buffer.alloc(0))]); }
(async()=>{
  for(const alfa of [false,true]){ const t=Q.png(fai((x,y)=>100+x*2+y*0.5,alfa));
    ok(t.w===256&&t.canali===(alfa?4:3),'PNG letto ('+(alfa?'con':'senza')+' trasparenza)');
    ok(Math.abs(Q.quotaIn(t,10.5/256,20.5/256)-(100+20+10))<0.02,'quota in un punto del rilievo'); ok(Math.abs(Q.quotaIn(t,100/256,40/256)-(100+199+19.75))<0.02,'quota tra quattro punti (bilineare)'); }
  let e=0; try{ Q.png(Buffer.from('non sono un png, proprio no, per niente')); }catch(x){ e++; } ok(e===1,'file che non è un PNG: errore');
  ok(Q.punti(45.3,7.9).length===9,'9 punti per campo');
  // rilievo finto piatto a 300 m ovunque, tranne un campo senza rilievo (404)
  const piatto=fai(()=>300,false); let chieste=0;
  const prendi=async u=>{ chieste++; const m=/\/12\/(\d+)\/(\d+)\.png/.exec(u), q=Q.riq(70,20,12); if(+m[1]===q.x&&+m[2]===q.y) return {status:404,ok:false};
    return {status:200,ok:true,arrayBuffer:async()=>piatto.buffer.slice(piatto.byteOffset,piatto.byteOffset+piatto.length)}; };
  const L=[['A','A','Giusto',45.3,7.9,984,[],'ulm'],['B','B','Sbagliato',45.4,7.8,3281,[],'ulm'],['C','C','Senza quota',45.5,7.7,null,[],'ulm'],['D','D','Senza rilievo',70,20,100,[],'ulm'],['E','E','Poco sotto',45.6,7.6,850,[],'ulm']];
  const r=await Q.controlla({soglia:50,limite:Infinity},{fetch:prendi,campi:L,log:()=>{}});
  ok(r.tutti===5&&r.misurati===4&&r.senzaRilievo===1,'conteggi: 5 campi, 4 misurati, 1 senza rilievo');
  ok(r.fuori.length===1&&r.fuori[0].sig==='B'&&Math.abs(r.fuori[0].diff-700)<1,'il campo a 1000 m su rilievo a 300 m è fuori di +700 m');
  ok(r.senzaQuota.length===1&&r.senzaQuota[0].sig==='C'&&Math.abs(r.senzaQuota[0].dem-300)<0.5,'campo senza quota: proposta dal rilievo');
  ok(Math.abs(r.mediana-41)<1.5,'scarto tipico: mediana tra 0, 41 e 700 m ('+Math.round(r.mediana)+')'); ok(chieste<=8,'le tessere si chiedono una volta sola ('+chieste+' richieste)');
  const t=Q.rapporto(r); ok(/\| B \| Sbagliato \| 3281 ft \(1000 m\) \| 984 ft \(300 m\) \| \+700 m/.test(t)&&/\| C \| Senza quota \| 984 ft/.test(t),'rapporto: righe dei campi fuori soglia e senza quota');
  const veri=Q.campi(require('path').join(__dirname,'../www/index.html')); ok(veri.length>1500&&veri.every(f=>typeof f[0]==='string'&&isFinite(f[3])&&isFinite(f[4])),'elenco vero dei campi letto ('+veri.length+')');
  console.log(rotte?`PROVE DELLE QUOTE: ${rotte} ROTTE su ${prove}`:`Prove delle quote dei campi: ${prove} su ${prove} passate`); process.exit(rotte?1:0);
})().catch(e=>{ console.log('ERRORE: '+(e&&e.stack||e)); process.exit(1); });
